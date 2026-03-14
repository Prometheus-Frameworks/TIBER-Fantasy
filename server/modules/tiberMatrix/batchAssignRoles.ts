export type OffensivePosition = "QB" | "RB" | "WR" | "TE";

export type PlayerRole =
  | "QB_DUAL_THREAT"
  | "QB_POCKET_PASSER"
  | "QB_GAME_MANAGER"
  | "RB_WORKHORSE"
  | "RB_PASS_CATCHING"
  | "RB_GOAL_LINE"
  | "RB_COMMITTEE"
  | "WR_ALPHA"
  | "WR_SLOT_VOLUME"
  | "WR_DEEP_THREAT"
  | "WR_GADGET"
  | "TE_MOVE"
  | "TE_INLINE"
  | "TE_RED_ZONE"
  | "TE_BLOCKING"
  | "UNKNOWN";

export interface NormalizedOffensiveUsageProfile {
  playerId: string;
  playerName: string;
  position: OffensivePosition;
  metrics: Partial<Record<UsageMetric, number>>;
}

export type UsageMetric =
  | "snapShare"
  | "routeParticipation"
  | "targetShare"
  | "airYardsShare"
  | "adot"
  | "carryShare"
  | "redZoneShare"
  | "passAttemptShare"
  | "designedRushShare"
  | "yacOverExpected";

interface RoleTemplate {
  role: PlayerRole;
  minScoreForKnownRole: number;
  prototype: Partial<Record<UsageMetric, number>>;
  weights: Partial<Record<UsageMetric, number>>;
}

export interface PlayerRoleAssignment {
  playerId: string;
  playerName: string;
  position: OffensivePosition;
  assignedRole: PlayerRole;
  confidence: number;
  isUnknownRole: boolean;
  reasons: string[];
  candidateScores: Array<{ role: PlayerRole; score: number }>;
}

const MIN_METRICS_FOR_KNOWN_ROLE = 3;
const UNKNOWN_MARGIN_THRESHOLD = 0.07;

const ROLE_TEMPLATES: Record<OffensivePosition, RoleTemplate[]> = {
  QB: [
    {
      role: "QB_DUAL_THREAT",
      minScoreForKnownRole: 0.62,
      prototype: { passAttemptShare: 0.72, designedRushShare: 0.75, redZoneShare: 0.7 },
      weights: { passAttemptShare: 0.35, designedRushShare: 0.45, redZoneShare: 0.2 },
    },
    {
      role: "QB_POCKET_PASSER",
      minScoreForKnownRole: 0.61,
      prototype: { passAttemptShare: 0.9, designedRushShare: 0.08, airYardsShare: 0.62 },
      weights: { passAttemptShare: 0.45, designedRushShare: 0.35, airYardsShare: 0.2 },
    },
    {
      role: "QB_GAME_MANAGER",
      minScoreForKnownRole: 0.58,
      prototype: { passAttemptShare: 0.6, designedRushShare: 0.18, redZoneShare: 0.55 },
      weights: { passAttemptShare: 0.4, designedRushShare: 0.25, redZoneShare: 0.35 },
    },
  ],
  RB: [
    {
      role: "RB_WORKHORSE",
      minScoreForKnownRole: 0.64,
      prototype: { snapShare: 0.78, carryShare: 0.84, routeParticipation: 0.56 },
      weights: { snapShare: 0.35, carryShare: 0.45, routeParticipation: 0.2 },
    },
    {
      role: "RB_PASS_CATCHING",
      minScoreForKnownRole: 0.6,
      prototype: { routeParticipation: 0.78, targetShare: 0.7, carryShare: 0.32 },
      weights: { routeParticipation: 0.45, targetShare: 0.35, carryShare: 0.2 },
    },
    {
      role: "RB_GOAL_LINE",
      minScoreForKnownRole: 0.6,
      prototype: { carryShare: 0.58, redZoneShare: 0.84, routeParticipation: 0.25 },
      weights: { carryShare: 0.35, redZoneShare: 0.5, routeParticipation: 0.15 },
    },
    {
      role: "RB_COMMITTEE",
      minScoreForKnownRole: 0.56,
      prototype: { snapShare: 0.45, carryShare: 0.42, routeParticipation: 0.45 },
      weights: { snapShare: 0.4, carryShare: 0.3, routeParticipation: 0.3 },
    },
  ],
  WR: [
    {
      role: "WR_ALPHA",
      minScoreForKnownRole: 0.62,
      prototype: { snapShare: 0.88, targetShare: 0.86, airYardsShare: 0.76 },
      weights: { snapShare: 0.2, targetShare: 0.45, airYardsShare: 0.35 },
    },
    {
      role: "WR_SLOT_VOLUME",
      minScoreForKnownRole: 0.6,
      prototype: { routeParticipation: 0.8, targetShare: 0.74, adot: 0.3 },
      weights: { routeParticipation: 0.35, targetShare: 0.4, adot: 0.25 },
    },
    {
      role: "WR_DEEP_THREAT",
      minScoreForKnownRole: 0.59,
      prototype: { airYardsShare: 0.88, adot: 0.82, targetShare: 0.45 },
      weights: { airYardsShare: 0.4, adot: 0.45, targetShare: 0.15 },
    },
    {
      role: "WR_GADGET",
      minScoreForKnownRole: 0.55,
      prototype: { routeParticipation: 0.35, carryShare: 0.4, yacOverExpected: 0.72 },
      weights: { routeParticipation: 0.25, carryShare: 0.35, yacOverExpected: 0.4 },
    },
  ],
  TE: [
    {
      role: "TE_MOVE",
      minScoreForKnownRole: 0.62,
      prototype: { routeParticipation: 0.78, targetShare: 0.66, airYardsShare: 0.45 },
      weights: { routeParticipation: 0.35, targetShare: 0.4, airYardsShare: 0.25 },
    },
    {
      role: "TE_INLINE",
      minScoreForKnownRole: 0.58,
      prototype: { snapShare: 0.8, routeParticipation: 0.5, redZoneShare: 0.52 },
      weights: { snapShare: 0.4, routeParticipation: 0.3, redZoneShare: 0.3 },
    },
    {
      role: "TE_RED_ZONE",
      minScoreForKnownRole: 0.59,
      prototype: { redZoneShare: 0.84, targetShare: 0.56, routeParticipation: 0.5 },
      weights: { redZoneShare: 0.5, targetShare: 0.35, routeParticipation: 0.15 },
    },
    {
      role: "TE_BLOCKING",
      minScoreForKnownRole: 0.56,
      prototype: { snapShare: 0.72, routeParticipation: 0.2, targetShare: 0.1 },
      weights: { snapShare: 0.4, routeParticipation: 0.35, targetShare: 0.25 },
    },
  ],
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function calculateRoleScore(profile: NormalizedOffensiveUsageProfile, template: RoleTemplate): number {
  let weightedScore = 0;
  let totalWeight = 0;

  for (const [metric, expectedValue] of Object.entries(template.prototype) as Array<[UsageMetric, number]>) {
    const observed = profile.metrics[metric];
    if (observed === undefined || !Number.isFinite(observed)) {
      continue;
    }

    const weight = template.weights[metric] ?? 0;
    if (weight <= 0) {
      continue;
    }

    const normalizedObserved = clamp01(observed);
    const distance = Math.abs(normalizedObserved - expectedValue);
    const metricScore = 1 - distance;

    weightedScore += metricScore * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return 0;
  }

  return weightedScore / totalWeight;
}

function getAvailableMetricCount(profile: NormalizedOffensiveUsageProfile): number {
  return Object.values(profile.metrics).filter((metric) => Number.isFinite(metric)).length;
}

function buildReasons(
  profile: NormalizedOffensiveUsageProfile,
  template: RoleTemplate,
  score: number,
  isUnknownRole: boolean,
): string[] {
  const reasons: string[] = [];
  reasons.push(`role score ${score.toFixed(3)} vs threshold ${template.minScoreForKnownRole.toFixed(3)}`);

  const matchingMetrics = Object.entries(template.prototype)
    .map(([metric, expectedValue]) => {
      const observed = profile.metrics[metric as UsageMetric];
      if (observed === undefined || !Number.isFinite(observed)) {
        return null;
      }
      const delta = Math.abs(clamp01(observed) - expectedValue);
      return { metric, delta, observed: clamp01(observed), expectedValue };
    })
    .filter((entry): entry is { metric: string; delta: number; observed: number; expectedValue: number } => entry !== null)
    .sort((left, right) => left.delta - right.delta)
    .slice(0, 3);

  for (const metricMatch of matchingMetrics) {
    reasons.push(
      `${metricMatch.metric}: observed=${metricMatch.observed.toFixed(3)} expected=${metricMatch.expectedValue.toFixed(3)}`,
    );
  }

  if (isUnknownRole) {
    reasons.push("classified as UNKNOWN due to low confidence or insufficient metric coverage");
  }

  return reasons;
}

export function assignOffensiveRole(profile: NormalizedOffensiveUsageProfile): PlayerRoleAssignment {
  const templates = ROLE_TEMPLATES[profile.position];
  const availableMetricCount = getAvailableMetricCount(profile);
  const candidateScores = templates
    .map((template) => ({ role: template.role, score: calculateRoleScore(profile, template), template }))
    .sort((left, right) => right.score - left.score);

  const topCandidate = candidateScores[0];
  const runnerUpScore = candidateScores[1]?.score ?? 0;
  const margin = topCandidate.score - runnerUpScore;

  const isUnknownRole =
    availableMetricCount < MIN_METRICS_FOR_KNOWN_ROLE ||
    topCandidate.score < topCandidate.template.minScoreForKnownRole ||
    margin < UNKNOWN_MARGIN_THRESHOLD;

  return {
    playerId: profile.playerId,
    playerName: profile.playerName,
    position: profile.position,
    assignedRole: isUnknownRole ? "UNKNOWN" : topCandidate.role,
    confidence: Number(topCandidate.score.toFixed(4)),
    isUnknownRole,
    reasons: buildReasons(profile, topCandidate.template, topCandidate.score, isUnknownRole),
    candidateScores: candidateScores.map((candidate) => ({
      role: candidate.role,
      score: Number(candidate.score.toFixed(4)),
    })),
  };
}

export function batchAssignRoles(
  profiles: NormalizedOffensiveUsageProfile[],
): PlayerRoleAssignment[] {
  return profiles.map((profile) => assignOffensiveRole(profile));
}

