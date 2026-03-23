import { Fragment, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ChevronUp, Database, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PromotedModuleSystemCard } from '@/components/data-lab/PromotedModuleSystemCard';
import { PromotedModuleStateCard } from '@/components/data-lab/PromotedModuleStateCard';
import { DataLabPlayerCarryContext, formatPromotedModuleProvenance } from '@/lib/dataLabPromotedModules';
import {
  DEFAULT_ROLE_OPPORTUNITY_SORT,
  ROLE_OPPORTUNITY_COLUMNS,
  RoleOpportunityLabApiError,
  RoleOpportunityLabRow,
  RoleOpportunitySortState,
  buildRoleOpportunityDetailSections,
  filterRoleOpportunityRows,
  formatConfidence,
  formatPercent,
  getRoleOpportunityStateHints,
  sortRoleOpportunityRows,
} from '@/lib/roleOpportunity';

interface RoleOpportunityViewProps {
  season: string;
  availableSeasons: number[];
  rows: RoleOpportunityLabRow[];
  isLoading: boolean;
  error?: RoleOpportunityLabApiError | null;
  sourceProvider?: string | null;
  sourceMode?: 'api' | 'artifact' | null;
  sourceLocation?: string | null;
  scopeLabel?: string | null;
  defaultExpandedPlayerId?: string | null;
  initialPlayerContext?: DataLabPlayerCarryContext | null;
  onSeasonChange: (season: string) => void;
}

function SortIcon({ active, direction }: { active: boolean; direction: RoleOpportunitySortState['direction'] }) {
  if (!active) {
    return <ArrowDown className="h-3.5 w-3.5 text-gray-300" />;
  }

  return direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-[#0f766e]" /> : <ArrowDown className="h-3.5 w-3.5 text-[#0f766e]" />;
}

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">{label}</div>
      <div className="mt-1 break-words text-sm text-gray-700">{value ?? '—'}</div>
    </div>
  );
}

export function RoleOpportunityView({
  season,
  availableSeasons,
  rows,
  isLoading,
  error,
  sourceProvider,
  sourceMode,
  sourceLocation,
  scopeLabel,
  defaultExpandedPlayerId = null,
  initialPlayerContext = null,
  onSeasonChange,
}: RoleOpportunityViewProps) {
  const initialSearch = initialPlayerContext?.playerName ?? initialPlayerContext?.playerId ?? '';
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(defaultExpandedPlayerId ?? initialPlayerContext?.playerId ?? null);
  const [sortState, setSortState] = useState<RoleOpportunitySortState>(DEFAULT_ROLE_OPPORTUNITY_SORT);

  const teams = useMemo(() => Array.from(new Set(rows.map((row) => row.team))).sort(), [rows]);
  const positions = useMemo(() => Array.from(new Set(rows.map((row) => row.position))).sort(), [rows]);

  const filteredRows = useMemo(() => {
    const filtered = filterRoleOpportunityRows(rows, {
      searchQuery,
      team: teamFilter,
      position: positionFilter,
    });

    return sortRoleOpportunityRows(filtered, sortState);
  }, [positionFilter, rows, searchQuery, sortState, teamFilter]);

  const hints = useMemo(() => getRoleOpportunityStateHints(error ?? null), [error]);
  const provenanceLabel = useMemo(
    () => formatPromotedModuleProvenance({
      provider: sourceProvider,
      mode: sourceMode,
      location: sourceLocation ?? null,
    }),
    [sourceLocation, sourceMode, sourceProvider],
  );

  const activePlayerContext = useMemo<DataLabPlayerCarryContext | null>(() => {
    const expandedRow = rows.find((row) => row.playerId === expandedPlayerId);
    if (expandedRow) {
      return {
        playerId: expandedRow.playerId,
        playerName: expandedRow.playerName,
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
        playerId: exactNameMatch.playerId,
        playerName: exactNameMatch.playerName,
        season,
      };
    }

    return {
      playerId: null,
      playerName: searchQuery.trim(),
      season,
    };
  }, [expandedPlayerId, initialPlayerContext, rows, searchQuery, season]);

  const updateSort = (key: RoleOpportunitySortState['key']) => {
    setSortState((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        key,
        direction: key === 'playerName' || key === 'team' || key === 'position' || key === 'primaryRole' ? 'asc' : 'desc',
      };
    });
  };

  return (
    <div className="mx-auto min-h-screen max-w-[1460px] bg-white px-6 py-8">
      <div className="mb-6">
        <Link href="/tiber-data-lab" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-[#0f766e]">
          <ArrowLeft className="h-4 w-4" />
          Data Lab
        </Link>

        <div className="mb-1 flex flex-wrap items-center gap-3">
          <Database className="h-6 w-6 text-[#0f766e]" />
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
            Role &amp; Opportunity Lab
          </h1>
          <Badge className="border-0 bg-gray-900 text-white">Promoted module</Badge>
          <Badge variant="secondary" className="border-0 bg-gray-100 text-gray-600">Read only</Badge>
        </div>
        <p className="max-w-3xl text-sm text-gray-500">
          Deployment and usage context promoted into TIBER Data Lab for inspection. This module is for understanding how a player is being used, not for projecting or rescoring them locally.
        </p>
      </div>

      <Card className="mb-6 border border-[#0f766e]/15 bg-gradient-to-r from-[#f0fdfa] to-white shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <Badge className="border-0 bg-[#0f766e] text-white">Usage and deployment</Badge>
              <span>Upstream → adapter → read-only product table</span>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-gray-600">
              <span className="font-semibold text-gray-700">When to use this:</span> Open this module when you need to explain whether snap share, routes, targets, and alignment actually support the breakout or dynasty story.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm md:min-w-[280px] md:grid-cols-2">
            <div className="rounded-md bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Scope</div>
              <div className="mt-1 text-gray-700">{scopeLabel ?? 'Season'}</div>
            </div>
            <div className="rounded-md bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Provenance</div>
              <div className="mt-1 text-gray-700">{provenanceLabel}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <PromotedModuleSystemCard currentModuleId="role-opportunity" playerContext={activePlayerContext} />
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
              placeholder="Search player or role"
              className="border-gray-200 bg-[#f4f4f4] pl-10"
            />
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 text-xs text-gray-500 xl:items-end">
          {activePlayerContext?.playerName ? (
            <div className="rounded-md border border-[#0f766e]/20 bg-[#f0fdfa] px-3 py-2 text-[#0f766e]">
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
          accentClassName="bg-[#f0fdfa]"
          accentTextClassName="text-[#0f766e]"
          title="Loading Role & Opportunity Lab"
          message={`Loading promoted deployment and usage context for season ${season}. TIBER is normalizing upstream output without recomputing role logic locally.`}
          mode="loading"
        />
      ) : error ? (
        <PromotedModuleStateCard
          icon={Database}
          accentClassName="bg-[#f0fdfa]"
          accentTextClassName="text-[#0f766e]"
          title="Role & Opportunity Lab unavailable"
          message={error.error}
          hints={hints}
          mode="error"
        />
      ) : filteredRows.length === 0 ? (
        <PromotedModuleStateCard
          icon={Database}
          accentClassName="bg-[#f0fdfa]"
          accentTextClassName="text-[#0f766e]"
          title={rows.length === 0 ? 'Role & Opportunity Lab ready, but empty' : 'No rows match the active filters'}
          message={
            rows.length === 0
              ? 'The promoted upstream dataset returned a valid empty result set, so TIBER is preserving that state without inventing fallback rows.'
              : 'Try widening the player search, team filter, or position filter to inspect more promoted rows.'
          }
          hints={hints}
          mode="empty"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full border-collapse">
            <thead className="bg-[#fafafa] text-left">
              <tr>
                <th className="w-[48px] px-4 py-3" />
                {ROLE_OPPORTUNITY_COLUMNS.map((column) => (
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
                const expanded = expandedPlayerId === row.playerId;
                const detailSections = buildRoleOpportunityDetailSections(row);

                return (
                  <Fragment key={row.playerId}>
                    <tr key={row.playerId} className="border-t border-gray-200 align-top">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          aria-label={expanded ? `Collapse ${row.playerName}` : `Expand ${row.playerName}`}
                          className="rounded-md border border-gray-200 p-1.5 text-gray-500 transition-colors hover:border-[#0f766e]/30 hover:text-[#0f766e]"
                          onClick={() => setExpandedPlayerId(expanded ? null : row.playerId)}
                        >
                          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.playerName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.team}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.position}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.primaryRole}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatPercent(row.usage.routeParticipation)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatPercent(row.usage.targetShare)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatPercent(row.usage.airYardShare)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatPercent(row.usage.snapShare)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatConfidence(row.confidence.score, row.confidence.tier)}</td>
                    </tr>
                    {expanded ? (
                      <tr className="border-t border-dashed border-gray-200 bg-[#fcfcfc]">
                        <td colSpan={10} className="px-6 py-5">
                          <div className="mb-4">
                            <PromotedModuleSystemCard
                              currentModuleId="role-opportunity"
                              playerContext={{ playerId: row.playerId, playerName: row.playerName }}
                              heading="Related modules"
                              description="Use this player carry-through to compare current deployment with breakout validation and ARC developmental timing."
                            />
                          </div>
                          <div className="grid gap-4 xl:grid-cols-4">
                            {detailSections.map((section) => (
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
