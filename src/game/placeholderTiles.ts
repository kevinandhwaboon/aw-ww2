import { TERRAIN_IDS, type TerrainId } from "../engine/data/terrain";

export const TILE_SIZE = 16;

/** Placeholder art until the art pipeline (08-art-pipeline) exists: flat colors plus a simple motif. */
const STYLE: Record<TerrainId, { base: string; detail: string; motif: Motif }> = {
  plains: { base: "#8cc56a", detail: "#7ab35a", motif: "speckle" },
  road: { base: "#c9b98f", detail: "#b3a37a", motif: "speckle" },
  bridge: { base: "#9a7a52", detail: "#6e5434", motif: "planks" },
  forest: { base: "#8cc56a", detail: "#2f6b34", motif: "trees" },
  hills: { base: "#a8a06a", detail: "#6f6840", motif: "hill" },
  river: { base: "#5ea8e0", detail: "#a8d6f5", motif: "waves" },
  bocage: { base: "#8cc56a", detail: "#3e5f2a", motif: "hedges" },
  sea: { base: "#3c78c8", detail: "#6ea0e0", motif: "waves" },
  beach: { base: "#e8d7a0", detail: "#d4c088", motif: "speckle" },
  reef: { base: "#3c78c8", detail: "#8a8a7a", motif: "rocks" },
  city: { base: "#8cc56a", detail: "#c8c8c8", motif: "building" },
  factory: { base: "#8cc56a", detail: "#9a9a9a", motif: "factory" },
  airfield: { base: "#8cc56a", detail: "#b0b0b0", motif: "strip" },
  port: { base: "#3c78c8", detail: "#b0b0b0", motif: "building" },
  hq: { base: "#8cc56a", detail: "#e0d060", motif: "building" },
  bunker: { base: "#8cc56a", detail: "#7a7a72", motif: "bunker" },
  rubble: { base: "#a49a80", detail: "#6e6656", motif: "rocks" },
  obstacle: { base: "#8cc56a", detail: "#5a5a5a", motif: "teeth" },
};

type Motif =
  | "speckle" | "planks" | "trees" | "hill" | "waves" | "hedges" | "rocks"
  | "building" | "factory" | "strip" | "bunker" | "teeth";

/** Tile index of each terrain in the generated tileset (same order as TERRAIN_IDS). */
export function tileIndex(id: TerrainId): number {
  return TERRAIN_IDS.indexOf(id);
}

/** Draws one 16×16 placeholder tile per terrain into a horizontal strip. */
export function drawPlaceholderTileset(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE * TERRAIN_IDS.length;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas not available");
  TERRAIN_IDS.forEach((id: TerrainId, i) => {
    const { base, detail, motif } = STYLE[id];
    const ox = i * TILE_SIZE;
    const px = (x: number, y: number, w = 1, h = 1) => ctx.fillRect(ox + x, y, w, h);
    ctx.fillStyle = base;
    px(0, 0, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = detail;
    drawMotif(motif, px);
  });
  return canvas;
}

type Px = (x: number, y: number, w?: number, h?: number) => void;

function drawMotif(motif: Motif, px: Px): void {
  switch (motif) {
    case "speckle":
      for (const [x, y] of [[3, 4], [11, 2], [7, 9], [13, 12], [2, 13]] as const) px(x, y);
      return;
    case "planks":
      for (let y = 1; y < 16; y += 3) px(0, y, 16, 1);
      return;
    case "trees":
      for (const [x, y] of [[2, 2], [9, 1], [5, 8], [11, 9]] as const) {
        px(x + 1, y, 2, 1);
        px(x, y + 1, 4, 3);
        px(x + 1, y + 4, 2, 1);
      }
      return;
    case "hill":
      for (let i = 0; i < 6; i++) px(8 - i - 1, 3 + i * 2, (i + 1) * 2, 2);
      return;
    case "waves":
      for (const [x, y] of [[2, 3], [9, 6], [4, 11], [11, 13]] as const) px(x, y, 4, 1);
      return;
    case "hedges":
      px(0, 0, 16, 2);
      px(0, 0, 2, 16);
      px(0, 8, 16, 2);
      px(8, 0, 2, 16);
      return;
    case "rocks":
      for (const [x, y] of [[3, 3], [10, 5], [5, 10], [12, 12]] as const) px(x, y, 3, 2);
      return;
    case "building":
      px(3, 4, 10, 10);
      return;
    case "factory":
      px(2, 7, 12, 7);
      px(4, 2, 2, 5);
      px(10, 4, 2, 3);
      return;
    case "strip":
      px(6, 0, 4, 16);
      return;
    case "bunker":
      px(3, 6, 10, 7);
      px(5, 4, 6, 2);
      return;
    case "teeth":
      for (const [x, y] of [[2, 3], [8, 3], [5, 9], [11, 9]] as const) {
        px(x + 1, y, 1, 1);
        px(x, y + 1, 3, 3);
      }
      return;
  }
}
