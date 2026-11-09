// Draws a whole-map overview PNG of a scenario, one colored block per square, for docs and review.
// Green properties belong to the first player (the US), red to the second, grey neutral; the inner mark shows the kind
// (yellow factory, white airfield, cyan port, black HQ). Dark squares are starting units.
//
// Run: node tools/maps/overview.mjs normandy      (writes docs/maps/normandy.png)

import { readFileSync } from "node:fs";
import { canvas, rgba, savePng } from "../art/png.mjs";

const id = process.argv[2] ?? "normandy";
const root = new URL("../../", import.meta.url);
const scenario = JSON.parse(readFileSync(new URL(`src/scenarios/${id}.json`, root), "utf8"));

const TERRAIN = {
  ".": "#9ccc65", "=": "#d7c9a0", "#": "#8d6e63", F: "#2e7d32", H: "#a1887f", "~": "#4fc3f7", b: "#558b2f",
  S: "#1565c0", _: "#fff59d", r: "#5d4037", X: "#616161", x: "#9e9e9e", o: "#000000",
};
const KIND = { f: "#ffeb3b", A: "#ffffff", P: "#00e5ff", Q: "#000000" };
const OWNER = ["#64783a", "#e53935"];
const UNIT = ["#2a3818", "#b71c1c"];

const owners = new Map((scenario.propertyOwners ?? []).map((p) => [`${p.pos.x},${p.pos.y}`, p.owner]));
const k = 8;
const rows = scenario.map;
const c = canvas(rows[0].length * k, rows.length * k);
const fill = (x0, y0, size, hex) => {
  const color = rgba(hex);
  for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size; x++) c.px.set(color, (y * c.w + x) * 4);
};
rows.forEach((row, y) => [...row].forEach((ch, x) => {
  const isProperty = "CfAPQ".includes(ch);
  fill(x * k, y * k, k, isProperty ? (OWNER[owners.get(`${x},${y}`)] ?? "#bdbdbd") : TERRAIN[ch]);
  if (KIND[ch]) fill(x * k + 2, y * k + 2, k - 4, KIND[ch]);
}));
for (const u of scenario.units) fill(u.pos.x * k + 2, u.pos.y * k + 2, k - 4, UNIT[u.owner] ?? "#000000");
savePng(c, new URL(`docs/maps/${id}.png`, root).pathname);
console.log(`docs/maps/${id}.png`);
