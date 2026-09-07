/**
 * Animated 3D Axie sticker backed by the Three.js Axie Mixer 3D (Sky Mavis, public alpha).
 * One renderer + one mixer for the app; one live character at a time on Snap.
 * Same surface as sticker3d.ts so main.ts can treat both alike.
 *
 * Downgrade policy (never 2D, never a missing part): if a part variant is not in
 * the pack, use the same part in normal skin; if only stage 2 is missing, use stage 1.
 */
import {
  AmbientLight,
  Box3,
  Clock,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three'
import {
  createAxieMixer3D,
  formatAxiePartAssetId,
  type AxieDescriptor,
  type AxiePartDescriptor,
} from '@jaatster/threejs-axie-mixer3d-public'
import type { ThreeAxieMixer3D } from '@jaatster/threejs-axie-mixer3d-public'

const MAX_PIXEL_RATIO = 2
const ASSET_BASE = '/assets/axie/'

export type Axie3DSpec =
  | { kind: 'genes'; genes: string; label?: string }
  | { kind: 'descriptor'; descriptor: AxieDescriptor; label?: string; gold?: boolean }

export type Axie3D = {
  canvas: HTMLCanvasElement
  ready: boolean
  loading: boolean
  /** Which spec is live (label for logs). */
  label: string | null
  load: (spec: Axie3DSpec) => Promise<boolean>
  setLean: (leanX: number, leanY: number) => void
  pause: () => void
  resume: () => void
  renderNow: () => void
  /** Render the live character to a transparent PNG data URL (for group-photo extras). */
  snapshot: (size?: number) => string | null
  dispose: () => void
}

type Character = {
  wrapper: Object3D
  update: (dt: number) => void
  setLocomotion?: (state: 'idle' | 'walk' | 'run' | 'air', transition?: number) => void
  setMoveSpeed?: (v: number, transition?: number) => void
  dispose: () => void
}

let mixerPromise: Promise<ThreeAxieMixer3D> | null = null
let firstRenderer: WebGLRenderer | null = null

/** One renderer per Axie3D instance (main sticker, offscreen snapshots). */
function makeRenderer(id: string): WebGLRenderer {
  const canvas = document.createElement('canvas')
  canvas.id = id
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  })
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO))
  if (!firstRenderer) firstRenderer = renderer
  return renderer
}

/** The mixer is created once per page (manifest is ~9 MB, cached by the browser). */
export function getAxieMixer(): Promise<ThreeAxieMixer3D> {
  if (!mixerPromise) {
    mixerPromise = createAxieMixer3D({
      renderer: firstRenderer || makeRenderer('axie3d-probe'),
      assetBaseUrl: ASSET_BASE,
      maxUnusedEntries: 24,
      onDiagnostic: (event) => {
        if (event.severity === 'error') console.error('[axie3d]', event)
        else if (event.severity === 'warning') console.warn('[axie3d]', event)
      },
    }).catch((err) => {
      mixerPromise = null
      throw err
    })
  }
  return mixerPromise
}

/** Apply the downgrade policy against the loaded manifest. Returns a new descriptor. */
export function downgradeDescriptor(
  descriptor: AxieDescriptor,
  hasPart: (id: string) => boolean,
  log: (msg: string) => void = () => {},
): AxieDescriptor {
  const parts = descriptor.parts.map((p): AxiePartDescriptor => {
    const candidates: AxiePartDescriptor[] = [
      p,
      { ...p, level: 1 },
      { ...p, skin: 0 },
      { ...p, skin: 0, level: 1 },
    ]
    for (const c of candidates) {
      if (hasPart(formatAxiePartAssetId(c))) {
        if (c !== p) log(`[axie3d] ${formatAxiePartAssetId(p)} -> ${formatAxiePartAssetId(c)}`)
        return c
      }
    }
    return p
  })
  return { ...descriptor, parts }
}

function goldify(root: Object3D): void {
  const gold = new MeshStandardMaterial({
    color: new Color('#f2c94c'),
    metalness: 0.85,
    roughness: 0.32,
    emissive: new Color('#6b4a05'),
    emissiveIntensity: 0.25,
  })
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const prev = mesh.material as Material | Material[]
    const skinned = (mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh
    const mat = gold.clone()
    if (skinned) (mat as unknown as { skinning?: boolean }).skinning = true
    mesh.material = Array.isArray(prev) ? prev.map(() => mat) : mat
  })
}

function frameCamera(camera: PerspectiveCamera, root: Object3D): void {
  const box = new Box3().setFromObject(root)
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1
  const dist = radius / Math.tan((camera.fov * Math.PI) / 360) * 1.15
  camera.position.set(center.x + dist * 0.35, center.y + radius * 0.15, center.z + dist)
  camera.near = Math.max(0.05, dist / 100)
  camera.far = dist * 10
  camera.lookAt(center)
  camera.updateProjectionMatrix()
}

export function createAxie3D(id = 'axie3d'): Axie3D {
  const renderer = makeRenderer(id)
  const canvas = renderer.domElement
  const scene = new Scene()
  const camera = new PerspectiveCamera(30, 1, 0.1, 100)
  scene.add(new HemisphereLight(0xffffff, 0x556677, 1.6))
  scene.add(new AmbientLight(0xffffff, 0.35))
  const key = new DirectionalLight(0xffffff, 2.2)
  key.position.set(2, 4, 3)
  scene.add(key)
  const fill = new DirectionalLight(0xffffff, 0.7)
  fill.position.set(-3, 2, -2)
  scene.add(fill)

  const clock = new Clock()
  let character: Character | null = null
  let raf = 0
  let paused = false
  let lean = { x: 0, y: 0 }
  let loadSeq = 0

  const api: Axie3D = {
    canvas,
    ready: false,
    loading: false,
    label: null,
    async load(spec) {
      const seq = ++loadSeq
      api.loading = true
      api.ready = false
      try {
        const mixer = await getAxieMixer()
        if (seq !== loadSeq) return false
        const has = (id: string) => Boolean((mixer.manifest.assets.parts as Record<string, unknown>)[id])
        const base = spec.kind === 'genes' ? mixer.decodeGenes(spec.genes).descriptor : spec.descriptor
        const descriptor = downgradeDescriptor(base, has, (m) => console.info(m))
        const next = (await mixer.create({
          descriptor,
          extensions: { quality: 'balanced', strict: false },
        })) as unknown as Character
        if (seq !== loadSeq) {
          next.dispose()
          return false
        }
        if (character) {
          scene.remove(character.wrapper)
          character.dispose()
        }
        character = next
        if (spec.kind === 'descriptor' && spec.gold) goldify(next.wrapper)
        next.setLocomotion?.('idle', 0)
        next.setMoveSpeed?.(0)
        scene.add(next.wrapper)
        next.update(0)
        frameCamera(camera, next.wrapper)
        api.label = spec.label || (spec.kind === 'genes' ? 'genes' : 'descriptor')
        api.ready = true
        resize()
        start()
        return true
      } catch (err) {
        console.warn('[axie3d] load failed', err)
        return false
      } finally {
        if (seq === loadSeq) api.loading = false
      }
    },
    setLean(x, y) {
      lean = { x, y }
    },
    pause() {
      paused = true
    },
    resume() {
      paused = false
      start()
    },
    renderNow() {
      tick(true)
    },
    snapshot(size = 512) {
      if (!character) return null
      const w = canvas.width
      const h = canvas.height
      renderer.setSize(size, size, false)
      camera.aspect = 1
      frameCamera(camera, character.wrapper)
      renderer.render(scene, camera)
      const url = canvas.toDataURL('image/png')
      renderer.setSize(w, h, false)
      camera.aspect = w / Math.max(1, h)
      frameCamera(camera, character.wrapper)
      return url
    },
    dispose() {
      cancelAnimationFrame(raf)
      raf = 0
      loadSeq++
      if (character) {
        scene.remove(character.wrapper)
        character.dispose()
        character = null
      }
      api.ready = false
      api.label = null
      window.removeEventListener('resize', resize)
      if (renderer !== firstRenderer) renderer.dispose()
      canvas.remove()
    },
  }

  function resize(): void {
    const rect = canvas.getBoundingClientRect()
    const w = Math.max(64, Math.round(rect.width || 220))
    const h = Math.max(64, Math.round(rect.height || 220))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    if (character) frameCamera(camera, character.wrapper)
  }

  function tick(force = false): void {
    if (!character) return
    const dt = clock.getDelta()
    if (!paused || force) {
      character.update(Math.min(dt, 0.1))
      // Gyro lean: rotate the character slightly toward the tilt
      character.wrapper.rotation.y = lean.x * 0.004
      character.wrapper.rotation.x = lean.y * 0.002
      renderer.render(scene, camera)
    }
  }

  function start(): void {
    if (raf) return
    const loop = () => {
      raf = requestAnimationFrame(loop)
      tick()
    }
    raf = requestAnimationFrame(loop)
  }

  window.addEventListener('resize', resize)
  return api
}
