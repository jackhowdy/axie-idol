import * as THREE from 'three';
import type { AxieTextureManifest } from './manifest.js';
export interface AxieTextureSampling {
    readonly minFilter: THREE.MinificationTextureFilter;
    readonly magFilter: THREE.MagnificationTextureFilter;
}
/**
 * Exact WebGL/Three mapping of Unity TextureImporter.filterMode.
 *
 * Unity Bilinear performs bilinear filtering within one mip level, so its
 * mipmapped WebGL equivalent is LINEAR_MIPMAP_NEAREST. Trilinear alone blends
 * across adjacent mip levels (LINEAR_MIPMAP_LINEAR).
 */
export declare function resolveAxieTextureSampling(texture: Pick<AxieTextureManifest, 'filterMode' | 'mipmaps'>): AxieTextureSampling;
//# sourceMappingURL=texture-sampling.d.ts.map