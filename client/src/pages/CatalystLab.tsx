import { useMemo, useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Download, SlidersHorizontal, Columns3 } from 'lucide-react';

type Position = 'QB' | 'RB' | 'WR' | 'TE';

function num(v: unknown, digits = 1): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return v.toFixed(digits);
}

type TierInfo = { label: string; short: string; color: string; bg: string; text: string };

function getTier(alpha: number): TierInfo {
  if (alpha >= 85) return { label: 'Elite Clutch', short: 'Elite', color: 'text-emerald-700', bg: 'bg-emerald-100', text: 'text-emerald-800' };
  if (alpha >= 65) return { label: 'Clutch', short: 'Clutch', color: 'text-green-700', bg: 'bg-green-100', text: 'text-green-800' };
  if (alpha >= 45) return { label: 'Neutral', short: 'Neutral', color: 'text-gray-600', bg: 'bg-gray-100', text: 'text-gray-700' };
  if (alpha >= 25) return { label: 'Low Signal', short: 'Low', color: 'text-amber-700', bg: 'bg-amber-100', text: 'text-amber-800' };
  return { label: 'Garbage Time Risk', short: 'GBG', color: 'text-red-600', bg: 'bg-red-100', text: 'text-red-700' };
}

const ALL_TIERS = ['Elite Clutch', 'Clutch', 'Neutral', 'Low Signal', 'Garbage Time Risk'] as const;

function barWidth(value: number, max: number): string {
  return `${Math.min(100, Math.max(0, (value / max) * 100))}%`;
}

interface CatalystPlayer {
  gsis_id: string;
  player_name: string;
  position: string;
  team: string;
  catalyst_raw: number;
  catalyst_alpha: number;
  components: {
    leverage_factor: number;
    opponent_factor: number;
    script_factor: number;
    recency_factor: number;
    base_epa_sum: number;
    weighted_epa_sum: number;
    play_count: number;
    avg_leverage: number;
  };
}

interface CatalystPlayerDetail extends CatalystPlayer {
  season: number;
  weekly: {
    week: number;
    catalyst_raw: number;
    catalyst_alpha: number;
    components: CatalystPlayer['components'];
  }[];
}

interface YoYPlayer {
  gsis_id: string;
  player_name: string;
  position: string;
  team_2024: string;
  team_2025: string;
  alpha_2024: number | null;
  alpha_2025: number | null;
  delta: number | null;
}

type SortKey = 'alpha' | 'raw' | 'plays' | 'leverage' | 'opponent' | 'script' | 'name';

type ColKey = 'raw' | 'tier' | 'plays' | 'leverage' | 'opponent' | 'script' | 'baseEpa' | 'weightedEpa';

const COL_DEFS: { key: ColKey; label: string; sortKey?: SortKey }[] = [
  { key: 'tier',       label: 'Tier' },
  { key: 'raw',        label: 'Raw Score',      sortKey: 'raw' },
  { key: 'plays',      label: 'Plays',          sortKey: 'plays' },
  { key: 'leverage',   label: 'Avg Leverage',   sortKey: 'leverage' },
  { key: 'opponent',   label: 'Opp Factor',     sortKey: 'opponent' },
  { key: 'script',     label: 'Game Script',    sortKey: 'script' },
  { key: 'baseEpa',    label: 'Base EPA' },
  { key: 'weightedEpa', label: 'Weighted EPA' },
];

const DEFAULT_COLS: Set<ColKey> = new Set(['tier', 'raw', 'plays', 'leverage', 'opponent', 'script']);

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Elite Clutch':      { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  'Clutch':            { bg: 'bg-green-100',   text: 'text-green-800',   border: 'border-green-300' },
  'Neutral':           { bg: 'bg-gray-100',    text: 'text-gray-700',    border: 'border-gray-300' },
  'Low Signal':        { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-300' },
  'Garbage Time Risk': { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300' },
};

const COMPONENT_EXPLANATIONS: Record<string, string> = {
  Leverage:     'Win probability swing per play — high means they produced when the game was on the line.',
  Opponent:     'Adjustment for defense quality — performing well vs strong defenses scores higher.',
  'Game Script': 'Boost for trailing/competitive situations — filters out garbage-time stat padding.',
  Recency:      'Recent weeks weighted more — measures sustained clutch production, not just early-season.',
};

function useClickOutside(ref: React.RefObject<HTMLElement>, cb: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, cb]);
}

export default function CatalystLab() {
  const [position, setPosition] = useState<Position>('QB');
  const [season, setSeason] = useState<number>(2025);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('alpha');
  const [sortAsc, setSortAsc] = useState(false);
  const [yoyOpen, setYoyOpen] = useState(true);

  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(DEFAULT_COLS));
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null!);
  useClickOutside(colsRef, () => setColsOpen(false));

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tierFilter, setTierFilter] = useState<Set<string>>(new Set());
  const [minPlays, setMinPlays] = useState(100);
  const [teamSearch, setTeamSearch] = useState('');

  const activeFilterCount =
    tierFilter.size +
    (minPlays > 0 ? 1 : 0) +
    (teamSearch.trim() ? 1 : 0);

  const batchQuery = useQuery<{ players: CatalystPlayer[] }>({
    queryKey: ['/api/catalyst/batch', position, season],
    queryFn: async () => {
      const res = await fetch(`/api/catalyst/batch?position=${position}&season=${season}&limit=200`);
      return res.json();
    },
  });

  const playerQuery = useQuery<CatalystPlayerDetail>({
    queryKey: ['/api/catalyst/player', selectedPlayer, season],
    queryFn: async () => {
      const res = await fetch(`/api/catalyst/player/${selectedPlayer}?season=${season}`);
      return res.json();
    },
    enabled: !!selectedPlayer,
  });

  const yoyQuery = useQuery<{ players: YoYPlayer[] }>({
    queryKey: ['/api/catalyst/yoy', position],
    queryFn: async () => {
      const res = await fetch(`/api/catalyst/yoy?position=${position}&limit=25`);
      return res.json();
    },
  });

  const players = useMemo(() => {
    const rows = batchQuery.data?.players || [];
    const sorted = [...rows];
    const sortFns: Record<SortKey, (a: CatalystPlayer, b: CatalystPlayer) => number> = {
      alpha:    (a, b) => a.catalyst_alpha - b.catalyst_alpha,
      raw:      (a, b) => a.catalyst_raw - b.catalyst_raw,
      plays:    (a, b) => a.components.play_count - b.components.play_count,
      leverage: (a, b) => a.components.avg_leverage - b.components.avg_leverage,
      opponent: (a, b) => a.components.opponent_factor - b.components.opponent_factor,
      script:   (a, b) => a.components.script_factor - b.components.script_factor,
      name:     (a, b) => a.player_name.localeCompare(b.player_name),
    };
    sorted.sort((a, b) => {
      const result = sortFns[sortKey](a, b);
      return sortAsc ? result : -result;
    });

    return sorted.filter((p) => {
      if (tierFilter.size > 0 && !tierFilter.has(getTier(p.catalyst_alpha).label)) return false;
      if (minPlays > 0 && p.components.play_count < minPlays) return false;
      if (teamSearch.trim() && !p.team.toLowerCase().includes(teamSearch.trim().toLowerCase())) return false;
      return true;
    });
  }, [batchQuery.data, sortKey, sortAsc, tierFilter, minPlays, teamSearch]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span className="ml-1 text-orange-600">{sortAsc ? '▲' : '▼'}</span>;
  };

  const toggleTier = (t: string) => {
    setTierFilter((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };

  const toggleCol = (k: ColKey) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const clearFilters = () => {
    setTierFilter(new Set());
    setMinPlays(0);
    setTeamSearch('');
  };

  const detail = playerQuery.data;
  const tier = detail ? getTier(detail.catalyst_alpha) : null;

  const tierDescription = (alpha: number) => {
    const t = getTier(alpha);
    if (alpha >= 85) return `${t.label} — This player consistently delivered in high-leverage moments against quality defenses. A top-tier clutch performer.`;
    if (alpha >= 65) return `${t.label} — Reliable in meaningful situations. Produced more often when the game was competitive.`;
    if (alpha >= 45) return `${t.label} — Production was context-neutral. Neither a clutch specialist nor a garbage-time padder.`;
    if (alpha >= 25) return `${t.label} — Production leaned toward lower-leverage situations. Needs scrutiny before trusting in big spots.`;
    return `${t.label} — Stats accumulated heavily in garbage time. Context-adjusted value is significantly lower than raw numbers suggest.`;
  };

  const exportCSV = () => {
    const headers = [
      'rank', 'player_name', 'position', 'team',
      'catalyst_alpha', 'tier', 'catalyst_raw',
      'plays', 'avg_leverage', 'opponent_factor', 'script_factor',
      'recency_factor', 'base_epa_sum', 'weighted_epa_sum',
    ];
    const metaRows = [
      `# CATALYST Lab Export — ${position} — ${season} Season`,
      `# Generated by TIBER | Contextual Adaptive Tactical Leverage Yield Score`,
      `# Tiers: Elite Clutch (85+) | Clutch (65–84) | Neutral (45–64) | Low Signal (25–44) | Garbage Time Risk (<25)`,
      `# catalyst_alpha: 0–100 percentile within position group`,
      `# catalyst_raw: weighted EPA per play (EPA × leverage × opponent × game_script × recency)`,
      ...(activeFilterCount > 0 ? [`# Filters applied: ${[
        tierFilter.size ? `tiers: ${[...tierFilter].join(', ')}` : '',
        minPlays > 0 ? `min plays: ${minPlays}` : '',
        teamSearch ? `team: ${teamSearch}` : '',
      ].filter(Boolean).join(' | ')}`] : []),
      '',
    ];
    const rows = players.map((p, i) => {
      const t = getTier(p.catalyst_alpha);
      return [
        i + 1, p.player_name, p.position, p.team,
        p.catalyst_alpha.toFixed(1), t.label, p.catalyst_raw.toFixed(4),
        p.components.play_count, p.components.avg_leverage.toFixed(4),
        p.components.opponent_factor.toFixed(4), p.components.script_factor.toFixed(4),
        p.components.recency_factor.toFixed(4), p.components.base_epa_sum.toFixed(2),
        p.components.weighted_epa_sum.toFixed(2),
      ].join(',');
    });
    const csv = [...metaRows, headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalyst_${position.toLowerCase()}_${season}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalCount = batchQuery.data?.players?.length ?? 0;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">CATALYST Lab</h1>
        <p className="text-sm text-gray-600 max-w-3xl">
          Contextual Adaptive Tactical Leverage Yield Score — identifies clutch performers vs garbage-time stat padders using EPA production weighted by win probability, opponent quality, game script, and recency.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white border rounded-lg p-3">
        <div className="flex border rounded overflow-hidden">
          {(['QB', 'RB', 'WR', 'TE'] as Position[]).map((p) => (
            <button
              key={p}
              onClick={() => { setPosition(p); setSelectedPlayer(null); }}
              className={`px-3 py-1 text-sm ${position === p ? 'bg-orange-600 text-white' : 'bg-white hover:bg-gray-50'}`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex border rounded overflow-hidden">
          {[2024, 2025].map((y) => (
            <button
              key={y}
              onClick={() => { setSeason(y); setSelectedPlayer(null); }}
              className={`px-3 py-1 text-sm ${season === y ? 'bg-gray-800 text-white' : 'bg-white hover:bg-gray-50'}`}
            >
              {y}
            </button>
          ))}
        </div>

        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded transition-colors ${filtersOpen || activeFilterCount > 0 ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white hover:bg-gray-50'}`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 bg-orange-600 text-white rounded-full text-[10px] font-bold leading-none">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="relative" ref={colsRef}>
          <button
            onClick={() => setColsOpen(!colsOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded transition-colors ${colsOpen ? 'bg-gray-100 border-gray-300' : 'bg-white hover:bg-gray-50'}`}
          >
            <Columns3 className="w-3.5 h-3.5" />
            Columns
            {visibleCols.size !== DEFAULT_COLS.size && (
              <span className="ml-0.5 text-[10px] text-gray-500">({visibleCols.size}/{COL_DEFS.length})</span>
            )}
          </button>

          {colsOpen && (
            <div className="absolute top-full left-0 mt-1 z-30 bg-white border rounded-lg shadow-lg p-2 w-44 space-y-0.5">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-2 pb-1">Toggle Columns</div>
              {COL_DEFS.map((col) => (
                <label key={col.key} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={visibleCols.has(col.key)}
                    onChange={() => toggleCol(col.key)}
                    className="accent-orange-600"
                  />
                  {col.label}
                </label>
              ))}
              <div className="border-t pt-1 mt-1 flex gap-1 px-1">
                <button onClick={() => setVisibleCols(new Set(COL_DEFS.map(c => c.key)))} className="flex-1 text-[10px] text-gray-500 hover:text-gray-700 py-0.5">All</button>
                <button onClick={() => setVisibleCols(new Set(DEFAULT_COLS))} className="flex-1 text-[10px] text-gray-500 hover:text-gray-700 py-0.5">Reset</button>
              </div>
            </div>
          )}
        </div>

        {batchQuery.isLoading && <span className="text-xs text-gray-400">Loading...</span>}
        <span className="text-xs text-gray-400">
          {players.length}{players.length !== totalCount ? ` of ${totalCount}` : ''} players
        </span>

        <button
          onClick={exportCSV}
          disabled={players.length === 0}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {filtersOpen && (
        <div className="bg-white border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Filters</span>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-orange-600 hover:text-orange-700">
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-gray-600">Tier</div>
            <div className="flex flex-wrap gap-2">
              {ALL_TIERS.map((t) => {
                const c = TIER_COLORS[t];
                const active = tierFilter.has(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTier(t)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      active
                        ? `${c.bg} ${c.text} ${c.border} ring-1 ring-offset-1 ring-current`
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            {tierFilter.size > 0 && (
              <p className="text-[10px] text-gray-400">Showing {tierFilter.size} of 5 tiers</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">Min Plays</label>
                <span className="text-[10px] text-gray-400">QB dropbacks · WR/TE targets · RB carries</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={300}
                  step={10}
                  value={minPlays}
                  onChange={(e) => setMinPlays(Number(e.target.value))}
                  className="flex-1 accent-orange-600"
                />
                <span className="text-xs font-mono w-8 text-right text-gray-700">{minPlays || 'Any'}</span>
              </div>
              <div className="flex gap-1">
                {[0, 50, 100, 150, 200].map((v) => (
                  <button
                    key={v}
                    onClick={() => setMinPlays(v)}
                    className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${minPlays === v ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                  >
                    {v || 'Any'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400">
                100+ filters to meaningful contributors. Season-total plays are cumulative across all weeks played.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Team</label>
              <input
                type="text"
                placeholder="e.g. BUF, KC, SF"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-orange-400 uppercase"
                maxLength={4}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border rounded-lg overflow-auto" style={{ maxHeight: '70vh' }}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left sticky top-0 z-10">
              <tr>
                <th className="p-2 text-right w-12 cursor-pointer" onClick={() => handleSort('alpha')}>#</th>
                <th className="p-2 cursor-pointer" onClick={() => handleSort('name')}>Player{sortIndicator('name')}</th>
                <th className="p-2">Team</th>
                <th className="p-2 text-right cursor-pointer" onClick={() => handleSort('alpha')}>Alpha{sortIndicator('alpha')}</th>
                {visibleCols.has('tier') && <th className="p-2 text-right">Tier</th>}
                {visibleCols.has('raw') && <th className="p-2 text-right cursor-pointer" onClick={() => handleSort('raw')}>Raw{sortIndicator('raw')}</th>}
                {visibleCols.has('plays') && (
                  <th className="p-2 text-right cursor-pointer" onClick={() => handleSort('plays')}>
                    <span title="Season total plays directly involved in: QB dropbacks, WR/TE targets, RB carries. Not total snaps.">
                      Plays{sortIndicator('plays')}
                    </span>
                  </th>
                )}
                {visibleCols.has('leverage') && <th className="p-2 text-right cursor-pointer" onClick={() => handleSort('leverage')}>Leverage{sortIndicator('leverage')}</th>}
                {visibleCols.has('opponent') && <th className="p-2 text-right cursor-pointer" onClick={() => handleSort('opponent')}>Opp{sortIndicator('opponent')}</th>}
                {visibleCols.has('script') && <th className="p-2 text-right cursor-pointer" onClick={() => handleSort('script')}>Script{sortIndicator('script')}</th>}
                {visibleCols.has('baseEpa') && <th className="p-2 text-right">Base EPA</th>}
                {visibleCols.has('weightedEpa') && <th className="p-2 text-right">Wtd EPA</th>}
              </tr>
            </thead>
            <tbody>
              {players.length === 0 && !batchQuery.isLoading && (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-sm text-gray-400">
                    No players match the current filters.{' '}
                    {activeFilterCount > 0 && (
                      <button onClick={clearFilters} className="text-orange-600 hover:underline">Clear filters</button>
                    )}
                  </td>
                </tr>
              )}
              {players.map((p, i) => {
                const t = getTier(p.catalyst_alpha);
                return (
                  <tr
                    key={p.gsis_id}
                    className={`border-t cursor-pointer ${selectedPlayer === p.gsis_id ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                    onClick={() => setSelectedPlayer(p.gsis_id)}
                  >
                    <td className="p-2 text-right text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="p-2 font-medium">{p.player_name}</td>
                    <td className="p-2 text-gray-600">{p.team}</td>
                    <td className="p-2 text-right">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t.bg} ${t.text}`}>
                        {num(p.catalyst_alpha, 0)}
                      </span>
                    </td>
                    {visibleCols.has('tier') && (
                      <td className="p-2 text-right">
                        <span className={`text-xs font-medium ${t.color}`}>{t.short}</span>
                      </td>
                    )}
                    {visibleCols.has('raw') && (
                      <td className={`p-2 text-right tabular-nums ${t.color}`}>{num(p.catalyst_raw, 3)}</td>
                    )}
                    {visibleCols.has('plays') && (
                      <td className="p-2 text-right tabular-nums">{p.components.play_count}</td>
                    )}
                    {visibleCols.has('leverage') && (
                      <td className="p-2 text-right tabular-nums">{num(p.components.avg_leverage, 2)}</td>
                    )}
                    {visibleCols.has('opponent') && (
                      <td className="p-2 text-right tabular-nums">{num(p.components.opponent_factor, 3)}</td>
                    )}
                    {visibleCols.has('script') && (
                      <td className="p-2 text-right tabular-nums">{num(p.components.script_factor, 3)}</td>
                    )}
                    {visibleCols.has('baseEpa') && (
                      <td className="p-2 text-right tabular-nums">{num(p.components.base_epa_sum, 1)}</td>
                    )}
                    {visibleCols.has('weightedEpa') && (
                      <td className="p-2 text-right tabular-nums">{num(p.components.weighted_epa_sum, 1)}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          {!selectedPlayer && (
            <div className="bg-white border rounded-lg p-6 text-center text-gray-400 text-sm">
              Click a player to see weekly breakdown and component details.
            </div>
          )}

          {selectedPlayer && playerQuery.isLoading && (
            <div className="bg-white border rounded-lg p-6 text-center text-gray-400 text-sm">
              Loading player detail...
            </div>
          )}

          {detail && tier && (
            <>
              <div className="bg-white border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">{detail.player_name}</h2>
                    <p className="text-xs text-gray-500">{detail.team} · {detail.position} · {detail.season}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${tier.bg} ${tier.text}`}>
                      {tier.label}
                    </span>
                  </div>
                  <div className={`text-3xl font-bold tabular-nums ${tier.color}`}>
                    {num(detail.catalyst_alpha, 0)}
                  </div>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded p-2">
                  {tierDescription(detail.catalyst_alpha)}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Raw Score</div>
                    <div className="font-mono font-semibold">{num(detail.catalyst_raw, 4)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Total Plays</div>
                    <div className="font-mono font-semibold">{detail.components.play_count}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Base EPA</div>
                    <div className="font-mono font-semibold">{num(detail.components.base_epa_sum, 1)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Weighted EPA</div>
                    <div className="font-mono font-semibold">{num(detail.components.weighted_epa_sum, 1)}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Component Factors</div>
                  {[
                    { label: 'Leverage',    value: detail.components.avg_leverage,    max: 5 },
                    { label: 'Opponent',    value: detail.components.opponent_factor,  max: 2 },
                    { label: 'Game Script', value: detail.components.script_factor,    max: 1.5 },
                    { label: 'Recency',     value: detail.components.recency_factor,   max: 1 },
                  ].map((comp) => (
                    <div key={comp.label} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-700 font-medium">{comp.label}</span>
                        <span className="font-mono">{num(comp.value, 3)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full transition-all"
                          style={{ width: barWidth(comp.value, comp.max) }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-400">{COMPONENT_EXPLANATIONS[comp.label]}</div>
                    </div>
                  ))}
                </div>
              </div>

              {detail.weekly && detail.weekly.length > 0 && (
                <div className="bg-white border rounded-lg overflow-auto" style={{ maxHeight: '40vh' }}>
                  <div className="px-3 py-2 border-b text-xs font-medium text-gray-600 uppercase tracking-wide">
                    Weekly Progression
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-left sticky top-0">
                      <tr>
                        <th className="p-2">Week</th>
                        <th className="p-2 text-right">Alpha</th>
                        <th className="p-2 text-right">Raw</th>
                        <th className="p-2 text-right">Plays</th>
                        <th className="p-2 text-right">Leverage</th>
                        <th className="p-2 text-right">Opp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.weekly.map((w) => {
                        const wt = getTier(w.catalyst_alpha);
                        return (
                          <tr key={w.week} className="border-t hover:bg-gray-50">
                            <td className="p-2 font-medium">W{w.week}</td>
                            <td className="p-2 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${wt.bg} ${wt.text}`}>
                                {num(w.catalyst_alpha, 0)}
                              </span>
                            </td>
                            <td className={`p-2 text-right tabular-nums ${wt.color}`}>{num(w.catalyst_raw, 3)}</td>
                            <td className="p-2 text-right tabular-nums">{w.components.play_count}</td>
                            <td className="p-2 text-right tabular-nums">{num(w.components.avg_leverage, 2)}</td>
                            <td className="p-2 text-right tabular-nums">{num(w.components.opponent_factor, 3)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          onClick={() => setYoyOpen(!yoyOpen)}
        >
          <div>
            <span className="font-semibold text-sm">2024 → 2025 Signal Validation</span>
            <span className="ml-2 text-xs text-gray-500">Did the 2024 CATALYST leaders stay clutch in 2025?</span>
          </div>
          {yoyOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {yoyOpen && (
          <div className="border-t">
            <div className="px-4 py-2 bg-gray-50 border-b">
              <p className="text-xs text-gray-500">
                Top {position}s ranked by their 2024 CATALYST Alpha score, showing their 2025 performance — validating the clutch signal as a forward indicator.
              </p>
            </div>

            {yoyQuery.isLoading && (
              <div className="p-6 text-center text-sm text-gray-400">Loading comparison data...</div>
            )}

            {yoyQuery.data && (
              <div className="overflow-auto" style={{ maxHeight: '50vh' }}>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left sticky top-0">
                    <tr>
                      <th className="p-2 text-right w-10 text-gray-500 font-medium">#</th>
                      <th className="p-2 text-gray-500 font-medium">Player</th>
                      <th className="p-2 text-gray-500 font-medium">2024 Team</th>
                      <th className="p-2 text-right text-gray-500 font-medium">2024 Alpha</th>
                      <th className="p-2 text-right text-gray-500 font-medium">2025 Alpha</th>
                      <th className="p-2 text-right text-gray-500 font-medium">Change</th>
                      <th className="p-2 text-gray-500 font-medium">2025 Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yoyQuery.data.players.map((p, i) => {
                      const t24 = p.alpha_2024 != null ? getTier(p.alpha_2024) : null;
                      const t25 = p.alpha_2025 != null ? getTier(p.alpha_2025) : null;
                      const delta = p.delta;
                      const deltaColor = delta == null ? 'text-gray-400'
                        : delta >= 5 ? 'text-emerald-600'
                        : delta <= -5 ? 'text-red-500'
                        : 'text-gray-500';
                      const deltaSign = delta == null ? '—' : delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
                      return (
                        <tr key={p.gsis_id} className="border-t hover:bg-gray-50">
                          <td className="p-2 text-right text-gray-400 tabular-nums">{i + 1}</td>
                          <td className="p-2 font-medium">{p.player_name}</td>
                          <td className="p-2 text-gray-500">{p.team_2024}</td>
                          <td className="p-2 text-right">
                            {t24 && (
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t24.bg} ${t24.text}`}>
                                {p.alpha_2024 != null ? num(p.alpha_2024, 0) : '—'}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-right">
                            {t25 ? (
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t25.bg} ${t25.text}`}>
                                {p.alpha_2025 != null ? num(p.alpha_2025, 0) : '—'}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">No data</span>
                            )}
                          </td>
                          <td className={`p-2 text-right tabular-nums text-sm font-semibold ${deltaColor}`}>
                            {deltaSign}
                          </td>
                          <td className="p-2">
                            {t25 ? (
                              <span className={`text-xs font-medium ${t25.color}`}>{t25.label}</span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
