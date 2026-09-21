import * as THREE from 'three';
import type { AxieDescriptor, AxiePartType } from './domain.js';
import { type AxieAvatarRenderOptions } from './avatar.js';
import { ThreeAxiePlayableCharacter, type ThreeAxiePlayableOptions } from './playable.js';
import type { AxieAssemblyResult, AxieMixPlan } from './runtime.js';
export interface AxiePartLayerOverride {
    type: AxiePartType;
    layer: number;
}
/** Source-shaped AxieInstantiationParams, including Unity's pairwise Merge rules. */
export declare class AxieInstantiationParams {
    lodLevel: number;
    useMaterialPropertyBlocks: boolean;
    partLayerOverrides: AxiePartLayerOverride[];
    constructor(values?: Partial<AxieInstantiationParams>);
    Merge(other: AxieInstantiationParams | null | undefined): AxieInstantiationParams;
    merge(other: AxieInstantiationParams | null | undefined): AxieInstantiationParams;
}
export interface AxieCharacter3DFactory {
    /** Unity returns null when the requested body resource is absent. */
    createFromDescriptor(descriptor: AxieDescriptor, instantiationParams?: AxieInstantiationParams | null): Promise<AxieCharacter3D | null>;
    /** Unity decodes first, then preserves the same nullable body lookup. */
    createFromGenes(genes: string, instantiationParams?: AxieInstantiationParams | null): Promise<AxieCharacter3D | null>;
}
/**
 * Source-compatible character surface over the playable Three.js runtime.
 * Static creation is necessarily asynchronous because browser assets are fetched.
 */
export declare class AxieCharacter3D extends ThreeAxiePlayableCharacter {
    #private;
    readonly InstantiationParams: AxieInstantiationParams;
    readonly Root: THREE.Group;
    readonly RightWeaponAttachPoint?: THREE.Object3D;
    readonly LeftWeaponAttachPoint?: THREE.Object3D;
    readonly AnimationNames: readonly string[];
    constructor(assembly: AxieAssemblyResult, plan: AxieMixPlan, instantiationParams?: AxieInstantiationParams, playableOptions?: ThreeAxiePlayableOptions);
    static InstallDefaultFactory(factory: AxieCharacter3DFactory): () => void;
    static FromDescriptor(descriptor: AxieDescriptor, instantiationParams?: AxieInstantiationParams | null): Promise<AxieCharacter3D | null>;
    static FromGenes(genes: string, instantiationParams?: AxieInstantiationParams | null): Promise<AxieCharacter3D | null>;
    /**
     * @deprecated This source property is a hard compile error in C#. The web port
     * exposes `never` and throws at runtime; use the lite/full lookup methods.
     */
    get Animations(): never;
    GetLiteAnimationClip(name: string): THREE.AnimationClip;
    GetFullAnimationClip(name: string): THREE.AnimationClip;
    RenderAvatar(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, options: AxieAvatarRenderOptions): import("./avatar.js").AxieAvatarRenderResult;
    Dispose(): void;
    setVisible(visible: boolean): void;
    dispose(): void;
}
//# sourceMappingURL=character3d.d.ts.map