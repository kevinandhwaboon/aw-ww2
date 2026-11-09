import { describe, expect, it } from "vitest";
import { clampScroll, handheldViewSize, inLeftHalf, MIN_ZOOM, revealScroll, viewSize } from "../src/game/viewport";

// Map sizes in map pixels: 16 per square.
const small = { width: 15 * 16, height: 10 * 16 }; // 240×160, today's maps
const large = { width: 56 * 16, height: 36 * 16 }; // 896×576
const laptop = { width: 1440, height: 800 };

describe("zoom and view size (00-master-design §12)", () => {
  it("a map that fits zooms up to fill the window, as large as whole-number zoom allows", () => {
    expect(viewSize(laptop, small)).toEqual({ zoom: 5, width: 1200, height: 800 });
  });

  it("a map too big to fit at the minimum zoom stays at the minimum zoom and the view scrolls", () => {
    const view = viewSize(laptop, large);
    expect(view.zoom).toBe(MIN_ZOOM);
    expect(view).toEqual({ zoom: 3, width: 1440, height: 800 });
  });

  it("only the side that overflows is cut to the window", () => {
    const wide = { width: 100 * 16, height: 10 * 16 };
    expect(viewSize(laptop, wide)).toEqual({ zoom: 3, width: 1440, height: 480 });
  });
});

describe("phone game-pad layout (00-master-design §12, phone prototype)", () => {
  // An iPhone held upright: 393 CSS pixels wide, 3 screen pixels per CSS pixel, a 3:2 screen box.
  const phoneBox = { width: 393, height: 262 };

  it("the screen shows about 15 squares across, drawn sharp in the phone's own pixels", () => {
    const view = handheldViewSize(phoneBox, large, 3);
    expect(view).toEqual({ zoom: 5, width: 1179, height: 786 });
    expect(view.width / view.zoom / 16).toBeCloseTo(14.7, 1);
  });

  it("a small map fits whole and the canvas shrinks to it", () => {
    expect(handheldViewSize(phoneBox, { width: 13 * 16, height: 9 * 16 }, 3)).toEqual({ zoom: 5, width: 1040, height: 720 });
  });
});

describe("scrolling (00-master-design §12)", () => {
  const view = { width: 480, height: 266 }; // map pixels visible at zoom 3 in a 1440×800 window

  it("the view can't scroll past the map's edges", () => {
    expect(clampScroll({ x: -40, y: -1 }, view, large)).toEqual({ x: 0, y: 0 });
    expect(clampScroll({ x: 9999, y: 9999 }, view, large)).toEqual({ x: 896 - 480, y: 576 - 266 });
  });

  it("a map that fits the view never scrolls", () => {
    expect(clampScroll({ x: 30, y: 30 }, { width: 240, height: 160 }, small)).toEqual({ x: 0, y: 0 });
  });

  it("revealing something already in view, clear of the margin, leaves the view where it is", () => {
    const square = { x: 10 * 16, y: 5 * 16, width: 16, height: 16 };
    expect(revealScroll({ x: 0, y: 0 }, view, large, square, 32)).toEqual({ x: 0, y: 0 });
  });

  it("moving the cursor near the edge scrolls just enough to keep two squares beyond it", () => {
    const square = { x: 29 * 16, y: 0, width: 16, height: 16 }; // right edge of the view
    expect(revealScroll({ x: 0, y: 0 }, view, large, square, 32).x).toBe(30 * 16 + 32 - 480);
  });

  it("revealing something off to the upper left scrolls back toward it", () => {
    const square = { x: 5 * 16, y: 2 * 16, width: 16, height: 16 };
    expect(revealScroll({ x: 300, y: 200 }, view, large, square, 32)).toEqual({ x: 5 * 16 - 32, y: 0 });
  });

  it("revealing never scrolls past the map's edge, even with the margin", () => {
    const corner = { x: 55 * 16, y: 35 * 16, width: 16, height: 16 };
    expect(revealScroll({ x: 0, y: 0 }, view, large, corner, 32)).toEqual({ x: 896 - 480, y: 576 - 266 });
  });
});

describe("panels sit away from the cursor (00-master-design §12)", () => {
  it("left and right are judged within the visible view, not the whole map", () => {
    expect(inLeftHalf(500, 400, 480)).toBe(true);
    expect(inLeftHalf(500, 0, 480)).toBe(false);
  });
});
