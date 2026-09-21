import type { AxieDiagnosticEvent } from './diagnostics.js';
import type { AxieBodyType } from './domain.js';
import type { AxieMixerManifest, AxieWeaponPairedAnimationState } from './manifest.js';
import type { AxieAssetStore, AxiePairedWeaponAnimationInspection, AxiePlayableAnchors, AxieWeaponCapability } from './runtime.js';
export interface AxieWeaponRuntimeOptions {
    readonly manifest: AxieMixerManifest;
    readonly assets: AxieAssetStore;
    readonly anchors: AxiePlayableAnchors;
    readonly body: AxieBodyType;
    readonly onDiagnostic?: (event: AxieDiagnosticEvent) => void;
    readonly onStateChange?: () => void;
}
export interface AxiePairedWeaponAnimationOptions {
    readonly transition?: number;
    readonly timeScale?: number;
    readonly restart?: boolean;
}
/** Character-owned, abort-safe equivalent of `AnimatorSample.EquipWeapon`. */
export declare class AxieWeaponRuntime {
    #private;
    readonly capabilities: readonly AxieWeaponCapability[];
    constructor(options: AxieWeaponRuntimeOptions);
    get active(): string | undefined;
    get activeSelection(): string | undefined;
    get loading(): string | undefined;
    get loadingSelection(): string | undefined;
    inspectPairedAnimation(): AxiePairedWeaponAnimationInspection;
    capability(id: string): AxieWeaponCapability | undefined;
    capabilityForSelection(id: string): AxieWeaponCapability | undefined;
    isSelectionAvailable(weaponId: string): boolean;
    isActiveSelection(weaponId: string): boolean;
    isLoadingSelection(weaponId: string): boolean;
    weaponForClip(name: string): AxieWeaponCapability | undefined;
    locomotionName(id: string, state: 'Idle' | 'Walk' | 'Run'): string | undefined;
    /**
     * Starts the exact weapon-local clip paired with the body semantic state.
     * Families without a source-authored weapon Animator deliberately return
     * false and retain their source behavior as rigid socket children.
     */
    playPairedAnimation(state: AxieWeaponPairedAnimationState, options?: AxiePairedWeaponAnimationOptions): boolean;
    update(deltaSeconds: number): void;
    equip(weaponId?: string | null): Promise<boolean>;
    /** Invalidates an in-flight acquisition without unequipping a committed weapon. */
    cancelPending(): boolean;
    dispose(): void;
}
//# sourceMappingURL=weapon-runtime.d.ts.map