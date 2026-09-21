/**
 * Engine-neutral facade for the source URP renderer feature. It preserves the
 * feature/pass API and command ordering without implementing the shader itself.
 */
export declare const AXIE_OUTLINE_POST_PROCESS_SHADER_NAME: "Axie Mixer 3D/Outline/PostProcess";
export declare const AXIE_OUTLINE_INPUTS: readonly ["Normal", "Depth"];
export type AxieOutlineColor = readonly [r: number, g: number, b: number, a: number];
export type AxieOutlineRenderPassEvent = 'AfterRenderingPostProcessing' | string | number;
export declare class OutlinePostProcessSettings {
    outlineColor: AxieOutlineColor;
    thickness: number;
    depthScale: number;
    depthBias: number;
    normalScale: number;
    normalBias: number;
    renderPassEvent: AxieOutlineRenderPassEvent;
    constructor(values?: Partial<OutlinePostProcessSettings>);
}
export interface AxieOutlineMaterialCompatibility {
    setFloat(name: string, value: number): void;
    setColor(name: string, value: AxieOutlineColor): void;
    dispose?(): void;
}
export interface AxieOutlineRendererCompatibility {
    enqueuePass(pass: OutlinePass): void;
}
export interface AxieOutlineRenderingDataCompatibility {
    readonly cameraType: string;
    readonly cameraColorTarget: unknown;
}
export interface AxieOutlineCommandCompatibility {
    readonly name: 'AxieMixer3D.OutlinePostProcessRendererFeature';
    readonly source: 'None';
    readonly target: unknown;
    readonly material: AxieOutlineMaterialCompatibility;
    readonly materialPass: 0;
}
export interface AxieOutlineCommandContextCompatibility {
    executeCommand(command: AxieOutlineCommandCompatibility): void;
    releaseCommand?(command: AxieOutlineCommandCompatibility): void;
}
export declare class OutlinePass {
    readonly material: AxieOutlineMaterialCompatibility;
    renderPassEvent: AxieOutlineRenderPassEvent;
    configuredInputs: readonly ('Normal' | 'Depth')[];
    constructor(material: AxieOutlineMaterialCompatibility);
    ConfigureInput(inputs: readonly ('Normal' | 'Depth')[]): void;
    Execute(context: AxieOutlineCommandContextCompatibility, renderingData: AxieOutlineRenderingDataCompatibility): AxieOutlineCommandCompatibility;
}
export declare class OutlinePostProcessRendererFeature {
    readonly createMaterial: (shaderName: typeof AXIE_OUTLINE_POST_PROCESS_SHADER_NAME) => AxieOutlineMaterialCompatibility;
    static readonly Settings: typeof OutlinePostProcessSettings;
    static readonly OutlinePass: typeof OutlinePass;
    static readonly ShaderName: "Axie Mixer 3D/Outline/PostProcess";
    readonly settings: OutlinePostProcessSettings;
    material: AxieOutlineMaterialCompatibility | undefined;
    outlinePass: OutlinePass | undefined;
    constructor(settings?: OutlinePostProcessSettings | Partial<OutlinePostProcessSettings>, createMaterial?: (shaderName: typeof AXIE_OUTLINE_POST_PROCESS_SHADER_NAME) => AxieOutlineMaterialCompatibility);
    Create(): OutlinePass;
    AddRenderPasses(renderer: AxieOutlineRendererCompatibility, renderingData: AxieOutlineRenderingDataCompatibility): boolean;
    Dispose(disposing?: boolean): void;
}
//# sourceMappingURL=source-outline-compatibility.d.ts.map