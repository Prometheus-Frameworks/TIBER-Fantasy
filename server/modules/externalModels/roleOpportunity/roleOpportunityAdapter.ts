import { ZodError } from 'zod';
import {
  CanonicalRoleOpportunityLabResponse,
  CanonicalRoleOpportunityLabRow,
  CanonicalRoleOpportunityResponse,
  RoleOpportunityIntegrationError,
  TiberRoleOpportunityInsight,
  TiberRoleOpportunityLab,
  TiberRoleOpportunityLabRow,
  canonicalRoleOpportunityLabResponseSchema,
  roleOpportunityResponseSchema,
} from './types';

function normalizeShare(value: number | null | undefined): number | null {
  if (value == null) {
    return null;
  }

  return value > 1 ? value / 100 : value;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function pickString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function pickNumber(record: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function pickStringArray(record: Record<string, unknown>, keys: readonly string[]): string[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0);
    }

    if (typeof value === 'string' && value.trim()) {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }
  }

  return [];
}

function pickInsights(record: Record<string, unknown>): string[] {
  return pickStringArray(record, ['insights', 'usage_insights', 'notes']);
}

function pickRows(payload: Record<string, unknown>): unknown[] {
  const directCandidates = [payload.rows, payload.data, payload.items, payload.results];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    const nested = payload.data as Record<string, unknown>;
    if (Array.isArray(nested.rows)) return nested.rows;
    if (Array.isArray(nested.items)) return nested.items;
    if (Array.isArray(nested.results)) return nested.results;
  }

  return [];
}

function toCanonicalLabRow(row: unknown): CanonicalRoleOpportunityLabRow {
  const record = toRecord(row);
  const metrics = toRecord(record.metrics);
  const source = toRecord(record.source);

  return {
    player_id: pickString(record, ['player_id', 'playerId', 'gsis_id']) ?? '',
    player_name: pickString(record, ['player_name', 'playerName', 'name', 'full_name']) ?? '',
    team: pickString(record, ['team', 'team_id', 'team_abbr']) ?? '',
    position: pickString(record, ['position']) ?? '',
    season: pickNumber(record, ['season']) ?? Number.NaN,
    week: pickNumber(record, ['week']) ?? null,
    season_scope_marker: pickString(record, ['season_scope_marker', 'seasonScopeMarker', 'scope', 'window']),
    primary_role: pickString(record, ['primary_role', 'primaryRole']) ?? '',
    role_tags: pickStringArray(record, ['role_tags', 'roleTags', 'tags']),
    route_participation: pickNumber(record, ['route_participation', 'routeParticipation']) ?? pickNumber(metrics, ['route_participation', 'routeParticipation', 'route_share', 'routeShare']),
    target_share: pickNumber(record, ['target_share', 'targetShare']) ?? pickNumber(metrics, ['target_share', 'targetShare']),
    air_yard_share: pickNumber(record, ['air_yard_share', 'airYardShare', 'air_yards_share']) ?? pickNumber(metrics, ['air_yard_share', 'airYardShare', 'air_yards_share']),
    snap_share: pickNumber(record, ['snap_share', 'snapShare']) ?? pickNumber(metrics, ['snap_share', 'snapShare']),
    usage_rate: pickNumber(record, ['usage_rate', 'usageRate']) ?? pickNumber(metrics, ['usage_rate', 'usageRate']),
    confidence_score: pickNumber(record, ['confidence_score', 'confidenceScore']) ?? null,
    confidence_tier: pickString(record, ['confidence_tier', 'confidenceTier']),
    source_name: pickString(record, ['source_name', 'sourceName']) ?? pickString(source, ['provider', 'source_name', 'sourceName']),
    source_type: pickString(record, ['source_type', 'sourceType']) ?? pickString(source, ['type', 'mode', 'source_type', 'sourceType']),
    model_version: pickString(record, ['model_version', 'modelVersion']) ?? pickString(source, ['model_version', 'modelVersion']),
    generated_at: pickString(record, ['generated_at', 'generatedAt']) ?? pickString(source, ['generated_at', 'generatedAt']),
    insights: pickInsights(record),
    raw_fields: record,
  };
}

function toCanonicalLabResponse(payload: unknown): CanonicalRoleOpportunityLabResponse {
  const record = toRecord(payload);
  const dataRecord = toRecord(record.data);
  const metaRecord = toRecord(record.meta);

  const rows = pickRows(record).map(toCanonicalLabRow);
  const availableSeasonCandidates = [record.available_seasons, record.availableSeasons, dataRecord.available_seasons, dataRecord.availableSeasons];
  const availableSeasons = availableSeasonCandidates.find(Array.isArray) as unknown[] | undefined;
  const normalizedAvailableSeasons = (availableSeasons ?? [])
    .map((entry) => (typeof entry === 'number' ? entry : Number(entry)))
    .filter((entry) => Number.isFinite(entry)) as number[];

  const sourceRecord = toRecord(record.source);

  return {
    season: pickNumber(record, ['season']) ?? pickNumber(dataRecord, ['season']) ?? null,
    week: pickNumber(record, ['week']) ?? pickNumber(dataRecord, ['week']) ?? null,
    season_scope_marker: pickString(record, ['season_scope_marker', 'seasonScopeMarker'])
      ?? pickString(dataRecord, ['season_scope_marker', 'seasonScopeMarker'])
      ?? pickString(metaRecord, ['season_scope_marker', 'seasonScopeMarker'])
      ?? null,
    available_seasons: normalizedAvailableSeasons,
    rows,
    source: {
      provider: pickString(sourceRecord, ['provider']) ?? pickString(metaRecord, ['provider']) ?? 'role-opportunity-upstream',
      location: pickString(sourceRecord, ['location']) ?? null,
      mode: pickString(sourceRecord, ['mode']) === 'api' ? 'api' : 'artifact',
    },
  };
}

export function parseCanonicalRoleOpportunityResponse(payload: unknown): CanonicalRoleOpportunityResponse {
  try {
    return roleOpportunityResponseSchema.parse(payload);
  } catch (error) {
    throw new RoleOpportunityIntegrationError(
      'invalid_payload',
      'Role-and-opportunity-model returned a payload that does not match the canonical contract.',
      502,
      error instanceof ZodError ? error.flatten() : error,
    );
  }
}

export function parseCanonicalRoleOpportunityLabResponse(payload: unknown): CanonicalRoleOpportunityLabResponse {
  try {
    return canonicalRoleOpportunityLabResponseSchema.parse(toCanonicalLabResponse(payload));
  } catch (error) {
    throw new RoleOpportunityIntegrationError(
      'invalid_payload',
      'Role Opportunity Lab upstream payload does not match the expected contract.',
      502,
      error instanceof ZodError ? error.flatten() : error,
    );
  }
}

export function adaptRoleOpportunityInsight(
  payload: unknown,
  options: { includeRawCanonical?: boolean } = {},
): TiberRoleOpportunityInsight {
  const canonical = parseCanonicalRoleOpportunityResponse(payload);

  return {
    playerId: canonical.player_id,
    season: canonical.season,
    week: canonical.week,
    position: canonical.position,
    team: canonical.team,
    primaryRole: canonical.primary_role,
    roleTags: canonical.role_tags,
    usage: {
      snapShare: normalizeShare(canonical.metrics.snap_share) ?? 0,
      routeShare: normalizeShare(canonical.metrics.route_share) ?? 0,
      targetShare: normalizeShare(canonical.metrics.target_share) ?? 0,
      usageRate: normalizeShare(canonical.metrics.usage_rate) ?? 0,
    },
    opportunity: {
      tier: canonical.opportunity_tier,
      weightedOpportunityIndex: canonical.metrics.weighted_opportunity_index,
      insights: canonical.insights,
    },
    confidence: canonical.confidence_score,
    source: {
      provider: 'role-and-opportunity-model',
      modelVersion: canonical.model_version,
      generatedAt: canonical.generated_at,
    },
    ...(options.includeRawCanonical ? { rawCanonical: canonical } : {}),
  };
}

function adaptRoleOpportunityLabRow(
  row: CanonicalRoleOpportunityLabRow,
  options: { includeRawCanonical?: boolean },
): TiberRoleOpportunityLabRow {
  return {
    playerId: row.player_id,
    playerName: row.player_name,
    team: row.team,
    position: row.position,
    season: row.season,
    week: row.week ?? null,
    seasonScopeMarker: row.season_scope_marker ?? null,
    primaryRole: row.primary_role,
    roleTags: row.role_tags,
    usage: {
      routeParticipation: normalizeShare(row.route_participation),
      targetShare: normalizeShare(row.target_share),
      airYardShare: normalizeShare(row.air_yard_share),
      snapShare: normalizeShare(row.snap_share),
      usageRate: normalizeShare(row.usage_rate),
    },
    confidence: {
      score: row.confidence_score ?? null,
      tier: row.confidence_tier ?? null,
    },
    source: {
      sourceName: row.source_name ?? null,
      sourceType: row.source_type ?? null,
      modelVersion: row.model_version ?? null,
      generatedAt: row.generated_at ?? null,
    },
    insights: row.insights,
    rawFields: row.raw_fields,
    ...(options.includeRawCanonical ? { rawCanonical: row } : {}),
  };
}

export function adaptRoleOpportunityLab(
  payload: unknown,
  options: { includeRawCanonical?: boolean } = {},
): TiberRoleOpportunityLab {
  const canonical = parseCanonicalRoleOpportunityLabResponse(payload);
  const rows = canonical.rows.map((row) => adaptRoleOpportunityLabRow(row, options));

  return {
    season: canonical.season ?? (rows[0]?.season ?? null),
    week: canonical.week ?? (rows[0]?.week ?? null),
    seasonScopeMarker: canonical.season_scope_marker ?? (rows[0]?.seasonScopeMarker ?? null),
    availableSeasons: canonical.available_seasons.length
      ? canonical.available_seasons
      : Array.from(new Set(rows.map((row) => row.season))).sort((left, right) => right - left),
    rows: rows.sort((left, right) => {
      const seasonDelta = right.season - left.season;
      if (seasonDelta !== 0) return seasonDelta;
      const weekDelta = (right.week ?? -1) - (left.week ?? -1);
      if (weekDelta !== 0) return weekDelta;
      const confidenceDelta = (right.confidence.score ?? Number.NEGATIVE_INFINITY) - (left.confidence.score ?? Number.NEGATIVE_INFINITY);
      if (confidenceDelta !== 0) return confidenceDelta;
      return left.playerName.localeCompare(right.playerName);
    }),
    source: canonical.source,
  };
}
