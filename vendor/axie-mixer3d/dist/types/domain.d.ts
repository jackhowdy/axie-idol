/**
 * Engine-neutral Axie domain types.
 *
 * Names mirror the approved Axie source package represented by
 * public-content-v1. The web manifest uses lowercase
 * body/part ids, while class and rig names retain Unity's source casing.
 */
export declare const AXIE_BODY_TYPES: readonly ["normal", "spiky", "fuzzy", "curly", "sumo", "wetdog", "bigyak", "frosty"];
export type AxieBodyType = typeof AXIE_BODY_TYPES[number];
export declare const AXIE_PART_TYPES: readonly ["back", "ear", "eye", "horn", "mouth", "tail"];
export type AxiePartType = typeof AXIE_PART_TYPES[number];
/** Order used by AxieDescriptor.FromGenes in the Unity package. */
export declare const AXIE_GENE_PART_ORDER: readonly ["eye", "mouth", "ear", "horn", "back", "tail"];
export declare const AXIE_RESOURCE_CLASSES: readonly ["Aquatic", "Beast", "Bird", "Bug", "Plant", "Reptile"];
export type AxieResourceClass = typeof AXIE_RESOURCE_CLASSES[number];
/** Classes the 512-bit decoder can emit, including hybrids without part assets. */
export declare const AXIE_GENE_CLASSES: readonly ["Aquatic", "Beast", "Bird", "Bug", "Plant", "Reptile", "Mech", "Dawn", "Dusk"];
export type AxieGeneClass = typeof AXIE_GENE_CLASSES[number];
/**
 * Unity's GetAxieClass returns null for every unrecognized 5-bit class code.
 * A decoded descriptor therefore needs to preserve null until exact resource
 * lookup silently omits the unbacked part, just as AxieFactory does.
 */
export type AxieDecodedPartClass = AxieGeneClass | null;
export declare const AXIE_RIG_TYPES: readonly ["Back_L", "Back_M", "Back_R", "Ear_L", "Ear_R", "Eye_L", "Eye_M", "Eye_R", "Eye_Accessory_L", "Eye_Accessory_R", "Horn_L", "Horn_M", "Horn_R", "Horn_T", "Mouth_M", "Mouth_Accessory_L", "Mouth_Accessory_R", "Tail_L", "Tail_M", "Tail_R"];
export type AxieRigType = typeof AXIE_RIG_TYPES[number];
export declare const AXIE_RIG_TO_PART_TYPE: Readonly<Record<AxieRigType, AxiePartType>>;
export declare const AXIE_PART_TYPE_SOURCE_NAMES: Readonly<Record<AxiePartType, string>>;
export type AxiePartAssetId = string;
export interface AxiePartDescriptor {
    readonly type: AxiePartType;
    readonly skin: number;
    readonly class: AxieDecodedPartClass;
    readonly variant: number;
    readonly level: number;
}
export interface AxieDescriptor {
    readonly colorVariant: number;
    readonly body: AxieBodyType;
    readonly parts: readonly AxiePartDescriptor[];
}
export interface AxieDecodedGenes {
    /** Canonical lowercase hexadecimal, including the 0x prefix. */
    readonly genes: string;
    readonly descriptor: AxieDescriptor;
    /** Decoder policy used to interpret malformed prefixes and unknown classes. */
    readonly mode: AxieGenesDecodeMode;
    /** Unknown class codes that Unity represented as null. Empty in strict mode. */
    readonly unsupportedClasses: readonly AxieUnsupportedGeneClass[];
}
export type AxieGenesDecodeMode = 'unity-compatible' | 'strict';
export interface AxieGenesDecodeOptions {
    /**
     * unity-compatible reproduces AxieDescriptor.FromGenes. Strict validates the
     * entire hexadecimal input and rejects unknown main/dominant part classes.
     */
    readonly mode?: AxieGenesDecodeMode;
}
export interface AxieUnsupportedGeneClass {
    readonly field: 'main' | 'part';
    readonly code: number;
    readonly bitOffset: number;
    readonly partType?: AxiePartType;
}
export interface AxieGenesDecoder {
    normalize(genes: string, options?: AxieGenesDecodeOptions): string;
    decode(genes: string, options?: AxieGenesDecodeOptions): AxieDecodedGenes;
}
/** Exact Resources.Load key used by AxieFactory for a part descriptor. */
export declare function formatAxiePartAssetId(part: AxiePartDescriptor): AxiePartAssetId;
/** Exact add-on folder key used by AxieFactory for a part rig. */
export declare function formatAxieAddonId(part: AxiePartDescriptor, rig: AxieRigType): string;
/** Stable cache key that preserves duplicate-part ordering just as Unity does. */
export declare function formatAxieDescriptorKey(descriptor: AxieDescriptor): string;
//# sourceMappingURL=domain.d.ts.map