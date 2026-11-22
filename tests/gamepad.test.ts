import { describe, expect, it } from "vitest";
import { NO_KEYS_HELD, REPEAT_DELAY_MS, REPEAT_MS, readControllers, type PadSnapshot } from "../src/ui/gamepadKeys";

function pad(buttons: readonly number[], axes: readonly number[] = [0, 0]): PadSnapshot {
  const pressed = Array.from({ length: 17 }, (_, i) => buttons.includes(i));
  return { pressed, axes };
}

describe("game controllers (11-tech-setup §3c)", () => {
  it("the A button presses Z and the B button presses X", () => {
    const { actions } = readControllers(NO_KEYS_HELD, [pad([0, 1])], 0);
    expect(actions).toEqual([
      { type: "keydown", key: "z", repeat: false },
      { type: "keydown", key: "x", repeat: false },
    ]);
  });

  it("letting go of B lets go of X, so holding B shows a unit's range only while held", () => {
    const held = readControllers(NO_KEYS_HELD, [pad([1])], 0).state;
    expect(readControllers(held, [pad([1])], 1000).actions).toEqual([]);
    expect(readControllers(held, [pad([])], 1000).actions).toEqual([{ type: "keyup", key: "x", repeat: false }]);
  });

  it("holding A does not press Z again", () => {
    const held = readControllers(NO_KEYS_HELD, [pad([0])], 0).state;
    expect(readControllers(held, [pad([0])], 5000).actions).toEqual([]);
  });

  it("the D-pad presses the arrow keys", () => {
    const { actions } = readControllers(NO_KEYS_HELD, [pad([12, 15])], 0);
    expect(actions.map((a) => a.key)).toEqual(["ArrowUp", "ArrowRight"]);
  });

  it("the left stick leaning far enough presses its strongest direction", () => {
    expect(readControllers(NO_KEYS_HELD, [pad([], [0.2, -0.9])], 0).actions.map((a) => a.key)).toEqual(["ArrowUp"]);
    expect(readControllers(NO_KEYS_HELD, [pad([], [0.8, 0.6])], 0).actions.map((a) => a.key)).toEqual(["ArrowRight"]);
    expect(readControllers(NO_KEYS_HELD, [pad([], [0.3, 0.2])], 0).actions).toEqual([]);
  });

  it("holding a direction moves again after a pause, then steadily", () => {
    let state = readControllers(NO_KEYS_HELD, [pad([13])], 0).state;
    let read = readControllers(state, [pad([13])], REPEAT_DELAY_MS - 1);
    expect(read.actions).toEqual([]);
    read = readControllers(read.state, [pad([13])], REPEAT_DELAY_MS);
    expect(read.actions).toEqual([{ type: "keydown", key: "ArrowDown", repeat: true }]);
    state = read.state;
    read = readControllers(state, [pad([13])], REPEAT_DELAY_MS + REPEAT_MS);
    expect(read.actions).toEqual([{ type: "keydown", key: "ArrowDown", repeat: true }]);
  });
});
