// How much of the map the screen shows, and where the view sits on it (00-master-design §12).
// Pure numbers, no Phaser, so the rules for zooming and scrolling can be tested directly.
// Sizes and scroll positions are in map pixels (16 per square) unless they say screen pixels.

/** Squares never show smaller than this many screen pixels per map pixel; past that the view scrolls. */
export const MIN_ZOOM = 3;
/** Squares kept between the cursor (or the action) and the edge of the view when it scrolls. */
export const FOLLOW_MARGIN_SQUARES = 2;

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** The zoom, and the canvas size in screen pixels. */
export interface ViewSize extends Size {
  readonly zoom: number;
}

/**
 * The largest whole-number zoom that fits the whole map in the window, but never below MIN_ZOOM.
 * The canvas is the map's size at that zoom, cut down to the window when the map doesn't fit.
 */
export function viewSize(window: Size, map: Size): ViewSize {
  const fit = Math.floor(Math.min(window.width / map.width, window.height / map.height));
  const zoom = Math.max(MIN_ZOOM, fit);
  return {
    zoom,
    width: Math.min(map.width * zoom, Math.floor(window.width)),
    height: Math.min(map.height * zoom, Math.floor(window.height)),
  };
}

export interface Scroll {
  readonly x: number;
  readonly y: number;
}

/** The map's top-left corner on screen never moves inward, and its far edge never leaves the screen. */
export function clampScroll(scroll: Scroll, view: Size, map: Size): Scroll {
  return { x: clampAxis(scroll.x, view.width, map.width), y: clampAxis(scroll.y, view.height, map.height) };
}

/**
 * The smallest scroll that brings a rectangle (map pixels) into view with a margin around it.
 * Something already in view doesn't move the view at all.
 */
export function revealScroll(
  scroll: Scroll,
  view: Size,
  map: Size,
  target: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  margin: number,
): Scroll {
  return {
    x: revealAxis(scroll.x, view.width, map.width, target.x, target.x + target.width, margin),
    y: revealAxis(scroll.y, view.height, map.height, target.y, target.y + target.height, margin),
  };
}

/** Which half of the view a point is in, so panels can sit on the other side. */
export function inLeftHalf(x: number, scrollX: number, viewWidth: number): boolean {
  return x - scrollX < viewWidth / 2;
}

function clampAxis(scroll: number, view: number, map: number): number {
  return Math.min(Math.max(scroll, 0), Math.max(0, map - view));
}

function revealAxis(scroll: number, view: number, map: number, lo: number, hi: number, margin: number): number {
  // In a view too small for the full margin, use what fits so the target can still be shown.
  const m = Math.max(0, Math.min(margin, (view - (hi - lo)) / 2));
  let next = scroll;
  if (lo - m < scroll) next = lo - m;
  else if (hi + m > scroll + view) next = hi + m - view;
  return clampAxis(next, view, map);
}

/** In the phone game-pad layout the screen shows about this many squares across, like a handheld. */
export const HANDHELD_SQUARES_ACROSS = 15;

/**
 * The view for the phone game-pad layout (00-master-design §12, phone prototype): drawn in the phone's own
 * screen pixels, at the whole-number zoom that shows closest to 15 squares across the screen box.
 * The canvas is the map's size at that zoom, cut down to the box when the map doesn't fit.
 * `box` is in CSS pixels; the result is in device pixels.
 */
export function handheldViewSize(box: Size, map: Size, devicePixelRatio: number): ViewSize {
  const width = Math.floor(box.width * devicePixelRatio);
  const height = Math.floor(box.height * devicePixelRatio);
  const zoom = Math.max(1, Math.round(width / (HANDHELD_SQUARES_ACROSS * 16)));
  return { zoom, width: Math.min(map.width * zoom, width), height: Math.min(map.height * zoom, height) };
}
