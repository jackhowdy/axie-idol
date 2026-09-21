import { type AxieBodyType, type AxieDescriptor, type AxiePartAssetId, type AxiePartType } from './domain.js';
import { type AxieCreatorCatalog, type AxieCreatorPreferences, type AxieCreatorState, type AxieCreatorStateCodec, type AxieManualCreatorState, type AxiePartSelection } from './creator-state.js';
import type { AxieMixerManifest } from './manifest.js';
export declare const AXIE_SPECIAL_SHOWCASE_PRESET_IDS: readonly ["nightmare-body", "nightmare-parts", "japanese-parts", "xmas-i-parts", "xmas-ii-parts"];
export type AxieSpecialShowcasePresetId = typeof AXIE_SPECIAL_SHOWCASE_PRESET_IDS[number];
export interface AxieSpecialShowcasePreset {
    readonly id: AxieSpecialShowcasePresetId;
    readonly label: string;
    readonly description: string;
    readonly body: AxieBodyType;
    readonly colorVariant: number;
    readonly skin: number;
    /** Omitted only by the body-skin preset, which deliberately preserves current parts. */
    readonly parts?: AxiePartSelection;
}
/**
 * Deterministic, source-backed preview states for the art-team families that
 * are otherwise easy to miss in the full Creator catalog.
 *
 * Nightmare body is a skin/palette on the animated Normal rig, matching the
 * Unity genes decoder. Xmas parts use the Frosty staging body supplied by the
 * source project. These are convenience showcases, not additional body types.
 */
export declare const AXIE_SPECIAL_SHOWCASE_PRESETS: Readonly<Record<AxieSpecialShowcasePresetId, AxieSpecialShowcasePreset>>;
/** Human-readable legacy skin-family label used by creator surfaces. */
export declare function formatAxieSkinLabel(skin: number): string;
/**
 * Projects the creator directly from the exported mixer manifest. It never
 * synthesizes a class/variant grid, so unavailable Eye/Mouth cells cannot leak
 * into the UI.
 */
export declare function createAxieCreatorCatalog(manifest: AxieMixerManifest): AxieCreatorCatalog;
export declare function createManualAxieCreatorState(catalog: AxieCreatorCatalog, selection: Readonly<{
    body: AxieBodyType;
    colorVariant: number;
    parts: AxiePartSelection;
}>, preferences?: Partial<AxieCreatorPreferences>): AxieManualCreatorState;
export declare function createDefaultAxieCreatorState(catalog: AxieCreatorCatalog, preferences?: Partial<AxieCreatorPreferences>): AxieManualCreatorState;
export declare function resolveAxieCreatorParts(catalog: AxieCreatorCatalog, descriptor: AxieDescriptor): Readonly<Partial<Record<AxiePartType, AxiePartAssetId>>>;
export declare function normalizeAxieCreatorState(state: AxieCreatorState, catalog: AxieCreatorCatalog): AxieCreatorState;
export declare function manualizeAxieCreatorState(state: AxieCreatorState, catalog: AxieCreatorCatalog): AxieManualCreatorState;
/**
 * Creates a fully validated manual state for one of the special-family
 * showcases. Every explicit part id is checked against the supplied manifest
 * catalog by createManualAxieCreatorState().
 */
export declare function createAxieSpecialShowcaseState(catalog: AxieCreatorCatalog, state: AxieCreatorState, presetId: AxieSpecialShowcasePresetId): AxieManualCreatorState;
export declare function randomizeAxieCreatorState(catalog: AxieCreatorCatalog, preferences?: Partial<AxieCreatorPreferences>, random?: () => number): AxieManualCreatorState;
export declare function createAxieCreatorStateCodec(catalog: AxieCreatorCatalog): AxieCreatorStateCodec;
//# sourceMappingURL=creator-model.d.ts.map