// Plays engine events as animations on the map: moves, attacks, captures, labels (00-master-design §13).
// Split out of MapScene; it reaches the scene only through PlaybackHost.

import type Phaser from "phaser";
import type { Combatant, GameEvent } from "../engine/commands";
import type { Point } from "../engine/map";
import type { UnitTypeId } from "../engine/data/units";
import type { GameState, Unit, UnitId } from "../engine/state";
import { ADRIFT_HP } from "../engine/turn";
import { weatherOn } from "../engine/weather";
import type { BattlePlayer } from "./battle/BattleScene";
import { setBattleWeather } from "./battle/colors";
import { planDrop } from "./battle/drop";
import { planCombat, planFortAttack } from "./battle/plan";
import { planCapture, planGarrison } from "./battle/storm";
import { packColor, packColorNumber } from "./artPack";
import { drawSupplyCrateBadge } from "./placeholderUnits";
import { moveStyle, stepDirection, type MoveStyle, type StepDirection } from "./facing";
import { TILE_SIZE } from "./placeholderTiles";
import { sounds } from "./sound/player";
import { DESTROYED, FIRE_SOUND, IMPACT_SOUND, mapEventSound, moveSound } from "./sound/sounds";
import type { FireKind } from "./battle/plan";

const MOVE_MS_PER_TILE = 90;
/** How high a moving unit's sprite lifts once per square, in map pixels: soldiers hop, vehicles bump (08-art-pipeline §22). */
const MOVE_LIFT: Record<MoveStyle, number> = { foot: 1.5, vehicle: 0.5, air: 0, naval: 0 };
/** Dust behind vehicles and foam behind ships: how long a puff lasts and how far it grows. */
const PUFF = { ms: 380, size: 1.6, grow: 2 };
const COMBAT_MS = { nudge: 70, flash: 140, float: 480, explode: 260 };
/** The supply crate over a unit resupplied at turn start: popping up, staying, fading away. */
const SERVICE_POP_MS = { pop: 180, hold: 260, fade: 220 };
/** How long the view takes to pan to the next thing that happens. */
export const ACTION_PAN_MS = 220;

/** What a shot lands on: a unit, or just a tile for a fortification. */
interface StrikeTarget {
  readonly pos: Point;
  readonly unitId?: UnitId;
}

/** The middle of a tile, in map pixels. */
export const center = (p: Point) => ({ x: p.x * TILE_SIZE + TILE_SIZE / 2, y: p.y * TILE_SIZE + TILE_SIZE / 2 });

/** The parts of the map scene that event playback uses. */
export interface PlaybackHost {
  readonly scene: Phaser.Scene;
  /** The game state before the events being played. */
  state(): GameState;
  battle(): BattlePlayer | null;
  readonly unitSprites: ReadonlyMap<UnitId, Phaser.GameObjects.Container>;
  readonly unitImages: ReadonlyMap<UnitId, Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>;
  addUnitSprite(unit: Unit): void;
  /** Turns a unit's sprite to show it moving this way, or back to rest (null) (08-art-pipeline §22). */
  setUnitMotion(unitId: UnitId, direction: StepDirection | null): void;
  /** The type of the unit a sprite draws, if it's on the map. */
  unitType(unitId: UnitId): UnitTypeId | undefined;
  revealTiles(tiles: readonly Point[], ms: number): Promise<void>;
  textTexture(text: string, color: string, outline?: string): string;
  /** A texture drawn once and cached under `key`. */
  texture(key: string, draw: () => HTMLCanvasElement): string;
}

export class MapPlayback {
  constructor(private readonly host: PlaybackHost) {}

  private get state(): GameState {
    return this.host.state();
  }

  private get battle(): BattlePlayer | null {
    return this.host.battle();
  }

  private get unitSprites(): ReadonlyMap<UnitId, Phaser.GameObjects.Container> {
    return this.host.unitSprites;
  }

  private get unitImages(): ReadonlyMap<UnitId, Phaser.GameObjects.Image | Phaser.GameObjects.Sprite> {
    return this.host.unitImages;
  }

  private get add(): Phaser.GameObjects.GameObjectFactory {
    return this.host.scene.add;
  }

  private get tweens(): Phaser.Tweens.TweenManager {
    return this.host.scene.tweens;
  }

  private addUnitSprite(unit: Unit): void {
    this.host.addUnitSprite(unit);
  }

  private revealTiles(tiles: readonly Point[], ms: number): Promise<void> {
    return this.host.revealTiles(tiles, ms);
  }

  private textTexture(text: string, color: string, outline?: string): string {
    return this.host.textTexture(text, color, outline);
  }

  /** Animates engine events. Call before setState(newState); resolves when the animations finish. */
  async playEvents(events: readonly GameEvent[]): Promise<void> {
    const today = weatherOn(this.state);
    setBattleWeather({ season: this.state.weather.season, snowing: today === "snow", raining: today === "rain" });
    for (const event of events) {
      await this.revealTiles(this.eventTiles(event), ACTION_PAN_MS);
      const sound = mapEventSound(event);
      if (sound) sounds.play(sound);
      if (event.type === "unitLaunched" && !this.unitSprites.has(event.unitId)) {
        // Takes off from the Carrier's tile, unless the launch preview already put it there.
        const aircraft = this.state.units.find((u) => u.id === event.carrierId)?.cargo.find((c) => c.id === event.unitId);
        if (aircraft) this.addUnitSprite({ ...aircraft, pos: event.pos, hasActed: false });
      }
      if (event.type === "unitMoved") {
        await this.walk(event.unitId, event.path);
        await this.playGarrison(event.unitId, event.path[0] ?? null, event.path[event.path.length - 1], events);
      }
      if (event.type === "unitUnloaded") {
        // A Transport Aircraft's passengers jump (08-art-pipeline §20); others may go into a bunker.
        const drop = this.battle && planDrop(this.state, event);
        if (this.battle && drop) await this.battle.playDrop(drop);
        else await this.playGarrison(event.unitId, null, event.pos, events);
      }
      if (event.type === "combat") await this.playCombat(event);
      if (event.type === "fortAttacked") {
        const plan = planFortAttack(this.state, event);
        if (this.battle && plan) await this.battle.play(plan);
        else {
          const shooter = { unitId: event.attackerId, pos: event.attackerPos };
          const fire = plan?.strikes[0]?.fire ?? null;
          await this.playStrike(shooter, { pos: event.pos }, event.attack.damage, event.hp === 0, fire);
        }
      }
      if (event.type === "captureProgress" || event.type === "propertyCaptured") {
        // A capture plays as a storming scene when scenes are on (08-art-pipeline §19), else as a label.
        const plan = this.battle && planCapture(this.state, event);
        if (this.battle && plan) await this.battle.playStorm(plan);
        else if (event.type === "captureProgress") await this.floatLabel(event.pos, `${event.capturePoints} LEFT`, packColor("labelText"));
        else {
          sounds.play("captured");
          await this.floatLabel(event.pos, "CAPTURED", packColor("labelGold"));
        }
      }
      // Major Bridges (02-terrain §4a). The terrain under them is redrawn with the next state.
      if (event.type === "bridgeBlown") {
        await Promise.all([this.explode({ pos: event.pos }), this.floatLabel(event.pos, "BRIDGE BLOWN", packColor("labelWarning"))]);
      }
      if (event.type === "bridgeRebuildProgress") await this.floatLabel(event.pos, `${event.points} LEFT`, packColor("labelText"));
      if (event.type === "bridgeRebuilt") await this.floatLabel(event.pos, "BRIDGE REBUILT", packColor("labelGold"));
      if (event.type === "unitOutOfFuel") {
        const lost = { pos: event.pos, unitId: event.unitId };
        await Promise.all([this.explode(lost), this.floatLabel(event.pos, "OUT OF FUEL", packColor("labelWarning"))]);
      }
      // A ship that runs dry stays afloat, stuck until it's refuelled (05-supply-transport §7).
      if (event.type === "unitStranded") await this.floatLabel(event.pos, "OUT OF FUEL", packColor("labelWarning"));
      // Each day after, still dry, it loses HP adrift until it's refuelled or sinks (05-supply-transport §7).
      if (event.type === "unitAdrift") await this.floatLabel(event.pos, `ADRIFT -${ADRIFT_HP} HP`, packColor("labelWarning"));
      // A raider or an empty Landing Craft turns for home, then flies or sails off the map's edge
      // (23-survival §5c): not a loss, so no explosion.
      if (event.type === "unitHomeward") await this.floatLabel(event.pos, "HEADING HOME", packColor("labelText"));
      if (event.type === "unitLeft") {
        const sprite = this.unitSprites.get(event.unitId);
        if (sprite) await this.tween(sprite, { alpha: 0 }, COMBAT_MS.float);
      }
      if (event.type === "unitJoined") {
        const target = this.state.units.find((u) => u.id === event.targetId);
        if (target) await this.floatLabel(target.pos, "JOINED", packColor("labelText"));
      }
      if (event.type === "unitAmbushed") {
        // The hidden unit it ran into comes into view (05-supply-transport §9, 19-fog-of-war §5).
        await this.floatLabel(event.pos, "AMBUSH!", packColor("labelWarning"));
      }
      if (event.type === "unitDived" || event.type === "unitSurfaced") {
        // The sprite has already walked to where the submarine dived or surfaced.
        const sprite = this.unitSprites.get(event.unitId);
        const tile = sprite && { x: Math.round(sprite.x / TILE_SIZE), y: Math.round(sprite.y / TILE_SIZE) };
        if (tile) await this.floatLabel(tile, event.type === "unitDived" ? "DIVE" : "SURFACE", packColor("submerged"));
      }
    }
    // Repairs and resupplies at the start of a turn play afterwards, one unit at a time (servicePop).
    const turnStart = events.findIndex((e) => e.type === "turnStarted");
    const labels = this.repairLabels(turnStart < 0 ? events : events.slice(0, turnStart));
    if (labels.length > 0) sounds.play("supply");
    await Promise.all(labels);
  }

  /** Foot soldiers going into a bunker play a storming scene, when scenes are on (08-art-pipeline §19). */
  private async playGarrison(unitId: UnitId, from: Point | null, to: Point | undefined, events: readonly GameEvent[]): Promise<void> {
    if (!this.battle || !to) return;
    const plan = planGarrison(this.state, unitId, from, to, events);
    if (plan) await this.battle.playStorm(plan);
  }

  /** Where an event happens, so the view can pan to it first. Repairs at turn start don't pan. */
  private eventTiles(event: GameEvent): Point[] {
    switch (event.type) {
      case "unitMoved":
        return event.path.slice(0, 1);
      case "combat":
        return [event.attacker.pos, event.defender.pos];
      case "fortAttacked":
        return [event.attackerPos, event.pos];
      case "captureProgress":
      case "propertyCaptured":
      case "bridgeBlown":
      case "bridgeRebuildProgress":
      case "bridgeRebuilt":
      case "unitOutOfFuel":
      case "unitStranded":
      case "unitAdrift":
      case "unitLeft":
      case "unitHomeward":
      case "unitLaunched":
      case "unitAmbushed":
        return [event.pos];
      case "unitJoined": {
        const target = this.state.units.find((u) => u.id === event.targetId);
        return target ? [target.pos] : [];
      }
      default:
        return [];
    }
  }

  /** "+2" over repaired units and "SUPPLY" over units only resupplied, all at once. */
  private repairLabels(events: readonly GameEvent[]): Promise<void>[] {
    const repaired = new Set<UnitId>();
    const labels: Promise<void>[] = [];
    // Aircraft aboard a Carrier are serviced there, so their labels show over the Carrier.
    const over = (unitId: UnitId, text: string, color: string) => {
      const unit = this.state.units.find((u) => u.id === unitId || u.cargo.some((c) => c.id === unitId));
      if (unit) labels.push(this.floatLabel(unit.pos, text, color));
    };
    for (const event of events) {
      if (event.type !== "unitRepaired") continue;
      repaired.add(event.unitId);
      over(event.unitId, `+${event.hp}`, packColor("labelGreen"));
    }
    for (const event of events) {
      if (event.type === "unitResupplied" && !repaired.has(event.unitId)) over(event.unitId, "SUPPLY", packColor("labelBlue"));
    }
    return labels;
  }

  /**
   * A unit being serviced at the start of its turn: a supply crate pops up over it if it was
   * refuelled and rearmed, and "+2" rises off it if it was repaired.
   */
  async servicePop(tile: Point, repairedHp: number, resupplied: boolean): Promise<void> {
    const shown: Promise<void>[] = [];
    if (resupplied) shown.push(this.supplyCrate(tile));
    if (repairedHp > 0) shown.push(this.floatLabel(tile, `+${repairedHp}`, packColor("labelGreen")));
    await Promise.all(shown);
  }

  /** The supply crate bounces up out of the unit, holds a moment, then rises and fades. */
  private async supplyCrate(tile: Point): Promise<void> {
    const { x, y } = center(tile);
    const crate = this.add.image(x, y - 4, this.host.texture("supply-crate", drawSupplyCrateBadge)).setScale(0);
    await new Promise<void>((resolve) => {
      this.tweens.add({ targets: crate, scale: 1, y: y - 10, duration: SERVICE_POP_MS.pop, ease: "Back.easeOut", onComplete: () => resolve() });
    });
    await this.tween(crate, { y: y - 10 }, SERVICE_POP_MS.hold);
    await this.tween(crate, { y: y - 16, alpha: 0 }, SERVICE_POP_MS.fade);
    crate.destroy();
  }

  /**
   * The attack, then the counter if there was one, then any promotions (00-master-design §13): as a
   * battle scene when they're on, otherwise on the map. After a battle scene, a destroyed unit
   * still blows up on the map so it's clear which one is gone.
   */
  private async playCombat(event: Extract<GameEvent, { type: "combat" }>): Promise<void> {
    const { attacker, defender, attack, counter } = event;
    const plan = planCombat(this.state, event);
    // A unit firing from out of sight stays hidden, so its shot plays on the map (19-fog-of-war §6).
    if (this.battle && this.unitSprites.has(attacker.unitId)) {
      await this.battle.play(plan);
      const lost = [attacker, defender].filter((u) => u.destroyed).map((u) => this.explode({ pos: u.pos, unitId: u.unitId }));
      await Promise.all(lost);
    } else {
      const [attackFire, counterFire] = plan.strikes.map((s) => s.fire);
      await this.playStrike(attacker, defender, attack.damage, counter === null && defender.destroyed, attackFire ?? null);
      if (counter) await this.playStrike(defender, attacker, counter.damage, attacker.destroyed, counterFire ?? null);
    }
    for (const unit of [attacker, defender]) {
      if (unit.promotedTo) await this.floatLabel(unit.pos, unit.promotedTo.toUpperCase(), packColor("labelGold"));
    }
  }

  /** The shooter nudges toward its target, which flashes and shows the damage. `fire` is the weapon, for its sounds (16-sound §3). */
  private async playStrike(
    shooter: Pick<Combatant, "unitId" | "pos">,
    target: StrikeTarget,
    damage: number,
    destroyed: boolean,
    fire: FireKind | null,
  ): Promise<void> {
    if (fire) sounds.play(FIRE_SOUND[fire]);
    const sprite = this.unitSprites.get(shooter.unitId);
    if (sprite) {
      const { x, y } = sprite;
      const dx = Math.sign(target.pos.x - shooter.pos.x) * 3;
      const dy = Math.sign(target.pos.y - shooter.pos.y) * 3;
      await this.tween(sprite, { x: x + dx, y: y + dy }, COMBAT_MS.nudge);
      await this.tween(sprite, { x, y }, COMBAT_MS.nudge);
    }
    if (fire) sounds.play(IMPACT_SOUND[fire].sound, { volume: IMPACT_SOUND[fire].volume });
    const flash = this.add.rectangle(target.pos.x * TILE_SIZE, target.pos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE, packColorNumber("flash")).setOrigin(0);
    await this.tween(flash, { alpha: 0 }, COMBAT_MS.flash);
    flash.destroy();
    await Promise.all([
      this.floatLabel(target.pos, `-${damage}`, packColor("labelText")),
      destroyed ? this.explode(target) : Promise.resolve(),
    ]);
  }

  private async explode(target: StrikeTarget): Promise<void> {
    const { x, y } = center(target.pos);
    sounds.play(DESTROYED.sound, { volume: DESTROYED.volume, detune: DESTROYED.detune });
    const blast = this.add.rectangle(x, y, 8, 8, packColorNumber("blast"));
    const sprite = target.unitId === undefined ? undefined : this.unitSprites.get(target.unitId);
    await Promise.all([
      this.tween(blast, { scaleX: 2.5, scaleY: 2.5, alpha: 0 }, COMBAT_MS.explode),
      sprite ? this.tween(sprite, { alpha: 0 }, COMBAT_MS.explode) : Promise.resolve(),
    ]);
    blast.destroy();
  }

  /** Text that rises from a tile and fades out. */
  private async floatLabel(tile: Point, text: string, color: string): Promise<void> {
    const { x, y } = center(tile);
    const label = this.add.image(x, y, this.textTexture(text, color, packColor("labelOutline")));
    await this.tween(label, { y: y - 9, alpha: 0 }, COMBAT_MS.float);
    label.destroy();
  }

  private tween(target: object, props: Record<string, number>, duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ targets: target, ...props, duration, onComplete: () => resolve() });
    });
  }

  /**
   * Moves a unit's sprite square by square along a path (08-art-pipeline §22). On each step it turns
   * to face the way it goes and animates fast: soldiers step and hop, vehicles bump along raising
   * dust, ships leave foam, aircraft glide. At the end it's back at rest. Skips if it's already at the
   * end (previewed).
   */
  async walk(unitId: UnitId, fullPath: readonly Point[]): Promise<void> {
    const sprite = this.unitSprites.get(unitId);
    const end = fullPath[fullPath.length - 1];
    if (!sprite || !end) return;
    if (sprite.x === end.x * TILE_SIZE && sprite.y === end.y * TILE_SIZE) return;
    // Previewed somewhere it didn't get to (it was ambushed on the way): start again from the beginning.
    const start = fullPath[0];
    if (start) sprite.setPosition(start.x * TILE_SIZE, start.y * TILE_SIZE);
    // A soldier leaving a garrisoned bunker comes out into view.
    const image = this.unitImages.get(unitId);
    image?.setVisible(true);
    const type = this.host.unitType(unitId);
    const style = type ? moveStyle(type) : "vehicle";
    // Footsteps, wheels, tracks, propellers or an engine and wake, for as long as it moves (16-sound §3).
    const stopSound = type ? sounds.loop(moveSound(type)) : () => undefined;
    let from = start;
    try {
      for (const p of fullPath.slice(1)) {
        const direction = from ? stepDirection(from, p) : null;
        if (direction) this.host.setUnitMotion(unitId, direction);
        if (from && (style === "vehicle" || style === "naval")) this.puff(from, p, style);
        // The view keeps pace with the unit, so a long move never walks off screen.
        await Promise.all([
          this.revealTiles([p], MOVE_MS_PER_TILE),
          this.tween(sprite, { x: p.x * TILE_SIZE, y: p.y * TILE_SIZE }, MOVE_MS_PER_TILE),
          image && MOVE_LIFT[style] > 0 ? this.hop(image, MOVE_LIFT[style]) : Promise.resolve(),
        ]);
        from = p;
      }
    } finally {
      stopSound();
    }
    this.host.setUnitMotion(unitId, null);
  }

  /** The sprite lifts and drops once over a step; its shadow stays on the ground. */
  private hop(image: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, lift: number): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({
        targets: image,
        y: -lift,
        duration: MOVE_MS_PER_TILE / 2,
        yoyo: true,
        ease: "Sine.easeOut",
        onComplete: () => {
          image.setY(0);
          resolve();
        },
      });
    });
  }

  /** A puff of dust (vehicles) or foam (ships) left behind on the square a unit is leaving. */
  private puff(from: Point, to: Point, style: "vehicle" | "naval"): void {
    const c = center(from);
    // Behind the unit's back end, low on the square.
    const x = c.x - Math.sign(to.x - from.x) * 4;
    const y = c.y + 4 - Math.sign(to.y - from.y) * 3;
    const color = packColorNumber(style === "naval" ? "moveFoam" : "moveDust");
    const puff = this.add.circle(x, y, PUFF.size, color, 0.7);
    this.tweens.add({
      targets: puff,
      scale: PUFF.grow,
      alpha: 0,
      y: y - 2,
      duration: PUFF.ms,
      onComplete: () => puff.destroy(),
    });
  }
}
