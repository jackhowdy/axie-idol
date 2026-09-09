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
  BufferAttribute,
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
  NoToneMapping,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  CanvasTexture,
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
import type { JointScreen } from './wardrobe'

const MAX_PIXEL_RATIO = 2
const ASSET_BASE = '/assets/axie/'
/** Bump when the manifest or derived parts change; the pack is served with long cache headers. */
const PACK_VERSION = '20'

export type Axie3DSpec =
  | {
      kind: 'genes'
      genes: string
      label?: string
      stages?: Partial<Record<AxiePartDescriptor['type'], 1 | 2>>
      /** Marketplace body shape; 'Nightmare' switches to the white nightmare palette. */
      bodyShape?: string | null
      /** Number of Mystic parts (Sky Mavis draws a Mystic body pod when >= 1 and the body is not Nightmare). */
      mysticParts?: number
      /** Axie id, printed on the Mystic pod's hatch like the 2D art. */
      axieId?: string
      /** Axie class, for the hatch icon. */
      axieClass?: string | null
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
  /**
   * Wardrobe anchors projected into this handle's canvas pixels (`canvas.width/height`), or null
   * before the model is loaded. Consumers scale to CSS pixels with clientWidth/clientHeight.
   */
  jointScreenPositions: () => JointScreen | null
  /** Run a callback right after every rendered frame (one slot; pass null to clear). */
  onFrame: (cb: (() => void) | null) => void
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
  renderer.toneMapping = NoToneMapping
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

/**
 * Pack corrections, verified part by part against Sky Mavis's marketplace icons (7 Sep 2026, see
 * README "Japan parts"). The public pack ships stage-2 Japan assets only for the japan-02 set
 * (Yen, Karimata, Dango, Umaibo, Hamaya, Koinobori) and points every other stage-2 Japan slot at
 * those same files, while the real stage-2 art for the japan-01 and japan-03 sets (Kabuki-2,
 * Dokuganryu-2, Geisha-2, Kawaii-2, Kendama-2, Origami-2, Yakitori-2, Omatsuri-2, Maki-2, Mon-2,
 * Maiko-2) sits under the normal skin of the same variant. Kawaii (stage 1) shares Cute Bunny's
 * art. Map those ids to the asset that matches the 2D.
 */
export type PartOverride = { skin?: number; level?: 1 | 2; scale?: number }
export const PART_ASSET_OVERRIDES: Record<string, PartOverride> = {
  S03_Bug08_L1_Mouth: { skin: 0 }, // Kawaii (= Cute Bunny art)
  S03_Reptile10_L2_Eye: { skin: 0 }, // Kabuki-2
  S03_Reptile08_L2_Eye: { skin: 0 }, // Dokuganryu-2
  S03_Aquatic10_L2_Mouth: { skin: 0 }, // Geisha-2
  S03_Bug08_L2_Mouth: { skin: 0 }, // Kawaii-2
  S03_Bird04_L2_Back: { skin: 0 }, // Origami-2
  S03_Plant04_L2_Back: { skin: 0 }, // Yakitori-2
  S03_Bird10_L2_Tail: { skin: 0 }, // Omatsuri-2
  S03_Bug06_L2_Tail: { skin: 0 }, // Maki-2
  // no stage-2 asset exists for these; the stage-1 Japan mesh is the same object, drawn larger
  S03_Plant04_L2_Horn: { level: 1, scale: 1.35 }, // Kendama-2
  S03_Beast04_L2_Horn: { level: 1, scale: 1.3 }, // japan-03 horn, stage 2
  S03_Bug12_L2_Ear: { level: 1, scale: 1.3 }, // Mon-2
  S03_Plant08_L2_Ear: { level: 1, scale: 1.3 }, // Maiko-2
}

/** Mesh-name prefixes that need a post-assembly scale (from overrides with a scale). */
export function overrideScales(descriptor: AxieDescriptor): Map<string, number> {
  const out = new Map<string, number>()
  for (const p of descriptor.parts) {
    const o = PART_ASSET_OVERRIDES[formatAxiePartAssetId(p)]
    if (o?.scale) out.set(formatAxiePartAssetId({ ...p, skin: o.skin ?? p.skin, level: o.level ?? p.level }), o.scale)
  }
  return out
}

/** Scale the meshes of enlarged parts about their attachment joint (they are children of the joint). */
export function applyOverrideScales(root: Object3D, scales: Map<string, number>): void {
  if (!scales.size) return
  root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh) return
    for (const [prefix, s] of scales) if (o.name.startsWith(prefix)) m.scale.multiplyScalar(s)
  })
}

export function applyPartOverrides(descriptor: AxieDescriptor, log: (msg: string) => void = () => {}): AxieDescriptor {
  return {
    ...descriptor,
    parts: descriptor.parts.map((p) => {
      const id = formatAxiePartAssetId(p)
      const o = PART_ASSET_OVERRIDES[id]
      if (!o) return p
      const next = { ...p, skin: o.skin ?? p.skin, level: o.level ?? p.level }
      log(`[axie3d] override ${id} -> ${formatAxiePartAssetId(next)}${o.scale ? ' x' + o.scale : ''}`)
      return next
    }),
  }
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

/**
 * A tapered thorn along +Y that hooks toward -Z near the tip, with the 2D art's gradient baked into
 * vertex colours: the accent colour at the base darkening slightly into the body, a lighter tint
 * toward the tip, and a pale highlight strip along the front-facing edge.
 */
function thornGeometry(rad: number, len: number, bend: number, accent: Color): ConeGeometry {
  const geo = new ConeGeometry(rad, len, 14, 12)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const p = new Vector3()
  const base = accent.clone().offsetHSL(0, 0.05, -0.08)
  const tip = accent.clone().offsetHSL(0.01, -0.05, 0.22)
  const highlight = accent.clone().offsetHSL(0.02, -0.25, 0.4)
  const c = new Color()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    const t = (p.y + len / 2) / len // 0 at the base, 1 at the tip
    const angle = Math.atan2(p.x, p.z) // around the thorn, 0 = facing +Z (front)
    const taper = Math.pow(1 - t, 0.75) / Math.max(1e-3, 1 - t)
    if (t < 0.999) {
      p.x *= taper
      p.z *= taper
    }
    p.z -= bend * len * t * t
    pos.setXYZ(i, p.x, p.y, p.z)
    c.copy(base).lerp(tip, Math.pow(t, 1.3))
    // highlight strip on the front edge, fading toward the base
    const strip = Math.max(0, Math.cos(angle - 0.6)) ** 6 * (0.25 + 0.75 * t)
    c.lerp(highlight, strip * 0.85)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3))
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
  const accent = new Color(colorHex)
  // unlit like the 2D art; the gradient lives in the vertex colours
  const fill = new MeshBasicMaterial({ vertexColors: true })
  const line = new MeshBasicMaterial({ color: 0x151515, side: BackSide })
  const up = new Vector3(0, 1, 0)
  const back = new Vector3(0, 0, -1)
  for (const slot of THORN_SLOTS) {
    const dir = new Vector3(...slot.dir).normalize()
    const seat = new Vector3(dir.x * radii.x, dir.y * radii.y, dir.z * radii.z).multiplyScalar(1.0).add(center)
    const normal = new Vector3(dir.x / radii.x, dir.y / radii.y, dir.z / radii.z).normalize()
    const len = height * slot.len
    const rad = height * slot.rad
    const cone = new Mesh(thornGeometry(rad, len, slot.bend, accent), fill)
    cone.position.copy(seat).addScaledVector(normal, len * 0.42)
    cone.quaternion.setFromUnitVectors(up, normal)
    // roll the hook so it sweeps toward the rear
    const localBack = back.clone().applyQuaternion(cone.quaternion.clone().invert())
    const roll = Math.atan2(localBack.x, -localBack.z)
    cone.rotateY(roll)
    const outline = new Mesh(thornGeometry(rad * 1.16, len * 1.04, slot.bend, accent), line)
    outline.position.copy(cone.position).addScaledVector(normal, -len * 0.015)
    outline.quaternion.copy(cone.quaternion)
    group.add(outline, cone)
  }
  anchor.add(group)
}

// default view direction lives in CAMERA (dirX, dirY, 1)
const DEV_VIEWS: Record<string, Vector3> = {
  rear: new Vector3(-0.8, 0.2, -1).normalize(),
  side: new Vector3(1, 0.1, 0.15).normalize(),
  front: new Vector3(0.15, 0.1, 1).normalize(),
}
function viewDir(): Vector3 {
  if (location.search.includes('dev=1')) {
    const m = /view=([a-z]+)/.exec(location.hash)
    if (m && DEV_VIEWS[m[1]]) return DEV_VIEWS[m[1]]
  }
  return new Vector3(devNum('yawx', CAMERA.dirX), devNum('yawy', CAMERA.dirY), 1).normalize()
}

/**
 * Mystic body pod. Sky Mavis's 2D art gives every Axie with a Mystic part (and a non-Nightmare body)
 * a white mechanical casing over the rear half of the body: a diagonal seam from the upper rear
 * down to the belly, a gold port near the belly, a raised hatch with the class icon and the Axie's
 * id, a pipe bar with orange tips and a few orange rivets. The pack has no such mesh, so this is a
 * tilted rear half-ellipsoid with a painted texture, parented to the spine like the thorns.
 */
const CLASS_ICON_COLOUR: Record<string, string> = {
  beast: '#f7a11a',
  aquatic: '#00b8d9',
  plant: '#6cc32b',
  bug: '#ff5341',
  bird: '#ff8bb8',
  reptile: '#c26be0',
  dawn: '#8fd8ff',
  dusk: '#2f8fa0',
  mech: '#8c9aa8',
}

function drawClassIcon(ctx: CanvasRenderingContext2D, cls: string, x: number, y: number, r: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = CLASS_ICON_COLOUR[cls] || '#6cc32b'
  ctx.fillStyle = ctx.strokeStyle
  ctx.lineWidth = r * 0.22
  ctx.lineCap = 'round'
  switch (cls) {
    case 'beast': {
      // paw: pad + three toes
      ctx.beginPath()
      ctx.ellipse(0, r * 0.35, r * 0.55, r * 0.42, 0, 0, Math.PI * 2)
      ctx.fill()
      for (const [dx, dy] of [
        [-0.62, -0.25],
        [0, -0.55],
        [0.62, -0.25],
      ]) {
        ctx.beginPath()
        ctx.arc(dx * r, dy * r, r * 0.24, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'bird': {
      // feather
      ctx.beginPath()
      ctx.moveTo(-r * 0.6, r * 0.8)
      ctx.quadraticCurveTo(-r * 0.2, -r * 0.2, r * 0.7, -r * 0.8)
      ctx.quadraticCurveTo(r * 0.4, r * 0.3, -r * 0.6, r * 0.8)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(-r * 0.6, r * 0.8)
      ctx.lineTo(r * 0.5, -r * 0.6)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = r * 0.1
      ctx.stroke()
      break
    }
    case 'aquatic': {
      // drop
      ctx.beginPath()
      ctx.moveTo(0, -r * 0.9)
      ctx.bezierCurveTo(r * 0.9, r * 0.1, r * 0.55, r * 0.9, 0, r * 0.9)
      ctx.bezierCurveTo(-r * 0.55, r * 0.9, -r * 0.9, r * 0.1, 0, -r * 0.9)
      ctx.fill()
      break
    }
    case 'bug': {
      // ladybird body with a centre line
      ctx.beginPath()
      ctx.ellipse(0, 0, r * 0.7, r * 0.85, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = r * 0.12
      ctx.beginPath()
      ctx.moveTo(0, -r * 0.8)
      ctx.lineTo(0, r * 0.8)
      ctx.stroke()
      break
    }
    case 'reptile': {
      // scale / diamond
      ctx.beginPath()
      ctx.moveTo(0, -r * 0.9)
      ctx.lineTo(r * 0.8, 0)
      ctx.lineTo(0, r * 0.9)
      ctx.lineTo(-r * 0.8, 0)
      ctx.closePath()
      ctx.fill()
      break
    }
    default: {
      // sprout: stem + two leaves (plant, dawn, dusk, mech fall back here with their colour)
      ctx.beginPath()
      ctx.moveTo(0, r * 0.9)
      ctx.lineTo(0, -r * 0.2)
      ctx.stroke()
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(0, -r * 0.15)
        ctx.quadraticCurveTo(s * r * 0.55, -r * 0.55, s * r * 0.85, -r * 0.35)
        ctx.quadraticCurveTo(s * r * 0.5, -r * 0.05, 0, -r * 0.15)
        ctx.fill()
      }
    }
  }
  ctx.restore()
}

/** Paint the pod texture. u wraps around the pod (0 = seam edge at the belly side), v runs top to bottom. */
function mysticPodTexture(cls: string, axieId: string): CanvasTexture {
  const W = 1024
  const H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  // base: warm white with a cooler lower band
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#f8f9f7')
  g.addColorStop(0.55, '#e9ecea')
  g.addColorStop(1, '#cfd5d3')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // panel seams
  ctx.strokeStyle = 'rgba(120,130,128,0.55)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(0, H * 0.36)
  ctx.bezierCurveTo(W * 0.3, H * 0.31, W * 0.7, H * 0.31, W, H * 0.36)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(W * 0.5, 0)
  ctx.lineTo(W * 0.5, H)
  ctx.stroke()
  // the two sides of the pod (left flank = u 0.05..0.45, right flank = u 0.55..0.95)
  // hatch sits a little behind the seam on each flank (u 0.17 / 0.83), the port between hatch and seam
  for (const [side, dir] of [
    [0.17, 1],
    [0.83, -1],
  ] as [number, number][]) {
    const cx = W * side
    // raised hatch with the class icon and id
    ctx.fillStyle = '#dfe4e2'
    ctx.strokeStyle = '#8e9694'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.roundRect(cx - 100, H * 0.56, 200, 150, 36)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#f4f6f5'
    ctx.beginPath()
    ctx.arc(cx, H * 0.68, 50, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#a7aeac'
    ctx.lineWidth = 4
    ctx.stroke()
    drawClassIcon(ctx, cls, cx, H * 0.68, 28)
    ctx.fillStyle = CLASS_ICON_COLOUR[cls] || '#6cc32b'
    ctx.font = 'bold 30px "Segoe UI", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(axieId, cx, H * 0.68 + 82)
    // gold port near the belly
    const px = cx - dir * 120
    const py = H * 0.86
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(px, py, 64, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#9aa19f'
    ctx.lineWidth = 6
    ctx.stroke()
    const pg = ctx.createRadialGradient(px - 12, py - 14, 8, px, py, 46)
    pg.addColorStop(0, '#fff2a8')
    pg.addColorStop(0.5, '#f7c948')
    pg.addColorStop(1, '#d9950e')
    ctx.fillStyle = pg
    ctx.beginPath()
    ctx.arc(px, py, 46, 0, Math.PI * 2)
    ctx.fill()
    // pipe bar with orange tips
    ctx.fillStyle = '#c9cfcd'
    ctx.beginPath()
    ctx.roundRect(cx + (dir > 0 ? -20 : -160), H * 0.92, 180, 26, 13)
    ctx.fill()
    ctx.strokeStyle = '#8e9694'
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.fillStyle = '#f08a2e'
    ctx.beginPath()
    ctx.roundRect(cx + (dir > 0 ? -20 : -160), H * 0.92, 26, 26, 13)
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(cx + (dir > 0 ? 134 : -6), H * 0.92, 26, 26, 13)
    ctx.fill()
    // rivets
    ctx.fillStyle = '#f08a2e'
    for (const [dx, dy, w, h] of [
      [-210, H * 0.7, 22, 12],
      [-80, H * 0.97, 26, 10],
      [165, H * 0.8, 12, 22],
      [130, H * 0.58, 20, 10],
    ]) {
      ctx.beginPath()
      ctx.roundRect(cx + dir * dx, dy, w, h, 4)
      ctx.fill()
    }
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export function addMysticPod(root: Object3D, cls: string, axieId: string): void {
  root.updateWorldMatrix(true, true)
  const fit = bodyEllipsoid(root)
  if (!fit) return
  const { center, radii } = fit
  let spine: Object3D | null = null
  root.traverse((o) => {
    if (!spine && o.name === 'Spine01_JNT') spine = o
  })
  const anchor: Object3D = spine ?? root
  const group = new Group()
  group.name = 'MysticPod'
  group.matrixAutoUpdate = false
  group.matrix.copy(new Matrix4().copy(anchor.matrixWorld).invert())
  // rear half of a sphere (three.js phi from PI to 2PI is the -z side), cut below the crown and
  // above the feet, then scaled to the body ellipsoid and tilted so the seam runs diagonally
  const geo = new SphereGeometry(1, 48, 32, Math.PI - 0.3, Math.PI + 0.6, Math.PI * 0.28, Math.PI * 0.6)
  const tex = mysticPodTexture(cls.toLowerCase(), axieId)
  const fill = new MeshToonMaterial({ map: tex })
  const line = new MeshBasicMaterial({ color: 0x1c1c1c, side: BackSide })
  const pod = new Mesh(geo, fill)
  const outline = new Mesh(geo, line)
  for (const m of [pod, outline]) {
    m.position.copy(center).add(new Vector3(0, -radii.y * 0.02, -radii.z * 0.06))
    m.scale.set(radii.x * 1.22, radii.y * 1.1, radii.z * 1.16)
    m.rotation.x = -0.4 // tilt: top edge further back, belly edge further forward
  }
  outline.scale.multiplyScalar(1.022)
  group.add(outline, pod)
  anchor.add(group)
}

/**
 * Eye parts whose texture carries an alpha mask (Papi and friends) render the masked area as a
 * flat patch in the body colour; the 2D art draws them as lines directly on the body. Enable the
 * shader's alpha clip on those eye materials so only the drawn lines remain.
 */
export function clipMaskedEyes(root: Object3D, manifest: AxieMixerManifest): void {
  const parts = manifest.assets.parts as unknown as Record<string, { descriptor: { type: string }; rigs: readonly { materialId: string }[] }>
  const mats = manifest.assets.materials as unknown as Record<string, { textures: Record<string, string> }>
  const texs = manifest.assets.textures as unknown as Record<string, { hasAlpha?: boolean }>
  root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh || o.name.includes('AxieOutline')) return
    const id = o.name.split('__')[0]
    const part = parts[id]
    if (!part || part.descriptor.type !== 'eye') return
    const masked = part.rigs.some((r) => texs[mats[r.materialId]?.textures?._MainTex]?.hasAlpha)
    if (!masked) return
    const mat = m.material as unknown as { uniforms?: Record<string, { value: unknown }> }
    if (mat.uniforms?.uAlphaClipEnabled) mat.uniforms.uAlphaClipEnabled.value = 1
  })
}

/**
 * Palette-true shading. Sky Mavis's 2D art shades the body with the palette's "shaded1" colour,
 * which for some variants is a different hue (dawn-04: cyan body, lilac-pink shadow). The pack's
 * V4 shader darkens with one grey multiplier instead, so on the body material we swap that
 * multiplier for the per-channel ratio shaded1 / primary1. For most palettes the ratio is a plain
 * ~0.75 darkening, so nothing else changes.
 */
export function applyPaletteShadow(root: Object3D, manifest: AxieMixerManifest, colorVariant: number): void {
  const variants = (manifest.creator as unknown as { colorVariants: { primary1: string; shaded1: string }[] }).colorVariants
  const v = variants[colorVariant]
  if (!v) return
  const p = new Color('#' + v.primary1)
  const s = new Color('#' + v.shaded1)
  const ratio = new Color(
    Math.min(1.6, s.r / Math.max(p.r, 0.02)),
    Math.min(1.6, s.g / Math.max(p.g, 0.02)),
    Math.min(1.6, s.b / Math.max(p.b, 0.02)),
  )
  const seen = new Set<unknown>()
  root.traverse((o) => {
    const m = o as Mesh & { isSkinnedMesh?: boolean }
    if (!m.isMesh || o.name.includes('AxieOutline')) return
    const mat = m.material as unknown as {
      fragmentShader?: string
      uniforms?: Record<string, { value: unknown }>
      needsUpdate?: boolean
      userData?: { axieMixerV4?: unknown }
    }
    if (!mat.fragmentShader || !mat.uniforms || !mat.userData?.axieMixerV4 || seen.has(mat)) return
    seen.add(mat)
    if (!mat.fragmentShader.includes('vec3(uShadowMultiplier)')) return
    // 2D shades the lower ~40% with a soft horizontal edge; the pack lights from a fixed
    // view-space direction with a hard edge. Light everything from straight above instead.
    mat.fragmentShader = mat.fragmentShader.replace('vec3(15.0, 80.0, -30.0)', 'vec3(4.0, 80.0, 14.0)')
    mat.fragmentShader = mat.fragmentShader.replace('unityHlslSmoothstep(-0.25, 0.55, fakeLightDot)', 'unityHlslSmoothstep(-16.0, 4.0, fakeLightDot)')
    if (m.isSkinnedMesh) {
      // the body takes the palette's shaded1 hue; parts keep the pack's grey multiplier
      mat.fragmentShader = mat.fragmentShader.replace('vec3(uShadowMultiplier)', 'uShadowTint')
      mat.fragmentShader = mat.fragmentShader.replace('uniform float uShadowMultiplier;', 'uniform float uShadowMultiplier;\n  uniform vec3 uShadowTint;')
      mat.uniforms.uShadowTint = { value: ratio }
    }
    mat.needsUpdate = true
  })
}

/**
 * Face proportions. Sky Mavis's 2D draws eyes and mouths larger on the body than the pack's
 * meshes; the parts sit on their own joints (Root_Eye_M_JNT, Root_Mouth_M_JNT), so scaling the
 * meshes about the joint enlarges them in place. Calibrated against the 2D one Axie at a time;
 * dev mode can override with #eye=1.3&mouth=1.2 in the hash.
 */
export const FACE_SCALE = { eye: 1.25, mouth: 1.15, ear: 1.0 }

/**
 * Body proportions. The 2D Axie is a squat bean roughly 1.5x longer than tall; the pack's body is
 * nearly round. The character wrapper is squashed vertically and stretched along its length, and
 * every rigid part mesh is counter-scaled so horns, ears and backs keep their own shape while
 * riding the squashed body. Dev hash: #sy=0.82&sz=1.2&fov=20&yawx=1.1&yawy=0.1
 */
export const BODY_SHAPE = { sy: 0.82, sz: 1.25, sx: 1.0 }
export const CAMERA = { fov: 20, dirX: 0.75, dirY: 0.1, dist: 1.06 }

function devNum(name: string, fallback: number): number {
  if (!location.search.includes('dev=1')) return fallback
  const m = new RegExp(name + '=(-?[0-9.]+)').exec(location.hash)
  return m ? Number(m[1]) : fallback
}

export function applyBodyShape(root: Object3D): void {
  const sx = devNum('sx', BODY_SHAPE.sx)
  const sy = devNum('sy', BODY_SHAPE.sy)
  const sz = devNum('sz', BODY_SHAPE.sz)
  if (sx === 1 && sy === 1 && sz === 1) return
  root.scale.set(sx, sy, sz)
  root.updateWorldMatrix(true, true)
  // counter-scale rigid parts in world axes: parent each part mesh's local scale by the inverse of
  // the wrapper scale expressed in the mesh's own frame (approximation: use the bone's rotation)
  const inv = new Vector3(1 / sx, 1 / sy, 1 / sz)
  root.traverse((o) => {
    const m = o as Mesh & { isSkinnedMesh?: boolean }
    if (!m.isMesh || m.isSkinnedMesh) return
    // world-axis inverse scale mapped into the mesh's local axes via its parent's world rotation
    const q = new Matrix4().extractRotation(o.parent ? o.parent.matrixWorld : root.matrixWorld)
    const ax = new Vector3(1, 0, 0).applyMatrix4(q)
    const ay = new Vector3(0, 1, 0).applyMatrix4(q)
    const az = new Vector3(0, 0, 1).applyMatrix4(q)
    const f = (v: Vector3) => Math.abs(v.x) * inv.x + Math.abs(v.y) * inv.y + Math.abs(v.z) * inv.z
    m.scale.multiply(new Vector3(f(ax), f(ay), f(az)))
  })
}

function faceScales(): { eye: number; mouth: number; ear: number } {
  const out = { ...FACE_SCALE }
  if (location.search.includes('dev=1')) {
    for (const k of ['eye', 'mouth', 'ear'] as const) {
      const m = new RegExp(k + '=([0-9.]+)').exec(location.hash)
      if (m) out[k] = Number(m[1])
    }
  }
  return out
}

export function applyFaceScale(root: Object3D): void {
  const s = faceScales()
  root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh) return
    const n = o.name
    if (/_L[12]_Eye__/.test(n) && s.eye !== 1) m.scale.multiplyScalar(s.eye)
    else if (/_L[12]_Mouth__/.test(n) && s.mouth !== 1) m.scale.multiplyScalar(s.mouth)
    else if (/_L[12]_Ear__/.test(n) && s.ear !== 1) m.scale.multiplyScalar(s.ear)
  })
}

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
  camera.fov = devNum('fov', CAMERA.fov)
  const dist = (radius / Math.tan((camera.fov * Math.PI) / 360)) * devNum('dist', CAMERA.dist)
  camera.position.copy(center).addScaledVector(viewDir(), dist)
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
  scene.add(new HemisphereLight('#f6fffc', '#c8d4d0', 1.7))
  scene.add(new AmbientLight('#ffffff', 0.35))
  const key = new DirectionalLight('#fff3da', 2.0)
  key.position.set(4, 7, 5)
  scene.add(key)
  const fill = new DirectionalLight('#ffffff', 1.0)
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
  /** Wardrobe joints, resolved once per loaded character — traversing the rig every frame is waste. */
  let jointCache = new Map<string, Object3D | null>()
  const projectVec = new Vector3()
  let frameCb: (() => void) | null = null
  let raf = 0
  let hiddenTimer = 0
  let lastFrame = 0
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
        const descriptor = downgradeDescriptor(applyPartOverrides(base, (m) => console.info(m)), has, (m) => console.info(m))
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
        jointCache = new Map()
        if (location.search.includes('dev=1')) {
          const rows: string[] = []
          next.wrapper.traverse((o) => {
            const m = o as Mesh
            if (!m.isMesh) return
            const mat = m.material as unknown as { uniforms?: Record<string, { value: unknown }>; name?: string }
            const u = mat.uniforms
            if (!u) return
            const hex = (c: unknown) => (c && typeof (c as Color).getHexString === 'function' ? (c as Color).getHexString() : String(c))
            rows.push(o.name.slice(0, 40) + ' P=' + hex(u.uPrimaryColor?.value) + ' S=' + hex(u.uSecondaryColor?.value) + ' clip=' + String(u.uAlphaClipEnabled?.value))
          })
          console.info('[axie3d] colours ' + rows.join(' | '))
        }
        applyOverrideScales(next.wrapper, overrideScales(base))
        applyFaceScale(next.wrapper)
        applyBodyShape(next.wrapper)
        clipMaskedEyes(next.wrapper, mixer.manifest)
        applyPaletteShadow(next.wrapper, mixer.manifest, descriptor.colorVariant)
        if (spec.kind === 'descriptor' && spec.gold) goldify(next.wrapper)
        if (spec.kind === 'genes' && spec.bodyShape !== 'Nightmare' && (spec.mysticParts ?? 0) > 0) {
          next.update(0)
          addMysticPod(next.wrapper, spec.axieClass || 'plant', spec.axieId || '')
        }
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
    jointScreenPositions,
    onFrame(cb) {
      frameCb = cb
    },
    dispose() {
      frameCb = null
      jointCache = new Map()
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

  /** The named rig joint, cached per loaded character (misses are cached too). */
  function jointObject(name: string): Object3D | null {
    const hit = jointCache.get(name)
    if (hit !== undefined) return hit
    let found: Object3D | null = null
    character?.wrapper.traverse((o) => {
      if (!found && o.name === name) found = o
    })
    jointCache.set(name, found)
    return found
  }

  /** World position of a joint in this canvas's pixels (top-left origin), or null. */
  function projectJoint(o: Object3D | null): { x: number; y: number } | null {
    if (!o) return null
    const v = o.getWorldPosition(projectVec).project(camera)
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) return null
    return { x: ((v.x + 1) / 2) * canvas.width, y: ((1 - v.y) / 2) * canvas.height }
  }

  /**
   * Wardrobe anchors in canvas pixels. `scale` is the projected ear span / 100 — the unit every
   * anchor in wardrobe.ts is measured in, so items track the camera framing and the pixel ratio.
   */
  function jointScreenPositions(): JointScreen | null {
    if (!character) return null
    const head = projectJoint(jointObject('Root_Horn_T_JNT') || jointObject('Root_Horn_M_JNT'))
    const eye = projectJoint(jointObject('Root_Eye_M_JNT'))
    const spine = projectJoint(jointObject('Spine01_JNT'))
    if (!head || !eye || !spine) return null
    const earL = projectJoint(jointObject('Root_Ear_L_JNT'))
    const earR = projectJoint(jointObject('Root_Ear_R_JNT'))
    const span = earL && earR ? Math.hypot(earL.x - earR.x, earL.y - earR.y) : 0
    // no ear joints (never seen on the pack's rigs): the camera frames the body to fill the canvas,
    // where the ear span measures a little over half the width
    const scale = span > 1 ? span / 100 : (canvas.width * 0.55) / 100
    return {
      head: { ...head, scale },
      eyeL: { ...eye, scale },
      eyeR: { ...eye, scale },
      neck: { x: (eye.x + spine.x) / 2, y: (eye.y + spine.y) / 2, scale },
      back: { ...spine, scale },
    }
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
      // Overlays pinned to the rig (the wardrobe sprite) redraw here, after the joints have moved.
      if (frameCb) {
        try {
          frameCb()
        } catch (err) {
          console.warn('[axie3d] frame callback failed', err)
          frameCb = null
        }
      }
    }
  }

  function start(): void {
    if (raf) return
    const loop = () => {
      raf = requestAnimationFrame(loop)
      lastFrame = performance.now()
      tick()
    }
    raf = requestAnimationFrame(loop)
    // Background tabs pause requestAnimationFrame; keep a slow render alive so snapshots and
    // returning to the tab never show an empty canvas.
    if (!hiddenTimer) {
      hiddenTimer = window.setInterval(() => {
        // background tabs and hidden panes pause requestAnimationFrame without always reporting hidden
        if (performance.now() - lastFrame > 800) tick(true)
      }, 500)
    }
  }

  window.addEventListener('resize', resize)
  return api
}
