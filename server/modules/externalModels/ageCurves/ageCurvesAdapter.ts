import { ZodError } from 'zod';
import {
  AgeCurveIntegrationError,
  CanonicalAgeCurveLabResponse,
  CanonicalAgeCurveLabRow,
  TiberAgeCurveLab,
  TiberAgeCurveLabRow,
  canonicalAgeCurveLabResponseSchema,
} from './types';

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
      return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map((entry) => entry.trim());
    }
    if (typeof value === 'string' && value.trim()) {
      return value.split(',').map((entry) => entry.trim()).filter(Boolean);
    }
  }

  return [];
}

function roundMetric(value: number | null): number | null {
  if (value == null) {
    return null;
  }

  return Math.round(value * 1000) / 1000;
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

function buildProvenance(record: Record<string, unknown>, sourceRecord: Record<string, unknown>) {
  const provenanceRecord = toRecord(record.provenance);
  return {
    provider:
      pickString(provenanceRecord, ['provider']) ?? pickString(sourceRecord, ['provider']) ?? pickString(record, ['provider']) ?? null,
    source_name:
      pickString(provenanceRecord, ['source_name', 'sourceName'])
      ?? pickString(record, ['source_name', 'sourceName'])
      ?? null,
    source_type:
      pickString(provenanceRecord, ['source_type', 'sourceType'])
      ?? pickString(record, ['source_type', 'sourceType'])
      ?? null,
    model_version:
      pickString(provenanceRecord, ['model_version', 'modelVersion'])
      ?? pickString(record, ['model_version', 'modelVersion'])
      ?? null,
    generated_at:
      pickString(provenanceRecord, ['generated_at', 'generatedAt'])
      ?? pickString(record, ['generated_at', 'generatedAt'])
      ?? null,
    notes:
      pickStringArray(provenanceRecord, ['notes'])
      .concat(pickStringArray(record, ['provenance_notes', 'notes']))
      .filter((value, index, values) => values.indexOf(value) === index),
  };
}

function toCanonicalLabRow(row: unknown, sourceRecord: Record<string, unknown>): CanonicalAgeCurveLabRow {
  const record = toRecord(row);

  return {
    player_id: pickString(record, ['player_id', 'playerId', 'gsis_id']),
    player_name: pickString(record, ['player_name', 'playerName', 'name', 'full_name']) ?? '',
    team: pickString(record, ['team', 'team_abbr', 'team_id']),
    position: pickString(record, ['position', 'pos']),
    season: pickNumber(record, ['season']),
    age: pickNumber(record, ['age']),
    career_year: pickNumber(record, ['career_year', 'careerYear', 'experience_year', 'years_pro']) ?? null,
    peer_bucket: pickString(record, ['peer_bucket', 'peerBucket', 'cohort_key', 'cohort', 'cohort_bucket']),
    expected_ppg: pickNumber(record, ['expected_ppg', 'expectedPpg', 'expected_fantasy_ppg', 'expected_points_per_game']),
    actual_ppg: pickNumber(record, ['actual_ppg', 'actualPpg', 'actual_fantasy_ppg', 'fantasy_ppg']),
    ppg_delta: pickNumber(record, ['ppg_delta', 'ppgDelta', 'delta', 'expected_actual_delta']),
    trajectory_label: pickString(record, ['trajectory_label', 'trajectoryLabel', 'trajectory', 'development_label']),
    age_curve_score: pickNumber(record, ['age_curve_score', 'ageCurveScore', 'arc_score', 'summary_score']),
    provenance: buildProvenance(record, sourceRecord),
    raw_fields: record,
  };
}

function toCanonicalLabResponse(payload: unknown): CanonicalAgeCurveLabResponse {
  const record = toRecord(payload);
  const dataRecord = toRecord(record.data);
  const metaRecord = toRecord(record.meta);
  const sourceRecord = toRecord(record.source);

  const availableSeasonCandidates = [record.available_seasons, record.availableSeasons, dataRecord.available_seasons, dataRecord.availableSeasons];
  const availableSeasons = (availableSeasonCandidates.find(Array.isArray) as unknown[] | undefined) ?? [];
  const normalizedAvailableSeasons = availableSeasons
    .map((entry) => (typeof entry === 'number' ? entry : Number(entry)))
    .filter((entry) => Number.isFinite(entry)) as number[];

  return {
    season: pickNumber(record, ['season']) ?? pickNumber(dataRecord, ['season']) ?? null,
    available_seasons: normalizedAvailableSeasons,
    rows: pickRows(record).map((row) => toCanonicalLabRow(row, sourceRecord)),
    source: {
      provider: pickString(sourceRecord, ['provider']) ?? pickString(metaRecord, ['provider']) ?? 'age-curve-upstream',
      location: pickString(sourceRecord, ['location']) ?? null,
      mode: pickString(sourceRecord, ['mode']) === 'api' ? 'api' : 'artifact',
    },
  };
}

export function parseCanonicalAgeCurveLabResponse(payload: unknown): CanonicalAgeCurveLabResponse {
  try {
    return canonicalAgeCurveLabResponseSchema.parse(toCanonicalLabResponse(payload));
  } catch (error) {
    throw new AgeCurveIntegrationError(
      'invalid_payload',
      'Age Curve Lab upstream payload does not match the expected contract.',
      502,
      error instanceof ZodError ? error.flatten() : error,
    );
  }
}

function adaptAgeCurveLabRow(
  row: CanonicalAgeCurveLabRow,
  options: { includeRawCanonical?: boolean },
): TiberAgeCurveLabRow {
  const derivedDelta = roundMetric(row.ppg_delta ?? (row.actual_ppg != null && row.expected_ppg != null ? row.actual_ppg - row.expected_ppg : null));

  return {
    playerId: row.player_id ?? null,
    playerName: row.player_name,
    team: row.team ?? null,
    position: row.position ?? null,
    season: row.season ?? null,
    age: row.age ?? null,
    careerYear: row.career_year ?? null,
    peerBucket: row.peer_bucket ?? null,
    expectedPpg: roundMetric(row.expected_ppg ?? null),
    actualPpg: roundMetric(row.actual_ppg ?? null),
    ppgDelta: derivedDelta,
    trajectoryLabel: row.trajectory_label ?? null,
    ageCurveScore: roundMetric(row.age_curve_score ?? null),
    provenance: {
      provider: row.provenance.provider ?? null,
      sourceName: row.provenance.source_name ?? null,
      sourceType: row.provenance.source_type ?? null,
      modelVersion: row.provenance.model_version ?? null,
      generatedAt: row.provenance.generated_at ?? null,
      notes: row.provenance.notes,
    },
    rawFields: row.raw_fields,
    ...(options.includeRawCanonical ? { rawCanonical: row } : {}),
  };
}

export function adaptAgeCurveLab(
  payload: unknown,
  options: { includeRawCanonical?: boolean } = {},
): TiberAgeCurveLab {
  const canonical = parseCanonicalAgeCurveLabResponse(payload);
  const rows = canonical.rows.map((row) => adaptAgeCurveLabRow(row, options));

  return {
    season: canonical.season ?? (rows[0]?.season ?? null),
    availableSeasons: canonical.available_seasons.length
      ? canonical.available_seasons
      : Array.from(new Set(rows.map((row) => row.season).filter((season): season is number => season != null))).sort((a, b) => b - a),
    rows: rows.sort((left, right) => {
      const seasonDelta = (right.season ?? -1) - (left.season ?? -1);
      if (seasonDelta !== 0) return seasonDelta;
      const scoreDelta = (right.ageCurveScore ?? Number.NEGATIVE_INFINITY) - (left.ageCurveScore ?? Number.NEGATIVE_INFINITY);
      if (scoreDelta !== 0) return scoreDelta;
      const ppgDelta = (right.ppgDelta ?? Number.NEGATIVE_INFINITY) - (left.ppgDelta ?? Number.NEGATIVE_INFINITY);
      if (ppgDelta !== 0) return ppgDelta;
      return left.playerName.localeCompare(right.playerName);
    }),
    source: canonical.source,
  };
}
