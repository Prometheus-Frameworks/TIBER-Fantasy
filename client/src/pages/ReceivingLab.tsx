import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, Target, TrendingUp, BarChart3, Zap, Download } from 'lucide-react';
import { exportLabCsv, CsvColumn } from '@/lib/csvExport';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface PlayerRow {
  playerId: string;
  playerName: string;
  teamId: string;
  position: string;
  gamesPlayed: number;
  totalTargets: number;
  totalReceptions: number;
  totalRecYards: number;
  totalRecTds: number;
  avgAdot: number | null;
  totalAirYards: number;
  totalYac: number;
  avgEpaPerTarget: number | null;
  avgSuccessRate: number | null;
  avgXYac: number | null;
  avgYacOverExpected: number | null;
  avgXYacSuccessRate: number | null;
  avgCatchRate: number | null;
  avgYardsPerTarget: number | null;
  avgRacr: number | null;
  avgWopr: number | null;
  avgSlotRate: number | null;
  avgAirEpa: number | null;
  avgCompAirEpa: number | null;
  avgDeepTargetRate: number | null;
  avgIntermediateTargetRate: number | null;
  avgShortTargetRate: number | null;
  totalRoutes: number;
  tprr: number | null;
  yprr: number | null;
  totalFptsPpr: number;
}

interface AggResponse {
  season: number;
  weekRange: { from: number; to: number };
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
    ? <ArrowUp className="h-3 w-3 ml-1 text-[#7c3aed]" />
    : <ArrowDown className="h-3 w-3 ml-1 text-[#7c3aed]" />;
}

function DepthBar({ deep, inter, short }: { deep: number | null; inter: number | null; short: number | null }) {
  const d = deep != null ? deep * 100 : 0;
  const i = inter != null ? inter * 100 : 0;
  const s = short != null ? short * 100 : 0;
  return (
    <div className="flex items-center gap-1">
      <div className="flex h-2.5 w-20 rounded-full overflow-hidden bg-gray-200">
        <div className="bg-red-400" style={{ width: `${d}%` }} title={`Deep ${d.toFixed(1)}%`} />
        <div className="bg-amber-400" style={{ width: `${i}%` }} title={`Int ${i.toFixed(1)}%`} />
        <div className="bg-emerald-400" style={{ width: `${s}%` }} title={`Short ${s.toFixed(1)}%`} />
      </div>
      <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap">{d.toFixed(0)}/{i.toFixed(0)}/{s.toFixed(0)}</span>
    </div>
  );
}

export default function ReceivingLab() {
  const [position, setPosition] = useState('WR');
  const [season, setSeason] = useState('2025');
  const [sortColumn, setSortColumn] = useState('totalFptsPpr');
  const [sortDirection, setSortDirection] = useState<SortDir>('desc');

  const { data: response, isLoading } = useQuery<AggResponse>({
    queryKey: ['/api/data-lab/lab-agg', { season, position, module: 'receiving' }],
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
      avgEpa: avg(d.map(p => p.avgEpaPerTarget)),
      avgCatch: avg(d.map(p => p.avgCatchRate)),
      avgYprr: avg(d.map(p => p.yprr)),
      avgYacOE: avg(d.map(p => p.avgYacOverExpected)),
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

  const csvColumns: CsvColumn[] = [
    { key: 'playerName', label: 'Player' },
    { key: 'teamId', label: 'Team' },
    { key: 'position', label: 'Position' },
    { key: 'gamesPlayed', label: 'Games Played', format: 'int' },
    { key: 'totalTargets', label: 'Targets', format: 'int' },
    { key: 'totalReceptions', label: 'Receptions', format: 'int' },
    { key: 'totalRecYards', label: 'Rec Yards', format: 'int' },
    { key: 'totalRecTds', label: 'Rec TDs', format: 'int' },
    { key: 'avgAdot', label: 'aDOT', format: 'dec', decimals: 1 },
    { key: 'avgEpaPerTarget', label: 'EPA/Target', format: 'dec' },
    { key: 'avgCatchRate', label: 'Catch Rate %', format: 'pct' },
    { key: 'yprr', label: 'YPRR', format: 'dec' },
    { key: 'tprr', label: 'TPRR', format: 'dec', decimals: 3 },
    { key: 'avgWopr', label: 'WOPR', format: 'dec' },
    { key: 'avgRacr', label: 'RACR', format: 'dec' },
    { key: 'avgXYac', label: 'xYAC', format: 'dec', decimals: 1 },
    { key: 'avgYacOverExpected', label: 'YAC over Expected', format: 'dec', decimals: 1 },
    { key: 'avgDeepTargetRate', label: 'Deep Target %', format: 'pct' },
    { key: 'avgIntermediateTargetRate', label: 'Intermediate Target %', format: 'pct' },
    { key: 'avgShortTargetRate', label: 'Short Target %', format: 'pct' },
    { key: 'avgSlotRate', label: 'Slot Rate %', format: 'pct' },
    { key: 'totalRoutes', label: 'Routes Run', format: 'int' },
    { key: 'totalAirYards', label: 'Air Yards', format: 'int' },
    { key: 'totalYac', label: 'YAC', format: 'int' },
    { key: 'avgAirEpa', label: 'Air EPA', format: 'dec' },
    { key: 'avgSuccessRate', label: 'Success Rate %', format: 'pct' },
    { key: 'totalFptsPpr', label: 'Fantasy Points (PPR)', format: 'dec', decimals: 1 },
  ];

  const handleExport = () => {
    if (!sortedData.length) return;
    exportLabCsv(sortedData, csvColumns, {
      module: 'receiving',
      position,
      season,
      weekRange: response?.weekRange ? `${response.weekRange.from}-${response.weekRange.to}` : undefined,
      count: response?.count,
    });
  };

  const th = (label: string, col: string, className = '') => (
    <th
      className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-[#7c3aed] transition-colors ${className}`}
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
        <Link href="/tiber-data-lab" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#7c3aed] transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />
          Data Lab
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <Target className="h-6 w-6 text-[#7c3aed]" />
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
            Receiving Lab
          </h1>
          <Badge variant="secondary" className="text-xs font-medium bg-[#7c3aed]/10 text-[#7c3aed] border-0">
            NEW
          </Badge>
        </div>
        <p className="text-gray-500 text-sm">Target & Efficiency Analysis</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Tabs value={position} onValueChange={setPosition}>
          <TabsList className="bg-[#f4f4f4]">
            <TabsTrigger value="WR" className="data-[state=active]:bg-[#7c3aed] data-[state=active]:text-white">WR</TabsTrigger>
            <TabsTrigger value="TE" className="data-[state=active]:bg-[#7c3aed] data-[state=active]:text-white">TE</TabsTrigger>
            <TabsTrigger value="RB" className="data-[state=active]:bg-[#7c3aed] data-[state=active]:text-white">RB</TabsTrigger>
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
        {sortedData.length > 0 && (
          <button
            onClick={handleExport}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#7c3aed] bg-[#7c3aed]/10 hover:bg-[#7c3aed]/20 rounded-md transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
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
                <Zap className="h-3.5 w-3.5 text-[#7c3aed]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg EPA/Tgt</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtDec(summaryStats.avgEpa)}</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-100 bg-[#fafafa]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="h-3.5 w-3.5 text-[#7c3aed]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg Catch Rate</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtPct(summaryStats.avgCatch)}</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-100 bg-[#fafafa]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart3 className="h-3.5 w-3.5 text-[#7c3aed]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg YPRR</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtDec(summaryStats.avgYprr)}</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-100 bg-[#fafafa]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-[#7c3aed]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg YAC o/Exp</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtDec(summaryStats.avgYacOE)}</div>
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
                {th('Tgt', 'totalTargets')}
                {th('Rec', 'totalReceptions')}
                {th('Yds', 'totalRecYards')}
                {th('TD', 'totalRecTds')}
                {th('aDOT', 'avgAdot')}
                {th('EPA/Tgt', 'avgEpaPerTarget')}
                {th('Catch%', 'avgCatchRate')}
                {th('YPRR', 'yprr')}
                {th('TPRR', 'tprr')}
                {th('WOPR', 'avgWopr')}
                {th('RACR', 'avgRacr')}
                {th('xYAC', 'avgXYac')}
                {th('YAC o/E', 'avgYacOverExpected')}
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Depth</th>
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
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-10" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-6" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-10" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-10" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-3 py-2.5"><Skeleton className="h-4 w-10" /></td>
                  </tr>
                ))
              ) : sortedData.map((p, i) => (
                <tr key={p.playerId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'} hover:bg-[#7c3aed]/5 transition-colors`}>
                  <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{i + 1}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{p.playerName}</td>
                  <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.teamId ?? '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.gamesPlayed)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalTargets)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalReceptions)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRecYards)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRecTds)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtDec(p.avgAdot, 1)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtDec(p.avgEpaPerTarget)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgCatchRate)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtDec(p.yprr)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtDec(p.tprr, 3)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtDec(p.avgWopr)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtDec(p.avgRacr)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtDec(p.avgXYac, 1)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtDec(p.avgYacOverExpected, 1)}</td>
                  <td className="px-3 py-2.5">
                    <DepthBar deep={p.avgDeepTargetRate} inter={p.avgIntermediateTargetRate} short={p.avgShortTargetRate} />
                  </td>
                  <td className="px-3 py-2.5 font-mono font-semibold text-[#7c3aed]">{fmtDec(p.totalFptsPpr, 1)}</td>
                </tr>
              ))}
              {!isLoading && sortedData.length === 0 && (
                <tr>
                  <td colSpan={19} className="px-3 py-12 text-center text-gray-400">
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
