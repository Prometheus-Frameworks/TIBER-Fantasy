import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Zap, TrendingUp, ChevronUp, ChevronDown,
  Activity, Star, X, Ruler, Weight, Download
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Position = 'ALL' | 'QB' | 'RB' | 'WR' | 'TE';
type SortField = 'rookie_alpha' | 'tiber_ras_v2' | 'tiber_ras_v1' | 'proj_round' | 'production_score' | 'dominator_rating';
type ViewMode = 'alpha' | 'athleticism' | 'production';

interface RookiePlayer {
  rank: number;
  player_name: string;
  position: string;
  school: string | null;
  proj_round: number | null;
  height_inches: number | null;
  weight_lbs: number | null;
  forty_yard_dash: number | null;
  ten_yard_split: number | null;
  vertical_jump: number | null;
  broad_jump: number | null;
  short_shuttle: number | null;
  three_cone: number | null;
  tiber_ras_v1: number | null;
  tiber_ras_v2: number | null;
  production_score: number | null;
  dominator_rating: number | null;
  college_target_share: number | null;
  college_ypc: number | null;
  rookie_alpha: number | null;
  rookie_tier: string | null;
  athleticism_score: number | null;
  draft_capital_score: number | null;
}

interface RookieApiResponse {
  season: number;
  position: string;
  count: number;
  players: RookiePlayer[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? null : n;
}

function fmtN(v: number | string | null | undefined, d = 2): string {
  const n = toNum(v);
  return n === null ? '—' : n.toFixed(d);
}

function heightFt(inches: number | null | undefined): string {
  const n = toNum(inches);
  if (n === null) return '—';
  return `${Math.floor(n / 12)}'${Math.round(n % 12)}"`;
}

// ─── Grade systems ────────────────────────────────────────────────────────────
function rasGrade(score: number | string | null): { label: string; color: string } {
  const n = toNum(score);
  if (n === null) return { label: '—', color: 'text-slate-500' };
  if (n >= 9.0) return { label: 'ELITE', color: 'text-emerald-400' };
  if (n >= 8.0) return { label: 'GREAT', color: 'text-teal-400' };
  if (n >= 7.0) return { label: 'GOOD', color: 'text-blue-400' };
  if (n >= 5.5) return { label: 'AVG', color: 'text-amber-400' };
  if (n >= 4.0) return { label: 'BELOW', color: 'text-orange-400' };
  return { label: 'POOR', color: 'text-red-400' };
}

const TIER_META: Record<string, { color: string; bg: string; border: string }> = {
  T1: { color: 'text-emerald-300', bg: 'bg-emerald-900/40', border: 'border-emerald-700/50' },
  T2: { color: 'text-teal-300', bg: 'bg-teal-900/40', border: 'border-teal-700/50' },
  T3: { color: 'text-blue-300', bg: 'bg-blue-900/40', border: 'border-blue-700/50' },
  T4: { color: 'text-amber-300', bg: 'bg-amber-900/40', border: 'border-amber-700/50' },
  T5: { color: 'text-slate-400', bg: 'bg-slate-800/40', border: 'border-slate-600/50' },
};

// ─── Visual bars ──────────────────────────────────────────────────────────────
function rasBar(score: number | string | null, narrow = false) {
  const n = toNum(score);
  if (n === null) return null;
  const pctVal = Math.round((n / 10) * 100);
  const color =
    n >= 9.0 ? 'bg-emerald-500' : n >= 8.0 ? 'bg-teal-500' :
    n >= 7.0 ? 'bg-blue-500' : n >= 5.5 ? 'bg-amber-500' :
    n >= 4.0 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className={`${narrow ? 'w-10' : 'w-14'} h-1.5 bg-slate-700 rounded-full overflow-hidden`}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pctVal}%` }} />
      </div>
      <span className="text-xs text-slate-300 tabular-nums font-mono">{n.toFixed(2)}</span>
    </div>
  );
}

function scoreBar(score: number | string | null, maxVal = 100, narrow = false) {
  const n = toNum(score);
  if (n === null) return <span className="text-slate-600 text-xs">—</span>;
  const pctVal = Math.round((n / maxVal) * 100);
  const color =
    pctVal >= 85 ? 'bg-emerald-500' : pctVal >= 70 ? 'bg-teal-500' :
    pctVal >= 55 ? 'bg-blue-500' : pctVal >= 40 ? 'bg-amber-500' :
    pctVal >= 25 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className={`${narrow ? 'w-10' : 'w-14'} h-1.5 bg-slate-700 rounded-full overflow-hidden`}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pctVal}%` }} />
      </div>
      <span className="text-xs text-slate-300 tabular-nums font-mono">{n.toFixed(0)}</span>
    </div>
  );
}

function pillarBar(val: number | null, label: string, color: string) {
  if (val === null) return null;
  return (
    <div className="flex items-center gap-1">
      <span className="text-slate-600 text-xs w-9">{label}</span>
      <div className="w-10 h-1 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(val, 100)}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-400 font-mono w-6">{val}</span>
    </div>
  );
}

// ─── Player Drawer ────────────────────────────────────────────────────────────
function PlayerDrawer({ player, onClose }: { player: RookiePlayer; onClose: () => void }) {
  const tier = player.rookie_tier ?? 'T5';
  const tierMeta = TIER_META[tier] ?? TIER_META.T5;
  const rasGr = rasGrade(player.tiber_ras_v2);

  const alpha = toNum(player.rookie_alpha);
  const ras = toNum(player.athleticism_score);
  const prod = toNum(player.production_score);
  const dc = toNum(player.draft_capital_score);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-700 z-50 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
                {player.player_name}
              </h2>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${tierMeta.bg} ${tierMeta.color} ${tierMeta.border}`}>
                {tier}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold border ${
                { QB: 'bg-purple-900/50 text-purple-300 border-purple-700/50',
                  RB: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
                  WR: 'bg-amber-900/50 text-amber-300 border-amber-700/50',
                  TE: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50' }[player.position] ?? 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {player.position}
              </span>
              <span>{player.school ?? '—'}</span>
              {player.proj_round && <span className="text-slate-500">· Projected R{player.proj_round}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Rookie Alpha */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-[#e2640d]" />
                <span className="text-sm font-semibold text-slate-300">Rookie Alpha</span>
              </div>
              {alpha !== null && (
                <span className="text-2xl font-bold font-mono text-white">{alpha}</span>
              )}
            </div>
            {/* Full-width alpha bar */}
            {alpha !== null && (
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${
                    alpha >= 80 ? 'bg-emerald-500' : alpha >= 65 ? 'bg-teal-500' :
                    alpha >= 50 ? 'bg-blue-500' : alpha >= 35 ? 'bg-amber-500' : 'bg-slate-600'
                  }`}
                  style={{ width: `${alpha}%` }}
                />
              </div>
            )}
            {/* Pillar breakdown */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-800/50 rounded p-2.5 text-center">
                <div className="text-xs text-slate-500 mb-1">Athleticism</div>
                <div className="text-lg font-mono font-bold text-violet-400">{ras ?? '—'}</div>
                <div className="text-xs text-slate-600">35% weight</div>
              </div>
              <div className="bg-slate-800/50 rounded p-2.5 text-center">
                <div className="text-xs text-slate-500 mb-1">Production</div>
                <div className="text-lg font-mono font-bold text-teal-400">{prod !== null ? prod.toFixed(0) : '—'}</div>
                <div className="text-xs text-slate-600">45% weight</div>
              </div>
              <div className="bg-slate-800/50 rounded p-2.5 text-center">
                <div className="text-xs text-slate-500 mb-1">Draft Capital</div>
                <div className="text-lg font-mono font-bold text-amber-400">{dc ?? '—'}</div>
                <div className="text-xs text-slate-600">20% weight</div>
              </div>
            </div>
          </div>

          {/* Athleticism / RAS */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-semibold text-slate-300">Athleticism (TIBER-RAS)</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">RAS v2</span>
                {rasBar(player.tiber_ras_v2)}
              </div>
              <span className={`text-xs font-bold ${rasGr.color}`}>{rasGr.label}</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-slate-400">RAS v1</span>
              {rasBar(player.tiber_ras_v1)}
            </div>

            {/* Combine measurables */}
            <div className="bg-slate-800/30 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Ruler className="h-3 w-3" /> Height
                  </span>
                  <span className="font-mono text-slate-300">{heightFt(player.height_inches)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Weight className="h-3 w-3" /> Weight
                  </span>
                  <span className="font-mono text-slate-300">{toNum(player.weight_lbs) !== null ? `${toNum(player.weight_lbs)!.toFixed(0)} lbs` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">40-yd</span>
                  <span className="font-mono text-slate-300">{fmtN(player.forty_yard_dash)}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">10-yd</span>
                  <span className="font-mono text-slate-300">{fmtN(player.ten_yard_split)}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vertical</span>
                  <span className="font-mono text-slate-300">{fmtN(player.vertical_jump, 1)}"</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Broad</span>
                  <span className="font-mono text-slate-300">{fmtN(player.broad_jump, 0)}"</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">3-Cone</span>
                  <span className="font-mono text-slate-300">{fmtN(player.three_cone)}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Shuttle</span>
                  <span className="font-mono text-slate-300">{fmtN(player.short_shuttle)}s</span>
                </div>
              </div>
            </div>
          </div>

          {/* College Production */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-teal-400" />
              <span className="text-sm font-semibold text-slate-300">College Production (2024)</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/30 rounded p-2.5">
                <div className="text-slate-500 mb-1">Production Score</div>
                <div className="flex items-center gap-2">
                  {scoreBar(player.production_score, 100, true)}
                </div>
              </div>
              <div className="bg-slate-800/30 rounded p-2.5">
                <div className="text-slate-500 mb-1">Dominator Rating</div>
                <div className="font-mono font-bold text-slate-300 text-sm">
                  {toNum(player.dominator_rating) !== null ? `${toNum(player.dominator_rating)!.toFixed(1)}%` : '—'}
                </div>
              </div>
              {player.position !== 'RB' && (
                <div className="bg-slate-800/30 rounded p-2.5">
                  <div className="text-slate-500 mb-1">Target Share</div>
                  <div className="font-mono font-bold text-slate-300 text-sm">
                    {toNum(player.college_target_share) !== null ? `${toNum(player.college_target_share)!.toFixed(1)}%` : '—'}
                  </div>
                </div>
              )}
              {player.position === 'RB' && toNum(player.college_ypc) !== null && (
                <div className="bg-slate-800/30 rounded p-2.5">
                  <div className="text-slate-500 mb-1">Yards Per Carry</div>
                  <div className="font-mono font-bold text-slate-300 text-sm">
                    {toNum(player.college_ypc)!.toFixed(1)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Draft note */}
          <div className="bg-slate-800/20 rounded-lg p-3 text-xs text-slate-500 border border-slate-800">
            <span className="text-slate-400 font-semibold">Draft Capital:</span>
            {' '}Proxy based on projected round (R{player.proj_round ?? '?'} → {dc ?? '50'} pts).
            Age pillar and actual pick will be added post-draft to finalize the Alpha score.
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────
const POSITIONS: Position[] = ['ALL', 'QB', 'RB', 'WR', 'TE'];
const POS_COLORS: Record<string, string> = {
  QB: 'bg-purple-900/50 text-purple-300 border-purple-700/50',
  RB: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
  WR: 'bg-amber-900/50 text-amber-300 border-amber-700/50',
  TE: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
};
const VIEW_SORT_DEFAULT: Record<ViewMode, SortField> = {
  alpha: 'rookie_alpha', athleticism: 'tiber_ras_v2', production: 'production_score',
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RookieBoard() {
  const [position, setPosition] = useState<Position>('ALL');
  const [view, setView] = useState<ViewMode>('alpha');
  const [sortBy, setSortBy] = useState<SortField>('rookie_alpha');
  const [selected, setSelected] = useState<RookiePlayer | null>(null);

  const { data, isLoading } = useQuery<RookieApiResponse>({
    queryKey: ['/api/rookies/2026', position, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({ sort_by: sortBy });
      if (position !== 'ALL') params.set('position', position);
      const res = await fetch(`/api/rookies/2026?${params}`);
      if (!res.ok) throw new Error('Failed to fetch rookies');
      return res.json();
    },
  });

  const players = data?.players ?? [];

  function switchView(v: ViewMode) {
    setView(v);
    setSortBy(VIEW_SORT_DEFAULT[v]);
  }

  function exportCSV() {
    if (!players.length) return;

    const headers = [
      'Rank', 'Player', 'Position', 'School', 'Proj Round',
      'Rookie Alpha', 'Tier',
      'RAS v2', 'RAS v1', 'Athleticism Score', 'Production Score', 'Draft Capital Score',
      'Dominator Rating (%)', 'Target Share (%)', 'YPC',
      'Height (in)', 'Weight (lbs)', '40yd', '10yd Split',
      'Vertical (in)', 'Broad (in)', '3-Cone', 'Shuttle',
    ];

    const rows = players.map(p => [
      p.rank,
      p.player_name,
      p.position,
      p.school ?? '',
      p.proj_round ?? '',
      p.rookie_alpha ?? '',
      p.rookie_tier ?? '',
      p.tiber_ras_v2 ?? '',
      p.tiber_ras_v1 ?? '',
      p.athleticism_score ?? '',
      p.production_score ?? '',
      p.draft_capital_score ?? '',
      p.dominator_rating ?? '',
      p.college_target_share ?? '',
      p.college_ypc ?? '',
      p.height_inches ?? '',
      p.weight_lbs ?? '',
      p.forty_yard_dash ?? '',
      p.ten_yard_split ?? '',
      p.vertical_jump ?? '',
      p.broad_jump ?? '',
      p.three_cone ?? '',
      p.short_shuttle ?? '',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(v => (String(v).includes(',') ? `"${v}"` : v)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiber_rookie_board_2026${position !== 'ALL' ? `_${position}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button onClick={() => setSortBy(field)}
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
        sortBy === field ? 'text-[#e2640d]' : 'text-slate-400 hover:text-slate-200'
      }`}>
      {label}
      {sortBy === field
        ? <ChevronDown className="h-3 w-3" />
        : <ChevronUp className="h-3 w-3 opacity-40" />}
    </button>
  );

  const VIEWS: { id: ViewMode; label: string; icon: React.ElementType }[] = [
    { id: 'alpha', label: 'Alpha', icon: Star },
    { id: 'athleticism', label: 'Athleticism', icon: Zap },
    { id: 'production', label: 'Production', icon: Activity },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Drawer */}
      {selected && <PlayerDrawer player={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-5 w-5 text-[#e2640d]" />
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
              2026 Rookie Board
            </h1>
            <Badge className="bg-[#e2640d]/20 text-[#e2640d] border-[#e2640d]/30 text-xs">FORGE-R</Badge>
            <Badge className="bg-slate-700/50 text-slate-400 border-slate-600/30 text-xs">Phase 3</Badge>
          </div>
          <p className="text-sm text-slate-400">
            {players.length} prospects · Click any row to see full profile
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div className="flex items-center gap-1 justify-end">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Pre-draft composite</span>
          </div>
          <div className="text-slate-600 mt-0.5">Alpha = RAS 35% · Prod 45% · DC 20%</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {POSITIONS.map(pos => (
            <button key={pos} onClick={() => setPosition(pos)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${
                position === pos
                  ? 'bg-[#e2640d] text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}>
              {pos}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => switchView(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all border ${
                view === id
                  ? 'bg-slate-700 text-white border-slate-600'
                  : 'bg-slate-800/50 text-slate-500 hover:text-slate-300 border-slate-700/30'
              }`}>
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
          <button
            onClick={exportCSV}
            disabled={!players.length}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all border border-slate-700/30 bg-slate-800/50 text-slate-500 hover:text-[#e2640d] hover:border-[#e2640d]/40 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Export current view as CSV"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide w-10">#</th>
                <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide">Player</th>
                <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide">Pos</th>
                <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden md:table-cell">School</th>
                <th className="px-4 py-3 text-center text-xs hidden lg:table-cell">
                  <SortHeader field="proj_round" label="Rd" />
                </th>

                {view === 'alpha' && <>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">RAS</span>
                  </th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Prod</span>
                  </th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">DC</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortHeader field="rookie_alpha" label="Alpha" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden md:table-cell">Tier</th>
                </>}

                {view === 'athleticism' && <>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden lg:table-cell">40yd</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden lg:table-cell">Vert</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden lg:table-cell">Broad</th>
                  <th className="px-4 py-3 text-left"><SortHeader field="tiber_ras_v1" label="RAS v1" /></th>
                  <th className="px-4 py-3 text-left"><SortHeader field="tiber_ras_v2" label="RAS v2" /></th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden md:table-cell">Grade</th>
                </>}

                {view === 'production' && <>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">
                    <SortHeader field="dominator_rating" label="DOM%" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden lg:table-cell">Tgt%</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden lg:table-cell">YPC</th>
                  <th className="px-4 py-3 text-left"><SortHeader field="production_score" label="Prod Score" /></th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">
                    <SortHeader field="tiber_ras_v2" label="RAS v2" />
                  </th>
                </>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 15 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-slate-800 rounded animate-pulse w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : players.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No prospects found
                  </td>
                </tr>
              ) : players.map((p, i) => {
                const grade = rasGrade(p.tiber_ras_v2);
                const tier = p.rookie_tier ?? 'T5';
                const tierMeta = TIER_META[tier] ?? TIER_META.T5;
                return (
                  <tr key={p.player_name}
                    onClick={() => setSelected(p)}
                    className={`border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors cursor-pointer ${
                      i % 2 === 0 ? 'bg-slate-900/20' : ''
                    } ${selected?.player_name === p.player_name ? 'bg-slate-800/50 ring-1 ring-inset ring-[#e2640d]/30' : ''}`}
                  >
                    <td className="px-4 py-3 text-slate-500 text-xs tabular-nums">{p.rank}</td>
                    <td className="px-4 py-3">
                      <span className="text-white font-medium text-sm">{p.player_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold border ${POS_COLORS[p.position] ?? 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                        {p.position}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{p.school ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-slate-400 text-xs hidden lg:table-cell">
                      {p.proj_round ? `R${p.proj_round}` : '—'}
                    </td>

                    {view === 'alpha' && <>
                      <td className="px-4 py-2 hidden lg:table-cell">
                        {pillarBar(toNum(p.athleticism_score), 'RAS', 'bg-violet-500')}
                      </td>
                      <td className="px-4 py-2 hidden lg:table-cell">
                        {pillarBar(toNum(p.production_score), 'PROD', 'bg-teal-500')}
                      </td>
                      <td className="px-4 py-2 hidden lg:table-cell">
                        {pillarBar(toNum(p.draft_capital_score), 'DC', 'bg-amber-500')}
                      </td>
                      <td className="px-4 py-3">{scoreBar(p.rookie_alpha, 100)}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${tierMeta.bg} ${tierMeta.color} ${tierMeta.border}`}>
                          {tier}
                        </span>
                      </td>
                    </>}

                    {view === 'athleticism' && <>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="font-mono text-xs text-slate-300">{fmtN(p.forty_yard_dash)}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="font-mono text-xs text-slate-300">{fmtN(p.vertical_jump, 1)}"</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="font-mono text-xs text-slate-300">{fmtN(p.broad_jump, 0)}"</span>
                      </td>
                      <td className="px-4 py-3">{rasBar(p.tiber_ras_v1)}</td>
                      <td className="px-4 py-3">{rasBar(p.tiber_ras_v2)}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`text-xs font-bold ${grade.color}`}>{grade.label}</span>
                      </td>
                    </>}

                    {view === 'production' && <>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {toNum(p.dominator_rating) !== null
                          ? <span className="font-mono text-xs text-slate-300">{toNum(p.dominator_rating)!.toFixed(1)}%</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {toNum(p.college_target_share) !== null
                          ? <span className="font-mono text-xs text-slate-300">{toNum(p.college_target_share)!.toFixed(1)}%</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {toNum(p.college_ypc) !== null
                          ? <span className="font-mono text-xs text-slate-300">{toNum(p.college_ypc)!.toFixed(2)}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3">{scoreBar(p.production_score)}</td>
                      <td className="px-4 py-3 hidden md:table-cell">{rasBar(p.tiber_ras_v2)}</td>
                    </>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        {view === 'alpha' && <>
          <span className="font-semibold text-slate-400">Rookie Alpha Tier:</span>
          {([['T1', 'text-emerald-400', '80+'], ['T2', 'text-teal-400', '65–79'],
             ['T3', 'text-blue-400', '50–64'], ['T4', 'text-amber-400', '35–49'],
             ['T5', 'text-slate-400', '<35']] as const).map(([t, c, r]) => (
            <span key={t}><span className={`font-bold ${c}`}>{t}</span><span className="text-slate-600 ml-1">{r}</span></span>
          ))}
          <span className="text-slate-600">· DC = draft capital proxy (proj. round) · Age pillar added post-draft</span>
        </>}
        {view === 'athleticism' && <>
          <span className="font-semibold text-slate-400">TIBER-RAS v2:</span>
          {([['ELITE', 'text-emerald-400', '9.0+'], ['GREAT', 'text-teal-400', '8.0–8.9'],
             ['GOOD', 'text-blue-400', '7.0–7.9'], ['AVG', 'text-amber-400', '5.5–6.9'],
             ['BELOW', 'text-orange-400', '4.0–5.4'], ['POOR', 'text-red-400', '<4.0']] as const).map(([l, c, r]) => (
            <span key={l}><span className={`font-bold ${c}`}>{l}</span><span className="text-slate-600 ml-1">{r}</span></span>
          ))}
        </>}
        {view === 'production' && <>
          <span className="font-semibold text-slate-400">Production Score:</span>
          <span>Percentile within position class · <span className="text-slate-400">Dominator</span> = player yards+TDs as share of team total</span>
          <span className="text-slate-600">cfbfastR 2024 PBP + ESPN team totals</span>
        </>}
      </div>
    </div>
  );
}
