import { RookieArtifact, RookieIntegrationError, TiberRookieBoard, TiberRookieRow } from './types';

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getPathValue(record: Record<string, unknown>, key: string): unknown {
  if (!key.includes('.')) return record[key];
  return key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, record);
}

function pickString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = getPathValue(record, key);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function pickNumber(record: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = getPathValue(record, key);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function normalizeRow(row: unknown): Record<string, unknown> {
  const record = toRecord(row);
  return {
    ...record,
    name: pickString(record, ['name', 'player_name', 'playerName']) ?? '',
    pos: pickString(record, ['pos', 'position']) ?? '',
    school: pickString(record, ['school', 'college']),
    tiber_rookie_alpha: pickNumber(record, [
      'tiber_rookie_alpha',
      'rookie_alpha',
      'rookieAlpha',
      'rookie_grade',
      'scores.rookie_alpha',
      'scores.rookieAlpha',
      'score.rookie_alpha',
      'score.rookieAlpha',
      'score.alpha',
      'composite.rookie_alpha',
      'composite.rookieAlpha',
    ]),
    tiber_ras: pickNumber(record, ['tiber_ras', 'tiber_ras_v1', 'ras']),
    tiber_ras_v2: pickNumber(record, ['tiber_ras_v2']),
    proj_round: pickNumber(record, ['proj_round', 'projected_round', 'projection_round']),
    production_score: pickNumber(record, [
      'production_score',
      'productionScore',
      'component_scores.production_score',
      'componentScores.productionScore',
      'scores.components.production_score',
      'scores.components.productionScore',
    ]),
    dominator_rating: pickNumber(record, ['dominator_rating', 'dominatorRating']),
    college_target_share: pickNumber(record, ['college_target_share', 'target_share']),
    college_ypc: pickNumber(record, ['college_ypc', 'ypc']),
    draft_capital_score: pickNumber(record, [
      'draft_capital_score',
      'draftCapitalScore',
      'component_scores.draft_capital_score',
      'componentScores.draftCapitalScore',
      'scores.components.draft_capital_score',
      'scores.components.draftCapitalScore',
    ]),
    athleticism_score: pickNumber(record, [
      'athleticism_score',
      'athleticismScore',
      'component_scores.athleticism_score',
      'componentScores.athleticismScore',
      'scores.components.athleticism_score',
      'scores.components.athleticismScore',
    ]),
    ht: pickNumber(record, ['ht', 'height_inches']),
    wt: pickNumber(record, ['wt', 'weight_lbs']),
    forty: pickNumber(record, ['forty', 'forty_yard_dash']),
    ten: pickNumber(record, ['ten', 'ten_yard_split']),
    vert: pickNumber(record, ['vert', 'vertical_jump']),
    broad: pickNumber(record, ['broad', 'broad_jump']),
    cone: pickNumber(record, ['cone', 'three_cone']),
    shuttle: pickNumber(record, ['shuttle', 'short_shuttle']),
    profile_summary: pickString(record, ['profile_summary', 'summary']),
    identity_note: pickString(record, ['identity_note', 'player_identity_note']),
    board_summary: pickString(record, ['board_summary']),
    rookie_tier: pickString(record, [
      'rookie_tier',
      'rookieTier',
      'tier',
      'scores.rookie_tier',
      'scores.rookieTier',
      'score.tier',
      'composite.tier',
    ]),
    player_id: pickString(record, ['player_id', 'playerId', 'gsis_id']),
    rookie_rank: pickNumber(record, [
      'rookie_rank',
      'rookieRank',
      'rank',
      'class_rank',
      'classRank',
      'scores.rank',
      'score.rank',
      'composite.rank',
    ]),
  };
}

function normalizeArtifact(payload: unknown): RookieArtifact {
  const root = toRecord(payload);
  const rows = Array.isArray(root.players)
    ? root.players
    : Array.isArray(root.rows)
      ? root.rows
      : Array.isArray(root.data)
        ? root.data
        : Array.isArray(toRecord(root.board).players)
          ? (toRecord(root.board).players as unknown[])
          : Array.isArray(root.rookies)
            ? root.rookies
        : [];

  const meta = toRecord(root.meta);
  const season = pickNumber(meta, ['season']) ?? pickNumber(root, ['season']) ?? null;
  const normalized = {
    meta: {
      ...meta,
      season,
      model_name: pickString(meta, ['model_name', 'model']) ?? pickString(root, ['model_name', 'model']) ?? 'TIBER-Rookies promoted board',
      model_version: pickString(meta, ['model_version', 'version']),
      promoted_at: pickString(meta, ['promoted_at']),
      generated_at: pickString(meta, ['generated_at', 'scraped_at']),
    },
    players: rows.map((row) => normalizeRow(row)),
  };

  const hasSeason = typeof normalized.meta.season === 'number' && Number.isInteger(normalized.meta.season);
  const hasRows = Array.isArray(normalized.players) && normalized.players.length > 0;
  const hasRequiredIdentity = normalized.players.every((row) => typeof row.name === 'string' && row.name.length > 0 && typeof row.pos === 'string' && row.pos.length > 0);

  if (!hasSeason || !hasRows || !hasRequiredIdentity) {
    throw new RookieIntegrationError('invalid_payload', 'Promoted rookie artifact contract is invalid (season/meta/rows/name/position required).', 502);
  }

  return normalized as RookieArtifact;
}

function round(value: number | null, decimals = 2): number | null {
  if (value == null) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function mapRow(row: RookieArtifact['players'][number]): TiberRookieRow {
  return {
    rank: 0,
    player_id: row.player_id ?? null,
    player_name: row.name,
    position: row.pos.toUpperCase(),
    school: row.school ?? null,
    proj_round: row.proj_round ?? null,
    rookie_rank: row.rookie_rank ?? null,
    rookie_alpha: round(row.tiber_rookie_alpha ?? null, 0),
    rookie_tier: row.rookie_tier ?? null,
    tiber_ras_v1: round(row.tiber_ras ?? null, 2),
    tiber_ras_v2: round(row.tiber_ras_v2 ?? null, 2),
    production_score: round(row.production_score ?? null, 1),
    dominator_rating: round(row.dominator_rating ?? null, 1),
    college_target_share: round(row.college_target_share ?? null, 1),
    college_ypc: round(row.college_ypc ?? null, 2),
    draft_capital_score: round(row.draft_capital_score ?? null, 0),
    athleticism_score: round(row.athleticism_score ?? null, 0),
    height_inches: row.ht ?? null,
    weight_lbs: row.wt ?? null,
    forty_yard_dash: round(row.forty ?? null, 2),
    ten_yard_split: round(row.ten ?? null, 2),
    vertical_jump: round(row.vert ?? null, 1),
    broad_jump: round(row.broad ?? null, 0),
    three_cone: round(row.cone ?? null, 2),
    short_shuttle: round(row.shuttle ?? null, 2),
    profile_summary: row.profile_summary ?? null,
    identity_note: row.identity_note ?? null,
    board_summary: row.board_summary ?? null,
  };
}

export function mapRookieArtifactToFantasySurface(payload: unknown, sourcePath: string): TiberRookieBoard {
  const artifact = normalizeArtifact(payload);
  if (artifact.meta.season == null) {
    throw new RookieIntegrationError('invalid_payload', 'Promoted rookie artifact is missing meta.season.', 502);
  }
  const players = artifact.players.map((row) => mapRow(row));

  return {
    season: artifact.meta.season,
    count: players.length,
    model: {
      name: artifact.meta.model_name ?? 'TIBER-Rookies promoted board',
      version: artifact.meta.model_version ?? null,
      promotedAt: artifact.meta.promoted_at ?? null,
      generatedAt: artifact.meta.generated_at ?? null,
      sourcePath,
    },
    players,
  };
}
