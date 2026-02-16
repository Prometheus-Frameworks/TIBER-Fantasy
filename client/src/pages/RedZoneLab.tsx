import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, Target, TrendingUp, BarChart3, Zap, Download } from 'lucide-react';
import { exportLabCsv, CsvColumn } from '@/lib/csvExport';
import { AiPromptHints } from '@/components/AiPromptHints';
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
  totalRzSnaps: number;
  avgRzSnapRate: number | null;
  avgRzSuccessRate: number | null;
  totalRzTargets: number;
  totalRzReceptions: number;
  totalRzRecTds: number;
  avgRzTargetShare: number | null;
  avgRzCatchRate: number | null;
  totalRzRushAttempts: number;
  totalRzRushTds: number;
  avgRzRushTdRate: number | null;
  totalRzPassAttempts: number;
  totalRzPassTds: number;
  avgRzTdRate: number | null;
  totalRzInterceptions: number;
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
    ? <ArrowUp className="h-3 w-3 ml-1 text-[#dc2626]" />
    : <ArrowDown className="h-3 w-3 ml-1 text-[#dc2626]" />;
}

export default function RedZoneLab() {
  const [position, setPosition] = useState('ALL');
  const [season, setSeason] = useState('2025');
  const [sortColumn, setSortColumn] = useState('totalRzSnaps');
  const [sortDirection, setSortDirection] = useState<SortDir>('desc');

  const { data: response, isLoading } = useQuery<AggResponse>({
    queryKey: ['/api/data-lab/lab-agg', { season, position, module: 'redzone' }],
    queryFn: () => {
      const params = new URLSearchParams({ season, weekMode: 'season', limit: '150' });
      if (position !== 'ALL') params.set('position', position);
      return fetch(`/api/data-lab/lab-agg?${params}`).then(r => r.json());
    },
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
    const totalRzTds = d.reduce((sum, p) => sum + (p.totalRzRecTds || 0) + (p.totalRzRushTds || 0), 0);
    return {
      totalRzTds,
      avgSuccessRate: avg(d.map(p => p.avgRzSuccessRate)),
      avgCatchRate: avg(d.filter(p => p.position === 'WR' || p.position === 'TE').map(p => p.avgRzCatchRate)),
      avgTdRate: avg(d.map(p => p.avgRzTdRate)),
    };
  }, [response?.data]);

  const csvColumns: CsvColumn[] = [
    { key: 'playerName', label: 'Player' },
    { key: 'teamId', label: 'Team' },
    { key: 'position', label: 'Position' },
    { key: 'gamesPlayed', label: 'Games Played', format: 'int' },
    { key: 'totalSnaps', label: 'Total Snaps', format: 'int' },
    { key: 'totalRzSnaps', label: 'RZ Snaps', format: 'int' },
    { key: 'avgRzSnapRate', label: 'RZ Snap Rate %', format: 'pct' },
    { key: 'avgRzSuccessRate', label: 'RZ Success Rate %', format: 'pct' },
    { key: 'totalRzTargets', label: 'RZ Targets', format: 'int' },
    { key: 'totalRzReceptions', label: 'RZ Receptions', format: 'int' },
    { key: 'totalRzRecTds', label: 'RZ Receiving TDs', format: 'int' },
    { key: 'avgRzTargetShare', label: 'RZ Target Share %', format: 'pct' },
    { key: 'avgRzCatchRate', label: 'RZ Catch Rate %', format: 'pct' },
    { key: 'totalRzRushAttempts', label: 'RZ Rush Attempts', format: 'int' },
    { key: 'totalRzRushTds', label: 'RZ Rush TDs', format: 'int' },
    { key: 'avgRzRushTdRate', label: 'RZ Rush TD Rate %', format: 'pct' },
    { key: 'totalRzPassAttempts', label: 'RZ Pass Attempts', format: 'int' },
    { key: 'totalRzPassTds', label: 'RZ Pass TDs', format: 'int' },
    { key: 'avgRzTdRate', label: 'RZ TD Rate %', format: 'pct' },
    { key: 'totalRzInterceptions', label: 'RZ Interceptions', format: 'int' },
    { key: 'totalRecTds', label: 'Total Rec TDs', format: 'int' },
    { key: 'totalRushTds', label: 'Total Rush TDs', format: 'int' },
    { key: 'totalFptsStd', label: 'Fantasy Points (Std)', format: 'dec', decimals: 1 },
    { key: 'totalFptsHalf', label: 'Fantasy Points (Half)', format: 'dec', decimals: 1 },
    { key: 'totalFptsPpr', label: 'Fantasy Points (PPR)', format: 'dec', decimals: 1 },
  ];

  const handleExport = () => {
    if (!sortedData.length) return;
    exportLabCsv(sortedData, csvColumns, {
      module: 'red-zone',
      position,
      season,
      weekRange: response?.weekRange ? `${response.weekRange.from}-${response.weekRange.to}` : undefined,
      count: response?.count,
    });
  };

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
      className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-[#dc2626] transition-colors ${className}`}
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center">
        {label}
        <SortIcon column={col} sortColumn={sortColumn} sortDirection={sortDirection} />
      </div>
    </th>
  );

  const showWrTe = position === 'WR' || position === 'TE';
  const showRb = position === 'RB';
  const showQb = position === 'QB';
  const showAll = position === 'ALL';

  const colCount = 8 + (showWrTe ? 5 : 0) + (showRb ? 6 : 0) + (showQb ? 5 : 0) + (showAll ? 1 : 0);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 bg-white min-h-screen">
      <div className="mb-6">
        <Link href="/tiber-data-lab" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#dc2626] transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />
          Data Lab
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <Target className="h-6 w-6 text-[#dc2626]" />
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
            Red Zone Lab
          </h1>
          <Badge variant="secondary" className="text-xs font-medium bg-[#dc2626]/10 text-[#dc2626] border-0">
            NEW
          </Badge>
        </div>
        <p className="text-gray-500 text-sm">Scoring Opportunity Analysis</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Tabs value={position} onValueChange={setPosition}>
          <TabsList className="bg-[#f4f4f4]">
            <TabsTrigger value="ALL" className="data-[state=active]:bg-[#dc2626] data-[state=active]:text-white">ALL</TabsTrigger>
            <TabsTrigger value="QB" className="data-[state=active]:bg-[#dc2626] data-[state=active]:text-white">QB</TabsTrigger>
            <TabsTrigger value="RB" className="data-[state=active]:bg-[#dc2626] data-[state=active]:text-white">RB</TabsTrigger>
            <TabsTrigger value="WR" className="data-[state=active]:bg-[#dc2626] data-[state=active]:text-white">WR</TabsTrigger>
            <TabsTrigger value="TE" className="data-[state=active]:bg-[#dc2626] data-[state=active]:text-white">TE</TabsTrigger>
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
        <div className="ml-auto flex items-center gap-2">
          {sortedData.length > 0 && (
            <>
              <AiPromptHints
                accentColor="#dc2626"
                module="rz_redzone"
              />
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#dc2626] bg-[#dc2626]/10 hover:bg-[#dc2626]/20 rounded-md transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            </>
          )}
        </div>
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
                <Zap className="h-3.5 w-3.5 text-[#dc2626]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Total RZ TDs</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{summaryStats.totalRzTds}</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-100 bg-[#fafafa]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="h-3.5 w-3.5 text-[#dc2626]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg RZ Success Rate</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtPct(summaryStats.avgSuccessRate)}</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-100 bg-[#fafafa]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart3 className="h-3.5 w-3.5 text-[#dc2626]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg RZ Catch Rate</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtPct(summaryStats.avgCatchRate)}</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-100 bg-[#fafafa]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-[#dc2626]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg RZ TD Rate</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtPct(summaryStats.avgTdRate)}</div>
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
                {showAll && th('Pos', 'position')}
                {th('GP', 'gamesPlayed')}
                {th('RZ Snaps', 'totalRzSnaps')}
                {th('RZ Snap%', 'avgRzSnapRate')}
                {th('RZ Succ%', 'avgRzSuccessRate')}
                {(showWrTe || showAll) && th('RZ Tgt', 'totalRzTargets')}
                {(showWrTe || showAll) && th('RZ Rec', 'totalRzReceptions')}
                {(showWrTe || showAll) && th('RZ Rec TD', 'totalRzRecTds')}
                {showWrTe && th('RZ Tgt Share', 'avgRzTargetShare')}
                {showWrTe && th('RZ Catch%', 'avgRzCatchRate')}
                {(showRb || showAll) && th('RZ Rush Att', 'totalRzRushAttempts')}
                {(showRb || showAll) && th('RZ Rush TD', 'totalRzRushTds')}
                {showRb && th('RZ Rush TD%', 'avgRzRushTdRate')}
                {showRb && th('RZ Tgt', 'totalRzTargets')}
                {showRb && th('RZ Rec', 'totalRzReceptions')}
                {showRb && th('RZ Rec TD', 'totalRzRecTds')}
                {showQb && th('RZ Pass Att', 'totalRzPassAttempts')}
                {showQb && th('RZ Pass TD', 'totalRzPassTds')}
                {showQb && th('RZ TD%', 'avgRzTdRate')}
                {showQb && th('RZ INTs', 'totalRzInterceptions')}
                {showQb && th('RZ Rush TD', 'totalRzRushTds')}
                {th('FPTS PPR', 'totalFptsPpr')}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(15)].map((_, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}>
                    {[...Array(colCount)].map((_, j) => (
                      <td key={j} className="px-3 py-2.5"><Skeleton className="h-4 w-8" /></td>
                    ))}
                  </tr>
                ))
              ) : sortedData.map((p, i) => (
                <tr key={p.playerId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'} hover:bg-[#dc2626]/5 transition-colors`}>
                  <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{i + 1}</td>
                  <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{p.playerName}</td>
                  <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.teamId ?? '—'}</td>
                  {showAll && <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{p.position ?? '—'}</td>}
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.gamesPlayed)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzSnaps)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgRzSnapRate)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgRzSuccessRate)}</td>
                  {(showWrTe || showAll) && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzTargets)}</td>}
                  {(showWrTe || showAll) && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzReceptions)}</td>}
                  {(showWrTe || showAll) && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzRecTds)}</td>}
                  {showWrTe && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgRzTargetShare)}</td>}
                  {showWrTe && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgRzCatchRate)}</td>}
                  {(showRb || showAll) && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzRushAttempts)}</td>}
                  {(showRb || showAll) && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzRushTds)}</td>}
                  {showRb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgRzRushTdRate)}</td>}
                  {showRb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzTargets)}</td>}
                  {showRb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzReceptions)}</td>}
                  {showRb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzRecTds)}</td>}
                  {showQb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzPassAttempts)}</td>}
                  {showQb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzPassTds)}</td>}
                  {showQb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgRzTdRate)}</td>}
                  {showQb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzInterceptions)}</td>}
                  {showQb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzRushTds)}</td>}
                  <td className="px-3 py-2.5 font-mono font-semibold text-[#dc2626]">{fmtDec(p.totalFptsPpr, 1)}</td>
                </tr>
              ))}
              {!isLoading && sortedData.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="px-3 py-12 text-center text-gray-400">
                    No data available for {position === 'ALL' ? 'all positions' : position} in {season}
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
