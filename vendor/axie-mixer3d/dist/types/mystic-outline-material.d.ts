import * as THREE from 'three';
export interface MysticObjectOutlineMaterialOptions {
    readonly thickness: number;
    readonly color: THREE.ColorRepresentation;
    readonly name: string;
}
/** Debuff and Mystic_Final ExtraPrePass: `positionOS + normalOS * _outline`. */
export declare class MysticObjectOutlineMaterial extends THREE.ShaderMaterial {
    readonly source = "mystic-object-normal-extra-prepass";
    constructor(options: MysticObjectOutlineMaterialOptions);
}
export interface MysticCelOutlineMaterialOptions {
    readonly thickness: number;
    readonly alphaClipEnabled: boolean;
    readonly length: number;
    readonly offset: number;
    readonly name: string;
}
/** CEL ExtraPrePass: Fresnel-scaled object-normal extrusion and camera-depth Bayer alpha. */
export declare class MysticCelOutlineMaterial extends THREE.ShaderMaterial {
    #private;
    readonly source = "cel-fresnel-object-normal-extra-prepass";
    constructor(options: MysticCelOutlineMaterialOptions);
    onBeforeRender(_renderer: THREE.WebGLRenderer, _scene: THREE.Scene, camera: THREE.Camera): void;
}
//# sourceMappingURL=mystic-outline-material.d.ts.map