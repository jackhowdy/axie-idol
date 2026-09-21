import * as THREE from 'three';
import type { AxieTextureManifest } from './manifest.js';
export interface AxieTextureLikeLoader {
    loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<THREE.Texture>;
}
export interface AxieMipFetchResponse {
    readonly ok: boolean;
    readonly status: number;
    arrayBuffer(): Promise<ArrayBuffer>;
}
export type AxieMipFetcher = (url: string) => Promise<AxieMipFetchResponse>;
export interface AxieUnityMipChainLoadOptions {
    readonly textureLoader: AxieTextureLikeLoader;
    readonly renderer?: Pick<THREE.WebGLRenderer, 'extensions'>;
    readonly fetcher?: AxieMipFetcher;
    readonly resolveUrl?: (url: string) => string;
    readonly preferRawS3tc?: boolean;
    /** @deprecated Use preferRawS3tc. */
    readonly preferRawBc1?: boolean;
}
export interface AxieLoadedUnityMipChain {
    readonly texture: THREE.Texture;
    readonly transport: 'bc1-gpu' | 'bc3-gpu' | 'png-rgba8';
}
export declare function supportsAxieUnityBc1MipChain(renderer: Pick<THREE.WebGLRenderer, 'extensions'> | undefined, colorSpace: AxieTextureManifest['colorSpace']): boolean;
export declare const supportsAxieUnityS3tcMipChain: typeof supportsAxieUnityBc1MipChain;
/**
 * Loads Unity-authored mip levels. BC1/BC3 are retained byte-for-byte when the
 * renderer exposes the matching transfer-aware extension; otherwise every
 * authored level is supplied explicitly as lossless RGBA8 PNG.
 */
export declare function loadAxieUnityMipChain(texture: AxieTextureManifest, options: AxieUnityMipChainLoadOptions): Promise<AxieLoadedUnityMipChain | undefined>;
//# sourceMappingURL=unity-mip-chain.d.ts.map