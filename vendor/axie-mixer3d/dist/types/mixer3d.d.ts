import { type ThreeAxieAddonFactoryLoader } from './assembler.js';
import { type RefCountedAxieAssetStoreOptions } from './asset-store.js';
import type { AxieDiagnosticEvent } from './diagnostics.js';
import { AxieCharacter3D } from './character3d.js';
import type { AxieMixerManifest } from './manifest.js';
import { SampledAnimationJsonLoader } from './sampled-animation.js';
import type { AxieAssembler, AxieAssetStore, AxieCreateRequest, AxieGenesMixRequest, AxieMaterialFactory, AxieMixer3D, AxiePlanBuilder } from './runtime.js';
import type { AxieGenesDecoder } from './domain.js';
import { type AxieResolver } from './axie-id.js';
import type { AxieIdMixRequest, AxieIdResolveRequest } from './runtime.js';
export interface ThreeAxieMixer3DOptions {
    readonly manifest: AxieMixerManifest;
    /** Defaults to the same-origin /api/axies/{id} resolver shipped by the demo. */
    readonly axieResolver?: AxieResolver;
    readonly genes?: AxieGenesDecoder;
    readonly planBuilder?: AxiePlanBuilder;
    readonly assetStore?: AxieAssetStore;
    readonly assetStoreOptions?: RefCountedAxieAssetStoreOptions;
    readonly materialFactory?: AxieMaterialFactory;
    /** @deprecated Prefer extensions.addons for an explicit browser override. */
    readonly addons?: false | ThreeAxieAddonFactoryLoader;
    readonly extensions?: ThreeAxieMixer3DExtensions;
    readonly animationLoader?: SampledAnimationJsonLoader;
    readonly assembler?: AxieAssembler;
    readonly onDiagnostic?: (event: AxieDiagnosticEvent) => void;
    /** Opt in when a supplied store is owned exclusively by this facade. */
    readonly disposeSuppliedAssetStore?: boolean;
    /** Opts into the process-global source-shaped AxieCharacter3D static factory bridge. */
    readonly registerAsDefaultCharacterFactory?: boolean;
}
/** Browser-only construction policies; omitted fields retain AxieFactory behavior. */
export interface ThreeAxieMixer3DExtensions {
    /** False explicitly omits generated Mystic add-on catalogs/effects. */
    readonly addons?: false | ThreeAxieAddonFactoryLoader;
}
/** Public facade for deterministic planning, loading, assembly and playback. */
export declare class ThreeAxieMixer3D implements AxieMixer3D {
    #private;
    readonly manifest: AxieMixerManifest;
    readonly genes: AxieGenesDecoder;
    readonly axieResolver: AxieResolver;
    constructor(options: ThreeAxieMixer3DOptions);
    plan(request: AxieCreateRequest): import("./runtime.js").AxieMixPlan;
    create(request: AxieCreateRequest): Promise<AxieCharacter3D>;
    createFromGenes(request: AxieGenesMixRequest): Promise<AxieCharacter3D>;
    resolveAxieId(request: AxieIdResolveRequest): Promise<import("./axie-id.js").AxieLookup>;
    createFromAxieId(request: AxieIdMixRequest): Promise<AxieCharacter3D>;
    decodeGenes(genes: string): import("./domain.js").AxieDecodedGenes;
    cacheDiagnostics(): import("./diagnostics.js").AxieCacheDiagnostics;
    clearCache(): void;
    dispose(): void;
}
//# sourceMappingURL=mixer3d.d.ts.map