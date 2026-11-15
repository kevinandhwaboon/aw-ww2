import { describe, expect, it } from "vitest";
import type { GameEvent } from "../src/engine/commands";
import type { UnitTypeId } from "../src/engine/data/units";
import { parseArtPack } from "../src/game/artPack";
import type { DropPlan } from "../src/game/battle/drop";
import { DROP_MS, jumpTimes } from "../src/game/battle/drop";
import type { BattleHalf, BattlePlan, BattleStrike, FigureKind, FireKind, HalfId } from "../src/game/battle/plan";
import { coverFigures, coverShotTimes, lastInside, stormTimes, type StormPlan } from "../src/game/battle/storm";
import { buildTimeline } from "../src/game/battle/timeline";
import {
  battleCues,
  cuesBetween,
  DESTROYED,
  dropCues,
  FIRE_SOUND,
  IMPACT_SOUND,
  mapEventSound,
  moveSound,
  PITCH_SPREAD_CENTS,
  SAME_SOUND_GAP_MS,
  SOUND_IDS,
  stormCues,
  thinCues,
  type SoundCue,
  type SoundId,
} from "../src/game/sound/sounds";
import {
  DEFAULT_SOUND_LEVEL,
  loadSoundLevel,
  nextSoundLevel,
  saveSoundLevel,
  SOUND_STORAGE_KEY,
  toggleMute,
  type TextStore,
} from "../src/game/sound/settings";

const half = (side: HalfId, kind: FigureKind, hp = 10): BattleHalf => ({
  half: side,
  kind,
  owner: side === "left" ? 0 : 1,
  nation: side === "left" ? "us" : "germany",
  terrain: "plains",
  hp,
  submerged: false,
  paratrooper: false,
  suit: 0,
});

const strike = (from: HalfId, fire: FireKind, hpBefore: number, hpAfter: number): BattleStrike => ({ from, fire, hpBefore, hpAfter, atAir: false });

/** The left half attacks the right with one weapon; the right fires back with another if given. */
function battle(left: FigureKind, right: FigureKind, fire: FireKind, hpAfter: number, counter?: FireKind): BattlePlan {
  const strikes = [strike("left", fire, 10, hpAfter)];
  if (counter) strikes.push(strike("right", counter, 10, 8));
  return { left: half("left", left), right: half("right", right), strikes };
}

const of = (cues: readonly SoundCue[], sound: SoundId) => cues.filter((c) => c.sound === sound);

describe("battle scene sounds (16-sound §3)", () => {
  it("a tank's shot is heard as it leaves the barrel, and its shell as it lands", () => {
    const plan = battle("mediumTank", "mediumTank", "tankGun", 6);
    const timeline = buildTimeline(plan);
    const cues = battleCues(plan, timeline);
    for (const shot of timeline.shots) {
      expect(of(cues, "fireCannon").some((c) => c.at === shot.fireAt)).toBe(true);
      expect(of(cues, "impactShell").some((c) => c.at === shot.landAt)).toBe(true);
    }
  });

  it("shots are heard on the shooter's side of the screen, and land on the target's side", () => {
    const plan = battle("mediumTank", "mediumTank", "tankGun", 6);
    const cues = battleCues(plan, buildTimeline(plan));
    expect(of(cues, "fireCannon").every((c) => c.pan < 0)).toBe(true);
    expect(of(cues, "impactShell").every((c) => c.pan > 0)).toBe(true);
  });

  it("the counterattack is heard from the other side, with the defender's own weapon", () => {
    const plan = battle("infantry", "mediumTank", "rifle", 9, "mg");
    const cues = battleCues(plan, buildTimeline(plan));
    expect(of(cues, "fireRifle").every((c) => c.pan < 0)).toBe(true);
    expect(cues.some((c) => c.sound === "fireMg" && c.pan > 0)).toBe(true);
  });

  it("a tank knocked out explodes as the shot that kills it lands, louder and deeper than a shell landing", () => {
    const plan = battle("mediumTank", "mediumTank", "tankGun", 4);
    const timeline = buildTimeline(plan);
    const kills = timeline.shots.filter((s) => s.kills);
    const explosions = of(battleCues(plan, timeline), "explosion");
    expect(kills.length).toBeGreaterThan(0);
    expect(explosions.map((c) => c.at)).toEqual(kills.map((s) => s.landAt));
    expect(explosions.every((c) => c.detune === DESTROYED.detune && c.volume === DESTROYED.volume)).toBe(true);
  });

  it("a bunker knocked out explodes too", () => {
    const plan: BattlePlan = { left: half("left", "artillery"), right: { ...half("right", "bunker"), owner: null, nation: null }, strikes: [strike("left", "howitzer", 10, 0)] };
    const timeline = buildTimeline(plan);
    const killing = timeline.shots.find((s) => s.kills);
    expect(of(battleCues(plan, timeline), "explosion").some((c) => c.at === killing?.landAt && c.volume === DESTROYED.volume)).toBe(true);
  });

  it("soldiers fall without an explosion", () => {
    const plan = battle("mediumTank", "infantry", "mg", 2);
    const timeline = buildTimeline(plan);
    expect(timeline.shots.some((s) => s.kills)).toBe(true);
    expect(of(battleCues(plan, timeline), "explosion")).toEqual([]);
  });

  it("a squad's riflemen sound like rifles, and its submachine guns and light machine gun like machine guns", () => {
    const plan = battle("infantry", "infantry", "rifle", 7);
    const cues = battleCues(plan, buildTimeline(plan));
    expect(of(cues, "fireRifle").length).toBeGreaterThan(0);
    expect(of(cues, "fireMg").length).toBeGreaterThan(0);
  });

  it("heavy weapons land with an explosion, a little quieter than something being destroyed", () => {
    for (const fire of ["howitzer", "rockets", "bombs", "navalGuns", "torpedo"] as const) {
      expect(IMPACT_SOUND[fire].sound).toBe("explosion");
      expect(IMPACT_SOUND[fire].volume).toBeLessThan(DESTROYED.volume);
    }
  });

  it("bombs whistle as they fall, and torpedoes and depth charges splash into the water (16-sound §4)", () => {
    expect([FIRE_SOUND.bombs, FIRE_SOUND.diveBomb]).toEqual(["bombWhistle", "bombWhistle"]);
    expect([FIRE_SOUND.torpedo, FIRE_SOUND.aerialTorpedo, FIRE_SOUND.depthCharges]).toEqual(["waterSplash", "waterSplash", "waterSplash"]);
  });

  it("the same battle always sounds the same, and no shot's pitch moves more than 0.6 of a semitone (16-sound §5)", () => {
    const plan = battle("infantry", "infantry", "rifle", 5);
    const cues = battleCues(plan, buildTimeline(plan));
    expect(battleCues(plan, buildTimeline(plan))).toEqual(cues);
    expect(cues.filter((c) => c.sound !== "explosion").every((c) => Math.abs(c.detune) <= PITCH_SPREAD_CENTS)).toBe(true);
    expect(new Set(cues.map((c) => c.detune)).size).toBeGreaterThan(1);
  });

  it("machine-gun bursts never start the same sound closer together than 40 ms (16-sound §5)", () => {
    const plan = battle("fighter", "fighter", "planeGuns", 4, "planeGuns");
    const cues = battleCues(plan, buildTimeline(plan));
    for (const id of SOUND_IDS) {
      const times = of(cues, id).map((c) => c.at);
      times.slice(1).forEach((t, i) => expect(t - (times[i] ?? 0)).toBeGreaterThanOrEqual(SAME_SOUND_GAP_MS));
    }
  });

  it("as a scene's clock runs, every cue plays exactly once", () => {
    const plan = battle("infantry", "mediumTank", "bazooka", 5, "tankGun");
    const timeline = buildTimeline(plan);
    const cues = battleCues(plan, timeline);
    const played: SoundCue[] = [];
    for (let t = 0; t < timeline.total; t += 16) played.push(...cuesBetween(cues, t, t + 16));
    expect(played).toEqual(cues);
  });
});

describe("mixing (16-sound §5)", () => {
  const cue = (at: number, sound: SoundId, volume = 1): SoundCue => ({ at, sound, volume, pan: 0, detune: 0, variant: 0 });

  it("the same sound starting less than 40 ms after itself is dropped", () => {
    expect(thinCues([cue(0, "fireMg"), cue(30, "fireMg"), cue(45, "fireMg")]).map((c) => c.at)).toEqual([0, 45]);
  });

  it("different sounds at the same moment all play", () => {
    expect(thinCues([cue(10, "fireMg"), cue(10, "impactBullet"), cue(10, "explosion")])).toHaveLength(3);
  });

  it("when two of the same sound clash, the louder one is kept, at the earlier time", () => {
    expect(thinCues([cue(100, "explosion", 0.7), cue(120, "explosion", 1.25)])).toEqual([cue(100, "explosion", 1.25)]);
  });

  it("cues come out in time order", () => {
    expect(thinCues([cue(300, "fireRifle"), cue(100, "fireMg"), cue(200, "explosion")]).map((c) => c.at)).toEqual([100, 200, 300]);
  });
});

describe("capture, bunker and drop scene sounds (16-sound §3)", () => {
  const storm = (extra: Partial<StormPlan> = {}): StormPlan => ({
    kind: "capture",
    unit: "infantry",
    owner: 0,
    nation: "us",
    hp: 10,
    paratrooper: false,
    suit: 0,
    terrain: "city",
    before: 20,
    after: 10,
    captured: false,
    previousOwner: null,
    previousNation: null,
    ...extra,
  });

  it("the cover men are heard firing each time they fire, and each soldier's footsteps as he sets off", () => {
    const plan = storm();
    const times = stormTimes(plan);
    const shots = Array.from({ length: coverFigures(plan) }, (_, i) => coverShotTimes(times, i)).flat();
    const cues = stormCues(plan);
    expect(of(cues, "fireRifle").map((c) => c.at).sort((a, b) => a - b)).toEqual([...shots].sort((a, b) => a - b));
    expect(of(cues, "moveFoot").map((c) => c.at).sort((a, b) => a - b)).toEqual(times.map((t) => t.start).sort((a, b) => a - b));
  });

  it("a completed capture plays the captured tune as the flags change; one still under way doesn't", () => {
    const done = storm({ after: 0, captured: true });
    expect(of(stormCues(done), "captured").map((c) => c.at)).toEqual([lastInside(done) + 200]);
    expect(of(stormCues(storm()), "captured")).toEqual([]);
  });

  it("finishing a capture already under way plays the tune as the flag reaches the top", () => {
    const done = storm({ before: 10, after: 0, captured: true });
    expect(of(stormCues(done), "captured").map((c) => c.at)).toEqual([lastInside(done)]);
  });

  it("going into a bunker has footsteps but no gunfire", () => {
    const cues = stormCues(storm({ kind: "garrison", terrain: "bunker", before: 0, after: 0 }));
    expect(of(cues, "fireRifle")).toEqual([]);
    expect(of(cues, "moveFoot").length).toBeGreaterThan(0);
  });

  it("an airborne drop plays the plane's engine for its whole crossing, and one canopy opening per man", () => {
    const plan: DropPlan = { unit: "infantry", owner: 0, nation: "us", hp: 10, paratrooper: true, suit: 1, terrain: "plains" };
    const cues = dropCues(plan);
    expect(of(cues, "moveAir")).toEqual([expect.objectContaining({ at: DROP_MS.intro, loopFor: DROP_MS.cross })]);
    expect(of(cues, "chute").map((c) => c.at)).toEqual(jumpTimes(plan).map((j) => j.exit + DROP_MS.freefall));
  });
});

describe("map sounds (16-sound §3)", () => {
  it("soldiers march, tanks clank on tracks, jeeps, trucks and towed guns roll on wheels, aircraft and ships have their own", () => {
    const expected: [UnitTypeId, SoundId][] = [
      ["infantry", "moveFoot"],
      ["mortar", "moveFoot"],
      ["mediumTank", "moveTracks"],
      ["tankDestroyer", "moveTracks"],
      ["recon", "moveWheels"],
      ["rocketArtillery", "moveWheels"],
      ["artillery", "moveWheels"],
      ["fighter", "moveAir"],
      ["transportAircraft", "moveAir"],
      ["destroyer", "moveNaval"],
      ["submarine", "moveNaval"],
    ];
    for (const [type, sound] of expected) expect(moveSound(type), type).toBe(sound);
  });

  it("building a unit clanks, an ambush sounds an alert, and a submarine diving or surfacing splashes", () => {
    const built: GameEvent = { type: "unitBuilt", unitId: 1, unitType: "infantry", owner: 0, pos: { x: 0, y: 0 }, cost: 1000 };
    expect(mapEventSound(built)).toBe("built");
    expect(mapEventSound({ type: "unitAmbushed", unitId: 1, by: 2, pos: { x: 0, y: 0 } })).toBe("alert");
    expect(mapEventSound({ type: "unitDived", unitId: 1 })).toBe("waterSplash");
    expect(mapEventSound({ type: "unitSurfaced", unitId: 1 })).toBe("waterSplash");
    expect(mapEventSound({ type: "unitWaited", unitId: 1 })).toBeNull();
  });
});

describe("sound files (16-sound §7, §9)", () => {
  it("a pack names sound files by sound id: one file, or several to pick from", () => {
    const pack = parseArtPack({ name: "x", sounds: { explosion: "boom.mp3", fireRifle: ["a.mp3", "b.mp3"] } });
    expect(pack.sounds).toEqual({ explosion: ["boom.mp3"], fireRifle: ["a.mp3", "b.mp3"] });
  });

  it("a sound the pack leaves out has no file, so it stays silent", () => {
    expect(parseArtPack({ name: "x", sounds: { explosion: "boom.mp3" } }).sounds.fireRifle).toBeUndefined();
    expect(parseArtPack({ name: "x" }).sounds).toEqual({});
  });

  it("unknown sound ids, empty lists and web addresses are refused", () => {
    expect(() => parseArtPack({ name: "x", sounds: { kaboom: "a.mp3" } })).toThrow(/unknown sound/);
    expect(() => parseArtPack({ name: "x", sounds: { explosion: [] } })).toThrow(/explosion/);
    expect(() => parseArtPack({ name: "x", sounds: { explosion: "https://example.com/a.mp3" } })).toThrow(/explosion/);
  });
});

describe("the sound level (16-sound §8)", () => {
  function memory(initial: Record<string, string> = {}): TextStore & { data: Record<string, string> } {
    const data = { ...initial };
    return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => void (data[key] = value) };
  }

  it("sound starts at Medium when nothing is saved, or what's saved isn't a level", () => {
    expect(DEFAULT_SOUND_LEVEL).toBe("medium");
    expect(loadSoundLevel(memory())).toBe("medium");
    expect(loadSoundLevel(memory({ [SOUND_STORAGE_KEY]: "loud" }))).toBe("medium");
    expect(loadSoundLevel(null)).toBe("medium");
  });

  it("the sound button goes Off, Low, Medium, High, then Off again", () => {
    expect([nextSoundLevel("off"), nextSoundLevel("low"), nextSoundLevel("medium"), nextSoundLevel("high")]).toEqual(["low", "medium", "high", "off"]);
  });

  it("M turns sound off, and back on at the level it was at", () => {
    expect(toggleMute("high", "high")).toBe("off");
    expect(toggleMute("off", "high")).toBe("high");
    expect(toggleMute("off", "off")).toBe("medium");
  });

  it("the level is saved on the device and read back next time", () => {
    const store = memory();
    saveSoundLevel(store, "low");
    expect(loadSoundLevel(store)).toBe("low");
  });

  it("storage the browser blocks never stops the game: the level just isn't kept", () => {
    const blocked: TextStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => saveSoundLevel(blocked, "high")).not.toThrow();
    expect(loadSoundLevel(blocked)).toBe("medium");
  });
});
