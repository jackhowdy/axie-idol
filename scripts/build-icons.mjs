// Renders the PNG icons and the share image from the same drawing as public/icon.svg.
// Run: node scripts/build-icons.mjs
import sharp from 'sharp'

const STAR = 'M46 5 56 3 64 33 95 33 97 42 72 60 82 88 74 95 50 76 25 95 17 89 28 59 3 43 5 34 37 33Z'
const FADE = '<linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5A5F"/><stop offset=".55" stop-color="#FF9A3C"/><stop offset="1" stop-color="#FFDD3B"/></linearGradient>'
const star = (outline) => `<g fill="#fff" stroke="#fff" stroke-width="${outline}" stroke-linejoin="round"><path d="${STAR}"/><path transform="translate(4 6)" d="${STAR}"/></g>
  <path transform="translate(4 6)" d="${STAR}" fill="#B5213B"/><path d="${STAR}" fill="url(#f)"/>`

// Home-screen tile: full bleed, the phone rounds the corners itself.
const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs>${FADE}</defs>
  <rect width="120" height="120" fill="#1E96FF"/>
  <path d="M0 0H80L0 72Z" fill="#54C4FF"/><path d="M120 48V120H38Z" fill="#0B6BDD"/>
  <g transform="translate(17 16) scale(.84)">${star(12)}</g></svg>`

const AXIE = `<path transform="rotate(-3 36 50)" fill-rule="evenodd" d="M0 100 22 0 50 4 72 100 48 100 44 78 26 80 22 100ZM30 60 40 59 35 32Z"/>
  <path transform="translate(80 0) rotate(2 36 50)" d="M0 4 24 0 36 30 50 2 72 6 50 50 74 98 48 100 36 68 22 100-2 96 22 50Z"/>
  <path transform="translate(162 0) rotate(-2 14 50)" d="M2 2 28 0 26 100 0 98Z"/>
  <path transform="translate(198 0) rotate(3 28 50)" d="M0 0 56 4 54 26 26 24 26 40 48 40 47 60 26 59 26 76 58 78 56 100 0 98Z"/>`
const IDOL = `<g transform="translate(68 112)" fill-rule="evenodd"><path d="M0 0H10V34H0Z"/>
  <path transform="translate(18 0)" d="M0 0H20L30 8V26L20 34H0ZM10 9V25H17L20 22V12L17 9Z"/>
  <path transform="translate(56 0)" d="M8 0H24L32 8V26L24 34H8L0 26V8ZM12 10 10 12V22L12 24H20L22 22V12L20 10Z"/>
  <path transform="translate(96 0)" d="M0 0H10V24H26V34H0Z"/></g>`
// Share card, 1200 x 630: the stacked name with the star where a gem would sit.
const share = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><defs>${FADE}</defs>
  <rect width="1200" height="630" fill="#E6F4FF"/>
  <g transform="translate(262 130) scale(2.5)">
    <g fill="#fff" stroke="#fff" stroke-width="16" stroke-linejoin="round">${AXIE}<g transform="translate(4 6)">${AXIE}</g>${IDOL}</g>
    <g transform="translate(4 6)" fill="#B5213B">${AXIE}</g><g fill="url(#f)">${AXIE}</g><g fill="#1E90FF">${IDOL}</g>
    <g transform="translate(232 -44) rotate(12) scale(.5)">${star(22)}</g>
  </g></svg>`

await sharp(Buffer.from(tile), { density: 600 }).resize(512, 512).png().toFile('public/icon-512.png')
await sharp(Buffer.from(tile), { density: 600 }).resize(180, 180).png().toFile('public/icon-180.png')
await sharp(Buffer.from(share), { density: 144 }).resize(1200, 630).png().toFile('public/share.png')
console.log('icons written')
