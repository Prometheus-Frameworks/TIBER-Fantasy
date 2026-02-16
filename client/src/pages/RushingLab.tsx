import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, Zap, TrendingUp, BarChart3, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface PlayerRow {
  playerId: string;
  playerName: string;
  teamId: string | null;
  position: string;
  gamesPlayed: number;
  totalSnaps: number;
  totalRushAttempts: number;
  totalRushYards: number;
  totalRushTds: number;
  avgYpc: number | null;
  avgRushEpa: number | null;
  totalStuffed: number;
  avgStuffRate: number | null;
  totalRushFirstDowns: number;
  avgRushFirstDownRate: number | null;
  avgInsideRunRate: number | null;
  avgOutsideRunRate: number | null;
  avgInsideSuccessRate: number | null;
  avgOutsideSuccessRate: number | null;
  avgLeftRunRate: number | null;
  avgMiddleRunRate: number | null;
  avgRightRunRate: number | null;
  totalTargets: number;
  totalReceptions: number;
  totalRecYards: number;
  avgYacPerRec: number | null;
  totalFptsPpr: number;
  avgSuccessRate: number | null;
  scrambles?: number | null;
  scrambleYards?: number | null;
  scrambleTds?: number | null;
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
    ? <ArrowUp className="h-3 w-3 ml-1 text-[#16a34a]" />
    : <ArrowDown className="h-3 w-3 ml-1 text-[#16a34a]" />;
}

export default function RushingLab() {
  const [position, setPosition] = useState('RB');
  const [season, setSeason] = useState('2025');
  const [sortColumn, setSortColumn] = useState('totalFptsPpr');
  const [sortDirection, setSortDirection] = useState<SortDir>('desc');

  const { data: response, isLoading } = useQuery<AggResponse>({
    queryKey: ['/api/data-lab/lab-agg', { season, position, module: 'rushing' }],
    queryFn: () => fetch(`/api/data-lab/lab-agg?season=${season}&weekMode=season&position=${position}&limit=150`).then(r => r.json()),
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
      avgYpc: avg(d.map(p => p.avgYpc)),
      avgRushEpa: avg(d.map(p => p.avgRushEpa)),
      avgStuffRate: avg(d.map(p => p.avgStuffRate)),
      avgFirstDownRate: avg(d.map(p => p.avgRushFirstDownRate)),
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
      className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-[#16a34a] transition-colors ${className}`}
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center">
        {label}
        <SortIcon column={col} sortColumn={sortColumn} sortDirection={sortDirection} />
      </div>
    </th>
  );

  const isQB = position === 'QB';

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 bg-white min-h-screen">
      <div className="mb-6">
        <Link href="/tiber-data-lab" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#16a34a] transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />
          Data Lab
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <Activity className="h-6 w-6 text-[#16a34a]" />
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
            Rushing Lab
          </h1>
          <Badge variant="secondary" className="text-xs font-medium bg-[#16a34a]/10 text-[#16a34a] border-0">
            NEW
          </Badge>
        </div>
        <p className="text-gray-500 text-sm">Ground Game Intelligence</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Tabs value={position} onValueChange={setPosition}>
          <TabsList className="bg-[#f4f4f4]">
            <TabsTrigger value="RB" className="data-[state=active]:bg-[#16a34a] data-[state=active]:text-white">RB</TabsTrigger>
            <TabsTrigger value="QB" className="data-[state=active]:bg-[#16a34a] data-[state=active]:text-white">QB</TabsTrigger>
          </TabsList>
        </Tabs>
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
                <Zap className="h-3.5 w-3.5 text-[#16a34a]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg YPC</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtDec(summaryStats.avgYpc)}</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-100 bg-[#fafafa]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart3 className="h-3.5 w-3.5 text-[#16a34a]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg Rush EPA</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtDec(summaryStats.avgRushEpa, 3)}</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-100 bg-[#fafafa]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-[#16a34a]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg Stuff Rate</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtPct(summaryStats.avgStuffRate)}</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-100 bg-[#fafafa]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="h-3.5 w-3.5 text-[#16a34a]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg 1st Down Rate</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtPct(summaryStats.avgFirstDownRate)}</div>
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
                {th('Rush Att', 'totalRushAttempts')}
                {th('Rush Yds', 'totalRushYards')}
                {th('Rush TDs', 'totalRushTds')}
                {th('YPC', 'avgYpc')}
                {th('Rush EPA', 'avgRushEpa')}
                {th('Stuff%', 'avgStuffRate')}
                {th('1D Rate', 'avgRushFirstDownRate')}
                {isQB ? (
                  <>
                    {th('Scrambles', 'scrambles')}
                    {th('Scr Yds', 'scrambleYards')}
                    {th('Scr TDs', 'scrambleTds')}
                  </>
                ) : (
                  <>
                    {th('Inside%', 'avgInsideRunRate')}
                    {th('Outside%', 'avgOutsideRunRate')}
                    {th('In Succ%', 'avgInsideSuccessRate')}
                    {th('Out Succ%', 'avgOutsideSuccessRate')}
                    {th('Left%', 'avgLeftRunRate')}
                    {th('Mid%', 'avgMiddleRunRate')}
                    {th('Right%', 'avgRightRunRate')}
                  </>
                )}
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
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-6" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-10" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-10" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-10" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-10" /></td>
                  </tr>
                ))
              ) : sortedData.map((p, i) => (
                <tr key={p.playerId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'} hover:bg-[#16a34a]/5 transition-colors`}>
                  <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{i + 1}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{p.playerName}</td>
                  <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.teamId ?? '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.gamesPlayed)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRushAttempts)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRushYards)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRushTds)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtDec(p.avgYpc)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtDec(p.avgRushEpa)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgStuffRate)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgRushFirstDownRate)}</td>
                  {isQB ? (
                    <>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.scrambles)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.scrambleYards)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.scrambleTds)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgInsideRunRate)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgOutsideRunRate)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgInsideSuccessRate)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgOutsideSuccessRate)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgLeftRunRate)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgMiddleRunRate)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgRightRunRate)}</td>
                    </>
                  )}
                  <td className="px-3 py-2.5 font-mono font-semibold text-[#16a34a]">{fmtDec(p.totalFptsPpr, 1)}</td>
                </tr>
              ))}
              {!isLoading && sortedData.length === 0 && (
                <tr>
                  <td colSpan={isQB ? 15 : 19} className="px-3 py-12 text-center text-gray-400">
                    No data available for {position} in {season}
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
