/**
 * QA contact sheet for real Axies in 2D: `/?qa2d=2660,80,9`. Runs the production crop, joints and
 * wardrobe placement over each Axie and draws every wearable on it, so placement can be judged
 * across many body shapes at a glance. Loaded only when the query asks for it.
 */
import { loadAxieArt, jointsFor2D, ITEM_ANCHORS_2D, BEHIND_2D } from './axie2d.ts'
import { WEARABLE_IDS, drawWardrobe, offsetJoints, preloadWardrobe, wardrobeSprite2D } from './wardrobe.ts'

const CELL = 200

async function spritesReady(): Promise<void> {
  preloadWardrobe()
  for (let i = 0; i < 100; i++) {
    if (WEARABLE_IDS.every((id) => { const s = wardrobeSprite2D(id); return Boolean(s && s.complete && s.naturalWidth) })) return
    await new Promise((r) => setTimeout(r, 50))
  }
}

export async function renderArtSheet(ids: string[]): Promise<void> {
  await spritesReady()
  const root = document.createElement('div')
  root.id = 'qa2d'
  root.style.cssText = 'position:fixed;inset:0;z-index:9999;overflow:auto;background:#fff;padding:12px;font:700 12px system-ui;color:#1A2B3C'
  document.body.append(root)
  for (const id of ids) {
    const art = await loadAxieArt(id)
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px'
    const label = document.createElement('div')
    label.style.cssText = 'width:120px'
    label.textContent = art ? `#${id} ${art.w}x${art.h} top ${art.topMid.toFixed(2)}` : `#${id} failed`
    row.append(label)
    if (art) {
      const img = new Image()
      img.src = art.src
      await img.decode()
      for (const worn of [null, ...WEARABLE_IDS]) {
        const c = document.createElement('canvas')
        c.width = CELL
        c.height = CELL
        c.style.cssText = 'background:linear-gradient(180deg,#FFE8B0,#CDEFB0);border-radius:12px'
        c.dataset.qa = `${id}:${worn ?? 'none'}`
        const g = c.getContext('2d')!
        // the same fit the hero box uses: room above for headwear
        const fit = Math.min((CELL * 0.78) / art.w, (CELL * 0.66) / art.h)
        const w = art.w * fit, h = art.h * fit
        const left = (CELL - w) / 2, top = (CELL - h) / 2 + CELL * 0.07
        const over = document.createElement('canvas')
        over.width = CELL
        over.height = CELL
        if (worn) drawWardrobe(over.getContext('2d')!, worn, offsetJoints(jointsFor2D(w, h, art.topMid), left, top), wardrobeSprite2D, ITEM_ANCHORS_2D)
        // as in the game: a cape goes under the picture, anything else over it
        const behind = Boolean(worn && BEHIND_2D.includes(worn))
        if (behind) g.drawImage(over, 0, 0)
        g.drawImage(img, left, top, w, h)
        if (!behind) g.drawImage(over, 0, 0)
        row.append(c)
      }
    }
    root.append(row)
  }
  root.dataset.done = '1'
}
