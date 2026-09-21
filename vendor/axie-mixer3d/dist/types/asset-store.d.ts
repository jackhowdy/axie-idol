import * as THREE from 'three';
import { type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AxieDiagnosticEvent } from './diagnostics.js';
import type { AxieTextureManifest } from './manifest.js';
import type { AxieQualityProfile } from './quality.js';
import { type AxieMipFetcher } from './unity-mip-chain.js';
import type { AxieAssetLease, AxieAssetStore, AxieLoadedGlb } from './runtime.js';
export interface AxieAsyncLoader<T> {
    loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<T>;
}
export interface RefCountedAxieAssetStoreOptions {
    readonly gltfLoader?: AxieAsyncLoader<GLTF>;
    readonly textureLoader?: AxieAsyncLoader<THREE.Texture>;
    /** KTX2Loader after detectSupport(renderer); intentionally not constructed here. */
    readonly ktx2Loader?: AxieAsyncLoader<THREE.Texture>;
    /** Enables byte-exact BC1/BC3 transport when the renderer supports it. */
    readonly renderer?: Pick<THREE.WebGLRenderer, 'extensions'>;
    readonly fetcher?: AxieMipFetcher;
    readonly preferRawUnityS3tc?: boolean;
    /** @deprecated Use preferRawUnityS3tc. */
    readonly preferRawUnityBc1?: boolean;
    readonly resolveUrl?: (url: string) => string;
    readonly onDiagnostic?: (event: AxieDiagnosticEvent) => void;
    readonly maxUnusedEntries?: number;
}
/**
 * Shared immutable-source cache. Scene instances and character materials are
 * never stored here; an active lease pins their geometry/texture sources.
 */
export declare class RefCountedAxieAssetStore implements AxieAssetStore {
    #private;
    constructor(options?: RefCountedAxieAssetStoreOptions);
    acquireGlb(url: string, signal?: AbortSignal): Promise<AxieAssetLease<AxieLoadedGlb>>;
    acquireTexture(texture: AxieTextureManifest, quality: AxieQualityProfile, signal?: AbortSignal): Promise<AxieAssetLease<THREE.Texture>>;
    diagnostics(): {
        entries: number;
        activeLeases: number;
        inFlightLoads: number;
        hits: number;
        misses: number;
        evictions: number;
        estimatedBytes: number;
    };
    evictUnused(maxEntries?: number): void;
    dispose(): void;
}
//# sourceMappingURL=asset-store.d.ts.map