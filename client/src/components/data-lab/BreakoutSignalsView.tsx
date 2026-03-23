import { Fragment, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ChevronUp, FlaskConical, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PromotedModuleSystemCard } from '@/components/data-lab/PromotedModuleSystemCard';
import { DataLabPlayerCarryContext } from '@/lib/dataLabPromotedModules';
import {
  BREAKOUT_SIGNAL_COLUMNS,
  BreakoutRecipeSummary,
  BreakoutSignalQuickFilters,
  BreakoutSignalRow,
  BreakoutSignalSortState,
  buildBestRecipeBadge,
  buildBreakoutDetailSections,
  DEFAULT_BREAKOUT_FILTERS,
  DEFAULT_BREAKOUT_SORT,
  filterBreakoutSignalRows,
  formatSignalValue,
  getBreakoutSignalsStateHints,
  sortBreakoutSignalRows,
} from '@/lib/breakoutSignals';

interface BreakoutSignalsViewProps {
  season: string;
  availableSeasons: number[];
  rows: BreakoutSignalRow[];
  bestRecipeSummary: BreakoutRecipeSummary | null;
  isLoading: boolean;
  errorMessage?: string | null;
  errorCode?: 'config_error' | 'not_found' | 'invalid_payload' | 'malformed_export' | 'upstream_unavailable' | null;
  initialPlayerContext?: DataLabPlayerCarryContext | null;
  onSeasonChange: (season: string) => void;
}

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">{label}</div>
      <div className="mt-1 break-words text-sm text-gray-700">{value ?? '—'}</div>
    </div>
  );
}

function BestRecipeCard({ summary }: { summary: BreakoutRecipeSummary }) {
  const badgeLines = buildBestRecipeBadge(summary);

  return (
    <Card className="border border-[#e2640d]/20 bg-gradient-to-r from-[#fff7f1] to-white shadow-sm">
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-[#e2640d] text-white">Best Recipe</Badge>
            {badgeLines.slice(1).map((line) => (
              <Badge key={line} variant="secondary" className="border-0 bg-[#e2640d]/10 text-[#e2640d]">
                {line}
              </Badge>
            ))}
          </div>
          <div className="text-lg font-semibold text-gray-900">{summary.bestRecipeName}</div>
          <div className="mt-1 text-sm text-gray-500">
            {summary.summary ?? 'Signal-Validation-Model promoted this recipe as the current WR breakout leader.'}
          </div>
          <div className="mt-2 max-w-2xl text-xs leading-5 text-gray-500">
            This recipe comes from retrospective Signal-Validation-Model validation. TIBER is showing the promoted upstream result for operator review and is not deriving the recipe locally.
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm md:min-w-[220px]">
          <div className="rounded-md bg-[#fafafa] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Season</div>
            <div className="mt-1 font-mono text-gray-700">{summary.season ?? '—'}</div>
          </div>
          <div className="rounded-md bg-[#fafafa] px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Candidates</div>
            <div className="mt-1 font-mono text-gray-700">{summary.candidateCount ?? '—'}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  title = 'WR Breakout Lab unavailable',
  message,
  hints,
}: {
  title?: string;
  message: string;
  hints?: string[];
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-[#fafafa] px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
        <FlaskConical className="h-5 w-5 text-[#e2640d]" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-gray-500">{message}</p>
      {hints?.length ? (
        <div className="mx-auto mt-5 max-w-2xl rounded-lg border border-gray-200 bg-white p-4 text-left">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Operator hints</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
            {hints.map((hint) => (
              <li key={hint} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-[#e2640d]" aria-hidden />
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-[#e2640d]/30 bg-[#fff7f1] text-[#c25510]'
          : 'border-gray-200 bg-white text-gray-600 hover:border-[#e2640d]/30 hover:text-[#c25510]'
      }`}
    >
      {children}
    </button>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction: BreakoutSignalSortState['direction'] }) {
  if (!active) {
    return <ArrowDown className="h-3.5 w-3.5 text-gray-300" />;
  }

  return direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-[#e2640d]" /> : <ArrowDown className="h-3.5 w-3.5 text-[#e2640d]" />;
}

export function BreakoutSignalsView({
  season,
  availableSeasons,
  rows,
  bestRecipeSummary,
  isLoading,
  errorMessage,
  errorCode,
  initialPlayerContext = null,
  onSeasonChange,
}: BreakoutSignalsViewProps) {
  const initialSearch = initialPlayerContext?.playerName ?? initialPlayerContext?.playerId ?? '';
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(initialPlayerContext?.playerId ?? null);
  const [sortState, setSortState] = useState<BreakoutSignalSortState>(DEFAULT_BREAKOUT_SORT);
  const [filters, setFilters] = useState<BreakoutSignalQuickFilters>(DEFAULT_BREAKOUT_FILTERS);

  const filteredRows = useMemo(() => {
    const searchedRows = filterBreakoutSignalRows(rows, {
      searchQuery,
      filters,
    });

    return sortBreakoutSignalRows(searchedRows, sortState);
  }, [filters, rows, searchQuery, sortState]);

  const stateHints = useMemo(() => getBreakoutSignalsStateHints(errorCode ? { success: false, error: errorMessage ?? '', code: errorCode } : null), [errorCode, errorMessage]);

  const hasActiveQuickFilter =
    filters.topN !== DEFAULT_BREAKOUT_FILTERS.topN
    || filters.breakoutOnly !== DEFAULT_BREAKOUT_FILTERS.breakoutOnly
    || filters.highRoleOnly !== DEFAULT_BREAKOUT_FILTERS.highRoleOnly
    || filters.highCohortOnly !== DEFAULT_BREAKOUT_FILTERS.highCohortOnly;

  const activePlayerContext = useMemo<DataLabPlayerCarryContext | null>(() => {
    const expandedRow = rows.find((row) => (row.playerId ?? row.playerName) === expandedPlayer || row.playerId === expandedPlayer);
    if (expandedRow) {
      return {
        playerId: expandedRow.playerId ?? null,
        playerName: expandedRow.playerName ?? null,
      };
    }

    if (initialPlayerContext?.playerId || initialPlayerContext?.playerName) {
      return initialPlayerContext;
    }

    if (!searchQuery.trim()) {
      return null;
    }

    const exactNameMatch = rows.find((row) => row.playerName.toLowerCase() === searchQuery.trim().toLowerCase());
    if (exactNameMatch) {
      return {
        playerId: exactNameMatch.playerId ?? null,
        playerName: exactNameMatch.playerName ?? null,
      };
    }

    return {
      playerId: null,
      playerName: searchQuery.trim(),
    };
  }, [expandedPlayer, initialPlayerContext, rows, searchQuery]);

  const updateSort = (key: BreakoutSignalSortState['key']) => {
    setSortState((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        key,
        direction: key === 'playerName' || key === 'bestRecipeName' || key === 'breakoutLabelDefault' ? 'asc' : 'desc',
      };
    });
  };

  return (
    <div className="mx-auto min-h-screen max-w-[1460px] bg-white px-6 py-8">
      <div className="mb-6">
        <Link href="/tiber-data-lab" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-[#e2640d]">
          <ArrowLeft className="h-4 w-4" />
          Data Lab
        </Link>

        <div className="mb-1 flex flex-wrap items-center gap-3">
          <FlaskConical className="h-6 w-6 text-[#e2640d]" />
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
            WR Breakout Lab
          </h1>
          <Badge className="border-0 bg-gray-900 text-white">Promoted module</Badge>
          <Badge variant="secondary" className="border-0 bg-gray-100 text-gray-600">Read only</Badge>
        </div>
        <p className="max-w-3xl text-sm text-gray-500">
          Promoted Signal-Validation-Model outputs rendered inside TIBER Data Lab. This module is for validating breakout candidates and recipe context, not for recomputing scores.
        </p>
      </div>

      <Card className="mb-6 border border-[#e2640d]/15 bg-gradient-to-r from-[#fff7f1] to-white shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <Badge className="border-0 bg-[#e2640d] text-white">Breakout validation</Badge>
              <span>Upstream export → adapter → read-only product table</span>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-gray-600">
              <span className="font-semibold text-gray-700">When to use this:</span> Start here when you need a concise breakout screen, then move to Role &amp; Opportunity for deployment context or ARC for developmental timing.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm md:min-w-[280px] md:grid-cols-2">
            <div className="rounded-md bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Season</div>
              <div className="mt-1 text-gray-700">{season}</div>
            </div>
            <div className="rounded-md bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">System posture</div>
              <div className="mt-1 text-gray-700">Promoted · read only</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <PromotedModuleSystemCard currentModuleId="breakout-signals" playerContext={activePlayerContext} />
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={season} onValueChange={onSeasonChange}>
              <SelectTrigger className="w-[120px] border-gray-200 bg-[#f4f4f4]">
                <SelectValue placeholder="Season" />
              </SelectTrigger>
              <SelectContent>
                {availableSeasons.map((availableSeason) => (
                  <SelectItem key={availableSeason} value={String(availableSeason)}>
                    {availableSeason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="rounded-md border border-gray-200 bg-[#fafafa] px-3 py-2 text-xs text-gray-500">
              <span className="font-semibold text-gray-700">Model contract:</span> Signal-Validation-Model export → TIBER adapter → Data Lab table
            </div>
            {activePlayerContext?.playerName ? (
              <div className="rounded-md border border-[#e2640d]/20 bg-[#fff7f1] px-3 py-2 text-xs text-[#9a4a12]">
                Carrying player context for <span className="font-semibold">{activePlayerContext.playerName}</span> across related modules.
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              active={filters.topN === 10}
              onClick={() => setFilters((current) => ({ ...current, topN: current.topN === 10 ? 'all' : 10 }))}
            >
              Top 10
            </FilterChip>
            <FilterChip
              active={filters.topN === 25}
              onClick={() => setFilters((current) => ({ ...current, topN: current.topN === 25 ? 'all' : 25 }))}
            >
              Top 25
            </FilterChip>
            <FilterChip
              active={filters.breakoutOnly}
              onClick={() => setFilters((current) => ({ ...current, breakoutOnly: !current.breakoutOnly }))}
            >
              Breakout label present
            </FilterChip>
            <FilterChip
              active={filters.highRoleOnly}
              onClick={() => setFilters((current) => ({ ...current, highRoleOnly: !current.highRoleOnly }))}
            >
              High role signal
            </FilterChip>
            <FilterChip
              active={filters.highCohortOnly}
              onClick={() => setFilters((current) => ({ ...current, highCohortOnly: !current.highCohortOnly }))}
            >
              High cohort signal
            </FilterChip>
            {hasActiveQuickFilter ? (
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_BREAKOUT_FILTERS)}
                className="rounded-full border border-transparent px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-[#c25510]"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
        <div className="w-full max-w-sm">
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Player search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search player, team, recipe..."
              className="w-full rounded-md border border-gray-200 bg-[#f4f4f4] py-2 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#e2640d]/30"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-[#fafafa] p-4 text-sm text-gray-500">
            Loading promoted Signal-Validation-Model exports for season {season}. TIBER is only reading the published snapshot and will not recompute scores here.
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-[420px] w-full rounded-xl" />
        </div>
      ) : errorMessage ? (
        <EmptyState message={errorMessage} hints={stateHints} />
      ) : !bestRecipeSummary ? (
        <EmptyState
          message="The export loaded without a usable best-recipe summary, so TIBER is holding the module back. The table stays read-only and hidden until the promoted summary contract is valid again."
          hints={[
            'Check wr_best_recipe_summary.json in the promoted export package.',
            'TIBER is intentionally refusing to infer or synthesize a local recipe summary.',
          ]}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="WR Breakout Lab ready, but empty"
          message="The selected export is valid, but it currently contains no WR candidates to display. TIBER is preserving the read-only upstream result instead of generating placeholder cards."
          hints={[
            'Confirm the promoted CSV contains candidate rows for the selected season.',
            'If the export is intentionally empty, no local fallback or rescoring will run in this module.',
          ]}
        />
      ) : (
        <div className="space-y-4">
          <BestRecipeCard summary={bestRecipeSummary} />

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#fafafa]">
                  <tr>
                    {BREAKOUT_SIGNAL_COLUMNS.map((column) => {
                      const active = sortState.key === column.key;
                      return (
                        <th
                          key={column.key}
                          className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500"
                        >
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-[#c25510]"
                            onClick={() => updateSort(column.key)}
                          >
                            <span>{column.label}</span>
                            <SortIcon active={active} direction={sortState.direction} />
                          </button>
                        </th>
                      );
                    })}
                    <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Detail
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredRows.map((row) => {
                    const detailKey = row.playerId ?? row.playerName;
                    const isExpanded = expandedPlayer === detailKey;
                    const detailSections = buildBreakoutDetailSections(row);
                    return (
                      <Fragment key={detailKey}>
                        <tr className="align-top hover:bg-[#fffaf6]">
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{row.candidateRank ?? '—'}</td>
                          <td className="px-3 py-3">
                            <div className="font-semibold text-gray-900">{row.playerName}</div>
                            <div className="text-xs text-gray-400">{row.team ?? '—'} · {row.season ?? '—'}</div>
                          </td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{formatSignalValue(row.finalSignalScore)}</td>
                          <td className="px-3 py-3 text-sm text-gray-700">{row.bestRecipeName ?? '—'}</td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{formatSignalValue(row.components.usage)}</td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{formatSignalValue(row.components.efficiency)}</td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{formatSignalValue(row.components.development)}</td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{formatSignalValue(row.components.stability)}</td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{formatSignalValue(row.components.cohort)}</td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{formatSignalValue(row.components.role)}</td>
                          <td className="px-3 py-3 font-mono text-sm text-gray-700">{formatSignalValue(row.components.penalty)}</td>
                          <td className="px-3 py-3 text-sm text-gray-700">
                            <div>{row.breakoutLabelDefault ?? '—'}</div>
                            {row.breakoutContext ? (
                              <div className="mt-1 max-w-xs text-xs text-gray-400">{row.breakoutContext}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:border-[#e2640d]/40 hover:text-[#e2640d]"
                              onClick={() => setExpandedPlayer(isExpanded ? null : detailKey)}
                            >
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              {isExpanded ? 'Hide detail' : 'Open detail'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr className="bg-[#fcfcfc]">
                            <td colSpan={BREAKOUT_SIGNAL_COLUMNS.length + 1} className="px-4 py-4">
                              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Promoted signal card detail</div>
                                  <div className="mt-1 text-sm text-gray-500">Grouped for review so operators can scan ranking, breakout context, and raw metadata without a single undifferentiated field wall.</div>
                                </div>
                                <Badge variant="secondary" className="border-0 bg-gray-100 text-gray-600">Read-only export detail</Badge>
                              </div>
                              <div className="mb-4">
                                <PromotedModuleSystemCard
                                  currentModuleId="breakout-signals"
                                  playerContext={{ playerId: row.playerId ?? null, playerName: row.playerName }}
                                  heading="Related modules"
                                  description="Use this player carry-through to inspect whether deployment context or developmental timing supports the breakout case."
                                />
                              </div>
                              <div className="grid gap-4 xl:grid-cols-2">
                                {detailSections.map((section) => (
                                  <div key={section.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{section.title}</div>
                                    <div className="mt-1 text-sm text-gray-500">{section.description}</div>
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                      {section.fields.map((field) => (
                                        <DetailField key={`${section.id}-${field.label}-${field.value ?? 'empty'}`} label={field.label} value={field.value} />
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredRows.length === 0 ? (
              <div className="border-t border-gray-100 bg-[#fafafa] px-4 py-6 text-sm text-gray-500">
                No exported WR signal cards match the current search/filter selection. Adjust the quick filters or search text; TIBER will only display rows present in the promoted export.
              </div>
            ) : (
              <div className="border-t border-gray-100 bg-[#fafafa] px-4 py-3 text-xs text-gray-500">
                Showing {filteredRows.length} of {rows.length} exported WR signal cards. Sorts and filters are client-side for operator review only; underlying Signal-Validation-Model values remain unchanged.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
