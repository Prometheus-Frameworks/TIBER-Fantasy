import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Zap, TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Position = 'ALL' | 'QB' | 'RB' | 'WR' | 'TE';
type SortField = 'tiber_ras_v2' | 'tiber_ras_v1' | 'proj_round';

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
}

interface RookieApiResponse {
  season: number;
  position: string;
  count: number;
  players: RookiePlayer[];
}

function rasGrade(score: number | string | null): { label: string; color: string } {
  if (score === null || score === undefined) return { label: '—', color: 'text-slate-500' };
  const n = typeof score === 'string' ? parseFloat(score) : score;
  if (isNaN(n)) return { label: '—', color: 'text-slate-500' };
  if (n >= 9.0) return { label: 'ELITE', color: 'text-emerald-400' };
  if (n >= 8.0) return { label: 'GREAT', color: 'text-teal-400' };
  if (n >= 7.0) return { label: 'GOOD', color: 'text-blue-400' };
  if (n >= 5.5) return { label: 'AVG', color: 'text-amber-400' };
  if (n >= 4.0) return { label: 'BELOW', color: 'text-orange-400' };
  return { label: 'POOR', color: 'text-red-400' };
}

function rasBar(score: number | string | null) {
  if (score === null || score === undefined) return null;
  const n = typeof score === 'string' ? parseFloat(score) : score;
  if (isNaN(n)) return null;
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

function fmt(val: number | null, decimals = 2) {
  if (val === null || val === undefined) return <span className="text-slate-600">—</span>;
  return <span className="font-mono text-xs">{val.toFixed(decimals)}</span>;
}

const POSITIONS: Position[] = ['ALL', 'QB', 'RB', 'WR', 'TE'];
const POS_COLORS: Record<string, string> = {
  QB: 'bg-purple-900/50 text-purple-300 border-purple-700/50',
  RB: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
  WR: 'bg-amber-900/50 text-amber-300 border-amber-700/50',
  TE: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
};

export default function RookieBoard() {
  const [position, setPosition] = useState<Position>('ALL');
  const [sortBy, setSortBy] = useState<SortField>('tiber_ras_v2');

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

  const sortToggle = (field: SortField) => {
    setSortBy(field);
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => sortToggle(field)}
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
        sortBy === field ? 'text-[#e2640d]' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {label}
      {sortBy === field ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3 opacity-40" />}
    </button>
  );

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
            <Badge className="bg-[#e2640d]/20 text-[#e2640d] border-[#e2640d]/30 text-xs">TIBER-RAS</Badge>
          </div>
          <p className="text-sm text-slate-400">
            {players.length} prospects · Athleticism ranked vs 8,649 combine players since 1987
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>v2 = historical percentile · v1 = class-relative</span>
        </div>
      </div>

      {/* Position Filter */}
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
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 15 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    {Array.from({ length: 11 }).map((_, j) => (
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
                      <td className="px-4 py-3 hidden lg:table-cell">{fmt(p.forty_yard_dash)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">{fmt(p.vertical_jump, 1)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">{fmt(p.broad_jump, 0)}</td>
                      <td className="px-4 py-3">{rasBar(p.tiber_ras_v1)}</td>
                      <td className="px-4 py-3">{rasBar(p.tiber_ras_v2)}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`text-xs font-bold ${grade.color}`}>{grade.label}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
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
    </div>
  );
}
