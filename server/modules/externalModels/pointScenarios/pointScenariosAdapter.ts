import { ZodError } from 'zod';
import {
  CanonicalPointScenarioLabResponse,
  CanonicalPointScenarioLabRow,
  PointScenarioIntegrationError,
  TiberPointScenarioLab,
  TiberPointScenarioLabRow,
  canonicalPointScenarioLabResponseSchema,
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
      return value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0);
    }
    if (typeof value === 'string' && value.trim()) {
      return value
        .split(/\n|\|/)
        .flatMap((entry) => entry.split(','))
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }

  return [];
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

function roundMetric(value: number | null): number | null {
  if (value == null) {
    return null;
  }

  return Math.round(value * 1000) / 1000;
}

function buildNotes(record: Record<string, unknown>): string[] {
  const explanation = pickString(record, ['explanation', 'explanation_text', 'reasoning', 'notes_text']);
  const notes = pickStringArray(record, ['notes', 'explanation_points', 'bullets']);

  if (explanation && !notes.includes(explanation)) {
    return [explanation, ...notes];
  }

  return notes;
}

function buildProvenance(record: Record<string, unknown>, sourceRecord: Record<string, unknown>) {
  const provenanceRecord = toRecord(record.provenance);
  const provenanceMetadata = toRecord(provenanceRecord.source_metadata);
  const rowMetadata = toRecord(record.source_metadata);
  const metadata = Object.keys(provenanceMetadata).length ? provenanceMetadata : rowMetadata;

  return {
    provider:
      pickString(provenanceRecord, ['provider'])
      ?? pickString(sourceRecord, ['provider'])
      ?? pickString(record, ['provider'])
      ?? null,
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
    source_metadata: metadata,
  };
}

function toCanonicalLabRow(row: unknown, sourceRecord: Record<string, unknown>): CanonicalPointScenarioLabRow {
  const record = toRecord(row);
  const provenance = buildProvenance(record, sourceRecord);

  return {
    scenario_id: pickString(record, ['scenario_id', 'scenarioId', 'id']),
    scenario_name: pickString(record, ['scenario_name', 'scenarioName', 'scenario', 'name', 'scenario_label']) ?? '',
    player_id: pickString(record, ['player_id', 'playerId', 'gsis_id']),
    player_name: pickString(record, ['player_name', 'playerName', 'name', 'full_name']) ?? '',
    team: pickString(record, ['team', 'team_abbr', 'team_id']),
    position: pickString(record, ['position', 'pos']),
    season: pickNumber(record, ['season']),
    week: pickNumber(record, ['week']),
    baseline_projection: pickNumber(record, [
      'baseline_projection',
      'baselineProjection',
      'baseline_points',
      'baselinePoints',
      'base_projection',
      'baseProjection',
    ]),
    adjusted_projection: pickNumber(record, [
      'adjusted_projection',
      'adjustedProjection',
      'scenario_projection',
      'scenarioProjection',
      'projected_points',
      'projectedPoints',
    ]),
    delta: pickNumber(record, ['delta', 'projection_delta', 'projectionDelta', 'adjustment']),
    confidence_band: pickString(record, ['confidence_band', 'confidenceBand']),
    confidence_label: pickString(record, ['confidence_label', 'confidenceLabel', 'confidence']),
    scenario_type: pickString(record, ['scenario_type', 'scenarioType', 'scenario_category', 'scenarioCategory']),
    event_type: pickString(record, ['event_type', 'eventType', 'event', 'trigger_type', 'triggerType']),
    notes: buildNotes(record),
    explanation: pickString(record, ['explanation', 'explanation_text', 'reasoning', 'notes_text']),
    provenance,
    raw_fields: record,
  };
}

function toCanonicalLabResponse(payload: unknown): CanonicalPointScenarioLabResponse {
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
      provider: pickString(sourceRecord, ['provider']) ?? pickString(metaRecord, ['provider']) ?? 'point-prediction-model',
      location: pickString(sourceRecord, ['location']) ?? null,
      mode: pickString(sourceRecord, ['mode']) === 'api' ? 'api' : 'artifact',
    },
  };
}

export function parseCanonicalPointScenarioLabResponse(payload: unknown): CanonicalPointScenarioLabResponse {
  try {
    return canonicalPointScenarioLabResponseSchema.parse(toCanonicalLabResponse(payload));
  } catch (error) {
    throw new PointScenarioIntegrationError(
      'invalid_payload',
      'Point Scenario Lab upstream payload does not match the expected contract.',
      502,
      error instanceof ZodError ? error.flatten() : error,
    );
  }
}

function adaptPointScenarioLabRow(
  row: CanonicalPointScenarioLabRow,
  options: { includeRawCanonical?: boolean },
): TiberPointScenarioLabRow {
  const derivedDelta = roundMetric(
    row.delta ?? (row.adjusted_projection != null && row.baseline_projection != null ? row.adjusted_projection - row.baseline_projection : null),
  );

  return {
    scenarioId: row.scenario_id ?? null,
    scenarioName: row.scenario_name,
    playerId: row.player_id ?? null,
    playerName: row.player_name,
    team: row.team ?? null,
    position: row.position ?? null,
    season: row.season ?? null,
    week: row.week ?? null,
    baselineProjection: roundMetric(row.baseline_projection ?? null),
    adjustedProjection: roundMetric(row.adjusted_projection ?? null),
    delta: derivedDelta,
    confidence: {
      band: row.confidence_band ?? null,
      label: row.confidence_label ?? null,
    },
    scenarioType: row.scenario_type ?? null,
    eventType: row.event_type ?? null,
    notes: row.notes,
    explanation: row.explanation ?? null,
    provenance: {
      provider: row.provenance.provider ?? null,
      sourceName: row.provenance.source_name ?? null,
      sourceType: row.provenance.source_type ?? null,
      modelVersion: row.provenance.model_version ?? null,
      generatedAt: row.provenance.generated_at ?? null,
      sourceMetadata: row.provenance.source_metadata,
    },
    rawFields: row.raw_fields,
    ...(options.includeRawCanonical ? { rawCanonical: row } : {}),
  };
}

export function adaptPointScenarioLab(
  payload: unknown,
  options: { includeRawCanonical?: boolean } = {},
): TiberPointScenarioLab {
  const canonical = parseCanonicalPointScenarioLabResponse(payload);
  const rows = canonical.rows.map((row) => adaptPointScenarioLabRow(row, options));

  return {
    season: canonical.season ?? (rows[0]?.season ?? null),
    availableSeasons: canonical.available_seasons.length
      ? canonical.available_seasons
      : Array.from(new Set(rows.map((row) => row.season).filter((season): season is number => season != null))).sort((a, b) => b - a),
    rows: rows.sort((left, right) => {
      const seasonDelta = (right.season ?? -1) - (left.season ?? -1);
      if (seasonDelta !== 0) return seasonDelta;
      const deltaDiff = (right.delta ?? Number.NEGATIVE_INFINITY) - (left.delta ?? Number.NEGATIVE_INFINITY);
      if (deltaDiff !== 0) return deltaDiff;
      const adjustedDiff = (right.adjustedProjection ?? Number.NEGATIVE_INFINITY) - (left.adjustedProjection ?? Number.NEGATIVE_INFINITY);
      if (adjustedDiff !== 0) return adjustedDiff;
      return left.playerName.localeCompare(right.playerName);
    }),
    source: canonical.source,
  };
}
