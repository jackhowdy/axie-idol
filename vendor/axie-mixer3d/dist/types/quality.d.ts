import type { AxieAnimationSet, AxieTextureVariant } from './manifest.js';
/** The only profile sourced from the serialized AxieFactory defaults. */
export declare const AXIE_UNITY_COMPATIBILITY_QUALITY_ID: "unity-default";
/** Browser-only quality policies; these are not AxieFactory behavior. */
export declare const AXIE_WEB_EXTENSION_QUALITY_IDS: readonly ["ultra", "balanced", "performance"];
export type AxieWebExtensionQualityId = typeof AXIE_WEB_EXTENSION_QUALITY_IDS[number];
export declare const AXIE_QUALITY_IDS: readonly ["unity-default", "ultra", "balanced", "performance"];
export type AxieQualityId = typeof AXIE_QUALITY_IDS[number];
/** Public LOD levels documented by the source Unity package. */
export declare const AXIE_UNITY_LOD_LEVELS: readonly [0, 1, 2];
export type AxieUnityLodLevel = typeof AXIE_UNITY_LOD_LEVELS[number];
export type AxieOutlineMode = 'unity-geometry' | 'screen-space' | 'off';
export type AxieMysticFxQuality = 'full' | 'reduced';
export interface AxieQualityProfile {
    readonly id: AxieQualityId;
    readonly label: string;
    /** Requested Unity lodLevel. Part rigs clamp this to their last available LOD. */
    readonly requestedLod: number;
    readonly textureVariant: AxieTextureVariant;
    readonly maxTextureDimension: number;
    readonly pixelRatioCap: number;
    readonly anisotropy: number;
    readonly animationSet: AxieAnimationSet;
    readonly outlineMode: AxieOutlineMode;
    readonly mysticFx: AxieMysticFxQuality;
    readonly shadowMapSize: 1024 | 2048 | 4096;
}
/**
 * Defaults grounded in the package:
 * - AxieFactory.asset requests LOD 2.
 * - the source package documents LOD 0, 1, and 2 as its quality choices.
 * - source textures are at most 2048px (most are 1024px).
 * - the package exposes both lite and full animation sets.
 * - its authored outline is the front-cull geometry pass.
 */
export declare const AXIE_UNITY_COMPATIBILITY_QUALITY: AxieQualityProfile;
export declare const AXIE_WEB_EXTENSION_QUALITY_PROFILES: Readonly<Record<AxieWebExtensionQualityId, AxieQualityProfile>>;
/**
 * Backward-compatible combined lookup. Source-shaped entry points default to
 * AXIE_UNITY_COMPATIBILITY_QUALITY; the other entries require explicit opt-in.
 */
export declare const AXIE_QUALITY_PROFILES: Readonly<Record<AxieQualityId, AxieQualityProfile>>;
/** Unity clamps each part rig's list index, rather than searching by mesh name. */
export declare function resolveAxiePartLodIndex(requestedLod: number, availableLodCount: number): number;
/** Unity keeps the prefab body mesh when lodLevel is outside its body LOD list. */
export declare function resolveAxieBodyLodIndex(requestedLod: number, availableLodCount: number, prefabLod: number): number;
//# sourceMappingURL=quality.d.ts.map