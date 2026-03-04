// server/doctrine/asset_insulation_model.ts
// Score how insulated a player's value is from scheme changes, injury risk, and role competition.

import {
  type DoctrineEvaluation,
  type ContributingSignal,
  type Position,
  makeEvaluation,
  clamp,
  signalDirection,
  doctrineFetch,
} from './types';

const MODULE_NAME = 'asset_insulation_model';

// ── Response types for FORGE and FIRE endpoints ─────────────

interface ForgePlayerResponse {
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
  // Also handle flat-shape from batch-style responses
  playerId?: string;
  alpha?: number;
  tier?: string;
  pillars?: {
    volume: number;
    efficiency: number;
    teamContext: number;
    stability: number;
  };
}

interface FirePlayerResponse {
  playerId: string;
  fireScore: number | null;
  eligible?: boolean;
  pillars?: {
    opportunity: number | null;
    role: number | null;
    conversion: number | null;
  };
  stats?: {
    xfpDiff?: number | null;
  };
}

// ── Position modifiers ──────────────────────────────────────

const POSITION_MODIFIERS: Record<Position, number> = {
  QB: 1.10,
  RB: 0.85,
  WR: 1.00,
  TE: 1.05,
};

// ── Primary export ──────────────────────────────────────────

export async function evaluateAssetInsulation(
  playerId: string,
  position: Position,
  apiKey: string,
  baseUrl: string,
): Promise<DoctrineEvaluation> {
  // Fetch FORGE and FIRE in parallel
  const [forgeRaw, fireData] = await Promise.all([
    doctrineFetch<ForgePlayerResponse>(
      `/api/v1/forge/player/${playerId}?mode=dynasty`,
      apiKey,
      baseUrl,
    ),
    doctrineFetch<FirePlayerResponse>(
      `/api/v1/fire/player/${playerId}`,
      apiKey,
      baseUrl,
    ),
  ]);

  // Normalize FORGE response (may be nested under .score or flat)
  const forge = normalizeForge(forgeRaw);
  const fire = fireData;

  // Track data availability for confidence
  const hasForge = forge !== null;
  const hasFire = fire !== null && fire.eligible !== false && fire.fireScore !== null;

  if (!hasForge && !hasFire) {
    return makeEvaluation({
      module: MODULE_NAME,
      entity_type: 'player',
      entity_id: playerId,
      evaluation_score: 0.5,
      confidence: 0.10,
      contributing_signals: [],
      reasoning: `No FORGE or FIRE data available for player ${playerId}. Cannot assess asset insulation.`,
    });
  }

  // Extract pillar values (default to 50 — neutral — when missing)
  const efficiency = forge?.pillars.efficiency ?? 50;
  const stability = forge?.pillars.stability ?? 50;
  const teamContext = forge?.pillars.teamContext ?? 50;
  const volume = forge?.pillars.volume ?? 50;
  const alpha = forge?.alpha ?? 50;
  const tier = forge?.tier ?? 'unknown';

  const opportunityScore = hasFire ? (fire!.pillars?.opportunity ?? 50) : 50;
  const roleScore = hasFire ? (fire!.pillars?.role ?? 50) : 50;
  const xfptsDelta = hasFire ? (fire!.stats?.xfpDiff ?? 0) : 0;

  // Compute insulation signals
  const schemeIndependence = efficiency / 100;
  const roleSecurity = (roleScore / 100) * 0.6 + (stability / 100) * 0.4;
  const opportunityDurability = opportunityScore / 100;
  const teamDependency = 1 - (teamContext / 100);

  // Weighted score
  let score =
    (schemeIndependence * 0.30) +
    (roleSecurity * 0.35) +
    (opportunityDurability * 0.25) +
    ((1 - teamDependency) * 0.10);

  // Position modifier
  score *= POSITION_MODIFIERS[position];
  score = clamp(score, 0, 1);

  // Confidence
  let confidence = 0.50;
  if (hasForge) confidence += 0.25;
  if (hasFire) confidence += 0.20;
  confidence = clamp(confidence, 0.15, 0.95);

  const signals: ContributingSignal[] = [
    { name: 'scheme_independence', value: round2(schemeIndependence), weight: 0.30, direction: signalDirection(schemeIndependence - 0.5) },
    { name: 'role_security', value: round2(roleSecurity), weight: 0.35, direction: signalDirection(roleSecurity - 0.5) },
    { name: 'opportunity_durability', value: round2(opportunityDurability), weight: 0.25, direction: signalDirection(opportunityDurability - 0.5) },
    { name: 'team_dependency', value: round2(teamDependency), weight: 0.10, direction: signalDirection(-teamDependency + 0.5) },
  ];

  const reasoning = buildReasoning(position, score, schemeIndependence, roleSecurity, tier);

  return makeEvaluation({
    module: MODULE_NAME,
    entity_type: 'player',
    entity_id: playerId,
    evaluation_score: score,
    confidence,
    contributing_signals: signals,
    reasoning,
    meta: {
      forge_alpha: alpha,
      forge_tier: tier,
      xfpts_delta: xfptsDelta,
      position_modifier: POSITION_MODIFIERS[position],
    },
  });
}

// ── Helpers ─────────────────────────────────────────────────

interface NormalizedForge {
  alpha: number;
  tier: string;
  pillars: {
    volume: number;
    efficiency: number;
    teamContext: number;
    stability: number;
  };
}

function normalizeForge(raw: ForgePlayerResponse | null): NormalizedForge | null {
  if (!raw) return null;

  // Nested under .score (from v1 forge/player endpoint)
  if (raw.score) {
    return {
      alpha: raw.score.alpha,
      tier: raw.score.tier,
      pillars: raw.score.pillars,
    };
  }

  // Flat shape
  if (raw.alpha !== undefined && raw.pillars) {
    return {
      alpha: raw.alpha,
      tier: raw.tier ?? 'unknown',
      pillars: raw.pillars,
    };
  }

  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildReasoning(
  position: Position,
  score: number,
  schemeIndependence: number,
  roleSecurity: number,
  tier: string,
): string {
  const parts: string[] = [];

  if (score >= 0.70) {
    parts.push(`This ${position} is well-insulated from volatility (score: ${score.toFixed(2)}).`);
  } else if (score >= 0.45) {
    parts.push(`This ${position} has moderate insulation (score: ${score.toFixed(2)}).`);
  } else {
    parts.push(`This ${position} is vulnerable to context changes (score: ${score.toFixed(2)}).`);
  }

  if (schemeIndependence >= 0.65) {
    parts.push('High efficiency indicates scheme-independent production.');
  } else if (schemeIndependence < 0.40) {
    parts.push('Low efficiency suggests production is scheme-dependent.');
  }

  if (roleSecurity < 0.40) {
    parts.push('Role security is weak — competition or usage changes could erode value.');
  }

  if (position === 'RB') {
    parts.push('RB position carries a structural fragility discount.');
  }

  return parts.join(' ');
}
