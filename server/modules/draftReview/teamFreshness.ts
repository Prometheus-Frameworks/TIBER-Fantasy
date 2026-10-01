import type { TeamFreshness } from '../../../shared/teamFreshness';
import { historicalEvidenceFor } from './historicalEvidence';

/** Only an allowlisted platform-reported SHA is disclosed; no env dump, Git, DB or network. */
export function teamFreshness(): TeamFreshness {
  const configured = process.env.RAILWAY_GIT_COMMIT_SHA;
  const revision = typeof configured === 'string' && /^[a-f0-9]{40}$/.test(configured) ? configured : null;
  const history = historicalEvidenceFor([]);
  return {
    schema_version: 'tiber_team_freshness_v1',
    server_build: { revision, revision_basis: revision ? 'railway_reported_commit' : 'unknown', built_at: null, deployed_at: null },
    historical_evidence: {
      status: history.status,
      window: history.status === 'available' ? { season: history.window.season, week_start: history.window.week_start, week_end: history.window.week_end } : null,
      source_acquired_at: null, source_updated_at: null, last_successful_refresh_at: null,
    },
    weekly_evidence: { status: 'unavailable' },
  };
}
