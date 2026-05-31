import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { AlertCircle, ArrowRight, CheckCircle2, CircleDashed, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import {
  type TeamEnvironmentMovementResponse,
  getTeamEnvironmentMovementReadinessDetails,
  hasUsableTeamEnvironmentMovementContext,
} from '@/lib/teamEnvironmentMovement';

type LeagueTeam = {
  id: string;
  leagueId?: string;
  league_id?: string;
  displayName?: string;
  display_name?: string;
  externalRosterId?: string | null;
  external_roster_id?: string | null;
};

type League = {
  id: string;
  leagueName?: string;
  league_name?: string;
  platform?: string;
  scoringFormat?: string | null;
  scoring_format?: string | null;
  season?: number | null;
  teams?: LeagueTeam[];
};

type LeagueContextResponse = {
  success: boolean;
  error?: string;
  activeLeague?: League | null;
  activeTeam?: LeagueTeam | null;
  suggestedTeamId?: string | null;
  suggested_team_id?: string | null;
};

type LeagueSyncListResponse = {
  success: boolean;
  error?: string;
  leagues?: League[];
};

type LeagueDashboardTeam = {
  team_id: string;
  display_name: string;
  totals?: Partial<Record<'QB' | 'RB' | 'WR' | 'TE', number>>;
  roster?: Array<{ pos?: string | null; position?: string | null; alpha?: number | null }>;
};

type LeagueDashboardResponse = {
  success: boolean;
  error?: string;
  teams?: LeagueDashboardTeam[];
};

type ModelSignalStatus = 'ready' | 'unavailable' | 'not wired';

type ModelSignalCard = {
  title: string;
  status: ModelSignalStatus;
  explanation: string;
  href: string;
  linkLabel: string;
  provenance: string;
  details?: string[];
};

const DEFAULT_USER_ID = 'default_user';
const positionGroups = ['QB', 'RB', 'WR', 'TE'] as const;

function displayLeagueName(league?: League | null) {
  return league?.leagueName ?? league?.league_name ?? 'League unavailable';
}

function displayTeamName(team?: LeagueTeam | null) {
  return team?.displayName ?? team?.display_name ?? 'Team unavailable';
}

function getLeagueIdForTeam(team?: LeagueTeam | null) {
  return team?.leagueId ?? team?.league_id ?? null;
}

function statusClass(status: ModelSignalStatus) {
  if (status === 'ready') return 'tmd-status-ready';
  if (status === 'unavailable') return 'tmd-status-unavailable';
  return 'tmd-status-not-wired';
}

function statusIcon(status: ModelSignalStatus) {
  if (status === 'ready') return <CheckCircle2 size={15} />;
  if (status === 'unavailable') return <AlertCircle size={15} />;
  return <CircleDashed size={15} />;
}

function ExternalOrInternalLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  if (href.startsWith('http')) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function buildRosterCounts(team?: LeagueDashboardTeam | null) {
  const counts: Record<(typeof positionGroups)[number], { players: number; modelReady: number; total: number | null }> = {
    QB: { players: 0, modelReady: 0, total: null },
    RB: { players: 0, modelReady: 0, total: null },
    WR: { players: 0, modelReady: 0, total: null },
    TE: { players: 0, modelReady: 0, total: null },
  };

  for (const position of positionGroups) {
    const total = team?.totals?.[position];
    counts[position].total = typeof total === 'number' ? total : null;
  }

  for (const player of team?.roster ?? []) {
    const position = String(player.pos ?? player.position ?? '').toUpperCase();
    if (position === 'QB' || position === 'RB' || position === 'WR' || position === 'TE') {
      counts[position].players += 1;
      if (typeof player.alpha === 'number') counts[position].modelReady += 1;
    }
  }

  return counts;
}

export default function TiberManagementDashboard() {
  const queryClient = useQueryClient();
  const [sleeperLeagueId, setSleeperLeagueId] = useState('');
  const [selectedLeagueId, setSelectedLeagueId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const contextQuery = useQuery<LeagueContextResponse>({
    queryKey: [`/api/league-context?user_id=${DEFAULT_USER_ID}`],
  });

  const leaguesQuery = useQuery<LeagueSyncListResponse>({
    queryKey: [`/api/league-sync/leagues?user_id=${DEFAULT_USER_ID}`],
  });

  const teamstateQuery = useQuery<TeamEnvironmentMovementResponse, Error>({
    queryKey: ['/api/data-lab/team-environment-movement'],
    queryFn: async () => {
      const response = await fetch('/api/data-lab/team-environment-movement');
      return response.json() as Promise<TeamEnvironmentMovementResponse>;
    },
    retry: false,
  });

  const activeLeague = contextQuery.data?.activeLeague ?? null;
  const activeTeam = contextQuery.data?.activeTeam ?? null;
  const activeLeagueId = activeLeague?.id ?? getLeagueIdForTeam(activeTeam);

  const dashboardQuery = useQuery<LeagueDashboardResponse>({
    queryKey: [`/api/league-dashboard?user_id=${DEFAULT_USER_ID}&league_id=${activeLeagueId ?? ''}`],
    enabled: Boolean(activeLeagueId),
  });

  const activeDashboardTeam = useMemo(() => {
    if (!activeTeam?.id || !dashboardQuery.data?.teams?.length) return null;
    return dashboardQuery.data.teams.find((team) => team.team_id === activeTeam.id) ?? null;
  }, [activeTeam?.id, dashboardQuery.data?.teams]);

  const rosterCounts = useMemo(() => buildRosterCounts(activeDashboardTeam), [activeDashboardTeam]);
  const hasRosterData = Boolean(activeDashboardTeam?.roster?.length);
  const hasDashboardTotals = Boolean(activeDashboardTeam?.totals);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/league-sync/sync', {
        user_id: DEFAULT_USER_ID,
        league_id_external: sleeperLeagueId.trim(),
      });
      return response.json();
    },
    onSuccess: async () => {
      setSleeperLeagueId('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/league-context?user_id=${DEFAULT_USER_ID}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/league-sync/leagues?user_id=${DEFAULT_USER_ID}`] }),
      ]);
    },
  });

  const setContextMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/league-context', {
        user_id: DEFAULT_USER_ID,
        league_id: selectedLeagueId,
        team_id: selectedTeamId,
      });
      return response.json();
    },
    onSuccess: async () => {
      setSelectedLeagueId('');
      setSelectedTeamId('');
      await queryClient.invalidateQueries({ queryKey: [`/api/league-context?user_id=${DEFAULT_USER_ID}`] });
    },
  });

  const selectableTeams = useMemo(() => {
    const league = leaguesQuery.data?.leagues?.find((item) => item.id === selectedLeagueId);
    return league?.teams ?? [];
  }, [leaguesQuery.data?.leagues, selectedLeagueId]);

  const teamstateReady = hasUsableTeamEnvironmentMovementContext(teamstateQuery.data);
  const teamstateDetails = teamstateQuery.isError
    ? ['Teamstate endpoint could not be reached. No movement context was fabricated.']
    : getTeamEnvironmentMovementReadinessDetails(teamstateQuery.data);

  const modelSignals: ModelSignalCard[] = [
    {
      title: 'Teamstate Movement',
      status: teamstateReady ? 'ready' : 'unavailable',
      explanation: teamstateQuery.isLoading
        ? 'Checking the read-only Teamstate movement artifact before reporting availability.'
        : teamstateReady
          ? 'Read-only team environment movement is available for context inspection. It is not used for scoring or roster advice here.'
          : 'Read-only team environment movement is unavailable. No Teamstate context is used for scoring, diagnosis, or roster advice.',
      href: '/tiber-data-lab/team-research',
      linkLabel: 'Open Team Research',
      provenance: 'Reads /api/data-lab/team-environment-movement as visibility-only context; the team-specific /:teamAbbr endpoint remains available for follow-up inspection.',
      details: teamstateDetails,
    },
    {
      title: 'Role & Opportunity',
      status: 'ready',
      explanation: 'Promoted role/deployment context can help explain how players are being used before you make roster decisions.',
      href: '/tiber-data-lab/role-opportunity',
      linkLabel: 'Open Role Lab',
      provenance: 'Read-only Data Lab adapter; TIBER-Fantasy does not recompute upstream model logic.',
    },
    {
      title: 'FORGE',
      status: hasDashboardTotals ? 'ready' : 'unavailable',
      explanation: hasDashboardTotals
        ? 'League dashboard totals are available for roster inspection, but this shell does not turn them into final advice.'
        : 'FORGE roster totals need an active synced league and available model rows before diagnosis can be trusted.',
      href: '/forge',
      linkLabel: 'Open FORGE',
      provenance: 'Existing FORGE surfaces remain separate; no ranking, grading, or scoring changes were added.',
    },
    {
      title: 'Rookies / Player Ownership',
      status: 'not wired',
      explanation: 'Rookie Board is available as research, but roster-specific ownership synthesis is not wired into this shell yet.',
      href: '/rookies',
      linkLabel: 'Open Rookie Board',
      provenance: 'Read-only promoted/board surfaces; ownership remains research context, not a generated transaction recommendation.',
    },
    {
      title: 'Point Scenarios',
      status: 'ready',
      explanation: 'Scenario context can be inspected for what-if outcomes after you identify a player or weak position group.',
      href: '/tiber-data-lab/point-scenarios',
      linkLabel: 'Open Scenarios',
      provenance: 'Read-only scenario adapter; this dashboard does not author or recalculate projections.',
    },
  ];

  const diagnosisState = !activeTeam
    ? 'needs active team'
    : !hasRosterData
      ? 'needs model data'
      : 'uncertain';

  return (
    <div className="tiber-content tmd-page">
      <section className="tmd-hero">
        <div>
          <div className="tmd-eyebrow">TIBER Management Dashboard</div>
          <h1>Start here: sync your team, inspect context, then research the next move.</h1>
          <p>
            This is the first roster-management shell for TIBER-Fantasy. It connects existing sync, context, FORGE,
            and Data Lab surfaces without creating new fantasy advice or model contracts.
          </p>
        </div>
        <Link href="/tiber-data-lab/command-center" className="tmd-hero-link">
          Research Command Center <ArrowRight size={16} />
        </Link>
      </section>

      <section className="tmd-grid tmd-grid-two">
        <article className="tmd-card">
          <div className="tmd-card-header">
            <div>
              <h2>Connect your fantasy team</h2>
              <p>Sync a Sleeper league, then choose the league/team context TIBER should inspect.</p>
            </div>
            <span className="tmd-pill">Sleeper beta</span>
          </div>

          <div className="tmd-form-row">
            <input
              value={sleeperLeagueId}
              onChange={(event) => setSleeperLeagueId(event.target.value)}
              placeholder="Sleeper league ID"
              aria-label="Sleeper league ID"
            />
            <button
              type="button"
              onClick={() => syncMutation.mutate()}
              disabled={!sleeperLeagueId.trim() || syncMutation.isPending}
            >
              {syncMutation.isPending ? <Loader2 size={15} className="tmd-spin" /> : null}
              Sync team
            </button>
          </div>

          {syncMutation.isError && (
            <div className="tmd-callout tmd-callout-warn">
              Existing league-sync route rejected the sync. Confirm the Sleeper league ID and try again.
            </div>
          )}
          {syncMutation.isSuccess && (
            <div className="tmd-callout tmd-callout-ok">League sync completed. Pick an active team if it was not selected automatically.</div>
          )}

          <div className="tmd-selector-grid">
            <label>
              Synced league
              <select
                value={selectedLeagueId}
                onChange={(event) => {
                  setSelectedLeagueId(event.target.value);
                  setSelectedTeamId('');
                }}
              >
                <option value="">Select a league</option>
                {(leaguesQuery.data?.leagues ?? []).map((league) => (
                  <option key={league.id} value={league.id}>{displayLeagueName(league)}</option>
                ))}
              </select>
            </label>
            <label>
              Team
              <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} disabled={!selectedLeagueId}>
                <option value="">Select a team</option>
                {selectableTeams.map((team) => (
                  <option key={team.id} value={team.id}>{displayTeamName(team)}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="tmd-secondary-button"
            disabled={!selectedLeagueId || !selectedTeamId || setContextMutation.isPending}
            onClick={() => setContextMutation.mutate()}
          >
            {setContextMutation.isPending ? <Loader2 size={15} className="tmd-spin" /> : null}
            Set active team
          </button>

          {!activeTeam && (
            <div className="tmd-empty-state">
              No active team context is available yet. Use the existing /api/league-sync/sync and /api/league-context flow above,
              or continue into research surfaces without roster-specific diagnosis.
            </div>
          )}
        </article>

        <article className="tmd-card">
          <div className="tmd-card-header">
            <div>
              <h2>Active Context</h2>
              <p>The dashboard only shows synced context returned by existing league context APIs.</p>
            </div>
            <span className={`tmd-status ${activeTeam ? 'tmd-status-ready' : 'tmd-status-unavailable'}`}>
              {activeTeam ? 'ready' : 'unavailable'}
            </span>
          </div>

          {contextQuery.isLoading ? (
            <div className="tmd-empty-state">Loading active league context…</div>
          ) : activeLeague && activeTeam ? (
            <div className="tmd-context-list">
              <div><span>League</span><strong>{displayLeagueName(activeLeague)}</strong></div>
              <div><span>Team</span><strong>{displayTeamName(activeTeam)}</strong></div>
              <div><span>Format</span><strong>{activeLeague.scoringFormat ?? activeLeague.scoring_format ?? 'Unknown'}</strong></div>
              <div><span>Season</span><strong>{activeLeague.season ?? 'Unknown'}</strong></div>
            </div>
          ) : (
            <div className="tmd-empty-state">
              Active league/team is unavailable. TIBER will not invent a roster, team name, readiness state, or diagnosis.
            </div>
          )}
        </article>
      </section>

      <section className="tmd-grid tmd-grid-two">
        <article className="tmd-card">
          <div className="tmd-card-header">
            <div>
              <h2>Roster Snapshot</h2>
              <p>Position group readiness for QB/RB/WR/TE.</p>
            </div>
            <span className={`tmd-status ${hasRosterData ? 'tmd-status-ready' : 'tmd-status-unavailable'}`}>
              {hasRosterData ? 'ready' : 'unavailable'}
            </span>
          </div>

          <div className="tmd-position-grid">
            {positionGroups.map((position) => {
              const count = rosterCounts[position];
              return (
                <div className="tmd-position-card" key={position}>
                  <span>{position}</span>
                  <strong>{hasRosterData ? count.players : '—'}</strong>
                  <small>
                    {hasRosterData
                      ? `${count.modelReady} with model rows${count.total !== null ? ` · total ${count.total.toFixed(1)}` : ''}`
                      : 'Awaiting synced roster'}
                  </small>
                </div>
              );
            })}
          </div>

          {!hasRosterData && (
            <div className="tmd-empty-state">
              Roster details are not loaded. This section is placeholder-ready and will use existing league-dashboard data when available.
            </div>
          )}
        </article>

        <article className="tmd-card">
          <div className="tmd-card-header">
            <div>
              <h2>TIBER Diagnosis</h2>
              <p>High-level management framing, not final transaction advice.</p>
            </div>
            <span className={`tmd-status ${hasRosterData ? 'tmd-status-not-wired' : 'tmd-status-unavailable'}`}>
              {diagnosisState}
            </span>
          </div>

          <div className="tmd-diagnosis-band">
            <span>Team state</span>
            <strong>{hasRosterData ? 'Uncertain' : 'Needs model data'}</strong>
          </div>
          <div className="tmd-diagnosis-list">
            <div>
              <h3>Roster strengths</h3>
              <p>{hasRosterData ? 'Strength synthesis is not wired yet; inspect FORGE totals and research surfaces below.' : 'Unavailable until an active roster has model-backed data.'}</p>
            </div>
            <div>
              <h3>Roster weaknesses</h3>
              <p>{hasRosterData ? 'Weakness synthesis is not wired yet; start with the lowest-confidence position group.' : 'Unavailable until roster gap analysis is connected.'}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="tmd-card">
        <div className="tmd-card-header">
          <div>
            <h2>Model Signals</h2>
            <p>Readiness map for model context that can support management decisions later.</p>
          </div>
          <ShieldCheck size={20} />
        </div>
        <div className="tmd-signal-grid">
          {modelSignals.map((signal) => (
            <article className="tmd-signal-card" key={signal.title}>
              <div className="tmd-signal-topline">
                <h3>{signal.title}</h3>
                <span className={`tmd-status ${statusClass(signal.status)}`}>{statusIcon(signal.status)}{signal.status}</span>
              </div>
              <p>{signal.explanation}</p>
              <div className="tmd-provenance">{signal.provenance}</div>
              {signal.details?.length ? (
                <ul className="tmd-signal-details">
                  {signal.details.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
              ) : null}
              <ExternalOrInternalLink href={signal.href} className="tmd-deep-link">
                {signal.linkLabel} <ExternalLink size={13} />
              </ExternalOrInternalLink>
            </article>
          ))}
        </div>
      </section>

      <section className="tmd-grid tmd-grid-two">
        <article className="tmd-card">
          <div className="tmd-card-header">
            <div>
              <h2>Action Queue</h2>
              <p>What to do after opening TIBER.</p>
            </div>
          </div>
          <ol className="tmd-action-list">
            <li><span>1</span> Sync team</li>
            <li><span>2</span> Review roster diagnosis</li>
            <li><span>3</span> Inspect weak position group</li>
            <li><span>4</span> Review team environment risks</li>
            <li><span>5</span> Open research command center</li>
          </ol>
        </article>

        <article className="tmd-card">
          <div className="tmd-card-header">
            <div>
              <h2>Deep Links</h2>
              <p>Jump to the live surfaces this shell points toward.</p>
            </div>
          </div>
          <div className="tmd-link-grid">
            <Link href="/tiber-data-lab/command-center">Command Center</Link>
            <Link href="/tiber-data-lab/player-research">Player Research</Link>
            <Link href="/tiber-data-lab/team-research">Team Research</Link>
            <Link href="/tiber-data-lab/role-opportunity">Role & Opportunity</Link>
            <Link href="/forge">FORGE</Link>
            <Link href="/forge-workbench">FORGE Workbench</Link>
            <Link href="/tiber-data-lab/team-research">Teamstate movement <span>endpoint-only context</span></Link>
          </div>
        </article>
      </section>
    </div>
  );
}
