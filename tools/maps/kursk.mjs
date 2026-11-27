// Generates src/scenarios/kursk.json: the Kursk salient, July 1943.
//
// Towns, rivers, roads and the front line of 4 July 1943 are written as real longitude/latitude
// points and projected onto the grid (each square is about 3.5 km across and 3.9 km tall). Roads
// are routed between towns along the cheapest path, so they follow the open ground and cross rivers
// only where they must. The Soviet defense belts (bunkers and anti-tank obstacles) are laid out by
// distance behind the front on the north and south faces, where the Germans were expected, and
// never on a road. Scenario design: docs/15-scenarios-eastern-front.md.
//
// Run: node tools/maps/kursk.mjs           (writes the scenario and prints an ASCII preview)
//      node tools/maps/overview.mjs kursk  (redraws the overview picture in docs/maps)

import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------- projection

const WEST = 34.4;
const EAST = 37.95;
const NORTH = 53.15;
const SOUTH = 50.35;
const W = 68;
const H = 80;

const toGrid = ([lon, lat]) => ({
  x: Math.min(W - 1, Math.max(0, Math.floor(((lon - WEST) / (EAST - WEST)) * W))),
  y: Math.min(H - 1, Math.max(0, Math.floor(((NORTH - lat) / (NORTH - SOUTH)) * H))),
});
const tileCenter = (x, y) => [WEST + ((x + 0.5) / W) * (EAST - WEST), NORTH - ((y + 0.5) / H) * (NORTH - SOUTH)];

// ---------------------------------------------------------------- the front, 4 July 1943

// German-held ground: the Orel bulge in the north, the thin west face, and the Belgorod–Sumy line
// in the south, all one piece wrapped round the salient. Everything else is Soviet.
const GERMAN = [
  [34.4, 53.15], [36.85, 53.15], [36.85, 52.95], [36.75, 52.7], [36.6, 52.52], [36.45, 52.47],
  [36.15, 52.47], [35.7, 52.45], [35.2, 52.45], [34.9, 52.32], [34.62, 52.15], [34.6, 51.9],
  [34.55, 51.6], [34.65, 51.3], [35.0, 51.02], [35.4, 50.88], [35.8, 50.8], [36.1, 50.76],
  [36.4, 50.72], [36.58, 50.65], [36.68, 50.55], [36.75, 50.45], [36.85, 50.35], [34.4, 50.35],
];

function inside(poly, [px, py]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
const germanTile = (x, y) => inside(GERMAN, tileCenter(x, y));

// ---------------------------------------------------------------- grid helpers

const grid = Array.from({ length: H }, () => Array(W).fill("."));
const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y][x] : undefined);
const set = (x, y, ch) => {
  if (at(x, y) !== undefined) grid[y][x] = ch;
};
const N4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

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

/** How far each square is from the front: 4-step distance to the nearest square on the other side. */
const frontDistance = (() => {
  const dist = Array.from({ length: H }, () => Array(W).fill(Infinity));
  const queue = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (N4.some(([dx, dy]) => at(x + dx, y + dy) !== undefined && germanTile(x + dx, y + dy) !== germanTile(x, y))) {
        dist[y][x] = 0;
        queue.push([x, y]);
      }
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      if (at(nx, ny) === undefined || germanTile(nx, ny) !== germanTile(x, y) || dist[ny][nx] <= dist[y][x] + 1) continue;
      dist[ny][nx] = dist[y][x] + 1;
      queue.push([nx, ny]);
    }
  }
  return (x, y) => dist[y][x];
})();

// ---------------------------------------------------------------- rivers

const RIVERS = {
  // The Seym: rising east of Kursk, flowing west past Kursk, Lgov and Rylsk.
  seym: [[37.25, 51.45], [36.75, 51.42], [36.45, 51.6], [36.2, 51.69], [35.8, 51.67], [35.27, 51.65], [34.95, 51.6], [34.68, 51.55], [34.4, 51.53]],
  // The Psel: past Prokhorovka's famous bend, Oboyan and Sudzha, down to Sumy.
  psel: [[37.05, 51.3], [36.75, 51.09], [36.5, 51.13], [36.27, 51.19], [35.9, 51.2], [35.5, 51.22], [35.27, 51.17], [35.0, 51.05], [34.8, 50.93], [34.4, 50.75]],
  // The Pena, the Germans' first river on the Oboyan road.
  pena: [[36.47, 50.9], [36.3, 50.97], [36.12, 51.08], [36.05, 51.18]],
  // The Northern Donets: from near Prokhorovka south past Belgorod, the line Army Detachment Kempf crossed.
  donets: [[36.62, 50.97], [36.62, 50.75], [36.63, 50.6], [36.75, 50.47], [36.88, 50.35]],
  // The Vorskla: past Tomarovka and Borisovka, behind the German line.
  vorskla: [[36.35, 50.95], [36.15, 50.8], [35.97, 50.67], [35.7, 50.47], [35.55, 50.35]],
  // The Oka: from near Maloarkhangelsk north to Orel.
  oka: [[36.48, 52.45], [36.3, 52.62], [36.12, 52.8], [36.07, 52.97], [36.05, 53.15]],
  // The Kroma: past Kromy into the Oka.
  kroma: [[35.35, 52.6], [35.7, 52.68], [35.95, 52.8], [36.1, 52.84]],
  // The Svapa: south past Dmitriev to the Seym.
  svapa: [[35.3, 52.45], [35.1, 52.15], [35.12, 51.85], [35.22, 51.66]],
  // The Oskol: the Steppe Front's rear, past Stary Oskol and Novy Oskol.
  oskol: [[37.8, 51.75], [37.84, 51.3], [37.88, 50.76], [37.9, 50.35]],
};
const riverTiles = new Set();
for (const points of Object.values(RIVERS)) {
  for (const p of polyline(points)) {
    set(p.x, p.y, "~");
    riverTiles.add(`${p.x},${p.y}`);
  }
}
const nearRiver = (x, y) => N8.some(([dx, dy]) => riverTiles.has(`${x + dx},${y + dy}`));

// ---------------------------------------------------------------- countryside

const near = ([lon, lat], [clon, clat], rx, ry) => ((lon - clon) / rx) ** 2 + ((lat - clat) / ry) ** 2 <= 1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (at(x, y) !== ".") continue;
    const c = tileCenter(x, y);
    const r = clumpy(x, y, 1);
    let ch;
    // The Olkhovatka heights: the ridge that stopped Model's 9th Army.
    if (near(c, [36.25, 52.17], 0.12, 0.05)) ch = r < 0.4 ? "H" : r < 0.55 ? "F" : ".";
    // The Bryansk forests in the north-west, partisan country.
    else if (c[0] < 35.2 && c[1] > 52.35) ch = r < 0.5 ? "F" : r < 0.53 ? "H" : ".";
    // Wooded gullies (balkas) and steep banks along the rivers.
    else if (nearRiver(x, y)) ch = r < 0.06 ? "H" : r < 0.3 ? "F" : ".";
    // The Orel country: farmland and woods.
    else if (c[1] > 52.5) ch = r < 0.22 ? "F" : ".";
    // The steppe and black-earth farmland of the salient: open tank country, scattered woods.
    else ch = r < 0.11 ? "F" : r < 0.125 ? "H" : ".";
    set(x, y, ch);
  }
}

// ---------------------------------------------------------------- towns and bases

// [name, lon, lat, kind, owner]  kind: Q hq, f factory, A airfield, C city.  owner: 0 Soviet Union, 1 Germany.
const PLACES = [
  // Soviet: Kursk and the salient
  ["Kursk", 36.19, 51.73, "Q", 0],
  ["Kursk East airfield", 36.33, 51.77, "A", 0],
  ["Shchigry", 36.91, 51.88, "f", 0],
  ["Livny", 37.6, 52.42, "f", 0],
  ["Stary Oskol", 37.84, 51.3, "f", 0],
  ["Novy Oskol", 37.88, 50.76, "A", 0],
  // The north face: Rokossovsky's Central Front
  ["Ponyri", 36.3, 52.3, "C", 0],
  ["Olkhovatka", 36.27, 52.18, "C", 0],
  ["Maloarkhangelsk", 36.5, 52.4, "C", 0],
  ["Fatezh", 35.85, 52.09, "C", 0],
  ["Zolotukhino", 36.39, 52.07, "C", 0],
  ["Novosil", 37.03, 52.97, "C", 0],
  ["Dmitriev", 35.07, 52.13, "C", 0],
  // The west face
  ["Lgov", 35.27, 51.66, "C", 0],
  ["Rylsk", 34.68, 51.57, "C", 0],
  ["Sudzha", 35.27, 51.19, "C", 0],
  // The south face: Vatutin's Voronezh Front
  ["Medvenka", 36.12, 51.42, "C", 0],
  ["Oboyan", 36.27, 51.21, "C", 0],
  ["Prokhorovka", 36.73, 51.04, "C", 0],
  ["Ivnya", 36.12, 51.08, "C", 0],
  ["Yakovlevo", 36.44, 50.85, "C", 0],
  ["Korocha", 37.2, 50.81, "C", 0],
  ["Shebekino", 36.89, 50.41, "C", 0],
  ["Solntsevo", 36.75, 51.42, "C", 0],
  ["Tim", 37.11, 51.62, "C", 0],
  // Germany: the Orel bulge
  ["Orel", 36.07, 52.97, "Q", 1],
  ["Orel West airfield", 35.9, 52.93, "A", 1],
  ["Kromy", 35.7, 52.69, "f", 1],
  ["Karachev", 34.98, 53.1, "f", 1],
  ["Zmiyovka", 36.35, 52.67, "C", 1],
  ["Naryshkino", 35.75, 53.0, "C", 1],
  ["Dmitrovsk", 35.14, 52.51, "C", 1],
  ["Komarichi", 34.79, 52.42, "C", 1],
  ["Lokot", 34.56, 52.57, "C", 1],
  ["Sevsk", 34.49, 52.15, "C", 1],
  // Germany: Belgorod, Kharkov's approaches and Sumy
  ["Belgorod", 36.59, 50.6, "f", 1],
  ["Sumy", 34.8, 50.91, "f", 1],
  ["Mikoyanovka airfield", 36.3, 50.5, "A", 1],
  ["Tomarovka", 35.97, 50.69, "C", 1],
  ["Borisovka", 35.99, 50.58, "C", 1],
  ["Grayvoron", 35.68, 50.48, "C", 1],
  ["Krasnopolye", 35.27, 50.77, "C", 1],
  ["Lebedin", 34.48, 50.59, "C", 1],
];

const placed = new Map();
const taken = new Set();
for (const [name, lon, lat, , owner] of PLACES) {
  const want = toGrid([lon, lat]);
  // Off rivers, on its own side of the front, and never right next to another place.
  const fits = (x, y) => {
    const ch = at(x, y);
    if (ch === undefined || ch === "~" || taken.has(`${x},${y}`)) return false;
    if (germanTile(x, y) !== (owner === 1)) return false;
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

// The main axes first, so the lesser roads join them.
const ROADS = [
  // The Orel–Kursk highway and railway: the north pincer's roads.
  ["Orel", "Kromy", "Fatezh", "Kursk"],
  ["Orel", "Zmiyovka", "Ponyri", "Zolotukhino", "Kursk"],
  // The Belgorod–Oboyan–Kursk highway: the south pincer's road.
  ["Belgorod", "Yakovlevo", "Oboyan", "Medvenka", "Kursk"],
  // The Prokhorovka railway and the roads the reserves came down.
  ["Belgorod", "Prokhorovka", "Solntsevo", "Kursk"],
  ["Oboyan", "Prokhorovka", "Korocha"],
  ["Stary Oskol", "Tim", "Kursk"],
  ["Stary Oskol", "Novy Oskol", "Korocha", "Shebekino", "Belgorod"],
  ["Tim", "Solntsevo"],
  ["Kursk", "Shchigry", "Livny"],
  ["Shchigry", "Tim"],
  ["Kursk", "Kursk East airfield"],
  // The north.
  ["Maloarkhangelsk", "Ponyri", "Olkhovatka", "Fatezh"],
  ["Novosil", "Maloarkhangelsk", "Livny"],
  ["Zmiyovka", "Maloarkhangelsk"],
  ["Orel", "Orel West airfield"],
  ["Orel", "Naryshkino", "Karachev"],
  ["Kromy", "Dmitrovsk", "Dmitriev", "Lgov", "Kursk"],
  ["Lokot", "Komarichi", "Dmitrovsk"],
  ["Karachev", "Lokot"],
  ["Komarichi", "Sevsk"],
  ["Sevsk", "Dmitriev"],
  // The west and south.
  ["Lgov", "Rylsk"],
  ["Lgov", "Sudzha", "Oboyan"],
  ["Sudzha", "Sumy", "Lebedin"],
  ["Sumy", "Krasnopolye", "Grayvoron", "Borisovka", "Tomarovka", "Ivnya", "Oboyan"],
  ["Belgorod", "Mikoyanovka airfield", "Borisovka"],
  ["Tomarovka", "Yakovlevo"],
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

// ---------------------------------------------------------------- the Soviet defense belts

// The Germans were expected on the north and south faces, and the defenses there were the deepest
// of the war: belt after belt of strongpoints, anti-tank ditches and minefields. The west face, where
// no attack came, has none. Bunkers are strongpoints; obstacles are ditches and minefields. Neither
// goes on a road, a river or a town, so every road stays open for the attacker to fight along.
const northFace = (x, y) => {
  const [lon, lat] = tileCenter(x, y);
  return lat > 51.95 && lat < 52.55 && lon > 35.4 && lon < 36.95;
};
const southFace = (x, y) => tileCenter(x, y)[1] < 51.3 && tileCenter(x, y)[0] > 35.75;
// [distance behind the front, chance of a bunker, chance of an obstacle]
const BELTS = [[0, 0.3, 0.1], [1, 0.22, 0.18], [2, 0.1, 0.08], [5, 0.3, 0.12], [6, 0.12, 0.08], [10, 0.24, 0.08]];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (germanTile(x, y) || !(northFace(x, y) || southFace(x, y))) continue;
    if (![".", "F"].includes(at(x, y))) continue;
    const belt = BELTS.find(([d]) => d === frontDistance(x, y));
    if (!belt) continue;
    const r = noise(x, y, 7);
    if (r < belt[1]) set(x, y, "X");
    else if (r < belt[1] + belt[2] && !N8.some(([dx, dy]) => at(x + dx, y + dy) === "o")) set(x, y, "o");
  }
}

// ---------------------------------------------------------------- starting forces

const SOVIET = 0;
const GERMANY = 1;
const used = new Set();
const groundOk = (ch) => [".", "=", "F"].includes(ch);
/** The nearest free tile to a place that suits `ok`, skipping properties and other units. */
function standNear(name, ok = groundOk) {
  const p = placed.get(name);
  for (let r = 1; r < 11; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || used.has(`${x},${y}`) || taken.has(`${x},${y}`)) continue;
        if (ok(at(x, y))) return { x, y };
      }
    }
  }
  throw new Error(`No room for a unit near ${name}`);
}
const units = [];
const add = (type, owner, pos) => {
  if (used.has(`${pos.x},${pos.y}`)) throw new Error(`Two units at (${pos.x}, ${pos.y})`);
  used.add(`${pos.x},${pos.y}`);
  units.push({ type, owner, pos });
};
const inTown = (type, owner, name) => add(type, owner, placed.get(name));
const outside = (type, owner, name) => add(type, owner, standNear(name));
/** A garrison in the nearest bunker of the defense belts. */
const dugIn = (type, name) => add(type, SOVIET, standNear(name, (ch) => ch === "X"));

// Soviet Union. The north face: rifle divisions in the first belts, anti-tank and artillery behind,
// a tank corps in reserve at Olkhovatka.
dugIn("infantry", "Ponyri");
dugIn("infantry", "Ponyri");
dugIn("infantry", "Maloarkhangelsk");
dugIn("assaultInfantry", "Olkhovatka");
dugIn("infantry", "Olkhovatka");
dugIn("mortar", "Ponyri");
inTown("infantry", SOVIET, "Ponyri");
outside("artillery", SOVIET, "Olkhovatka");
outside("rocketArtillery", SOVIET, "Zolotukhino");
outside("tankDestroyer", SOVIET, "Olkhovatka");
outside("mediumTank", SOVIET, "Olkhovatka");
outside("mediumTank", SOVIET, "Fatezh");
outside("lightTank", SOVIET, "Zolotukhino");
// The south face: Guards rifle divisions, PTRD teams and anti-tank guns on the Oboyan road, the
// 1st Tank Army behind at Oboyan.
dugIn("infantry", "Yakovlevo");
dugIn("infantry", "Yakovlevo");
dugIn("assaultInfantry", "Yakovlevo");
dugIn("infantry", "Ivnya");
dugIn("infantry", "Shebekino");
dugIn("mortar", "Yakovlevo");
inTown("infantry", SOVIET, "Yakovlevo");
outside("artillery", SOVIET, "Oboyan");
outside("rocketArtillery", SOVIET, "Oboyan");
outside("tankDestroyer", SOVIET, "Ivnya");
outside("mediumTank", SOVIET, "Oboyan");
outside("mediumTank", SOVIET, "Oboyan");
outside("heavyTank", SOVIET, "Medvenka");
// The 5th Guards Tank Army of the Steppe Front, in reserve near Stary Oskol: the tanks that met the
// SS at Prokhorovka.
outside("mediumTank", SOVIET, "Stary Oskol");
outside("mediumTank", SOVIET, "Stary Oskol");
outside("mediumTank", SOVIET, "Stary Oskol");
outside("lightTank", SOVIET, "Stary Oskol");
outside("supplyTruck", SOVIET, "Stary Oskol");
// Kursk, the west face and the air armies.
inTown("infantry", SOVIET, "Kursk");
outside("flakGun", SOVIET, "Kursk");
inTown("infantry", SOVIET, "Rylsk");
inTown("infantry", SOVIET, "Sudzha");
inTown("fighter", SOVIET, "Kursk East airfield");
inTown("bomber", SOVIET, "Novy Oskol");

// Germany. The north: Model's 9th Army on the Orel–Kursk railway, with Tigers and Ferdinands.
outside("heavyTank", GERMANY, "Zmiyovka");
outside("tankDestroyer", GERMANY, "Zmiyovka");
outside("mediumTank", GERMANY, "Zmiyovka");
outside("mediumTank", GERMANY, "Kromy");
outside("artillery", GERMANY, "Zmiyovka");
outside("rocketArtillery", GERMANY, "Kromy");
outside("infantry", GERMANY, "Zmiyovka");
outside("infantry", GERMANY, "Kromy");
outside("assaultInfantry", GERMANY, "Zmiyovka");
outside("supplyTruck", GERMANY, "Kromy");
inTown("infantry", GERMANY, "Orel");
inTown("fighter", GERMANY, "Orel West airfield");
// The west face: thin holding forces.
inTown("infantry", GERMANY, "Sevsk");
inTown("infantry", GERMANY, "Sumy");
// The south: Hoth's 4th Panzer Army, the SS Panzer Corps and Grossdeutschland, and Army Detachment
// Kempf at Belgorod, with Tigers, Panthers and StuGs.
outside("heavyTank", GERMANY, "Tomarovka");
outside("heavyTank", GERMANY, "Belgorod");
outside("mediumTank", GERMANY, "Tomarovka");
outside("mediumTank", GERMANY, "Tomarovka");
outside("mediumTank", GERMANY, "Borisovka");
outside("mediumTank", GERMANY, "Belgorod");
outside("tankDestroyer", GERMANY, "Borisovka");
outside("artillery", GERMANY, "Tomarovka");
outside("artillery", GERMANY, "Belgorod");
outside("rocketArtillery", GERMANY, "Borisovka");
outside("infantry", GERMANY, "Tomarovka");
outside("infantry", GERMANY, "Belgorod");
outside("assaultInfantry", GERMANY, "Tomarovka");
outside("assaultInfantry", GERMANY, "Belgorod");
outside("supplyTruck", GERMANY, "Borisovka");
outside("recon", GERMANY, "Grayvoron");
outside("mobileAA", GERMANY, "Borisovka");
inTown("bomber", GERMANY, "Mikoyanovka airfield");

// ---------------------------------------------------------------- write

const LAND = [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "supplyTruck", "lightTank", "mediumTank", "heavyTank",
  "tankDestroyer", "artillery", "rocketArtillery", "mobileAA", "flakGun",
];
const AIR = ["fighter", "bomber", "transportAircraft"];
const scenario = {
  id: "kursk",
  name: "Kursk",
  description:
    "July 1943. Germany's last great offensive in the east: two pincers, from Orel in the north and Belgorod in the south, try to cut off the Kursk salient. The Soviets knew it was coming and dug in deeper than anywhere else in the war, with a tank army waiting behind. Capture the enemy HQ to win: Kursk for Germany, Orel for the Soviet Union.",
  map: grid.map((row) => row.join("")),
  players: [
    { name: "Soviet Union", nation: "ussr", funds: 8000, buildable: [...LAND, ...AIR], facing: "left" },
    { name: "Germany", nation: "germany", funds: 12000, buildable: [...LAND, ...AIR] },
  ],
  propertyOwners: PLACES.map(([name, , , , owner]) => ({ pos: placed.get(name), owner })),
  units,
  // HQ capture only, as on the Normandy theater map: on a map this size a side that loses every
  // unit can still rebuild from its factories (15-scenarios-eastern-front, Victory).
  victory: [{ type: "hqCapture" }],
};

const json = JSON.stringify(scenario, null, 2)
  // Keep each map row, unit and owner entry on one line so the file stays readable.
  .replace(/\{\s+"x": (\d+),\s+"y": (\d+)\s+\}/g, '{ "x": $1, "y": $2 }')
  .replace(/\{\s+("type": "[^"]+"),\s+("owner": \d),\s+("pos": \{[^}]+\})\s+\}/g, "{ $1, $2, $3 }")
  .replace(/\{\s+("pos": \{[^}]+\}),\s+("owner": \d)\s+\}/g, "{ $1, $2 }")
  .replace(/\[\s+((?:"[a-zA-Z]+",?\s+)+)\]/g, (_, list) => `[${list.trim().split(/,\s+/).join(", ")}]`);
writeFileSync(new URL("../../src/scenarios/kursk.json", import.meta.url), json + "\n");

console.log(grid.map((row, y) => `${String(y).padStart(2)} ${row.join("")}`).join("\n"));
const count = (owner) => scenario.propertyOwners.filter((p) => p.owner === owner).length;
const bunkers = grid.flat().filter((ch) => ch === "X").length;
const obstacles = grid.flat().filter((ch) => ch === "o").length;
console.log(`\n${W}x${H}. Properties: Soviet ${count(SOVIET)}, Germany ${count(GERMANY)}. Bunkers ${bunkers}, obstacles ${obstacles}.`);
console.log(`Units: Soviet ${units.filter((u) => u.owner === SOVIET).length}, Germany ${units.filter((u) => u.owner === GERMANY).length}.`);
const avg = (owner) => (units.filter((u) => u.owner === owner).reduce((s, u) => s + u.pos.x, 0) / units.filter((u) => u.owner === owner).length).toFixed(1);
console.log(`Average column: Soviet ${avg(SOVIET)}, Germany ${avg(GERMANY)}.`);
for (const [name] of PLACES) console.log(`${name}: (${placed.get(name).x}, ${placed.get(name).y})`);
