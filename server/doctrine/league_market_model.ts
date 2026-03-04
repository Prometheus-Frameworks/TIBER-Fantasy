// server/doctrine/league_market_model.ts
// Compare a player's FORGE score against their implied market value within a league.

import {
  type DoctrineEvaluation,
  type ContributingSignal,
  makeEvaluation,
  clamp,
  signalDirection,
  doctrineFetch,
} from './types';

const MODULE_NAME = 'league_market_model';

// ── Response types ──────────────────────────────────────────

interface ForgePlayerResult {
  playerId: string;
  playerName?: string;
  position: string;
  alpha: number;
  tier?: string;
  nflTeam?: string;
  subScores?: {
    volume: number;
    efficiency: number;
    stability: number;
    contextFit: number;
  };
}

interface ForgePlayerDetailResponse {
  success?: boolean;
  score?: {
    playerId: string;
    playerName: string;
    position: string;
    alpha: number;
    tier: string;
    pillars: {
      volume: number;
      efficiency: number;
      teamContext: number;
      stability: number;
    };
  };
}

interface ForgePoolPlayerResponse {
  success?: boolean;
  score?: {
    playerId: string;
    playerName?: string;
    position: string;
    alpha: number;
    tier?: string;
  };
}

// ── Tier mapping ────────────────────────────────────────────

const TIER_RANK: Record<string, number> = {
  'Elite': 5,
  'Starter': 4,
  'Flex': 3,
  'Bench': 2,
  'Handcuff': 1,
};

const IMPLIED_TIER_MAP: Record<string, number> = {
  'premium': 5,
  'starter': 4,
  'flex': 3,
  'bench/handcuff': 2,
};

// ── Primary export ──────────────────────────────────────────

export async function evaluateMarketPosition(
  playerId: string,
  leagueId: string,
  allLeaguePlayerIds: string[],
  apiKey: string,
  baseUrl: string,
): Promise<DoctrineEvaluation> {
  // Fetch target player and all pool players individually in parallel
  const poolIds = allLeaguePlayerIds.filter((id) => id !== playerId);
  const [targetRaw, ...poolResults] = await Promise.all([
    doctrineFetch<ForgePlayerDetailResponse>(
      `/api/v1/forge/player/${playerId}?mode=dynasty`,
      apiKey,
      baseUrl,
    ),
    ...poolIds.map((id) =>
      doctrineFetch<ForgePoolPlayerResponse>(`/api/v1/forge/player/${id}?mode=dynasty`, apiKey, baseUrl),
    ),
  ]);

  // Normalize target player
  const target = normalizeTarget(targetRaw, playerId);

  // Build pool including target player
  const allForgeResults: ForgePlayerResult[] = [];
  // Add target player to pool
  if (target) {
    allForgeResults.push({ playerId: target.playerId, position: target.position, alpha: target.alpha, tier: target.tier });
  }
  // Add pool players
  for (const r of poolResults) {
    const pr = r as ForgePoolPlayerResponse | null;
    if (pr?.score) {
      allForgeResults.push({ playerId: pr.score.playerId, position: pr.score.position, alpha: pr.score.alpha, tier: pr.score.tier });
    }
  }
  const pool = allForgeResults;

  if (!target) {
    return makeEvaluation({
      module: MODULE_NAME,
      entity_type: 'player',
      entity_id: playerId,
      evaluation_score: 0.5,
      confidence: 0.10,
      contributing_signals: [],
      reasoning: `FORGE data unavailable for player ${playerId}. Cannot assess market position.`,
    });
  }

  const targetPosition = target.position.toUpperCase();
  const targetAlpha = target.alpha;
  const forgeTier = target.tier ?? 'unknown';

  // Filter pool to same position
  const positionGroup = pool.filter(
    (p) => p.position?.toUpperCase() === targetPosition && p.alpha !== undefined && p.alpha !== null,
  );

  if (positionGroup.length < 2) {
    return makeEvaluation({
      module: MODULE_NAME,
      entity_type: 'player',
      entity_id: playerId,
      evaluation_score: 0.5,
      confidence: 0.15,
      contributing_signals: [
        { name: 'player_alpha', value: targetAlpha, weight: 0.5, direction: signalDirection(targetAlpha - 50) },
        { name: 'forge_tier', value: forgeTier, weight: 0.5, direction: 'neutral' },
      ],
      reasoning: `Insufficient position-group data (${positionGroup.length} players) to evaluate market position. Alpha: ${targetAlpha.toFixed(0)}.`,
    });
  }

  // Position-group rank percentile
  const alphasInGroup = positionGroup.map((p) => p.alpha);
  const rank = alphasInGroup.filter((a) => a > targetAlpha).length + 1; // 1 = best
  const positionRankPct = 1 - (rank - 1) / (positionGroup.length - 1 || 1);

  // Z-score
  const mean = alphasInGroup.reduce((s, v) => s + v, 0) / alphasInGroup.length;
  const variance = alphasInGroup.reduce((s, v) => s + (v - mean) ** 2, 0) / alphasInGroup.length;
  const std = Math.sqrt(variance);
  const alphaZscore = std > 0 ? (targetAlpha - mean) / std : 0;

  // Implied market tier
  let impliedMarketTier: string;
  if (rank <= 3) {
    impliedMarketTier = 'premium';
  } else if (rank <= 6) {
    impliedMarketTier = 'starter';
  } else if (rank <= 10) {
    impliedMarketTier = 'flex';
  } else {
    impliedMarketTier = 'bench/handcuff';
  }

  // Score
  let base = 0.5;
  base += (positionRankPct - 0.5) * 0.6;
  base += clamp(alphaZscore * 0.1, -0.2, 0.2);
  const score = clamp(base, 0, 1);

  // Detect tier mismatch for reasoning
  const forgeTierRank = TIER_RANK[forgeTier] ?? 3;
  const impliedRank = IMPLIED_TIER_MAP[impliedMarketTier] ?? 3;
  const tierDelta = forgeTierRank - impliedRank;

  // Confidence based on pool size
  const poolConfidence = clamp(positionGroup.length / 20, 0.3, 1.0);
  const confidence = clamp(poolConfidence * 0.8 + 0.15, 0.3, 0.95);

  const signals: ContributingSignal[] = [
    { name: 'position_rank_pct', value: round2(positionRankPct), weight: 0.30, direction: signalDirection(positionRankPct - 0.5) },
    { name: 'alpha_zscore', value: round2(alphaZscore), weight: 0.20, direction: signalDirection(alphaZscore) },
    { name: 'implied_market_tier', value: impliedMarketTier, weight: 0.15, direction: 'neutral' },
    { name: 'forge_tier', value: forgeTier, weight: 0.15, direction: 'neutral' },
    { name: 'player_alpha', value: round2(targetAlpha), weight: 0.10, direction: signalDirection(targetAlpha - 50) },
    { name: 'position_mean_alpha', value: round2(mean), weight: 0.10, direction: 'neutral' },
  ];

  const reasoning = buildReasoning(targetPosition, targetAlpha, forgeTier, impliedMarketTier, tierDelta, score, positionRankPct, positionGroup.length);

  return makeEvaluation({
    module: MODULE_NAME,
    entity_type: 'player',
    entity_id: playerId,
    evaluation_score: score,
    confidence,
    contributing_signals: signals,
    reasoning,
    meta: {
      position_rank: rank,
      position_group_size: positionGroup.length,
      alpha_zscore: round2(alphaZscore),
      implied_market_tier: impliedMarketTier,
      forge_tier: forgeTier,
      tier_delta: tierDelta,
    },
  });
}

// ── Helpers ─────────────────────────────────────────────────

interface NormalizedTarget {
  playerId: string;
  position: string;
  alpha: number;
  tier: string;
}

function normalizeTarget(raw: ForgePlayerDetailResponse | null, playerId: string): NormalizedTarget | null {
  if (!raw) return null;
  if (raw.score) {
    return {
      playerId: raw.score.playerId,
      position: raw.score.position,
      alpha: raw.score.alpha,
      tier: raw.score.tier,
    };
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildReasoning(
  position: string,
  alpha: number,
  forgeTier: string,
  impliedTier: string,
  tierDelta: number,
  score: number,
  rankPct: number,
  groupSize: number,
): string {
  const parts: string[] = [];

  if (tierDelta > 0) {
    parts.push(`This ${position} is undervalued in the league market — FORGE rates them ${forgeTier} but league position rank implies ${impliedTier}.`);
  } else if (tierDelta < 0) {
    parts.push(`This ${position} is overvalued — FORGE tier is ${forgeTier} but league rank implies ${impliedTier}.`);
  } else {
    parts.push(`This ${position} is fairly valued at the ${impliedTier} level.`);
  }

  parts.push(`Ranks at the ${(rankPct * 100).toFixed(0)}th percentile among ${groupSize} ${position}s in the league (alpha: ${alpha.toFixed(0)}, score: ${score.toFixed(2)}).`);

  return parts.join(' ');
}
