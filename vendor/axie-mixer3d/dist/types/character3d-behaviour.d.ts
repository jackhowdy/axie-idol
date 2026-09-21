import * as THREE from 'three';
import { AxieAvatarRenderParams } from './avatar.js';
import { AxieCharacter3D, type AxieCharacter3DFactory } from './character3d.js';
import type { AxieDescriptor } from './domain.js';
export interface AxieCharacter3DBehaviourOptions {
    readonly renderer: THREE.WebGLRenderer;
    readonly transform?: THREE.Group;
    readonly factory?: AxieCharacter3DFactory;
    readonly createRenderTarget?: () => THREE.WebGLRenderTarget;
}
/** ARGB32-equivalent RGBA8 target with an explicit unsigned 16-bit depth texture. */
export declare function createAxieAvatarRenderTarget(): THREE.WebGLRenderTarget<THREE.Texture>;
/** Async browser equivalent of the Unity lifecycle component. */
export declare class AxieCharacter3DBehaviour {
    #private;
    axieGenes: string;
    axieDescriptor: AxieDescriptor;
    avatarRenderParams: AxieAvatarRenderParams[];
    readonly transform: THREE.Group;
    constructor(options: AxieCharacter3DBehaviourOptions);
    get Character(): AxieCharacter3D | null;
    get Avatars(): readonly THREE.WebGLRenderTarget[];
    get disposed(): boolean;
    Start(): Promise<AxieCharacter3D | null>;
    /** @deprecated Use Rebuild(). */
    Refresh(): Promise<AxieCharacter3D | null>;
    Rebuild(): Promise<AxieCharacter3D | null>;
    OnDestroy(): void;
    dispose(): void;
}
//# sourceMappingURL=character3d-behaviour.d.ts.map