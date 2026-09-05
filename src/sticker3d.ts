/**
 * Alive 3D mascot sticker overlay (Three.js + GLB).
 * Falls back to PNG path in main.ts if createSticker3D returns null.
 * Loads one mascot GLB at a time; call setModel() to swap and dispose the previous.
 */
import {
  AmbientLight,
  AnimationMixer,
  Box3,
  Clock,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type AnimationAction,
  type Object3D,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const MAX_PIXEL_RATIO = 2

export type Sticker3D = {
  canvas: HTMLCanvasElement
  ready: boolean
  loading: boolean
  /** Current mascot model URL (relative), or null. */
  modelUrl: string | null
  setLean: (leanX: number, leanY: number) => void
  /** Swap the alive mascot GLB (Idle preferred). Disposes previous mesh/animations. */
  setModel: (url: string) => Promise<boolean>
  /** Load a static equipment GLB and parent it near the character (hand-ish offset). Pass null to clear. */
  setEquipment: (url: string | null) => Promise<boolean>
  pause: () => void
  resume: () => void
  dispose: () => void
  renderNow: () => void
}

function pickClipName(names: string[]): string | null {
  const preferred = ['Idle', 'Greeting', 'Walk', 'Run']
  for (const p of preferred) {
    const hit = names.find((n) => n === p || n.toLowerCase() === p.toLowerCase())
    if (hit) return hit
  }
  return names[0] ?? null
}

function frameModel(camera: PerspectiveCamera): void {
  camera.position.set(0, 0.05, 2.35)
  camera.near = 0.1
  camera.far = 20
  camera.fov = 32
  camera.lookAt(0, 0.05, 0)
  camera.updateProjectionMatrix()
}

/** Center model at origin (slightly above) and uniform-scale to fit FOV. */
function fitModelToFrame(model: Object3D, camera: PerspectiveCamera): { radius: number } {
  model.position.set(0, 0, 0)
  model.scale.setScalar(1)
  model.updateMatrixWorld(true)

  const box = new Box3().setFromObject(model)
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6)

  const dist = camera.position.length()
  const vFov = (camera.fov * Math.PI) / 180
  const target = 2 * Math.tan(vFov / 2) * dist * 0.78
  const scale = target / maxDim
  model.scale.setScalar(scale)

  model.updateMatrixWorld(true)
  box.setFromObject(model)
  box.getCenter(center)
  model.position.set(-center.x, -center.y + 0.06, -center.z)
  model.updateMatrixWorld(true)

  const radius = box.getSize(size).length() * 0.5
  return { radius }
}

/**
 * Scale a static prop and park it at a loose hand-ish offset in character-local space.
 * Measures the prop detached so Box3 is not skewed by the parent transform.
 */
function fitPropOnCharacter(prop: Object3D, charHeight: number): void {
  const parent = prop.parent
  parent?.remove(prop)

  prop.position.set(0, 0, 0)
  prop.rotation.set(0, 0.4, 0.22)
  prop.scale.setScalar(1)
  prop.updateMatrixWorld(true)

  const box = new Box3().setFromObject(prop)
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6)
  const s = (Math.max(charHeight, 0.08) * 0.48) / maxDim
  prop.scale.setScalar(s)

  prop.position.set(
    -center.x * s + charHeight * 0.34,
    -center.y * s + charHeight * 0.04,
    -center.z * s + charHeight * 0.14,
  )

  parent?.add(prop)
}

export async function createSticker3D(
  host: HTMLElement,
  initialUrl: string,
): Promise<Sticker3D | null> {
  const canvas = document.createElement('canvas')
  canvas.id = 'sticker3d'
  canvas.setAttribute('aria-hidden', 'true')
  host.appendChild(canvas)

  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    })
  } catch (err) {
    console.warn('[axie-idol] WebGL unavailable', err)
    canvas.remove()
    return null
  }

  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO))

  const scene = new Scene()
  const camera = new PerspectiveCamera(32, 1, 0.1, 20)
  const root = new Group()
  scene.add(root)

  scene.add(new AmbientLight(0xffffff, 0.55))
  scene.add(new HemisphereLight(0xfff0e0, 0x405070, 0.55))
  const key = new DirectionalLight(0xffffff, 1.15)
  key.position.set(1.4, 2.2, 1.8)
  scene.add(key)
  const fill = new DirectionalLight(0xa8c8ff, 0.35)
  fill.position.set(-1.6, 0.8, -0.6)
  scene.add(fill)

  const shadowMat = new MeshBasicMaterial({
    color: new Color(0x000000),
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  })
  const shadow = new Mesh(new PlaneGeometry(1.1, 0.55), shadowMat)
  shadow.rotation.x = -Math.PI / 2
  shadow.position.set(0, -0.45, 0)
  scene.add(shadow)

  const clock = new Clock()
  const loader = new GLTFLoader()
  let mixer: AnimationMixer | null = null
  let action: AnimationAction | null = null
  let model: Object3D | null = null
  let currentUrl: string | null = null
  let charHeight = 0.8
  let propObject: Object3D | null = null
  let equipSeq = 0
  let modelSeq = 0
  let leanX = 0
  let leanY = 0
  let raf = 0
  let running = false
  let disposed = false
  let ready = false
  let loading = false

  const cssSize = (): number => {
    const vmin = Math.min(window.innerWidth, window.innerHeight) * 0.01
    return Math.min(220, Math.max(140, 42 * vmin))
  }

  const resize = (): void => {
    const w = cssSize()
    const h = Math.round(w * 1.15)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  frameModel(camera)

  const renderFrame = (): void => {
    if (disposed) return
    const dt = clock.getDelta()
    mixer?.update(dt)
    if (model) {
      model.rotation.y = leanX
      model.rotation.x = leanY
      shadow.scale.set(1 + Math.abs(leanX) * 0.15, 1 + Math.abs(leanY) * 0.1, 1)
      shadowMat.opacity = 0.22 + Math.min(0.12, (Math.abs(leanX) + Math.abs(leanY)) * 0.2)
    }
    renderer.render(scene, camera)
  }

  const loop = (): void => {
    if (!running || disposed) return
    renderFrame()
    raf = requestAnimationFrame(loop)
  }

  function disposeObject3D(obj: Object3D): void {
    obj.traverse((o) => {
      const m = o as Mesh
      if (m.isMesh) {
        m.geometry?.dispose()
        const mat = m.material
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else (mat as MeshBasicMaterial | undefined)?.dispose?.()
      }
    })
  }

  function clearEquipment(): void {
    if (!propObject) return
    propObject.removeFromParent()
    disposeObject3D(propObject)
    propObject = null
  }

  function clearModel(): void {
    clearEquipment()
    action?.stop()
    mixer?.stopAllAction()
    mixer = null
    action = null
    if (model) {
      model.removeFromParent()
      disposeObject3D(model)
      model = null
    }
    currentUrl = null
    ready = false
  }

  function disposeInternal(): void {
    if (disposed) return
    disposed = true
    running = false
    cancelAnimationFrame(raf)
    clearModel()
    scene.traverse((o) => {
      const m = o as Mesh
      if (m.isMesh) {
        m.geometry?.dispose()
        const mat = m.material
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else (mat as MeshBasicMaterial | undefined)?.dispose?.()
      }
    })
    renderer.dispose()
    canvas.remove()
  }

  async function loadModel(url: string): Promise<boolean> {
    const seq = ++modelSeq
    loading = true
    clearModel()
    // Clear canvas while loading so the previous mascot doesn't linger.
    renderer.clear(true, true, true)
    renderFrame()

    try {
      const gltf = await loader.loadAsync(url)
      if (seq !== modelSeq || disposed) {
        disposeObject3D(gltf.scene)
        return false
      }

      model = gltf.scene
      model.traverse((o) => {
        const m = o as Mesh
        if (m.isMesh) {
          m.frustumCulled = false
        }
      })
      root.add(model)
      const { radius } = fitModelToFrame(model, camera)
      model.updateMatrixWorld(true)
      const fitted = new Box3().setFromObject(model).getSize(new Vector3())
      charHeight = Math.max(fitted.y, radius * 0.9, 0.2)
      shadow.position.set(0, -Math.min(0.55, radius * 0.55), 0)
      shadow.scale.setScalar(Math.max(0.85, Math.min(1.35, radius * 1.1)))

      const names = gltf.animations.map((a) => a.name)
      const clipName = pickClipName(names)
      if (clipName) {
        const clip = gltf.animations.find((a) => a.name === clipName)
        if (clip) {
          mixer = new AnimationMixer(model)
          action = mixer.clipAction(clip)
          action.setLoop(LoopRepeat, Infinity)
          action.play()
          console.info('[axie-idol] 3D sticker animation', clipName, url)
        }
      } else {
        console.info('[axie-idol] 3D sticker loaded (no clips)', url)
      }

      currentUrl = url
      ready = true
      loading = false
      if (!running) {
        running = true
        clock.start()
        loop()
      }
      renderFrame()
      return true
    } catch (err) {
      if (seq === modelSeq) loading = false
      console.warn('[axie-idol] GLB load failed', url, err)
      return false
    }
  }

  const ok = await loadModel(initialUrl)
  if (disposed) {
    disposeInternal()
    return null
  }
  if (!ok) {
    window.removeEventListener('resize', onResize)
    disposeInternal()
    return null
  }

  function onResize(): void {
    if (disposed) return
    resize()
    renderFrame()
  }
  window.addEventListener('resize', onResize)

  return {
    canvas,
    get ready() {
      return ready
    },
    get loading() {
      return loading
    },
    get modelUrl() {
      return currentUrl
    },
    setLean(x: number, y: number) {
      leanX = x * 0.012
      leanY = y * 0.01
    },
    async setModel(url: string) {
      if (disposed) return false
      if (currentUrl === url && ready && model) return true
      return loadModel(url)
    },
    async setEquipment(url: string | null) {
      const seq = ++equipSeq
      clearEquipment()
      if (!url || !model || disposed || !ready) return false
      try {
        const gltf = await loader.loadAsync(url)
        if (seq !== equipSeq || disposed || !model) {
          disposeObject3D(gltf.scene)
          return false
        }
        const prop = gltf.scene
        prop.traverse((o) => {
          const m = o as Mesh
          if (m.isMesh) m.frustumCulled = false
        })
        model.add(prop)
        fitPropOnCharacter(prop, charHeight)
        propObject = prop
        renderFrame()
        console.info('[axie-idol] equipped', url)
        return true
      } catch (err) {
        console.warn('[axie-idol] equipment load failed', err)
        return false
      }
    },
    pause() {
      running = false
      cancelAnimationFrame(raf)
      clock.getDelta()
    },
    resume() {
      if (disposed || !ready) return
      if (!running) {
        running = true
        clock.start()
        loop()
      }
    },
    renderNow() {
      renderFrame()
    },
    dispose() {
      window.removeEventListener('resize', onResize)
      disposeInternal()
    },
  }
}
