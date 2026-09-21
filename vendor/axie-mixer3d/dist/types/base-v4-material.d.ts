import * as THREE from 'three';
export type AxieRgb = readonly [r: number, g: number, b: number];
export type AxieCameraProjection = 'perspective' | 'orthographic';
export interface AxieMixerV4MaterialOptions {
    readonly map: THREE.Texture;
    readonly primaryColor: THREE.ColorRepresentation;
    readonly secondaryColor: THREE.ColorRepresentation;
    readonly mainTexTransform?: THREE.Vector4 | readonly [repeatX: number, repeatY: number, offsetX: number, offsetY: number];
    /** The pinned source project is Gamma; pass false only for a separate linear Unity project. */
    readonly gammaSpace?: boolean;
    /** Mirrors the local `_ALPHATEST_ON` keyword. It is disabled in every pinned V4 material. */
    readonly alphaClipEnabled?: boolean;
    /**
     * Compatibility input for callers that deserialize `_AlphaCutoff`.
     * The pinned V4 shader hard-codes every color/shadow threshold to 0.5, so
     * values other than 0.5 are rejected instead of silently inventing behavior.
     */
    readonly alphaMaskCutoff?: number;
    readonly name?: string;
}
export interface AxieMixerV4OutlineOptions {
    readonly thickness?: number;
    readonly color?: THREE.ColorRepresentation;
    readonly name?: string;
    /** Selects the exact source vertex graph represented by this draw. */
    readonly source?: AxieOutlineExtrusionSource;
}
export type AxieOutlineExtrusionSource = 'base-v4-extra-prepass' | 'render-objects-shadergraph';
export interface AxieOutlineExtrusionSample {
    readonly normalOS: AxieRgb;
    readonly objectToWorld: THREE.Matrix4;
    readonly thickness: number;
}
export interface AxieOutlineExtrusionResult {
    readonly worldDirection: AxieRgb;
    readonly worldOffset: AxieRgb;
    readonly objectOffset: AxieRgb;
}
export interface AxieMixerV4MaterialBundle {
    readonly surface: AxieMixerV4Material;
    readonly outline?: AxieMixerV4OutlineMaterial;
    /** Assign to SkinnedMesh.customDepthMaterial for alpha-correct directional shadows. */
    readonly depth: THREE.MeshDepthMaterial;
    /** Assign to SkinnedMesh.customDistanceMaterial for alpha-correct point-light shadows. */
    readonly distance: THREE.MeshDistanceMaterial;
}
export interface AxieMixerV4CpuSample {
    readonly textureRgb: AxieRgb;
    readonly textureAlpha: number;
    readonly primaryColor: AxieRgb;
    readonly secondaryColor: AxieRgb;
    /** Exact source dot((-15, 80, -30), worldNormal), without normalizing the vector. */
    readonly fakeLightDot: number;
    readonly normalViewDot: number;
    readonly gammaSpace?: boolean;
    readonly alphaClipEnabled?: boolean;
    readonly alphaMaskCutoff?: number;
}
export interface AxieMixerV4CpuResult {
    readonly rgb: AxieRgb;
    readonly alpha: 0 | 1;
    readonly discarded: boolean;
}
/** Source lines 776-778 are literals, not material-controlled properties. */
export declare const AXIE_MIXER_V4_COLOR_ALPHA_THRESHOLD = 0.5;
export declare const AXIE_MIXER_V4_COLOR_CLIP_THRESHOLD = 0.01;
export declare const AXIE_MIXER_V4_SHADOW_ALPHA_THRESHOLD = 0.5;
/** HLSL's defined reversed-edge behavior, unlike GLSL smoothstep. */
export declare function unityHlslSmoothstep(edge0: number, edge1: number, value: number): number;
/** CPU reference used by parity tests; it mirrors the generated Unity fragment graph. */
export declare function evaluateAxieMixerV4Sample(sample: AxieMixerV4CpuSample): AxieMixerV4CpuResult;
/**
 * View-space equivalent of URP 12 GetWorldSpaceNormalizeViewDir.
 * Perspective points from the fragment to the view origin. Orthographic uses
 * one constant ray direction for every fragment: -GetViewForwardDir(), which
 * is +Z after transforming into Three's right-handed view space.
 */
export declare function evaluateAxieMixerV4ViewDirectionVS(positionVS: AxieRgb, projection: AxieCameraProjection): AxieRgb;
/**
 * CPU source oracle for both authored geometry-outline paths.
 *
 * `base-v4-extra-prepass` mirrors S_Axie_Mixer_V4.shader:255-256:
 * normalize(ObjectToWorld * normalOS), then WorldToObject * worldOffset.
 * `render-objects-shadergraph` mirrors the graph edge chain:
 * World Normal * Thickness + World Position, transformed back to Object.
 */
export declare function evaluateAxieOutlineExtrusion(sample: AxieOutlineExtrusionSample, source: AxieOutlineExtrusionSource): AxieOutlineExtrusionResult;
export declare const AXIE_MIXER_V4_VERTEX_SHADER = "\n  varying vec2 vAxieUv;\n  varying vec3 vAxieNormalVS;\n  varying vec3 vAxiePositionVS;\n  uniform vec4 uMainTexTransform;\n\n  #include <common>\n  #include <batching_pars_vertex>\n  #include <morphtarget_pars_vertex>\n  #include <skinning_pars_vertex>\n\n  void main() {\n    vAxieUv = uv * uMainTexTransform.xy + uMainTexTransform.zw;\n\n    #include <morphinstance_vertex>\n    #include <batching_vertex>\n    #include <beginnormal_vertex>\n    #include <morphnormal_vertex>\n    #include <skinbase_vertex>\n    #include <skinnormal_vertex>\n    #include <defaultnormal_vertex>\n    #include <begin_vertex>\n    #include <morphtarget_vertex>\n    #include <skinning_vertex>\n    #include <project_vertex>\n\n    // Unity TransformObjectToWorldNormal normalizes per vertex, then the\n    // generated fragment graph consumes the raw interpolated varying.\n    vAxieNormalVS = normalize(transformedNormal);\n    vAxiePositionVS = mvPosition.xyz;\n  }\n";
export declare const AXIE_MIXER_V4_FRAGMENT_SHADER = "\n  #include <common>\n\n  uniform mat4 projectionMatrix;\n  uniform sampler2D uMainTex;\n  uniform vec3 uPrimaryColor;\n  uniform vec3 uSecondaryColor;\n  uniform float uAlphaMaskCutoff;\n  uniform float uAlphaClipEnabled;\n  uniform float uShadowMultiplier;\n  uniform float uRimColor;\n  uniform float uUnityGammaWorkflow;\n\n  varying vec2 vAxieUv;\n  varying vec3 vAxieNormalVS;\n  varying vec3 vAxiePositionVS;\n\n  vec3 unityWorldViewDirectionVS() {\n    return isPerspectiveMatrix(projectionMatrix)\n      ? normalize(-vAxiePositionVS)\n      : vec3(0.0, 0.0, 1.0);\n  }\n\n  float unityHlslSmoothstep(float edge0, float edge1, float value) {\n    float t = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);\n    return t * t * (3.0 - 2.0 * t);\n  }\n\n  vec3 unityLinearToSrgb(vec3 value) {\n    vec3 low = value * 12.92;\n    vec3 high = 1.055 * pow(max(value, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;\n    return mix(low, high, step(vec3(0.0031308), value));\n  }\n\n  vec3 unitySrgbToLinear(vec3 value) {\n    vec3 low = value / 12.92;\n    vec3 high = pow((max(value, vec3(0.0)) + 0.055) / 1.055, vec3(2.4));\n    return mix(low, high, step(vec3(0.04045), value));\n  }\n\n  void main() {\n    vec4 sampled = texture2D(uMainTex, vAxieUv);\n    float alpha = step(uAlphaMaskCutoff, sampled.a);\n    if (uAlphaClipEnabled > 0.5 && alpha < 0.01) discard;\n\n    vec3 textureRgb = sampled.rgb;\n    vec3 primaryColor = uPrimaryColor;\n    vec3 secondaryColor = uSecondaryColor;\n    if (uUnityGammaWorkflow > 0.5) {\n      primaryColor = unityLinearToSrgb(primaryColor);\n      secondaryColor = unityLinearToSrgb(secondaryColor);\n    }\n\n    float secondaryWeight = unityHlslSmoothstep(0.7, 0.5, sampled.a);\n    vec3 tint = mix(primaryColor, secondaryColor, secondaryWeight);\n    float tintWeight = unityHlslSmoothstep(1.0, 0.9, sampled.a);\n    vec3 multiplied = mix(textureRgb, tint * textureRgb, tintWeight);\n    vec3 tinted = mix(textureRgb, clamp(multiplied, 0.0, 1.0), tintWeight);\n\n    // Deliberately do not normalize here. The pinned generated Unity shader\n    // uses input.ase_texcoord6.xyz directly at lines 762-770.\n    vec3 normalVS = vAxieNormalVS;\n    vec3 fakeLightVS = mat3(viewMatrix) * vec3(15.0, 80.0, -30.0);\n    float fakeLightDot = dot(fakeLightVS, normalVS);\n    float lightWeight = unityHlslSmoothstep(-0.25, 0.55, fakeLightDot);\n    vec3 shadowed = clamp(mix(tinted, vec3(uShadowMultiplier) * tinted, 1.0 - lightWeight), 0.0, 1.0);\n\n    float normalViewDot = dot(normalVS, unityWorldViewDirectionVS());\n    float fresnel = 0.2 * pow(1.0 - normalViewDot, 5.0);\n    float rimWeight = 0.6980392 * clamp(unityHlslSmoothstep(0.9, 1.0, fakeLightDot * fresnel), 0.0, 1.0);\n    vec3 rimSource = vec3(uRimColor);\n    vec3 overlayLow = shadowed + 2.0 * (rimSource - 0.5);\n    vec3 overlayHigh = shadowed + 2.0 * rimSource - 1.0;\n    vec3 overlay = mix(overlayLow, overlayHigh, step(vec3(0.5), rimSource));\n    vec3 color = clamp(mix(shadowed, overlay, rimWeight), 0.0, 1.0);\n    if (uUnityGammaWorkflow > 0.5) color = unitySrgbToLinear(color);\n\n    gl_FragColor = vec4(color, alpha);\n    #include <colorspace_fragment>\n  }\n";
export declare const AXIE_MIXER_V4_OUTLINE_VERTEX_SHADER = "\n  uniform float uOutlineThickness;\n\n  #include <common>\n  #include <batching_pars_vertex>\n  #include <morphtarget_pars_vertex>\n  #include <skinning_pars_vertex>\n\n  void main() {\n    #include <morphinstance_vertex>\n    #include <batching_vertex>\n    #include <beginnormal_vertex>\n    #include <morphnormal_vertex>\n    #include <skinbase_vertex>\n    #include <skinnormal_vertex>\n    #include <begin_vertex>\n    #include <morphtarget_vertex>\n    #include <skinning_vertex>\n\n    // Pinned S_Axie_Mixer_V4.shader ExtraPrePass lines 255-256 do not use\n    // the inverse-transpose normal matrix. They forward-transform normalOS,\n    // normalize in world space, and then apply the equivalent world offset.\n    vec3 outlineNormalOS = objectNormal;\n    #ifdef USE_BATCHING\n      outlineNormalOS = mat3(batchingMatrix) * outlineNormalOS;\n    #endif\n    #ifdef USE_INSTANCING\n      outlineNormalOS = mat3(instanceMatrix) * outlineNormalOS;\n    #endif\n    vec3 outlineNormalWS = normalize(mat3(modelMatrix) * outlineNormalOS);\n\n    vec4 localPosition = vec4(transformed, 1.0);\n    #ifdef USE_BATCHING\n      localPosition = batchingMatrix * localPosition;\n    #endif\n    #ifdef USE_INSTANCING\n      localPosition = instanceMatrix * localPosition;\n    #endif\n    vec4 worldPosition = modelMatrix * localPosition;\n    worldPosition.xyz += outlineNormalWS * uOutlineThickness;\n    vec4 mvPosition = viewMatrix * worldPosition;\n    gl_Position = projectionMatrix * mvPosition;\n  }\n";
/**
 * Exact Shader Graph Normal Vector(World) -> Multiply(Thickness) ->
 * Add(Position World) -> Transform(World to Object) runtime equivalent.
 */
export declare const AXIE_RENDER_OBJECTS_OUTLINE_VERTEX_SHADER = "\n  uniform float uOutlineThickness;\n\n  #include <common>\n  #include <batching_pars_vertex>\n  #include <morphtarget_pars_vertex>\n  #include <skinning_pars_vertex>\n\n  void main() {\n    #include <morphinstance_vertex>\n    #include <batching_vertex>\n    #include <beginnormal_vertex>\n    #include <morphnormal_vertex>\n    #include <skinbase_vertex>\n    #include <skinnormal_vertex>\n    #include <defaultnormal_vertex>\n    #include <begin_vertex>\n    #include <morphtarget_vertex>\n    #include <skinning_vertex>\n\n    vec4 mvPosition = vec4(transformed, 1.0);\n    #ifdef USE_BATCHING\n      mvPosition = batchingMatrix * mvPosition;\n    #endif\n    #ifdef USE_INSTANCING\n      mvPosition = instanceMatrix * mvPosition;\n    #endif\n    mvPosition = modelViewMatrix * mvPosition;\n\n    // BackSide sets FLIP_SIDED in Three; cancel that raster-side convention\n    // because Shader Graph's World Normal node reads the authored normal.\n    vec3 outlineNormalVS = transformedNormal;\n    #ifdef FLIP_SIDED\n      outlineNormalVS = -outlineNormalVS;\n    #endif\n    mvPosition.xyz += normalize(outlineNormalVS) * uOutlineThickness;\n    gl_Position = projectionMatrix * mvPosition;\n  }\n";
export declare const AXIE_MIXER_V4_OUTLINE_FRAGMENT_SHADER = "\n  uniform vec3 uOutlineColor;\n\n  void main() {\n    // Unity's ExtraPrePass ignores _OutlineColor.a and writes alpha 1.\n    gl_FragColor = vec4(uOutlineColor, 1.0);\n    #include <colorspace_fragment>\n  }\n";
export declare class AxieMixerV4Material extends THREE.ShaderMaterial {
    readonly gammaSpace: boolean;
    constructor(options: AxieMixerV4MaterialOptions);
    setColors(primary: THREE.ColorRepresentation, secondary: THREE.ColorRepresentation): void;
    setMainTexTransform(repeatX: number, repeatY: number, offsetX: number, offsetY: number): void;
}
export declare class AxieMixerV4OutlineMaterial extends THREE.ShaderMaterial {
    readonly source: AxieOutlineExtrusionSource;
    constructor(options?: AxieMixerV4OutlineOptions);
    set thickness(value: number);
    get thickness(): number;
}
/** Explicit constructor for the package's Draw Objects override material. */
export declare class AxieRenderObjectsOutlineMaterial extends AxieMixerV4OutlineMaterial {
    constructor(options?: Omit<AxieMixerV4OutlineOptions, 'source'>);
}
export declare class AxieMixerV4ThreeMaterialFactory {
    createSurface(options: AxieMixerV4MaterialOptions): AxieMixerV4Material;
    createOutline(options?: AxieMixerV4OutlineOptions): AxieMixerV4OutlineMaterial;
    createBundle(surfaceOptions: AxieMixerV4MaterialOptions, outlineOptions?: (AxieMixerV4OutlineOptions & {
        readonly enabled?: boolean;
    })): AxieMixerV4MaterialBundle;
}
export declare const AXIE_MIXER_V4_MATERIAL_FACTORY: Readonly<AxieMixerV4ThreeMaterialFactory>;
//# sourceMappingURL=base-v4-material.d.ts.map