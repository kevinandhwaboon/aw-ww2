// Makes the placeholder sound effects (docs/16-sound.md §9): each one built from tones and noise, written
// as 16-bit mono WAV into public/assets/sounds/. Run with `npm run sounds`. No dependencies, and no
// randomness beyond a fixed seed per sound, so it always writes exactly the same files.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 22050;
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(root, "public", "assets", "sounds");
mkdirSync(outDir, { recursive: true });

// ---- Building blocks ----

/** A fixed-seed random number generator (mulberry32), so every run makes the same noise. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedOf = (name) => [...name].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
const samples = (seconds) => Math.round(seconds * RATE);
const buffer = (seconds) => new Float32Array(samples(seconds));

function noise(seconds, random) {
  const out = buffer(seconds);
  for (let i = 0; i < out.length; i++) out[i] = random() * 2 - 1;
  return out;
}

/**
 * One-pole low-pass filter. `loop` runs it round the buffer twice, so the end flows into the start
 * and a looping sound has no click where it wraps.
 */
function lowpass(input, cutoff, loop = false) {
  const k = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
  const out = new Float32Array(input.length);
  let y = 0;
  for (let pass = loop ? 0 : 1; pass < 2; pass++) {
    for (let i = 0; i < input.length; i++) {
      y += k * (input[i] - y);
      out[i] = y;
    }
  }
  return out;
}

function highpass(input, cutoff, loop = false) {
  const low = lowpass(input, cutoff, loop);
  return input.map((v, i) => v - low[i]);
}

/** A tone whose frequency follows `freq(t)`, in a shape: sine, square or saw. */
function tone(seconds, freq, shape = "sine") {
  const out = buffer(seconds);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    phase += freq(i / RATE) / RATE;
    const p = phase % 1;
    out[i] = shape === "sine" ? Math.sin(2 * Math.PI * p) : shape === "square" ? (p < 0.5 ? 1 : -1) : 2 * p - 1;
  }
  return out;
}

/** A glide from one frequency to another over `seconds`, exponential like a falling pitch. */
const glide = (from, to, seconds) => (t) => from * Math.pow(to / from, Math.min(1, t / seconds));

/** Shapes a sound's loudness: `env(t)` is 0 to 1 at time t seconds. */
function shape(input, env) {
  return input.map((v, i) => v * env(i / RATE));
}

/** Quick attack, then exponential decay with time constant `tau`. */
const decay = (tau, attack = 0.002) => (t) => Math.min(1, t / attack) * Math.exp(-t / tau);

function mix(seconds, ...parts) {
  const out = buffer(seconds);
  for (const [part, gain = 1, offset = 0] of parts) {
    const start = samples(offset);
    for (let i = 0; i < part.length && start + i < out.length; i++) out[start + i] += part[i] * gain;
  }
  return out;
}

/** Scales to a peak of `peak`, and fades the very ends so nothing clicks. */
function finish(input, { peak = 0.9, loop = false } = {}) {
  const max = input.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const out = input.map((v) => (v / max) * peak);
  if (!loop) {
    const fade = samples(0.004);
    for (let i = 0; i < fade && i < out.length; i++) out[out.length - 1 - i] *= i / fade;
  }
  return out;
}

function writeWav(name, data) {
  const bytes = Buffer.alloc(44 + data.length * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + data.length * 2, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); // PCM
  bytes.writeUInt16LE(1, 22); // mono
  bytes.writeUInt32LE(RATE, 24);
  bytes.writeUInt32LE(RATE * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(data.length * 2, 40);
  data.forEach((v, i) => bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  writeFileSync(join(outDir, `${name}.wav`), bytes);
}

// ---- The sounds (docs/16-sound.md §4) ----

/** A gunshot: a sharp crack, a body of filtered noise, and a low thump. Longer and deeper for bigger guns. */
function gunshot(r, { length, crack, body, bodyCutoff, thump, thumpFrom, thumpTo }) {
  return mix(
    length,
    [shape(highpass(noise(length, r), 1800), decay(crack)), 0.8],
    [shape(lowpass(noise(length, r), bodyCutoff), decay(body)), 1.4],
    [shape(tone(length, glide(thumpFrom, thumpTo, thump * 3)), decay(thump)), 0.9],
  );
}

/** An explosion: a long rumble of low noise with crackle, over a falling sub-bass thump. */
function blast(r, length, rumble) {
  const crackle = new Float32Array(samples(length));
  for (let i = 0; i < crackle.length; i++) if (r() < 0.004 * Math.exp(-i / RATE / (rumble * 0.6))) crackle[i] = r() * 2 - 1;
  return mix(
    length,
    [shape(lowpass(noise(length, r), 700), decay(rumble, 0.004)), 2.2],
    [shape(lowpass(noise(length, r), 2500), decay(0.05)), 0.6],
    [shape(tone(length, glide(70, 28, length)), decay(rumble * 0.8, 0.004)), 1.2],
    [lowpass(crackle, 3000), 3],
  );
}

/** Notes one after another: [frequency, start, length] in a square wave softened by a filter. */
function tune(length, notes, { cutoff = 3000, tau = 0.25 } = {}) {
  const parts = notes.map(([freq, start, dur]) => [shape(lowpass(tone(dur, () => freq, "square"), cutoff), decay(tau, 0.005)), 0.5, start]);
  return mix(length, ...parts);
}

const C5 = 523.25, E5 = 659.25, G4 = 392, G5 = 783.99, C6 = 1046.5;

const SOUNDS = {
  fireRifle: (r) => gunshot(r, { length: 0.35, crack: 0.01, body: 0.05, bodyCutoff: 1500, thump: 0.04, thumpFrom: 160, thumpTo: 60 }),
  fireMg: (r) => gunshot(r, { length: 0.14, crack: 0.006, body: 0.025, bodyCutoff: 1800, thump: 0.02, thumpFrom: 180, thumpTo: 80 }),
  fireBazooka: (r) =>
    mix(
      0.6,
      [gunshot(r, { length: 0.2, crack: 0.008, body: 0.04, bodyCutoff: 1200, thump: 0.05, thumpFrom: 200, thumpTo: 70 }), 1],
      [shape(lowpass(noise(0.6, r), 2200), (t) => Math.min(1, t / 0.05) * Math.exp(-t / 0.18)), 0.9],
    ),
  fireMortar: (r) =>
    mix(
      0.5,
      [shape(tone(0.5, glide(190, 70, 0.15)), decay(0.07)), 1.2],
      [shape(lowpass(noise(0.5, r), 600), decay(0.09)), 1.2],
    ),
  fireCannon: (r) => gunshot(r, { length: 0.8, crack: 0.012, body: 0.18, bodyCutoff: 900, thump: 0.15, thumpFrom: 120, thumpTo: 38 }),
  fireHowitzer: (r) => gunshot(r, { length: 1.2, crack: 0.015, body: 0.35, bodyCutoff: 500, thump: 0.3, thumpFrom: 80, thumpTo: 28 }),
  fireRockets: (r) => {
    const whoosh = shape(lowpass(highpass(noise(0.8, r), 500), 3500), (t) => Math.min(1, t / 0.06) * Math.exp(-t / 0.3) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 30 * t)));
    return mix(0.8, [whoosh, 1.2], [shape(lowpass(noise(0.8, r), 400), decay(0.12)), 0.8]);
  },
  bombWhistle: () => shape(tone(0.75, (t) => 1500 - 1000 * (t / 0.75)), (t) => Math.min(1, t / 0.25) * (1 - Math.pow(t / 0.75, 6))),
  waterSplash: (r) =>
    mix(
      0.6,
      [shape(lowpass(noise(0.6, r), 2500), (t) => Math.min(1, t / 0.03) * Math.exp(-t / 0.2)), 1],
      [shape(lowpass(noise(0.6, r), 350), decay(0.12)), 1],
    ),
  impactBullet: (r) =>
    mix(0.08, [shape(highpass(noise(0.08, r), 2500), decay(0.006)), 1], [shape(tone(0.08, () => 900), decay(0.01)), 0.3]),
  impactShell: (r) =>
    mix(
      0.6,
      [shape(lowpass(noise(0.6, r), 1200), decay(0.14, 0.003)), 1.6],
      [shape(tone(0.6, glide(100, 40, 0.4)), decay(0.12)), 1],
    ),
  explosion: (r) => blast(r, 1.4, 0.4),
  moveFoot: (r) => {
    // Boots on the ground four times a loop, alternating heavy and light.
    const steps = [0, 0.09, 0.18, 0.27].map((at, k) => [
      mix(0.08, [shape(lowpass(noise(0.08, r), 700 + k * 120), decay(0.018)), 1], [shape(tone(0.08, () => 85), decay(0.02)), 0.6]),
      k % 2 === 0 ? 1 : 0.65,
      at,
    ]);
    return mix(0.36, ...steps);
  },
  moveWheels: (r) =>
    mix(
      1,
      [lowpass(shape(tone(1, () => 50, "saw"), (t) => 0.75 + 0.25 * Math.sin(2 * Math.PI * 10 * t)), 400, true), 1],
      [lowpass(noise(1, r), 250, true), 1.5],
    ),
  moveTracks: (r) => {
    // A deeper engine, with the tracks clanking twelve times a second.
    const clanks = buffer(1);
    for (let k = 0; k < 12; k++) {
      const hit = shape(highpass(noise(0.03, r), 1500), decay(0.008));
      const start = samples(k / 12);
      hit.forEach((v, i) => (clanks[(start + i) % clanks.length] += v * (k % 2 === 0 ? 1 : 0.6)));
    }
    return mix(1, [lowpass(tone(1, () => 40, "saw"), 300, true), 1], [lowpass(noise(1, r), 200, true), 1.2], [clanks, 0.5]);
  },
  moveAir: (r) =>
    mix(
      1,
      [lowpass(shape(tone(1, () => 96, "saw"), (t) => 0.6 + 0.4 * Math.sin(2 * Math.PI * 24 * t)), 1200, true), 1],
      [lowpass(noise(1, r), 900, true), 0.6],
    ),
  moveNaval: (r) =>
    mix(
      1,
      [lowpass(tone(1, () => 35, "saw"), 250, true), 1],
      [shape(lowpass(highpass(noise(1, r), 300, true), 1400, true), (t) => 0.6 + 0.4 * Math.sin(2 * Math.PI * 2 * t)), 1.2],
    ),
  chute: (r) =>
    mix(0.35, [shape(lowpass(noise(0.35, r), 1500), decay(0.07, 0.01)), 1.4], [shape(tone(0.35, glide(140, 70, 0.1)), decay(0.05)), 0.7]),
  captured: () => tune(0.75, [[C5, 0, 0.12], [E5, 0.1, 0.12], [G5, 0.2, 0.12], [C6, 0.3, 0.45]]),
  built: () => {
    const hit = () => mix(0.2, ...[800, 1270, 2130].map((f, k) => [shape(tone(0.2, () => f), decay(0.05 - k * 0.012)), 1 / (k + 1)]));
    return mix(0.36, [hit(), 1], [hit(), 0.8, 0.12]);
  },
  alert: () => tune(0.4, [[880, 0, 0.1], [880, 0.16, 0.1]], { tau: 0.5 }),
  supply: () => mix(0.45, [shape(tone(0.45, () => 1320), decay(0.12)), 1], [shape(tone(0.45, () => 2640), decay(0.06)), 0.3]),
  turnStart: () => tune(0.75, [[G4, 0, 0.2], [C5, 0.2, 0.5]], { cutoff: 1800, tau: 0.4 }),
  gameOver: () =>
    tune(1.45, [[G4, 0, 0.15], [C5, 0.15, 0.15], [E5, 0.3, 0.15], [G5, 0.45, 0.15], [C6, 0.6, 0.8], [G5, 0.6, 0.8], [E5, 0.6, 0.8]], { tau: 0.5 }),
  uiSelect: () => shape(lowpass(tone(0.06, () => 1200, "square"), 4000), decay(0.02)),
  uiCancel: () => shape(lowpass(tone(0.08, glide(600, 380, 0.08), "square"), 3000), decay(0.03)),
};

const LOOPS = new Set(["moveFoot", "moveWheels", "moveTracks", "moveAir", "moveNaval"]);

for (const [name, make] of Object.entries(SOUNDS)) {
  const loop = LOOPS.has(name);
  writeWav(name, finish(make(rng(seedOf(name))), { loop, peak: loop ? 0.7 : 0.9 }));
}
console.log(`Wrote ${Object.keys(SOUNDS).length} placeholder sounds to ${outDir}`);
