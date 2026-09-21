import * as THREE from 'three';
import type { AxieMaterialBundleFactory, AxieRuntimeMaterialBundle } from './base-v4-runtime.js';
import type { AxieMaterialContext } from './runtime.js';
import { type MysticShaderDefinition } from './mystic-shader-registry.js';
import type { MysticMaterialBundle, MysticMaterialFactoryOptions, MysticMaterialSchema, MysticSourceCatalog, MysticShaderSourceSchema } from './mystic-types.js';
/** Exact schema used by Unity's `new Material(shader)` source-only probes. */
export declare function createMysticSourceDefaultMaterialSchema(shader: MysticShaderSourceSchema, id?: string): MysticMaterialSchema;
export declare class MysticSourceMaterial extends THREE.ShaderMaterial {
    #private;
    readonly sourceSchema: MysticMaterialSchema;
    readonly shaderDefinition: MysticShaderDefinition;
    constructor(sourceSchema: MysticMaterialSchema, shaderDefinition: MysticShaderDefinition, uniforms: Record<string, THREE.IUniform>, autoMainLight: boolean);
    onBeforeRender(_renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void;
    setTime(seconds: number): void;
    setBodyColors(primary: THREE.ColorRepresentation, secondary: THREE.ColorRepresentation): void;
}
/**
 * Realm-safe identity check for source-faithful Mystic materials. Vite HMR and
 * split bundles can evaluate this module more than once, so `instanceof`
 * cannot be used at renderer boundaries.
 */
export declare function isMysticSourceMaterial(material: THREE.Material): material is MysticSourceMaterial;
/** Advances every animated Mystic mesh material under a character root. */
export declare function setMysticMaterialTime(root: THREE.Object3D, seconds: number): number;
export interface MysticSourceMaterialFactoryOptions {
    readonly catalog?: MysticSourceCatalog;
}
/** Strict factory for all ten audited Mystic/VFX source shaders. */
export declare class MysticSourceMaterialFactory {
    #private;
    constructor(options?: MysticSourceMaterialFactoryOptions);
    get catalog(): MysticSourceCatalog;
    getSchema(idOrGuid: string): MysticMaterialSchema | undefined;
    create(idOrGuid: string, options: MysticMaterialFactoryOptions): MysticMaterialBundle;
    createFromSchema(schema: MysticMaterialSchema, options: MysticMaterialFactoryOptions): MysticMaterialBundle;
    dispose(): void;
}
export declare const AXIE_MYSTIC_MATERIAL_FACTORY: MysticSourceMaterialFactory;
/** Axie assembler adapter. Unknown shader/material IDs throw explicitly. */
export declare class ExactAxieMysticMaterialFactory implements AxieMaterialBundleFactory {
    #private;
    readonly sourceFactory: MysticSourceMaterialFactory;
    constructor(sourceFactory?: MysticSourceMaterialFactory);
    create(context: AxieMaterialContext): THREE.ShaderMaterial;
    createGeometryOutline(context: AxieMaterialContext): THREE.ShaderMaterial | undefined;
    createBundle(context: AxieMaterialContext): AxieRuntimeMaterialBundle;
}
export declare const AXIE_EXACT_MYSTIC_MATERIAL_FACTORY: AxieMaterialBundleFactory;
/** Routes core V4 plus all ten Mystic/VFX GUIDs without a generic fallback. */
export declare class ExactAxieProductionMaterialFactory implements AxieMaterialBundleFactory {
    #private;
    readonly base: AxieMaterialBundleFactory;
    readonly mystic: AxieMaterialBundleFactory;
    constructor(base?: AxieMaterialBundleFactory, mystic?: AxieMaterialBundleFactory);
    create(context: AxieMaterialContext): THREE.Material;
    createGeometryOutline(context: AxieMaterialContext): THREE.Material | undefined;
    createBundle(context: AxieMaterialContext): AxieRuntimeMaterialBundle;
}
export declare const AXIE_EXACT_PRODUCTION_MATERIAL_FACTORY: AxieMaterialBundleFactory;
//# sourceMappingURL=mystic-material-factory.d.ts.map