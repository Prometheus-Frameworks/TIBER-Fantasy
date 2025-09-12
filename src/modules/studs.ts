// src/modules/studs.ts
// Stud detection + policy and overrides

import { PlayerInput } from "../data/interfaces";

export interface StudMeta {
  // season/career signals
  ourPosRank?: number;          // your model rank at position (lower = better)
  ecrPosRank?: number;          // market rank
  seasonTgtShare?: number;      // 0..100
  seasonRoutePct?: number;      // 0..100
  yprr?: number;                // WR/TE: yards per route run
  rushShare?: number;           // RB team rush share 0..100
  wopr?: number;                // WR: weighted op (airYds+TgtShare), 0..1.2 typical
  boomRate?: number;            // % games >= strong threshold (e.g., 20+ WR/RB; 25+ QB)
  top12Rate?: number;           // % weeks finishing top-12 at position (rolling year)
  draftCapitalScore?: number;   // 0..100 (R1 ~90, R2 ~70, UDFA ~20)
  contractAlpha?: number;       // 0..100 (alpha $ + years left -> leverage)
  last4RoleStability?: number;  // 0..100 (downside if collapsing)
}

export interface StudPolicy {
  // score weights (tune per position)
  wRank: number; wUsage: number; wBoom: number; wMarket: number; wTalent: number; wStability: number;

  // thresholds / hysteresis
  hardThreshold: number;     // >= => stud
  softThreshold: number;     // >= => bubble stud (apply smaller bias)
  demeritDrop: number;       // how fast stud score drops when role dips
  graceWeeks: number;        // weeks of poor output before losing stud lock

  // override behavior
  marginFloor: number;       // if stud vs non-stud and margin < this → prefer stud
  leanBump: number;          // extra points added to stud total (bias)
  clearLock: boolean;        // if true, START stud unless bench-gates triggered
}

export interface StudDetection {
  isStud: boolean;
  isBubble: boolean;
  studScore: number;       // 0..100
  reasons: string[];
}

export interface BenchGates {
  gate: boolean;
  reasons: string[];
}

export const defaultWRPolicy: StudPolicy = {
  wRank: 0.30, wUsage: 0.25, wBoom: 0.20, wMarket: 0.10, wTalent: 0.10, wStability: 0.05,
  hardThreshold: 72,
  softThreshold: 62,
  demeritDrop: 10,
  graceWeeks: 3,
  marginFloor: 6,    // if close, lean stud by default
  leanBump: 1.5,     // small bump to composite
  clearLock: true
};

export const defaultRBPolicy: StudPolicy = { ...defaultWRPolicy, wUsage: 0.35, wRank: 0.25 };
export const defaultQBPolicy: StudPolicy = { ...defaultWRPolicy, wUsage: 0.20, wRank: 0.35, wBoom: 0.25 };
export const defaultTEPolicy: StudPolicy = { ...defaultWRPolicy, softThreshold: 58 }; // TE is noisy

export function policyForPos(pos: PlayerInput["position"]): StudPolicy {
  if (pos === "RB") return defaultRBPolicy;
  if (pos === "QB") return defaultQBPolicy;
  if (pos === "TE") return defaultTEPolicy;
  return defaultWRPolicy;
}

// --------- detection ---------
export function detectStud(pos: PlayerInput["position"], meta: StudMeta): StudDetection {
  const p = policyForPos(pos);
  const reasons: string[] = [];

  // Normalize/guard
  const invRank = (r?: number) => r ? Math.max(0, Math.min(100, 100 - (r - 1) * 3.3)) : 0; // rank 1 ~100, rank 31 ~0
  const cap01 = (v?: number) => Math.max(0, Math.min(1, (v ?? 0)));
  const cap100 = (v?: number) => Math.max(0, Math.min(100, (v ?? 0)));

  // Usage: WR/TE -> tgtShare/route/yprr/wopr; RB -> rushShare + tgtShare; QB -> top12Rate/boomRate as proxy
  const usageWR = (cap100(meta.seasonTgtShare) * 0.45) + (cap100(meta.seasonRoutePct) * 0.25)
                + (cap100((meta.yprr ?? 0) * 50) * 0.20) + (cap100((meta.wopr ?? 0) * 80) * 0.10);
  const usageRB = (cap100(meta.rushShare) * 0.55) + (cap100(meta.seasonTgtShare) * 0.35) + (cap100(meta.seasonRoutePct) * 0.10);
  const usageQB = (cap100((meta.top12Rate ?? 0) * 100) * 0.60) + (cap100((meta.boomRate ?? 0) * 100) * 0.40);
  const usageTE = (cap100(meta.seasonTgtShare) * 0.55) + (cap100(meta.seasonRoutePct) * 0.25) + (cap100((meta.yprr ?? 0) * 50) * 0.20);

  const usage = pos === "RB" ? usageRB : pos === "QB" ? usageQB : pos === "TE" ? usageTE : usageWR;

  const rankScore = Math.max(invRank(meta.ourPosRank), invRank(meta.ecrPosRank)); // take the better of ours vs market
  const boom = cap100((meta.boomRate ?? 0) * 100);
  const market = cap100(100 - (meta.ecrPosRank ?? 40) * 2.2); // ECR top-10 ~ high
  const talent = Math.max(cap100(meta.draftCapitalScore), cap100(meta.contractAlpha));
  const stability = cap100(meta.last4RoleStability);

  const studScore =
    rankScore * p.wRank +
    usage     * p.wUsage +
    boom      * p.wBoom +
    market    * p.wMarket +
    talent    * p.wTalent +
    stability * p.wStability;

  if (rankScore >= 80) reasons.push("Top-tier positional rank");
  if (usage >= 70) reasons.push("Alpha usage");
  if (boom >= 60) reasons.push("High boom rate");
  if (talent >= 70) reasons.push("Elite talent/capital");
  if (stability < 40) reasons.push("Recent role wobble (still within grace)");

  const isStud = studScore >= p.hardThreshold;
  const isBubble = !isStud && studScore >= p.softThreshold;

  return { isStud, isBubble, studScore: Math.round(studScore), reasons };
}

// --------- bench gates (when NOT to auto-start a stud) ---------
export function benchGates(p: PlayerInput, impliedTeamTotal?: number): BenchGates {
  const reasons: string[] = [];
  let gate = false;

  if (p.injuryTag === "OUT" || p.injuryTag === "D") { gate = true; reasons.push("Injury risk too high"); }
  if ((p.snapPct ?? 100) < 55) { gate = true; reasons.push("Role collapse (snap <55%)"); }
  if ((p.routeParticipation ?? 100) < 60 && (p.targetShare ?? 100) < 18) {
    gate = true; reasons.push("Routes & targets too low");
  }
  if ((impliedTeamTotal ?? p.impliedTeamTotal ?? 100) <= 15 && (p.weatherImpact ?? 0) < -0.6) {
    // apocalyptic weather + terrible total
    gate = true; reasons.push("Severe environment (weather + very low team total)");
  }

  return { gate, reasons };
}