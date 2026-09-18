// Renders the submission thumbnail (1280 x 720) from real pieces of the game: one of the entrant's
// photos, a real Axie (#2660, its official art trimmed to the creature), a real line from the voice, and the wordmark from build-icons.mjs.
// Run: node scripts/build-thumbnail.mjs
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const b64 = (p) => readFileSync(p).toString('base64')
const STAR = 'M46 5 56 3 64 33 95 33 97 42 72 60 82 88 74 95 50 76 25 95 17 89 28 59 3 43 5 34 37 33Z'
const AXIE = `<path transform="rotate(-3 36 50)" fill-rule="evenodd" d="M0 100 22 0 50 4 72 100 48 100 44 78 26 80 22 100ZM30 60 40 59 35 32Z"/>
  <path transform="translate(80 0) rotate(2 36 50)" d="M0 4 24 0 36 30 50 2 72 6 50 50 74 98 48 100 36 68 22 100-2 96 22 50Z"/>
  <path transform="translate(162 0) rotate(-2 14 50)" d="M2 2 28 0 26 100 0 98Z"/>
  <path transform="translate(198 0) rotate(3 28 50)" d="M0 0 56 4 54 26 26 24 26 40 48 40 47 60 26 59 26 76 58 78 56 100 0 98Z"/>`
const IDOL = `<g transform="translate(68 112)" fill-rule="evenodd"><path d="M0 0H10V34H0Z"/>
  <path transform="translate(18 0)" d="M0 0H20L30 8V26L20 34H0ZM10 9V25H17L20 22V12L17 9Z"/>
  <path transform="translate(56 0)" d="M8 0H24L32 8V26L24 34H8L0 26V8ZM12 10 10 12V22L12 24H20L22 22V12L20 10Z"/>
  <path transform="translate(96 0)" d="M0 0H10V24H26V34H0Z"/></g>`
const FONT = `font-family="Nunito, 'Segoe UI', Arial, sans-serif"`
const INK = '#1A2B3C'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5A5F"/><stop offset=".55" stop-color="#FF9A3C"/><stop offset="1" stop-color="#FFDD3B"/></linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#BFE4FF"/><stop offset="1" stop-color="#EAF6FF"/></linearGradient>
    <clipPath id="card"><rect x="0" y="0" width="372" height="632" rx="28"/></clipPath>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="${INK}" flood-opacity=".28"/></filter>
  </defs>
  <rect width="1280" height="720" fill="url(#sky)"/>
  <path d="M0 560 Q320 470 640 560 T1280 540 V720 H0Z" fill="#FFFFFF" opacity=".55"/>

  <g transform="translate(86 96) scale(1.95)">
    <g fill="#fff" stroke="#fff" stroke-width="16" stroke-linejoin="round">${AXIE}<g transform="translate(4 6)">${AXIE}</g>${IDOL}</g>
    <g transform="translate(4 6)" fill="#B5213B">${AXIE}</g><g fill="url(#f)">${AXIE}</g><g fill="#1E90FF">${IDOL}</g>
    <g transform="translate(232 -40) rotate(12) scale(.46)">
      <g fill="#fff" stroke="#fff" stroke-width="24" stroke-linejoin="round"><path d="${STAR}"/><path transform="translate(4 6)" d="${STAR}"/></g>
      <path transform="translate(4 6)" d="${STAR}" fill="#B5213B"/><path d="${STAR}" fill="url(#f)"/>
    </g>
  </g>
  <text x="90" y="468" ${FONT} font-weight="900" font-size="50" fill="${INK}">Pick a real Axie.</text>
  <text x="90" y="528" ${FONT} font-weight="900" font-size="50" fill="${INK}">Make it a star.</text>
  <text x="92" y="584" ${FONT} font-weight="700" font-size="28" fill="#4A6076">In your camera. With opinions. Happier every day.</text>
  <g transform="translate(90 618)">
    <rect width="330" height="52" rx="26" fill="#FF6B2C"/>
    <text x="165" y="35" text-anchor="middle" ${FONT} font-weight="900" font-size="24" fill="#fff">axieidol.com · no wallet</text>
  </g>

  <g transform="translate(838 40) rotate(4 186 316)" filter="url(#sh)">
    <rect x="-10" y="-10" width="392" height="652" rx="36" fill="#fff"/>
    <g clip-path="url(#card)">
      <image x="0" y="0" width="372" height="632" preserveAspectRatio="xMidYMid slice" xlink:href="data:image/jpeg;base64,${b64('public/samples/playground.jpg')}"/>
      <image x="80" y="420" width="240" height="205" preserveAspectRatio="xMidYMax meet" xlink:href="data:image/png;base64,${b64(process.env.THUMB_AXIE || 'public/samples/axie-2660.png')}"/>
    </g>
    <g transform="translate(26 236)">
      <path d="M150 120 l18 26 l18 -26z" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <rect width="320" height="122" rx="24" fill="#fff" stroke="${INK}" stroke-width="4"/>
      <rect x="146" y="114" width="44" height="8" fill="#fff"/>
      <text x="160" y="46" text-anchor="middle" ${FONT} font-weight="900" font-size="25" fill="${INK}">That yellow slide goes</text>
      <text x="160" y="78" text-anchor="middle" ${FONT} font-weight="900" font-size="25" fill="${INK}">very high. Can we</text>
      <text x="160" y="108" text-anchor="middle" ${FONT} font-weight="900" font-size="25" fill="${INK}">climb up?</text>
    </g>
    <g transform="translate(20 20)">
      <rect width="232" height="44" rx="22" fill="#fff" opacity=".95"/>
      <path transform="translate(16 11) scale(1.0)" d="M11 20s-9-5.6-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.400-9 12-9 12z" fill="#E0355A"/>
      <text x="46" y="30" ${FONT} font-weight="900" font-size="20" fill="#E0355A">+15 happy · Happy</text>
    </g>
  </g>
</svg>`

await sharp(Buffer.from(svg), { density: 144 }).resize(1280, 720).png().toFile('public/thumbnail.png')
await sharp('public/thumbnail.png').resize(640, 360).jpeg({ quality: 88 }).toFile('public/thumbnail-640.jpg')
console.log('thumbnail written')
