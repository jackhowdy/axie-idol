// Copies the Three.js Axie Mixer 3D content pack into public/assets/axie (git-ignored, ~512 MB).
// Source: a clone of https://github.com/jaatster/threejs-axie-mixer3d-public (RIGHTS.md applies).
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
const src = process.argv[2] || process.env.MIXER3D_CLONE || '../threejs-axie-mixer3d-public'
const from = resolve(src, 'public/assets/axie')
const to = resolve('public/assets/axie')
if (!existsSync(from)) { console.error('Mixer clone not found at', from, '\nUsage: node scripts/copy-mixer-assets.mjs <path-to-clone>'); process.exit(1) }
rmSync(to, { recursive: true, force: true })
mkdirSync(resolve('public/assets'), { recursive: true })
cpSync(from, to, { recursive: true })
console.log('copied', from, '->', to)
console.log('[copy-mixer-assets] now run scripts/build_missing_parts.py to add the 30 derived part variants')
