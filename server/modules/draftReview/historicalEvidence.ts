import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HistoricalEvidence, HistoricalPlayer } from '../../../shared/draftReviewEvidence';

const BUNDLE_PATH = resolve(process.cwd(), 'server/modules/draftReview/artifacts/historical2025.json');
const BUNDLE_SHA256 = '68b3a863560edb974e999ea22fa2c31cc5e353cdc762d0a84cb177fe1ef3cb26';
const SCHEMA = 'tiber_draft_review_historical_v1' as const;
// Cache only integrity-checked evidence after applying the promotion boundary.
// No league, roster, selection or operator state.
let verifiedBytes: string | undefined;

export function unavailableHistoricalEvidence(reason: string): HistoricalEvidence {
  return {
    schema_version: SCHEMA, status: 'unavailable', reason,
    window: { season: 2025, week_start: 1, week_end: 18, period_basis: 'documented 2025 regular-season week boundary; game_type/game_id absent' },
    provenance: null, limitations: ['Historical evidence is unavailable; no substitute values inferred.'],
    unavailable_metrics: {}, forecast: { status: 'unavailable', fabricated_values: false }, players: [],
  };
}

/** Exact content pin validates the entire governed payload, not just a permissive JSON shape. */
export function decodeHistoricalBundle(raw: Buffer): HistoricalEvidence {
  if (raw.length > 250_000 || createHash('sha256').update(raw).digest('hex') !== BUNDLE_SHA256) {
    throw new Error('Historical source integrity check failed');
  }
  const bundle = JSON.parse(raw.toString('utf8')) as HistoricalEvidence;
  // The whole-bundle content pin admits a reviewed policy + exact promotion
  // receipt, not a free-form stage string, runtime mode or deployment status.
  const promotion = bundle.provenance?.team_roster_identity_promotion;
  if (promotion?.path !== 'exports/promoted/draft_review/team_roster_identity_promotion_v1.json'
      || promotion.sha256 !== '215d2b47edb204a138d30725b4e2e3974993f105271667d665c651b825408c85'
      || promotion.receipt.status !== 'accepted_for_historical_consumer_use'
      || promotion.receipt.historical_consumer_use_authorized !== true) {
    throw new Error('Historical promotion integrity check failed');
  }
  return { ...bundle, status: 'available', reason: null };
}

export function historicalEvidenceFor(playerIds: string[]): HistoricalEvidence {
  if (playerIds.length > 32 || playerIds.some(id => !/^(?:\d{1,24}|[A-Z]{2,3})$/.test(id))) {
    return unavailableHistoricalEvidence('Evidence selection exceeds the supported identity or 32-player limit.');
  }
  try {
    const bundle = historicalCatalogEvidence();
    if (bundle.status !== 'available') return bundle;
    const players = new Map(bundle.players.map(player => [player.player_id, player]));
    return { ...bundle, status: 'available', reason: null, players: Array.from(new Set(playerIds)).map(player_id =>
      players.get(player_id) ?? {
        player_id, status: 'unavailable', reason: 'No admitted exact Sleeper-to-GSIS identity mapping.',
        identity: null, observed: null, derived: {},
      } as HistoricalPlayer) };
  } catch {
    return unavailableHistoricalEvidence('The admitted historical artifact is missing or failed integrity validation.');
  }
}

/** The existing admitted cohort only; no provider refresh or identity admission. */
export function historicalCatalogEvidence(): HistoricalEvidence {
  try {
    if (verifiedBytes === undefined) {
      verifiedBytes = JSON.stringify(decodeHistoricalBundle(readFileSync(BUNDLE_PATH)));
    }
    return JSON.parse(verifiedBytes) as HistoricalEvidence;
  } catch {
    return unavailableHistoricalEvidence('The admitted historical artifact is missing or failed integrity validation.');
  }
}
