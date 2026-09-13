import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HistoricalEvidence, HistoricalPlayer } from '../../../shared/draftReviewEvidence';

const BUNDLE_PATH = resolve(process.cwd(), 'server/modules/draftReview/artifacts/historical2025.json');
const BUNDLE_SHA256 = '24015b41becb5bcbb87bea7e4c5d8443c3e1254a4ceea9c624a023263b021ea1';
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
  // This exact pinned cohort has preparation authority only. No promotion
  // receipt is admitted here; a stage string, deployment mode, or PR merge
  // cannot grant access. A later reviewed source/policy update must do that.
  const pending = new Set(bundle.provenance?.team_roster_identity_admission?.player_ids ?? []);
  return { ...bundle, status: 'available', reason: null,
    limitations: [...bundle.limitations,
      'The nineteen-player preparation cohort remains unavailable pending recorded upstream promotion and consumer admission.'],
    players: bundle.players.map(player => pending.has(player.player_id) ? {
      player_id: player.player_id, status: 'unavailable',
      reason: 'Historical records are prepared but upstream promotion and consumer admission are not yet recorded.',
      identity: null, observed: null, derived: {},
    } : player),
  };
}

export function historicalEvidenceFor(playerIds: string[]): HistoricalEvidence {
  if (playerIds.length > 32 || playerIds.some(id => !/^(?:\d{1,24}|[A-Z]{2,3})$/.test(id))) {
    return unavailableHistoricalEvidence('Evidence selection exceeds the supported identity or 32-player limit.');
  }
  try {
    if (verifiedBytes === undefined) {
      const raw = readFileSync(BUNDLE_PATH);
      verifiedBytes = JSON.stringify(decodeHistoricalBundle(raw));
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
