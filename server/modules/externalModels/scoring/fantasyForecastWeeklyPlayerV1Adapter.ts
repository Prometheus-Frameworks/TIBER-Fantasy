/**
 * FFI-3 (TIBER-Forecast #182, TIBER-Ops #71): TIBER-Fantasy's adapter for the
 * `fantasy_forecast.weekly_player` v1 contract.
 *
 * Fantasy owns resolving user/league state INTO the contract and consuming the
 * result WITHOUT reinterpretation; TIBER-Forecast owns the contract semantics.
 * Everything here is gated by the vendored frozen artifacts under
 * `./contracts/fantasyForecastWeeklyPlayerV1/` (see VENDOR_PROVENANCE.json):
 * outbound requests are validated against the frozen request schema before
 * they are sent, and inbound responses are validated against the frozen
 * response schema plus the manifest's machine-legible exchange rule before
 * they are trusted. Fail closed everywhere — a request we cannot honestly
 * build, or a response we cannot honestly interpret, is an error state, never
 * a guess.
 */

import requestSchema from './contracts/fantasyForecastWeeklyPlayerV1/fantasy_forecast_weekly_player_request.v1.schema.json';
import responseSchema from './contracts/fantasyForecastWeeklyPlayerV1/fantasy_forecast_weekly_player_card_response.v1.schema.json';
import vendoredManifest from './contracts/fantasyForecastWeeklyPlayerV1/manifest.v1.json';
import {
  validateJsonSchemaSubset,
  type JsonSchemaSubset,
} from './contracts/fantasyForecastWeeklyPlayerV1/validateJsonSchemaSubset.vendored';
import type { ScoringLeagueContextInput, ScoringPlayerInput } from './types';

export const FANTASY_FORECAST_WEEKLY_PLAYER_REQUEST_CONTRACT = 'fantasy_forecast.weekly_player_request';
export const FANTASY_FORECAST_WEEKLY_PLAYER_CARD_RESPONSE_CONTRACT = 'fantasy_forecast.weekly_player_card_response';
export const FANTASY_FORECAST_WEEKLY_PLAYER_CONTRACT_VERSION = '1.0.0';
export const FANTASY_FORECAST_SCORING_PROFILE = 'tiber-generic-full-ppr-v1';

/**
 * Adapter policy (AGENTS.md §9/§11: explicit failure over implicit defaults):
 * the replacement context — league size and starter slots — materially shapes
 * replacement points and VORP, so this adapter NEVER fabricates it. Callers
 * must pass resolved `teams` and `starters`; until they do, the build fails
 * closed with `invalid_request` rather than returning a card silently
 * computed for a lineup the user never configured.
 */

/** Scoring formats this v1 contract can honestly represent (full PPR only). */
const FULL_PPR_FORMATS = new Set(['ppr', 'full_ppr', 'full-ppr', FANTASY_FORECAST_SCORING_PROFILE]);

/**
 * Contract-legal per-player opportunity fields Fantasy currently sources.
 * Anything else on ScoringPlayerInput (snap_share, target_share,
 * fantasy_points_ppr_pg, volatility_index, …) is NOT part of the v1 contract
 * and is dropped: the contract rejects unknown fields, and silently sending
 * them would turn a Fantasy-local feature into accidental seam semantics.
 */
const V1_OPPORTUNITY_FIELDS = ['routes_pg', 'targets_pg', 'carries_pg'] as const;

const SUPPORTED_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export type { ScoringContractIssue, ScoringContractWarning } from './types';
import type { ScoringContractIssue, ScoringContractWarning } from './types';

export type BuildWeeklyPlayerCardV1RequestResult =
  | { ok: true; request: Record<string, unknown> }
  | { ok: false; issues: string[] };

export const buildWeeklyPlayerCardV1Request = (input: {
  leagueContext: ScoringLeagueContextInput & Record<string, unknown>;
  player: ScoringPlayerInput;
}): BuildWeeklyPlayerCardV1RequestResult => {
  const issues: string[] = [];
  const { leagueContext, player } = input;

  const season = leagueContext.season;
  const week = leagueContext.week;
  if (!Number.isInteger(season)) {
    issues.push('leagueContext.season is required (integer) to declare the weekly horizon.');
  }
  if (!Number.isInteger(week)) {
    issues.push('leagueContext.week is required (integer) to declare the weekly horizon.');
  }

  // An omitted format is UNRESOLVED, not full PPR: defaulting it would send
  // the full-PPR profile for a league whose format was never established and
  // return misleading expected points (same implicit-default class as the
  // starters finding; AGENTS.md: explicit failure over implicit defaults).
  if (!isNonEmptyString(leagueContext.scoringFormat)) {
    issues.push(
      'leagueContext.scoringFormat is required (resolved scoring format); the adapter does not assume full PPR.',
    );
  } else if (!FULL_PPR_FORMATS.has(leagueContext.scoringFormat.toLowerCase())) {
    issues.push(
      `leagueContext.scoringFormat "${leagueContext.scoringFormat}" cannot be represented by the ` +
        `${FANTASY_FORECAST_SCORING_PROFILE} contract; refusing to relabel a non-full-PPR league as full PPR.`,
    );
  }

  if (!isNonEmptyString(player.player_id)) issues.push('player.player_id is required (non-empty string).');
  if (!isNonEmptyString(player.player_name)) issues.push('player.player_name is required (non-empty string).');
  if (!isNonEmptyString(player.team)) issues.push('player.team is required (non-empty string).');
  if (!isNonEmptyString(player.position) || !SUPPORTED_POSITIONS.has(player.position)) {
    issues.push('player.position must be one of QB, RB, WR, TE.');
  }
  if (!Number.isInteger(player.games_sampled)) {
    issues.push('player.games_sampled is required (integer count of sampled games).');
  }

  if (!Number.isInteger(leagueContext.teams)) {
    issues.push(
      'leagueContext.teams is required (resolved league size); the adapter does not fabricate replacement context.',
    );
  }
  if (!isRecord(leagueContext.starters)) {
    issues.push(
      'leagueContext.starters is required (resolved starter slots QB/RB/WR/TE, optional FLEX); the adapter does not fabricate replacement context.',
    );
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const requestPlayer: Record<string, unknown> = {
    player_id: player.player_id,
    player_name: player.player_name,
    team: player.team,
    position: player.position,
    games_sampled: player.games_sampled,
  };
  for (const field of V1_OPPORTUNITY_FIELDS) {
    const value = player[field];
    if (typeof value === 'number' && Number.isFinite(value)) {
      requestPlayer[field] = value;
    }
  }

  const request: Record<string, unknown> = {
    contract: FANTASY_FORECAST_WEEKLY_PLAYER_REQUEST_CONTRACT,
    contract_version: FANTASY_FORECAST_WEEKLY_PLAYER_CONTRACT_VERSION,
    horizon: 'weekly',
    season,
    week,
    scoring_profile: FANTASY_FORECAST_SCORING_PROFILE,
    players: [requestPlayer],
    league_context: {
      teams: leagueContext.teams,
      starters: { ...(leagueContext.starters as Record<string, unknown>) },
    },
  };

  // Final gate: the exact frozen request schema. Anything the mapper produced
  // that the contract would reject (out-of-range aggregate, malformed
  // caller-provided starters, …) fails HERE, before a byte crosses the seam.
  const schemaIssues = validateJsonSchemaSubset(request, requestSchema as JsonSchemaSubset);
  if (schemaIssues.length > 0) {
    return { ok: false, issues: schemaIssues };
  }

  return { ok: true, request };
};

/**
 * Full-fidelity normalized weekly card. Transport shape is adapted to
 * camelCase; MEANING is preserved: the weekly horizon (`scoringMode`), the
 * generation clock, the canonical trust tags, replacement points, and the
 * contract identity all survive normalization. `confidence`/`volatility`/
 * `fragility` are deprecated aliases of the canonical tags kept so existing
 * Fantasy consumers do not break.
 */
export interface ScoringWeeklyPlayerCardV1 {
  contract: string;
  contractVersion: string;
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  season: number;
  week: number;
  scoringProfile: string;
  expectedPoints: number;
  replacementPoints: number;
  vorp: number;
  floor: number;
  median: number;
  ceiling: number;
  confidenceBand: string;
  volatilityTag: string;
  fragilityTag: string;
  weeklyOutlook: string;
  roleSummary: string;
  valueSummary: string;
  roleNotes: string[];
  scoringComponents: {
    expectedPoints: number;
    replacementPoints: number;
    vorp: number;
    floor: number;
    median: number;
    ceiling: number;
  };
  generatedAt: string;
  scoringMode: 'weekly';
  viewType: 'player_card';
  /**
   * Contract warnings from the response envelope (e.g. STALE_SOURCE_WINDOW),
   * preserved with their structured details so a degraded/stale-but-available
   * card stays distinguishable from an ordinary one — never silently dropped.
   */
  warnings: ScoringContractWarning[];
  /** @deprecated alias of confidenceBand */
  confidence: string;
  /** @deprecated alias of volatilityTag */
  volatility: string;
  /** @deprecated alias of fragilityTag */
  fragility: string;
}

export type NormalizeWeeklyPlayerCardV1Result =
  | { ok: true; card: ScoringWeeklyPlayerCardV1 }
  | {
      ok: false;
      /**
       * Distinct terminal states, never collapsed:
       * - `unavailable`: well-formed v1 failure envelope declaring the card
       *   unavailable/stale — a real answer meaning "no data"; must never be
       *   rendered as zero points.
       * - `rejected`: well-formed v1 failure envelope rejecting the request.
       * - `invalid_payload`: the response is not an honest v1 document (schema
       *   violation, horizon mislabel, or exchange mismatch with the request).
       */
      kind: 'unavailable' | 'rejected' | 'invalid_payload';
      message: string;
      /** Envelope warnings when the failure envelope was schema-valid (e.g. STALE_SOURCE_WINDOW). */
      warnings: ScoringContractWarning[];
      /** Structured envelope errors (with details) when the failure envelope was schema-valid. */
      errors: ScoringContractIssue[];
    };

interface ManifestExchangeRule {
  success_card_must_echo: { from_request_player: string[]; from_request: string[] };
}

const exchangeRule = (vendoredManifest as { exchange_rule: ManifestExchangeRule }).exchange_rule;

export const normalizeWeeklyPlayerCardV1Response = (
  sentRequest: Record<string, unknown>,
  payload: unknown,
): NormalizeWeeklyPlayerCardV1Result => {
  const schemaIssues = validateJsonSchemaSubset(payload, responseSchema as JsonSchemaSubset);
  if (schemaIssues.length > 0) {
    return {
      ok: false,
      kind: 'invalid_payload',
      message: `Scoring service response is not a valid ${FANTASY_FORECAST_WEEKLY_PLAYER_CARD_RESPONSE_CONTRACT} v1 document: ${schemaIssues.join(' | ')}`,
      warnings: [],
      errors: [],
    };
  }

  const envelope = payload as Record<string, unknown>;
  const envelopeWarnings: ScoringContractWarning[] = (
    (envelope.warnings as Array<{ code: string; message: string; details?: unknown }>) ?? []
  ).map((warning) => ({
    code: warning.code,
    message: warning.message,
    // The vendored schema explicitly permits structured details on warnings
    // (source windows, provenance); preserve them rather than flattening the
    // warning to code+message.
    ...(warning.details !== undefined ? { details: warning.details } : {}),
  }));

  if (envelope.ok !== true) {
    // Errors, like warnings, keep their schema-permitted structured details.
    const envelopeErrors: ScoringContractIssue[] = (
      (envelope.errors as Array<{ code: string; message: string; details?: unknown }>) ?? []
    ).map((error) => ({
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    }));
    const message = [
      envelopeErrors.map((error) => `${error.code}: ${error.message}`).join(' | '),
      envelopeWarnings.length > 0 ? `(warnings: ${envelopeWarnings.map((warning) => warning.code).join(', ')})` : '',
    ]
      .filter(Boolean)
      .join(' ');
    const unavailable = envelopeErrors.some((error) => error.code === 'WEEKLY_PLAYER_CARD_UNAVAILABLE');
    return {
      ok: false,
      kind: unavailable ? 'unavailable' : 'rejected',
      message,
      warnings: envelopeWarnings,
      errors: envelopeErrors,
    };
  }

  const card = (envelope.data as { card: Record<string, unknown> }).card;

  // Exchange rule, read from the vendored manifest: the card must be the
  // answer to THIS request, not merely a well-formed card for someone else.
  const requestPlayer = (sentRequest.players as Array<Record<string, unknown>>)[0];
  const exchangeIssues: string[] = [];
  for (const field of exchangeRule.success_card_must_echo.from_request_player) {
    if (card[field] !== requestPlayer[field]) {
      exchangeIssues.push(`card ${field} (${JSON.stringify(card[field])}) does not echo the requested player.`);
    }
  }
  for (const field of exchangeRule.success_card_must_echo.from_request) {
    if (card[field] !== sentRequest[field]) {
      exchangeIssues.push(`card ${field} (${JSON.stringify(card[field])}) does not echo the request.`);
    }
  }
  if (exchangeIssues.length > 0) {
    return {
      ok: false,
      kind: 'invalid_payload',
      message: `Exchange violation: ${exchangeIssues.join(' ')}`,
      warnings: envelopeWarnings,
      errors: [],
    };
  }

  const components = card.scoring_components as Record<string, number>;

  return {
    ok: true,
    card: {
      contract: card.contract as string,
      contractVersion: card.contract_version as string,
      playerId: card.player_id as string,
      playerName: card.player_name as string,
      team: card.team as string,
      position: card.position as string,
      season: card.season as number,
      week: card.week as number,
      scoringProfile: card.scoring_profile as string,
      expectedPoints: card.expected_points as number,
      replacementPoints: card.replacement_points as number,
      vorp: card.vorp as number,
      floor: card.floor as number,
      median: card.median as number,
      ceiling: card.ceiling as number,
      confidenceBand: card.confidence_band as string,
      volatilityTag: card.volatility_tag as string,
      fragilityTag: card.fragility_tag as string,
      weeklyOutlook: card.weekly_outlook as string,
      roleSummary: card.role_summary as string,
      valueSummary: card.value_summary as string,
      roleNotes: (card.role_notes as string[]) ?? [],
      scoringComponents: {
        expectedPoints: components.expected_points,
        replacementPoints: components.replacement_points,
        vorp: components.vorp,
        floor: components.floor,
        median: components.median,
        ceiling: components.ceiling,
      },
      generatedAt: card.generated_at as string,
      scoringMode: card.scoring_mode as 'weekly',
      viewType: card.view_type as 'player_card',
      warnings: envelopeWarnings,
      confidence: card.confidence_band as string,
      volatility: card.volatility_tag as string,
      fragility: card.fragility_tag as string,
    },
  };
};
