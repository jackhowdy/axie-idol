import type * as THREE from 'three';
import type { AxieAvatarRenderOptions } from './avatar.js';
import type { AxieDescriptor } from './domain.js';
import { AxieDescriptorCompatibility, AxieMixerConfigCompatibility } from './source-compatibility.js';
/** Same-origin server endpoint shipped by this repository. */
export declare const AXIE_GENES_API_ENDPOINT: "/api/axies/{id}";
/** @deprecated Use AXIE_GENES_API_ENDPOINT. This alias no longer points at GraphQL. */
export declare const AXIE_GENES_GRAPHQL_URL: "/api/axies/{id}";
export declare class AxieGenesFetchRequest {
    query: string;
    constructor(query?: string);
}
export declare class AxieGenesDecoderAxie {
    newGenes: string | null;
    constructor(newGenes?: string | null);
}
export declare class AxieGenesDecoderData {
    axie: AxieGenesDecoderAxie | null;
    constructor(axie?: AxieGenesDecoderAxie | null);
}
export declare class AxieGenesFetchResponse {
    data: AxieGenesDecoderData;
    constructor(data?: AxieGenesDecoderData);
}
export interface AxieGenesFetchResult {
    readonly ok: boolean;
    json(): Promise<unknown>;
}
export type AxieGenesFetch = (input: string, init: RequestInit) => Promise<AxieGenesFetchResult>;
/** Browser editor/debug facade for the source AxieGenesDecoder window. */
export declare class AxieGenesDecoderEditor {
    id: number;
    genes: string;
    descriptor: AxieDescriptorCompatibility;
    readonly fetchGenes: AxieGenesFetch;
    constructor(fetchGenes?: AxieGenesFetch);
    static Open(fetchGenes?: AxieGenesFetch): AxieGenesDecoderEditor;
    BuildRequest(id?: number): AxieGenesFetchRequest;
    DecodeGenes(genes?: string): AxieDescriptorCompatibility;
    FetchGenes(id?: number): Promise<AxieDescriptorCompatibility | undefined>;
}
/** Browser import adapter for Unity's ScriptedImporter/JsonUtility projection. */
export declare class AxieMixerConfigImporter {
    OnImportAsset(json: string): AxieMixerConfigCompatibility;
}
export interface AxieAvatarPreviewCharacter {
    RenderAvatar?(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, options: AxieAvatarRenderOptions): unknown;
    renderAvatar?(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, options: AxieAvatarRenderOptions): unknown;
}
export interface AxieAvatarPreviewSelection {
    readonly active: boolean;
    readonly character?: AxieAvatarPreviewCharacter;
    readonly cachedAvatars?: readonly THREE.Texture[];
}
export interface AxieAvatarPreviewResult {
    readonly rendered: boolean;
    readonly renderResult?: unknown;
    readonly cachedAvatars: readonly THREE.Texture[];
    readonly message?: string;
}
/** Continuous creator/debug preview equivalent without coupling it to DOM UI. */
export declare class AxieAvatarPreview {
    static Open(): AxieAvatarPreview;
    RenderSelection(selection: AxieAvatarPreviewSelection | null | undefined, renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, options: AxieAvatarRenderOptions): AxieAvatarPreviewResult;
}
export interface AxieCharacterBehaviourCompatibility {
    readonly descriptor?: AxieDescriptor;
    readonly Character?: unknown;
    readonly Avatars?: readonly THREE.Texture[];
}
//# sourceMappingURL=source-editor-compatibility.d.ts.map