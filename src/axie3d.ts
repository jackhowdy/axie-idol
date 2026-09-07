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
  BackSide,
  Box3,
  Clock,
  Color,
  ConeGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three'
import { MysticGammaCompositor } from '@jaatster/threejs-axie-mixer3d-public/rendering'
import {
  createAxieMixer3D,
  formatAxiePartAssetId,
  type AxieDescriptor,
  type AxiePartDescriptor,
} from '@jaatster/threejs-axie-mixer3d-public'
import type { ThreeAxieMixer3D, AxieMixerManifest } from '@jaatster/threejs-axie-mixer3d-public'

const MAX_PIXEL_RATIO = 2
const ASSET_BASE = '/assets/axie/'
/** Bump when the manifest or derived parts change; the pack is served with long cache headers. */
const PACK_VERSION = '7'

export type Axie3DSpec =
  | {
      kind: 'genes'
      genes: string
      label?: string
      stages?: Partial<Record<AxiePartDescriptor['type'], 1 | 2>>
      /** Marketplace body shape; 'Nightmare' switches to the white nightmare palette. */
      bodyShape?: string | null
    }
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
  renderer.toneMapping = NeutralToneMapping
  renderer.toneMappingExposure = 1
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO))
  if (!firstRenderer) firstRenderer = renderer
  return renderer
}

let mixerReady = false
/** True once the manifest is loaded, so callers can show a one-time warming message. */
export function isAxieMixerReady(): boolean {
  return mixerReady
}

/** Parse a pack part id such as S13_Beast04_L2_Eye into a descriptor part (null if malformed). */
export function parsePartId(id: string): AxiePartDescriptor | null {
  const m = /^S(\d{2})_([A-Za-z]+?)(\d{2})_L(\d)_(Eye|Ear|Mouth|Horn|Back|Tail)$/.exec(id.trim())
  if (!m) return null
  return {
    type: m[5].toLowerCase() as AxiePartDescriptor['type'],
    skin: Number(m[1]),
    class: m[2] as AxiePartDescriptor['class'],
    variant: Number(m[3]),
    level: Number(m[4]) as AxiePartDescriptor['level'],
  }
}

type DerivedProvenance = { parts: Record<string, unknown>; materials: string[]; textures: string[] }
type DerivedEntries = { parts: Record<string, unknown>; materials: Record<string, unknown>; textures: Record<string, unknown> }
type MutableAssets = { parts: Record<string, unknown>; materials: Record<string, unknown>; textures: Record<string, unknown> }
type MutableManifest = { assets: MutableAssets; creator: { partIdsByType: Record<string, string[]> } }

/**
 * The public mixer validates the pack against fixed counts (576 parts, 1088 textures, 1001 materials),
 * so our 30 derived variants (scripts/build_missing_parts.py) are lifted out of the manifest before
 * validation and merged back into the live catalog afterwards.
 */
async function loadManifestWithDerived(): Promise<{ manifest: MutableManifest; derived: DerivedEntries | null }> {
  const [manifest, prov] = await Promise.all([
    fetch(ASSET_BASE + 'manifest.json?v=' + PACK_VERSION).then((r) => {
      if (!r.ok) throw new Error(`manifest ${r.status}`)
      return r.json() as Promise<MutableManifest>
    }),
    fetch(ASSET_BASE + 'provenance/derived-parts.json?v=' + PACK_VERSION)
      .then((r) => (r.ok ? (r.json() as Promise<DerivedProvenance>) : null))
      .catch(() => null),
  ])
  if (!prov || !prov.parts) return { manifest, derived: null }
  const derived: DerivedEntries = { parts: {}, materials: {}, textures: {} }
  const assets = manifest.assets
  for (const id of Object.keys(prov.parts)) {
    if (!assets.parts[id]) continue
    derived.parts[id] = assets.parts[id]
    delete assets.parts[id]
    for (const list of Object.values(manifest.creator.partIdsByType)) {
      const i = list.indexOf(id)
      if (i >= 0) list.splice(i, 1)
    }
  }
  for (const id of prov.materials) {
    if (!assets.materials[id]) continue
    derived.materials[id] = assets.materials[id]
    delete assets.materials[id]
  }
  for (const id of prov.textures) {
    if (!assets.textures[id]) continue
    derived.textures[id] = assets.textures[id]
    delete assets.textures[id]
  }
  return { manifest, derived }
}

function mergeDerived(mixer: ThreeAxieMixer3D, derived: DerivedEntries): void {
  try {
    const live = mixer.manifest as unknown as MutableManifest
    Object.assign(live.assets.parts, derived.parts)
    Object.assign(live.assets.materials, derived.materials)
    Object.assign(live.assets.textures, derived.textures)
    for (const [id, part] of Object.entries(derived.parts)) {
      const type = (part as { descriptor: { type: string } }).descriptor.type
      const list = live.creator.partIdsByType[type]
      if (list && !list.includes(id)) list.push(id)
    }
    console.info('[axie3d] derived parts merged', Object.keys(derived.parts).length)
  } catch (err) {
    console.warn('[axie3d] could not merge derived parts (downgrade policy will apply)', err)
  }
}

/** The mixer is created once per page (manifest ~5 MB, cached by the browser). */
export function getAxieMixer(): Promise<ThreeAxieMixer3D> {
  if (!mixerPromise) {
    mixerPromise = loadManifestWithDerived()
      .then(({ manifest, derived }) =>
        createAxieMixer3D({
          manifest: manifest as unknown as AxieMixerManifest,
          renderer: firstRenderer || makeRenderer('axie3d-probe'),
          assetBaseUrl: ASSET_BASE,
          maxUnusedEntries: 24,
          onDiagnostic: (event) => {
            if (event.severity === 'error') console.error('[axie3d]', event)
            else if (event.severity === 'warning') console.warn('[axie3d]', event)
          },
        }).then((mixer) => {
          if (derived) mergeDerived(mixer, derived)
          return mixer
        }),
      )
      .then((mixer) => {
        mixerReady = true
        return mixer
      })
      .catch((err) => {
        mixerPromise = null
        throw err
      })
  }
  return mixerPromise
}

/** The genes decoder emits every part at stage 1; apply the marketplace's per-slot stage. */
export function withStages(
  descriptor: AxieDescriptor,
  stages?: Partial<Record<AxiePartDescriptor['type'], 1 | 2>>,
): AxieDescriptor {
  if (!stages) return descriptor
  return {
    ...descriptor,
    parts: descriptor.parts.map((p) => {
      const level = stages[p.type]
      return level && level !== p.level ? { ...p, level } : p
    }),
  }
}

/**
 * Nightmare-body Axies: the pack has no nightmare mesh, but it ships a white "<class>-nightmare"
 * palette (the mixer's own nightmare-body showcase uses the normal body with that palette).
 */
export function withNightmareBody(descriptor: AxieDescriptor, bodyShape: string | null | undefined, mixer: ThreeAxieMixer3D): AxieDescriptor {
  if (bodyShape !== 'Nightmare') return descriptor
  const variants = (mixer.manifest.creator as unknown as { colorVariants: { index: number; key: string }[] }).colorVariants
  const current = variants[descriptor.colorVariant]?.key || ''
  const cls = current.split('-')[0]
  const target = variants.find((v) => v.key === `${cls}-nightmare`)
  if (!target) return descriptor
  return { ...descriptor, body: 'normal', colorVariant: target.index }
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

/**
 * Nightmare body thorns. The pack has no Nightmare body mesh; Sky Mavis's art shows the white body
 * with a handful of curved thorns in the class accent colour: two large ones on the crown sweeping
 * back, one on each flank, small ones low on the front. Each thorn is seated on the nearest skinned
 * body vertex in its direction, hooks toward the rear, and is parented to the spine bone so it rides
 * the idle animation.
 */
type ThornSlot = { dir: [number, number, number]; len: number; rad: number; bend: number }
const THORN_SLOTS: ThornSlot[] = [
  { dir: [-0.7, 0.7, 0.3], len: 0.3, rad: 0.075, bend: 0.5 }, // crown left, above the eye
  { dir: [0.75, 0.65, 0.2], len: 0.28, rad: 0.07, bend: 0.5 }, // crown right
  { dir: [-0.95, 0.4, -0.15], len: 0.22, rad: 0.06, bend: 0.5 }, // left flank, sweeping up and back
  { dir: [0.95, 0.35, -0.2], len: 0.22, rad: 0.06, bend: 0.5 }, // right flank
  { dir: [-0.7, -0.5, 0.5], len: 0.15, rad: 0.05, bend: 0.25 }, // low front left
  { dir: [0.72, -0.55, 0.42], len: 0.15, rad: 0.05, bend: 0.25 }, // low front right
  { dir: [-0.4, 0.45, -0.85], len: 0.22, rad: 0.06, bend: 0.35 }, // rear left
  { dir: [0.45, 0.4, -0.82], len: 0.22, rad: 0.06, bend: 0.35 }, // rear right
]

/** A tapered thorn along +Y that hooks toward -Z near the tip. */
function thornGeometry(rad: number, len: number, bend: number): ConeGeometry {
  const geo = new ConeGeometry(rad, len, 12, 10)
  const pos = geo.attributes.position
  const p = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    const t = (p.y + len / 2) / len // 0 at the base, 1 at the tip
    const taper = Math.pow(1 - t, 0.75) / Math.max(1e-3, 1 - t) // sharper tip than a plain cone
    if (t < 0.999) {
      p.x *= taper
      p.z *= taper
    }
    p.z -= bend * len * t * t
    pos.setXYZ(i, p.x, p.y, p.z)
  }
  geo.computeVertexNormals()
  return geo
}

function worldPos(root: Object3D, name: string): Vector3 | null {
  let out: Vector3 | null = null
  root.traverse((o) => {
    if (!out && o.name === name) out = o.getWorldPosition(new Vector3())
  })
  return out
}

/**
 * The pack's body shader skins vertices in its own space, so mesh vertex positions cannot be read
 * back reliably. The body is approximated by an ellipsoid fitted from the part joints: eye (front),
 * tail (back), ears (sides), top horn (top) and feet (bottom).
 */
function bodyEllipsoid(root: Object3D): { center: Vector3; radii: Vector3 } | null {
  const eye = worldPos(root, 'Root_Eye_M_JNT')
  const tail = worldPos(root, 'Root_Tail_M_JNT')
  const earL = worldPos(root, 'Root_Ear_L_JNT')
  const earR = worldPos(root, 'Root_Ear_R_JNT')
  const top = worldPos(root, 'Root_Horn_T_JNT') || worldPos(root, 'Root_Horn_M_JNT')
  const foot = worldPos(root, 'Fool_L_JNT') || worldPos(root, 'Toe_L_JNT')
  if (!eye || !tail || !earL || !earR || !top) return null
  const bottomY = foot ? foot.y : 0
  // the ears, eye and tail attach inside the silhouette; the body bulges past them
  const halfW = Math.abs(earL.x - earR.x) * 0.5 * 1.32
  const minZ = tail.z - 0.24
  const maxZ = eye.z + 0.1
  const topY = top.y * 0.98
  return {
    center: new Vector3((earL.x + earR.x) * 0.5, (topY + bottomY) * 0.5, (minZ + maxZ) * 0.5),
    radii: new Vector3(halfW, (topY - bottomY) * 0.5, (maxZ - minZ) * 0.5),
  }
}

export function addNightmareSpikes(root: Object3D, colorHex: string): void {
  root.updateWorldMatrix(true, true)
  const fit = bodyEllipsoid(root)
  if (!fit) {
    console.warn('[axie3d] thorns: body joints not found')
    return
  }
  const { center, radii } = fit
  const size = radii.clone().multiplyScalar(2)
  const height = size.y
  if (location.search.includes('dev=1')) {
    console.info('[axie3d] thorns center=' + center.toArray().map((n) => n.toFixed(2)).join(',') + ' radii=' + radii.toArray().map((n) => n.toFixed(2)).join(','))
  }
  if (height < 0.2) return
  let spine: Object3D | null = null
  root.traverse((o) => {
    if (!spine && o.name === 'Spine01_JNT') spine = o
  })
  const anchor: Object3D = spine ?? root
  const group = new Group()
  group.name = 'NightmareSpikes'
  group.matrixAutoUpdate = false
  group.matrix.copy(new Matrix4().copy(anchor.matrixWorld).invert())
  const fill = new MeshToonMaterial({ color: new Color(colorHex) })
  const line = new MeshBasicMaterial({ color: 0x151515, side: BackSide })
  const up = new Vector3(0, 1, 0)
  const back = new Vector3(0, 0, -1)
  for (const slot of THORN_SLOTS) {
    const dir = new Vector3(...slot.dir).normalize()
    const seat = new Vector3(dir.x * radii.x, dir.y * radii.y, dir.z * radii.z).multiplyScalar(1.0).add(center)
    const normal = new Vector3(dir.x / radii.x, dir.y / radii.y, dir.z / radii.z).normalize()
    const len = height * slot.len
    const rad = height * slot.rad
    const cone = new Mesh(thornGeometry(rad, len, slot.bend), fill)
    cone.position.copy(seat).addScaledVector(normal, len * 0.42)
    cone.quaternion.setFromUnitVectors(up, normal)
    // roll the hook so it sweeps toward the rear
    const localBack = back.clone().applyQuaternion(cone.quaternion.clone().invert())
    const roll = Math.atan2(localBack.x, -localBack.z)
    cone.rotateY(roll)
    const outline = new Mesh(thornGeometry(rad * 1.16, len * 1.04, slot.bend), line)
    outline.position.copy(cone.position).addScaledVector(normal, -len * 0.015)
    outline.quaternion.copy(cone.quaternion)
    group.add(outline, cone)
  }
  anchor.add(group)
}

const VIEW_DIR = new Vector3(0.62, 0.14, 1).normalize()

/** Bounds of the posed character: part meshes plus the skinned body vertices. */
function characterBounds(root: Object3D): Box3 {
  const box = new Box3()
  root.traverse((o) => {
    const m = o as Mesh & { isSkinnedMesh?: boolean }
    if (!m.isMesh || m.isSkinnedMesh || o.name.includes('AxieOutline')) return
    box.union(new Box3().setFromObject(o))
  })
  const fit = bodyEllipsoid(root)
  if (fit) {
    box.expandByPoint(fit.center.clone().sub(fit.radii))
    box.expandByPoint(fit.center.clone().add(fit.radii))
  }
  if (box.isEmpty()) box.setFromObject(root)
  return box
}

function frameCamera(camera: PerspectiveCamera, root: Object3D): void {
  root.updateWorldMatrix(true, true)
  const box = characterBounds(root)
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  center.y += size.y * 0.02
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1
  const dist = (radius / Math.tan((camera.fov * Math.PI) / 360)) * 1.22
  camera.position.copy(center).addScaledVector(VIEW_DIR, dist)
  camera.near = Math.max(0.05, dist / 100)
  camera.far = dist * 10
  camera.lookAt(center)
  camera.updateProjectionMatrix()
}

export function createAxie3D(id = 'axie3d'): Axie3D {
  const renderer = makeRenderer(id)
  const canvas = renderer.domElement
  const scene = new Scene()
  const camera = new PerspectiveCamera(35, 1, 0.1, 100)
  // Lighting follows the mixer demo (hemisphere + warm key) with a camera-side fill so white
  // Nightmare bodies read white instead of grey; the pack's toon shaders respond to these lights.
  scene.add(new HemisphereLight('#f6fffc', '#c8d4d0', 2.2))
  scene.add(new AmbientLight('#ffffff', 0.5))
  const key = new DirectionalLight('#fff3da', 2.6)
  key.position.set(4, 7, 5)
  scene.add(key)
  const fill = new DirectionalLight('#ffffff', 1.4)
  fill.position.set(-4, 1.5, 6)
  scene.add(fill)
  const compositor = new MysticGammaCompositor()
  const draw = () => {
    // Mystic parts carry Unity-gamma transparent streams; the compositor keeps their blending exact.
    let ok = false
    try {
      ok = compositor.render(renderer, scene, camera)
    } catch {
      ok = false
    }
    if (!ok) renderer.render(scene, camera)
  }

  const clock = new Clock()
  let character: Character | null = null
  let raf = 0
  let hiddenTimer = 0
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
        const base =
          spec.kind === 'genes'
            ? withNightmareBody(withStages(mixer.decodeGenes(spec.genes).descriptor, spec.stages), spec.bodyShape, mixer)
            : spec.descriptor
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
        if (spec.kind === 'genes' && spec.bodyShape === 'Nightmare') {
          const variants = (mixer.manifest.creator as unknown as { colorVariants: { primary2: string }[] }).colorVariants
          const accent = variants[descriptor.colorVariant]?.primary2 || 'ff4363'
          next.update(0)
          addNightmareSpikes(next.wrapper, '#' + accent)
        }
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
      draw()
      const url = canvas.toDataURL('image/png')
      renderer.setSize(w, h, false)
      camera.aspect = w / Math.max(1, h)
      frameCamera(camera, character.wrapper)
      return url
    },
    dispose() {
      cancelAnimationFrame(raf)
      raf = 0
      if (hiddenTimer) window.clearInterval(hiddenTimer)
      hiddenTimer = 0
      loadSeq++
      if (character) {
        scene.remove(character.wrapper)
        character.dispose()
        character = null
      }
      api.ready = false
      api.label = null
      window.removeEventListener('resize', resize)
      compositor.dispose()
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
      draw()
    }
  }

  function start(): void {
    if (raf) return
    const loop = () => {
      raf = requestAnimationFrame(loop)
      tick()
    }
    raf = requestAnimationFrame(loop)
    // Background tabs pause requestAnimationFrame; keep a slow render alive so snapshots and
    // returning to the tab never show an empty canvas.
    if (!hiddenTimer) {
      hiddenTimer = window.setInterval(() => {
        if (document.visibilityState === 'hidden') tick(true)
      }, 1000)
    }
  }

  window.addEventListener('resize', resize)
  return api
}
