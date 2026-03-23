import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, AlertTriangle, CheckCircle2, CircleOff, Layers3, Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PromotedModuleSystemCard } from '@/components/data-lab/PromotedModuleSystemCard';
import { buildPromotedModuleNavigationLabel } from '@/lib/dataLabPromotedModules';
import {
  TeamResearchPlayerSummary,
  TeamResearchResponse,
  TeamResearchSearchEntry,
  buildTeamResearchHref,
  filterTeamResearchSearchIndex,
  findTeamSearchEntry,
  formatNumber,
  formatPercent,
  formatSignedNumber,
  getTeamResearchStateLabel,
} from '@/lib/teamResearch';

interface TeamResearchWorkspaceViewProps {
  season: string;
  availableSeasons: number[];
  data: TeamResearchResponse['data'] | null;
  isLoading: boolean;
  errorMessage: string | null;
  onSeasonChange: (season: string) => void;
}

function statusTone(state: TeamResearchResponse['data']['state'] | 'ready' | 'not_available' | 'error' | 'idle') {
  switch (state) {
    case 'ready':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'partial':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'not_available':
    case 'empty':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'error':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function statusIcon(state: TeamResearchResponse['data']['state'] | 'ready' | 'not_available' | 'error' | 'idle') {
  switch (state) {
    case 'ready':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'partial':
    case 'error':
      return <AlertTriangle className="h-4 w-4" />;
    case 'not_available':
    case 'empty':
      return <CircleOff className="h-4 w-4" />;
    default:
      return <Layers3 className="h-4 w-4" />;
  }
}

function SearchSuggestions({ entries, season }: { entries: TeamResearchSearchEntry[]; season: string }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {entries.slice(0, 8).map((entry) => (
        <Link
          key={entry.team}
          href={buildTeamResearchHref({ season, team: entry.team })}
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
        >
          {entry.teamName} · {entry.team}
        </Link>
      ))}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-[#fafafa] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{label}</div>
      <div className="mt-2 text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function SectionCard({
  section,
  navigationLabel = 'Go to module',
  children,
}: {
  section: TeamResearchResponse['data']['sections'][keyof TeamResearchResponse['data']['sections']];
  navigationLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(section.state)}`}>
              {statusIcon(section.state)}
              {section.state === 'ready' ? 'Available' : section.state === 'not_available' ? 'Not available' : section.state === 'error' ? 'Error' : 'Idle'}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-600">{section.description}</p>
          <p className="mt-2 text-xs leading-5 text-gray-500">{section.provenanceNote}</p>
        </div>
        <a
          href={section.linkHref}
          className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900"
        >
          {navigationLabel}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {section.message ? <p className="mt-4 text-sm text-gray-600">{section.message}</p> : null}
      {section.error ? <p className="mt-2 text-sm text-red-600">{section.error.message}</p> : null}
      {children}
    </section>
  );
}

function PlayerSummaryTable({ players }: { players: TeamResearchPlayerSummary[] }) {
  if (players.length === 0) {
    return <p className="mt-4 text-sm text-gray-500">No promoted player rows are available for this section.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-[#fafafa] text-left text-[11px] uppercase tracking-[0.18em] text-gray-400">
          <tr>
            <th className="px-4 py-3">Player</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Target</th>
            <th className="px-4 py-3">Breakout</th>
            <th className="px-4 py-3">ARC</th>
            <th className="px-4 py-3">Scenario</th>
            <th className="px-4 py-3">Player Research</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
          {players.map((player) => (
            <tr key={`${player.playerId ?? player.playerName}-${player.team}`}>
              <td className="px-4 py-3">
                <div className="font-semibold text-gray-900">{player.playerName}</div>
                <div className="text-xs text-gray-500">{[player.position, player.team].filter(Boolean).join(' · ') || '—'}</div>
              </td>
              <td className="px-4 py-3">{player.primaryRole ?? '—'}</td>
              <td className="px-4 py-3">{formatPercent(player.targetShare)}</td>
              <td className="px-4 py-3">{player.breakoutSignalScore != null ? `${formatNumber(player.breakoutSignalScore, 1)}${player.breakoutLabel ? ` · ${player.breakoutLabel}` : ''}` : '—'}</td>
              <td className="px-4 py-3">{player.trajectoryLabel ?? (player.ageCurveScore != null ? formatNumber(player.ageCurveScore, 1) : '—')}</td>
              <td className="px-4 py-3">{player.scenarioDelta != null ? `${formatSignedNumber(player.scenarioDelta, 1)} · ${player.scenarioCount}` : '—'}</td>
              <td className="px-4 py-3">
                <a href={player.playerResearchHref} className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563eb] hover:text-[#1d4ed8]">
                  Open
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TeamResearchWorkspaceView({ season, availableSeasons, data, isLoading, errorMessage, onSeasonChange }: TeamResearchWorkspaceViewProps) {
  const [searchInput, setSearchInput] = useState(data?.selectedTeam?.team ?? data?.selectedTeam?.teamName ?? data?.requestedTeam ?? '');

  useEffect(() => {
    setSearchInput(data?.selectedTeam?.team ?? data?.selectedTeam?.teamName ?? data?.requestedTeam ?? '');
  }, [data?.requestedTeam, data?.selectedTeam?.team, data?.selectedTeam?.teamName]);

  const suggestedMatches = useMemo(() => filterTeamResearchSearchIndex(data?.searchIndex ?? [], searchInput), [data?.searchIndex, searchInput]);
  const exactSearchMatch = useMemo(() => findTeamSearchEntry(data?.searchIndex ?? [], searchInput), [data?.searchIndex, searchInput]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const bestMatch = exactSearchMatch ?? suggestedMatches[0] ?? null;
    const href = buildTeamResearchHref({ season, team: (bestMatch?.team ?? searchInput).trim() || null });
    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const seasonOptions = availableSeasons.length > 0 ? availableSeasons : [Number(season)];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/tiber-data-lab" className="transition-colors hover:text-[#2563eb]">Data Lab</Link>
        <span>/</span>
        <span className="font-medium text-gray-600">Team Research Workspace</span>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-gray-900 text-white">Promoted module system</Badge>
              <Badge variant="secondary" className="border-0 bg-gray-100 text-gray-700">Read only</Badge>
              {data ? (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(data.state)}`}>
                  {statusIcon(data.state)}
                  {getTeamResearchStateLabel(data.state)}
                </span>
              ) : null}
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-gray-900">Team Research Workspace</h1>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              {data?.framing.description ?? 'Inspect promoted read-only outputs for one offensive environment in one place.'}
            </p>
            <p className="mt-2 text-sm leading-7 text-gray-500">
              {data?.framing.provenanceNote ?? 'TIBER-Fantasy orchestrates and normalizes promoted model outputs here without recomputing the underlying models locally.'}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-[#fafafa] p-4 text-sm text-gray-600 md:max-w-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Why this exists</div>
            <p className="mt-2 leading-6">
              Player Research shows the whole picture for one player. Team Research shows the whole picture for one offensive environment across the promoted read-only Data Lab surfaces.
            </p>
          </div>
        </div>

        <form onSubmit={submitSearch} className="mt-6 grid gap-3 rounded-2xl border border-gray-200 bg-[#fafafa] p-4 lg:grid-cols-[minmax(0,1fr),180px,auto]">
          <label className="block">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Team search</div>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search a promoted team…"
                className="w-full border-0 bg-transparent text-sm text-gray-900 outline-none"
                list="team-research-search-index"
              />
            </div>
            <datalist id="team-research-search-index">
              {(data?.searchIndex ?? []).map((entry) => (
                <option key={entry.team} value={entry.team}>{entry.teamName}</option>
              ))}
            </datalist>
          </label>

          <label className="block">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Season</div>
            <select value={season} onChange={(event) => onSeasonChange(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none">
              {seasonOptions.map((option) => (
                <option key={option} value={String(option)}>{option}</option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button type="submit" className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800">
              Open workspace
            </button>
          </div>
        </form>

        <div className="mt-3 text-xs text-gray-500">
          Deep-link supported via <span className="font-mono">team</span> query param.
        </div>

        <SearchSuggestions entries={suggestedMatches} season={season} />
      </div>

      {isLoading ? (
        <div className="mt-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-gray-700"><Layers3 className="h-4 w-4" />Loading Team Research Workspace</div>
            <p className="mt-2 text-sm text-gray-600">Loading the promoted read-only team workspace and checking which promoted module surfaces are available for the selected offensive environment.</p>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-700"><AlertTriangle className="h-4 w-4" />Team Research Workspace unavailable</div>
          <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
        </div>
      ) : null}

      {data && !isLoading && !errorMessage ? (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <SummaryStat label="Selected team" value={data.selectedTeam?.teamName ?? 'Not selected'} />
            <SummaryStat label="Season" value={data.season != null ? String(data.season) : '—'} />
            <SummaryStat label="Team index" value={`${data.searchIndex.length} promoted teams`} />
            <SummaryStat label="Workspace state" value={getTeamResearchStateLabel(data.state)} />
          </div>

          {data.selectedTeam ? (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-[#fafafa] p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-gray-400"><Users className="h-3.5 w-3.5" />Team identity</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">{data.header.teamName ?? data.selectedTeam.teamName}</div>
                  <div className="mt-1 text-sm text-gray-600">{[data.header.team, data.header.conference, data.header.division ? `${data.header.division} Division` : null].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="text-sm text-gray-600">
                  <div>Match strategy: <span className="font-semibold text-gray-900">{data.selectedTeam.matchStrategy ?? 'n/a'}</span></div>
                  <div className="mt-1">This workspace is read only and composed from promoted model/data surfaces.</div>
                </div>
              </div>
            </div>
          ) : null}

          {data.state === 'idle' ? <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">Search by team code or team name to inspect promoted outputs for a single offensive environment.</div> : null}
          {data.state === 'empty' ? <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">No promoted team match was found for that query in the selected season. Try a team code like <span className="font-mono">MIN</span> or choose a suggestion from the promoted team index.</div> : null}

          {data.warnings.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="text-sm font-semibold text-amber-800">Workspace warnings</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700">
                {data.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          ) : null}

          {data.selectedTeam ? (
            <div className="mt-6 grid gap-5">
              <SectionCard section={data.sections.offensiveContext} navigationLabel={buildPromotedModuleNavigationLabel('role-opportunity')}>
                {data.sections.offensiveContext.summary ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryStat label="Promoted players" value={String(data.sections.offensiveContext.summary.promotedPlayerCount)} />
                    <SummaryStat label="Positions covered" value={data.sections.offensiveContext.summary.positionsCovered.join(', ') || '—'} />
                    <SummaryStat label="Breakout rows" value={String(data.sections.offensiveContext.summary.breakoutCandidateCount)} />
                    <SummaryStat label="Scenario players" value={String(data.sections.offensiveContext.summary.scenarioPlayerCount)} />
                    <SummaryStat label="Avg target share" value={formatPercent(data.sections.offensiveContext.summary.avgTargetShare)} />
                    <SummaryStat label="Avg route share" value={formatPercent(data.sections.offensiveContext.summary.avgRouteParticipation)} />
                    <SummaryStat label="Avg snap share" value={formatPercent(data.sections.offensiveContext.summary.avgSnapShare)} />
                    <SummaryStat label="Avg usage rate" value={formatPercent(data.sections.offensiveContext.summary.avgUsageRate)} />
                    <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-gray-100 bg-[#fafafa] p-3 text-sm text-gray-600">
                      <div className="font-semibold text-gray-900">Context notes</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {data.sections.offensiveContext.summary.notes.map((note) => <li key={note}>{note}</li>)}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </SectionCard>

              <SectionCard section={data.sections.roleOpportunity} navigationLabel={buildPromotedModuleNavigationLabel('role-opportunity')}>
                {data.sections.roleOpportunity.summary ? (
                  <>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <SummaryStat label="Promoted players" value={String(data.sections.roleOpportunity.summary.playerCount)} />
                      <SummaryStat label="Avg target share" value={formatPercent(data.sections.roleOpportunity.summary.avgTargetShare)} />
                      <SummaryStat label="Avg route share" value={formatPercent(data.sections.roleOpportunity.summary.avgRouteParticipation)} />
                      <SummaryStat label="Avg snap share" value={formatPercent(data.sections.roleOpportunity.summary.avgSnapShare)} />
                    </div>
                    <PlayerSummaryTable players={data.sections.roleOpportunity.summary.keyPlayers} />
                  </>
                ) : null}
              </SectionCard>

              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Key players on this team</h2>
                    <p className="mt-2 text-sm leading-6 text-gray-600">Quick promoted summaries across the available labs, with direct links into Player Research for player-level synthesis.</p>
                  </div>
                </div>
                <PlayerSummaryTable players={data.keyPlayers} />
              </section>

              <SectionCard section={data.sections.breakoutSignals} navigationLabel={buildPromotedModuleNavigationLabel('breakout-signals')}>
                {data.sections.breakoutSignals.summary ? (
                  <>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <SummaryStat label="Candidate rows" value={String(data.sections.breakoutSignals.summary.candidateCount)} />
                      <SummaryStat label="Top signal score" value={formatNumber(data.sections.breakoutSignals.summary.topSignalScore, 1)} />
                      <SummaryStat label="Best recipe" value={data.sections.breakoutSignals.summary.bestRecipeName ?? '—'} />
                      <SummaryStat label="Tracked players" value={String(data.sections.breakoutSignals.summary.players.length)} />
                    </div>
                    <PlayerSummaryTable players={data.sections.breakoutSignals.summary.players} />
                  </>
                ) : null}
              </SectionCard>

              <SectionCard section={data.sections.pointScenarios} navigationLabel={buildPromotedModuleNavigationLabel('point-scenarios')}>
                {data.sections.pointScenarios.summary ? (
                  <>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <SummaryStat label="Scenario players" value={String(data.sections.pointScenarios.summary.playerCount)} />
                      <SummaryStat label="Scenario rows" value={String(data.sections.pointScenarios.summary.totalScenarioCount)} />
                      <SummaryStat label="Avg / best delta" value={formatSignedNumber(data.sections.pointScenarios.summary.maxDelta, 1)} />
                      <SummaryStat label="Source mode" value={data.sections.pointScenarios.summary.source.mode ?? '—'} />
                    </div>
                    <PlayerSummaryTable players={data.sections.pointScenarios.summary.players} />
                  </>
                ) : null}
              </SectionCard>

              <SectionCard section={data.sections.ageCurves} navigationLabel={buildPromotedModuleNavigationLabel('age-curves')}>
                {data.sections.ageCurves.summary ? (
                  <>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <SummaryStat label="ARC players" value={String(data.sections.ageCurves.summary.playerCount)} />
                      <SummaryStat label="Source mode" value={data.sections.ageCurves.summary.source.mode ?? '—'} />
                    </div>
                    <PlayerSummaryTable players={data.sections.ageCurves.summary.players} />
                  </>
                ) : null}
              </SectionCard>
            </div>
          ) : null}

          <div className="mt-6">
            <PromotedModuleSystemCard
              currentModuleId="team-research"
              playerContext={{ team: data.selectedTeam?.team ?? data.requestedTeam, season: data.season != null ? String(data.season) : season }}
              heading="Open related promoted workspaces"
              description="Use Team Research for the offensive-environment synthesis pass, then jump into Player Research or the deeper promoted lab pages for player-specific and full-table read-only inspection."
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
