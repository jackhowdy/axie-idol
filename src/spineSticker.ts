/**
 * Spine (Axie mixer) sticker overlay — Pixi + mixer, PNG-upgrade path.
 * Dynamic-import only from main.ts when upgrading an Axie ID sticker.
 */
import { Application, Assets, Texture } from 'pixi.js'
import { Spine, TextureAtlas } from 'pixi-spine'
import { AtlasAttachmentLoader, SkeletonJson } from '@pixi-spine/runtime-3.8'
import {
  initAxieMixer,
  getAxieSpineFromGenes,
  getAxieColorPartShift,
  getVariantAttachmentPath,
  type AxieBuilderResult,
} from '@axieinfinity/mixer'

import GenesData from '@axieinfinity/mixer/dist/data/axie-2d-v3-stuff-genes.json'
import SamplesData from '@axieinfinity/mixer/dist/data/axie-2d-v3-stuff-samples.json'
import VariantsData from '@axieinfinity/mixer/dist/data/axie-2d-v3-stuff-variant.json'
import AnimationsData from '@axieinfinity/mixer/dist/data/axie-2d-v3-stuff-animations_lite.json'

const AXIE_IMAGES_URL = 'https://axiecdn.axieinfinity.com/mixer-stuffs/v6/'
const IDLE = 'action/idle/normal'
const MAX_PIXEL_RATIO = 2

export type SpineSticker = {
  canvas: HTMLCanvasElement
  ready: boolean
  renderFromGenes: (genes: string) => Promise<void>
  renderNow: () => void
  dispose: () => void
  setLean?: (x: number, y: number) => void
}

let mixerReady = false

function ensureMixerInit(): void {
  if (mixerReady) return
  initAxieMixer(GenesData, SamplesData, VariantsData, AnimationsData)
  mixerReady = true
}

export async function createSpineSticker(parent: HTMLElement): Promise<SpineSticker | null> {
  const canvas = document.createElement('canvas')
  canvas.id = 'spine-sticker'
  canvas.setAttribute('aria-hidden', 'true')
  parent.appendChild(canvas)

  let app: Application
  try {
    const cssW = cssSize()
    const cssH = Math.round(cssW * 1.15)
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    app = new Application({
      view: canvas,
      width: cssW,
      height: cssH,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
      autoDensity: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    })
  } catch (err) {
    console.warn('[axie-idol] Pixi Application failed', err)
    canvas.remove()
    return null
  }

  let axieSpine: Spine | undefined
  let ready = false
  let disposed = false
  let leanX = 0
  let leanY = 0
  let baseScale = 0.22

  function cssSize(): number {
    const vmin = Math.min(window.innerWidth, window.innerHeight) * 0.01
    // Slightly larger than 3D sticker; still mirrors positioning pattern
    return Math.min(300, Math.max(180, 48 * vmin))
  }

  function resize(): void {
    if (disposed) return
    const w = cssSize()
    const h = Math.round(w * 1.15)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    app.renderer.resize(w, h)
    if (axieSpine) {
      axieSpine.position.set(w / 2, h * 0.78)
    }
  }

  function renderFrame(): void {
    if (disposed) return
    if (axieSpine) {
      const skew = leanX * 0.0004
      axieSpine.scale.set(baseScale * (1 + leanY * 0.0003), baseScale * (1 - Math.abs(leanX) * 0.0002))
      axieSpine.skew.x = skew
    }
    app.render()
  }

  function onResize(): void {
    resize()
    renderFrame()
  }
  window.addEventListener('resize', onResize)

  async function createAxieSpine(
    skeletonData: AxieBuilderResult['skeletonDataAsset'],
    variant: string,
  ): Promise<Spine> {
    const resources = getRequiredTextures(skeletonData, variant)
    const texturePromises = resources.map(async (resource) => {
      try {
        const texture = await Assets.load(resource.imagePath)
        return { key: resource.key, texture }
      } catch (err) {
        console.warn(`[axie-idol] Spine texture failed: ${resource.key}`, err)
        return null
      }
    })

    const loaded = (await Promise.all(texturePromises)).filter(Boolean) as Array<{
      key: string
      texture: Texture
    }>

    const allTextures: Record<string, Texture> = {}
    for (const { key, texture } of loaded) {
      allTextures[key] = texture
    }

    const spineAtlas = new TextureAtlas()
    spineAtlas.addTextureHash(allTextures as never, false)
    const spineAtlasLoader = new AtlasAttachmentLoader(spineAtlas)
    const spineJsonParser = new SkeletonJson(spineAtlasLoader)
    const spineData = spineJsonParser.readSkeletonData(skeletonData)
    return new Spine(spineData)
  }

  function getRequiredTextures(
    skeletonData: AxieBuilderResult['skeletonDataAsset'],
    variant: string,
  ): Array<{ key: string; imagePath: string }> {
    const skinAttachments = skeletonData.skins[0].attachments
    const imagesToLoad: Array<{ key: string; imagePath: string }> = []
    const partColorShift = getAxieColorPartShift(variant)

    for (const slotName in skinAttachments) {
      const skinSlotAttachments = skinAttachments[slotName]
      for (const attachmentName of Object.keys(skinSlotAttachments)) {
        const path = skinSlotAttachments[attachmentName].path
        const imagePath =
          AXIE_IMAGES_URL + getVariantAttachmentPath(slotName, path, variant, partColorShift)
        imagesToLoad.push({ key: path, imagePath })
      }
    }
    return imagesToLoad
  }

  async function renderFromGenes(genes: string): Promise<void> {
    if (disposed) return
    ensureMixerInit()
    app.stage.removeChildren()
    axieSpine = undefined
    ready = false

    if (!genes || genes === '0x0' || genes === '0x') {
      throw new Error('No genes available (egg or unhatched Axie)')
    }

    const meta = new Map<string, string>()
    const result: AxieBuilderResult = getAxieSpineFromGenes(genes, meta, false)
    const { skeletonDataAsset, variant } = result

    if (!skeletonDataAsset) {
      throw new Error('Mixer returned empty skeleton data')
    }

    axieSpine = await createAxieSpine(skeletonDataAsset, variant)
    if (disposed) return

    const w = app.screen.width
    const h = app.screen.height
    baseScale = 0.22
    axieSpine.position.set(w / 2, h * 0.78)
    axieSpine.scale.set(baseScale)

    const animNames = axieSpine.spineData?.animations?.map((a) => a.name) ?? []
    const idle = animNames.includes(IDLE) ? IDLE : animNames[0]
    if (idle) {
      axieSpine.state.setAnimation(0, idle, true)
    }

    app.stage.addChild(axieSpine as never)
    ready = true
    renderFrame()
    console.info('[axie-idol] Spine sticker ready', idle ?? '(no idle)')
  }

  return {
    canvas,
    get ready() {
      return ready
    },
    renderFromGenes,
    renderNow() {
      renderFrame()
    },
    setLean(x: number, y: number) {
      leanX = x
      leanY = y
    },
    dispose() {
      if (disposed) return
      disposed = true
      ready = false
      window.removeEventListener('resize', onResize)
      try {
        app.ticker?.stop()
        app.destroy(true, { children: true, texture: false, baseTexture: false })
      } catch (err) {
        console.warn('[axie-idol] Spine dispose', err)
      }
      canvas.remove()
      axieSpine = undefined
    },
  }
}
