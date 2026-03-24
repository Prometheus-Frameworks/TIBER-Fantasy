import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Search, ArrowUpRight, AlertTriangle, CheckCircle2, CircleOff, Layers3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PromotedModuleSystemCard } from '@/components/data-lab/PromotedModuleSystemCard';
import { PromotedModuleStateCard } from '@/components/data-lab/PromotedModuleStateCard';
import { buildPromotedModuleNavigationLabel } from '@/lib/dataLabPromotedModules';
import {
  PlayerResearchResponse,
  PlayerResearchSearchEntry,
  buildPlayerResearchHref,
  filterPlayerResearchSearchIndex,
  findSearchEntryByQuery,
  formatNumber,
  formatPercent,
  formatSignedNumber,
  getPlayerResearchStateLabel,
} from '@/lib/playerResearch';

interface PlayerResearchWorkspaceViewProps {
  season: string;
  availableSeasons: number[];
  data: PlayerResearchResponse['data'] | null;
  isLoading: boolean;
  errorMessage: string | null;
  onSeasonChange: (season: string) => void;
}

function statusTone(state: PlayerResearchResponse['data']['state'] | 'ready' | 'not_available' | 'error' | 'idle') {
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

function statusIcon(state: PlayerResearchResponse['data']['state'] | 'ready' | 'not_available' | 'error' | 'idle') {
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

function SearchSuggestions({ entries, season }: { entries: PlayerResearchSearchEntry[]; season: string }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {entries.slice(0, 8).map((entry) => (
        <Link
          key={`${entry.playerId ?? entry.playerName}`}
          href={buildPlayerResearchHref({ season, playerId: entry.playerId, playerName: entry.playerName })}
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
        >
          {entry.playerName}
          {entry.team ? ` · ${entry.team}` : ''}
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
  section: PlayerResearchResponse['data']['sections'][keyof PlayerResearchResponse['data']['sections']];
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

export function PlayerResearchWorkspaceView({
  season,
  availableSeasons,
  data,
  isLoading,
  errorMessage,
  onSeasonChange,
}: PlayerResearchWorkspaceViewProps) {
  const [searchInput, setSearchInput] = useState(data?.selectedPlayer?.playerName ?? data?.requestedPlayerName ?? '');

  useEffect(() => {
    setSearchInput(data?.selectedPlayer?.playerName ?? data?.requestedPlayerName ?? '');
  }, [data?.requestedPlayerName, data?.selectedPlayer?.playerName]);

  const suggestedMatches = useMemo(
    () => filterPlayerResearchSearchIndex(data?.searchIndex ?? [], searchInput),
    [data?.searchIndex, searchInput],
  );

  const exactSearchMatch = useMemo(
    () => findSearchEntryByQuery(data?.searchIndex ?? [], { playerName: searchInput }),
    [data?.searchIndex, searchInput],
  );

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const bestMatch = exactSearchMatch ?? suggestedMatches[0] ?? null;
    const href = buildPlayerResearchHref({
      season,
      playerId: bestMatch?.playerId ?? null,
      playerName: (searchInput || bestMatch?.playerName || '').trim() || null,
    });

    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const seasonOptions = Array.from(new Set([...availableSeasons, Number(season)].filter((value) => Number.isFinite(value)))).sort((left, right) => right - left);
  const selectedSeason = seasonOptions.includes(Number(season))
    ? season
    : (seasonOptions[0] != null ? String(seasonOptions[0]) : '');

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/tiber-data-lab" className="transition-colors hover:text-[#e2640d]">
          Data Lab
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-600">Player Research Workspace</span>
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
                  {getPlayerResearchStateLabel(data.state)}
                </span>
              ) : null}
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-gray-900">Player Research Workspace</h1>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              {data?.framing.description ?? 'Inspect promoted read-only outputs for one player in one place.'}
            </p>
            <p className="mt-2 text-sm leading-7 text-gray-500">
              {data?.framing.provenanceNote ??
                'TIBER-Fantasy orchestrates and normalizes promoted model outputs here without recomputing the underlying models locally.'}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-[#fafafa] p-4 text-sm text-gray-600 md:max-w-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Why this exists</div>
            <p className="mt-2 leading-6">
              This is the first true cross-model synthesis surface in TIBER Data Lab: a player-centric workspace built from promoted,
              read-only model outputs.
            </p>
          </div>
        </div>

        <form onSubmit={submitSearch} className="mt-6 grid gap-3 rounded-2xl border border-gray-200 bg-[#fafafa] p-4 lg:grid-cols-[minmax(0,1fr),180px,auto]">
          <label className="block">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Player search by name</div>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search a promoted player…"
                className="w-full border-0 bg-transparent text-sm text-gray-900 outline-none"
                list="player-research-search-index"
              />
            </div>
            <datalist id="player-research-search-index">
              {(data?.searchIndex ?? []).map((entry) => (
                <option key={`${entry.playerId ?? entry.playerName}`} value={entry.playerName} />
              ))}
            </datalist>
          </label>

          <label className="block">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Season</div>
            <select
              value={selectedSeason}
              onChange={(event) => onSeasonChange(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
              disabled={seasonOptions.length === 0}
            >
              {seasonOptions.length === 0 ? <option value="">No seasons available</option> : null}
              {seasonOptions.map((option) => (
                <option key={option} value={String(option)}>{option}</option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
            >
              Open workspace
            </button>
          </div>
        </form>

        <div className="mt-3 text-xs text-gray-500">
          Deep-link supported via <span className="font-mono">playerId</span> and <span className="font-mono">playerName</span> query params.
        </div>

        <SearchSuggestions entries={suggestedMatches} season={season} />
      </div>

      {isLoading ? (
        <div className="mt-6">
          <PromotedModuleStateCard
            icon={Layers3}
            accentClassName="bg-gray-100"
            accentTextClassName="text-gray-700"
            title="Loading Player Research Workspace"
            message="Loading the promoted read-only player workspace and checking which promoted modules are available for the selected player."
            mode="loading"
          />
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-6">
          <PromotedModuleStateCard
            icon={AlertTriangle}
            accentClassName="bg-red-50"
            accentTextClassName="text-red-700"
            title="Player Research Workspace unavailable"
            message={errorMessage}
            hints={[
              'This workspace stays read only and depends on the promoted lab adapters being reachable.',
              'Retry after the upstream promoted modules are healthy again.',
            ]}
            mode="error"
          />
        </div>
      ) : null}

      {data && !isLoading && !errorMessage ? (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <SummaryStat label="Selected player" value={data.selectedPlayer?.playerName ?? 'Not selected'} />
            <SummaryStat label="Season" value={data.season != null ? String(data.season) : '—'} />
            <SummaryStat label="Search index" value={`${data.searchIndex.length} promoted players`} />
            <SummaryStat label="Workspace state" value={getPlayerResearchStateLabel(data.state)} />
          </div>

          {data.selectedPlayer ? (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-[#fafafa] p-4 text-sm text-gray-600">
              Researching <span className="font-semibold text-gray-900">{data.selectedPlayer.playerName}</span>
              {data.selectedPlayer.team ? ` · ${data.selectedPlayer.team}` : ''}
              {data.selectedPlayer.position ? ` · ${data.selectedPlayer.position}` : ''}
              . Match strategy: <span className="font-semibold text-gray-900">{data.selectedPlayer.matchStrategy ?? 'n/a'}</span>.
            </div>
          ) : null}

          {data.state === 'idle' ? (
            <div className="mt-6">
              <PromotedModuleStateCard
                icon={Layers3}
                accentClassName="bg-gray-100"
                accentTextClassName="text-gray-700"
                title="Player Research Workspace ready"
                message="Search by player name or use a playerId deep link to inspect promoted outputs for a single player."
                hints={[
                  'Deep-link supported via playerId, playerName, and season query params.',
                  'This workspace does not recompute any of the underlying promoted models.',
                ]}
                mode="empty"
              />
            </div>
          ) : null}

          {data.state === 'empty' ? (
            <div className="mt-6">
              <PromotedModuleStateCard
                icon={CircleOff}
                accentClassName="bg-gray-100"
                accentTextClassName="text-gray-700"
                title="No promoted player match found"
                message="No promoted player match was found for that query in the selected season. Try another spelling or choose a suggestion from the promoted search index."
                hints={[
                  'This is a no-data state for the selected query, not a local recomputation state.',
                  'Try a GSIS playerId deep link when you need deterministic carry-through across modules.',
                ]}
                mode="empty"
              />
            </div>
          ) : null}

          {data.warnings.length > 0 ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="text-sm font-semibold text-amber-800">Workspace warnings</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700">
                {data.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.selectedPlayer ? (
            <div className="mt-6 grid gap-5">
              <SectionCard section={data.sections.breakoutSignals} navigationLabel={buildPromotedModuleNavigationLabel('breakout-signals')}>
                {data.sections.breakoutSignals.summary ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryStat label="Candidate rank" value={data.sections.breakoutSignals.summary.candidateRank != null ? String(data.sections.breakoutSignals.summary.candidateRank) : '—'} />
                    <SummaryStat label="Signal score" value={formatNumber(data.sections.breakoutSignals.summary.finalSignalScore, 1)} />
                    <SummaryStat label="Best recipe" value={data.sections.breakoutSignals.summary.bestRecipeName ?? '—'} />
                    <SummaryStat label="Label" value={data.sections.breakoutSignals.summary.breakoutLabel ?? '—'} />
                    <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-gray-100 bg-[#fafafa] p-3 text-sm text-gray-600">
                      <div className="font-semibold text-gray-900">Component summary</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        {data.sections.breakoutSignals.summary.componentSummary.map((component) => (
                          <div key={component.label} className="rounded-lg border border-gray-100 bg-white p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{component.label}</div>
                            <div className="mt-2 text-sm font-semibold text-gray-900">{formatNumber(component.value, 1)}</div>
                          </div>
                        ))}
                      </div>
                      {data.sections.breakoutSignals.summary.breakoutContext ? <p className="mt-3">{data.sections.breakoutSignals.summary.breakoutContext}</p> : null}
                    </div>
                  </div>
                ) : null}
              </SectionCard>

              <SectionCard section={data.sections.roleOpportunity} navigationLabel={buildPromotedModuleNavigationLabel('role-opportunity')}>
                {data.sections.roleOpportunity.summary ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryStat label="Primary role" value={data.sections.roleOpportunity.summary.primaryRole} />
                    <SummaryStat label="Target share" value={formatPercent(data.sections.roleOpportunity.summary.targetShare)} />
                    <SummaryStat label="Route share" value={formatPercent(data.sections.roleOpportunity.summary.routeParticipation)} />
                    <SummaryStat label="Air-yard share" value={formatPercent(data.sections.roleOpportunity.summary.airYardShare)} />
                    <SummaryStat label="Snap share" value={formatPercent(data.sections.roleOpportunity.summary.snapShare)} />
                    <SummaryStat label="Usage rate" value={formatPercent(data.sections.roleOpportunity.summary.usageRate)} />
                    <SummaryStat label="Confidence" value={data.sections.roleOpportunity.summary.confidenceScore != null ? `${formatPercent(data.sections.roleOpportunity.summary.confidenceScore)} · ${data.sections.roleOpportunity.summary.confidenceTier ?? '—'}` : '—'} />
                    <SummaryStat label="Source" value={data.sections.roleOpportunity.summary.source.modelVersion ?? '—'} />
                    {data.sections.roleOpportunity.summary.insights.length > 0 ? (
                      <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-gray-100 bg-[#fafafa] p-3 text-sm text-gray-600">
                        <div className="font-semibold text-gray-900">Usage notes</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {data.sections.roleOpportunity.summary.insights.map((insight) => (
                            <li key={insight}>{insight}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </SectionCard>

              <SectionCard section={data.sections.ageCurves} navigationLabel={buildPromotedModuleNavigationLabel('age-curves')}>
                {data.sections.ageCurves.summary ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryStat label="Age" value={formatNumber(data.sections.ageCurves.summary.age, 1)} />
                    <SummaryStat label="Career year" value={data.sections.ageCurves.summary.careerYear != null ? String(data.sections.ageCurves.summary.careerYear) : '—'} />
                    <SummaryStat label="Expected PPG" value={formatNumber(data.sections.ageCurves.summary.expectedPpg, 1)} />
                    <SummaryStat label="Actual PPG" value={formatNumber(data.sections.ageCurves.summary.actualPpg, 1)} />
                    <SummaryStat label="Delta" value={formatSignedNumber(data.sections.ageCurves.summary.ppgDelta, 1)} />
                    <SummaryStat label="Trajectory" value={data.sections.ageCurves.summary.trajectoryLabel ?? '—'} />
                    <SummaryStat label="Peer bucket" value={data.sections.ageCurves.summary.peerBucket ?? '—'} />
                    <SummaryStat label="ARC score" value={formatNumber(data.sections.ageCurves.summary.ageCurveScore, 1)} />
                  </div>
                ) : null}
              </SectionCard>

              <SectionCard section={data.sections.pointScenarios} navigationLabel={buildPromotedModuleNavigationLabel('point-scenarios')}>
                {data.sections.pointScenarios.summary ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryStat label="Baseline projection" value={formatNumber(data.sections.pointScenarios.summary.baselineProjection, 1)} />
                    <SummaryStat label="Adjusted projection" value={formatNumber(data.sections.pointScenarios.summary.adjustedProjection, 1)} />
                    <SummaryStat label="Delta" value={formatSignedNumber(data.sections.pointScenarios.summary.delta, 1)} />
                    <SummaryStat label="Confidence" value={[data.sections.pointScenarios.summary.confidenceBand, data.sections.pointScenarios.summary.confidenceLabel].filter(Boolean).join(' · ') || '—'} />
                    <SummaryStat label="Scenario count" value={String(data.sections.pointScenarios.summary.scenarioCount)} />
                    <SummaryStat label="Top scenarios" value={data.sections.pointScenarios.summary.topScenarioNames.join(', ') || '—'} />
                    {data.sections.pointScenarios.summary.notes.length > 0 ? (
                      <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-gray-100 bg-[#fafafa] p-3 text-sm text-gray-600">
                        <div className="font-semibold text-gray-900">Scenario notes</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {data.sections.pointScenarios.summary.notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </SectionCard>
            </div>
          ) : null}

          <div className="mt-6">
            <PromotedModuleSystemCard
              currentModuleId="player-research"
              playerContext={{
                playerId: data.selectedPlayer?.playerId ?? data.requestedPlayerId,
                playerName: data.selectedPlayer?.playerName ?? data.requestedPlayerName,
                team: data.selectedPlayer?.team ?? null,
                season: data.season != null ? String(data.season) : season,
              }}
              heading="Open deeper promoted labs"
              description="Use this workspace for the player-centric synthesis pass, then jump into the deeper promoted lab pages for full-table context and detailed read-only payload inspection."
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
