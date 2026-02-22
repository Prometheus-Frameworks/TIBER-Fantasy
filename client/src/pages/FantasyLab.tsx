import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from 'recharts';

type Position = 'RB' | 'WR' | 'TE';
type ViewMode = 'FIRE' | 'DELTA' | 'WATCHLIST';
type DirectionFilter = 'ALL' | 'BUY_LOW' | 'SELL_HIGH' | 'NEUTRAL';
type ConfidenceFilter = 'ALL' | 'HM' | 'HIGH';
type SortMode = 'ABSZ' | 'ZDESC' | 'ZASC';
type ColumnPreset = 'BASIC' | 'VOLUME' | 'FULL';

const seasons = [2025, 2024, 2023];
const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
const WATCHLIST_KEY = 'fantasy-lab-watchlist-v1';
const PRESET_KEY = 'fantasy-lab-preset-v1';

function num(v: unknown, digits = 1): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return v.toFixed(digits);
}

function pct(v: unknown): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return v.toFixed(0) + '%';
}

interface ColDef {
  key: string;
  label: string;
  shortLabel?: string;
  group: 'identity' | 'fire' | 'games' | 'volume' | 'efficiency' | 'production' | 'consistency';
  render: (r: any) => string;
  align?: 'left' | 'right';
  sortKey?: (r: any) => number;
  preset: ColumnPreset[];
}

const FIRE_COLUMNS: ColDef[] = [
  { key: 'rank', label: 'Rank', group: 'identity', render: (r) => r.fireRank != null ? `#${r.fireRank}` : '—', align: 'right', sortKey: (r) => r.fireRank ?? 999, preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'player', label: 'Player', group: 'identity', render: (r) => r.playerName || r.playerId, align: 'left', preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'team', label: 'Team', group: 'identity', render: (r) => r.team || '—', align: 'left', preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'fire', label: 'FIRE', group: 'identity', render: (r) => num(r.fireScore), align: 'right', sortKey: (r) => r.fireScore ?? -1, preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'opp', label: 'Opp', group: 'fire', render: (r) => num(r.pillars?.opportunity), align: 'right', sortKey: (r) => r.pillars?.opportunity ?? -1, preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'role', label: 'Role', group: 'fire', render: (r) => num(r.pillars?.role), align: 'right', sortKey: (r) => r.pillars?.role ?? -1, preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'conv', label: 'Conv', group: 'fire', render: (r) => num(r.pillars?.conversion), align: 'right', sortKey: (r) => r.pillars?.conversion ?? -1, preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'conf', label: 'Conf', group: 'fire', render: (r) => r.confidence || 'LOW', align: 'left', preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'games', label: 'Games', group: 'games', render: (r) => String(r.games_played_window ?? '—'), align: 'right', sortKey: (r) => r.games_played_window ?? 0, preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'snaps', label: 'Snaps', group: 'games', render: (r) => num(r.raw?.snaps_R, 0), align: 'right', sortKey: (r) => r.raw?.snaps_R ?? 0, preset: ['VOLUME', 'FULL'] },
  { key: 'snapPct', label: 'Snap%', group: 'games', render: (r) => pct(r.stats?.snapPct), align: 'right', sortKey: (r) => r.stats?.snapPct ?? 0, preset: ['VOLUME', 'FULL'] },
  { key: 'carGm', label: 'Car/G', group: 'volume', render: (r) => num(r.stats?.carriesPerGame), align: 'right', sortKey: (r) => r.stats?.carriesPerGame ?? 0, preset: ['VOLUME', 'FULL'] },
  { key: 'tgtGm', label: 'Tgt/G', group: 'volume', render: (r) => num(r.stats?.targetsPerGame), align: 'right', sortKey: (r) => r.stats?.targetsPerGame ?? 0, preset: ['VOLUME', 'FULL'] },
  { key: 'tchGm', label: 'Tch/G', group: 'volume', render: (r) => num(r.stats?.touchesPerGame), align: 'right', sortKey: (r) => r.stats?.touchesPerGame ?? 0, preset: ['VOLUME', 'FULL'] },
  { key: 'rushSh', label: 'Rush%', shortLabel: 'RSh%', group: 'volume', render: (r) => pct(r.stats?.rushSharePct), align: 'right', sortKey: (r) => r.stats?.rushSharePct ?? 0, preset: [] },
  { key: 'tgtSh', label: 'Tgt%', shortLabel: 'TSh%', group: 'volume', render: (r) => pct(r.stats?.targetSharePct), align: 'right', sortKey: (r) => r.stats?.targetSharePct ?? 0, preset: ['VOLUME', 'FULL'] },
  { key: 'ypc', label: 'YPC', group: 'efficiency', render: (r) => num(r.stats?.ypc), align: 'right', sortKey: (r) => r.stats?.ypc ?? 0, preset: ['VOLUME', 'FULL'] },
  { key: 'ypr', label: 'YPR', group: 'efficiency', render: (r) => num(r.stats?.ypr), align: 'right', sortKey: (r) => r.stats?.ypr ?? 0, preset: ['FULL'] },
  { key: 'rushYG', label: 'RshY/G', group: 'production', render: (r) => num(r.stats?.rushYdsPerGame), align: 'right', sortKey: (r) => r.stats?.rushYdsPerGame ?? 0, preset: ['FULL'] },
  { key: 'recYG', label: 'RecY/G', group: 'production', render: (r) => num(r.stats?.recYdsPerGame), align: 'right', sortKey: (r) => r.stats?.recYdsPerGame ?? 0, preset: ['FULL'] },
  { key: 'tds', label: 'TDs', group: 'production', render: (r) => String(r.stats?.totalTds ?? '—'), align: 'right', sortKey: (r) => r.stats?.totalTds ?? 0, preset: ['VOLUME', 'FULL'] },
  { key: 'fpg', label: 'FPG', group: 'production', render: (r) => num(r.stats?.fantasyPpg), align: 'right', sortKey: (r) => r.stats?.fantasyPpg ?? 0, preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'xfpDiff', label: 'xFP±', group: 'production', render: (r) => num(r.stats?.xfpDiff), align: 'right', sortKey: (r) => r.stats?.xfpDiff ?? 0, preset: ['FULL'] },
  { key: 'fpSd', label: 'FP SD', group: 'consistency', render: (r) => num(r.stats?.fpStdDev), align: 'right', sortKey: (r) => r.stats?.fpStdDev ?? 0, preset: ['VOLUME', 'FULL'] },
  { key: 'boom', label: 'Boom%', group: 'consistency', render: (r) => pct(r.stats?.boomPct), align: 'right', sortKey: (r) => r.stats?.boomPct ?? 0, preset: ['VOLUME', 'FULL'] },
  { key: 'rzSh', label: 'RZ Tch%', group: 'consistency', render: (r) => pct(r.stats?.rzTouchSharePct), align: 'right', sortKey: (r) => r.stats?.rzTouchSharePct ?? 0, preset: [] },
];

const GROUP_COLORS: Record<string, string> = {
  identity: '',
  fire: 'bg-orange-50',
  games: 'bg-blue-50',
  volume: 'bg-green-50',
  efficiency: 'bg-purple-50',
  production: 'bg-amber-50',
  consistency: 'bg-rose-50',
};

function parseParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    season: Number(p.get('season')) || 2025,
    week: Number(p.get('week')) || 14,
    position: ((p.get('pos') || 'RB').toUpperCase() as Position),
    view: ((p.get('view') || 'fire').toUpperCase() as ViewMode),
    direction: ((p.get('dir') || 'ALL').toUpperCase() as DirectionFilter),
    confidence: (p.get('conf') || 'all').toUpperCase() === 'HM' ? 'HM' as ConfidenceFilter : (p.get('conf') || 'all').toUpperCase() === 'HIGH' ? 'HIGH' as ConfidenceFilter : 'ALL' as ConfidenceFilter,
    sort: (p.get('sort') || 'absz').toLowerCase() === 'zdesc' ? 'ZDESC' as SortMode : (p.get('sort') || 'absz').toLowerCase() === 'zasc' ? 'ZASC' as SortMode : 'ABSZ' as SortMode,
  };
}

function confidenceClass(v?: string) {
  if (v === 'HIGH') return 'bg-emerald-100 text-emerald-700';
  if (v === 'MED') return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-700';
}

export default function FantasyLab() {
  const initial = parseParams();
  const [season, setSeason] = useState(initial.season);
  const [week, setWeek] = useState(initial.week);
  const [position, setPosition] = useState<Position>(['RB', 'WR', 'TE'].includes(initial.position) ? initial.position : 'RB');
  const [view, setView] = useState<ViewMode>(['FIRE', 'DELTA', 'WATCHLIST'].includes(initial.view) ? initial.view : 'FIRE');
  const [direction, setDirection] = useState<DirectionFilter>(initial.direction);
  const [confidence, setConfidence] = useState<ConfidenceFilter>(initial.confidence);
  const [sort, setSort] = useState<SortMode>(initial.sort);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [trends, setTrends] = useState<Record<string, any[]>>({});
  const [columnPreset, setColumnPreset] = useState<ColumnPreset>(() => {
    const saved = localStorage.getItem(PRESET_KEY);
    if (saved === 'BASIC' || saved === 'VOLUME' || saved === 'FULL') return saved;
    return 'VOLUME';
  });
  const [fireSortCol, setFireSortCol] = useState<string>('fire');
  const [fireSortAsc, setFireSortAsc] = useState(false);

  useEffect(() => {
    localStorage.setItem(PRESET_KEY, columnPreset);
  }, [columnPreset]);

  const visibleCols = useMemo(() =>
    FIRE_COLUMNS.filter((c) => c.preset.includes(columnPreset)),
    [columnPreset]
  );

  const weekMetaQuery = useQuery<{ metadata?: { weeksReturned?: { max?: number } } }>({
    queryKey: [`/api/fantasy-lab/weekly?season=${season}&limit=1`],
  });

  useEffect(() => {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setWatchlist(parsed.filter((v) => typeof v === 'string'));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    const maxWeek = weekMetaQuery.data?.metadata?.weeksReturned?.max;
    if (typeof maxWeek === 'number' && maxWeek >= 1 && maxWeek <= 18) {
      setWeek((prev) => Math.min(prev, maxWeek));
    }
  }, [weekMetaQuery.data]);

  useEffect(() => {
    const qs = new URLSearchParams();
    qs.set('season', String(season));
    qs.set('week', String(week));
    qs.set('pos', position);
    qs.set('view', view.toLowerCase());
    qs.set('dir', direction.toLowerCase());
    qs.set('conf', confidence.toLowerCase());
    qs.set('sort', sort.toLowerCase());
    window.history.replaceState({}, '', `/fantasy-lab?${qs.toString()}`);
  }, [season, week, position, view, direction, confidence, sort]);

  const fireQuery = useQuery<any>({
    queryKey: [`/api/fire/eg/batch?season=${season}&week=${week}&position=${position}`],
  });

  const deltaQuery = useQuery<any>({
    queryKey: [`/api/delta/eg/batch?season=${season}&week=${week}&position=${position}&limit=200`],
  });

  const fireRows = useMemo(() => {
    const rows = (fireQuery.data?.data || []).filter((r: any) => r.eligible && r.fireScore != null) as any[];
    const colDef = FIRE_COLUMNS.find((c) => c.key === fireSortCol);
    const sortFn = colDef?.sortKey;
    if (sortFn) {
      rows.sort((a, b) => fireSortAsc ? sortFn(a) - sortFn(b) : sortFn(b) - sortFn(a));
    } else {
      rows.sort((a, b) => (b.fireScore ?? -1) - (a.fireScore ?? -1));
    }
    return rows;
  }, [fireQuery.data, fireSortCol, fireSortAsc]);

  const deltaRowsRaw = useMemo(() => (deltaQuery.data?.data || []) as any[], [deltaQuery.data]);

  const deltaRows = useMemo(() => {
    let rows = [...deltaRowsRaw];
    if (direction !== 'ALL') rows = rows.filter((r) => r.delta?.direction === direction);
    if (confidence === 'HM') rows = rows.filter((r) => r.confidence === 'HIGH' || r.confidence === 'MED');
    if (confidence === 'HIGH') rows = rows.filter((r) => r.confidence === 'HIGH');

    if (sort === 'ZDESC') rows.sort((a, b) => (b?.delta?.rankZ ?? 0) - (a?.delta?.rankZ ?? 0));
    else if (sort === 'ZASC') rows.sort((a, b) => (a?.delta?.rankZ ?? 0) - (b?.delta?.rankZ ?? 0));
    else rows.sort((a, b) => Math.abs(b?.delta?.rankZ ?? 0) - Math.abs(a?.delta?.rankZ ?? 0));
    return rows;
  }, [deltaRowsRaw, direction, confidence, sort]);

  const watchRows = useMemo(() => {
    const byId = new Map(deltaRowsRaw.map((r) => [r.playerId, r]));
    return watchlist.map((id) => byId.get(id)).filter(Boolean) as any[];
  }, [watchlist, deltaRowsRaw]);

  useEffect(() => {
    const weekFrom = Math.max(1, week - 5);
    const load = async () => {
      const entries = await Promise.all(
        watchlist.map(async (playerId) => {
          try {
            const resp = await fetch(`/api/delta/eg/player-trend?season=${season}&playerId=${playerId}&weekFrom=${weekFrom}&weekTo=${week}`);
            if (!resp.ok) return [playerId, []] as const;
            const body = await resp.json();
            return [playerId, body.data || []] as const;
          } catch {
            return [playerId, []] as const;
          }
        })
      );
      setTrends(Object.fromEntries(entries));
    };
    if (watchlist.length) load();
    else setTrends({});
  }, [watchlist, season, week]);

  const isLoading = view === 'FIRE' ? fireQuery.isLoading : deltaQuery.isLoading;

  const toggleStar = (playerId: string) => {
    setWatchlist((prev) => prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]);
  };

  const handleFireSort = (colKey: string) => {
    if (fireSortCol === colKey) {
      setFireSortAsc(!fireSortAsc);
    } else {
      setFireSortCol(colKey);
      setFireSortAsc(false);
    }
  };

  const exportCsv = () => {
    let headers: string[] = [];
    let csvRows: string[][] = [];

    if (view === 'FIRE') {
      headers = visibleCols.map((c) => c.label);
      csvRows = fireRows.map((r) => visibleCols.map((c) => c.render(r)));
    } else if (view === 'DELTA') {
      headers = ['Player', 'Team', 'Confidence', 'Display Delta', 'Rank Z', 'Games', 'Direction', 'Why'];
      csvRows = deltaRows.map((r) => [
        r.playerName || r.playerId,
        r.team || '',
        r.confidence || '',
        num(r.delta?.displayPct),
        num(r.delta?.rankZ, 2),
        String(r.games_played_window ?? ''),
        r.delta?.direction || '',
        r.why?.note || '',
      ]);
    } else {
      headers = ['Player', 'Position', 'Rank Z', 'Display Pct'];
      csvRows = watchRows.map((r) => [
        r.playerName || r.playerId,
        r.position || '',
        num(r.delta?.rankZ, 2),
        num(r.delta?.displayPct, 1),
      ]);
    }

    const escape = (v: string) => v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    const csv = [headers.join(','), ...csvRows.map((row) => row.map(escape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fantasy-lab-${view.toLowerCase()}-${position}-wk${week}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Fantasy Lab</h1>
        <p className="text-sm text-gray-600">FIRE engine + FORGE/FIRE Hybrid Delta (RB/WR/TE only).</p>
        <p className="text-xs text-amber-700 mt-1">QB FIRE not available yet (QB xFP gap).</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white border rounded-lg p-3">
        <select value={season} onChange={(e) => setSeason(Number(e.target.value))} className="border rounded px-2 py-1">
          {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={week} onChange={(e) => setWeek(Number(e.target.value))} className="border rounded px-2 py-1">
          {weeks.map((w) => <option key={w} value={w}>Week {w}</option>)}
        </select>

        <div className="flex border rounded overflow-hidden">
          {(['RB', 'WR', 'TE'] as Position[]).map((p) => (
            <button key={p} onClick={() => setPosition(p)} className={`px-3 py-1 text-sm ${position === p ? 'bg-orange-600 text-white' : 'bg-white'}`}>{p}</button>
          ))}
        </div>

        <div className="flex border rounded overflow-hidden">
          {(['FIRE', 'DELTA', 'WATCHLIST'] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1 text-sm ${view === v ? 'bg-slate-900 text-white' : 'bg-white'}`}>{v}</button>
          ))}
        </div>

        {view === 'FIRE' && (
          <div className="flex border rounded overflow-hidden">
            {([['BASIC', 'Basic'], ['VOLUME', 'Volume'], ['FULL', 'Full']] as [ColumnPreset, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setColumnPreset(k)} className={`px-3 py-1 text-sm ${columnPreset === k ? 'bg-indigo-600 text-white' : 'bg-white hover:bg-gray-50'}`}>{label}</button>
            ))}
          </div>
        )}

        <button
          onClick={exportCsv}
          disabled={isLoading}
          className="ml-auto px-3 py-1 text-sm border rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      {view === 'DELTA' && (
        <div className="flex flex-wrap gap-3 bg-white border rounded-lg p-3">
          <select value={direction} onChange={(e) => setDirection(e.target.value as DirectionFilter)} className="border rounded px-2 py-1 text-sm">
            <option value="ALL">Direction: ALL</option>
            <option value="BUY_LOW">Direction: BUY_LOW</option>
            <option value="SELL_HIGH">Direction: SELL_HIGH</option>
            <option value="NEUTRAL">Direction: NEUTRAL</option>
          </select>
          <select value={confidence} onChange={(e) => setConfidence(e.target.value as ConfidenceFilter)} className="border rounded px-2 py-1 text-sm">
            <option value="ALL">Confidence: ALL</option>
            <option value="HM">Confidence: HIGH+MED</option>
            <option value="HIGH">Confidence: HIGH only</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="border rounded px-2 py-1 text-sm">
            <option value="ABSZ">Sort: abs(rankZ) desc</option>
            <option value="ZDESC">Sort: rankZ desc</option>
            <option value="ZASC">Sort: rankZ asc</option>
          </select>
        </div>
      )}

      {isLoading && <div className="text-sm text-gray-500">Loading...</div>}

      {!isLoading && view === 'FIRE' && (
        <div className="bg-white border rounded-lg overflow-auto">
          <div className="px-3 py-2 border-b text-xs text-gray-500 flex items-center justify-between">
            <span>{fireRows.length} eligible players &middot; {visibleCols.length} columns &middot; Click headers to sort</span>
            <span className="text-gray-400">PPR scoring &middot; Last {fireQuery.data?.metadata?.rollingWeeks?.length ?? 4} weeks</span>
          </div>
          {!fireRows.length ? (
            <div className="p-4 text-sm text-gray-500">No eligible players for this filter/window.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left sticky top-0 z-10">
                <tr>
                  <th className="p-2 w-8"></th>
                  {visibleCols.map((col) => (
                    <th
                      key={col.key}
                      className={`p-2 cursor-pointer select-none whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'} ${GROUP_COLORS[col.group] || ''}`}
                      onClick={() => col.sortKey && handleFireSort(col.key)}
                      title={col.label}
                    >
                      {col.shortLabel || col.label}
                      {fireSortCol === col.key && <span className="ml-1 text-orange-600">{fireSortAsc ? '▲' : '▼'}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fireRows.map((r) => (
                  <tr key={r.playerId} className="border-t hover:bg-gray-50">
                    <td className="p-2">
                      <button onClick={() => toggleStar(r.playerId)} className="text-lg leading-none">
                        {watchlist.includes(r.playerId) ? '★' : '☆'}
                      </button>
                    </td>
                    {visibleCols.map((col) => (
                      <td
                        key={col.key}
                        className={`p-2 whitespace-nowrap ${col.align === 'right' ? 'text-right tabular-nums' : ''} ${col.key === 'fire' ? 'font-semibold' : ''} ${col.key === 'conf' ? '' : ''}`}
                      >
                        {col.key === 'conf' ? (
                          <span className={`px-2 py-0.5 rounded text-xs ${confidenceClass(r.confidence)}`}>
                            {r.confidence || 'LOW'}
                          </span>
                        ) : col.key === 'fire' ? (
                          <span className={r.fireScore >= 80 ? 'text-emerald-700' : r.fireScore >= 60 ? 'text-blue-700' : r.fireScore >= 40 ? 'text-gray-800' : 'text-red-600'}>
                            {col.render(r)}
                          </span>
                        ) : col.key === 'boom' ? (
                          <span className={r.stats?.boomPct >= 50 ? 'text-emerald-700 font-medium' : ''}>
                            {col.render(r)}
                          </span>
                        ) : col.key === 'xfpDiff' ? (
                          <span className={(r.stats?.xfpDiff ?? 0) > 0 ? 'text-emerald-700' : (r.stats?.xfpDiff ?? 0) < -5 ? 'text-red-600' : ''}>
                            {col.render(r)}
                          </span>
                        ) : col.render(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!isLoading && view === 'DELTA' && (
        <>
          <div className="bg-white border rounded-lg p-3">
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="fire.pct" domain={[0, 100]}>
                    <Label value="FIRE percentile" offset={-5} position="insideBottom" />
                  </XAxis>
                  <YAxis type="number" dataKey="forge.pct" domain={[0, 100]}>
                    <Label value="FORGE percentile" angle={-90} position="insideLeft" />
                  </YAxis>
                  <Tooltip formatter={(value: any) => (typeof value === 'number' ? value.toFixed(2) : value)} content={({ active, payload }) => {
                    const p = payload?.[0]?.payload;
                    if (!active || !p) return null;
                    return (
                      <div className="bg-white border rounded p-2 text-xs shadow">
                        <div className="font-semibold">{p.playerName || p.playerId} ({p.team || '—'} {p.position})</div>
                        <div>forge.pct: {num(p.forge?.pct, 1)} | fire.pct: {num(p.fire?.pct, 1)}</div>
                        <div>displayPct: {num(p.delta?.displayPct, 1)} | rankZ: {num(p.delta?.rankZ, 2)}</div>
                        <div>games: {p.games_played_window} | xfp_R: {num(p.why?.xfp_R, 2)} | snaps_R: {num(p.why?.snaps_R, 0)}</div>
                      </div>
                    );
                  }} />
                  <Scatter data={deltaRows} fill="#64748b" onClick={(p: any) => setSelectedPlayerId(p?.playerId)} shape={(props: any) => {
                    const payload = props?.payload;
                    if (!payload) return <circle cx={props.cx} cy={props.cy} r={0} fill="transparent" />;
                    const color = payload.delta?.direction === 'BUY_LOW' ? '#16a34a' : payload.delta?.direction === 'SELL_HIGH' ? '#dc2626' : '#64748b';
                    const faded = payload.confidence === 'LOW' ? 0.35 : 0.9;
                    return <circle cx={props.cx} cy={props.cy} r={selectedPlayerId === payload.playerId ? 6 : 4} fill={color} fillOpacity={faded} stroke={selectedPlayerId === payload.playerId ? '#111827' : 'none'} />;
                  }} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 mt-2">
              <div>Top-left: Football &gt; Opportunity (Buy-Low)</div>
              <div>Bottom-right: Opportunity &gt; Football (Sell-High)</div>
              <div>Top-right: Studs (High/High)</div>
              <div>Bottom-left: Avoid (Low/Low)</div>
            </div>
          </div>

          <div className="bg-white border rounded-lg overflow-auto">
            {!deltaRows.length ? (
              <div className="p-4 text-sm text-gray-500">No eligible players for this filter/window.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="p-2">★</th><th className="p-2">Player</th><th className="p-2">Team</th><th className="p-2">Confidence</th><th className="p-2">Display Delta</th><th className="p-2">Rank Delta (z)</th><th className="p-2">Games</th><th className="p-2">Badge</th><th className="p-2">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {deltaRows.map((r) => (
                    <tr key={r.playerId} className={`border-t ${selectedPlayerId === r.playerId ? 'bg-blue-50' : ''}`} onClick={() => setSelectedPlayerId(r.playerId)}>
                      <td className="p-2"><button onClick={(e) => { e.stopPropagation(); toggleStar(r.playerId); }}>{watchlist.includes(r.playerId) ? '★' : '☆'}</button></td>
                      <td className="p-2">{r.playerName || r.playerId}</td>
                      <td className="p-2">{r.team || '—'}</td>
                      <td className="p-2"><span className={`px-2 py-1 rounded text-xs ${confidenceClass(r.confidence)}`}>{r.confidence}</span></td>
                      <td className="p-2">{num(r.delta?.displayPct)}</td>
                      <td className="p-2">{num(r.delta?.rankZ, 2)}</td>
                      <td className="p-2">{r.games_played_window}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${r.delta?.direction === 'BUY_LOW' ? 'bg-green-100 text-green-700' : r.delta?.direction === 'SELL_HIGH' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{r.delta?.direction}</span>
                      </td>
                      <td className="p-2 text-xs text-gray-600">{r.why?.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {view === 'WATCHLIST' && (
        <div className="bg-white border rounded-lg overflow-auto">
          {!watchRows.length ? (
            <div className="p-4 text-sm text-gray-500">No starred players yet. Use ☆ in FIRE/DELTA tables.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-2">Player</th><th className="p-2">Position</th><th className="p-2">Current rankZ</th><th className="p-2">Current displayPct</th><th className="p-2">Trend (last 6 anchors)</th>
                </tr>
              </thead>
              <tbody>
                {watchRows.map((r) => (
                  <tr key={r.playerId} className="border-t align-top">
                    <td className="p-2">{r.playerName || r.playerId} <button className="ml-2" onClick={() => toggleStar(r.playerId)}>★</button></td>
                    <td className="p-2">{r.position}</td>
                    <td className="p-2">{num(r.delta?.rankZ, 2)}</td>
                    <td className="p-2">{num(r.delta?.displayPct, 1)}</td>
                    <td className="p-2 text-xs">
                      {(trends[r.playerId] || []).map((t) => `W${t.weekAnchor}: forge ${num(t.forgePct)} / fire ${num(t.firePct)} / z ${num(t.rankZ, 2)} / Δ ${num(t.displayPct)}`).join(' | ') || 'Loading trend...'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
