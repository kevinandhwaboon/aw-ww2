// Desert terrain for the 32-pixel grid (docs/08-art-pipeline.md §21): the same sheet layout as
// terrain32.mjs, so a pack's tile numbers work for summer, winter and desert. Every tile is the summer
// drawing in a desert palette: sand and gravel for grass, camel thorn scrub for trees, tan rock for
// hills and ridges, pale gravel tracks for roads. Shadows fall warm brown on the sand.
import { withShade } from "./depth.mjs";
import { palette as summer } from "./terrain.mjs";
import { ACROSS, FRAMES, layout, TILE_HEIGHT, TILE_WIDTH } from "./terrain32.mjs";

export { ACROSS, FRAMES, layout, TILE_HEIGHT, TILE_WIDTH };

const SAND_SHADOW = [0x5a, 0x3c, 0x1c];

export const palette = withShade(
  {
    ...Object.fromEntries(Object.entries(summer).filter(([ch]) => !"1234567890!#@".includes(ch))),
    G: "#dcc28a", g: "#c4a870", h: "#eedcae", // sand and gravel
    T: "#7c7a46", U: "#5a5832", V: "#9c9a5c", n: "#6a5434", O: "#3a381e", // camel thorn scrub
    q: "#dcc08a", w: "#bc9c62", u: "#927448", Q: "#5e4a2c", // tan rock: hills and ridges
    e: "#6a6236", E: "#86804a", y: "#a8a066", // dry scrub where hedges would be
    a: "#f0e0b4", A: "#d8c08c", i: "#faf0d4", // pale beach sand
    R: "#e6d6ac", r: "#b49c6c", p: "#f2e6c6", // pale gravel tracks
  },
  SAND_SHADOW,
  0.32,
);

for (const [name, frames] of layout) for (const rows of frames) {
  if (rows.length !== TILE_HEIGHT || rows.some((r) => r.length !== TILE_WIDTH)) throw new Error(`${name}: not 32x64`);
  for (const ch of rows.join("")) if (ch !== "." && !palette[ch]) throw new Error(`desert ${name}: no color for "${ch}"`);
}
