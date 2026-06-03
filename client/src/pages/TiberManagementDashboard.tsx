import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { AlertCircle, ArrowRight, CheckCircle2, CircleDashed, ExternalLink, Loader2, ShieldCheck, TrendingUp, TrendingDown, RefreshCw, HelpCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import {
  type TeamEnvironmentMovementResponse,
  buildTeamEnvironmentMovementSummary,
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

type RookieAssetContext = {
  source: 'rookie_alpha_promoted_artifact';
  playerName: string;
  position: string;
  alphaRank: number | null;
  positionRank: string | null;
  rookieAlphaScore: number | null;
  talentScore: number | null;
  consensusDelta: number | null;
  interpretation: string;
};

type RosterPlayer = {
  rosterKey?: string;
  canonicalId?: string | null;
  sleeperId?: string | null;
  name?: string | null;
  pos?: string | null;
  position?: string | null;
  nflTeam?: string | null;
  alpha?: number | null;
  tier?: number | null;
  missingReason?: string | null;
  visibilityState?: 'forge_scored' | 'rookie_alpha_fallback' | 'known_unscored' | 'unresolved';
  unavailableReason?: string | null;
  usedAsStarter?: boolean;
  rookieAsset?: RookieAssetContext | null;
};

type LeagueDashboardTeam = {
  team_id: string;
  display_name: string;
  totals?: Partial<Record<'QB' | 'RB' | 'WR' | 'TE', number>>;
  overall_total?: number;
  roster?: RosterPlayer[];
};

type LeagueDashboardResponse = {
  success: boolean;
  error?: string;
  teams?: LeagueDashboardTeam[];
  diagnostics?: {
    rosterCount?: number;
    resolvedCanonicalCount?: number;
    unresolvedSleeperCount?: number;
    stillMissingCount?: number;
    rookieAlphaMatchedCount?: number;
    forgeScoredCount?: number;
    rookieAlphaFallbackCount?: number;
    knownUnscoredCount?: number;
    unresolvedCount?: number;
    evidenceCoveredCount?: number;
    rosterVisibility?: RosterCoverageCounts;
  };
};

type LeaguePick = {
  id?: string;
  season: number;
  round: number;
  originalRosterId?: string | null;
  currentRosterId?: string | null;
  source?: string;
};

type PicksResponse = {
  success: boolean;
  available?: boolean;
  picks?: LeaguePick[];
  error?: string;
};

type RosterCoverageCounts = {
  total: number;
  forgeScored: number;
  rookieAlphaFallback: number;
  knownUnscored: number;
  unresolved: number;
  evidenceCovered: number;
};

type TeamDirectionCoverage = { matched: number; total: number; rate: number; forgeMatched?: number; rookieAlphaMatched?: number };
type TeamDirectionCoverageSummary = Pick<TeamDirectionCoverage, 'matched' | 'total' | 'rate'>;
type TeamDirectionEvidenceCoverage = TeamDirectionCoverageSummary & { rookieAlphaMatched?: number };
type TeamDirectionConfidenceInputs = {
  driver?: string;
  forgeCoverage?: TeamDirectionCoverageSummary;
  evidenceCoverage?: TeamDirectionEvidenceCoverage;
  scoredPlayers?: number;
  scoredPositionCounts?: Partial<Record<'QB' | 'RB' | 'WR' | 'TE' | 'Other', number>>;
  missingScoredPositions?: string[];
  minimumForgeCoverageRate?: number;
  highConfidenceForgeCoverageRate?: number;
  highConfidenceScoredPlayers?: number;
  notes?: string[];
};

type TeamDirectionResponse = {
  success: boolean;
  available?: boolean;
  direction?: 'contender' | 'rebuild' | 'retool' | 'uncertain' | null;
  confidence?: 'high' | 'medium' | 'low' | null;
  reasons?: string[];
  blockers?: string[];
  coverage?: TeamDirectionCoverage;
  evidenceCoverage?: TeamDirectionEvidenceCoverage;
  forgeCoverage?: TeamDirectionCoverageSummary;
  visibilityCounts?: RosterCoverageCounts;
  confidenceInputs?: TeamDirectionConfidenceInputs;
  teamName?: string;
  reason?: string;
  error?: string;
};

export type ModelSignalStatus = 'ready' | 'partial' | 'unavailable' | 'not wired' | 'inspection only';

export type ModelSignalCard = {
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
  if (status === 'partial') return 'tmd-status-partial';
  if (status === 'unavailable') return 'tmd-status-unavailable';
  if (status === 'inspection only') return 'tmd-status-inspection';
  return 'tmd-status-not-wired';
}

function statusIcon(status: ModelSignalStatus) {
  if (status === 'ready') return <CheckCircle2 size={15} />;
  if (status === 'unavailable') return <AlertCircle size={15} />;
  return <CircleDashed size={15} />;
}

function ExternalOrInternalLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  if (href.startsWith('#')) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

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

function emptyRosterCoverageCounts(): RosterCoverageCounts {
  return { total: 0, forgeScored: 0, rookieAlphaFallback: 0, knownUnscored: 0, unresolved: 0, evidenceCovered: 0 };
}

function classifyRosterVisibility(player: RosterPlayer): keyof Omit<RosterCoverageCounts, 'total' | 'evidenceCovered'> {
  if (typeof player.alpha === 'number') return 'forgeScored';
  if (player.rookieAsset) return 'rookieAlphaFallback';
  if (player.missingReason === 'unmapped_sleeper_id' || player.visibilityState === 'unresolved') return 'unresolved';
  return 'knownUnscored';
}

function buildRosterVisibilitySummary(roster: RosterPlayer[] = []): RosterCoverageCounts {
  const counts = emptyRosterCoverageCounts();
  counts.total = roster.length;
  for (const player of roster) {
    const state = classifyRosterVisibility(player);
    counts[state] += 1;
  }
  counts.evidenceCovered = counts.forgeScored + counts.rookieAlphaFallback;
  return counts;
}

function buildRosterCounts(team?: LeagueDashboardTeam | null) {
  const counts: Record<(typeof positionGroups)[number], RosterCoverageCounts & { totalAlpha: number | null }> = {
    QB: { ...emptyRosterCoverageCounts(), totalAlpha: null },
    RB: { ...emptyRosterCoverageCounts(), totalAlpha: null },
    WR: { ...emptyRosterCoverageCounts(), totalAlpha: null },
    TE: { ...emptyRosterCoverageCounts(), totalAlpha: null },
  };

  for (const position of positionGroups) {
    const total = team?.totals?.[position];
    counts[position].totalAlpha = typeof total === 'number' ? total : null;
  }

  for (const player of team?.roster ?? []) {
    const position = String(player.pos ?? player.position ?? '').toUpperCase();
    if (position === 'QB' || position === 'RB' || position === 'WR' || position === 'TE') {
      counts[position].total += 1;
      const state = classifyRosterVisibility(player);
      counts[position][state] += 1;
      counts[position].evidenceCovered = counts[position].forgeScored + counts[position].rookieAlphaFallback;
    }
  }

  return counts;
}

function groupRosterByPosition(roster: RosterPlayer[]) {
  const groups: Record<string, RosterPlayer[]> = { QB: [], RB: [], WR: [], TE: [], Other: [] };
  for (const player of roster) {
    const pos = String(player.pos ?? player.position ?? '').toUpperCase();
    if (pos === 'QB' || pos === 'RB' || pos === 'WR' || pos === 'TE') {
      groups[pos].push(player);
    } else {
      groups['Other'].push(player);
    }
  }
  // Sort each group by alpha desc (matched first, then unmatched)
  for (const pos of Object.keys(groups)) {
    groups[pos].sort((a, b) => {
      if (a.alpha !== null && a.alpha !== undefined && b.alpha !== null && b.alpha !== undefined) return b.alpha - a.alpha;
      if (a.alpha !== null && a.alpha !== undefined) return -1;
      if (b.alpha !== null && b.alpha !== undefined) return 1;
      return 0;
    });
  }
  return groups;
}

function missingReasonLabel(reason?: string | null) {
  if (reason === 'identity_unresolved' || reason === 'unmapped_sleeper_id') return 'Identity unresolved';
  if (reason === 'missing_forge_row') return 'Missing FORGE row';
  if (reason === 'rookie_alpha_fallback_unavailable') return 'Missing FORGE row · Rookie Alpha fallback unavailable';
  if (reason === 'alpha_null') return 'Alpha null · Rookie Alpha fallback unavailable';
  return 'Known but unscored';
}

function unscoredReasonLabel(player: RosterPlayer) {
  return missingReasonLabel(player.unavailableReason ?? player.missingReason);
}

function forgeTierLabel(tier?: number | null): string | null {
  if (tier === 1) return 'T1';
  if (tier === 2) return 'T2';
  if (tier === 3) return 'T3';
  if (tier === 4) return 'T4';
  return null;
}

function groupPicksBySeason(picks: LeaguePick[]) {
  const map = new Map<number, LeaguePick[]>();
  for (const pick of picks) {
    if (!map.has(pick.season)) map.set(pick.season, []);
    map.get(pick.season)!.push(pick);
  }
  // Sort within each season by round
  map.forEach((v) => v.sort((a, b) => a.round - b.round));
  return map;
}


function pct(rate?: number | null) {
  return `${Math.round((rate ?? 0) * 100)}%`;
}

function coverageText(label: string, coverage?: TeamDirectionCoverageSummary, extra?: string) {
  if (!coverage) return null;
  return (
    <div>
      <span>{label}</span>
      <strong>{coverage.matched}/{coverage.total} ({pct(coverage.rate)})</strong>
      {extra ? <small>{extra}</small> : null}
    </div>
  );
}


function summarizeTeamState(response: TeamEnvironmentMovementResponse | null | undefined): string | null {
  if (!hasUsableTeamEnvironmentMovementContext(response)) return null;
  if (response?.selectedTeam) return buildTeamEnvironmentMovementSummary(response.selectedTeam);

  const teamCount = response?.teams?.length ?? 0;
  const latestWeek = response?.coverage?.latestWeek;
  const latestWeekText = typeof latestWeek === 'number' ? `latest week ${latestWeek}` : 'latest week unknown';
  return `${teamCount} team${teamCount === 1 ? '' : 's'} with TeamState movement context; ${latestWeekText}.`;
}

export function buildManagementModelSignals({
  hasActiveTeam,
  hasRosterData,
  hasDashboardTotals,
  rosterVisibility,
  teamstateQueryState,
  teamstateResponse,
  teamstateDetails,
}: {
  hasActiveTeam: boolean;
  hasRosterData: boolean;
  hasDashboardTotals: boolean;
  rosterVisibility: RosterCoverageCounts;
  teamstateQueryState: 'loading' | 'error' | 'success';
  teamstateResponse?: TeamEnvironmentMovementResponse | null;
  teamstateDetails: string[];
}): ModelSignalCard[] {
  const forgeCoverageRate = rosterVisibility.total > 0 ? rosterVisibility.forgeScored / rosterVisibility.total : 0;
  const hasForgeAlphaTotals = hasDashboardTotals;
  const hasRookieFallbacks = rosterVisibility.rookieAlphaFallback > 0;
  const teamstateReady = hasUsableTeamEnvironmentMovementContext(teamstateResponse);
  const teamstateSummary = summarizeTeamState(teamstateResponse);

  return [
    {
      title: 'FORGE',
      status: !hasActiveTeam || !hasRosterData ? 'unavailable' : rosterVisibility.forgeScored === rosterVisibility.total ? 'ready' : rosterVisibility.forgeScored > 0 ? 'partial' : 'unavailable',
      statusLabel: !hasActiveTeam
        ? 'Unavailable'
        : !hasRosterData
          ? 'Unavailable'
          : rosterVisibility.forgeScored === rosterVisibility.total
            ? 'Ready'
            : rosterVisibility.forgeScored > 0
              ? 'Partial'
              : 'Unavailable',
      explanation: hasRosterData
        ? `FORGE has scored rows for ${rosterVisibility.forgeScored}/${rosterVisibility.total} roster players (${pct(forgeCoverageRate)}). Alpha totals are ${hasForgeAlphaTotals ? 'available' : 'unavailable'}.`
        : 'Connect an active team with roster rows before inspecting FORGE coverage.',
      href: '#roster-snapshot',
      linkLabel: 'Inspect Roster Snapshot',
      provenance: 'Uses Management roster visibility diagnostics. No scoring semantics changed.',
      details: [
        `FORGE scored coverage: ${rosterVisibility.forgeScored}/${rosterVisibility.total}.`,
        `FORGE alpha totals: ${hasForgeAlphaTotals ? 'available' : 'unavailable'}.`,
        'Team Direction confidence still uses FORGE scoring coverage, not fallback visibility.',
      ],
    },
    {
      title: 'Rookie Alpha',
      status: !hasActiveTeam || !hasRosterData ? 'unavailable' : hasRookieFallbacks ? 'inspection only' : 'unavailable',
      statusLabel: !hasActiveTeam || !hasRosterData ? 'Unavailable' : hasRookieFallbacks ? 'Inspection only' : 'Unavailable',
      explanation: hasRosterData
        ? `${rosterVisibility.rookieAlphaFallback} roster player${rosterVisibility.rookieAlphaFallback === 1 ? '' : 's'} have promoted Rookie Alpha fallback visibility.`
        : 'No active roster visibility diagnostics are available yet.',
      href: '#roster-snapshot',
      linkLabel: 'Inspect fallback rows',
      provenance: 'Evidence/visibility only. Rookie Alpha is never blended into FORGE roster strength, scoring, or rankings.',
      details: [
        `Fallback count: ${rosterVisibility.rookieAlphaFallback}/${rosterVisibility.total}.`,
        `Evidence-covered roster rows: ${rosterVisibility.evidenceCovered}/${rosterVisibility.total}.`,
        'Artifact source: promoted Rookie Alpha fallback context when present on roster rows.',
      ],
    },
    {
      title: 'TeamState',
      status: teamstateQueryState === 'loading' ? 'partial' : teamstateReady ? 'ready' : 'unavailable',
      statusLabel: teamstateQueryState === 'loading' ? 'Partial' : teamstateReady ? 'Ready' : 'Unavailable',
      explanation: teamstateQueryState === 'loading'
        ? 'Checking existing Team Environment Movement data.'
        : teamstateReady
          ? (teamstateSummary ?? 'Team Environment Movement artifact is available for inspection.')
          : 'Management can query Team Environment Movement, but no usable TeamState movement rows are available here.',
      href: '/tiber-data-lab/team-research',
      linkLabel: 'Open Team Research',
      provenance: 'Read-only TeamState movement inspection. Does not affect roster scoring or Team Direction.',
      details: teamstateDetails,
    },
    {
      title: 'ROP / Opportunity',
      status: 'not wired',
      statusLabel: 'Not wired',
      explanation: 'Role/opportunity labs exist, but Management does not currently join active roster players to a role/opportunity readiness feed.',
      href: '/tiber-data-lab/role-opportunity',
      linkLabel: 'Open Role Lab',
      provenance: 'Research surface link only. No active-roster readiness is claimed in Management.',
      details: ['No Management integration is active for roster-level ROP coverage.'],
    },
    {
      title: 'Point Prediction',
      status: 'not wired',
      statusLabel: 'Pending ingestion',
      explanation: 'Point scenario/prediction outputs are not connected to Management roster readiness yet.',
      href: '/tiber-data-lab/point-scenarios',
      linkLabel: 'Open Scenarios',
      provenance: 'Pending ingestion / not wired. No projections are recalculated or implied here.',
      details: ['No active Management integration is present for point prediction coverage.'],
    },
  ];
}

function TeamDirectionInputs({ data }: { data: TeamDirectionResponse }) {
  const evidenceCoverage = data.evidenceCoverage ?? data.coverage;
  const forgeCoverage = data.forgeCoverage ?? data.confidenceInputs?.forgeCoverage;
  const rookieAlphaMatched = evidenceCoverage?.rookieAlphaMatched ?? data.coverage?.rookieAlphaMatched ?? 0;
  const confidenceInputs = data.confidenceInputs;
  const scoredPositionCounts = confidenceInputs?.scoredPositionCounts;
  const positionSummary = scoredPositionCounts
    ? `Scored positions: QB ${scoredPositionCounts.QB ?? 0} · RB ${scoredPositionCounts.RB ?? 0} · WR ${scoredPositionCounts.WR ?? 0} · TE ${scoredPositionCounts.TE ?? 0}`
    : undefined;

  return (
    <div className="tmd-dir-inputs" aria-label="Team Direction confidence inputs">
      {coverageText('FORGE scoring coverage', forgeCoverage, 'Classification confidence uses this scored coverage, not Rookie Alpha fallback.')}
      {coverageText(
        'Evidence coverage',
        evidenceCoverage,
        rookieAlphaMatched > 0 ? `${rookieAlphaMatched} Rookie Alpha fallback match${rookieAlphaMatched === 1 ? '' : 'es'} included for visibility.` : 'Roster context visible through FORGE scoring rows.'
      )}
      <div>
        <span>Direction confidence</span>
        <strong>{data.confidence ? `${data.confidence.charAt(0).toUpperCase()}${data.confidence.slice(1)}` : 'Unknown'}</strong>
        <small>{positionSummary ?? 'Based on FORGE scoring coverage and scored positional data quality.'}</small>
      </div>
      {confidenceInputs?.missingScoredPositions && confidenceInputs.missingScoredPositions.length > 0 && (
        <div className="tmd-dir-inputs-note">
          Missing scored position data: {confidenceInputs.missingScoredPositions.join(', ')}
        </div>
      )}
    </div>
  );
}

function directionMeta(direction?: string | null) {
  if (direction === 'contender') return { label: 'Contender', icon: <TrendingUp size={18} />, cls: 'tmd-dir-contender' };
  if (direction === 'rebuild') return { label: 'Rebuild', icon: <TrendingDown size={18} />, cls: 'tmd-dir-rebuild' };
  if (direction === 'retool') return { label: 'Retool', icon: <RefreshCw size={18} />, cls: 'tmd-dir-retool' };
  return { label: 'Uncertain', icon: <HelpCircle size={18} />, cls: 'tmd-dir-uncertain' };
}

function TeamDirectionCard({
  query,
  activeTeam,
}: {
  query: ReturnType<typeof useQuery<TeamDirectionResponse>>;
  activeTeam?: LeagueTeam | null;
}) {
  const data = query.data;
  const meta = directionMeta(data?.direction);

  return (
    <section className="tmd-card">
      <div className="tmd-card-header">
        <div>
          <h2>Team Direction</h2>
          <p>FORGE-powered read of where your roster is headed, with Rookie Alpha evidence coverage for assets outside FORGE.</p>
        </div>
        {data?.available && data.direction ? (
          <span className={`tmd-dir-badge ${meta.cls}`}>
            {meta.icon}
            {meta.label}
          </span>
        ) : (
          <span className="tmd-status tmd-status-unavailable">
            {query.isLoading ? 'Loading…' : 'Unavailable'}
          </span>
        )}
      </div>

      {!activeTeam ? (
        <div className="tmd-empty-state">
          Connect a team above to unlock Team Direction.
          <span className="tmd-empty-sub">Requires at least 50% FORGE scoring coverage. Rookie Alpha improves visibility but never replaces the scoring gate.</span>
        </div>
      ) : query.isLoading ? (
        <div className="tmd-empty-state"><Loader2 size={15} className="tmd-spin" /> Classifying team direction…</div>
      ) : !data?.available ? (
        <div className="tmd-empty-state">
          {data?.reason ?? 'Team direction is unavailable for this roster.'}
        </div>
      ) : data.direction === 'uncertain' ? (
        <div className="tmd-dir-body">
          <div className="tmd-callout tmd-callout-warn">
            Not enough scoring evidence to classify this roster.
          </div>
          {data.blockers && data.blockers.length > 0 && (
            <div className="tmd-dir-section">
              <div className="tmd-dir-section-label">What's blocking this</div>
              <ul className="tmd-dir-list tmd-dir-list-blockers">
                {data.blockers.map((b) => <li key={b}>{b}</li>)}
              </ul>
            </div>
          )}
          <TeamDirectionInputs data={data} />
        </div>
      ) : (
        <div className="tmd-dir-body">
          <div className={`tmd-dir-hero ${meta.cls}`}>
            {meta.icon}
            <div>
              <div className="tmd-dir-hero-label">{meta.label}</div>
              {data.confidence && (
                <div className="tmd-dir-confidence">
                  {data.confidence.charAt(0).toUpperCase() + data.confidence.slice(1)} confidence
                </div>
              )}
            </div>
          </div>

          {data.reasons && data.reasons.length > 0 && (
            <div className="tmd-dir-section">
              <div className="tmd-dir-section-label">Why this direction</div>
              <ul className="tmd-dir-list">
                {data.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          )}

          {data.blockers && data.blockers.length > 0 && (
            <div className="tmd-dir-section">
              <div className="tmd-dir-section-label">Things to watch</div>
              <ul className="tmd-dir-list tmd-dir-list-blockers">
                {data.blockers.map((b) => <li key={b}>{b}</li>)}
              </ul>
            </div>
          )}

          <TeamDirectionInputs data={data} />

          <div className="tmd-provenance">
            Read-only classifier. Uses FORGE alpha scores and draft pick capital for direction. Promoted Rookie Alpha only improves evidence coverage and visibility — it is never blended into FORGE scoring or rankings.
          </div>
        </div>
      )}
    </section>
  );
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

  const picksQuery = useQuery<PicksResponse>({
    queryKey: [`/api/league-sync/picks?user_id=${DEFAULT_USER_ID}&league_id=${activeLeagueId ?? ''}&team_id=${activeTeam?.id ?? ''}`],
    enabled: Boolean(activeLeagueId && activeTeam?.id),
  });

  const teamDirectionQuery = useQuery<TeamDirectionResponse>({
    queryKey: [`/api/management/team-direction?user_id=${DEFAULT_USER_ID}&league_id=${activeLeagueId ?? ''}`],
    enabled: Boolean(activeLeagueId && activeTeam?.id),
  });

  const rosterCounts = useMemo(() => buildRosterCounts(activeDashboardTeam), [activeDashboardTeam]);
  const rosterVisibility = useMemo(
    () => buildRosterVisibilitySummary(activeDashboardTeam?.roster ?? []),
    [activeDashboardTeam?.roster],
  );
  const hasRosterData = Boolean(activeDashboardTeam?.roster?.length);
  const hasDashboardTotals = Boolean(activeDashboardTeam?.totals);
  const rosterGroups = useMemo(() => groupRosterByPosition(activeDashboardTeam?.roster ?? []), [activeDashboardTeam]);
  const picksBySeason = useMemo(() => groupPicksBySeason(picksQuery.data?.picks ?? []), [picksQuery.data?.picks]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/league-sync/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: DEFAULT_USER_ID, league_id_external: sleeperLeagueId.trim() }),
      });
      const data = await response.json().catch(() => ({})) as {
        success?: boolean; error?: string; requestId?: string;
        league?: { id?: string }; teams?: Array<{ id?: string }>;
        suggestedTeamId?: string | null; activeTeam?: { id?: string } | null;
      };
      if (!response.ok || data.success === false) {
        const msg = data.error || `Request failed (HTTP ${response.status})`;
        throw Object.assign(new Error(msg), { requestId: data.requestId });
      }
      return data;
    },
    onSuccess: async (data) => {
      setSleeperLeagueId('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/league-context?user_id=${DEFAULT_USER_ID}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/league-sync/leagues?user_id=${DEFAULT_USER_ID}`] }),
      ]);
      // Auto-select the newly synced league and suggested team if the response tells us which one
      if (data?.league?.id) {
        setSelectedLeagueId(data.league.id);
        const autoTeam = data.suggestedTeamId ?? data.activeTeam?.id ?? null;
        if (autoTeam) setSelectedTeamId(autoTeam);
      }
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

  const selectedLeagueData = useMemo(() => {
    if (!selectedLeagueId) return null;
    return leaguesQuery.data?.leagues?.find((item) => item.id === selectedLeagueId) ?? null;
  }, [leaguesQuery.data?.leagues, selectedLeagueId]);

  const selectableTeams = useMemo(() => {
    return selectedLeagueData?.teams ?? [];
  }, [selectedLeagueData]);

  const teamsEmpty = selectedLeagueId && !leaguesQuery.isLoading && selectableTeams.length === 0;

  const teamstateDetails = teamstateQuery.isError
    ? ['Team environment movement data could not be reached in this deployment.']
    : getTeamEnvironmentMovementReadinessDetails(teamstateQuery.data);

  const modelSignals = buildManagementModelSignals({
    hasActiveTeam: Boolean(activeTeam),
    hasRosterData,
    hasDashboardTotals,
    rosterVisibility,
    teamstateQueryState: teamstateQuery.isLoading ? 'loading' : teamstateQuery.isError ? 'error' : 'success',
    teamstateResponse: teamstateQuery.data,
    teamstateDetails,
  });

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
              <span className="tmd-selector-hint">Saved leagues may come from earlier syncs. Re-sync if teams are missing.</span>
            </label>
            <label>
              Team
              <select
                value={selectedTeamId}
                onChange={(event) => setSelectedTeamId(event.target.value)}
                disabled={!selectedLeagueId || !!teamsEmpty}
              >
                {!selectedLeagueId && <option value="">Select a league first</option>}
                {selectedLeagueId && leaguesQuery.isLoading && <option value="">Loading teams…</option>}
                {selectedLeagueId && !leaguesQuery.isLoading && selectableTeams.length === 0 && (
                  <option value="">No teams — re-sync this league</option>
                )}
                {selectableTeams.length > 0 && <option value="">Select a team</option>}
                {selectableTeams.map((team) => (
                  <option key={team.id} value={team.id}>{displayTeamName(team)}</option>
                ))}
              </select>
            </label>
          </div>

          {teamsEmpty && (
            <div className="tmd-callout tmd-callout-warn">
              This saved league has no teams loaded. Re-sync the Sleeper league ID to rebuild team context.
            </div>
          )}

          {selectedLeagueData && (
            <div className="tmd-league-debug">
              <span>ID: {selectedLeagueData.id}</span>
              {((selectedLeagueData as any).leagueIdExternal ?? (selectedLeagueData as any).league_id_external) && (
                <span>Sleeper ID: {(selectedLeagueData as any).leagueIdExternal ?? (selectedLeagueData as any).league_id_external}</span>
              )}
              <span>Teams: {selectableTeams.length}</span>
              {selectedLeagueData.season && <span>Season: {selectedLeagueData.season}</span>}
              {(selectedLeagueData.platform ?? (selectedLeagueData as any).platform) && (
                <span>Platform: {selectedLeagueData.platform ?? (selectedLeagueData as any).platform}</span>
              )}
            </div>
          )}

          <button
            type="button"
            className="tmd-secondary-button"
            disabled={!selectedLeagueId || !selectedTeamId || !!teamsEmpty || setContextMutation.isPending}
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

      <TeamDirectionCard query={teamDirectionQuery} activeTeam={activeTeam} />

      <section className="tmd-card">
        <div className="tmd-card-header">
          <div>
            <h2 id="roster-snapshot">Roster Snapshot</h2>
            <p>FORGE values and promoted Rookie Alpha fallback context for every player on your active roster.</p>
          </div>
          <span className={`tmd-status ${hasRosterData ? 'tmd-status-ready' : 'tmd-status-unavailable'}`}>
            {dashboardQuery.isLoading ? 'Loading…' : hasRosterData ? 'Ready' : 'Needs synced roster'}
          </span>
        </div>

        {hasRosterData && (
          <div className="tmd-roster-coverage-strip" aria-label="Roster coverage diagnostics">
            <div>
              <span>FORGE scored</span>
              <strong>{rosterVisibility.forgeScored}/{rosterVisibility.total}</strong>
            </div>
            <div>
              <span>Rookie Alpha fallback</span>
              <strong>{rosterVisibility.rookieAlphaFallback}/{rosterVisibility.total}</strong>
            </div>
            <div>
              <span>Known · unscored</span>
              <strong>{rosterVisibility.knownUnscored}/{rosterVisibility.total}</strong>
            </div>
            <div>
              <span>Unresolved</span>
              <strong>{rosterVisibility.unresolved}/{rosterVisibility.total}</strong>
            </div>
            <div>
              <span>Evidence coverage</span>
              <strong>{rosterVisibility.evidenceCovered}/{rosterVisibility.total}</strong>
              <small>FORGE scored + Rookie Alpha fallback</small>
            </div>
          </div>
        )}

        {hasRosterData && (
          <div className="tmd-position-grid tmd-position-grid-summary">
            {positionGroups.map((position) => {
              const count = rosterCounts[position];
              return (
                <div className="tmd-position-card" key={position}>
                  <span>{position}</span>
                  <strong>{count.total}</strong>
                  <small>{count.forgeScored}/{count.total} FORGE scored{count.totalAlpha !== null ? ` · ${count.totalAlpha.toFixed(1)}α` : ''}</small>
                  {(count.rookieAlphaFallback > 0 || count.knownUnscored > 0 || count.unresolved > 0) && (
                    <small className="tmd-position-card-detail">
                      {count.rookieAlphaFallback > 0 ? `${count.rookieAlphaFallback} Rookie Alpha · ` : ''}
                      {count.knownUnscored} known · unscored · {count.unresolved} unresolved
                    </small>
                  )}
                </div>
              );
            })}
            {activeDashboardTeam?.overall_total != null && (
              <div className="tmd-position-card tmd-position-card-total">
                <span>Overall</span>
                <strong>{activeDashboardTeam.overall_total.toFixed(1)}</strong>
                <small>FORGE alpha total</small>
              </div>
            )}
          </div>
        )}

        {hasRosterData ? (
          <div className="tmd-player-table">
            {['QB', 'RB', 'WR', 'TE', 'Other'].map((pos) => {
              const players = rosterGroups[pos] ?? [];
              if (players.length === 0) return null;
              return (
                <div key={pos} className="tmd-player-group">
                  <div className="tmd-player-group-header">{pos === 'Other' ? 'Unmatched / Other' : pos}</div>
                  {players.map((player, idx) => {
                    const isForgeScored = typeof player.alpha === 'number';
                    const rookieAsset = !isForgeScored ? player.rookieAsset : null;
                    const isUnresolved = !isForgeScored && !rookieAsset && (player.visibilityState === 'unresolved' || player.missingReason === 'unmapped_sleeper_id');
                    const tierLabel = isForgeScored ? forgeTierLabel(player.tier) : null;
                    return (
                      <div key={player.rosterKey ?? player.sleeperId ?? idx} className={`tmd-player-row ${!isForgeScored && !rookieAsset ? 'tmd-player-row-unmatched' : ''}`}>
                        <div className="tmd-player-name">
                          <span>{player.name ?? player.sleeperId ?? 'Unknown'}</span>
                          {player.nflTeam && <span className="tmd-player-team">{player.nflTeam}</span>}
                        </div>
                        <div className="tmd-player-meta">
                          <span className="tmd-player-pos">{String(player.pos ?? player.position ?? '').toUpperCase() || '—'}</span>
                          {player.usedAsStarter && <span className="tmd-player-starter">STR</span>}
                          {tierLabel && <span className={`tmd-player-tier tmd-player-tier-${player.tier}`}>{tierLabel}</span>}
                        </div>
                        <div className="tmd-player-alpha">
                          {isForgeScored ? (
                            <div className="tmd-player-alpha-matched">
                              <strong>{(player.alpha as number).toFixed(1)}</strong>
                              <span className="tmd-player-matched-badge">FORGE scored</span>
                            </div>
                          ) : rookieAsset ? (
                            <div className="tmd-player-rookie-asset">
                              <strong>{rookieAsset.rookieAlphaScore ?? '—'}</strong>
                              <span className="tmd-player-rookie-rank">
                                Rookie Alpha {rookieAsset.positionRank ?? (rookieAsset.alphaRank != null ? `#${rookieAsset.alphaRank}` : '')}
                              </span>
                              <span className="tmd-player-rookie-badge">Rookie Asset</span>
                              {rookieAsset.talentScore != null && <span className="tmd-player-rookie-detail">Talent {rookieAsset.talentScore}</span>}
                              {rookieAsset.consensusDelta != null && <span className="tmd-player-rookie-detail">Consensus Δ {rookieAsset.consensusDelta > 0 ? '+' : ''}{rookieAsset.consensusDelta}</span>}
                            </div>
                          ) : (
                            <div className="tmd-player-alpha-unmatched">
                              <span className="tmd-player-unmatched-label">{isUnresolved ? 'Unresolved' : 'Known · unscored'}</span>
                              <span className="tmd-player-unmatched-reason">{unscoredReasonLabel(player)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="tmd-empty-state">
            {dashboardQuery.isLoading ? 'Loading roster…' : 'Roster snapshot appears after you connect a team.'}
          </div>
        )}
      </section>

      <section className="tmd-card">
        <div className="tmd-card-header">
          <div>
            <h2>Draft Picks / Future Capital</h2>
            <p>Traded picks stored from your last sync.</p>
          </div>
          <span className={`tmd-status ${picksQuery.data?.available ? 'tmd-status-ready' : 'tmd-status-unavailable'}`}>
            {picksQuery.isLoading ? 'Loading…' : picksQuery.data?.available ? 'Available' : 'Unavailable'}
          </span>
        </div>

        {!activeLeagueId || !activeTeam?.id ? (
          <div className="tmd-empty-state">
            Connect a team to inspect future picks.
            <span className="tmd-empty-sub">Pick capital is shown for your active team only — not league-wide.</span>
          </div>
        ) : picksQuery.isLoading ? (
          <div className="tmd-empty-state">Loading picks…</div>
        ) : picksQuery.data?.available && picksBySeason.size > 0 ? (
          <div className="tmd-picks-grid">
            {Array.from(picksBySeason.entries()).sort(([a], [b]) => a - b).map(([season, seasonPicks]) => (
              <div key={season} className="tmd-picks-season">
                <div className="tmd-picks-season-label">{season}</div>
                <div className="tmd-picks-list">
                  {seasonPicks.map((pick, idx) => (
                    <div key={pick.id ?? idx} className="tmd-pick-row">
                      <span className="tmd-pick-round">Rd {pick.round}</span>
                      <span className="tmd-pick-source">{pick.source === 'trade' ? 'Traded in' : 'Original'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="tmd-empty-state">
            No traded pick data available for this league.
            <span className="tmd-empty-sub">Pick capital is recorded when picks are traded. Re-sync the league after trades are made.</span>
          </div>
        )}
      </section>

      <section className="tmd-card">
        <div className="tmd-card-header">
          <div>
            <h2>Model Stack / Model Signals</h2>
            <p>Operator readiness for model layers connected to this Management context.</p>
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
