import * as THREE from 'three';
export type AxieAvatarRenderMode = 'unity-skinned-only' | 'complete-character';
/**
 * Source-shaped avatar parameters from AxieAvatarRenderParams.cs.
 *
 * The mutable fields intentionally mirror Unity's serializable parameter object.
 * `viewCenter` is the local camera position despite the source comment calling it
 * a focal point: the implementation passes it as the eye of Matrix4x4.LookAt.
 */
export declare class AxieAvatarRenderParams {
    width: number;
    height: number;
    modelHeading: number;
    viewCenter: THREE.Vector3;
    viewDirection: THREE.Vector3;
    constructor(values?: Partial<AxieAvatarRenderParams>);
}
export interface AxieAvatarRenderOptions extends Partial<AxieAvatarRenderParams> {
    /**
     * Unity compatibility excludes the generated rigid MeshRenderer parts because
     * AxieCharacter3D.RenderAvatar enumerates SkinnedMeshRenderer only. The complete
     * mode is the explicit corrected production option.
     */
    readonly mode?: AxieAvatarRenderMode;
}
export interface AxieAvatarRenderResult {
    readonly target: THREE.WebGLRenderTarget;
    readonly camera: THREE.OrthographicCamera;
    readonly mode: AxieAvatarRenderMode;
    readonly renderedObjects: number;
    readonly omittedObjects: number;
}
/** Exact camera construction for the source local-space LookAt + Ortho contract. */
export declare function createAxieAvatarCamera(root: THREE.Object3D, options?: AxieAvatarRenderOptions): THREE.OrthographicCamera;
/**
 * Render the already assembled character into a caller-owned target.
 *
 * Renderer, model rotation and visibility state are restored in `finally`, so an
 * avatar capture cannot perturb the live playable character even if rendering
 * throws. The renderer uses the character's owned materials without cloning.
 */
export declare function renderAxieAvatar(renderer: THREE.WebGLRenderer, root: THREE.Object3D, target: THREE.WebGLRenderTarget, options?: AxieAvatarRenderOptions): AxieAvatarRenderResult;
//# sourceMappingURL=avatar.d.ts.map