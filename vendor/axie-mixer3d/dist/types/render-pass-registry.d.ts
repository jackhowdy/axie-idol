import * as THREE from 'three';
export declare const AXIE_OPAQUE_RENDER_QUEUE_MIN = 0;
export declare const AXIE_OPAQUE_RENDER_QUEUE_MAX = 2500;
export interface AxieDepthNormalsPassMetadata {
    readonly lightMode: 'DepthNormals' | 'DepthNormalsOnly';
    readonly cull: 'Back';
    readonly zTest: 'LEqual';
    readonly zWrite: true;
    readonly alphaClipEnabled: boolean;
    readonly alphaThreshold: number;
    readonly alphaClipThreshold: number;
}
export interface AxieSourceRenderPassMetadata {
    readonly schemaVersion: 1;
    readonly sourceShaderGuid: string;
    readonly sourceShaderName: string;
    readonly sourceShaderPath: string;
    readonly sourceRenderQueue: number;
    readonly depthNormals?: AxieDepthNormalsPassMetadata;
}
/**
 * Registers immutable Unity pass metadata on a translated material. Rendering
 * stages must consult this source contract instead of inferring pass support
 * from whichever Three.js material class happens to implement the surface.
 */
export declare function registerAxieSourceRenderPasses<T extends THREE.Material>(material: T, metadata: AxieSourceRenderPassMetadata): T;
export declare function readAxieSourceRenderPasses(material: THREE.Material): AxieSourceRenderPassMetadata | undefined;
export declare function isAxieDepthNormalsSourceEligible(material: THREE.Material): boolean;
//# sourceMappingURL=render-pass-registry.d.ts.map