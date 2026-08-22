/**
 * FFI-3: Fantasy's side of the weekly player-card seam, proven offline
 * against the vendored frozen golden fixtures — the same bytes Forecast's
 * own CI validates. This is the FFI-1 mission loop closed from the consumer
 * side:
 *
 *   Fantasy state → v1 request (schema-gated)
 *     → frozen Forecast response fixtures → normalization without semantic loss
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildWeeklyPlayerCardV1Request,
  normalizeWeeklyPlayerCardV1Response,
} from '../fantasyForecastWeeklyPlayerV1Adapter';
import type { ScoringPlayerInput } from '../types';

const FIXTURES_DIR = path.join(__dirname, '..', 'contracts', 'fantasyForecastWeeklyPlayerV1', 'fixtures');
const readFixture = (name: string): unknown => JSON.parse(readFileSync(path.join(FIXTURES_DIR, `${name}.json`), 'utf8'));

const frozenValidRequest = readFixture('valid_weekly_player_request') as Record<string, unknown>;

const leagueContext = {
  season: 2026,
  week: 1,
  scoringFormat: 'ppr',
  teams: 12,
  starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1 },
};

const player: ScoringPlayerInput = {
  player_id: '00-0036322',
  player_name: 'Justin Jefferson',
  team: 'MIN',
  position: 'WR',
  games_sampled: 4,
  routes_pg: 36.5,
  targets_pg: 9.5,
  carries_pg: 0.4,
  // Fantasy-local fields the v1 contract does not define:
  fantasy_points_ppr_pg: 19.1,
  snap_share: 0.89,
  target_share: 0.31,
  volatility_index: 0.2,
};

describe('buildWeeklyPlayerCardV1Request', () => {
  it('builds a schema-valid v1 request and drops non-contract fields', () => {
    const built = buildWeeklyPlayerCardV1Request({ leagueContext, player });
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    expect(built.request).toEqual({
      contract: 'fantasy_forecast.weekly_player_request',
      contract_version: '1.0.0',
      horizon: 'weekly',
      season: 2026,
      week: 1,
      scoring_profile: 'tiber-generic-full-ppr-v1',
      players: [
        {
          player_id: '00-0036322',
          player_name: 'Justin Jefferson',
          team: 'MIN',
          position: 'WR',
          games_sampled: 4,
          routes_pg: 36.5,
          targets_pg: 9.5,
          carries_pg: 0.4,
        },
      ],
      league_context: { teams: 12, starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1 } },
    });
    // The dropped fields must not leak into the wire request under any key:
    const wire = JSON.stringify(built.request);
    for (const forbidden of ['snap_share', 'target_share', 'fantasy_points_ppr_pg', 'volatility_index']) {
      expect(wire).not.toContain(forbidden);
    }
  });

  it('fails closed when the replacement context is unresolved — no fabricated lineup', () => {
    const built = buildWeeklyPlayerCardV1Request({
      leagueContext: { season: 2026, week: 1, scoringFormat: 'ppr' },
      player,
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    const issues = built.issues.join('\n');
    expect(issues).toContain('leagueContext.teams is required');
    expect(issues).toContain('leagueContext.starters is required');
    expect(issues).toContain('does not fabricate replacement context');
  });

  it('uses caller-resolved starters when present', () => {
    const built = buildWeeklyPlayerCardV1Request({
      leagueContext: { ...leagueContext, teams: 10, starters: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 2 } },
      player,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect((built.request.league_context as Record<string, unknown>).teams).toBe(10);
    expect((built.request.league_context as Record<string, unknown>).starters).toEqual({ QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 2 });
  });

  it('fails closed when the weekly horizon is unresolved', () => {
    const built = buildWeeklyPlayerCardV1Request({ leagueContext: { scoringFormat: 'ppr' }, player });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues.join('\n')).toContain('season is required');
    expect(built.issues.join('\n')).toContain('week is required');
  });

  it('fails closed when the scoring format is unresolved — omission is not full PPR', () => {
    const built = buildWeeklyPlayerCardV1Request({
      leagueContext: { season: 2026, week: 1, teams: 12, starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1 } },
      player,
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues.join('\n')).toContain('leagueContext.scoringFormat is required');
    expect(built.issues.join('\n')).toContain('does not assume full PPR');
  });

  it('refuses to relabel a non-full-PPR league as full PPR', () => {
    const built = buildWeeklyPlayerCardV1Request({
      leagueContext: { ...leagueContext, scoringFormat: 'half_ppr' },
      player,
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues.join('\n')).toContain('cannot be represented');
  });

  it('fails closed on null or unsupported player identity (the FFI-0 defect)', () => {
    const built = buildWeeklyPlayerCardV1Request({
      leagueContext,
      player: { player_id: '00-0000001', player_name: undefined, team: null, position: 'K', games_sampled: null },
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    const issues = built.issues.join('\n');
    expect(issues).toContain('player.player_name is required');
    expect(issues).toContain('player.team is required');
    expect(issues).toContain('player.position must be one of QB, RB, WR, TE');
    expect(issues).toContain('player.games_sampled is required');
  });

  it('rejects contract-out-of-range aggregates at the frozen schema gate', () => {
    const built = buildWeeklyPlayerCardV1Request({
      leagueContext,
      player: { ...player, games_sampled: 40 },
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues.join('\n')).toContain('games_sampled');
  });
});

describe('normalizeWeeklyPlayerCardV1Response against the frozen golden fixtures', () => {
  it('normalizes the frozen valid response without semantic loss', () => {
    const result = normalizeWeeklyPlayerCardV1Response(frozenValidRequest, readFixture('valid_weekly_player_card_response'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const card = result.card;
    // Identity + horizon are mechanically preserved:
    expect(card.contract).toBe('fantasy_forecast.weekly_player_card');
    expect(card.contractVersion).toBe('1.0.0');
    expect(card.scoringMode).toBe('weekly');
    expect(card.viewType).toBe('player_card');
    expect(card.season).toBe(2026);
    expect(card.week).toBe(1);
    expect(card.scoringProfile).toBe('tiber-generic-full-ppr-v1');
    // The clocks and trust tags the pre-FFI normalizer used to drop survive:
    expect(card.generatedAt).toBe('2026-08-22T00:00:00.000Z');
    expect(card.confidenceBand).toBe('MEDIUM');
    expect(card.volatilityTag).toBe('MODERATE');
    expect(card.fragilityTag).toBe('LOW');
    // Replacement semantics survive:
    expect(card.expectedPoints).toBe(15.43);
    expect(card.replacementPoints).toBe(8.68);
    expect(card.vorp).toBe(6.75);
    expect(card.scoringComponents.vorp).toBe(6.75);
    // Deprecated aliases mirror the canonical tags:
    expect(card.confidence).toBe('MEDIUM');
    expect(card.volatility).toBe('MODERATE');
    expect(card.fragility).toBe('LOW');
  });

  it('reports the unavailable/stale envelope as a distinct no-data state, never zeros — warnings preserved', () => {
    const result = normalizeWeeklyPlayerCardV1Response(
      frozenValidRequest,
      readFixture('weekly_player_card_unavailable_or_stale_state'),
    );
    expect(result).toEqual(
      expect.objectContaining({ ok: false, kind: 'unavailable', message: expect.stringContaining('WEEKLY_PLAYER_CARD_UNAVAILABLE') }),
    );
    if (result.ok) return;
    // The stale-evidence warning survives the failure path:
    expect(result.warnings).toEqual([expect.objectContaining({ code: 'STALE_SOURCE_WINDOW' })]);
    expect(result.message).toContain('(warnings: STALE_SOURCE_WINDOW)');
  });

  it('carries success-envelope warnings onto the normalized card', () => {
    // The frozen valid response has no warnings — normalized card reflects that:
    const clean = normalizeWeeklyPlayerCardV1Response(frozenValidRequest, readFixture('valid_weekly_player_card_response'));
    expect(clean.ok).toBe(true);
    if (clean.ok) expect(clean.card.warnings).toEqual([]);

    // A schema-valid success envelope carrying a warning keeps it on the
    // card, INCLUDING its structured details (source windows, provenance):
    const warned = readFixture('valid_weekly_player_card_response') as Record<string, unknown>;
    warned.warnings = [
      {
        code: 'STALE_SOURCE_WINDOW',
        message: 'Sample window predates the requested week.',
        details: { last_admissible_week: 16, requested_week: 1 },
      },
    ];
    const result = normalizeWeeklyPlayerCardV1Response(frozenValidRequest, warned);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.warnings).toEqual([
      {
        code: 'STALE_SOURCE_WINDOW',
        message: 'Sample window predates the requested week.',
        details: { last_admissible_week: 16, requested_week: 1 },
      },
    ]);
  });

  it('rejects the frozen malformed response fixture', () => {
    const result = normalizeWeeklyPlayerCardV1Response(
      frozenValidRequest,
      readFixture('invalid_malformed_weekly_player_card_response'),
    );
    expect(result).toEqual(expect.objectContaining({ ok: false, kind: 'invalid_payload' }));
  });

  it('rejects the semantic-regression fixture: weekly must not be consumable as ROS', () => {
    const result = normalizeWeeklyPlayerCardV1Response(
      frozenValidRequest,
      readFixture('semantic_regression_weekly_must_not_be_ros'),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('invalid_payload');
    expect(result.message).toMatch(/scoring_mode|ros_/);
  });

  it('rejects a well-formed card that is not the answer to this request (exchange rule)', () => {
    const response = readFixture('valid_weekly_player_card_response') as {
      data: { card: Record<string, unknown> };
    };
    response.data.card.player_id = 'SOMEONE-ELSE';
    // Keep it otherwise schema-valid; only the exchange binding is violated.
    const result = normalizeWeeklyPlayerCardV1Response(frozenValidRequest, response);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('invalid_payload');
    expect(result.message).toContain('Exchange violation');
  });
});
