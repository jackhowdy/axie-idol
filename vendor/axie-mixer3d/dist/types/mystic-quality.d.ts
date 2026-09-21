import type { AxieQualityProfile } from './quality.js';
import type { MysticQualityId, MysticQualityProfile } from './mystic-types.js';
export declare const MYSTIC_QUALITY_PROFILES: Readonly<Record<MysticQualityId, MysticQualityProfile>>;
export declare function resolveMysticQuality(quality: MysticQualityId | MysticQualityProfile | undefined): MysticQualityProfile;
/** Bridges the app's existing Axie quality selector onto the effect runtime. */
export declare function mysticQualityFromAxieQuality(quality: AxieQualityProfile): MysticQualityId;
//# sourceMappingURL=mystic-quality.d.ts.map