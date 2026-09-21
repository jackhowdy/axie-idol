import * as THREE from 'three';
import type { AxieExporterRestPoseV1 } from './exporter-schema.js';
export interface AxieConvertedRestWorldBasis {
    /** Unity rest-world matrix converted into the runtime glTF handedness. */
    readonly matrix: THREE.Matrix4;
    readonly sourcePath: string;
}
export interface AxieUnityRestWorldBasis {
    /** Exact Unity rest-world matrix, before any glTF handedness conversion. */
    readonly matrix: THREE.Matrix4;
    readonly sourcePath: string;
}
/** Resolve one unique authoritative rest-pose node in Unity coordinates. */
export declare function buildAxieUnityRestWorldBasis(restPose: AxieExporterRestPoseV1, nodeName: string): AxieUnityRestWorldBasis;
/** Resolve one unique authoritative rest-pose node in runtime handedness. */
export declare function buildAxieConvertedRestWorldBasis(restPose: AxieExporterRestPoseV1, nodeName: string): AxieConvertedRestWorldBasis;
export interface AxieAddonBoneBasis {
    /** Exact local matrix needed before a Unity-authored, X-conjugated prefab. */
    readonly bridgeMatrix: THREE.Matrix4;
    /**
     * Correction placed before ThreeAddonPrefabFactory's authored unit bridge.
     * This is identity for the regular bodies and also preserves Frosty's
     * source-specific attachment offsets/rotations instead of assuming them.
     */
    readonly factoryCorrectionMatrix: THREE.Matrix4;
    readonly sourcePath: string;
    readonly reconstructionError: number;
}
/**
 * Solves an add-on attachment from the authoritative Unity prefab rest pose
 * and the actual converted GLB bone. Blender's export mirrors local X and
 * retains centimeter-valued bone locals under Model's 0.01 scale, but that
 * convenient 100x shortcut is not exact for every body (notably Frosty).
 *
 * The solved bridge B satisfies, mechanically:
 *
 *   G_bone * B = H * U_bone * H
 *
 * where H mirrors X, U is the Unity rest-world matrix, and G is the converted
 * GLB rest-world matrix relative to the selected body root's parent.
 */
export declare function buildAxieAddonBoneBasis(bodyRoot: THREE.Object3D, restPose: AxieExporterRestPoseV1, attachBone: THREE.Object3D, factoryUnitScale?: number): AxieAddonBoneBasis;
//# sourceMappingURL=addon-basis.d.ts.map