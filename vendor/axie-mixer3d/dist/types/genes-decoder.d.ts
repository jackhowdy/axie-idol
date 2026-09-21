import { type AxieDecodedGenes, type AxieGenesDecodeMode, type AxieGenesDecodeOptions, type AxieGenesDecoder } from './domain.js';
export type AxieGenesValidationCode = 'empty' | 'invalid-hex' | 'too-long' | 'unknown-main-class' | 'unknown-part-class' | 'layout-overflow';
export declare class AxieGenesValidationError extends Error {
    readonly code: AxieGenesValidationCode;
    readonly bitOffset?: number | undefined;
    readonly name = "AxieGenesValidationError";
    constructor(code: AxieGenesValidationCode, message: string, bitOffset?: number | undefined);
}
/**
 * Canonicalizes to lowercase 512-bit hexadecimal. The default reproduces
 * Unity's right-to-left suffix parser; strict validation is an explicit opt-in.
 */
export declare function normalizeAxieGenes(genes: string, options?: AxieGenesDecodeOptions): string;
export declare function decodeAxieGenes(genes: string, options?: AxieGenesDecodeOptions): AxieDecodedGenes;
export declare class UnityAxieGenesDecoder implements AxieGenesDecoder {
    readonly defaultMode: AxieGenesDecodeMode;
    constructor(defaultMode?: AxieGenesDecodeMode);
    normalize(genes: string, options?: AxieGenesDecodeOptions): string;
    decode(genes: string, options?: AxieGenesDecodeOptions): AxieDecodedGenes;
}
export declare const AXIE_GENES_DECODER: AxieGenesDecoder;
export declare const AXIE_STRICT_GENES_DECODER: AxieGenesDecoder;
//# sourceMappingURL=genes-decoder.d.ts.map