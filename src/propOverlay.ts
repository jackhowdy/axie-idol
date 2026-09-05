/**
 * Lightweight on-demand prop overlay for PNG-sticker fallback.
 * Small WebGL canvas that follows the sticker transform with a hand-ish CSS offset.
 */
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Mesh,
  type Object3D,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const MAX_PIXEL_RATIO = 1.5

export type PropOverlay = {
  canvas: HTMLCanvasElement
  ready: boolean
  setUrl: (url: string | null) => Promise<boolean>
  dispose: () => void
  renderNow: () => void
}

function disposeObject3D(obj: Object3D): void {
  obj.traverse((o) => {
    const m = o as Mesh
    if (m.isMesh) {
      m.geometry?.dispose()
      const mat = m.material
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else (mat as { dispose?: () => void } | undefined)?.dispose?.()
    }
  })
}

function frameProp(prop: Object3D, camera: PerspectiveCamera): void {
  prop.position.set(0, 0, 0)
  prop.rotation.set(0.15, 0.55, 0.1)
  prop.scale.setScalar(1)
  prop.updateMatrixWorld(true)

  const box = new Box3().setFromObject(prop)
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6)

  const dist = 2.1
  camera.position.set(0.15, 0.1, dist)
  camera.lookAt(0, 0.05, 0)
  const vFov = (camera.fov * Math.PI) / 180
  const target = 2 * Math.tan(vFov / 2) * dist * 0.72
  const s = target / maxDim
  prop.scale.setScalar(s)
  prop.position.set(-center.x * s, -center.y * s + 0.04, -center.z * s)
}

export function createPropOverlay(host: HTMLElement): PropOverlay | null {
  const canvas = document.createElement('canvas')
  canvas.id = 'prop-overlay'
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
      powerPreference: 'low-power',
    })
  } catch (err) {
    console.warn('[axie-idol] prop overlay WebGL unavailable', err)
    canvas.remove()
    return null
  }

  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO))

  const scene = new Scene()
  const camera = new PerspectiveCamera(30, 1, 0.05, 20)
  scene.add(new AmbientLight(0xffffff, 0.65))
  scene.add(new HemisphereLight(0xfff0e0, 0x405070, 0.45))
  const key = new DirectionalLight(0xffffff, 1.05)
  key.position.set(1.2, 1.8, 1.5)
  scene.add(key)

  let prop: Object3D | null = null
  let loadSeq = 0
  let disposed = false
  let ready = false

  const cssSize = (): number => {
    const vmin = Math.min(window.innerWidth, window.innerHeight) * 0.01
    return Math.min(110, Math.max(72, 22 * vmin))
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

  const renderFrame = (): void => {
    if (disposed) return
    renderer.render(scene, camera)
  }

  const clearProp = (): void => {
    if (!prop) return
    scene.remove(prop)
    disposeObject3D(prop)
    prop = null
    ready = false
    renderFrame()
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
    async setUrl(url: string | null) {
      const seq = ++loadSeq
      clearProp()
      canvas.hidden = !url
      if (!url || disposed) return false
      try {
        const gltf = await new GLTFLoader().loadAsync(url)
        if (seq !== loadSeq || disposed) {
          disposeObject3D(gltf.scene)
          return false
        }
        prop = gltf.scene
        prop.traverse((o) => {
          const m = o as Mesh
          if (m.isMesh) m.frustumCulled = false
        })
        scene.add(prop)
        frameProp(prop, camera)
        ready = true
        canvas.hidden = false
        renderFrame()
        return true
      } catch (err) {
        console.warn('[axie-idol] prop overlay load failed', err)
        return false
      }
    },
    renderNow() {
      renderFrame()
    },
    dispose() {
      if (disposed) return
      disposed = true
      window.removeEventListener('resize', onResize)
      clearProp()
      renderer.dispose()
      canvas.remove()
    },
  }
}
