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

type ModelSignalStatus = 'ready' | 'unavailable' | 'inspection only';

type ModelSignalCard = {
  title: string;
  status: ModelSignalStatus;
  statusLabel: string;
  explanation: string;
  href: string;
  linkLabel: string;
  provenance: string;
  details?: string[];
};

const DEFAULT_USER_ID = 'default_user';
const positionGroups = ['QB', 'RB', 'WR', 'TE'] as const;

function displayLeagueName(league?: League | null) {
  return league?.leagueName ?? league?.league_name ?? 'Unknown league';
}

function displayTeamName(team?: LeagueTeam | null) {
  return team?.displayName ?? team?.display_name ?? 'Unknown team';
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
      const response = await fetch('/api/league-sync/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: DEFAULT_USER_ID, league_id_external: sleeperLeagueId.trim() }),
      });
      const data = await response.json().catch(() => ({})) as { success?: boolean; error?: string; requestId?: string };
      if (!response.ok || data.success === false) {
        const msg = data.error || `Request failed (HTTP ${response.status})`;
        throw Object.assign(new Error(msg), { requestId: data.requestId });
      }
      return data;
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
    ? ['Team environment movement data could not be reached in this deployment.']
    : getTeamEnvironmentMovementReadinessDetails(teamstateQuery.data);

  const modelSignals: ModelSignalCard[] = [
    {
      title: 'Teamstate Movement',
      status: teamstateReady ? 'ready' : 'unavailable',
      statusLabel: teamstateReady ? 'Ready' : 'Not connected',
      explanation: teamstateQuery.isLoading
        ? 'Checking team environment movement data…'
        : teamstateReady
          ? 'Shows whether player team environments are improving, declining, or at risk. Useful context before making roster moves.'
          : 'Team environment data is not available in this deployment.',
      href: '/tiber-data-lab/team-research',
      linkLabel: 'Open Team Research',
      provenance: 'Read-only team environment inspection. Does not affect scoring or roster analysis.',
      details: teamstateDetails,
    },
    {
      title: 'Role & Opportunity',
      status: 'ready',
      statusLabel: 'Research surface ready',
      explanation: "Helps explain how a player's usage and deployment is changing week to week. Useful before positional decisions.",
      href: '/tiber-data-lab/role-opportunity',
      linkLabel: 'Open Role Lab',
      provenance: 'Read-only research surface. Inspect before making positional decisions.',
    },
    {
      title: 'FORGE',
      status: hasDashboardTotals ? 'ready' : 'unavailable',
      statusLabel: hasDashboardTotals ? 'Roster context available' : 'Connect team first',
      explanation: hasDashboardTotals
        ? 'FORGE roster totals are available for your league. Inspect positional alpha scores and compare players.'
        : 'Sync a league and set an active team to unlock FORGE roster context.',
      href: '/forge',
      linkLabel: 'Open FORGE',
      provenance: 'Rankings and scoring are unchanged. Inspection only.',
    },
    {
      title: 'Rookies',
      status: 'inspection only',
      statusLabel: 'Inspection only',
      explanation: 'Browse the Rookie Board for prospect context. Useful when evaluating trade targets or dynasty adds.',
      href: '/rookies',
      linkLabel: 'Open Rookie Board',
      provenance: 'Read-only promoted board. Research context, not roster advice.',
    },
    {
      title: 'Point Scenarios',
      status: 'ready',
      statusLabel: 'Research surface ready',
      explanation: 'Explore what-if scoring outcomes for specific players or situations.',
      href: '/tiber-data-lab/point-scenarios',
      linkLabel: 'Open Scenarios',
      provenance: 'Read-only scenario inspection. No projections are recalculated here.',
    },
  ];

  const actionSteps = activeTeam
    ? [
        'Review roster snapshot',
        'Check your weakest position group',
        'Inspect team environment risks',
        'Review role & opportunity context',
        'Open research command center',
      ]
    : [
        'Enter your Sleeper league ID',
        'Sync your league',
        'Select a league',
        'Select your team',
        'Set active team',
        'Explore research surfaces',
      ];

  return (
    <div className="tmd-page">
      <section className="tmd-hero">
        <div>
          <div className="tmd-eyebrow">TIBER Management Dashboard</div>
          <h1>Connect your team, inspect signals, then research your next move.</h1>
          <p>
            Your roster management cockpit. Sync a Sleeper league to unlock roster-specific context,
            then use research surfaces to understand what your roster needs.
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
              <p>Sync a Sleeper league, then choose which team TIBER should inspect.</p>
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
              Sync failed: {(syncMutation.error as Error)?.message || 'Confirm your Sleeper league ID and try again.'}
              <span className="tmd-empty-sub">Check that this is a Sleeper league ID, not a user ID or invite URL.</span>
            </div>
          )}
          {syncMutation.isSuccess && (
            <div className="tmd-callout tmd-callout-ok">League synced. Select your team below to set the active context.</div>
          )}

          <div className="tmd-selector-grid">
            <label>
              Saved leagues
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
              <span className="tmd-selector-hint">Previously synced leagues remain available even if a new sync fails.</span>
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
              Connect a Sleeper league to unlock roster-specific context.
              <span className="tmd-empty-sub">Research surfaces are available now without a roster connection.</span>
            </div>
          )}
        </article>

        <article className="tmd-card">
          <div className="tmd-card-header">
            <div>
              <h2>Active Context</h2>
              <p>Current league and team selection.</p>
            </div>
            <span className={`tmd-status ${activeTeam ? 'tmd-status-ready' : 'tmd-status-unavailable'}`}>
              {activeTeam ? 'Connected' : 'Not connected'}
            </span>
          </div>

          {contextQuery.isLoading ? (
            <div className="tmd-empty-state">Loading…</div>
          ) : activeLeague && activeTeam ? (
            <div className="tmd-context-list">
              <div><span>League</span><strong>{displayLeagueName(activeLeague)}</strong></div>
              <div><span>Team</span><strong>{displayTeamName(activeTeam)}</strong></div>
              <div><span>Format</span><strong>{activeLeague.scoringFormat ?? activeLeague.scoring_format ?? 'Unknown'}</strong></div>
              <div><span>Season</span><strong>{activeLeague.season ?? 'Unknown'}</strong></div>
            </div>
          ) : (
            <div className="tmd-empty-state">
              Connect a team above to see your active context here.
            </div>
          )}
        </article>
      </section>

      <section className="tmd-grid tmd-grid-two">
        <article className="tmd-card">
          <div className="tmd-card-header">
            <div>
              <h2>Roster Snapshot</h2>
              <p>Position group readiness for QB / RB / WR / TE.</p>
            </div>
            <span className={`tmd-status ${hasRosterData ? 'tmd-status-ready' : 'tmd-status-unavailable'}`}>
              {hasRosterData ? 'Ready' : 'Needs synced roster'}
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
              Roster snapshot appears after team sync.
            </div>
          )}
        </article>

        <article className="tmd-card">
          <div className="tmd-card-header">
            <div>
              <h2>TIBER Diagnosis</h2>
              <p>High-level roster framing to guide your next research step.</p>
            </div>
            <span className={`tmd-status ${hasRosterData ? 'tmd-status-not-wired' : 'tmd-status-unavailable'}`}>
              {hasRosterData ? 'Under inspection' : 'Connect team first'}
            </span>
          </div>

          <div className="tmd-diagnosis-band">
            <span>Team state</span>
            <strong>{hasRosterData ? 'Under inspection' : 'Connect team first'}</strong>
          </div>
          <div className="tmd-diagnosis-list">
            <div>
              <h3>Roster strengths</h3>
              <p>
                {hasRosterData
                  ? 'Inspect FORGE totals and research surfaces to identify your positional strengths.'
                  : 'Available after roster sync.'}
              </p>
            </div>
            <div>
              <h3>Roster weaknesses</h3>
              <p>
                {hasRosterData
                  ? 'Start with the lowest-confidence position group in FORGE, then use Player Research for deeper context.'
                  : 'Available after roster sync.'}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="tmd-card">
        <div className="tmd-card-header">
          <div>
            <h2>Model Signals</h2>
            <p>What each research surface can tell you about your roster.</p>
          </div>
          <ShieldCheck size={20} />
        </div>
        <div className="tmd-signal-grid">
          {modelSignals.map((signal) => (
            <article className="tmd-signal-card" key={signal.title}>
              <div className="tmd-signal-topline">
                <h3>{signal.title}</h3>
                <span className={`tmd-status ${statusClass(signal.status)}`}>
                  {statusIcon(signal.status)}{signal.statusLabel}
                </span>
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
              <p>{activeTeam ? 'What to do next with your connected team.' : 'Steps to get started.'}</p>
            </div>
          </div>
          <ol className="tmd-action-list">
            {actionSteps.map((step, index) => (
              <li key={step}><span>{index + 1}</span>{step}</li>
            ))}
          </ol>
        </article>

        <article className="tmd-card">
          <div className="tmd-card-header">
            <div>
              <h2>Research Surfaces</h2>
              <p>Jump to any research surface — no active roster required.</p>
            </div>
          </div>
          <div className="tmd-link-grid">
            <Link href="/tiber-data-lab/command-center">Command Center</Link>
            <Link href="/tiber-data-lab/player-research">Player Research</Link>
            <Link href="/tiber-data-lab/team-research">Team Research</Link>
            <Link href="/tiber-data-lab/role-opportunity">Role & Opportunity</Link>
            <Link href="/forge">FORGE</Link>
            <Link href="/forge-workbench">FORGE Workbench</Link>
            <Link href="/tiber-data-lab/team-research">Team Environment</Link>
          </div>
        </article>
      </section>
    </div>
  );
}
