import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HistoricalEvidence, HistoricalPlayer } from '../../../shared/draftReviewEvidence';

const BUNDLE_PATH = resolve(process.cwd(), 'server/modules/draftReview/artifacts/historical2025.json');
const BUNDLE_SHA256 = '32170de4ac4de900107a2d22cca7abc82f98256253c5fb54ef03c195dfa63bcf';
const SCHEMA = 'tiber_draft_review_historical_v1' as const;
// Cache only immutable public source bytes. No league, roster, selection or operator state.
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
  return { ...JSON.parse(raw.toString('utf8')), status: 'available', reason: null };
}

export function historicalEvidenceFor(playerIds: string[]): HistoricalEvidence {
  if (playerIds.length > 32 || playerIds.some(id => !/^(?:\d{1,24}|[A-Z]{2,3})$/.test(id))) {
    return unavailableHistoricalEvidence('Evidence selection exceeds the supported identity or 32-player limit.');
  }
  try {
    if (verifiedBytes === undefined) {
      const raw = readFileSync(BUNDLE_PATH);
      decodeHistoricalBundle(raw);
      verifiedBytes = raw.toString('utf8');
    }
    // Fresh parse prevents one response or caller from changing another user's evidence.
    const bundle = JSON.parse(verifiedBytes) as HistoricalEvidence;
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
