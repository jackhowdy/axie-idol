import sharp from 'sharp';

const src = 'public/stickers/kotaro.png';
const base = sharp(src);
const meta = await base.metadata();
const w = meta.width;
const h = meta.height;

// SVG label pill like the old placeholder
const labelW = Math.round(w * 0.42);
const labelH = Math.round(h * 0.08);
const fontSize = Math.round(labelH * 0.55);
const svg = Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${(w - labelW) / 2}" y="${h - labelH - Math.round(h * 0.04)}" width="${labelW}" height="${labelH}" rx="${labelH / 2}" fill="#1a1a2e" fill-opacity="0.88"/>
  <text x="${w / 2}" y="${h - labelH - Math.round(h * 0.04) + labelH * 0.68}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="${fontSize}" font-weight="700" fill="#ffe6b8">Kotaro</text>
</svg>`);

await sharp(src)
  .composite([{ input: svg, top: 0, left: 0 }])
  .png()
  .toFile('public/stickers/kotaro-labeled.png');

await sharp('public/stickers/kotaro-labeled.png').toFile(src);
const fs = await import('fs');
fs.unlinkSync('public/stickers/kotaro-labeled.png');
const out = await sharp(src).metadata();
console.log('labeled', out);
