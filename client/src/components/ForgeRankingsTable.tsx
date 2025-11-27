import { useState, useMemo } from 'react';
import { ArrowUpDown, Download, Eye, EyeOff } from 'lucide-react';
import type { ForgeScore } from '../types/forge';

export type DeltaSeverity = 'major' | 'moderate' | 'minor' | 'none';

export interface ForgeRow {
  playerId: string;
  canonicalId: string;
  playerName: string;
  team: string;
  gamesPlayed: number;
  sandboxAlpha: number;
  forgeAlpha?: number;
  forgeRawAlpha?: number;
  forgeConfidence?: number;
  forgeTrajectory?: string;
  injuryStatus?: string | null;
  extraColumns?: Record<string, number | string | null>;
}

interface ForgeRankingsTableProps {
  position: 'WR' | 'RB' | 'TE' | 'QB';
  rows: ForgeRow[];
  isLoading?: boolean;
  forgeLoading?: boolean;
  forgeError?: string | null;
  extraColumnDefs?: Array<{ key: string; label: string; format?: (v: any) => string }>;
  season: number;
  week: number | null;
  onSeasonChange?: (season: number) => void;
  onWeekChange?: (week: number | null) => void;
}

export function getDeltaSeverity(delta: number): DeltaSeverity {
  const abs = Math.abs(delta);
  if (abs >= 15) return 'major';
  if (abs >= 8) return 'moderate';
  if (abs >= 4) return 'minor';
  return 'none';
}

export function getDeltaSeverityStyles(severity: DeltaSeverity): string {
  switch (severity) {
    case 'major':
      return 'bg-amber-500/20 border-amber-500/50';
    case 'moderate':
      return 'bg-orange-500/15 border-orange-500/40';
    case 'minor':
      return 'bg-slate-600/20 border-slate-500/30';
    default:
      return '';
  }
}

export function getDeltaColor(delta: number): string {
  if (delta > 0) return 'text-green-400';
  if (delta < 0) return 'text-red-400';
  return 'text-slate-500';
}

function getAlphaColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-emerald-400';
  if (score >= 40) return 'text-yellow-400';
  if (score >= 20) return 'text-orange-400';
  return 'text-red-400';
}

function getTrajectoryIcon(trajectory?: string): string {
  if (trajectory === 'rising') return '↗';
  if (trajectory === 'declining') return '↘';
  return '→';
}

type SortField = 'playerName' | 'team' | 'sandboxAlpha' | 'forgeAlpha' | 'gamesPlayed' | 'delta';
type SortOrder = 'asc' | 'desc';

const isDev = typeof window !== 'undefined' && 
  (import.meta.env.DEV || import.meta.env.VITE_DEV_MODE === 'true');

export default function ForgeRankingsTable({
  position,
  rows,
  isLoading = false,
  forgeLoading = false,
  forgeError = null,
  extraColumnDefs = [],
  season,
  week,
  onSeasonChange,
  onWeekChange,
}: ForgeRankingsTableProps) {
  const [sortField, setSortField] = useState<SortField>('sandboxAlpha');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [minDisagreement, setMinDisagreement] = useState<number>(8);
  const [onlyDisagreements, setOnlyDisagreements] = useState<boolean>(false);
  const [showMissingForge, setShowMissingForge] = useState<boolean>(true);
  const [showRawAlpha, setShowRawAlpha] = useState<boolean>(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredAndSortedRows = useMemo(() => {
    let filtered = rows;

    if (searchQuery.trim()) {
      const needle = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.playerName.toLowerCase().includes(needle) ||
        r.team.toLowerCase().includes(needle)
      );
    }

    if (onlyDisagreements) {
      filtered = filtered.filter(r => {
        if (r.forgeAlpha == null) return showMissingForge;
        const delta = Math.abs(r.forgeAlpha - r.sandboxAlpha);
        return delta >= minDisagreement;
      });
    }

    if (!showMissingForge && !onlyDisagreements) {
      filtered = filtered.filter(r => r.forgeAlpha != null);
    }

    return filtered.slice().sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      if (sortField === 'delta') {
        aVal = a.forgeAlpha != null ? a.forgeAlpha - a.sandboxAlpha : -999;
        bVal = b.forgeAlpha != null ? b.forgeAlpha - b.sandboxAlpha : -999;
      } else if (sortField === 'forgeAlpha') {
        aVal = a.forgeAlpha ?? -999;
        bVal = b.forgeAlpha ?? -999;
      } else {
        aVal = a[sortField] ?? 0;
        bVal = b[sortField] ?? 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const aNum = typeof aVal === 'number' ? aVal : 0;
      const bNum = typeof bVal === 'number' ? bVal : 0;
      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [rows, searchQuery, sortField, sortOrder, onlyDisagreements, minDisagreement, showMissingForge]);

  const handleExport = () => {
    const exportPayload = {
      meta: {
        position,
        season,
        week: week ?? 'full',
        exportedAt: new Date().toISOString(),
        count: filteredAndSortedRows.length,
      },
      data: filteredAndSortedRows.map((r, idx) => ({
        rank: idx + 1,
        playerName: r.playerName,
        team: r.team,
        gamesPlayed: r.gamesPlayed,
        sandboxAlpha: r.sandboxAlpha,
        forgeAlpha: r.forgeAlpha ?? null,
        forgeRawAlpha: r.forgeRawAlpha ?? null,
        delta: r.forgeAlpha != null ? Math.round((r.forgeAlpha - r.sandboxAlpha) * 10) / 10 : null,
        trajectory: r.forgeTrajectory ?? null,
      })),
    };
    const json = JSON.stringify(exportPayload, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      const weekLabel = week ?? 'Full Season';
      console.log(`[FORGE Export] Exporting ${position} rankings for season=${season}, week=${weekLabel}`);
      alert(`Copied ${exportPayload.data.length} ${position} rankings to clipboard!\n\nSeason: ${season}, Week: ${weekLabel}`);
    });
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
      onClick={() => handleSort(field)}
      data-testid={`sort-header-${field}`}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-blue-400' : 'text-slate-600'}`} />
      </div>
    </th>
  );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-700 rounded w-1/4"></div>
        <div className="h-12 bg-slate-700 rounded"></div>
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Search by name or team..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          data-testid="search-input"
        />

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">Season</label>
          <select
            value={season}
            onChange={(e) => onSeasonChange?.(Number(e.target.value))}
            className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            data-testid="select-season"
          >
            <option value={2025}>2025</option>
            <option value={2024}>2024</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">Week</label>
          <select
            value={week ?? 'full'}
            onChange={(e) => onWeekChange?.(e.target.value === 'full' ? null : Number(e.target.value))}
            className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            data-testid="select-week"
          >
            {[...Array(18)].map((_, i) => (
              <option key={i + 1} value={i + 1}>Week {i + 1}</option>
            ))}
            <option value="full">Full Season</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyDisagreements}
            onChange={(e) => setOnlyDisagreements(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
            data-testid="checkbox-disagreements"
          />
          <span className="text-sm text-slate-300">Show only disagreements (|Δ| ≥ {minDisagreement})</span>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Min |Δ|</span>
          <input
            type="number"
            value={minDisagreement}
            min={1}
            max={50}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMinDisagreement(Number.isNaN(v) ? 8 : v);
            }}
            className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            data-testid="input-min-delta"
          />
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showMissingForge}
            onChange={(e) => setShowMissingForge(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
            data-testid="checkbox-show-missing"
          />
          <span className="text-sm text-slate-300">Show missing FORGE</span>
        </label>

        {isDev && (
          <label className="flex items-center gap-2 cursor-pointer border-l border-slate-600 pl-4">
            <button
              onClick={() => setShowRawAlpha(!showRawAlpha)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              data-testid="toggle-raw-alpha"
            >
              {showRawAlpha ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              rawAlpha (dev)
            </button>
          </label>
        )}

        <button
          onClick={handleExport}
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white transition-colors ml-auto"
          data-testid="export-button"
        >
          <Download className="h-4 w-4" />
          Export JSON
        </button>
      </div>

      {forgeLoading && (
        <div className="text-xs text-blue-400 flex items-center gap-2">
          <span className="animate-spin">⟳</span> Loading FORGE scores...
        </div>
      )}

      {forgeError && (
        <div className="text-xs text-red-400">{forgeError}</div>
      )}

      <div className="bg-[#141824] rounded-lg border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid={`${position.toLowerCase()}-rankings-table`}>
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider w-12">#</th>
                <SortHeader field="playerName" label="Player" />
                <SortHeader field="team" label="Team" />
                <SortHeader field="gamesPlayed" label="GP" />
                {extraColumnDefs.map(col => (
                  <th key={col.key} className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {col.label}
                  </th>
                ))}
                <SortHeader field="sandboxAlpha" label="Sandbox α" />
                <SortHeader field="forgeAlpha" label="FORGE α" />
                {showRawAlpha && (
                  <th className="px-3 py-2 text-left text-xs font-medium text-purple-400 uppercase tracking-wider">
                    rawAlpha
                  </th>
                )}
                <SortHeader field="delta" label="Δ" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredAndSortedRows.map((row, idx) => {
                const delta = row.forgeAlpha != null
                  ? row.forgeAlpha - row.sandboxAlpha
                  : null;
                const deltaDisplay = delta != null ? delta.toFixed(1) : null;
                const severity = delta != null ? getDeltaSeverity(delta) : 'none';
                const severityStyles = getDeltaSeverityStyles(severity);

                return (
                  <tr
                    key={row.playerId}
                    className={`hover:bg-slate-700/30 transition-colors ${severityStyles}`}
                    data-testid={`row-${position.toLowerCase()}-${row.playerId}`}
                  >
                    <td className="px-3 py-2 text-sm text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white" data-testid={`player-name-${row.playerId}`}>
                          {row.playerName}
                        </span>
                        {row.injuryStatus && (
                          <span className="text-xs px-1.5 py-0.5 bg-red-900/50 text-red-400 rounded">
                            {row.injuryStatus}
                          </span>
                        )}
                        {row.forgeAlpha == null && !forgeLoading && (
                          <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded" title="No FORGE data available">
                            No FORGE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-400">{row.team}</td>
                    <td className="px-3 py-2 text-sm text-slate-400">{row.gamesPlayed}</td>
                    {extraColumnDefs.map(col => (
                      <td key={col.key} className="px-3 py-2 text-sm text-slate-400">
                        {col.format
                          ? col.format(row.extraColumns?.[col.key])
                          : row.extraColumns?.[col.key] ?? '—'}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <span className={`text-sm font-mono font-semibold ${getAlphaColor(row.sandboxAlpha)}`} data-testid={`sandbox-alpha-${row.playerId}`}>
                        {row.sandboxAlpha.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {row.forgeAlpha != null ? (
                        <span className={`text-sm font-mono font-semibold ${getAlphaColor(row.forgeAlpha)}`} data-testid={`forge-alpha-${row.playerId}`}>
                          {row.forgeAlpha.toFixed(1)}
                          <span className="ml-1 text-xs text-slate-500">{getTrajectoryIcon(row.forgeTrajectory)}</span>
                        </span>
                      ) : forgeLoading ? (
                        <span className="text-sm text-slate-500">…</span>
                      ) : (
                        <span className="text-sm text-slate-500" data-testid={`forge-alpha-missing-${row.playerId}`}>—</span>
                      )}
                    </td>
                    {showRawAlpha && (
                      <td className="px-3 py-2">
                        <span className="text-sm font-mono text-purple-400">
                          {row.forgeRawAlpha != null ? row.forgeRawAlpha.toFixed(1) : '—'}
                        </span>
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {deltaDisplay != null ? (
                        <span
                          className={`text-sm font-mono ${getDeltaColor(delta!)}`}
                          data-testid={`delta-${row.playerId}`}
                        >
                          {delta! > 0 ? '+' : ''}{deltaDisplay}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/30">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span data-testid="row-count">Showing {filteredAndSortedRows.length} of {rows.length} players</span>
            <span>FORGE scores: {rows.filter(r => r.forgeAlpha != null).length} loaded</span>
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-2">Legend</h3>
        <div className="flex flex-wrap gap-4 text-xs text-slate-400">
          <div><span className="text-green-400 font-bold">80+</span> Elite</div>
          <div><span className="text-emerald-400 font-bold">60-79</span> Strong</div>
          <div><span className="text-yellow-400 font-bold">40-59</span> Average</div>
          <div><span className="text-orange-400 font-bold">20-39</span> Below Avg</div>
          <div><span className="text-red-400 font-bold">&lt;20</span> Poor</div>
          <div className="border-l border-slate-600 pl-4">
            <span className="mr-2">↗ Rising</span>
            <span className="mr-2">→ Flat</span>
            <span>↘ Declining</span>
          </div>
          <div className="border-l border-slate-600 pl-4">
            <span className="text-green-400">+Δ</span> = FORGE rates higher |
            <span className="text-red-400 ml-1">-Δ</span> = FORGE rates lower
          </div>
          <div className="border-l border-slate-600 pl-4">
            <span className="inline-block px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/50 rounded text-amber-400">Major (≥15)</span>
            <span className="inline-block px-1.5 py-0.5 bg-orange-500/15 border border-orange-500/40 rounded text-orange-400 ml-2">Moderate (≥8)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
