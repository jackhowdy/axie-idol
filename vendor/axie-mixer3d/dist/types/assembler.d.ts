import * as THREE from 'three';
import type { AddonDependencySet } from './addon-prefab-adapter.js';
import type { AxieDiagnosticEvent } from './diagnostics.js';
import { type AxieMixerManifest } from './manifest.js';
import { SampledAnimationJsonLoader } from './sampled-animation.js';
import type { AddonPrefabRuntime, MysticDiagnostic, MysticTextureSlotSchema } from './mystic-types.js';
import type { AxieAssembler, AxieAssemblyCompatibilityOptions, AxieAssemblyResult, AxieAssetStore, AxieMaterialContext, AxieMaterialFactory, AxieMixPlan, AxieMixRequest } from './runtime.js';
export interface ThreeAxieAssemblerOptions {
    readonly manifest: AxieMixerManifest;
    readonly assets: AxieAssetStore;
    readonly materials?: AxieMaterialFactory;
    readonly animations?: SampledAnimationJsonLoader;
    /** False keeps the generated Mystic catalogs out of this assembler entirely. */
    readonly addons?: false | ThreeAxieAddonFactoryLoader;
    readonly onDiagnostic?: (event: AxieDiagnosticEvent) => void;
}
export interface ThreeAxieRuntimeAddonFactory {
    dependenciesForAddon(addonId: string): AddonDependencySet;
    createAddon(addonId: string): AddonPrefabRuntime;
}
export interface ThreeAxieAddonFactoryContext {
    readonly quality: AxieMixPlan['quality'];
    readonly artMode: AxieMaterialContext['artMode'];
    /** Present only when AxieFactory.Colorize resolved a config row. */
    readonly primaryColor?: string;
    /** Present only when AxieFactory.Colorize resolved a config row. */
    readonly secondaryColor?: string;
    readonly strict: boolean;
    readonly resolveTexture: (slot: MysticTextureSlotSchema) => THREE.Texture | undefined;
    readonly onDiagnostic: (diagnostic: MysticDiagnostic) => void;
}
export interface ThreeAxieAddonFactoryAdapter {
    readonly factory: ThreeAxieRuntimeAddonFactory;
    /** Compensation already authored onto each generated prefab root. */
    readonly factoryUnitScale: number;
}
export type ThreeAxieAddonFactoryLoader = (context: ThreeAxieAddonFactoryContext) => Promise<ThreeAxieAddonFactoryAdapter>;
/**
 * Unity-faithful body/part assembly over immutable GLB sources. Body scenes use
 * SkeletonUtils; requested rigid part nodes are cloned independently and reset
 * to identity before being parented to their exact Root_*_JNT attach point.
 */
export declare class ThreeAxieAssembler implements AxieAssembler {
    #private;
    constructor(options: ThreeAxieAssemblerOptions);
    clearCache(): void;
    assemble(plan: AxieMixPlan, request: AxieMixRequest, compatibility?: AxieAssemblyCompatibilityOptions): Promise<AxieAssemblyResult>;
}
//# sourceMappingURL=assembler.d.ts.map