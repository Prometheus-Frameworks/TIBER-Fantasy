import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, Zap, TrendingUp, BarChart3, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface PlayerRow {
  playerId: string;
  playerName: string;
  teamId: string | null;
  position: string;
  gamesPlayed: number;
  totalSnaps: number;
  totalDropbacks: number;
  avgCpoe: number | null;
  avgAnyA: number | null;
  avgFpPerDropback: number | null;
  totalSacks: number;
  avgSackRate: number | null;
  totalSackYards: number;
  totalQbHits: number;
  avgQbHitRate: number | null;
  totalScrambles: number;
  totalScrambleYards: number;
  totalScrambleTds: number;
  totalPassFirstDowns: number;
  avgPassFirstDownRate: number | null;
  totalDeepPassAttempts: number;
  avgDeepPassRate: number | null;
  avgPassAdot: number | null;
  avgShotgunRate: number | null;
  avgNoHuddleRate: number | null;
  avgShotgunSuccessRate: number | null;
  avgUnderCenterSuccessRate: number | null;
  avgEpaPerPlay: number | null;
  avgSuccessRate: number | null;
  totalRushAttempts: number;
  totalRushYards: number;
  totalRushTds: number;
  totalFptsPpr: number;
}

interface AggResponse {
  season: number;
  weekRange: { from: number; to: number } | null;
  position: string;
  count: number;
  data: PlayerRow[];
}

const fmtPct = (v: number | null | undefined): string => v != null ? (v * 100).toFixed(1) + '%' : '—';
const fmtDec = (v: number | null | undefined, d = 2): string => v != null ? v.toFixed(d) : '—';
const fmtInt = (v: number | null | undefined): string => v != null ? String(Math.round(v)) : '—';

type SortDir = 'asc' | 'desc';

function avg(arr: (number | null | undefined)[]): number | null {
  const valid = arr.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function SortIcon({ column, sortColumn, sortDirection }: { column: string; sortColumn: string; sortDirection: SortDir }) {
  if (column !== sortColumn) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
  return sortDirection === 'asc'
    ? <ArrowUp className="h-3 w-3 ml-1 text-[#9333ea]" />
    : <ArrowDown className="h-3 w-3 ml-1 text-[#9333ea]" />;
}

export default function QBLab() {
  const [season, setSeason] = useState('2025');
  const [sortColumn, setSortColumn] = useState('totalFptsPpr');
  const [sortDirection, setSortDirection] = useState<SortDir>('desc');

  const { data: response, isLoading } = useQuery<AggResponse>({
    queryKey: ['/api/data-lab/lab-agg', { season, position: 'QB', module: 'qb' }],
    queryFn: () => fetch(`/api/data-lab/lab-agg?season=${season}&weekMode=season&position=QB&limit=150`).then(r => r.json()),
  });

  const sortedData = useMemo(() => {
    if (!response?.data) return [];
    const rows = [...response.data];
    rows.sort((a, b) => {
      const aVal = (a as any)[sortColumn] ?? -Infinity;
      const bVal = (b as any)[sortColumn] ?? -Infinity;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return rows;
  }, [response?.data, sortColumn, sortDirection]);

  const summaryStats = useMemo(() => {
    if (!response?.data?.length) return null;
    const d = response.data;
    return {
      avgCpoe: avg(d.map(p => p.avgCpoe)),
      avgAnyA: avg(d.map(p => p.avgAnyA)),
      avgSackRate: avg(d.map(p => p.avgSackRate)),
      avgFpPerDropback: avg(d.map(p => p.avgFpPerDropback)),
    };
  }, [response?.data]);

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('desc');
    }
  };

  const th = (label: string, col: string, className = '') => (
    <th
      className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-[#9333ea] transition-colors ${className}`}
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center">
        {label}
        <SortIcon column={col} sortColumn={sortColumn} sortDirection={sortDirection} />
      </div>
    </th>
  );

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 bg-white min-h-screen">
      <div className="mb-6">
        <Link href="/tiber-data-lab" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#9333ea] transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />
          Data Lab
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <Activity className="h-6 w-6 text-[#9333ea]" />
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
            QB Lab
          </h1>
          <Badge variant="secondary" className="text-xs font-medium bg-[#9333ea]/10 text-[#9333ea] border-0">
            NEW
          </Badge>
        </div>
        <p className="text-gray-500 text-sm">Passing Value & Process</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Select value={season} onValueChange={setSeason}>
          <SelectTrigger className="w-28 bg-[#f4f4f4] border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2025">2025</SelectItem>
            <SelectItem value="2024">2024</SelectItem>
          </SelectContent>
        </Select>
        {response && (
          <span className="text-xs text-gray-400 font-mono">
            {response.count} players · Wk {response.weekRange?.from}–{response.weekRange?.to}
          </span>
        )}
      </div>

      {isLoading && !summaryStats ? (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border border-gray-100">
              <CardContent className="p-4">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-7 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summaryStats ? (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="border border-gray-100 bg-[#fafafa]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="h-3.5 w-3.5 text-[#9333ea]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg CPOE</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtDec(summaryStats.avgCpoe, 1)}</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-100 bg-[#fafafa]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart3 className="h-3.5 w-3.5 text-[#9333ea]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg ANY/A</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtDec(summaryStats.avgAnyA, 1)}</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-100 bg-[#fafafa]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-[#9333ea]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg Sack Rate</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtPct(summaryStats.avgSackRate)}</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-100 bg-[#fafafa]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="h-3.5 w-3.5 text-[#9333ea]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg FP/Dropback</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtDec(summaryStats.avgFpPerDropback)}</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f4f4f4] border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
                {th('Player', 'playerName', 'min-w-[160px]')}
                {th('Team', 'teamId')}
                {th('GP', 'gamesPlayed')}
                {th('Dropbacks', 'totalDropbacks')}
                {th('CPOE', 'avgCpoe')}
                {th('ANY/A', 'avgAnyA')}
                {th('FP/DB', 'avgFpPerDropback')}
                {th('EPA/Play', 'avgEpaPerPlay')}
                {th('Succ%', 'avgSuccessRate')}
                {th('Sacks', 'totalSacks')}
                {th('Sack%', 'avgSackRate')}
                {th('QB Hits', 'totalQbHits')}
                {th('Hit%', 'avgQbHitRate')}
                {th('Deep%', 'avgDeepPassRate')}
                {th('aDOT', 'avgPassAdot')}
                {th('Shotgun%', 'avgShotgunRate')}
                {th('No Huddle%', 'avgNoHuddleRate')}
                {th('Scrambles', 'totalScrambles')}
                {th('Scr Yds', 'totalScrambleYards')}
                {th('Rush Att', 'totalRushAttempts')}
                {th('Rush Yds', 'totalRushYards')}
                {th('Rush TDs', 'totalRushTds')}
                {th('FPTS', 'totalFptsPpr')}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(15)].map((_, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-4" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-6" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-10" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-10" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-10" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-10" /></td>
                  </tr>
                ))
              ) : sortedData.map((p, i) => (
                <tr key={p.playerId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'} hover:bg-[#9333ea]/5 transition-colors`}>
                  <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{i + 1}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{p.playerName}</td>
                  <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.teamId ?? '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.gamesPlayed)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalDropbacks)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtDec(p.avgCpoe, 1)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtDec(p.avgAnyA, 1)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtDec(p.avgFpPerDropback)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtDec(p.avgEpaPerPlay)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgSuccessRate)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalSacks)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgSackRate)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalQbHits)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgQbHitRate)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgDeepPassRate)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtDec(p.avgPassAdot, 1)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgShotgunRate)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgNoHuddleRate)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalScrambles)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalScrambleYards)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRushAttempts)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRushYards)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRushTds)}</td>
                  <td className="px-3 py-2.5 font-mono font-semibold text-[#9333ea]">{fmtDec(p.totalFptsPpr, 1)}</td>
                </tr>
              ))}
              {!isLoading && sortedData.length === 0 && (
                <tr>
                  <td colSpan={24} className="px-3 py-12 text-center text-gray-400">
                    No data available for QB in {season}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
