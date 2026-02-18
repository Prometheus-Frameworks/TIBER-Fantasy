export {
  idpPlayerWeek,
  idpPlayerSeason,
  idpPositionBaselines,
  idpPositionMap,
} from "./schema";

export type {
  IdpPlayerWeek,
  IdpPlayerSeason,
  IdpPositionBaseline,
  IdpPositionMap,
} from "./schema";

export const IDP_POSITION_GROUPS = ["EDGE", "DI", "LB", "CB", "S"] as const;
export type IdpPositionGroup = (typeof IDP_POSITION_GROUPS)[number];

export const IDP_TIERS = ["T1", "T2", "T3", "T4", "T5"] as const;
export type IdpTier = (typeof IDP_TIERS)[number];

export const HAVOC_PRIOR_SNAPS = 200;
export const LEADERBOARD_MIN_SNAPS = 150;

export const NFL_TO_IDP_POSITION: Record<string, IdpPositionGroup> = {
  DE: "EDGE",
  OLB: "EDGE",
  EDGE: "EDGE",
  DT: "DI",
  NT: "DI",
  DI: "DI",
  ILB: "LB",
  MLB: "LB",
  LB: "LB",
  CB: "CB",
  NB: "CB",
  SS: "S",
  FS: "S",
  S: "S",
  DB: "S",
};

export const IDP_TIER_THRESHOLDS: Record<IdpTier, [number, number]> = {
  T1: [80, 100],
  T2: [60, 79.99],
  T3: [40, 59.99],
  T4: [20, 39.99],
  T5: [0, 19.99],
};

export function mapHavocToTier(havocIndex: number): IdpTier {
  if (havocIndex >= 80) return "T1";
  if (havocIndex >= 60) return "T2";
  if (havocIndex >= 40) return "T3";
  if (havocIndex >= 20) return "T4";
  return "T5";
}
