import * as THREE from 'three';
import type { AxieShaderFidelity } from './manifest.js';
import type { AxieMaterialContext, AxieMaterialFactory } from './runtime.js';
export declare const AXIE_MIXER_V4_SHADER_ID = "ac091e58a97d048649b904d4e60d5aea";
export declare const AXIE_MIXER_V4_SHADER_NAME = "AxieMixer3D/S_Axie_Mixer_V4";
export interface AxieRuntimeMaterialBundle {
    readonly surface: THREE.Material;
    readonly outline?: THREE.Material;
    readonly depth?: THREE.Material;
    readonly distance?: THREE.Material;
    /** Whether the source shader family authors a ShadowCaster-equivalent pass. */
    readonly castShadow?: boolean;
    readonly fidelity: AxieShaderFidelity;
    readonly fallbackUsed: boolean;
}
export interface AxieMaterialBundleFactory extends AxieMaterialFactory {
    createBundle(context: AxieMaterialContext): AxieRuntimeMaterialBundle;
}
export declare class UnsupportedAxieShaderError extends Error {
    readonly materialId: string;
    readonly shaderId: string;
    readonly shaderName: string;
    readonly name = "UnsupportedAxieShaderError";
    constructor(materialId: string, shaderId: string, shaderName: string);
}
/** Exact base-V4 implementation; every Mystic/VFX shader is an extension point. */
export declare class ExactAxieBaseV4MaterialFactory implements AxieMaterialBundleFactory {
    #private;
    create(context: AxieMaterialContext): import("./base-v4-material.js").AxieMixerV4Material;
    createGeometryOutline(context: AxieMaterialContext): import("./base-v4-material.js").AxieMixerV4OutlineMaterial | undefined;
    createBundle(context: AxieMaterialContext): AxieRuntimeMaterialBundle;
}
export declare const AXIE_EXACT_BASE_V4_MATERIAL_FACTORY: AxieMaterialBundleFactory;
export declare function hasAxieMaterialBundleFactory(factory: AxieMaterialFactory): factory is AxieMaterialBundleFactory;
//# sourceMappingURL=base-v4-runtime.d.ts.map