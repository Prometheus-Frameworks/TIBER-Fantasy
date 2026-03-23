import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowDown, ArrowLeft, ArrowUp, Database, PanelRightOpen, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PromotedModuleSystemCard } from '@/components/data-lab/PromotedModuleSystemCard';
import { PromotedModuleStateCard } from '@/components/data-lab/PromotedModuleStateCard';
import { DataLabPlayerCarryContext, formatPromotedModuleProvenance } from '@/lib/dataLabPromotedModules';
import {
  DEFAULT_POINT_SCENARIO_SORT,
  POINT_SCENARIO_COLUMNS,
  PointScenarioLabApiError,
  PointScenarioLabRow,
  PointScenarioSortState,
  buildPointScenarioDetailSections,
  buildPointScenarioRowKey,
  filterPointScenarioRows,
  formatConfidence,
  formatDelta,
  formatProjection,
  getPointScenarioStateHints,
  sortPointScenarioRows,
} from '@/lib/pointScenarios';

interface PointScenariosViewProps {
  season: string;
  availableSeasons: number[];
  rows: PointScenarioLabRow[];
  isLoading: boolean;
  error?: PointScenarioLabApiError | null;
  sourceProvider?: string | null;
  sourceMode?: 'api' | 'artifact' | null;
  sourceLocation?: string | null;
  defaultSelectedScenarioKey?: string | null;
  initialPlayerContext?: DataLabPlayerCarryContext | null;
  onSeasonChange: (season: string) => void;
}

function SortIcon({ active, direction }: { active: boolean; direction: PointScenarioSortState['direction'] }) {
  if (!active) {
    return <ArrowDown className="h-3.5 w-3.5 text-gray-300" />;
  }

  return direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-[#2563eb]" /> : <ArrowDown className="h-3.5 w-3.5 text-[#2563eb]" />;
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

export function PointScenariosView({
  season,
  availableSeasons,
  rows,
  isLoading,
  error,
  sourceProvider,
  sourceMode,
  sourceLocation,
  defaultSelectedScenarioKey = null,
  initialPlayerContext = null,
  onSeasonChange,
}: PointScenariosViewProps) {
  const initialSearch = initialPlayerContext?.playerName ?? initialPlayerContext?.playerId ?? '';
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');
  const [sortState, setSortState] = useState<PointScenarioSortState>(DEFAULT_POINT_SCENARIO_SORT);
  const [selectedScenarioKey, setSelectedScenarioKey] = useState<string>(defaultSelectedScenarioKey ?? '');

  const eventTypes = useMemo(() => Array.from(new Set(rows.map((row) => row.eventType).filter(Boolean) as string[])).sort(), [rows]);
  const filteredRows = useMemo(() => {
    const filtered = filterPointScenarioRows(rows, { searchQuery, eventType: eventTypeFilter });
    return sortPointScenarioRows(filtered, sortState);
  }, [eventTypeFilter, rows, searchQuery, sortState]);
  const hints = useMemo(() => getPointScenarioStateHints(error ?? null), [error]);
  const provenanceLabel = useMemo(
    () => formatPromotedModuleProvenance({
      provider: sourceProvider,
      mode: sourceMode,
      location: sourceLocation ?? null,
    }),
    [sourceLocation, sourceMode, sourceProvider],
  );

  const selectedRow = useMemo(() => {
    if (!selectedScenarioKey) {
      return null;
    }

    return rows.find((row) => buildPointScenarioRowKey(row) === selectedScenarioKey) ?? null;
  }, [filteredRows, rows, selectedScenarioKey]);

  const activePlayerContext = useMemo<DataLabPlayerCarryContext | null>(() => {
    if (selectedRow) {
      return {
        playerId: selectedRow.playerId ?? null,
        playerName: selectedRow.playerName,
        season,
      };
    }

    if (initialPlayerContext?.playerId || initialPlayerContext?.playerName) {
      return {
        ...initialPlayerContext,
        season: initialPlayerContext.season ?? season,
      };
    }

    if (!searchQuery.trim()) {
      return null;
    }

    const exactNameMatch = rows.find((row) => row.playerName.toLowerCase() === searchQuery.trim().toLowerCase());
    if (exactNameMatch) {
      return {
        playerId: exactNameMatch.playerId ?? null,
        playerName: exactNameMatch.playerName,
        season,
      };
    }

    return {
      playerId: null,
      playerName: searchQuery.trim(),
      season,
    };
  }, [initialPlayerContext, rows, searchQuery, season, selectedRow]);

  const summary = useMemo(() => {
    if (!filteredRows.length) {
      return { count: 0, avgDelta: null as number | null, positiveCount: 0 };
    }

    const deltas = filteredRows.map((row) => row.delta).filter((value): value is number => value != null);
    return {
      count: filteredRows.length,
      avgDelta: deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : null,
      positiveCount: deltas.filter((value) => value > 0).length,
    };
  }, [filteredRows]);

  const updateSort = (key: PointScenarioSortState['key']) => {
    setSortState((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        key,
        direction: key === 'playerName' || key === 'scenarioName' || key === 'confidence' ? 'asc' : 'desc',
      };
    });
  };

  return (
    <div className="mx-auto min-h-screen max-w-[1480px] bg-white px-6 py-8">
      <div className="mb-6">
        <Link href="/tiber-data-lab" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-[#2563eb]">
          <ArrowLeft className="h-4 w-4" />
          Data Lab
        </Link>

        <div className="mb-1 flex flex-wrap items-center gap-3">
          <Database className="h-6 w-6 text-[#2563eb]" />
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
            Point Scenario Lab
          </h1>
          <Badge className="border-0 bg-gray-900 text-white">Promoted module</Badge>
          <Badge variant="secondary" className="border-0 bg-gray-100 text-gray-600">Read only</Badge>
        </div>
        <p className="max-w-3xl text-sm text-gray-500">
          Scenario-based point outcome context promoted into TIBER Data Lab for inspection. This module is for stress-testing projection outcomes, not for publishing final weekly rankings.
        </p>
      </div>

      <Card className="mb-6 border border-[#2563eb]/15 bg-gradient-to-r from-[#eff6ff] to-white shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <Badge className="border-0 bg-[#2563eb] text-white">Scenario analysis</Badge>
              <span>Point-prediction-Model output → adapter → read-only product table</span>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-gray-600">
              <span className="font-semibold text-gray-700">What this lab is for:</span> Open this module when you need to inspect how specific events or assumptions move a player's point outlook without turning TIBER into a scenario authoring tool.
            </p>
            <p className="max-w-3xl text-sm leading-6 text-gray-600">
              <span className="font-semibold text-gray-700">Important framing:</span> Treat this as scenario analysis and contingency context. It is not the final ranking page and it does not replace your baseline rankings workflow.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm md:min-w-[320px] md:grid-cols-3">
            <div className="rounded-md bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Scenarios</div>
              <div className="mt-1 text-gray-700">{summary.count}</div>
            </div>
            <div className="rounded-md bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Avg delta</div>
              <div className="mt-1 text-gray-700">{formatDelta(summary.avgDelta)}</div>
            </div>
            <div className="rounded-md bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Provenance</div>
              <div className="mt-1 text-gray-700">{provenanceLabel}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <PromotedModuleSystemCard
          currentModuleId="point-scenarios"
          playerContext={activePlayerContext}
          description="Jump across the promoted Data Lab modules to compare scenario-based point outcomes with breakout validation, usage context, and developmental timing."
        />
      </div>

      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
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

          <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
            <SelectTrigger className="border-gray-200 bg-[#f4f4f4]">
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All event types</SelectItem>
              {eventTypes.map((eventType) => (
                <SelectItem key={eventType} value={eventType}>{eventType}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search player, scenario, or explanation"
              className="border-gray-200 bg-[#f4f4f4] pl-10"
            />
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 text-xs text-gray-500 xl:items-end">
          {activePlayerContext?.playerName ? (
            <div className="rounded-md border border-[#2563eb]/20 bg-[#eff6ff] px-3 py-2 text-[#2563eb]">
              Carrying player context for <span className="font-semibold">{activePlayerContext.playerName}</span>.
            </div>
          ) : null}
          <div>
            Showing <span className="font-semibold text-gray-700">{filteredRows.length}</span> of <span className="font-semibold text-gray-700">{rows.length}</span> promoted rows.
          </div>
        </div>
      </div>

      {isLoading ? (
        <PromotedModuleStateCard
          icon={Database}
          accentClassName="bg-[#eff6ff]"
          accentTextClassName="text-[#2563eb]"
          title="Loading Point Scenario Lab"
          message={`Loading promoted point-scenario output for season ${season}. TIBER is preserving scenario context as read-only model output.`}
          mode="loading"
        />
      ) : error ? (
        <PromotedModuleStateCard
          icon={Database}
          accentClassName="bg-[#eff6ff]"
          accentTextClassName="text-[#2563eb]"
          title="Point Scenario Lab unavailable"
          message={error.error}
          hints={hints}
          mode="error"
        />
      ) : filteredRows.length === 0 ? (
        <PromotedModuleStateCard
          icon={Database}
          accentClassName="bg-[#eff6ff]"
          accentTextClassName="text-[#2563eb]"
          title={rows.length === 0 ? 'Point Scenario Lab ready, but empty' : 'No rows match the active filters'}
          message={
            rows.length === 0
              ? 'The promoted point-scenario dataset returned a valid empty result set, so TIBER is preserving that state without inventing fallback context.'
              : 'Try widening the search query or clearing the event-type filter to inspect more promoted rows.'
          }
          hints={hints}
          mode="empty"
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full border-collapse">
              <thead className="bg-[#fafafa] text-left">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Open</th>
                  {POINT_SCENARIO_COLUMNS.map((column) => (
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
                  const rowKey = buildPointScenarioRowKey(row);
                  const selected = selectedRow ? buildPointScenarioRowKey(selectedRow) === rowKey : false;

                  return (
                    <tr key={rowKey} className={`border-t border-gray-200 align-top ${selected ? 'bg-[#f8fbff]' : 'bg-white'}`}>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          aria-label={`Open scenario drawer for ${row.playerName}`}
                          className="rounded-md border border-gray-200 p-1.5 text-gray-500 transition-colors hover:border-[#2563eb]/30 hover:text-[#2563eb]"
                          onClick={() => setSelectedScenarioKey(rowKey)}
                        >
                          <PanelRightOpen className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.playerName}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.scenarioName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatProjection(row.baselineProjection)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatProjection(row.adjustedProjection)}</td>
                      <td className="px-4 py-3 text-sm"><DeltaChip value={row.delta} /></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatConfidence(row.confidence)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="xl:sticky xl:top-6">
            {selectedRow ? (
              <div className="rounded-xl border border-gray-200 bg-[#fafafa] p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Detail drawer</div>
                    <h2 className="mt-1 text-lg font-semibold text-gray-900">{selectedRow.playerName}</h2>
                    <p className="mt-1 text-sm text-gray-500">{selectedRow.scenarioName}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 transition-colors hover:border-[#2563eb]/30 hover:text-[#2563eb]"
                    onClick={() => setSelectedScenarioKey('')}
                    aria-label="Close detail drawer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-4">
                  <PromotedModuleSystemCard
                    currentModuleId="point-scenarios"
                    playerContext={{ playerId: selectedRow.playerId ?? null, playerName: selectedRow.playerName }}
                    heading="Related modules"
                    description="Use this carry-through to compare scenario-based point movement with breakout validation, role context, and ARC timing."
                  />
                </div>

                <div className="space-y-4">
                  {buildPointScenarioDetailSections(selectedRow).map((section) => (
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
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
