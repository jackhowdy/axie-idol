import * as THREE from 'three';
import { formatAxieAddonId, formatAxiePartAssetId, type AxieBodyType, type AxieDescriptor, type AxiePartDescriptor, type AxiePartType, type AxieRigType } from './domain.js';
import type { AxieBodyAssetManifest, AxieMixerManifest } from './manifest.js';
import { resolveAxieBodyLodIndex, resolveAxiePartLodIndex } from './quality.js';
import { AxieInstantiationParams } from './character3d.js';
/** Source commit whose public/runtime semantics this compatibility layer models. */
export declare const AXIE_SOURCE_COMPATIBILITY_COMMIT: "public-content-v1";
export declare const AXIE_FACTORY_RESOURCE_PATH: "AxieMixer3D/AxieFactory";
export declare const AXIE_DATA_RESOURCE_PATH: "AxieMixer3D/Data";
export declare const AXIE_PRIMARY_COLOR_PROPERTY: "_PrimaryColor";
export declare const AXIE_SECONDARY_COLOR_PROPERTY: "_SecondaryColor";
/** Explicit browser policy for source defects that cannot be inferred safely. */
export declare const AXIE_SOURCE_EDGE_POLICIES: Readonly<{
    readonly nullParts: "throw-during-unity-coercion";
    readonly coercion: "preserve-source-no-op";
    readonly unsupportedPart: "omit-missing-resource-key";
    readonly missingEyeMouth: "preserve-48-known-absences";
    readonly classCase: "resource-key-is-case-sensitive";
    readonly missingBody: "return-null-from-compatibility-factory";
    readonly bodyLodThree: "retain-prefab-body-and-clamp-parts; public-quality-range-0-2";
    readonly animationTrackMismatch: "warn-and-keep-playable-tracks";
    readonly missingColor: "preserve-authored-material-when-palette-row-is-absent";
    readonly obsoleteAnimations: "never-type-plus-runtime-error";
    readonly readmeConstructor: "reject-source-readme-constructor-shape";
    readonly readmeClips: "exact-dictionary-lookup-throws-for-absent-names";
    readonly stackalloc: "deterministically-zero-initialize-web-decoder";
    readonly overlongGenes: "deterministic-too-long-error-at-129-contiguous-hex-digits";
    readonly invalidGeneCharacter: "truncate-higher-prefix-like-source";
    readonly noSourceTests: "use-source-pinned-web-oracles-and-retained-evidence";
}>;
/** Runtime declaration sets mirrored from the three source enums. */
export declare const AXIE_SOURCE_ENUMS: Readonly<{
    AxieBodyType: readonly ["normal", "spiky", "fuzzy", "curly", "sumo", "wetdog", "bigyak", "frosty"];
    AxiePartType: readonly ["back", "ear", "eye", "horn", "mouth", "tail"];
    AxieRigType: readonly ["Back_L", "Back_M", "Back_R", "Ear_L", "Ear_R", "Eye_L", "Eye_M", "Eye_R", "Eye_Accessory_L", "Eye_Accessory_R", "Horn_L", "Horn_M", "Horn_R", "Horn_T", "Mouth_M", "Mouth_Accessory_L", "Mouth_Accessory_R", "Tail_L", "Tail_M", "Tail_R"];
}>;
export declare function ToAxiePartType(rigType: AxieRigType): AxiePartType;
export declare const AxieRigTypeExtensions: Readonly<{
    ToAxiePartType: typeof ToAxiePartType;
}>;
/** Browser marker corresponding to Unity's property-only LayerFieldAttribute. */
export declare class LayerFieldAttribute {
    readonly kind: "layer-field";
}
/** DOM/editor adapter for the source drawer's integer-layer behavior. */
export declare class LayerFieldAttributeDrawer {
    OnGUI<T>(value: T, selectedLayer?: number): T | number;
}
/** Mutable source-shaped descriptor used by compatibility/editor examples. */
export declare class AxiePartDescriptorCompatibility implements AxiePartDescriptor {
    type: AxiePartType;
    skin: number;
    class: AxiePartDescriptor['class'];
    variant: number;
    level: number;
    constructor(values?: Partial<AxiePartDescriptor>);
}
/** Source-shaped AxieDescriptor, including its static FromGenes entry point. */
export declare class AxieDescriptorCompatibility implements AxieDescriptor {
    colorVariant: number;
    body: AxieBodyType;
    parts: AxiePartDescriptorCompatibility[];
    constructor(values?: Partial<AxieDescriptor>);
    static FromGenes(genes: string): AxieDescriptorCompatibility;
}
export declare class AxieAnimationDataCompatibility<TClip = unknown> {
    name: string;
    clip: TClip | null;
    constructor(name?: string, clip?: TClip | null);
}
export declare class AxieBodyDataCompatibility<TPrefab = unknown, TMesh = unknown, TClip = unknown> {
    prefab: TPrefab | null;
    lodMeshes: TMesh[];
    liteAnimations: AxieAnimationDataCompatibility<TClip>[];
    fullAnimations: AxieAnimationDataCompatibility<TClip>[];
    LiteAnimations: ReadonlyMap<string, AxieAnimationDataCompatibility<TClip>>;
    FullAnimations: ReadonlyMap<string, AxieAnimationDataCompatibility<TClip>>;
    constructor(values?: Partial<AxieBodyDataCompatibility<TPrefab, TMesh, TClip>>);
}
export declare class AxieRigDataCompatibility<TPrefab = unknown, TMesh = unknown> {
    type: AxieRigType;
    prefab: TPrefab | null;
    lodMeshes: TMesh[];
    constructor(values?: Partial<AxieRigDataCompatibility<TPrefab, TMesh>>);
}
export declare class AxiePartDataCompatibility<TPrefab = unknown, TMesh = unknown> {
    rigs: AxieRigDataCompatibility<TPrefab, TMesh>[];
    constructor(rigs?: readonly AxieRigDataCompatibility<TPrefab, TMesh>[]);
}
export interface AxieMixerColorVariantInput {
    readonly index?: unknown;
    readonly key?: unknown;
    readonly skin?: unknown;
    readonly class?: unknown;
    readonly color_value?: unknown;
    readonly primary1?: unknown;
    readonly primary2?: unknown;
}
export declare class AxieMixerColorVariantCompatibility {
    index: number;
    key: string | null;
    skin: number;
    class: string | null;
    color_value: number;
    primary1: string | null;
    primary2: string | null;
    constructor(values?: AxieMixerColorVariantInput);
}
export declare class AxieMixerItemsCompatibility {
    colors: AxieMixerColorVariantCompatibility[] | null;
    constructor(colors?: readonly AxieMixerColorVariantCompatibility[] | null);
}
export declare class AxieMixerConfigCompatibility {
    items: AxieMixerItemsCompatibility;
    constructor(items?: AxieMixerItemsCompatibility);
}
/** Unity JsonUtility projection: only fields present in the C# structs survive. */
export declare function importAxieMixerConfigJson(json: string): AxieMixerConfigCompatibility;
export declare function projectManifestToAxieMixerConfig(manifest: AxieMixerManifest): AxieMixerConfigCompatibility;
export type AxieResolvedSourceColors = {
    readonly variant: undefined;
    readonly primary: undefined;
    readonly secondary: undefined;
    readonly warnings: readonly string[];
} | {
    readonly variant: AxieMixerColorVariantCompatibility;
    readonly primary: string;
    readonly secondary: string;
    readonly warnings: readonly string[];
};
/** First-index lookup plus Unity's white fallback for invalid fields on a found row. */
export declare function resolveAxieUnityColors(config: AxieMixerConfigCompatibility | null | undefined, colorVariant: number): AxieResolvedSourceColors;
export interface AxieColorizableRenderer {
    material: THREE.Material | THREE.Material[];
    userData: Record<string, unknown>;
}
/**
 * Engine-neutral proof adapter for Unity's property-block/material ownership.
 * Production shaders consume the same two property names elsewhere; this helper
 * intentionally changes ownership only and never edits shader code.
 */
export declare function applyAxieUnityColorization(renderers: readonly AxieColorizableRenderer[], config: AxieMixerConfigCompatibility | null | undefined, colorVariant: number, useMaterialPropertyBlocks: boolean): {
    propertyValues: undefined;
    ownedMaterials: THREE.Material[];
    variant: undefined;
    primary: undefined;
    secondary: undefined;
    warnings: readonly string[];
} | {
    propertyValues: Readonly<{
        _PrimaryColor: string;
        _SecondaryColor: string;
    }>;
    ownedMaterials: THREE.Material[];
    variant: AxieMixerColorVariantCompatibility;
    primary: string;
    secondary: string;
    warnings: readonly string[];
};
export type AxieAddonCompatibilityAsset<TMaterial, TPrefab> = {
    readonly kind: 'material';
    readonly name: string;
    readonly value: TMaterial;
} | {
    readonly kind: 'prefab';
    readonly value: TPrefab;
};
export interface AxieAddonCompatibilitySet<TMaterial, TPrefab> {
    readonly materials: ReadonlyMap<string, TMaterial>;
    readonly prefabs: readonly TPrefab[];
}
/** Exact cache/precedence shape used by AxieFactory.GetAddons. */
export declare class AxieAddonCacheCompatibility<TMaterial, TPrefab> {
    #private;
    get size(): number;
    GetAddons(addonName: string, addonPaths: readonly string[], loadAll: (path: string, addonName: string) => readonly AxieAddonCompatibilityAsset<TMaterial, TPrefab>[]): AxieAddonCompatibilitySet<TMaterial, TPrefab>;
    ClearCache(): void;
}
export declare function formatAxieBodyResourceKey(body: AxieBodyType): string;
export declare function resolveAxieBodyOrNull(manifest: AxieMixerManifest, body: AxieBodyType | string): AxieBodyAssetManifest | null;
export declare const AxieFactorySemantics: Readonly<{
    formatPartKey: typeof formatAxiePartAssetId;
    formatAddonKey: typeof formatAxieAddonId;
    resolveBodyLod: typeof resolveAxieBodyLodIndex;
    resolvePartLod: typeof resolveAxiePartLodIndex;
}>;
export interface AxieCollectedAttachPoints {
    readonly attachPoints: ReadonlyMap<AxieRigType, THREE.Object3D>;
    readonly leftWeaponAttachPoint: THREE.Object3D | undefined;
    readonly rightWeaponAttachPoint: THREE.Object3D | undefined;
}
/** Exact ^Root_(\w+)_JNT$ collection and case-sensitive enum parsing. */
export declare function collectAxieAttachPoints(root: THREE.Object3D): AxieCollectedAttachPoints;
export interface AxieAvatarPassMaterialCompatibility {
    FindPass(name: 'ExtraPrePass' | 'Forward'): number;
}
export interface AxieAvatarPassRendererCompatibility {
    readonly materials: readonly AxieAvatarPassMaterialCompatibility[];
}
export interface AxieAvatarPassDraw {
    readonly rendererIndex: number;
    readonly subMeshIndex: number;
    readonly passName: 'ExtraPrePass' | 'Forward';
    readonly passIndex: number;
}
/** Executes the source avatar command order for each skinned submesh. */
export declare function executeAxieAvatarShaderPasses(renderers: readonly AxieAvatarPassRendererCompatibility[], draw: (command: AxieAvatarPassDraw) => void): AxieAvatarPassDraw[];
/**
 * Reproduces the checked-in struct-copy bug: the returned list is copied, but
 * intended skin/level edits are applied only to discarded local values.
 */
export declare function coerceAxieDescriptorUnityCompatible(descriptor: AxieDescriptor | (Omit<AxieDescriptor, 'parts'> & {
    readonly parts: null;
})): AxieDescriptor;
export interface AxieFactoryCompatibilityAdapter<TCharacter> {
    create(descriptor: AxieDescriptor, instantiationParams: AxieInstantiationParams): Promise<TCharacter> | TCharacter;
    clearCache?(): void;
}
/** Browser facade for AxieFactory.Default/CreateCharacter/ClearCache. */
export declare class AxieFactoryCompatibility<TCharacter = unknown> {
    #private;
    readonly manifest: AxieMixerManifest;
    readonly adapter: AxieFactoryCompatibilityAdapter<TCharacter>;
    static readonly DefaultResourcePath: "AxieMixer3D/AxieFactory";
    static get Default(): AxieFactoryCompatibility<unknown> | undefined;
    static InstallDefault<T>(factory: AxieFactoryCompatibility<T>): () => void;
    readonly defaultInstantiationParams: AxieInstantiationParams;
    constructor(manifest: AxieMixerManifest, adapter: AxieFactoryCompatibilityAdapter<TCharacter>, defaultInstantiationParams?: AxieInstantiationParams);
    CreateCharacter(descriptor: AxieDescriptor, instantiationParams?: AxieInstantiationParams | null): Promise<TCharacter | null>;
    ClearCache(): void;
}
//# sourceMappingURL=source-compatibility.d.ts.map