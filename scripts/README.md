# Scripts

Run from the repository root with `node scripts/<name>`.

| Script | What it does |
|---|---|
| `build-icons.mjs` | Renders `public/icon.svg` into the PNG icons and the share image. |
| `build-thumbnail.mjs` | Renders the 1280x720 submission thumbnail. |
| `copy-mixer-assets.mjs` | Copies the 3D part pack from a clone of the Three.js Axie Mixer into `public/assets/axie/` (not in git, about 500 MB). Only needed with eggs on. |
| `build-part-catalogue.mjs` | Builds the part catalogue the egg hatcher draws from (`npm run catalogue`). |
| `build_missing_parts.py` | Builds stand-ins for part variants missing from the public mixer pack; see the README's known issues. |
| `taste-sheet.mjs` | Voice tasting: runs the real prompt and rules over a set of photos and writes a contact sheet of what the Axie said. |
| `seed-ladder.mjs` | Fills a **local** ladder with sample Axies (`npm run seed:ladder`). Never point it at production. |
| `reset-local.mjs` | Clears **local** data files (`npm run reset:local`). |
| `archive/` | One-off scripts from the earlier prototype. Not used by the game or the build. |
