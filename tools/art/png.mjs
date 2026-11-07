// PNG drawing helpers for the art scripts. No dependencies.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

export const rgba = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255);
export const canvas = (w, h) => ({ w, h, px: new Uint8Array(w * h * 4) });

export function stamp(c, grid, palette, ox, oy, scale = 1) {
  grid.forEach((row, y) => [...row].forEach((ch, x) => {
    const hex = palette[ch];
    if (!hex) return;
    const color = rgba(hex);
    for (let sy = 0; sy < scale; sy++) {
      for (let sx = 0; sx < scale; sx++) {
        c.px.set(color, ((oy + y * scale + sy) * c.w + ox + x * scale + sx) * 4);
      }
    }
  }));
}

function crc(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
}

export function savePng(c, path) {
  const raw = Buffer.alloc((c.w * 4 + 1) * c.h);
  for (let y = 0; y < c.h; y++) {
    Buffer.from(c.px.buffer, y * c.w * 4, c.w * 4).copy(raw, y * (c.w * 4 + 1) + 1);
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(c.w, 0);
  head.writeUInt32BE(c.h, 4);
  head.set([8, 6, 0, 0, 0], 8);
  writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", head), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]));
}
