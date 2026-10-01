/** Presentation metadata only. No evidence admission or source refresh. */
export type TeamFreshness = {
  schema_version: 'tiber_team_freshness_v1';
  server_build: { revision: string | null; revision_basis: 'railway_reported_commit' | 'unknown'; built_at: null; deployed_at: null };
  historical_evidence: {
    status: 'available' | 'unavailable';
    window: { season: number; week_start: number; week_end: number } | null;
    source_acquired_at: null; source_updated_at: null; last_successful_refresh_at: null;
  };
  weekly_evidence: { status: 'unavailable' };
};

export function isTeamFreshness(value: unknown): value is TeamFreshness {
  if (!value || typeof value !== 'object') return false;
  const v = value as TeamFreshness;
  const b = v.server_build;
  const h = v.historical_evidence;
  if (v.schema_version !== 'tiber_team_freshness_v1' || !b || !h) return false;
  const validBuild = (b.revision === null && b.revision_basis === 'unknown')
    || (typeof b.revision === 'string' && /^[a-f0-9]{40}$/.test(b.revision) && b.revision_basis === 'railway_reported_commit');
  const w = h.window;
  const validHistory = (h.status === 'unavailable' && w === null)
    || (h.status === 'available' && !!w && Number.isInteger(w.season) && w.season >= 1900 && w.season <= 2200
      && Number.isInteger(w.week_start) && Number.isInteger(w.week_end)
      && w.week_start >= 1 && w.week_end <= 18 && w.week_start <= w.week_end);
  return validBuild && validHistory && b.built_at === null && b.deployed_at === null
    && h.source_acquired_at === null && h.source_updated_at === null && h.last_successful_refresh_at === null
    && v.weekly_evidence?.status === 'unavailable';
}
