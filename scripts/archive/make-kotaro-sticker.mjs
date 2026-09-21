import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'vendor/axie-3d-assets/kotaro-preview-source.png');
const outPath = path.join(root, 'public/stickers/kotaro.png');

function similarBg(r, g, b) {
  if (b > r + 12 && b > g + 8) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max ? (max - min) / max : 0;
  if (b >= r && b >= g && b - r >= 8 && sat > 0.12 && b < 180) return true;
  if (r < 60 && g < 70 && b < 100 && b >= r && b >= g - 5) return true;
  return false;
}

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const w = info.width;
const h = info.height;
const out = Buffer.from(data);

const visited = new Uint8Array(w * h);
const stack = [
  [0, 0],
  [w - 1, 0],
  [0, h - 1],
  [w - 1, h - 1],
  [Math.floor(w / 2), 0],
  [0, Math.floor(h / 2)],
  [w - 1, Math.floor(h / 2)],
  [Math.floor(w / 2), h - 1],
];

while (stack.length) {
  const [x, y] = stack.pop();
  if (x < 0 || y < 0 || x >= w || y >= h) continue;
  const idx = y * w + x;
  if (visited[idx]) continue;
  visited[idx] = 1;
  const i = idx * 4;
  const r = out[i];
  const g = out[i + 1];
  const b = out[i + 2];
  if (!similarBg(r, g, b)) continue;
  out[i + 3] = 0;
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}

// Soften leftover blue fringe near transparent pixels
for (let y = 1; y < h - 1; y++) {
  for (let x = 1; x < w - 1; x++) {
    const i = (y * w + x) * 4;
    if (out[i + 3] === 0) continue;
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (!(b > r + 20 && b > g + 15 && r < 120)) continue;
    let nearClear = false;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]]) {
      if (out[((y + dy) * w + (x + dx)) * 4 + 3] === 0) { nearClear = true; break; }
    }
    if (nearClear) out[i + 3] = 0;
  }
}

let minX = w, minY = h, maxX = 0, maxY = 0, opaque = 0;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (out[(y * w + x) * 4 + 3] > 16) {
      opaque++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
console.log('opaque', opaque, 'bbox', minX, minY, maxX, maxY);

const pad = 16;
minX = Math.max(0, minX - pad);
minY = Math.max(0, minY - pad);
maxX = Math.min(w - 1, maxX + pad);
maxY = Math.min(h - 1, maxY + pad);
const cw = maxX - minX + 1;
const ch = maxY - minY + 1;
const side = Math.max(cw, ch);
const square = Buffer.alloc(side * side * 4, 0);
const ox = Math.floor((side - cw) / 2);
const oy = Math.floor((side - ch) / 2);
for (let y = 0; y < ch; y++) {
  for (let x = 0; x < cw; x++) {
    const si = ((minY + y) * w + (minX + x)) * 4;
    const di = ((oy + y) * side + (ox + x)) * 4;
    square[di] = out[si];
    square[di + 1] = out[si + 1];
    square[di + 2] = out[si + 2];
    square[di + 3] = out[si + 3];
  }
}

const target = 896;
await sharp(square, { raw: { width: side, height: side, channels: 4 } })
  .resize(target, target, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(outPath);

const meta = await sharp(outPath).metadata();
console.log('wrote', outPath, meta);
