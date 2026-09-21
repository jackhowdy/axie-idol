import * as THREE from 'three';
import { type AxieAvatarRenderOptions } from './avatar.js';
import type { AxieMixerManifest } from './manifest.js';
import type { AxieDiagnosticEvent } from './diagnostics.js';
import type { AddonParticleResetOptions } from './mystic-types.js';
import type { AxieAnimationCapabilities, AxieAnimationCueListener, AxieAnimationPlayOptions, AxieAssemblyResult, AxieAssetStore, AxieLocomotion, AxieMixPlan, AxiePlayableCharacter, AxieWeaponCapability } from './runtime.js';
export interface ThreeAxiePlayableOptions {
    readonly manifest: AxieMixerManifest;
    readonly assets: AxieAssetStore;
    readonly onDiagnostic?: (event: AxieDiagnosticEvent) => void;
    /** Internal ownership hook used by mixer facades; called exactly once. */
    readonly onDispose?: (character: ThreeAxiePlayableCharacter) => void;
}
/**
 * Source-derived contract for Samples~/Axie Animations/Animations/Axie Controller.controller.
 * The runtime deliberately models this single layer without IK, offsets, or inferred states.
 */
export declare const AXIE_UNITY_ANIMATOR_CONTROLLER: Readonly<{
    layers: readonly Readonly<{
        name: "Base Layer";
        ikPass: false;
    }>[];
    states: readonly string[];
    stateDefaults: Readonly<{
        speed: 1;
        writeDefaultValues: true;
        footIk: false;
    }>;
    parameters: readonly (Readonly<{
        name: "Move Speed";
        type: "float";
        defaultValue: 0;
    }> | Readonly<{
        name: "Attack";
        type: "trigger";
    }> | Readonly<{
        name: "Skill";
        type: "trigger";
    }> | Readonly<{
        name: "Stunned";
        type: "bool";
        defaultValue: false;
    }> | Readonly<{
        name: "Dead";
        type: "trigger";
    }> | Readonly<{
        name: "Restart";
        type: "trigger";
    }>)[];
    anyStateOrder: readonly string[];
    locomotion: Readonly<{
        parameter: "Move Speed";
        blendType: "1D Simple";
        minimum: 0;
        maximum: 3;
        childTimeScale: 1;
        thresholds: readonly (Readonly<{
            state: "Idle";
            value: 0;
        }> | Readonly<{
            state: "Walk";
            value: 2;
        }> | Readonly<{
            state: "Run";
            value: 3;
        }>)[];
    }>;
    overrides: Readonly<{
        weaponSpecific: readonly string[];
        stun: "Default.Stun";
        dead: "Default.Dead";
    }>;
    transitions: readonly (Readonly<{
        from: "Locomotion";
        to: "Attack";
        condition: "Attack";
        duration: 0.1;
        hasExitTime: false;
        fixedDuration: true;
        transitionOffset: 0;
        interruptionSource: "None";
        orderedInterruption: true;
        canTransitionToSelf: true;
    }> | Readonly<{
        from: "Locomotion";
        to: "Skill";
        condition: "Skill";
        duration: 0.1;
        hasExitTime: true;
        exitTime: 1;
        fixedDuration: true;
        transitionOffset: 0;
        interruptionSource: "None";
        orderedInterruption: true;
        canTransitionToSelf: true;
    }> | Readonly<{
        from: "Attack";
        to: "Locomotion";
        duration: 0.1;
        hasExitTime: true;
        exitTime: 1;
        fixedDuration: true;
        transitionOffset: 0;
        interruptionSource: "None";
        orderedInterruption: true;
        canTransitionToSelf: true;
    }> | Readonly<{
        from: "Skill";
        to: "Locomotion";
        duration: 0.1;
        hasExitTime: true;
        exitTime: 1;
        fixedDuration: true;
        transitionOffset: 0;
        interruptionSource: "None";
        orderedInterruption: true;
        canTransitionToSelf: true;
    }> | Readonly<{
        from: "Any State";
        to: "Locomotion";
        condition: "Restart";
        duration: 0;
        hasExitTime: false;
        fixedDuration: true;
        transitionOffset: 0;
        interruptionSource: "None";
        orderedInterruption: true;
        canTransitionToSelf: true;
    }> | Readonly<{
        from: "Any State";
        to: "Dead";
        condition: "Dead";
        duration: 0.1;
        hasExitTime: false;
        fixedDuration: true;
        transitionOffset: 0;
        interruptionSource: "Current State";
        orderedInterruption: true;
        canTransitionToSelf: false;
    }> | Readonly<{
        from: "Any State";
        to: "Stun";
        condition: "Stunned == true";
        duration: 0.25;
        hasExitTime: false;
        fixedDuration: true;
        transitionOffset: 0;
        interruptionSource: "Current State";
        orderedInterruption: true;
        canTransitionToSelf: false;
    }> | Readonly<{
        from: "Stun";
        to: "Locomotion";
        condition: "Stunned == false";
        duration: 0.25;
        hasExitTime: false;
        fixedDuration: true;
        transitionOffset: 0;
        interruptionSource: "None";
        orderedInterruption: true;
        canTransitionToSelf: true;
    }> | Readonly<{
        from: "Dead";
        to: "Exit";
        duration: 0.25;
        hasExitTime: true;
        exitTime: 1;
        fixedDuration: true;
        transitionOffset: 0;
        interruptionSource: "None";
        orderedInterruption: true;
        canTransitionToSelf: true;
    }>)[];
}>;
/** AnimationMixer adapter consumed by the playground's player/camera loop. */
export declare class ThreeAxiePlayableCharacter implements AxiePlayableCharacter {
    #private;
    readonly kind: "axie";
    readonly key: string;
    readonly descriptor: import("./domain.js").AxieDescriptor;
    readonly wrapper: THREE.Group<THREE.Object3DEventMap>;
    readonly model: THREE.Group<THREE.Object3DEventMap>;
    readonly quality: import("./quality.js").AxieQualityProfile;
    readonly animations: AxieAnimationCapabilities;
    readonly animationNames: readonly string[];
    readonly anchors: {
        cameraTarget: THREE.Object3D<THREE.Object3DEventMap>;
        leftWeapon: THREE.Object3D<THREE.Object3DEventMap> | undefined;
        rightWeapon: THREE.Object3D<THREE.Object3DEventMap> | undefined;
    };
    readonly collision: {
        type: "capsule";
        radius: number;
        height: number;
        centerY: number;
    };
    readonly diagnostics: import("./diagnostics.js").AxieAssemblyDiagnostics;
    readonly weapons: readonly AxieWeaponCapability[];
    constructor(assembly: AxieAssemblyResult, plan: AxieMixPlan, options?: ThreeAxiePlayableOptions);
    get disposed(): boolean;
    get activeAnimation(): string | undefined;
    get animationOverrideActive(): boolean;
    get activeWeapon(): string | undefined;
    get activeWeaponSelection(): string | undefined;
    get weaponLoading(): string | undefined;
    get weaponLoadingSelection(): string | undefined;
    inspectPairedWeaponAnimation(): import("./runtime.js").AxiePairedWeaponAnimationInspection;
    resetAddonParticles(options?: AddonParticleResetOptions): void;
    setLocomotion(state: AxieLocomotion, transition?: number): void;
    setMoveSpeed(value: number, transition?: number): void;
    playAnimation(name: string, options?: AxieAnimationPlayOptions): boolean;
    /**
     * Subscribes to authored animation events crossed by the active action.
     * Returns an idempotent unsubscribe callback.
     */
    subscribeAnimationCues(listener: AxieAnimationCueListener): () => void;
    playAnimationAsync(name: string, options?: AxieAnimationPlayOptions): Promise<boolean>;
    equipWeapon(weaponId?: string | null): Promise<boolean>;
    getLiteAnimationClip(name: string): THREE.AnimationClip;
    getFullAnimationClip(name: string): THREE.AnimationClip;
    renderAvatar(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, options?: AxieAvatarRenderOptions): import("./avatar.js").AxieAvatarRenderResult;
    resumeLocomotion(transition?: number): void;
    update(deltaSeconds: number): void;
    setVisible(visible: boolean): void;
    dispose(): void;
}
//# sourceMappingURL=playable.d.ts.map