import { describe, expect, it } from "vitest";
import { commandersFor, parseUrlOptions, withCommanders, withNations, type UrlParams } from "../src/urlOptions";

/** "?seed=1&ai=0,1" as URL parameters. */
function query(text: string): UrlParams {
  const pairs = new Map(
    text
      .replace(/^\?/, "")
      .split("&")
      .filter((pair) => pair !== "")
      .map((pair): [string, string] => {
        const [name = "", value = ""] = pair.split("=");
        return [name, decodeURIComponent(value)];
      }),
  );
  return { get: (name) => pairs.get(name) ?? null };
}

const options = (text: string) => parseUrlOptions(query(text));

describe("URL options (11-tech-setup §7)", () => {
  it("with no options, the game starts from the menus with everything at its usual setting", () => {
    expect(options("")).toEqual({
      map: null,
      seed: null,
      luck: true,
      passDevice: true,
      battleScenes: true,
      battleDemo: false,
      polish: true,
      pack: "default",
      debug: false,
      computer: null,
      level: "normal",
      pad: null,
      sound: true,
      nations: [],
      commanders: [],
    });
  });

  it("?commanders= gives each player a commander, in player order; blanks and unknown names mean no commander (06-commanders §5)", () => {
    expect(options("?commanders=harlan,falk").commanders).toEqual(["harlan", "falk"]);
    expect(options("?commanders=,arakawa").commanders).toEqual([null, "arakawa"]);
    expect(options("?commanders=napoleon").commanders).toEqual([null]);
  });

  it("a player may pick any commander of their own side, whatever the nation (06-commanders §2)", () => {
    expect(commandersFor("canada")).toEqual(["harlan", "calloway", "ashdown", "tremblay", "morozov"]);
    expect(commandersFor("italy")).toEqual(["falk", "ferrante", "arakawa"]);
  });

  it("a commander chosen for the other side is dropped, and no choice leaves the player without one (06-commanders §2)", () => {
    const players = [{ name: "Allies", nation: "us" as const }, { name: "Axis", nation: "germany" as const }];
    expect(withCommanders(players, ["ashdown", "arakawa"]).map((p) => p.commander)).toEqual(["ashdown", "arakawa"]);
    expect(withCommanders(players, ["falk", "harlan"]).map((p) => p.commander)).toEqual([undefined, undefined]);
    expect(withCommanders(players, [null]).map((p) => p.commander)).toEqual([undefined, undefined]);
  });

  it("?nations= swaps which nation each player fields, in player order, to show a nation's art on any map", () => {
    expect(options("?nations=uk,germany").nations).toEqual(["uk", "germany"]);
    expect(options("?nations=,uk").nations).toEqual([null, "uk"]);
    expect(options("?nations=narnia").nations).toEqual([null]);
    const players = [{ name: "Allies", nation: "us" as const }, { name: "Axis", nation: "germany" as const }];
    expect(withNations(players, [null, "japan"]).map((p) => p.nation)).toEqual(["us", "japan"]);
    expect(withNations(players, ["uk"]).map((p) => p.nation)).toEqual(["uk", "germany"]);
  });

  it("?map= skips the menus and starts that scenario", () => {
    expect(options("?map=bastogne").map).toBe("bastogne");
  });

  it("?seed= fixes the luck rolls, including seed 0", () => {
    expect(options("?seed=123").seed).toBe(123);
    expect(options("?seed=0").seed).toBe(0);
  });

  it("a blank or non-numeric seed picks a random one, rather than seed 0", () => {
    expect(options("?seed=").seed).toBeNull();
    expect(options("?seed=abc").seed).toBeNull();
  });

  it("luck, the pass-the-device screen, battle scenes and the polish pass each turn off with =off", () => {
    expect(options("?luck=off&handoff=off&battle=off&polish=off")).toMatchObject({
      luck: false,
      passDevice: false,
      battleScenes: false,
      polish: false,
    });
  });

  it("?battle=demo opens the battle preview page", () => {
    expect(options("?battle=demo")).toMatchObject({ battleDemo: true, battleScenes: true });
  });

  it("?pack= picks the art pack and ?debug=on shows the debug panels", () => {
    expect(options("?pack=night-ops&debug=on")).toMatchObject({ pack: "night-ops", debug: true });
  });

  it("?ai= lists the players the computer plays; ?ai=none means everyone is human", () => {
    expect(options("?ai=1").computer).toEqual([1]);
    expect(options("?ai=0,1").computer).toEqual([0, 1]);
    expect(options("?ai=none").computer).toEqual([]);
  });

  it("a blank ?ai= means everyone is human, not that the computer plays the first player", () => {
    expect(options("?ai=").computer).toEqual([]);
  });

  it("entries in ?ai= that aren't player numbers are skipped", () => {
    expect(options("?ai=0,x,,1").computer).toEqual([0, 1]);
  });

  it("?level=easy has the computer play on Easy; anything else is Normal (09-ai §4c)", () => {
    expect(options("?level=easy").level).toBe("easy");
    expect(options("?level=hard").level).toBe("normal");
  });

  it("?pad=on or ?pad=off forces the phone game pad; anything else leaves it to the screen size", () => {
    expect(options("?pad=on").pad).toBe(true);
    expect(options("?pad=off").pad).toBe(false);
    expect(options("?pad=maybe").pad).toBeNull();
  });

  it("?sound=off starts with sound off; anything else leaves the saved level alone (16-sound §8)", () => {
    expect(options("?sound=off").sound).toBe(false);
    expect(options("?sound=on").sound).toBe(true);
  });
});
