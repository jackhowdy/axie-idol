export type AxieIdInput = string | number | bigint;
export declare const AXIE_PART_SLOTS: readonly ["eyes", "mouth", "ears", "horn", "back", "tail"];
export type AxiePartSlot = typeof AXIE_PART_SLOTS[number];
export type AxiePartRecord<T> = Readonly<Record<AxiePartSlot, T | null>>;
export interface AxieLookup {
    /** Canonical positive decimal ID. */
    readonly axieId: string;
    readonly name: string;
    readonly image: string | null;
    /** Canonical lowercase 512-bit hexadecimal, including the 0x prefix. */
    readonly genes: string;
    readonly class: string | null;
    readonly axieStage: number | null;
    readonly bodyShape: string | null;
    readonly parts: AxiePartRecord<string> | null;
    readonly partNames: AxiePartRecord<string> | null;
    readonly partClasses: AxiePartRecord<string> | null;
    readonly partSkins: AxiePartRecord<string> | null;
    readonly partStages: AxiePartRecord<number> | null;
    /** Resolver-defined provenance, such as sky-mavis-graphql. */
    readonly source: string;
    readonly cacheTtlSeconds: number | null;
}
export interface ResolveAxieOptions {
    readonly signal?: AbortSignal;
}
/** Application-owned boundary between an Axie ID and authoritative metadata. */
export interface AxieResolver {
    resolve(axieId: AxieIdInput, options?: ResolveAxieOptions): Promise<AxieLookup>;
}
export type AxieResolverEndpoint = string | URL | ((axieId: string) => string | URL);
export interface CreateHttpAxieResolverOptions {
    /**
     * A {id} template, a base URL to append the ID to, or a callback. Defaults
     * to the same-origin endpoint shipped by the demo: /api/axies/{id}.
     */
    readonly endpoint?: AxieResolverEndpoint;
    readonly fetcher?: typeof fetch;
    readonly headers?: HeadersInit;
}
export type AxieLookupErrorCode = 'invalid-id' | 'network' | 'not-found' | 'http' | 'invalid-response' | 'missing-genes' | 'unsupported-stage';
export declare class AxieLookupError extends Error {
    readonly code: AxieLookupErrorCode;
    readonly axieId?: string | undefined;
    readonly status?: number | undefined;
    readonly name = "AxieLookupError";
    constructor(code: AxieLookupErrorCode, message: string, axieId?: string | undefined, status?: number | undefined, options?: ErrorOptions);
}
export declare function normalizeAxieId(input: AxieIdInput): string;
export declare function isValidAxieId(input: AxieIdInput): boolean;
export declare function parseAxieLookup(value: unknown, requestedAxieId: AxieIdInput): AxieLookup;
/**
 * Creates a browser-safe resolver. API credentials belong in the same-origin
 * server/proxy; this client intentionally has no API-key option.
 */
export declare function createHttpAxieResolver(options?: CreateHttpAxieResolverOptions): AxieResolver;
export declare function resolveAxieGenes(resolver: AxieResolver, axieId: AxieIdInput, options?: ResolveAxieOptions): Promise<string>;
//# sourceMappingURL=axie-id.d.ts.map