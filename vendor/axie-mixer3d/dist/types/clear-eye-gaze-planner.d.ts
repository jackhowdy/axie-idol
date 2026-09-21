export type AxieEyeGazePhase = 'fixation' | 'saccade';
export interface AxieEyeGazePoint {
    readonly x: number;
    readonly y: number;
}
export interface AxieAmbientGazeInspection {
    readonly phase: AxieEyeGazePhase;
    readonly gaze: AxieEyeGazePoint;
    readonly target: AxieEyeGazePoint;
    readonly drift: AxieEyeGazePoint;
    readonly microOffset: AxieEyeGazePoint;
    readonly saccadeProgress: number;
    readonly saccadeStarted: boolean;
    readonly saccadeDistance: number;
    readonly saccadeCount: number;
    readonly microSaccadeCount: number;
}
/**
 * Keeps a normalized gaze command inside the circular anatomical travel
 * envelope. Axis-wise clamping lets diagonal commands overdrive a pupil.
 */
export declare function clampAxieEyeGaze(x: number, y: number): AxieEyeGazePoint;
/**
 * Deterministic, engine-neutral eye motor. It models quiet fixations separated
 * by fast minimum-jerk saccades, with tiny micro-saccades and ocular drift
 * inside each fixation. Consumers can run it without Three.js or a DOM.
 */
export declare class AxieAmbientGazePlanner {
    #private;
    constructor(seed?: number, initialGaze?: AxieEyeGazePoint);
    update(deltaSeconds: number): AxieAmbientGazeInspection;
    inspect(): AxieAmbientGazeInspection;
}
//# sourceMappingURL=clear-eye-gaze-planner.d.ts.map