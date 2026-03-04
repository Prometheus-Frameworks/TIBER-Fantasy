// server/doctrine/roster_construction_heuristics.ts
// Evaluate the structural health of a dynasty roster.

import {
  type DoctrineEvaluation,
  type ContributingSignal,
  type ScoringProfile,
  type PickRecord,
  makeEvaluation,
  clamp,
  signalDirection,
  doctrineFetch,
} from './types';

const MODULE_NAME = 'roster_construction_heuristics';

// ── Response types ──────────────────────────────────────────

interface ForgePlayerResult {
  playerId: string;
  playerName?: string;
  position: string;
  alpha: number;
  tier?: string;
}

interface ForgeBatchResponse {
  scores?: ForgePlayerResult[];
  results?: ForgePlayerResult[];
}

// ── Primary export ──────────────────────────────────────────

export async function evaluateRosterConstruction(
  leagueId: string,
  rosterId: string,
  playerIds: string[],
  scoringProfile: ScoringProfile,
  picks: PickRecord[],
  apiKey: string,
  baseUrl: string,
): Promise<DoctrineEvaluation> {
  if (playerIds.length === 0) {
    return makeEvaluation({
      module: MODULE_NAME,
      entity_type: 'roster',
      entity_id: rosterId,
      evaluation_score: 0,
      confidence: 0.2,
      contributing_signals: [],
      reasoning: 'Empty roster — no players to evaluate construction.',
      meta: { roster_size: 0 },
    });
  }

  // Fetch FORGE batch
  const batchData = await doctrineFetch<ForgeBatchResponse>(
    '/api/v1/forge/batch',
    apiKey,
    baseUrl,
    { method: 'POST', body: { player_ids: playerIds, mode: 'dynasty' } },
  );

  const players = batchData?.scores ?? batchData?.results ?? [];
  const matched = players.filter((p) => p.alpha !== undefined && p.alpha !== null);

  if (matched.length === 0) {
    return makeEvaluation({
      module: MODULE_NAME,
      entity_type: 'roster',
      entity_id: rosterId,
      evaluation_score: 0.3,
      confidence: 0.10,
      contributing_signals: [],
      reasoning: 'FORGE data unavailable for roster players. Cannot assess construction quality.',
      meta: { roster_size: playerIds.length },
    });
  }

  // Positional distribution
  const byPosition = groupByPosition(matched);
  const qbCount = byPosition.QB.length;
  const rbCount = byPosition.RB.length;
  const wrCount = byPosition.WR.length;
  const teCount = byPosition.TE.length;

  const qbElite = byPosition.QB.filter((p) => p.alpha >= 70).length;
  const rbElite = byPosition.RB.filter((p) => p.alpha >= 70).length;
  const wrElite = byPosition.WR.filter((p) => p.alpha >= 70).length;
  const teElite = byPosition.TE.filter((p) => p.alpha >= 70).length;
  const totalElite = qbElite + rbElite + wrElite + teElite;

  // Position scores
  const qbScore = Math.min(qbElite, 1) * 0.5 + Math.min(qbCount / 2, 1) * 0.5;
  const rbScore = Math.min(rbElite / 2, 1) * 0.6 + Math.min(rbCount / 6, 1) * 0.4;
  const wrScore = Math.min(wrElite / 3, 1) * 0.6 + Math.min(wrCount / 8, 1) * 0.4;

  const tePremium = scoringProfile.te_premium > 0;
  const teWeight = tePremium ? 0.15 : 0.08;
  const teScore = tePremium
    ? Math.min(teElite, 1) * 0.6 + Math.min(teCount / 2, 1) * 0.4
    : Math.min(teElite, 1) * 0.5 + Math.min(teCount / 2, 1) * 0.5;

  // Pick capital score
  const ownedPicks = picks.filter((p) => p.current_roster_id === rosterId);
  const firstRoundPicks = ownedPicks.filter((p) => p.round === 1).length;
  const secondRoundPicks = ownedPicks.filter((p) => p.round === 2).length;

  let pickCapitalScore = 0;
  pickCapitalScore += Math.min(firstRoundPicks * 0.05, 0.15);
  pickCapitalScore += Math.min(secondRoundPicks * 0.02, 0.10);
  if (ownedPicks.length === 0) pickCapitalScore = -0.10;

  // Weighted roster score
  let score =
    (qbScore * 0.15) +
    (rbScore * 0.25) +
    (wrScore * 0.35) +
    (teScore * teWeight) +
    pickCapitalScore;

  // If te_premium is off, we have extra weight to distribute (1 - 0.15 - 0.25 - 0.35 - 0.08 = 0.17 leftover)
  // The spec doesn't assign remaining weight, so picks absorb it implicitly.
  // Normalize: pick_capital_score is additive on top, clamp final.
  score = clamp(score, 0, 1);

  // Identify weakest position
  const positionScores: Record<string, number> = {
    QB: qbScore,
    RB: rbScore,
    WR: wrScore,
    TE: teScore,
  };
  const weakestPosition = Object.entries(positionScores).sort((a, b) => a[1] - b[1])[0];

  // Confidence
  const coverage = matched.length / playerIds.length;
  const confidence = clamp(0.45 + (coverage * 0.45), 0.25, 0.95);

  const signals: ContributingSignal[] = [
    { name: 'qb_score', value: round2(qbScore), weight: 0.15, direction: signalDirection(qbScore - 0.5) },
    { name: 'rb_score', value: round2(rbScore), weight: 0.25, direction: signalDirection(rbScore - 0.5) },
    { name: 'wr_score', value: round2(wrScore), weight: 0.35, direction: signalDirection(wrScore - 0.5) },
    { name: 'te_score', value: round2(teScore), weight: teWeight, direction: signalDirection(teScore - 0.5) },
    { name: 'pick_capital_score', value: round2(pickCapitalScore), weight: 0.10, direction: signalDirection(pickCapitalScore) },
    { name: 'roster_size', value: matched.length, weight: 0.05, direction: signalDirection(matched.length - 10) },
    { name: 'elite_count', value: totalElite, weight: 0.10, direction: signalDirection(totalElite - 2) },
  ];

  const reasoning = buildReasoning(score, weakestPosition, totalElite, matched.length, pickCapitalScore, tePremium);

  return makeEvaluation({
    module: MODULE_NAME,
    entity_type: 'roster',
    entity_id: rosterId,
    evaluation_score: score,
    confidence,
    contributing_signals: signals,
    reasoning,
    meta: {
      qb_count: qbCount,
      rb_count: rbCount,
      wr_count: wrCount,
      te_count: teCount,
      qb_elite: qbElite,
      rb_elite: rbElite,
      wr_elite: wrElite,
      te_elite: teElite,
      pick_capital_score: round2(pickCapitalScore),
      first_round_picks: firstRoundPicks,
      second_round_picks: secondRoundPicks,
      te_premium: tePremium,
      weakest_position: weakestPosition[0],
    },
  });
}

// ── Helpers ─────────────────────────────────────────────────

function groupByPosition(players: ForgePlayerResult[]): Record<'QB' | 'RB' | 'WR' | 'TE', ForgePlayerResult[]> {
  const groups: Record<string, ForgePlayerResult[]> = { QB: [], RB: [], WR: [], TE: [] };
  for (const p of players) {
    const pos = p.position?.toUpperCase();
    if (pos === 'QB' || pos === 'RB' || pos === 'WR' || pos === 'TE') {
      groups[pos].push(p);
    }
  }
  return groups as Record<'QB' | 'RB' | 'WR' | 'TE', ForgePlayerResult[]>;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildReasoning(
  score: number,
  weakest: [string, number],
  eliteCount: number,
  rosterSize: number,
  pickCapital: number,
  tePremium: boolean,
): string {
  const parts: string[] = [];

  if (score >= 0.70) {
    parts.push(`Roster construction is strong (score: ${score.toFixed(2)}).`);
  } else if (score >= 0.45) {
    parts.push(`Roster construction is adequate but has gaps (score: ${score.toFixed(2)}).`);
  } else {
    parts.push(`Roster has significant structural weaknesses (score: ${score.toFixed(2)}).`);
  }

  parts.push(`${weakest[0]} is the weakest position group (subscore: ${weakest[1].toFixed(2)}).`);

  if (eliteCount === 0) {
    parts.push('No elite-tier players on roster — competitive ceiling is limited.');
  }

  if (pickCapital < 0) {
    parts.push('No draft capital owned, limiting rebuild flexibility.');
  }

  if (tePremium) {
    parts.push('TE premium scoring increases TE positional weight.');
  }

  return parts.join(' ');
}
