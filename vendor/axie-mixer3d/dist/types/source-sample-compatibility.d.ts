import * as THREE from 'three';
import { AxieAvatarRenderParams, type AxieAvatarRenderOptions } from './avatar.js';
import { type AxieBodyType, type AxieDescriptor, type AxiePartDescriptor } from './domain.js';
export declare const AXIE_SAMPLE_CLASSES: readonly ["Aquatic", "Beast", "Bird", "Bug", "Plant", "Reptile"];
export declare const AXIE_SAMPLE_VARIANTS: readonly [2, 4, 6, 8, 10, 12];
export declare const AXIE_COLLECTION_CLASS_COLOR_MAP: Readonly<Record<string, number>>;
export interface AxieCollectionEntry {
    readonly descriptor: AxieDescriptor;
    readonly name: string;
    /** Logical six-by-six selector position. */
    readonly grid: readonly [column: number, row: number];
    /** Literal source sample position from `(2f * col, 0f, 2f * row)`. */
    readonly sourcePosition: readonly [x: number, y: number, z: number];
    readonly rotationYDegrees: 180;
    readonly animation: 'Default.Idle';
    readonly loop: true;
}
/** Deterministic browser fixture projection of Samples~/Axie Collection. */
export declare class AxieCollection {
    body: AxieBodyType;
    classes: string[];
    variants: number[];
    skin: number;
    level: number;
    BuildEntries(): AxieCollectionEntry[];
}
export interface AxieCameraPointerInput {
    readonly rightMouseHeld: boolean;
    readonly rightMousePressed: boolean;
    readonly x: number;
    readonly y: number;
}
export interface AxieCameraEuler {
    readonly pitch: number;
    readonly yaw: number;
}
/** Source camera sample with right-button orbit and 5..75 degree pitch clamp. */
export declare class CameraController {
    #private;
    sensitivity: [number, number];
    Update(input: AxieCameraPointerInput, euler: AxieCameraEuler): AxieCameraEuler;
}
export interface AxieSampleAnimator {
    setFloat(name: string, value: number): void;
    setBool(name: string, value: boolean): void;
    setTrigger(name: string): void;
    runtimeAnimatorController?: unknown;
    setRuntimeAnimatorController?(controller: unknown): void;
}
export declare const AXIE_SAMPLE_WEAPON_NAMES: readonly ["Axe", "Bow", "Cannon", "Flag", "Gauntlet", "Mala", "Staff", "Sword", "Tome"];
export type AxieSampleWeaponName = typeof AXIE_SAMPLE_WEAPON_NAMES[number];
export type AxieSampleCharacterKind = 'lite' | 'full';
export type AxieSampleWeaponSide = 'left' | 'right';
export type AxieSampleAnimatorTrigger = 'Attack' | 'Skill' | 'Dead' | 'Restart';
export type AxieSampleLegacyAnimationName = 'Idle' | 'Walk' | 'Run' | 'Stun' | 'Dead' | 'Attack' | 'Skill';
export declare const AXIE_SAMPLE_LEGACY_ANIMATION_NAMES: readonly ["Idle", "Walk", "Run", "Stun", "Dead"];
export interface AxieSampleCharacter<TClip = unknown> {
    readonly Root: unknown;
    readonly RightWeaponAttachPoint?: unknown;
    readonly LeftWeaponAttachPoint?: unknown;
    GetLiteAnimationClip(name: string): TClip;
    GetFullAnimationClip(name: string): TClip;
}
export interface AxieSampleCharacterBehaviour<TClip = unknown> {
    axieDescriptor: AxieDescriptor;
    readonly Character: AxieSampleCharacter<TClip> | null;
    Rebuild(): unknown | Promise<unknown>;
}
export interface AxieSampleWeaponRuntimeAdapter<TPrefab = unknown, TInstance = unknown> {
    instantiate(prefab: TPrefab, parent: unknown): TInstance;
    destroy(instance: TInstance): void;
    setLocalScale(instance: TInstance, x: number, y: number, z: number): void;
}
export interface AxieSampleWeaponMount<TInstance = unknown> {
    readonly instance: TInstance;
    readonly character: AxieSampleCharacterKind;
    readonly side: AxieSampleWeaponSide;
    readonly weaponName: string;
}
export declare class AxieSampleAnimatorOverrideController<TClip = unknown> {
    readonly runtimeAnimatorController: unknown;
    readonly overrides: Map<string, TClip>;
    constructor(runtimeAnimatorController: unknown);
    SetOverride(name: string, clip: TClip): void;
    GetOverride(name: string): TClip | undefined;
}
export interface AnimatorSampleOptions<TClip = unknown, TPrefab = unknown, TInstance = unknown> {
    readonly animatorController?: unknown;
    readonly liteCharacterBehaviour?: AxieSampleCharacterBehaviour<TClip>;
    readonly fullCharacterBehaviour?: AxieSampleCharacterBehaviour<TClip>;
    readonly weaponPrefabs?: readonly TPrefab[];
    readonly weaponRuntime?: AxieSampleWeaponRuntimeAdapter<TPrefab, TInstance>;
    readonly createAnimator?: (character: AxieSampleCharacter<TClip>, controller: AxieSampleAnimatorOverrideController<TClip>, kind: AxieSampleCharacterKind) => AxieSampleAnimator;
}
/** Exact browser compatibility projection of `Samples~/Axie Animations/AnimatorSample.cs`. */
export declare class AnimatorSample<TClip = unknown, TPrefab = unknown, TInstance = unknown> {
    #private;
    liteAnimator: AxieSampleAnimator;
    fullAnimator: AxieSampleAnimator;
    animatorController: unknown;
    liteCharacterBehaviour: AxieSampleCharacterBehaviour<TClip> | undefined;
    fullCharacterBehaviour: AxieSampleCharacterBehaviour<TClip> | undefined;
    weaponPrefabs: TPrefab[];
    moveSpeed: number;
    stunned: boolean;
    axieClass: AxiePartDescriptor['class'];
    axieVariant: number;
    liteAnimatorController: AxieSampleAnimatorOverrideController<TClip> | undefined;
    fullAnimatorController: AxieSampleAnimatorOverrideController<TClip> | undefined;
    constructor(liteAnimator: AxieSampleAnimator, fullAnimator: AxieSampleAnimator, values?: AnimatorSampleOptions<TClip, TPrefab, TInstance>);
    get currentWeaponPrefab(): TPrefab | null;
    get weapons(): readonly AxieSampleWeaponMount<TInstance>[];
    get canUseWeaponActions(): boolean;
    Start(): Promise<AxieDescriptor>;
    Update(): void;
    Trigger(name: AxieSampleAnimatorTrigger): boolean;
    Attack(): boolean;
    Skill(): boolean;
    Dead(): boolean;
    Restart(): boolean;
    SelectAxieClass(axieClass: typeof AXIE_SAMPLE_CLASSES[number]): Promise<AxieDescriptor>;
    SelectAxieVariant(variant: typeof AXIE_SAMPLE_VARIANTS[number]): Promise<AxieDescriptor>;
    UpdateAnimations(weaponName: string | undefined): void;
    EquipWeapon(prefab: TPrefab | null): void;
    RebuildAxie(): Promise<AxieDescriptor>;
}
export interface AxieSampleLegacyAnimation<TClip = unknown> {
    wrapMode: string;
    addClip(clip: TClip, name: string): void;
    play(name: string): void;
}
export interface AxieSampleLegacyClipRuntime<TClip = unknown> {
    instantiate(clip: TClip): TClip;
    setLegacy(clip: TClip, legacy: boolean): void;
    destroy(clip: TClip): void;
}
export interface LegacyAnimationSampleOptions<TClip = unknown, TPrefab = unknown, TInstance = unknown> {
    readonly weaponRuntime?: AxieSampleWeaponRuntimeAdapter<TPrefab, TInstance>;
    readonly createAnimation?: (character: AxieSampleCharacter<TClip>, kind: AxieSampleCharacterKind) => AxieSampleLegacyAnimation<TClip>;
    readonly clipRuntime?: AxieSampleLegacyClipRuntime<TClip>;
}
/** Exact browser compatibility projection of `LegacyAnimationSample.cs`. */
export declare class LegacyAnimationSample<TClip = unknown, TPrefab = unknown, TInstance = unknown> {
    #private;
    liteCharacterBehaviour: AxieSampleCharacterBehaviour<TClip>;
    fullCharacterBehaviour: AxieSampleCharacterBehaviour<TClip>;
    weaponPrefabs: TPrefab[];
    axieClass: AxiePartDescriptor['class'];
    axieVariant: number;
    currentAnimation: AxieSampleLegacyAnimationName;
    liteAnimation: AxieSampleLegacyAnimation<TClip> | undefined;
    fullAnimation: AxieSampleLegacyAnimation<TClip> | undefined;
    constructor(liteCharacterBehaviour: AxieSampleCharacterBehaviour<TClip>, fullCharacterBehaviour: AxieSampleCharacterBehaviour<TClip>, weaponPrefabs?: TPrefab[], values?: LegacyAnimationSampleOptions<TClip, TPrefab, TInstance>);
    get currentWeaponPrefab(): TPrefab | null;
    get weapons(): readonly AxieSampleWeaponMount<TInstance>[];
    get canUseWeaponActions(): boolean;
    Start(): Promise<AxieDescriptor>;
    PlayAnimation(animationName: AxieSampleLegacyAnimationName): void;
    PlayWeaponAnimation(animationName: 'Attack' | 'Skill'): boolean;
    SelectAxieClass(axieClass: typeof AXIE_SAMPLE_CLASSES[number]): Promise<AxieDescriptor>;
    SelectAxieVariant(variant: typeof AXIE_SAMPLE_VARIANTS[number]): Promise<AxieDescriptor>;
    ReplaceClip(animation: AxieSampleLegacyAnimation<TClip>, clipMap: Map<string, TClip>, clipName: string, sourceClip: TClip): void;
    UpdateAnimations(weaponName: string | undefined): void;
    EquipWeapon(prefab: TPrefab | null): void;
    RebuildAxie(): Promise<AxieDescriptor>;
}
export declare const AXIE_AVATAR_SAMPLE_VIEW_DIRECTION: readonly [-0.32139380484326957, -0.3420201433256687, -0.883022221559489];
export interface AxieAvatarSampleCharacter<TClip = THREE.AnimationClip> {
    readonly Root: THREE.Object3D;
    GetLiteAnimationClip(name: string): TClip;
    RenderAvatar(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, options: AxieAvatarRenderOptions): unknown;
}
export interface AxieAvatarSampleBehaviour<TClip = THREE.AnimationClip> {
    readonly Character: AxieAvatarSampleCharacter<TClip> | null;
    readonly Avatars: readonly (THREE.Texture | THREE.WebGLRenderTarget)[];
    enabled?: boolean;
    Start?(): unknown | Promise<unknown>;
}
export interface AxieAvatarImageTarget {
    texture?: THREE.Texture | THREE.WebGLRenderTarget;
}
export interface AxieAvatarSampleAnimation<TClip = THREE.AnimationClip> {
    addClip(clip: TClip, name: string): void;
    play(name: string): void;
    update?(deltaSeconds: number): void;
}
export interface AxieAvatarSampleAnimationRuntime<TClip = THREE.AnimationClip> {
    instantiate(clip: TClip): TClip;
    setLegacy(clip: TClip, legacy: boolean): void;
    setWrapMode(clip: TClip, mode: 'Loop'): void;
    create(root: THREE.Object3D): AxieAvatarSampleAnimation<TClip>;
}
export interface AxieAvatarsOptions<TClip = THREE.AnimationClip> {
    readonly renderer?: THREE.WebGLRenderer;
    readonly animationRuntime?: AxieAvatarSampleAnimationRuntime<TClip>;
    readonly createRenderTarget?: () => THREE.WebGLRenderTarget;
}
/** Exact browser lifecycle projection of `Samples~/Axie Avatars/AxieAvatars.cs`. */
export declare class AxieAvatars<TClip = THREE.AnimationClip> {
    #private;
    characterBehaviour: AxieAvatarSampleBehaviour<TClip>;
    avatarImage0: AxieAvatarImageTarget;
    avatarImage1: AxieAvatarImageTarget;
    renderImage: AxieAvatarImageTarget;
    realtimeAvatar: THREE.WebGLRenderTarget | null;
    renderParams: AxieAvatarRenderParams | null;
    animationClip: TClip | null;
    animation: AxieAvatarSampleAnimation<TClip> | null;
    constructor(characterBehaviour: AxieAvatarSampleBehaviour<TClip>, avatarImage0: AxieAvatarImageTarget, avatarImage1: AxieAvatarImageTarget, renderImage: AxieAvatarImageTarget, values?: AxieAvatarsOptions<TClip>);
    get initialized(): boolean;
    get delayedFrame(): number;
    /** Starts the coroutine; call AdvanceFrame once per rendered frame. */
    Start(): void;
    /** Three empty frames, enable CharacterBehaviour, one empty frame, then initialize. */
    AdvanceFrame(): Promise<boolean>;
    Update(deltaSeconds?: number): unknown;
    OnDestroy(): void;
}
//# sourceMappingURL=source-sample-compatibility.d.ts.map