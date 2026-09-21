import * as THREE from 'three';
/**
 * Exact browser translation of
 * `Resources/AxieMixer3D/Shaders/Outline/PostProcess.shader`.
 *
 * The Unity shader is an overlay: it does not sample camera colour. It samples
 * the camera depth and normal inputs, emits the configured outline colour, and
 * blends that colour over the already-rendered camera target. The authored
 * shader multiplies `_Thickness` twice; retaining that thickness-squared pixel
 * radius is intentional source parity, not a typo.
 *
 * This is an opt-in translation, not a default mixer render stage. The pinned
 * package requires manual renderer-feature setup, and neither delivered Unity
 * renderer asset installs that feature. Keep it dormant until a newer
 * authoritative renderer graph proves activation; see
 * `docs/outline-postprocess-runtime-verdict.md`.
 */
export declare const AXIE_OUTLINE_POST_PROCESS_SOURCE: "Resources/AxieMixer3D/Shaders/Outline/PostProcess.shader";
export declare const AXIE_OUTLINE_POSTPROCESS_SHADER_NAME: "Axie Mixer 3D/Outline/PostProcess";
export declare const AXIE_OUTLINE_POST_PROCESS_EVENT: "AfterRenderingPostProcessing";
export declare const AXIE_OUTLINE_POST_PROCESS_INPUTS: readonly ["Normal", "Depth"];
export interface AxieOutlinePostProcessParameters {
    readonly outlineColor?: THREE.ColorRepresentation;
    readonly thickness?: number;
    readonly depthScale?: number;
    readonly depthBias?: number;
    readonly normalScale?: number;
    readonly normalBias?: number;
}
export interface AxieOutlineDepthProjection {
    readonly orthographic: boolean;
    /** Exact Unity `unity_OrthoParams.x` value used by the authored shader. */
    readonly unityOrthoParamX: number;
    readonly reversedZ?: boolean;
    readonly near?: number;
    readonly far?: number;
}
export interface AxieOutlineSobelSample {
    readonly centerDepth: number;
    /** Unity source order: +x, -x, +y, -y. */
    readonly adjacentDepths: readonly [number, number, number, number];
    readonly centerNormal: readonly [number, number, number];
    /** Unity source order: +x, -x, +y, -y. */
    readonly adjacentNormals: readonly [
        readonly [number, number, number],
        readonly [number, number, number],
        readonly [number, number, number],
        readonly [number, number, number]
    ];
}
export interface AxieOutlineSobelResult {
    readonly depth: number;
    readonly normal: number;
    readonly alpha: number;
}
export declare const AXIE_OUTLINE_POST_PROCESS_DEFAULTS: Readonly<{
    outlineColor: THREE.ColorRepresentation;
    thickness: 1;
    depthScale: 50;
    depthBias: 50;
    normalScale: 0.7;
    normalBias: 10;
}>;
export declare const AXIE_OUTLINE_POST_PROCESS_VERTEX_SHADER = "\nprecision highp float;\n\nattribute vec3 position;\nvarying vec2 vUv;\n\nvoid main() {\n  gl_Position = vec4(position.xy, 0.0, 1.0);\n  vUv = position.xy * 0.5 + 0.5;\n}\n";
export declare const AXIE_OUTLINE_POST_PROCESS_FRAGMENT_SHADER = "\nprecision highp float;\n\nuniform sampler2D _CameraDepthTexture;\nuniform sampler2D _CameraNormalsTexture;\nuniform vec4 _ScreenParams;\nuniform float _Thickness;\nuniform vec3 _Color;\nuniform float _DepthScale;\nuniform float _DepthBias;\nuniform float _NormalScale;\nuniform float _NormalBias;\nuniform float _UnityOrthoParamX;\nuniform float _ReversedZ;\nuniform vec4 _ZBufferParams;\n\nvarying vec2 vUv;\n\nfloat LinearizeDepth(float z) {\n  // The pinned source checks unity_OrthoParams.x rather than the projection\n  // type in .w. Preserve that authored branch, including its perspective-camera\n  // behavior, instead of silently correcting the shader.\n  if (_UnityOrthoParamX > 0.5) {\n    return _ReversedZ > 0.5 ? 1.0 - z : z;\n  }\n  return 1.0 / (_ZBufferParams.x * z + _ZBufferParams.y);\n}\n\nfloat SampleLinearDepth(vec2 uv) {\n  return LinearizeDepth(texture2D(_CameraDepthTexture, uv).r);\n}\n\nvec3 SampleSceneNormals(vec2 uv) {\n  return texture2D(_CameraNormalsTexture, uv).xyz;\n}\n\nfloat SobelDepth(vec2 uv, vec2 adjacentUVs[4]) {\n  float dc = SampleLinearDepth(uv);\n  vec4 d = vec4(\n    SampleLinearDepth(adjacentUVs[0]),\n    SampleLinearDepth(adjacentUVs[1]),\n    SampleLinearDepth(adjacentUVs[2]),\n    SampleLinearDepth(adjacentUVs[3])\n  );\n  return pow(length(d - vec4(dc)) * _DepthScale, _DepthBias);\n}\n\nfloat SobelNormal(vec2 uv, vec2 adjacentUVs[4]) {\n  vec3 nc = SampleSceneNormals(uv);\n  vec3 n0 = SampleSceneNormals(adjacentUVs[0]) - nc;\n  vec3 n1 = SampleSceneNormals(adjacentUVs[1]) - nc;\n  vec3 n2 = SampleSceneNormals(adjacentUVs[2]) - nc;\n  vec3 n3 = SampleSceneNormals(adjacentUVs[3]) - nc;\n  float n = sqrt(dot(n0, n0) + dot(n1, n1) + dot(n2, n2) + dot(n3, n3));\n  return pow(n * _NormalScale, _NormalBias);\n}\n\nvoid main() {\n  vec3 offset = vec3(_Thickness / _ScreenParams.xy, 0.0) * _Thickness;\n  vec2 adjacentUVs[4];\n  adjacentUVs[0] = vUv + offset.xz;\n  adjacentUVs[1] = vUv - offset.xz;\n  adjacentUVs[2] = vUv + offset.zy;\n  adjacentUVs[3] = vUv - offset.zy;\n  float sobelDepth = SobelDepth(vUv, adjacentUVs);\n  float sobelNormal = SobelNormal(vUv, adjacentUVs);\n  float sobelAlpha = clamp(max(sobelDepth, sobelNormal), 0.0, 1.0);\n  gl_FragColor = vec4(_Color, sobelAlpha);\n}\n";
export declare function axieOutlineUvOffset(thickness: number, width: number, height: number): readonly [number, number];
export declare function axieOutlineLinear01Depth(rawDepth: number, projection: AxieOutlineDepthProjection): number;
/** Unity Camera.orthographicSize defaults to 5 even in Perspective mode. */
export declare const AXIE_UNITY_DEFAULT_ORTHOGRAPHIC_SIZE = 5;
export declare const AXIE_UNITY_ORTHOGRAPHIC_SIZE_USER_DATA: "axieUnityOrthographicSize";
/**
 * Reconstructs URP 12.1.15's `unity_OrthoParams.x`:
 * `camera.orthographicSize * cameraData.aspectRatio`.
 *
 * The source PostProcess shader incorrectly uses this width value as its
 * projection-mode branch. Perspective cameras therefore normally enter the
 * raw-depth branch too. An imported Unity camera can preserve a non-default
 * orthographicSize through `camera.userData.axieUnityOrthographicSize`.
 */
export declare function axieUnityOrthoParamX(camera: THREE.Camera, width: number, height: number): number;
/** Deterministic CPU oracle for the authored fragment-shader equations. */
export declare function evaluateAxieOutlineSobel(sample: AxieOutlineSobelSample, parameters?: AxieOutlinePostProcessParameters): AxieOutlineSobelResult;
export declare class AxieOutlinePostProcessMaterial extends THREE.RawShaderMaterial {
    constructor(parameters?: AxieOutlinePostProcessParameters);
    setParameters(parameters: AxieOutlinePostProcessParameters): this;
    setInputTextures(depth: THREE.Texture, normals: THREE.Texture): this;
    setSize(width: number, height: number): this;
    setProjection(projection: AxieOutlineDepthProjection): this;
}
export interface AxieOutlinePostProcessPassOptions extends AxieOutlinePostProcessParameters {
    readonly width?: number;
    readonly height?: number;
}
export declare const AXIE_DEPTH_NORMALS_VERTEX_SHADER = "\nvarying vec2 vAxieDepthNormalUv;\nvarying vec3 vAxieWorldNormal;\nuniform vec4 uMainTexTransform;\nuniform mat3 uCameraToWorldNormal;\n\n#include <common>\n#include <batching_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n\nvoid main() {\n  vAxieDepthNormalUv = uv * uMainTexTransform.xy + uMainTexTransform.zw;\n\n  #include <morphinstance_vertex>\n  #include <batching_vertex>\n  #include <beginnormal_vertex>\n  #include <morphnormal_vertex>\n  #include <skinbase_vertex>\n  #include <skinnormal_vertex>\n  #include <defaultnormal_vertex>\n  #include <begin_vertex>\n  #include <morphtarget_vertex>\n  #include <skinning_vertex>\n  #include <project_vertex>\n\n  // Three's transformedNormal is view-space after skinning, morphing,\n  // batching/instancing, and inverse-transpose normal handling. Rotate it back\n  // to world space to match URP's TransformObjectToWorldNormal output.\n  vAxieWorldNormal = normalize(uCameraToWorldNormal * transformedNormal);\n}\n";
export declare const AXIE_DEPTH_NORMALS_FRAGMENT_SHADER = "\nprecision highp float;\n\nvarying vec2 vAxieDepthNormalUv;\nvarying vec3 vAxieWorldNormal;\nuniform sampler2D uMainTex;\nuniform float uAlphaClipEnabled;\nuniform float uQuantizeSnorm8;\n\nvec3 QuantizeSnorm8(vec3 value) {\n  vec3 clamped = clamp(value, -1.0, 1.0);\n  return sign(clamped) * floor(abs(clamped) * 127.0 + 0.5) / 127.0;\n}\n\nvoid main() {\n  // The generated V4 pass uses step(0.5, alpha), then clips against 0.01.\n  float sourceAlpha = step(0.5, texture2D(uMainTex, vAxieDepthNormalUv).a);\n  if (uAlphaClipEnabled > 0.5 && sourceAlpha < 0.01) discard;\n\n  vec3 worldNormal = normalize(vAxieWorldNormal);\n  if (uQuantizeSnorm8 > 0.5) worldNormal = QuantizeSnorm8(worldNormal);\n  gl_FragColor = vec4(worldNormal, 0.0);\n}\n";
export type AxieDepthNormalStorage = 'rgba16f-snorm8-quantized';
export interface AxieOutlinePrepassDiagnostics {
    readonly sourceRenderersVisited: number;
    readonly eligibleRenderers: number;
    readonly eligibleSubmeshes: number;
    readonly excludedOutlineRenderers: number;
    readonly excludedNonMeshRenderers: number;
    readonly excludedWithoutDepthNormalsPass: number;
    readonly excludedByRenderQueue: number;
    readonly excludedInvisibleMaterials: number;
    readonly normalStorage: AxieDepthNormalStorage;
    readonly normalEncoding: 'signed-world-normal';
    readonly snorm8Quantized: true;
    readonly framebufferStatus: number;
}
/**
 * Three/WebGL render adapter for Unity's ScriptableRenderPass contract.
 * Call `render()` only after the colour target has been rendered/postprocessed;
 * the method builds the required normal+depth inputs and alpha-blends the
 * outline onto that existing target without clearing it.
 */
export declare class AxieOutlinePostProcessPass {
    #private;
    readonly renderPassEvent: "AfterRenderingPostProcessing";
    readonly configuredInputs: readonly ["Normal", "Depth"];
    readonly material: AxieOutlinePostProcessMaterial;
    constructor(options?: AxieOutlinePostProcessPassOptions);
    get normalTexture(): THREE.Texture;
    get depthTexture(): THREE.DepthTexture;
    get diagnostics(): AxieOutlinePrepassDiagnostics | null;
    setParameters(parameters: AxieOutlinePostProcessParameters): this;
    setSize(width: number, height: number): this;
    renderInputs(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): AxieOutlinePrepassDiagnostics;
    /** Blend the source overlay into an existing encoded-Gamma accumulation target. */
    renderOverlay(renderer: THREE.WebGLRenderer, colorTarget?: THREE.WebGLRenderTarget | null): boolean;
    render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, colorTarget?: THREE.WebGLRenderTarget | null): boolean;
    dispose(): void;
}
//# sourceMappingURL=outline-postprocess-material.d.ts.map