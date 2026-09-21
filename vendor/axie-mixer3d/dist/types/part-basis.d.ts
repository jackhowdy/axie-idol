import * as THREE from 'three';
import type { AxieExporterRestPoseV1 } from './exporter-schema.js';
export interface AxiePartAttachmentBasis {
    /** Local matrix assigned to the cloned rigid part under Root_*_JNT. */
    readonly localMatrix: THREE.Matrix4;
    /** Standalone part FBX/glTF export basis retained above its selected mesh. */
    readonly partExportMatrix: THREE.Matrix4;
    /** Exact GLB-bone-local bridge into X-reflected Unity coordinates. */
    readonly attachBridgeMatrix: THREE.Matrix4;
    /**
     * Converts a Unity object-space distance into the standalone GLB mesh's
     * retained object units. Blender keeps source vertices centimeter-valued
     * beneath a uniform 0.01 exporter basis, so this is 100 for every current
     * production rigid-part LOD. Deriving it from the measured hierarchy keeps
     * the shader bridge truthful if that exporter basis ever changes.
     */
    readonly sourceObjectUnitScale: number;
    /** Maps converted GLB geometry coordinates back to Unity renderer object space. */
    readonly unityObjectFromGeometry: THREE.Matrix4;
    readonly sourcePath: string;
    readonly reconstructionError: number;
}
export interface AxieBodyRestPartAttachmentBasis {
    /** Local matrix assigned under the target bone. */
    readonly localMatrix: THREE.Matrix4;
    /** Target bone transform relative to the complete body scene root. */
    readonly attachRestMatrix: THREE.Matrix4;
    /** Canonical source-body socket in exact Unity world coordinates. */
    readonly referenceAttachRestMatrix: THREE.Matrix4;
    /** Source node transform relative to its complete converted GLB scene root. */
    readonly partRestMatrix: THREE.Matrix4;
    /** Part transform after the canonical source socket is retargeted to the target body socket. */
    readonly retargetedPartRestMatrix: THREE.Matrix4;
    readonly sourceObjectUnitScale: number;
    readonly unityObjectFromGeometry: THREE.Matrix4;
    readonly sourcePath: string;
    readonly reconstructionError: number;
}
export interface AxieSocketLocalPartAttachmentBasis {
    /** Unity AxieFactory parents the generated renderer with identity local TRS. */
    readonly localMatrix: THREE.Matrix4;
    /** Authored Unity/FBX meshes use centimeters beneath the body exporter root. */
    readonly sourceObjectUnitScale: number;
    /** No standalone exporter or cross-body shader bridge remains at runtime. */
    readonly unityObjectFromGeometry: THREE.Matrix4;
    readonly sourcePath: string;
    readonly reconstructionError: number;
}
/**
 * Validate the production artifact contract used by Unity's AxieFactory:
 * shared mesh geometry is already socket-local and its new renderer object is
 * identity-local beneath the last matching Root_*_JNT transform.
 */
export declare function buildAxieSocketLocalPartAttachmentBasis(partSourceRoot: THREE.Object3D, selectedPartNode: THREE.Object3D, objectUnitsPerMeter?: number): AxieSocketLocalPartAttachmentBasis;
/** Recover the reciprocal uniform scale retained by a converted part GLB. */
export declare function axieSourceObjectUnitScale(exportMatrix: THREE.Matrix4): number;
/**
 * Unity creates each rigid MeshRenderer GameObject identity-local beneath the
 * body attach Transform. The shipping part mesh, however, was converted in a
 * standalone FBX/glTF and its exporter basis lives in ancestors above the
 * selected scene node. Dropping those ancestors and attaching identity-local
 * loses that basis (the visible 90-degree/offset bug).
 *
 * The exact replacement is:
 *
 *   L_part = B_attach * C_partExport
 *
 * where B_attach satisfies G_bone * B_attach = H * U_bone * H and
 * C_partExport is measured from the actual standalone part GLB hierarchy.
 */
export declare function buildAxiePartAttachmentBasis(bodyRoot: THREE.Object3D, restPose: AxieExporterRestPoseV1, attachNode: THREE.Object3D, partSourceRoot: THREE.Object3D, selectedPartNode: THREE.Object3D): AxiePartAttachmentBasis;
/**
 * Attach a rigid surface whose vertices were authored in the whole Axie rest
 * frame. Unity creates the corresponding rigid MeshRenderer identity-local
 * under its socket. If U_r is the source/reference Unity socket, U_t is the
 * target Unity socket, and C is the converted visible part matrix, the exact
 * desired rest world is U_t U_r^-1 C. The actual glTF attach matrix G_t is
 * used only to solve the local matrix G_t^-1 U_t U_r^-1 C. Handedness
 * conjugation belongs to the skeleton bridge, not to visible geometry; using
 * H U H here swaps bilateral surfaces and visibly displaces wide bodies.
 */
export declare function buildAxieBodyRestPartAttachmentBasis(bodyRoot: THREE.Object3D, attachNode: THREE.Object3D, partSourceRoot: THREE.Object3D, selectedPartNode: THREE.Object3D, referenceUnityAttachRestMatrix: THREE.Matrix4, targetUnityAttachRestMatrix: THREE.Matrix4): AxieBodyRestPartAttachmentBasis;
//# sourceMappingURL=part-basis.d.ts.map