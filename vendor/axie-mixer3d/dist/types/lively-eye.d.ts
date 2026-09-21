import * as THREE from 'three';
import { type AxieDescriptor } from './domain.js';
import type { AxieQualityProfile } from './quality.js';
import type { AxiePlayableCharacter } from './runtime.js';
export { AXIE_KOTARO_EYE_L1_APERTURE_SVG, AXIE_KOTARO_EYE_L1_APERTURE_SVG_SHA256, AXIE_KOTARO_EYE_L1_MASTER_PATH_COUNT, AXIE_KOTARO_EYE_L1_PUPIL_FREE_PATH_COUNT, AXIE_KOTARO_EYE_L1_PUPIL_FREE_SVG, AXIE_KOTARO_EYE_L1_PUPIL_FREE_SVG_SHA256, AXIE_KOTARO_EYE_L1_PUPIL_ONLY_SVG, AXIE_KOTARO_EYE_L1_PUPIL_ONLY_SVG_SHA256, AXIE_KOTARO_EYE_L1_PUPIL_PATH_COUNT, AXIE_KOTARO_EYE_L1_PUPIL_PATH_TAGS_SHA256, AXIE_KOTARO_EYE_L1_REMOVED_PUPIL_PATH_INDICES, AXIE_KOTARO_EYE_L1_SVG_SHA256, } from './kotaro-eye-source.generated.js';
import { type AxieEyeGazePhase } from './clear-eye-gaze-planner.js';
export declare const AXIE_CLEAR_EYE_L1_PART_ID: "S00_Aquatic04_L1_Eye";
export declare const AXIE_KOTARO_EYE_L1_PART_ID: "S00_Bug10_L1_Eye";
export declare const AXIE_EYE_EXPRESSIONS: readonly ["neutral", "happy", "sad", "angry", "surprised", "squint"];
export declare const AXIE_EYE_GAZE_MODES: readonly ["ambient", "fixed", "pointer"];
export declare const AXIE_CLEAR_EYE_GAZE_TRAVEL: Readonly<{
    positiveX: 0.34;
    negativeX: 0.35;
    positiveY: 0.42;
    negativeY: 0.31;
}>;
export type AxieEyeExpression = typeof AXIE_EYE_EXPRESSIONS[number];
export type AxieEyeGazeMode = typeof AXIE_EYE_GAZE_MODES[number];
export interface AxieEyePerformanceConfig {
    readonly expression: AxieEyeExpression;
    readonly expressionIntensity: number;
    readonly gazeMode: AxieEyeGazeMode;
    readonly fixedGaze: Readonly<{
        x: number;
        y: number;
    }>;
    readonly autoBlink: boolean;
}
export interface AxieEyePerformanceConfigPatch {
    readonly expression?: AxieEyeExpression;
    readonly expressionIntensity?: number;
    readonly gazeMode?: AxieEyeGazeMode;
    readonly fixedGaze?: Readonly<{
        x: number;
        y: number;
    }>;
    readonly autoBlink?: boolean;
}
export interface AxieEyeRuntimeInspection {
    readonly supported: boolean;
    readonly profile: 'clear-l1' | 'kotaro-l1' | undefined;
    readonly partId: string | undefined;
    readonly sourceSvgSha256: string | undefined;
    readonly pupilFreeSvgSha256: string | undefined;
    readonly pupilOnlySvgSha256: string | undefined;
    readonly apertureMaskSvgSha256: string | undefined;
    readonly boundMeshes: number;
    readonly boundMaterials: number;
    readonly textureResolution: number;
    readonly textureRevision: number;
    readonly textureCount: number;
    readonly expression: AxieEyeExpression;
    readonly expressionIntensity: number;
    readonly gazeMode: AxieEyeGazeMode;
    readonly gaze: Readonly<{
        x: number;
        y: number;
    }>;
    readonly ambientGazePhase: AxieEyeGazePhase | undefined;
    readonly ambientGazeTarget: Readonly<{
        x: number;
        y: number;
    }>;
    readonly ambientSaccadeCount: number;
    readonly ambientMicroSaccadeCount: number;
    readonly autoBlink: boolean;
    readonly blinkWeight: number;
    readonly blinkCount: number;
    readonly pointerTargetValid: boolean;
    readonly disposed: boolean;
}
export interface AxieEyeController {
    readonly supported: boolean;
    readonly partId: string | undefined;
    readonly config: AxieEyePerformanceConfig;
    setConfig(patch: AxieEyePerformanceConfigPatch): void;
    setPointerGaze(x: number, y: number, valid?: boolean): void;
    blink(): boolean;
    update(deltaSeconds: number): void;
    inspect(): AxieEyeRuntimeInspection;
    dispose(): void;
}
export interface AxieEyeControllerTarget {
    readonly model: THREE.Object3D;
    readonly descriptor: AxieDescriptor;
    readonly quality: AxieQualityProfile;
}
export interface CreateAxieEyeControllerOptions {
    /** Override with a caller-prepared pupil-free authoring derivative. */
    readonly svgSource?: string;
    /** Defaults to 256 for Unity-import profiles and 1024 for source profiles. */
    readonly textureResolution?: number;
    /** Deterministic seed for ambient gaze and automatic blink scheduling. */
    readonly randomSeed?: number;
    readonly initialConfig?: AxieEyePerformanceConfigPatch;
}
interface EyeShape {
    aperture: number;
    tilt: number;
    lowerLift: number;
    pupilScale: number;
}
export declare function resolveAxieEyeShape(expression: AxieEyeExpression, intensity?: number): Readonly<EyeShape>;
export declare function evaluateAxieBlinkWeight(elapsedSeconds: number): number;
/**
 * Binds a sealed lively-eye profile to an assembled Axie. SVG layers are
 * rasterized only during construction; gaze, blink and expressions then touch
 * shader uniforms on the original curved Eye_M mesh.
 */
export declare function createAxieEyeController(target: AxieEyeControllerTarget | AxiePlayableCharacter, options?: CreateAxieEyeControllerOptions): Promise<AxieEyeController>;
//# sourceMappingURL=lively-eye.d.ts.map