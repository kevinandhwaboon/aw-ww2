import { describe, expect, it } from "vitest";
import { parseUrlOptions, type UrlParams } from "../src/urlOptions";

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
    });
  });

  it("?map= skips the menus and starts that scenario", () => {
    expect(options("?map=bocage-country").map).toBe("bocage-country");
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
});
