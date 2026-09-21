import * as THREE from 'three';
type UnityGammaSourceMaterial = THREE.ShaderMaterial & {
    readonly uniforms: Record<string, THREE.IUniform>;
};
/** Realm-safe public contract used by exact-source Gamma material adapters. */
export declare function isUnityGammaCompositorTargetMaterial(material: THREE.Material): material is UnityGammaSourceMaterial;
export interface MysticGammaCompositorHooks {
    /** Runs before any color draw; use it for URP-style depth/normal inputs. */
    readonly beforeColor?: () => void;
    /** Runs on the encoded-Gamma target after transparent streams, before present. */
    readonly beforePresent?: (encodedGammaTarget: THREE.WebGLRenderTarget) => void;
    /** Force the encoded path even when no transparent Mystic material is visible. */
    readonly forceEncodedGamma?: boolean;
}
/** True only when a visible hierarchy contains an active source Gamma target. */
export declare function sceneRequiresUnityGammaComposition(root: THREE.Object3D): boolean;
/**
 * Preserves Unity Gamma-project SrcAlpha blending for audited Mystic materials
 * and source PostProcess overlays.
 *
 * Opaque/non-Mystic content is rendered to SRGB8. Its stored encoded bytes are
 * reconstructed in an RGBA8 NoColorSpace accumulator, depth is rebuilt with
 * the original vertex programs, ordered transparent Mystic surfaces render in
 * raw-Gamma mode, and `beforePresent` can add the PostProcess overlay in that
 * same domain. The accumulator is decoded once for the real destination.
 */
export declare class MysticGammaCompositor {
    #private;
    constructor(options?: {
        readonly strictGlobalTransparentOrder?: boolean;
        readonly onDiagnostic?: (message: string, materials: readonly THREE.Material[]) => void;
        readonly samples?: number;
        readonly maxSamplePixels?: number;
    });
    setSamples(samples: number): this;
    get lastRoute(): "direct" | "direct-fallback" | "encoded";
    get disposed(): boolean;
    render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, output?: THREE.WebGLRenderTarget | null, hooks?: MysticGammaCompositorHooks): boolean;
    dispose(): void;
}
export {};
//# sourceMappingURL=mystic-gamma-compositor.d.ts.map