import type { AddonSourceCatalog, MysticDiagnostic, MysticSourceCatalog } from './mystic-types.js';
export declare const AXIE_MYSTIC_EXPECTED_COVERAGE: Readonly<{
    shaders: 10;
    materials: 50;
    prefabs: 47;
    particles: 85;
}>;
export interface MysticCoverageCounts {
    readonly shaders: number;
    readonly materials: number;
    readonly prefabs: number;
    readonly particles: number;
}
export interface MysticCoverageReport {
    readonly sourceCommit: string;
    readonly counts: MysticCoverageCounts;
    readonly expected: MysticCoverageCounts;
    readonly diagnostics: readonly MysticDiagnostic[];
    readonly complete: boolean;
}
export declare function validateMysticAddonCoverage(mystic?: MysticSourceCatalog, addons?: AddonSourceCatalog): MysticCoverageReport;
export declare function assertMysticAddonCoverage(mystic?: MysticSourceCatalog, addons?: AddonSourceCatalog): MysticCoverageReport;
//# sourceMappingURL=mystic-coverage.d.ts.map