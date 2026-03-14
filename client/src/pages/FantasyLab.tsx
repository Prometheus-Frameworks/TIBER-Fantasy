import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from 'recharts';

type Position = 'QB' | 'RB' | 'WR' | 'TE';
type ViewMode = 'FIRE' | 'DELTA' | 'WATCHLIST';
type DirectionFilter = 'ALL' | 'BUY_LOW' | 'SELL_HIGH' | 'NEUTRAL';
type ConfidenceFilter = 'ALL' | 'HM' | 'HIGH';
type SortMode = 'ABSZ' | 'ZDESC' | 'ZASC';
type ColumnPreset = 'BASIC' | 'VOLUME' | 'FULL';

const seasons = [2025, 2024, 2023];
const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
const WATCHLIST_KEY = 'fantasy-lab-watchlist-v1';
const PRESET_KEY = 'fantasy-lab-preset-v1';
const WR_MAIN_COLUMN_KEYS = ['rank', 'player', 'team', 'fire', 'role', 'catalyst', 'conf', 'snapPct', 'tgtGm', 'recYG', 'fpg'] as const;

function num(v: unknown, digits = 1): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return v.toFixed(digits);
}

function pct(v: unknown): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return v.toFixed(0) + '%';
}

function meaningfulValue(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    return trimmed.length > 0 && trimmed !== '—' && trimmed.toLowerCase() !== 'nan';
  }
  if (typeof v === 'number') return !Number.isNaN(v);
  return true;
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
  positions?: Position[];
}

const FIRE_COLUMNS: ColDef[] = [
  { key: 'rank', label: 'Rank', group: 'identity', render: (r) => r.fireRank != null ? `#${r.fireRank}` : '—', align: 'right', sortKey: (r) => r.fireRank ?? 999, preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'player', label: 'Player', group: 'identity', render: (r) => r.playerName || r.playerId, align: 'left', preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'team', label: 'Team', group: 'identity', render: (r) => r.team || '—', align: 'left', preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'fire', label: 'FIRE', group: 'identity', render: (r) => num(r.fireScore), align: 'right', sortKey: (r) => r.fireScore ?? -1, preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'opp', label: 'Opportunity', group: 'fire', render: (r) => num(r.pillars?.opportunity), align: 'right', sortKey: (r) => r.pillars?.opportunity ?? -1, preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'role', label: 'Role', group: 'fire', render: (r) => num(r.pillars?.role), align: 'right', sortKey: (r) => r.pillars?.role ?? -1, preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'conv', label: 'Conversion', group: 'fire', render: (r) => num(r.pillars?.conversion), align: 'right', sortKey: (r) => r.pillars?.conversion ?? -1, preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'catalyst', label: 'CATALYST', group: 'fire', render: (r) => r._catalystAlpha != null ? r._catalystAlpha.toFixed(0) : '—', align: 'right', sortKey: (r) => r._catalystAlpha ?? -1, preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'conf', label: 'Confidence', group: 'fire', render: (r) => r.confidence || 'LOW', align: 'left', preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'games', label: 'Games', group: 'games', render: (r) => String(r.games_played_window ?? '—'), align: 'right', sortKey: (r) => r.games_played_window ?? 0, preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'snaps', label: 'Snaps', group: 'games', render: (r) => num(r.raw?.snaps_R, 0), align: 'right', sortKey: (r) => r.raw?.snaps_R ?? 0, preset: ['VOLUME', 'FULL'] },
  { key: 'snapPct', label: 'Snap %', group: 'games', render: (r) => pct(r.stats?.snapPct), align: 'right', sortKey: (r) => r.stats?.snapPct ?? 0, preset: ['BASIC', 'VOLUME', 'FULL'] },

  { key: 'passAttGm', label: 'Pass Att/G', shortLabel: 'PA/G', group: 'volume', render: (r) => num(r.stats?.passAttPerGame), align: 'right', sortKey: (r) => r.stats?.passAttPerGame ?? 0, preset: ['BASIC', 'VOLUME', 'FULL'], positions: ['QB'] },
  { key: 'compPct', label: 'Comp %', group: 'efficiency', render: (r) => pct(r.stats?.compPct), align: 'right', sortKey: (r) => r.stats?.compPct ?? 0, preset: ['BASIC', 'VOLUME', 'FULL'], positions: ['QB'] },
  { key: 'passYG', label: 'Pass Y/G', group: 'production', render: (r) => num(r.stats?.passYdsPerGame), align: 'right', sortKey: (r) => r.stats?.passYdsPerGame ?? 0, preset: ['BASIC', 'VOLUME', 'FULL'], positions: ['QB'] },
  { key: 'passTdGm', label: 'Pass TD/G', shortLabel: 'PTD/G', group: 'production', render: (r) => num(r.stats?.passTdPerGame, 2), align: 'right', sortKey: (r) => r.stats?.passTdPerGame ?? 0, preset: ['BASIC', 'VOLUME', 'FULL'], positions: ['QB'] },
  { key: 'intGm', label: 'INT/G', group: 'consistency', render: (r) => num(r.stats?.intPerGame, 2), align: 'right', sortKey: (r) => r.stats?.intPerGame ?? 0, preset: ['BASIC', 'VOLUME', 'FULL'], positions: ['QB'] },
  { key: 'qbRushAttGm', label: 'Rush Att/G', shortLabel: 'RAtt/G', group: 'volume', render: (r) => num(r.stats?.rushAttPerGame), align: 'right', sortKey: (r) => r.stats?.rushAttPerGame ?? 0, preset: ['VOLUME', 'FULL'], positions: ['QB'] },
  { key: 'qbRushYG', label: 'Rush Y/G', group: 'production', render: (r) => num(r.stats?.rushYdsPerGame), align: 'right', sortKey: (r) => r.stats?.rushYdsPerGame ?? 0, preset: ['VOLUME', 'FULL'], positions: ['QB'] },
  { key: 'qbRushTdGm', label: 'Rush TD/G', shortLabel: 'RTD/G', group: 'production', render: (r) => num(r.stats?.rushTdPerGame, 2), align: 'right', sortKey: (r) => r.stats?.rushTdPerGame ?? 0, preset: ['VOLUME', 'FULL'], positions: ['QB'] },

  { key: 'carGm', label: 'Car/G', group: 'volume', render: (r) => num(r.stats?.carriesPerGame), align: 'right', sortKey: (r) => r.stats?.carriesPerGame ?? 0, preset: ['VOLUME', 'FULL'], positions: ['RB', 'WR', 'TE'] },
  { key: 'tgtGm', label: 'Tgt/G', group: 'volume', render: (r) => num(r.stats?.targetsPerGame), align: 'right', sortKey: (r) => r.stats?.targetsPerGame ?? 0, preset: ['VOLUME', 'FULL'], positions: ['RB', 'WR', 'TE'] },
  { key: 'tchGm', label: 'Tch/G', group: 'volume', render: (r) => num(r.stats?.touchesPerGame), align: 'right', sortKey: (r) => r.stats?.touchesPerGame ?? 0, preset: ['VOLUME', 'FULL'], positions: ['RB', 'WR', 'TE'] },
  { key: 'rushSh', label: 'Rush Share %', shortLabel: 'Rush %', group: 'volume', render: (r) => pct(r.stats?.rushSharePct), align: 'right', sortKey: (r) => r.stats?.rushSharePct ?? 0, preset: ['VOLUME', 'FULL'], positions: ['RB', 'WR', 'TE'] },
  { key: 'tgtSh', label: 'Target Share %', shortLabel: 'Tgt %', group: 'volume', render: (r) => pct(r.stats?.targetSharePct), align: 'right', sortKey: (r) => r.stats?.targetSharePct ?? 0, preset: ['VOLUME', 'FULL'], positions: ['RB', 'WR', 'TE'] },
  { key: 'ypc', label: 'YPC', group: 'efficiency', render: (r) => num(r.stats?.ypc), align: 'right', sortKey: (r) => r.stats?.ypc ?? 0, preset: ['VOLUME', 'FULL'], positions: ['RB', 'WR', 'TE'] },
  { key: 'ypr', label: 'YPR', group: 'efficiency', render: (r) => num(r.stats?.ypr), align: 'right', sortKey: (r) => r.stats?.ypr ?? 0, preset: ['FULL'], positions: ['RB', 'WR', 'TE'] },
  { key: 'rushYG', label: 'Rush Y/G', group: 'production', render: (r) => num(r.stats?.rushYdsPerGame), align: 'right', sortKey: (r) => r.stats?.rushYdsPerGame ?? 0, preset: ['FULL'], positions: ['RB', 'WR', 'TE'] },
  { key: 'recYG', label: 'Rec Y/G', group: 'production', render: (r) => num(r.stats?.recYdsPerGame), align: 'right', sortKey: (r) => r.stats?.recYdsPerGame ?? 0, preset: ['FULL'], positions: ['RB', 'WR', 'TE'] },
  { key: 'tds', label: 'TDs', group: 'production', render: (r) => String(r.stats?.totalTds ?? '—'), align: 'right', sortKey: (r) => r.stats?.totalTds ?? 0, preset: ['VOLUME', 'FULL'] },
  { key: 'fpg', label: 'FPPG', group: 'production', render: (r) => num(r.stats?.fantasyPpg), align: 'right', sortKey: (r) => r.stats?.fantasyPpg ?? 0, preset: ['BASIC', 'VOLUME', 'FULL'] },
  { key: 'xfpDiff', label: 'xFP Diff', group: 'production', render: (r) => num(r.stats?.xfpDiff), align: 'right', sortKey: (r) => r.stats?.xfpDiff ?? 0, preset: ['FULL'] },
  { key: 'fpSd', label: 'FP Std Dev', group: 'consistency', render: (r) => num(r.stats?.fpStdDev), align: 'right', sortKey: (r) => r.stats?.fpStdDev ?? 0, preset: ['VOLUME', 'FULL'] },
  { key: 'boom', label: 'Boom %', group: 'consistency', render: (r) => pct(r.stats?.boomPct), align: 'right', sortKey: (r) => r.stats?.boomPct ?? 0, preset: ['VOLUME', 'FULL'] },
  { key: 'rzSh', label: 'RZ Touch %', group: 'consistency', render: (r) => pct(r.stats?.rzTouchSharePct), align: 'right', sortKey: (r) => r.stats?.rzTouchSharePct ?? 0, preset: [], positions: ['RB', 'WR', 'TE'] },
];

const CURATED_COL_KEYS: Record<Position, string[]> = {
  QB:  ['rank', 'player', 'team', 'fire', 'role', 'catalyst', 'conf', 'snapPct', 'passAttGm', 'passYG', 'fpg'],
  RB:  ['rank', 'player', 'team', 'fire', 'role', 'catalyst', 'conf', 'snapPct', 'carGm', 'rushYG', 'fpg'],
  WR:  ['rank', 'player', 'team', 'fire', 'role', 'catalyst', 'conf', 'snapPct', 'tgtGm', 'recYG', 'fpg'],
  TE:  ['rank', 'player', 'team', 'fire', 'role', 'catalyst', 'conf', 'snapPct', 'tgtGm', 'recYG', 'fpg'],
};

function getCuratedCols(pos: Position): ColDef[] {
  return CURATED_COL_KEYS[pos].map((k) => FIRE_COLUMNS.find((c) => c.key === k)!).filter(Boolean);
}

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

function fireColor(score: number) {
  if (score >= 80) return 'text-emerald-700';
  if (score >= 60) return 'text-blue-700';
  if (score >= 40) return 'text-gray-800';
  return 'text-red-600';
}

function catalystBadgeClass(v: number) {
  if (v >= 65) return 'bg-emerald-100 text-emerald-800';
  if (v >= 45) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-700';
}

function DetailTile({ label, value }: { label: string; value: string }) {
  if (!meaningfulValue(value)) return null;
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-xs font-medium tabular-nums text-gray-800">{value}</span>
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? (children as React.ReactNode[]).flat() : [children];
  if (!arr.some(Boolean)) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{title}</div>
      {children}
    </div>
  );
}

function SummaryCard({ row, position }: { row: any; position: Position }) {
  const name = row.playerName || row.playerId;
  const team = row.team || '—';
  const conf = row.confidence || 'LOW';
  const role = num(row.pillars?.role);
  const snapPct = pct(row.stats?.snapPct);
  const tgtShare = pct(row.stats?.targetSharePct);
  const rushShare = pct(row.stats?.rushSharePct);

  const shareTag = position === 'QB' ? null
    : (position === 'RB') ? (meaningfulValue(rushShare) ? `${rushShare} rush share` : null)
    : (meaningfulValue(tgtShare) ? `${tgtShare} tgt share` : null);

  return (
    <div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-semibold text-sm text-gray-900 leading-tight">{name}</div>
          <div className="text-xs text-gray-400 mt-0.5">{team} &middot; {position}</div>
        </div>
        <span className={`text-base font-bold tabular-nums ${fireColor(row.fireScore)}`}>{num(row.fireScore)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {meaningfulValue(role) && (
          <span className="px-2 py-0.5 rounded text-xs bg-orange-50 text-orange-700 border border-orange-100">Role {role}</span>
        )}
        {row._catalystAlpha != null && (
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${catalystBadgeClass(row._catalystAlpha)}`}>
            CAT {row._catalystAlpha.toFixed(0)}
          </span>
        )}
        <span className={`px-2 py-0.5 rounded text-xs ${confidenceClass(conf)}`}>{conf}</span>
        {meaningfulValue(snapPct) && (
          <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-100">{snapPct} snaps</span>
        )}
        {shareTag && (
          <span className="px-2 py-0.5 rounded text-xs bg-green-50 text-green-700 border border-green-100">{shareTag}</span>
        )}
      </div>
    </div>
  );
}

function QBDetailCards({ row }: { row: any }) {
  const sampleGames = row.games_played_window != null ? String(row.games_played_window) : '—';
  return (
    <>
      <DetailCard title="Passing">
        <DetailTile label="Pass Att / G" value={num(row.stats?.passAttPerGame)} />
        <DetailTile label="Comp %" value={pct(row.stats?.compPct)} />
        <DetailTile label="Pass Y / G" value={num(row.stats?.passYdsPerGame)} />
        <DetailTile label="Pass TD / G" value={num(row.stats?.passTdPerGame, 2)} />
        <DetailTile label="INT / G" value={num(row.stats?.intPerGame, 2)} />
        <DetailTile label="FPPG" value={num(row.stats?.fantasyPpg)} />
      </DetailCard>
      <DetailCard title="Rushing">
        <DetailTile label="Rush Att / G" value={num(row.stats?.rushAttPerGame)} />
        <DetailTile label="Rush Y / G" value={num(row.stats?.rushYdsPerGame)} />
        <DetailTile label="Rush TD / G" value={num(row.stats?.rushTdPerGame, 2)} />
      </DetailCard>
      <DetailCard title="Model">
        <DetailTile label="Opportunity" value={num(row.pillars?.opportunity)} />
        <DetailTile label="Conversion" value={num(row.pillars?.conversion)} />
        <DetailTile label="xFP Diff" value={num(row.stats?.xfpDiff)} />
        <DetailTile label="FP Std Dev" value={num(row.stats?.fpStdDev)} />
        <DetailTile label="Sample Games" value={sampleGames} />
      </DetailCard>
    </>
  );
}

function RBDetailCards({ row }: { row: any }) {
  const sampleGames = row.games_played_window != null ? String(row.games_played_window) : '—';
  return (
    <>
      <DetailCard title="Usage">
        <DetailTile label="Snaps" value={num(row.raw?.snaps_R, 0)} />
        <DetailTile label="Car / G" value={num(row.stats?.carriesPerGame)} />
        <DetailTile label="Tch / G" value={num(row.stats?.touchesPerGame)} />
        <DetailTile label="Tgt / G" value={num(row.stats?.targetsPerGame)} />
        <DetailTile label="Rush Share" value={pct(row.stats?.rushSharePct)} />
        <DetailTile label="Sample Games" value={sampleGames} />
      </DetailCard>
      <DetailCard title="Efficiency">
        <DetailTile label="Rush Y / G" value={num(row.stats?.rushYdsPerGame)} />
        <DetailTile label="YPC" value={num(row.stats?.ypc)} />
        <DetailTile label="Rec / G" value={num(row.stats?.recsPerGame ?? row.stats?.receptionsPerGame)} />
        <DetailTile label="Rec Y / G" value={num(row.stats?.recYdsPerGame)} />
        <DetailTile label="Boom %" value={pct(row.stats?.boomPct)} />
        <DetailTile label="FPPG" value={num(row.stats?.fantasyPpg)} />
      </DetailCard>
      <DetailCard title="Model">
        <DetailTile label="Opportunity" value={num(row.pillars?.opportunity)} />
        <DetailTile label="Conversion" value={num(row.pillars?.conversion)} />
        <DetailTile label="xFP Diff" value={num(row.stats?.xfpDiff)} />
        <DetailTile label="FP Std Dev" value={num(row.stats?.fpStdDev)} />
      </DetailCard>
    </>
  );
}

function ReceiverDetailCards({ row, position }: { row: any; position: 'WR' | 'TE' }) {
  const sampleGames = row.games_played_window != null ? String(row.games_played_window) : '—';
  return (
    <>
      <DetailCard title="Usage">
        <DetailTile label="Snaps" value={num(row.raw?.snaps_R, 0)} />
        {position === 'WR' && <DetailTile label="Routes / G" value={num(row.stats?.routesPerGame)} />}
        <DetailTile label="Tgt / G" value={num(row.stats?.targetsPerGame)} />
        <DetailTile label="Tch / G" value={num(row.stats?.touchesPerGame)} />
        {position === 'WR' && <DetailTile label="Car / G" value={num(row.stats?.carriesPerGame)} />}
        <DetailTile label="Target Share" value={pct(row.stats?.targetSharePct)} />
        <DetailTile label="Sample Games" value={sampleGames} />
      </DetailCard>
      <DetailCard title="Efficiency">
        <DetailTile label="Rec / G" value={num(row.stats?.recsPerGame ?? row.stats?.receptionsPerGame)} />
        <DetailTile label="Rec Y / G" value={num(row.stats?.recYdsPerGame)} />
        <DetailTile label="YPR" value={num(row.stats?.ypr)} />
        <DetailTile label="TD / G" value={num(row.stats?.recTdPerGame ?? row.stats?.tdPerGame, 2)} />
        <DetailTile label="Boom %" value={pct(row.stats?.boomPct)} />
        <DetailTile label="FPPG" value={num(row.stats?.fantasyPpg)} />
      </DetailCard>
      <DetailCard title="Model">
        <DetailTile label="Opportunity" value={num(row.pillars?.opportunity)} />
        <DetailTile label="Conversion" value={num(row.pillars?.conversion)} />
        <DetailTile label="xFP Diff" value={num(row.stats?.xfpDiff)} />
        <DetailTile label="FP Std Dev" value={num(row.stats?.fpStdDev)} />
      </DetailCard>
    </>
  );
}

function PositionDetailPanel({ row, position }: { row: any; position: Position }) {
  return (
    <div className="flex flex-col gap-3">
      <SummaryCard row={row} position={position} />
      {position === 'QB' && <QBDetailCards row={row} />}
      {position === 'RB' && <RBDetailCards row={row} />}
      {(position === 'WR' || position === 'TE') && <ReceiverDetailCards row={row} position={position} />}
    </div>
  );
}

export default function FantasyLab() {
  const initial = parseParams();
  const [season, setSeason] = useState(initial.season);
  const [week, setWeek] = useState(initial.week);
  const [position, setPosition] = useState<Position>(['QB', 'RB', 'WR', 'TE'].includes(initial.position) ? initial.position : 'RB');
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
    FIRE_COLUMNS.filter((c) => c.preset.includes(columnPreset) && (!c.positions || c.positions.includes(position))),
    [columnPreset, position]
  );
  const wrMainCols = useMemo(() => FIRE_COLUMNS.filter((c) => WR_MAIN_COLUMN_KEYS.includes(c.key as (typeof WR_MAIN_COLUMN_KEYS)[number])), []);

  const weekMetaQuery = useQuery<{ metadata?: { weeksReturned?: { max?: number } } }>({
    queryKey: [`/api/fantasy-lab/weekly?season=${season}&limit=1`],
  });

  useEffect(() => {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setWatchlist(parsed.filter((v) => typeof v === 'string'));
    } catch { }
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

  const catalystQuery = useQuery<any>({
    queryKey: ['/api/catalyst/batch', position, season],
    queryFn: async () => {
      const res = await fetch(`/api/catalyst/batch?position=${position}&season=${season}&limit=300`);
      return res.json();
    },
  });

  const deltaQuery = useQuery<any>({
    queryKey: [`/api/delta/eg/batch?season=${season}&week=${week}&position=${position}&limit=200`],
  });

  const fireRows = useMemo(() => {
    const rows = (fireQuery.data?.data || []).filter((r: any) => r.eligible && r.fireScore != null) as any[];
    const catalystMap = new Map<string, number>();
    for (const cp of (catalystQuery.data?.players || [])) {
      catalystMap.set(cp.gsis_id, cp.catalyst_alpha);
    }
    for (const r of rows) {
      r._catalystAlpha = catalystMap.get(r.playerId) ?? null;
    }
    const colDef = FIRE_COLUMNS.find((c) => c.key === fireSortCol);
    const sortFn = colDef?.sortKey;
    if (sortFn) {
      rows.sort((a, b) => fireSortAsc ? sortFn(a) - sortFn(b) : sortFn(b) - sortFn(a));
    } else {
      rows.sort((a, b) => (b.fireScore ?? -1) - (a.fireScore ?? -1));
    }
    return rows;
  }, [fireQuery.data, catalystQuery.data, fireSortCol, fireSortAsc]);

  const activeFireColumns = useMemo(() => {
    if (position === 'WR') return wrMainCols;
    return visibleCols;
  }, [position, visibleCols, wrMainCols]);

  const selectedFireRow = useMemo(
    () => (view === 'FIRE' ? fireRows.find((row) => row.playerId === selectedPlayerId) ?? null : null),
    [fireRows, selectedPlayerId, view]
  );

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

  useEffect(() => {
    if (view !== 'FIRE' || position !== 'WR') return;
    if (!fireRows.length) {
      setSelectedPlayerId(null);
      return;
    }
    const hasSelection = selectedPlayerId && fireRows.some((r) => r.playerId === selectedPlayerId);
    if (!hasSelection) {
      setSelectedPlayerId(fireRows[0].playerId);
    }
  }, [fireRows, selectedPlayerId, view, position]);

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

  const curatedCols = getCuratedCols(position);

  const exportCsv = () => {
    let headers: string[] = [];
    let csvRows: string[][] = [];

    if (view === 'FIRE') {
      headers = activeFireColumns.map((c) => c.label);
      csvRows = fireRows.map((r) => activeFireColumns.map((c) => c.render(r)));
    } else if (view === 'DELTA') {
      headers = ['Player', 'Team', 'Confidence', 'Display Delta', 'Rank Z', 'Sample Games', 'Direction', 'Why'];
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
        <p className="text-sm text-gray-600">FIRE engine + FORGE/FIRE Hybrid Delta for all skill positions.</p>
        {position === 'QB' && <p className="text-xs text-amber-700 mt-1">QB FIRE uses 3-pillar scoring: Opportunity (60%) + Role (25%) + Conversion (15%). Conversion measures production vs expectation.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white border rounded-lg p-3">
        <select value={season} onChange={(e) => setSeason(Number(e.target.value))} className="border rounded px-2 py-1">
          {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={week} onChange={(e) => setWeek(Number(e.target.value))} className="border rounded px-2 py-1">
          {weeks.map((w) => <option key={w} value={w}>Week {w}</option>)}
        </select>

        <div className="flex border rounded overflow-hidden">
          {(['QB', 'RB', 'WR', 'TE'] as Position[]).map((p) => (
            <button key={p} onClick={() => setPosition(p)} className={`px-3 py-1 text-sm ${position === p ? 'bg-orange-600 text-white' : 'bg-white'}`}>{p}</button>
          ))}
        </div>

        <div className="flex border rounded overflow-hidden">
          {(['FIRE', 'DELTA', 'WATCHLIST'] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1 text-sm ${view === v ? 'bg-slate-900 text-white' : 'bg-white'}`}>{v}</button>
          ))}
        </div>

        {view === 'FIRE' && position !== 'WR' && (
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="bg-white border rounded-lg overflow-auto">
            <div className="px-3 py-2 border-b text-xs text-gray-500 flex items-center justify-between">
              <span>{fireRows.length} eligible players &middot; {activeFireColumns.length} columns &middot; Click headers to sort</span>
              <span className="text-gray-400">PPR scoring &middot; Last {fireQuery.data?.metadata?.rollingWeeks?.length ?? 4} weeks</span>
            </div>
            {!fireRows.length ? (
              <div className="p-4 text-sm text-gray-500">No eligible players for this filter/window.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left sticky top-0 z-10">
                  <tr>
                    <th className="p-2 w-8"></th>
                    {activeFireColumns.map((col) => (
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
                  {fireRows.map((r) => {
                    const isSelected = selectedPlayerId === r.playerId;
                    return (
                      <tr
                        key={r.playerId}
                        className={`border-t hover:bg-gray-50 cursor-pointer ${position === 'WR' && isSelected ? 'bg-orange-50/60 ring-1 ring-inset ring-orange-200' : ''}`}
                        onClick={() => position === 'WR' && setSelectedPlayerId(r.playerId)}
                      >
                        <td className="p-2">
                          <button onClick={(e) => { e.stopPropagation(); toggleStar(r.playerId); }} className="text-lg leading-none">
                            {watchlist.includes(r.playerId) ? '★' : '☆'}
                          </button>
                        </td>
                        {activeFireColumns.map((col) => (
                          <td
                            key={col.key}
                            className={`p-2 whitespace-nowrap ${col.align === 'right' ? 'text-right tabular-nums' : ''} ${col.key === 'fire' ? 'font-semibold' : ''}`}
                          >
                            {col.key === 'catalyst' ? (
                              r._catalystAlpha != null ? (
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r._catalystAlpha >= 65 ? 'bg-emerald-100 text-emerald-800' : r._catalystAlpha >= 45 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>
                                  {r._catalystAlpha.toFixed(0)}
                                </span>
                              ) : <span className="text-gray-400">—</span>
                            ) : col.key === 'conf' ? (
                              <span className={`px-2 py-0.5 rounded text-xs ${confidenceClass(r.confidence)}`}>
                                {r.confidence || 'LOW'}
                              </span>
                            ) : col.key === 'fire' ? (
                              <span className={r.fireScore >= 80 ? 'text-emerald-700' : r.fireScore >= 60 ? 'text-blue-700' : r.fireScore >= 40 ? 'text-gray-800' : 'text-red-600'}>
                                {col.render(r)}
                              </span>
                            ) : col.render(r)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {position === 'WR' && (
            <div className="bg-white border rounded-lg p-3 space-y-3 h-fit">
              {!selectedFireRow ? (
                <div className="text-sm text-gray-500">Select a player to view details.</div>
              ) : (
                <>
                  <section className="border rounded-md p-3 bg-slate-50">
                    <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Summary</h3>
                    <div className="text-sm font-semibold text-gray-900">{selectedFireRow.playerName || selectedFireRow.playerId}</div>
                    <div className="text-xs text-gray-500 mb-2">{selectedFireRow.team || '—'} · WR</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>FIRE: <span className="font-mono">{num(selectedFireRow.fireScore)}</span></div>
                      <div>Role: <span className="font-mono">{num(selectedFireRow.pillars?.role)}</span></div>
                      <div>CATALYST: <span className="font-mono">{selectedFireRow._catalystAlpha != null ? selectedFireRow._catalystAlpha.toFixed(0) : '—'}</span></div>
                      <div>Confidence: <span className="font-mono">{selectedFireRow.confidence || 'LOW'}</span></div>
                      {meaningfulValue(selectedFireRow.stats?.snapPct) && <div>Snap %: <span className="font-mono">{pct(selectedFireRow.stats?.snapPct)}</span></div>}
                      {meaningfulValue(selectedFireRow.stats?.targetSharePct) && <div>Target Share: <span className="font-mono">{pct(selectedFireRow.stats?.targetSharePct)}</span></div>}
                    </div>
                  </section>

                  <section className="border rounded-md p-3">
                    <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Usage Detail</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {meaningfulValue(selectedFireRow.raw?.snaps_R) && <div>Snaps: <span className="font-mono">{num(selectedFireRow.raw?.snaps_R, 0)}</span></div>}
                      {meaningfulValue(selectedFireRow.stats?.routesPerGame) && <div>Routes / G: <span className="font-mono">{num(selectedFireRow.stats?.routesPerGame)}</span></div>}
                      {meaningfulValue(selectedFireRow.stats?.touchesPerGame) && <div>Tch / G: <span className="font-mono">{num(selectedFireRow.stats?.touchesPerGame)}</span></div>}
                      {meaningfulValue(selectedFireRow.stats?.carriesPerGame) && <div>Car / G: <span className="font-mono">{num(selectedFireRow.stats?.carriesPerGame)}</span></div>}
                      {meaningfulValue(selectedFireRow.stats?.targetSharePct) && <div>Target Share: <span className="font-mono">{pct(selectedFireRow.stats?.targetSharePct)}</span></div>}
                      {meaningfulValue(selectedFireRow.games_played_window) && <div>Sample Games: <span className="font-mono">{String(selectedFireRow.games_played_window)}</span></div>}
                    </div>
                  </section>

                  <section className="border rounded-md p-3">
                    <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Efficiency Detail</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {meaningfulValue(selectedFireRow.stats?.receptionsPerGame) && <div>Rec / G: <span className="font-mono">{num(selectedFireRow.stats?.receptionsPerGame)}</span></div>}
                      {meaningfulValue(selectedFireRow.stats?.recYdsPerGame) && <div>Rec Y / G: <span className="font-mono">{num(selectedFireRow.stats?.recYdsPerGame)}</span></div>}
                      {meaningfulValue(selectedFireRow.stats?.ypr) && <div>YPR: <span className="font-mono">{num(selectedFireRow.stats?.ypr)}</span></div>}
                      {meaningfulValue(selectedFireRow.stats?.tdPerGame) && <div>TD / G: <span className="font-mono">{num(selectedFireRow.stats?.tdPerGame, 2)}</span></div>}
                      {meaningfulValue(selectedFireRow.stats?.boomPct) && <div>Boom %: <span className="font-mono">{pct(selectedFireRow.stats?.boomPct)}</span></div>}
                      {meaningfulValue(selectedFireRow.stats?.fantasyPpg) && <div>FPPG: <span className="font-mono">{num(selectedFireRow.stats?.fantasyPpg)}</span></div>}
                    </div>
                  </section>

                  <section className="border rounded-md p-3">
                    <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Model Detail</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {meaningfulValue(selectedFireRow.pillars?.opportunity) && <div>Opportunity: <span className="font-mono">{num(selectedFireRow.pillars?.opportunity)}</span></div>}
                      {meaningfulValue(selectedFireRow.pillars?.conversion) && <div>Conversion: <span className="font-mono">{num(selectedFireRow.pillars?.conversion)}</span></div>}
                      {meaningfulValue(selectedFireRow.confidence) && <div>Confidence: <span className="font-mono">{selectedFireRow.confidence}</span></div>}
                      {meaningfulValue(selectedFireRow.stats?.xfpDiff) && <div>xFP Diff: <span className="font-mono">{num(selectedFireRow.stats?.xfpDiff)}</span></div>}
                      {meaningfulValue(selectedFireRow.stats?.fpStdDev) && <div>FP Std Dev: <span className="font-mono">{num(selectedFireRow.stats?.fpStdDev)}</span></div>}
                    </div>
                  </section>
                </>
              )}
            </div>
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
                        <div>sample games: {p.games_played_window} | xfp_R: {num(p.why?.xfp_R, 2)} | snaps_R: {num(p.why?.snaps_R, 0)}</div>
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
                    <th className="p-2">★</th><th className="p-2">Player</th><th className="p-2">Team</th><th className="p-2">Confidence</th><th className="p-2">Display Delta</th><th className="p-2">Rank Delta (z)</th><th className="p-2">Sample Games</th><th className="p-2">Badge</th><th className="p-2">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {deltaRows.map((r) => (
                    <tr key={r.playerId} className={`border-t cursor-pointer ${selectedPlayerId === r.playerId ? 'bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => setSelectedPlayerId(r.playerId)}>
                      <td className="p-2"><button onClick={(e) => { e.stopPropagation(); toggleStar(r.playerId); }}>{watchlist.includes(r.playerId) ? '★' : '☆'}</button></td>
                      <td className="p-2">{r.playerName || r.playerId}</td>
                      <td className="p-2">{r.team || '—'}</td>
                      <td className="p-2"><span className={`px-2 py-1 rounded text-xs ${confidenceClass(r.confidence)}`}>{r.confidence}</span></td>
                      <td className="p-2">{num(r.delta?.displayPct)}</td>
                      <td className="p-2">{num(r.delta?.rankZ, 2)}</td>
                      <td className="p-2">{r.games_played_window ?? '—'}</td>
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
