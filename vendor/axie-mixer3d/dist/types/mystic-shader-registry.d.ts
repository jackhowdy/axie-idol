import * as THREE from 'three';
export type MysticShaderFamily = 'debuff-rimlight' | 'mystic-opaque' | 'mystic-transparent' | 'mystic-final' | 'mystic-final-transparent' | 'cel-standard' | 'cel-standard-mystic' | 'star' | 'dissolve' | 'dissolve-stencil';
export interface MysticShaderDefinition {
    readonly guid: string;
    readonly sourceName: string;
    readonly family: MysticShaderFamily;
    readonly transparent: boolean;
    readonly side: THREE.Side;
    readonly depthWrite: boolean;
    readonly alphaTest: number;
    readonly outline: boolean;
    readonly depthOnly: boolean;
    readonly shadowCaster: boolean;
    readonly fragmentShader: string;
    readonly depthFragmentShader: string;
}
/** One declaration block is injected into both mesh and particle programs. */
export declare const MYSTIC_VERTEX_VARYINGS = "\n  varying vec2 vMysticUv;\n  varying vec2 vMysticUv0Zw;\n  varying vec2 vMysticUv2;\n  varying vec3 vMysticNormalWS;\n  varying vec3 vMysticNormalVS;\n  varying vec3 vMysticViewDirectionWS;\n  varying vec3 vMysticWorldPosition;\n  varying vec3 vMysticObjectPosition;\n  varying vec3 vMysticObjectNormal;\n  varying float vMysticEyeDepth;\n  varying vec4 vMysticScreenPosition;\n  varying vec4 vMysticColor;\n  varying vec4 vMysticCustom0;\n";
/**
 * Mesh varyings intentionally match the particle billboard vertex shader.
 * uv1 is glTF TEXCOORD_1; absent attributes receive WebGL's zero default.
 */
export declare const MYSTIC_MESH_VERTEX_SHADER = "\n  \n  varying vec2 vMysticUv;\n  varying vec2 vMysticUv0Zw;\n  varying vec2 vMysticUv2;\n  varying vec3 vMysticNormalWS;\n  varying vec3 vMysticNormalVS;\n  varying vec3 vMysticViewDirectionWS;\n  varying vec3 vMysticWorldPosition;\n  varying vec3 vMysticObjectPosition;\n  varying vec3 vMysticObjectNormal;\n  varying float vMysticEyeDepth;\n  varying vec4 vMysticScreenPosition;\n  varying vec4 vMysticColor;\n  varying vec4 vMysticCustom0;\n\n\n  attribute vec2 uv1;\n  uniform mat4 uMysticUnityObjectFromGeometry;\n\n  #include <common>\n  #include <batching_pars_vertex>\n  #include <morphtarget_pars_vertex>\n  #include <skinning_pars_vertex>\n\n  void main() {\n    vMysticUv = uv;\n    // A regular Mesh UV channel supplies TEXCOORD0.xy only. Particle vertex\n    // streams may pack Custom1.xy into TEXCOORD0.zw; their dedicated vertex\n    // program fills this varying explicitly.\n    vMysticUv0Zw = vec2(0.0);\n    vMysticUv2 = uv1;\n    vMysticColor = vec4(1.0);\n    vMysticCustom0 = vec4(uv1, 0.0, 0.0);\n\n    #include <morphinstance_vertex>\n    #include <batching_vertex>\n    #include <beginnormal_vertex>\n    #include <morphnormal_vertex>\n    #include <skinbase_vertex>\n    #include <skinnormal_vertex>\n    #include <defaultnormal_vertex>\n    #include <begin_vertex>\n    #include <morphtarget_vertex>\n    #include <skinning_vertex>\n\n    vMysticObjectPosition = (\n      uMysticUnityObjectFromGeometry * vec4(transformed, 1.0)\n    ).xyz;\n    vMysticObjectNormal = normalize(\n      mat3(uMysticUnityObjectFromGeometry) * objectNormal\n    );\n    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);\n    vMysticWorldPosition = worldPosition.xyz;\n    vMysticNormalVS = normalize(transformedNormal);\n    vMysticNormalWS = inverseTransformDirection(vMysticNormalVS, viewMatrix);\n    vMysticViewDirectionWS = normalize(cameraPosition - worldPosition.xyz);\n    vec4 mvPosition = viewMatrix * worldPosition;\n    vMysticEyeDepth = -mvPosition.z;\n    gl_Position = projectionMatrix * mvPosition;\n    vMysticScreenPosition = gl_Position;\n  }\n";
export declare const MYSTIC_SHADER_DEFINITIONS: ReadonlyMap<string, MysticShaderDefinition>;
export declare function resolveMysticShaderDefinition(shaderGuid: string): MysticShaderDefinition;
//# sourceMappingURL=mystic-shader-registry.d.ts.map