import type { AxieColorVariantManifest, AxieMixerManifest } from './manifest.js';
import type { AxieMixPlan, AxieMixRequest, AxiePlanBuilder, AxieResolvedPartRig } from './runtime.js';
import type { AxieDiagnosticEvent } from './diagnostics.js';
export interface AxieResolvedColors {
    readonly variant?: AxieColorVariantManifest;
    /** Present only when AxieFactory.Colorize finds the requested config row. */
    readonly primary?: string;
    /** Present only when AxieFactory.Colorize finds the requested config row. */
    readonly secondary?: string;
    /** False means preserve each material's serialized authored colors. */
    readonly applyUnityColorVariant: boolean;
}
export interface AxiePlannedPartRig extends AxieResolvedPartRig {
    /** Unity instantiates add-on prefabs only once for a repeated rig type. */
    readonly instantiateAddonAttachments: boolean;
}
export interface AxieDeterministicMixPlan extends Omit<AxieMixPlan, 'partRigs'> {
    readonly partRigs: readonly AxiePlannedPartRig[];
    readonly colors: AxieResolvedColors;
    readonly artMode: 'faithful' | 'enhanced';
}
export declare class AxieMixPlanError extends Error {
    readonly diagnostic: AxieDiagnosticEvent;
    readonly name = "AxieMixPlanError";
    constructor(message: string, diagnostic: AxieDiagnosticEvent);
}
/** Pure plan builder that mirrors AxieFactory.CreateCharacter without coercion. */
export declare class DeterministicAxiePlanBuilder implements AxiePlanBuilder {
    build(manifest: AxieMixerManifest, request: AxieMixRequest): AxieDeterministicMixPlan;
}
export declare const AXIE_PLAN_BUILDER: AxiePlanBuilder;
//# sourceMappingURL=plan-builder.d.ts.map