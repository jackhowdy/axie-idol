import fs from 'fs';
const path = 'README.md';
let rt = fs.readFileSync(path, 'utf8');
const oldAssets = `## Assets

public/stickers/kotaro.svg — cute placeholder labeled Kotaro.
Swap for official Builder Kit / 2D mixer art when ready.
`;
const newAssets = `## Assets

- \`public/stickers/kotaro.png\` — official Kotaro still (transparent) for AR overlay,
  derived from [jaatster/axie-3d-assets](https://github.com/jaatster/axie-3d-assets)
  \`previews/kotaro.png\` (Axie Vibeathon kit, Sky Mavis).
- \`public/models/kotaro.glb\` — official animated Kotaro GLB from the same kit
  (\`assets/mascots/kotaro.glb\`).
- \`public/stickers/kotaro.svg\` — placeholder fallback (not official art).

**Rights:** limited Vibeathon / Sky Mavis-approved use only. See \`RIGHTS.md\`
and \`vendor/axie-3d-assets/\` (upstream README + RIGHTS + notices).
`;
if (!rt.includes(oldAssets)) {
  console.error('old assets block missing');
  process.exit(1);
}
fs.writeFileSync(path, rt.replace(oldAssets, newAssets));
console.log('README patched');
