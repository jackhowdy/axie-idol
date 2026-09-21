export declare const AXIE_CANONICAL_ASSET_PREFIX: "/assets/axie/";
export declare const AXIE_PINNED_SOURCE_COMMIT: "public-content-v1";
export interface AxieAssetLocatorOptions {
    /** Directory containing manifest.json; may be root-relative, relative, or absolute. */
    readonly assetBaseUrl?: string;
    /** Optional final resolver for signed URLs, CDNs, or application-specific routing. */
    readonly resolveAssetUrl?: (url: string) => string;
}
export interface AxieAssetLocator {
    readonly baseUrl: string;
    readonly manifestUrl: string;
    resolve(url: string, baseUrl?: string): string;
}
export declare function createAxieAssetLocator(options?: AxieAssetLocatorOptions): AxieAssetLocator;
//# sourceMappingURL=asset-locator.d.ts.map