// src/data/normalizers/volatility.ts
import { VolatilityMeta } from "../interfaces";

/** Simple safety join; you can get fancier with rolling windows or injury weights by position */
export function normalizeVolatility(v: VolatilityMeta): VolatilityMeta {
  return {
    stdevLast5: v.stdevLast5 ?? 8.5,
    injuryTag: v.injuryTag ?? null,
    committeeRisk: v.committeeRisk ?? 20,
    depthChartThreats: v.depthChartThreats ?? 35,
  };
}