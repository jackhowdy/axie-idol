import * as THREE from 'three';
import type { AxieDiagnosticEvent } from './diagnostics.js';
import type { AxieExporterAnimationPayloadV1, AxieExporterRestPoseV1 } from './exporter-schema.js';
import type { AxieAnimationClipManifest } from './manifest.js';
export interface AxieAnimationCoordinateConverter {
    position(x: number, y: number, z: number): readonly [number, number, number];
    quaternion(x: number, y: number, z: number, w: number): readonly [number, number, number, number];
    scale(x: number, y: number, z: number): readonly [number, number, number];
}
export declare const AXIE_ANIMATION_IDENTITY_COORDINATES: AxieAnimationCoordinateConverter;
/**
 * Reflection across Z for a direct Unity-left-handed to Three-right-handed
 * conversion. Use only when the model conversion applies the same reflection;
 * most FBX-to-glTF pipelines bake their own axis transform and should use the
 * identity converter.
 */
export declare const AXIE_ANIMATION_UNITY_Z_REFLECTION: AxieAnimationCoordinateConverter;
export interface AxieSampledAnimationResult {
    readonly clips: readonly THREE.AnimationClip[];
    readonly events: readonly AxieDiagnosticEvent[];
    readonly payloads: readonly AxieExporterAnimationPayloadV1[];
}
export interface SampledAnimationJsonLoaderOptions {
    readonly fetchJson?: (url: string, signal?: AbortSignal) => Promise<unknown>;
    readonly fetchArrayBuffer?: (url: string, signal?: AbortSignal) => Promise<ArrayBuffer>;
    /**
     * Resolves every animation resource through one contract. Top-level calls
     * omit baseUrl; rest poses, JSON indexes and AXANIM payloads receive the
     * already-resolved parent URL as baseUrl.
     */
    readonly resolveUrl?: (url: string, baseUrl?: string) => string;
    readonly coordinates?: AxieAnimationCoordinateConverter;
    /** Production AXANIM must use source-rest/GLB-rest change-of-basis retargeting. */
    readonly requireRestPoseForBinary?: boolean;
    readonly onDiagnostic?: (event: AxieDiagnosticEvent) => void;
}
export declare function isAxieExporterRestPoseV1(value: unknown): value is AxieExporterRestPoseV1;
/** Resolve a Unity animation binding path exactly relative to its Animator root. */
export declare function resolveAxieUnityTransformPath(root: THREE.Object3D, path: string): THREE.Object3D<THREE.Object3DEventMap> | undefined;
interface AxieTrackRetargetBasis {
    readonly parentInverse: THREE.Matrix4;
    readonly child: THREE.Matrix4;
}
/**
 * Solve the per-node FBX basis from the authoritative Unity rest rotations and
 * the actual GLB exporter transform retained on `Model`.
 *
 * Blender's body export retains one +90-degree X / 0.01 `Model` matrix and
 * mirrors Unity X. The reflection is a coordinate conversion, so a Unity local
 * transform must first be conjugated by H. Every node basis C then has the
 * exporter's uniform scale and a source-derived rotation, but exactly zero
 * translation:
 *
 *   U_h(t) = H * U(t) * H
 *   G_local(t) = inverse(C_parent) * U_h(t) * C_child
 *
 * Solving a general affine C from rest positions also satisfies the single
 * rest frame, but its invented translations rotate during animation and pull
 * limbs and weapon sockets apart. Rotation-only bases preserve every authored
 * segment vector and apply the same equation to deformation bones and
 * Root_Weapon_L/R alike.
 */
export declare function buildAxieAnimationRetargetBases(root: THREE.Object3D, restPose: AxieExporterRestPoseV1): Map<string, AxieTrackRetargetBasis>;
/** Decode the production AXANIM1 container without changing its Float32 samples. */
export declare function decodeAxieAnimationBinary(buffer: ArrayBuffer): AxieExporterAnimationPayloadV1;
/**
 * Caches raw immutable JSON, then compiles UUID-bound clips per body instance.
 * Source-local missing paths are omitted like Unity's unbound curves. Sealed
 * target-GLB-local payloads instead reject any missing path because their
 * samples were composed against that exact shipped hierarchy.
 */
export declare class SampledAnimationJsonLoader {
    #private;
    constructor(options?: SampledAnimationJsonLoaderOptions);
    loadClip(url: string, root: THREE.Object3D, signal?: AbortSignal, runtimeName?: string): Promise<AxieSampledAnimationResult>;
    /** Shared cached access for animation retargeting and exact add-on bases. */
    loadRestPose(url: string, signal?: AbortSignal, expectedBody?: string): Promise<AxieExporterRestPoseV1>;
    loadBundle(url: string, root: THREE.Object3D, signal?: AbortSignal, expectedClips?: readonly AxieAnimationClipManifest[], restPoseUrl?: string): Promise<AxieSampledAnimationResult>;
    compile(payloads: readonly AxieExporterAnimationPayloadV1[], root: THREE.Object3D, runtimeNames?: ReadonlyMap<string, string>, restPose?: AxieExporterRestPoseV1): AxieSampledAnimationResult;
    clearCache(): void;
}
export {};
//# sourceMappingURL=sampled-animation.d.ts.map