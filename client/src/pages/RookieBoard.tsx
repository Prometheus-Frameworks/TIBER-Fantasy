import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Zap, TrendingUp, ChevronUp, ChevronDown, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Position = 'ALL' | 'QB' | 'RB' | 'WR' | 'TE';
type SortField = 'tiber_ras_v2' | 'tiber_ras_v1' | 'proj_round' | 'production_score' | 'dominator_rating';

interface RookiePlayer {
  rank: number;
  player_name: string;
  position: string;
  school: string | null;
  proj_round: number | null;
  forty_yard_dash: number | null;
  vertical_jump: number | null;
  broad_jump: number | null;
  tiber_ras_v1: number | null;
  tiber_ras_v2: number | null;
  production_score: number | null;
  dominator_rating: number | null;
  college_target_share: number | null;
  college_ypc: number | null;
}

interface RookieApiResponse {
  season: number;
  position: string;
  count: number;
  players: RookiePlayer[];
}

function toNum(val: number | string | null): number | null {
  if (val === null || val === undefined) return null;
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(n) ? null : n;
}

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

function rasBar(score: number | string | null) {
  const n = toNum(score);
  if (n === null) return null;
  const pct = Math.round((n / 10) * 100);
  const color =
    n >= 9.0 ? 'bg-emerald-500' :
    n >= 8.0 ? 'bg-teal-500' :
    n >= 7.0 ? 'bg-blue-500' :
    n >= 5.5 ? 'bg-amber-500' :
    n >= 4.0 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-300 tabular-nums font-mono">{n.toFixed(2)}</span>
    </div>
  );
}

function prodBar(score: number | string | null) {
  const n = toNum(score);
  if (n === null) return <span className="text-slate-600 text-xs">—</span>;
  const pct = Math.round(n);
  const color =
    n >= 85 ? 'bg-emerald-500' :
    n >= 70 ? 'bg-teal-500' :
    n >= 55 ? 'bg-blue-500' :
    n >= 40 ? 'bg-amber-500' :
    n >= 25 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-300 tabular-nums font-mono">{n.toFixed(0)}</span>
    </div>
  );
}

function fmt(val: number | null | string, decimals = 2) {
  const n = toNum(val);
  if (n === null) return <span className="text-slate-600">—</span>;
  return <span className="font-mono text-xs">{n.toFixed(decimals)}</span>;
}

const POSITIONS: Position[] = ['ALL', 'QB', 'RB', 'WR', 'TE'];
const POS_COLORS: Record<string, string> = {
  QB: 'bg-purple-900/50 text-purple-300 border-purple-700/50',
  RB: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
  WR: 'bg-amber-900/50 text-amber-300 border-amber-700/50',
  TE: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
};

type ViewMode = 'athleticism' | 'production';

export default function RookieBoard() {
  const [position, setPosition] = useState<Position>('ALL');
  const [sortBy, setSortBy] = useState<SortField>('tiber_ras_v2');
  const [view, setView] = useState<ViewMode>('athleticism');

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

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => setSortBy(field)}
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
        sortBy === field ? 'text-[#e2640d]' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {label}
      {sortBy === field ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3 opacity-40" />}
    </button>
  );

  const isAthletics = view === 'athleticism';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-5 w-5 text-[#e2640d]" />
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
              2026 Rookie Board
            </h1>
            <Badge className="bg-[#e2640d]/20 text-[#e2640d] border-[#e2640d]/30 text-xs">FORGE-R</Badge>
            <Badge className="bg-slate-700/50 text-slate-400 border-slate-600/30 text-xs">Phase 2</Badge>
          </div>
          <p className="text-sm text-slate-400">
            {players.length} prospects · Athleticism (TIBER-RAS v2) + College Production
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>cfbfastR 2024 · ESPN team totals</span>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Position filter */}
        <div className="flex gap-1">
          {POSITIONS.map(pos => (
            <button
              key={pos}
              onClick={() => setPosition(pos)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${
                position === pos
                  ? 'bg-[#e2640d] text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>

        {/* View mode toggle */}
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => { setView('athleticism'); setSortBy('tiber_ras_v2'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
              isAthletics
                ? 'bg-slate-700 text-white border border-slate-600'
                : 'bg-slate-800/50 text-slate-500 hover:text-slate-300 border border-slate-700/30'
            }`}
          >
            <Zap className="h-3 w-3" />
            Athleticism
          </button>
          <button
            onClick={() => { setView('production'); setSortBy('production_score'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
              !isAthletics
                ? 'bg-slate-700 text-white border border-slate-600'
                : 'bg-slate-800/50 text-slate-500 hover:text-slate-300 border border-slate-700/30'
            }`}
          >
            <Activity className="h-3 w-3" />
            Production
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
                <th className="px-4 py-3 text-center text-xs text-slate-500 font-semibold uppercase tracking-wide hidden lg:table-cell">
                  <SortHeader field="proj_round" label="Rd" />
                </th>

                {isAthletics ? (
                  <>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden lg:table-cell">40yd</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden lg:table-cell">Vert</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden lg:table-cell">Broad</th>
                    <th className="px-4 py-3 text-left">
                      <SortHeader field="tiber_ras_v1" label="RAS v1" />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SortHeader field="tiber_ras_v2" label="RAS v2" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden md:table-cell">Grade</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-left hidden lg:table-cell">
                      <SortHeader field="dominator_rating" label="DOM%" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden lg:table-cell">Tgt%</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden lg:table-cell">YPC</th>
                    <th className="px-4 py-3 text-left">
                      <SortHeader field="production_score" label="Prod Score" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide hidden md:table-cell">
                      <SortHeader field="tiber_ras_v2" label="RAS v2" />
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 15 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    {Array.from({ length: isAthletics ? 11 : 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-slate-800 rounded animate-pulse w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : players.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No prospects found
                  </td>
                </tr>
              ) : (
                players.map((p, i) => {
                  const grade = rasGrade(p.tiber_ras_v2);
                  return (
                    <tr
                      key={p.player_name}
                      className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${
                        i % 2 === 0 ? 'bg-slate-900/20' : ''
                      }`}
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

                      {isAthletics ? (
                        <>
                          <td className="px-4 py-3 hidden lg:table-cell">{fmt(p.forty_yard_dash)}</td>
                          <td className="px-4 py-3 hidden lg:table-cell">{fmt(p.vertical_jump, 1)}</td>
                          <td className="px-4 py-3 hidden lg:table-cell">{fmt(p.broad_jump, 0)}</td>
                          <td className="px-4 py-3">{rasBar(p.tiber_ras_v1)}</td>
                          <td className="px-4 py-3">{rasBar(p.tiber_ras_v2)}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={`text-xs font-bold ${grade.color}`}>{grade.label}</span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {p.dominator_rating !== null && toNum(p.dominator_rating) !== null
                              ? <span className="font-mono text-xs text-slate-300">{toNum(p.dominator_rating)!.toFixed(1)}%</span>
                              : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {p.college_target_share !== null && toNum(p.college_target_share) !== null
                              ? <span className="font-mono text-xs text-slate-300">{toNum(p.college_target_share)!.toFixed(1)}%</span>
                              : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">{fmt(p.college_ypc)}</td>
                          <td className="px-4 py-3">{prodBar(p.production_score)}</td>
                          <td className="px-4 py-3 hidden md:table-cell">{rasBar(p.tiber_ras_v2)}</td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      {isAthletics ? (
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="font-semibold text-slate-400">TIBER-RAS Grade:</span>
          {[
            { label: 'ELITE', color: 'text-emerald-400', range: '9.0+' },
            { label: 'GREAT', color: 'text-teal-400', range: '8.0–8.9' },
            { label: 'GOOD', color: 'text-blue-400', range: '7.0–7.9' },
            { label: 'AVG', color: 'text-amber-400', range: '5.5–6.9' },
            { label: 'BELOW', color: 'text-orange-400', range: '4.0–5.4' },
            { label: 'POOR', color: 'text-red-400', range: '<4.0' },
          ].map(g => (
            <span key={g.label}>
              <span className={`font-bold ${g.color}`}>{g.label}</span>
              <span className="text-slate-600 ml-1">{g.range}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="font-semibold text-slate-400">Production Score:</span>
          <span>Percentile within position class · <span className="text-slate-400">Dominator Rating</span> = player yards+TDs as % of team total</span>
          <span className="text-slate-600">Source: cfbfastR 2024 play-by-play + ESPN team totals</span>
        </div>
      )}
    </div>
  );
}
