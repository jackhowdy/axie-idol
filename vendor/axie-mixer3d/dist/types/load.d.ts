import type * as THREE from 'three';
import { type AxieAssetLocatorOptions } from './asset-locator.js';
import type { AxieMixerManifest } from './manifest.js';
import { ThreeAxieMixer3D, type ThreeAxieMixer3DOptions } from './mixer3d.js';
export type AxieManifestValidationMode = 'schema' | 'source-pinned';
export interface ValidateAxieManifestOptions {
    readonly mode?: AxieManifestValidationMode;
    readonly expectedSourceCommit?: string;
}
export interface LoadAxieManifestOptions extends AxieAssetLocatorOptions, ValidateAxieManifestOptions {
    readonly manifestUrl?: string;
    readonly fetcher?: typeof fetch;
    readonly signal?: AbortSignal;
}
export interface CreateAxieMixer3DOptions extends AxieAssetLocatorOptions, ValidateAxieManifestOptions, Omit<ThreeAxieMixer3DOptions, 'manifest' | 'assetStoreOptions' | 'animationLoader'> {
    readonly manifest?: AxieMixerManifest;
    readonly manifestUrl?: string;
    readonly fetcher?: typeof fetch;
    readonly signal?: AbortSignal;
    readonly renderer?: Pick<THREE.WebGLRenderer, 'extensions'>;
    readonly maxUnusedEntries?: number;
    readonly preferRawUnityS3tc?: boolean;
}
export declare function validateAxieMixerManifest(value: unknown, options?: ValidateAxieManifestOptions): asserts value is AxieMixerManifest;
export declare function loadAxieManifest(options?: LoadAxieManifestOptions): Promise<AxieMixerManifest>;
/** High-level, relocation-safe production constructor for normal consumers. */
export declare function createAxieMixer3D(options?: CreateAxieMixer3DOptions): Promise<ThreeAxieMixer3D>;
//# sourceMappingURL=load.d.ts.map