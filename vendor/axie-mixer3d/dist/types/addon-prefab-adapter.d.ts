import * as THREE from 'three';
import { MysticSourceMaterialFactory } from './mystic-material-factory.js';
import type { AddonPrefabRuntime, AddonSourceCatalog, MysticDiagnosticSink, MysticMaterialFactoryOptions, MysticQualityId, MysticQualityProfile } from './mystic-types.js';
export interface ThreeAddonPrefabFactoryOptions {
    readonly catalog?: AddonSourceCatalog;
    readonly materialFactory?: MysticSourceMaterialFactory;
    readonly materialOptions: Omit<MysticMaterialFactoryOptions, 'quality'>;
    readonly quality?: MysticQualityId | MysticQualityProfile;
    readonly onDiagnostic?: MysticDiagnosticSink;
    readonly strict?: boolean;
    /**
     * `exported-glb-bone` matches the Blender glTF body export: Model is +90° X,
     * 0.01 scale, and local X is mirrored from Unity.
     */
    readonly coordinateBasis?: AddonCoordinateBasis;
}
export type AddonCoordinateBasis = 'unity' | 'exported-glb-bone';
export declare const AXIE_EXPORTED_BONE_UNIT_SCALE = 100;
export interface AddonDependencySet {
    readonly prefabIds: readonly string[];
    readonly materialIds: readonly string[];
    readonly textureGuids: readonly string[];
    readonly texturePaths: readonly string[];
}
/** Instantiates every authored Transform and ParticleSystem in an add-on prefab. */
export declare class ThreeAddonPrefabFactory {
    #private;
    constructor(options: ThreeAddonPrefabFactoryOptions);
    get catalog(): AddonSourceCatalog;
    listPrefabIds(): string[];
    listAddonIds(): string[];
    dependenciesForAddon(addonId: string): AddonDependencySet;
    create(prefabId: string): AddonPrefabRuntime;
    /** Some Unity folders intentionally contain several prefab attachments. */
    createAddon(addonId: string): AddonPrefabRuntime;
    /** Faithful convenience for attaching component-driven effects to exported body bones. */
    createAddonAtBone(addonId: string, bone: THREE.Object3D): AddonPrefabRuntime;
}
//# sourceMappingURL=addon-prefab-adapter.d.ts.map