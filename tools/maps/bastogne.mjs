// Generates src/scenarios/bastogne.json: the Ardennes around Bastogne, December 1944.
//
// Towns, rivers and roads are written as real longitude/latitude points and projected onto the grid
// (each square is about 2.5 km). Roads are routed between towns along the cheapest path, so they
// follow valleys and cross rivers only where they must. Scenario design: docs/13-scenarios-ardennes.md.
//
// Run: node tools/maps/bastogne.mjs           (writes the scenario and prints an ASCII preview)
//      node tools/maps/overview.mjs bastogne  (redraws the overview picture in docs/maps)

import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------- projection

const WEST = 5.2;
const EAST = 6.6;
const NORTH = 50.32;
const SOUTH = 49.62;
const W = 40;
const H = 30;

const toGrid = ([lon, lat]) => ({
  x: Math.min(W - 1, Math.max(0, Math.floor(((lon - WEST) / (EAST - WEST)) * W))),
  y: Math.min(H - 1, Math.max(0, Math.floor(((NORTH - lat) / (NORTH - SOUTH)) * H))),
});
const tileCenter = (x, y) => [WEST + ((x + 0.5) / W) * (EAST - WEST), NORTH - ((y + 0.5) / H) * (NORTH - SOUTH)];

// ---------------------------------------------------------------- grid helpers

const grid = Array.from({ length: H }, () => Array(W).fill("."));
const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y][x] : undefined);
const set = (x, y, ch) => {
  if (at(x, y) !== undefined) grid[y][x] = ch;
};
const N4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/** Deterministic noise in [0, 1) for a tile and a salt, so the map is the same on every run. */
const noise = (x, y, salt) => {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** Noise that clumps: half from 2×2 blocks, half from the tile, so woods come in patches. */
const clumpy = (x, y, salt) => 0.55 * noise(x >> 1, y >> 1, salt + 100) + 0.45 * noise(x, y, salt);

/** 4-connected grid line, so units moving square by square can follow it. */
function line(a, b) {
  const nx = Math.abs(b.x - a.x);
  const ny = Math.abs(b.y - a.y);
  const sx = Math.sign(b.x - a.x);
  const sy = Math.sign(b.y - a.y);
  const out = [{ x: a.x, y: a.y }];
  let { x, y } = a;
  for (let ix = 0, iy = 0; ix < nx || iy < ny; ) {
    if (iy >= ny || (ix < nx && (0.5 + ix) / nx < (0.5 + iy) / ny)) {
      x += sx;
      ix++;
    } else {
      y += sy;
      iy++;
    }
    out.push({ x, y });
  }
  return out;
}
const polyline = (points) => points.map(toGrid).flatMap((p, i, all) => (i === 0 ? [p] : line(all[i - 1], p).slice(1)));

// ---------------------------------------------------------------- rivers

const RIVERS = {
  // The Our: the German border, from Schönberg down past Dasburg and Vianden to the Sauer.
  our: [[6.3, 50.33], [6.26, 50.29], [6.18, 50.2], [6.14, 50.14], [6.13, 50.05], [6.17, 49.98], [6.21, 49.94], [6.29, 49.87]],
  // The Sûre (Sauer): from near Vaux-sur-Sûre past Martelange, Esch-sur-Sûre and Diekirch to the Moselle.
  sure: [[5.58, 49.91], [5.74, 49.83], [5.85, 49.87], [5.93, 49.91], [6.05, 49.9], [6.12, 49.86], [6.29, 49.87], [6.42, 49.81], [6.6, 49.72]],
  // The Ourthe: past Houffalize and La Roche, north toward Hotton.
  ourthe: [[5.97, 50.2], [5.79, 50.13], [5.65, 50.13], [5.575, 50.18], [5.45, 50.27], [5.42, 50.33]],
};
const riverTiles = new Set();
for (const points of Object.values(RIVERS)) {
  for (const p of polyline(points)) {
    set(p.x, p.y, "~");
    riverTiles.add(`${p.x},${p.y}`);
  }
}
const nearRiver = (x, y) => [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => riverTiles.has(`${x + dx},${y + dy}`));

// ---------------------------------------------------------------- countryside

const near = ([lon, lat], [clon, clat], rx, ry) => ((lon - clon) / rx) ** 2 + ((lat - clat) / ry) ** 2 <= 1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (at(x, y) !== ".") continue;
    const c = tileCenter(x, y);
    const r = clumpy(x, y, 1);
    let ch;
    // The Bastogne plateau: open, rolling farmland, where the town's roads meet.
    if (near(c, [5.72, 50.0], 0.17, 0.08)) ch = r < 0.2 ? "F" : ".";
    // Steep wooded valleys along the rivers.
    else if (nearRiver(x, y)) ch = r < 0.22 ? "H" : r < 0.62 ? "F" : ".";
    // The Gaume around Arlon: gentler farmland.
    else if (c[1] < 49.78) ch = r < 0.25 ? "F" : ".";
    // The Ardennes, the Luxembourg Oesling and the Eifel: forest and ridges.
    else ch = r < 0.48 ? "F" : r < 0.56 ? "H" : ".";
    set(x, y, ch);
  }
}

// ---------------------------------------------------------------- towns and bases

// [name, lon, lat, kind, owner]  kind: Q hq, f factory, A airfield, C city.  owner: 0 US, 1 Germany, null neutral.
const PLACES = [
  // US: Bastogne and the rear to the south and west
  ["Bastogne", 5.715, 50.003, "C", 0],
  ["Arlon", 5.81, 49.683, "Q", 0],
  ["Neufchâteau", 5.435, 49.84, "f", 0],
  ["Marche", 5.345, 50.227, "f", 0],
  ["Libramont", 5.38, 49.92, "A", 0],
  ["Martelange", 5.74, 49.83, "C", 0],
  ["Sibret", 5.64, 49.97, "C", 0],
  ["Vaux-sur-Sûre", 5.57, 49.91, "C", 0],
  // US: the thin front line along the Our, held by tired and green divisions
  ["St. Vith", 6.12, 50.28, "C", 0],
  ["Clervaux", 6.03, 50.055, "C", 0],
  ["Wiltz", 5.93, 49.97, "C", 0],
  ["Ettelbruck", 6.1, 49.85, "C", 0],
  // Between the lines
  ["Houffalize", 5.79, 50.13, "C", null],
  ["La Roche", 5.575, 50.18, "C", null],
  ["Noville", 5.76, 50.06, "C", null],
  ["Vianden", 6.2, 49.935, "C", null],
  // Germany: the Eifel, behind the Our
  ["Bitburg", 6.525, 49.97, "Q", 1],
  ["Prüm", 6.42, 50.21, "f", 1],
  ["Neuerburg", 6.3, 49.99, "f", 1],
  ["Dasburg", 6.16, 50.05, "C", 1],
  ["Arzfeld", 6.27, 50.09, "C", 1],
  ["Waxweiler", 6.36, 50.09, "C", 1],
];

const placed = new Map();
const taken = new Set();
for (const [name, lon, lat] of PLACES) {
  const want = toGrid([lon, lat]);
  // Off rivers, and never right next to another place. Search outward for the nearest fit.
  const fits = (x, y) => {
    const ch = at(x, y);
    if (ch === undefined || ch === "~" || taken.has(`${x},${y}`)) return false;
    return !N4.some(([dx, dy]) => taken.has(`${x + dx},${y + dy}`));
  };
  let spot;
  for (let r = 0; r < 5 && !spot; r++) {
    for (let dy = -r; dy <= r && !spot; dy++) {
      for (let dx = -r; dx <= r && !spot; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && fits(want.x + dx, want.y + dy)) spot = { x: want.x + dx, y: want.y + dy };
      }
    }
  }
  if (!spot) throw new Error(`No room for ${name}`);
  placed.set(name, spot);
  taken.add(`${spot.x},${spot.y}`);
}
for (const [name, , , kind] of PLACES) {
  const p = placed.get(name);
  set(p.x, p.y, kind);
}

// ---------------------------------------------------------------- roads

/** Cheapest route between two places: follows existing roads, avoids woods and ridges, crosses rivers only when it must. */
const ROAD_COST = { ".": 1, "=": 0.4, "#": 0.4, F: 2.2, H: 5, "~": 10 };
function roadPath(a, b) {
  const key = (x, y) => y * W + x;
  const dist = new Map([[key(a.x, a.y), 0]]);
  const from = new Map();
  const open = [[0, a.x, a.y]];
  while (open.length > 0) {
    open.sort((p, q) => p[0] - q[0]);
    const [d, x, y] = open.shift();
    if (x === b.x && y === b.y) break;
    if (d > (dist.get(key(x, y)) ?? Infinity)) continue;
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      const isEnd = nx === b.x && ny === b.y;
      const step = isEnd ? 1 : taken.has(`${nx},${ny}`) ? undefined : ROAD_COST[at(nx, ny)];
      if (step === undefined) continue;
      // A river is crossed straight, never followed: no two river squares in a row.
      if (at(nx, ny) === "~" && at(x, y) === "~") continue;
      const nd = d + step;
      if (nd < (dist.get(key(nx, ny)) ?? Infinity)) {
        dist.set(key(nx, ny), nd);
        from.set(key(nx, ny), [x, y]);
        open.push([nd, nx, ny]);
      }
    }
  }
  const path = [];
  for (let p = [b.x, b.y]; p; p = from.get(key(p[0], p[1]))) path.unshift({ x: p[0], y: p[1] });
  if (path[0]?.x !== a.x || path[0]?.y !== a.y) throw new Error(`No road from (${a.x}, ${a.y}) to (${b.x}, ${b.y})`);
  return path;
}

// The Marche and Neufchâteau roads leave Bastogne to the west; start them there, so the town has a road on every side.
{
  const b = placed.get("Bastogne");
  set(b.x - 1, b.y, "=");
  set(b.x - 2, b.y, "=");
  placed.set("west of Bastogne", { x: b.x - 2, y: b.y });
}

// Bastogne's roads first, so the others join them: the town was the hub of seven roads.
const ROADS = [
  ["Bastogne", "Noville", "Houffalize", "St. Vith"],
  ["Bastogne", "Clervaux", "Dasburg", "Arzfeld", "Prüm"],
  ["Bastogne", "Wiltz", "Ettelbruck"],
  ["Bastogne", "Martelange", "Arlon"],
  ["west of Bastogne", "Sibret", "Vaux-sur-Sûre", "Neufchâteau"],
  ["Bastogne", "La Roche", "Marche"],
  ["Neufchâteau", "Libramont"],
  ["Houffalize", "La Roche"],
  ["St. Vith", "Prüm"],
  ["Arzfeld", "Waxweiler", "Prüm"],
  ["Dasburg", "Neuerburg", "Bitburg"],
  ["Waxweiler", "Bitburg"],
  ["Ettelbruck", "Vianden", "Neuerburg"],
  ["Arlon", "Ettelbruck"],
  ["Neufchâteau", "Arlon"],
  ["Wiltz", "Clervaux"],
];
for (const route of ROADS) {
  for (let i = 1; i < route.length; i++) {
    const a = placed.get(route[i - 1]);
    const b = placed.get(route[i]);
    if (!a || !b) throw new Error(`Unknown place on road ${route.join(" - ")}`);
    for (const p of roadPath(a, b)) {
      const ch = at(p.x, p.y);
      if (taken.has(`${p.x},${p.y}`)) continue;
      if (ch === "~") set(p.x, p.y, "#");
      else if (ch !== "#") set(p.x, p.y, "=");
    }
  }
}

// ---------------------------------------------------------------- starting forces

const US = 0;
const GERMANY = 1;
const used = new Set();
const groundOk = (ch) => [".", "=", "F"].includes(ch);
/** The nearest free tile to a place that a ground unit can stand on, skipping properties and other units. */
function standNear(name) {
  const p = placed.get(name);
  for (let r = 1; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || used.has(`${x},${y}`) || taken.has(`${x},${y}`)) continue;
        if (groundOk(at(x, y))) return { x, y };
      }
    }
  }
  throw new Error(`No room for a unit near ${name}`);
}
const units = [];
const add = (type, owner, pos, extra = {}) => {
  if (used.has(`${pos.x},${pos.y}`)) throw new Error(`Two units at (${pos.x}, ${pos.y})`);
  used.add(`${pos.x},${pos.y}`);
  units.push({ type, owner, pos, ...extra });
};
const inTown = (type, owner, name, extra) => add(type, owner, placed.get(name), extra);
const outside = (type, owner, name, extra) => add(type, owner, standNear(name), extra);

// US: the 101st Airborne and Team SNAFU in Bastogne, thin lines at St. Vith, Clervaux and Wiltz,
// and the 4th Armored far to the south at Arlon.
inTown("infantry", US, "Bastogne");
outside("infantry", US, "Bastogne");
outside("infantry", US, "Bastogne");
outside("artillery", US, "Bastogne");
outside("tankDestroyer", US, "Bastogne");
inTown("infantry", US, "St. Vith");
outside("tankDestroyer", US, "St. Vith");
inTown("infantry", US, "Clervaux");
inTown("infantry", US, "Wiltz");
outside("mediumTank", US, "Arlon");
outside("mediumTank", US, "Arlon");
outside("halftrack", US, "Arlon");

// Germany: the main attack massed behind the Our. Tanks start short of fuel (13-scenarios-ardennes §1).
const LOW_FUEL = { heavyTank: 30, mediumTank: 40 };
const tank = (type, name) => outside(type, GERMANY, name, { fuel: LOW_FUEL[type] });
tank("heavyTank", "Prüm");
tank("heavyTank", "Dasburg");
tank("mediumTank", "Prüm");
tank("mediumTank", "Arzfeld");
tank("mediumTank", "Dasburg");
tank("mediumTank", "Neuerburg");
outside("recon", GERMANY, "Waxweiler");
outside("halftrack", GERMANY, "Arzfeld");
outside("artillery", GERMANY, "Arzfeld");
outside("artillery", GERMANY, "Neuerburg");
inTown("infantry", GERMANY, "Dasburg");
outside("infantry", GERMANY, "Dasburg");
inTown("infantry", GERMANY, "Arzfeld");
outside("infantry", GERMANY, "Prüm");
outside("infantry", GERMANY, "Neuerburg");
outside("assaultInfantry", GERMANY, "Dasburg");
outside("assaultInfantry", GERMANY, "Neuerburg");

// ---------------------------------------------------------------- write

const LAND = [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "lightTank", "mediumTank",
  "tankDestroyer", "artillery", "rocketArtillery", "mobileAA", "flakGun",
];
const scenario = {
  id: "bastogne",
  name: "Bastogne",
  description:
    "December 1944. Germany's last great offensive bursts out of the snowy Eifel. Its tanks are strong but short of fuel, and the snow keeps them on the roads. Germany wins by taking the crossroads town of Bastogne or the US HQ at Arlon. The US wins by holding out to the start of day 12. Snow falls until day 6; then the skies clear and US aircraft can fly at full range.",
  map: grid.map((row) => row.join("")),
  players: [
    { name: "US", nation: "us", funds: 4000, buildable: [...LAND, "fighter", "bomber", "transportAircraft"] },
    { name: "Germany", nation: "germany", funds: 10000, buildable: [...LAND, "heavyTank"], facing: "left" },
  ],
  propertyOwners: PLACES.filter(([, , , , owner]) => owner !== null).map(([name, , , , owner]) => ({ pos: placed.get(name), owner })),
  units,
  victory: [
    { type: "hqCapture" },
    { type: "rout" },
    { type: "captureProperties", side: "axis", properties: [placed.get("Bastogne")] },
    { type: "surviveDays", side: "allies", days: 12 },
  ],
  weather: {
    season: "winter",
    forecast: [{ fromDay: 1, weather: "snow" }, { fromDay: 6, weather: "clear" }],
  },
};

const json = JSON.stringify(scenario, null, 2)
  // Keep each map row, unit and owner entry on one line so the file stays readable.
  .replace(/\{\s+"x": (\d+),\s+"y": (\d+)\s+\}/g, '{ "x": $1, "y": $2 }')
  .replace(/\{\s+("type": "[^"]+"),\s+("owner": \d),\s+("pos": \{[^}]+\})(?:,\s+("fuel": \d+))?\s+\}/g, (_, a, b, c, d) => `{ ${[a, b, c, d].filter(Boolean).join(", ")} }`)
  .replace(/\{\s+("pos": \{[^}]+\}),\s+("owner": \d)\s+\}/g, "{ $1, $2 }")
  .replace(/\{\s+("fromDay": \d+),\s+("weather": "[a-z]+")\s+\}/g, "{ $1, $2 }")
  .replace(/\[\s+((?:"[a-zA-Z]+",?\s+)+)\]/g, (_, list) => `[${list.trim().split(/,\s+/).join(", ")}]`);
writeFileSync(new URL("../../src/scenarios/bastogne.json", import.meta.url), json + "\n");

console.log(grid.map((row, y) => `${String(y).padStart(2)} ${row.join("")}`).join("\n"));
const income = (owner) => scenario.propertyOwners.filter((p) => p.owner === owner).length;
console.log(`\n${W}x${H}. Properties: US ${income(US)}, Germany ${income(GERMANY)}, neutral ${PLACES.filter((p) => p[4] === null).length}.`);
for (const [name] of PLACES) console.log(`${name}: (${placed.get(name).x}, ${placed.get(name).y})`);
