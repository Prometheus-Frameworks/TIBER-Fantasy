import { Fragment, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ChevronUp, Database, Search, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PromotedModuleSystemCard } from '@/components/data-lab/PromotedModuleSystemCard';
import { DataLabPlayerCarryContext } from '@/lib/dataLabPromotedModules';
import {
  AGE_CURVE_COLUMNS,
  AgeCurveLabApiError,
  AgeCurveLabRow,
  AgeCurveSortState,
  DEFAULT_AGE_CURVE_SORT,
  buildAgeCurveDetailSections,
  filterAgeCurveRows,
  formatAge,
  formatDelta,
  formatPpg,
  getAgeCurveStateHints,
  sortAgeCurveRows,
} from '@/lib/ageCurves';

interface AgeCurvesViewProps {
  season: string;
  availableSeasons: number[];
  rows: AgeCurveLabRow[];
  isLoading: boolean;
  error?: AgeCurveLabApiError | null;
  sourceProvider?: string | null;
  sourceMode?: 'api' | 'artifact' | null;
  defaultExpandedPlayerKey?: string | null;
  initialPlayerContext?: DataLabPlayerCarryContext | null;
  onSeasonChange: (season: string) => void;
}

function buildRowKey(row: AgeCurveLabRow) {
  return row.playerId ?? `${row.playerName}-${row.season ?? 'na'}-${row.team ?? 'na'}`;
}

function EmptyState({ title, message, hints }: { title: string; message: string; hints?: string[] }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-[#fafafa] px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
        <Database className="h-5 w-5 text-[#7c3aed]" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-gray-500">{message}</p>
      {hints?.length ? (
        <div className="mx-auto mt-5 max-w-2xl rounded-lg border border-gray-200 bg-white p-4 text-left">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Operator hints</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
            {hints.map((hint) => (
              <li key={hint} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-[#7c3aed]" aria-hidden />
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction: AgeCurveSortState['direction'] }) {
  if (!active) {
    return <ArrowDown className="h-3.5 w-3.5 text-gray-300" />;
  }

  return direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-[#7c3aed]" /> : <ArrowDown className="h-3.5 w-3.5 text-[#7c3aed]" />;
}

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">{label}</div>
      <div className="mt-1 break-words text-sm text-gray-700">{value ?? '—'}</div>
    </div>
  );
}

function DeltaChip({ value }: { value: number | null }) {
  const positive = (value ?? 0) > 0;
  const negative = (value ?? 0) < 0;

  return (
    <span
      className={[
        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
        positive ? 'bg-emerald-50 text-emerald-700' : '',
        negative ? 'bg-rose-50 text-rose-700' : '',
        !positive && !negative ? 'bg-gray-100 text-gray-600' : '',
      ].join(' ')}
    >
      {formatDelta(value)}
    </span>
  );
}

function ExpectedActualBars({ expected, actual }: { expected: number | null; actual: number | null }) {
  const max = Math.max(expected ?? 0, actual ?? 0, 1);
  const expectedWidth = `${Math.max(((expected ?? 0) / max) * 100, 6)}%`;
  const actualWidth = `${Math.max(((actual ?? 0) / max) * 100, 6)}%`;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <TrendingUp className="h-4 w-4 text-[#7c3aed]" />
        Expected vs actual scoring
      </div>
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>Expected PPG</span>
            <span>{formatPpg(expected)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-[#f3e8ff]">
            <div className="h-2.5 rounded-full bg-[#a855f7]" style={{ width: expectedWidth }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>Actual PPG</span>
            <span>{formatPpg(actual)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-[#ede9fe]">
            <div className="h-2.5 rounded-full bg-[#7c3aed]" style={{ width: actualWidth }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgeCurvesView({
  season,
  availableSeasons,
  rows,
  isLoading,
  error,
  sourceProvider,
  sourceMode,
  defaultExpandedPlayerKey = null,
  initialPlayerContext = null,
  onSeasonChange,
}: AgeCurvesViewProps) {
  const initialSearch = initialPlayerContext?.playerName ?? initialPlayerContext?.playerId ?? '';
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [expandedPlayerKey, setExpandedPlayerKey] = useState<string | null>(defaultExpandedPlayerKey ?? initialPlayerContext?.playerId ?? null);
  const [sortState, setSortState] = useState<AgeCurveSortState>(DEFAULT_AGE_CURVE_SORT);

  const teams = useMemo(() => Array.from(new Set(rows.map((row) => row.team).filter(Boolean) as string[])).sort(), [rows]);
  const positions = useMemo(() => Array.from(new Set(rows.map((row) => row.position).filter(Boolean) as string[])).sort(), [rows]);

  const filteredRows = useMemo(() => {
    const filtered = filterAgeCurveRows(rows, {
      searchQuery,
      team: teamFilter,
      position: positionFilter,
    });

    return sortAgeCurveRows(filtered, sortState);
  }, [positionFilter, rows, searchQuery, sortState, teamFilter]);

  const hints = useMemo(() => getAgeCurveStateHints(error ?? null), [error]);

  const activePlayerContext = useMemo<DataLabPlayerCarryContext | null>(() => {
    const expandedRow = rows.find((row) => buildRowKey(row) === expandedPlayerKey || row.playerId === expandedPlayerKey);
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
  }, [expandedPlayerKey, initialPlayerContext, rows, searchQuery]);

  const updateSort = (key: AgeCurveSortState['key']) => {
    setSortState((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        key,
        direction: key === 'playerName' || key === 'team' || key === 'trajectoryLabel' ? 'asc' : 'desc',
      };
    });
  };

  return (
    <div className="mx-auto min-h-screen max-w-[1460px] bg-white px-6 py-8">
      <div className="mb-6">
        <Link href="/tiber-data-lab" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-[#7c3aed]">
          <ArrowLeft className="h-4 w-4" />
          Data Lab
        </Link>

        <div className="mb-1 flex flex-wrap items-center gap-3">
          <Database className="h-6 w-6 text-[#7c3aed]" />
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
            Age Curve / ARC Lab
          </h1>
          <Badge className="border-0 bg-gray-900 text-white">Promoted module</Badge>
          <Badge variant="secondary" className="border-0 bg-gray-100 text-gray-600">Read only</Badge>
        </div>
        <p className="max-w-3xl text-sm text-gray-500">
          Developmental context promoted into TIBER Data Lab for inspection. This module is for age-and-career-stage framing, not for predicting by itself.
        </p>
      </div>

      <Card className="mb-6 border border-[#7c3aed]/15 bg-gradient-to-r from-[#faf5ff] to-white shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <Badge className="border-0 bg-[#7c3aed] text-white">Developmental framing</Badge>
              <span>Upstream ARC output → adapter → read-only product table</span>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-gray-600">
              <span className="font-semibold text-gray-700">When to use this:</span> Open ARC when you need developmental timing and expected-vs-actual context to confirm or challenge what the breakout and role modules are saying.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm md:min-w-[280px] md:grid-cols-2">
            <div className="rounded-md bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Season</div>
              <div className="mt-1 text-gray-700">{season}</div>
            </div>
            <div className="rounded-md bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Source</div>
              <div className="mt-1 text-gray-700">{sourceProvider ?? '—'}{sourceMode ? ` · ${sourceMode}` : ''}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <PromotedModuleSystemCard currentModuleId="age-curves" playerContext={activePlayerContext} />
      </div>

      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-4">
          <Select value={season} onValueChange={onSeasonChange}>
            <SelectTrigger className="border-gray-200 bg-[#f4f4f4]">
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

          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="border-gray-200 bg-[#f4f4f4]">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All teams</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team} value={team}>{team}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="border-gray-200 bg-[#f4f4f4]">
              <SelectValue placeholder="Position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All positions</SelectItem>
              {positions.map((position) => (
                <SelectItem key={position} value={position}>{position}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search player, bucket, or trajectory"
              className="border-gray-200 bg-[#f4f4f4] pl-10"
            />
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 text-xs text-gray-500 xl:items-end">
          {activePlayerContext?.playerName ? (
            <div className="rounded-md border border-[#7c3aed]/20 bg-[#faf5ff] px-3 py-2 text-[#7c3aed]">
              Carrying player context for <span className="font-semibold">{activePlayerContext.playerName}</span>.
            </div>
          ) : null}
          <div>
            Showing <span className="font-semibold text-gray-700">{filteredRows.length}</span> of <span className="font-semibold text-gray-700">{rows.length}</span> promoted rows.
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error ? (
        <EmptyState title="Age Curve Lab unavailable" message={error.error} hints={hints} />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? 'Age Curve Lab ready, but empty' : 'No rows match the active filters'}
          message={
            rows.length === 0
              ? 'The promoted ARC dataset returned a valid empty result set, so TIBER is preserving that state without inventing fallback context.'
              : 'Try widening the player search, team filter, or position filter to inspect more promoted rows.'
          }
          hints={hints}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead className="bg-[#fafafa] text-left">
              <tr>
                <th className="w-[48px] px-4 py-3" />
                {AGE_CURVE_COLUMNS.map((column) => (
                  <th key={column.key} className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                    <button type="button" className="inline-flex items-center gap-1.5" onClick={() => updateSort(column.key)}>
                      <span>{column.label}</span>
                      <SortIcon active={sortState.key === column.key} direction={sortState.direction} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const rowKey = buildRowKey(row);
                const expanded = expandedPlayerKey === rowKey;
                const detailSections = buildAgeCurveDetailSections(row);

                return (
                  <Fragment key={rowKey}>
                    <tr className="border-t border-gray-200 align-top">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          aria-label={expanded ? `Collapse ${row.playerName}` : `Expand ${row.playerName}`}
                          className="rounded-md border border-gray-200 p-1.5 text-gray-500 transition-colors hover:border-[#7c3aed]/30 hover:text-[#7c3aed]"
                          onClick={() => setExpandedPlayerKey(expanded ? null : rowKey)}
                        >
                          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.playerName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.team ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatAge(row.age)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.careerYear ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatPpg(row.expectedPpg)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatPpg(row.actualPpg)}</td>
                      <td className="px-4 py-3 text-sm"><DeltaChip value={row.ppgDelta} /></td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.trajectoryLabel ?? '—'}</td>
                    </tr>
                    {expanded ? (
                      <tr className="border-t border-dashed border-gray-200 bg-[#fcfcfc]">
                        <td colSpan={9} className="px-6 py-5">
                          <div className="mb-4">
                            <PromotedModuleSystemCard
                              currentModuleId="age-curves"
                              playerContext={{ playerId: row.playerId ?? null, playerName: row.playerName }}
                              heading="Related modules"
                              description="Use this player carry-through to compare developmental timing with breakout validation and current deployment context."
                            />
                          </div>
                          <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
                            <div className="grid gap-4 xl:grid-cols-3">
                              {detailSections.slice(0, 3).map((section) => (
                                <div key={section.id} className="rounded-lg border border-gray-200 bg-white p-4">
                                  <div className="mb-3 text-sm font-semibold text-gray-900">{section.title}</div>
                                  <div className="grid gap-2">
                                    {section.fields.map((field) => (
                                      <DetailField key={`${section.id}-${field.label}`} label={field.label} value={field.value} />
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <ExpectedActualBars expected={row.expectedPpg} actual={row.actualPpg} />
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-white p-4">
                            <div className="mb-3 text-sm font-semibold text-gray-900">{detailSections[3].title}</div>
                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                              {detailSections[3].fields.map((field) => (
                                <DetailField key={`raw-${field.label}`} label={field.label} value={field.value} />
                              ))}
                            </div>
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
      )}
    </div>
  );
}
