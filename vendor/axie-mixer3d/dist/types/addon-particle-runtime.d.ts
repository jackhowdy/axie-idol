import * as THREE from 'three';
import { MysticSourceMaterialFactory } from './mystic-material-factory.js';
import type { AddonParticleRuntime, AddonParticleResetOptions, AddonParticleSystemSchema, MysticColorTuple, MysticDiagnostic, MysticDiagnosticSink, MysticMaterialFactoryOptions, MysticMinMaxCurveSchema, MysticMinMaxGradientSchema, MysticQualityId, MysticQualityProfile } from './mystic-types.js';
export declare const ADDON_SUPPORTED_PARTICLE_MODULES: Readonly<Set<string>>;
export declare const ADDON_PARTICLE_VERTEX_SHADER = "\n  attribute vec3 aParticlePosition;\n  attribute vec2 aParticleSize;\n  attribute float aParticleRotation;\n  attribute vec4 aParticleColor;\n  attribute float aParticleFrame;\n  attribute vec4 aParticleCustom0;\n\n  uniform vec2 uParticleTiles;\n\n  \n  varying vec2 vMysticUv;\n  varying vec2 vMysticUv0Zw;\n  varying vec2 vMysticUv2;\n  varying vec3 vMysticNormalWS;\n  varying vec3 vMysticNormalVS;\n  varying vec3 vMysticViewDirectionWS;\n  varying vec3 vMysticWorldPosition;\n  varying vec3 vMysticObjectPosition;\n  varying vec3 vMysticObjectNormal;\n  varying float vMysticEyeDepth;\n  varying vec4 vMysticScreenPosition;\n  varying vec4 vMysticColor;\n  varying vec4 vMysticCustom0;\n\n\n  void main() {\n    float cosine = cos(aParticleRotation);\n    float sine = sin(aParticleRotation);\n    vec2 corner = position.xy * aParticleSize;\n    corner = mat2(cosine, -sine, sine, cosine) * corner;\n\n    vec4 centerVS = modelViewMatrix * vec4(aParticlePosition, 1.0);\n    centerVS.xy += corner;\n    gl_Position = projectionMatrix * centerVS;\n\n    float columns = max(1.0, uParticleTiles.x);\n    float rows = max(1.0, uParticleTiles.y);\n    float frame = floor(max(0.0, aParticleFrame));\n    float column = mod(frame, columns);\n    float row = floor(frame / columns);\n    vMysticUv = vec2((uv.x + column) / columns, (uv.y + (rows - 1.0 - row)) / rows);\n    // Unity packs UV.xy + Custom1.xy into TEXCOORD0 and Custom1.zw into\n    // TEXCOORD1.xy for the authored 00/01/03/04/22 vertex stream.\n    vMysticUv0Zw = aParticleCustom0.xy;\n    vMysticUv2 = aParticleCustom0.xy;\n    vMysticNormalVS = vec3(0.0, 0.0, 1.0);\n    vec4 worldCenter = modelMatrix * vec4(aParticlePosition, 1.0);\n    vMysticWorldPosition = worldCenter.xyz;\n    vMysticViewDirectionWS = normalize(cameraPosition - worldCenter.xyz);\n    vMysticNormalWS = vMysticViewDirectionWS;\n    vMysticObjectPosition = aParticlePosition;\n    vMysticObjectNormal = vec3(0.0, 0.0, 1.0);\n    vMysticEyeDepth = -centerVS.z;\n    vMysticScreenPosition = gl_Position;\n    vMysticColor = aParticleColor;\n    vMysticCustom0 = vec4(aParticleCustom0.zw, aParticleCustom0.xy);\n  }\n";
/** Cubic Hermite evaluation matching Unity's unweighted particle curves. */
export declare function evaluateMysticCurve(curve: MysticMinMaxCurveSchema['maxCurve'], time: number): number;
export declare function evaluateMysticMinMaxCurve(curve: MysticMinMaxCurveSchema, time: number, random: number): number;
export declare function evaluateMysticMinMaxGradient(source: MysticMinMaxGradientSchema, time: number, random: number): MysticColorTuple;
export interface ThreeAddonParticleRuntimeOptions {
    readonly schema: AddonParticleSystemSchema;
    readonly materialFactory: MysticSourceMaterialFactory;
    readonly materialOptions: Omit<MysticMaterialFactoryOptions, 'quality'>;
    readonly quality?: MysticQualityId | MysticQualityProfile;
    readonly onDiagnostic?: MysticDiagnosticSink;
    readonly strict?: boolean;
    /** Mirrors Unity local X into the exported glTF coordinate basis. */
    readonly mirrorX?: boolean;
}
export declare class ThreeAddonParticleRuntime implements AddonParticleRuntime {
    #private;
    readonly id: string;
    readonly object: THREE.Mesh;
    readonly diagnostics: MysticDiagnostic[];
    constructor(options: ThreeAddonParticleRuntimeOptions);
    play(): void;
    pause(): void;
    stop(clear?: boolean): void;
    reset(options?: AddonParticleResetOptions): void;
    update(deltaSeconds: number): void;
    dispose(): void;
}
//# sourceMappingURL=addon-particle-runtime.d.ts.map