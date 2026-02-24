import { useState, useMemo, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useCurrentNFLWeek } from '@/hooks/useCurrentNFLWeek';
import { ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown, Clock, TrendingUp, BarChart3, Zap, Download } from 'lucide-react';
import { exportLabCsv, CsvColumn } from '@/lib/csvExport';
import { AiPromptHints } from '@/components/AiPromptHints';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface PlayerRow {
  playerId: string;
  playerName: string;
  teamId: string | null;
  position: string | null;
  gamesPlayed: number;
  totalThirdDownSnaps: number;
  totalThirdDownConversions: number;
  avgThirdDownConversionRate: number | null;
  avgEarlyDownSuccessRate: number | null;
  avgLateDownSuccessRate: number | null;
  totalShortYardageAttempts: number;
  totalShortYardageConversions: number;
  avgShortYardageRate: number | null;
  totalThirdDownTargets: number;
  totalThirdDownReceptions: number;
  totalThirdDownRecConversions: number;
  totalTwoMinuteSnaps: number;
  totalTwoMinuteSuccessful: number;
  avgTwoMinuteSuccessRate: number | null;
  totalHurryUpSnaps: number;
  totalHurryUpSuccessful: number;
  avgHurryUpSuccessRate: number | null;
  totalTwoMinuteTargets: number;
  totalTwoMinuteReceptions: number;
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
    ? <ArrowUp className="h-3 w-3 ml-1 text-[#ca8a04]" />
    : <ArrowDown className="h-3 w-3 ml-1 text-[#ca8a04]" />;
}

export default function SituationalLab() {
  const { season: currentSeason } = useCurrentNFLWeek();
  const [position, setPosition] = useState('ALL');
  const [season, setSeason] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    setSeason(String(currentSeason));
  }, [currentSeason]);
  const [activeTab, setActiveTab] = useState('down-distance');

  const [ddSortCol, setDdSortCol] = useState('totalThirdDownSnaps');
  const [ddSortDir, setDdSortDir] = useState<SortDir>('desc');
  const [tmSortCol, setTmSortCol] = useState('totalTwoMinuteSnaps');
  const [tmSortDir, setTmSortDir] = useState<SortDir>('desc');
  const [huSortCol, setHuSortCol] = useState('totalHurryUpSnaps');
  const [huSortDir, setHuSortDir] = useState<SortDir>('desc');

  const posParam = position === 'ALL' ? '' : `&position=${position}`;

  const { data: response, isLoading } = useQuery<AggResponse>({
    queryKey: ['/api/data-lab/lab-agg', { season, position, module: 'situational' }],
    queryFn: () => fetch(`/api/data-lab/lab-agg?season=${season}&weekMode=season${posParam}&limit=150`).then(r => r.json()),
  });

  const sortData = (data: PlayerRow[], col: string, dir: SortDir) => {
    const rows = [...data];
    rows.sort((a, b) => {
      const aVal = (a as any)[col] ?? -Infinity;
      const bVal = (b as any)[col] ?? -Infinity;
      return dir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return rows;
  };

  const ddData = useMemo(() => {
    if (!response?.data) return [];
    return sortData(response.data, ddSortCol, ddSortDir);
  }, [response?.data, ddSortCol, ddSortDir]);

  const tmData = useMemo(() => {
    if (!response?.data) return [];
    return sortData(response.data, tmSortCol, tmSortDir);
  }, [response?.data, tmSortCol, tmSortDir]);

  const huData = useMemo(() => {
    if (!response?.data) return [];
    return sortData(response.data, huSortCol, huSortDir);
  }, [response?.data, huSortCol, huSortDir]);

  const summaryStats = useMemo(() => {
    if (!response?.data?.length) return null;
    const d = response.data;
    return {
      avg3dConv: avg(d.map(p => p.avgThirdDownConversionRate)),
      avgEarlyDown: avg(d.map(p => p.avgEarlyDownSuccessRate)),
      avg2min: avg(d.map(p => p.avgTwoMinuteSuccessRate)),
      avgHurryUp: avg(d.map(p => p.avgHurryUpSuccessRate)),
    };
  }, [response?.data]);

  const csvColumns: CsvColumn[] = [
    { key: 'playerName', label: 'Player' },
    { key: 'teamId', label: 'Team' },
    { key: 'position', label: 'Position' },
    { key: 'gamesPlayed', label: 'Games Played', format: 'int' },
    { key: 'totalSnaps', label: 'Total Snaps', format: 'int' },
    { key: 'totalThirdDownSnaps', label: '3rd Down Snaps', format: 'int' },
    { key: 'totalThirdDownConversions', label: '3rd Down Conversions', format: 'int' },
    { key: 'avgThirdDownConversionRate', label: '3rd Down Conv %', format: 'pct' },
    { key: 'avgEarlyDownSuccessRate', label: 'Early Down Success %', format: 'pct' },
    { key: 'avgLateDownSuccessRate', label: 'Late Down Success %', format: 'pct' },
    { key: 'totalShortYardageAttempts', label: 'Short Yardage Attempts', format: 'int' },
    { key: 'totalShortYardageConversions', label: 'Short Yardage Conversions', format: 'int' },
    { key: 'avgShortYardageRate', label: 'Short Yardage Rate %', format: 'pct' },
    { key: 'totalThirdDownTargets', label: '3rd Down Targets', format: 'int' },
    { key: 'totalThirdDownReceptions', label: '3rd Down Receptions', format: 'int' },
    { key: 'totalThirdDownRecConversions', label: '3rd Down Rec Conversions', format: 'int' },
    { key: 'totalTwoMinuteSnaps', label: '2-Min Snaps', format: 'int' },
    { key: 'totalTwoMinuteSuccessful', label: '2-Min Successful', format: 'int' },
    { key: 'avgTwoMinuteSuccessRate', label: '2-Min Success %', format: 'pct' },
    { key: 'totalTwoMinuteTargets', label: '2-Min Targets', format: 'int' },
    { key: 'totalTwoMinuteReceptions', label: '2-Min Receptions', format: 'int' },
    { key: 'totalHurryUpSnaps', label: 'Hurry-Up Snaps', format: 'int' },
    { key: 'totalHurryUpSuccessful', label: 'Hurry-Up Successful', format: 'int' },
    { key: 'avgHurryUpSuccessRate', label: 'Hurry-Up Success %', format: 'pct' },
    { key: 'avgSuccessRate', label: 'Overall Success %', format: 'pct' },
    { key: 'totalFptsStd', label: 'Fantasy Points (Std)', format: 'dec', decimals: 1 },
    { key: 'totalFptsHalf', label: 'Fantasy Points (Half)', format: 'dec', decimals: 1 },
    { key: 'totalFptsPpr', label: 'Fantasy Points (PPR)', format: 'dec', decimals: 1 },
  ];

  const handleExport = () => {
    const activeData = activeTab === 'down-distance' ? ddData : activeTab === 'two-minute' ? tmData : huData;
    if (!activeData.length) return;
    exportLabCsv(activeData, csvColumns, {
      module: `situational-${activeTab}`,
      position,
      season,
      weekRange: response?.weekRange ? `${response.weekRange.from}-${response.weekRange.to}` : undefined,
      count: response?.count,
    });
  };

  const handleSort = (
    tab: 'dd' | 'tm' | 'hu',
    col: string
  ) => {
    if (tab === 'dd') {
      if (ddSortCol === col) setDdSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
      else { setDdSortCol(col); setDdSortDir('desc'); }
    } else if (tab === 'tm') {
      if (tmSortCol === col) setTmSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
      else { setTmSortCol(col); setTmSortDir('desc'); }
    } else {
      if (huSortCol === col) setHuSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
      else { setHuSortCol(col); setHuSortDir('desc'); }
    }
  };

  const th = (label: string, col: string, tab: 'dd' | 'tm' | 'hu', className = '') => {
    const sortCol = tab === 'dd' ? ddSortCol : tab === 'tm' ? tmSortCol : huSortCol;
    const sortDir = tab === 'dd' ? ddSortDir : tab === 'tm' ? tmSortDir : huSortDir;
    return (
      <th
        className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-[#ca8a04] transition-colors ${className}`}
        onClick={() => handleSort(tab, col)}
      >
        <div className="flex items-center">
          {label}
          <SortIcon column={col} sortColumn={sortCol} sortDirection={sortDir} />
        </div>
      </th>
    );
  };

  const showRbCols = position === 'RB';
  const showWrTeCols = position === 'WR' || position === 'TE';

  const skeletonRows = (cols: number) => (
    [...Array(15)].map((_, i) => (
      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}>
        {[...Array(cols)].map((_, j) => (
          <td key={j} className="px-3 py-2.5"><Skeleton className="h-4 w-10" /></td>
        ))}
      </tr>
    ))
  );

  const emptyRow = (cols: number) => (
    <tr>
      <td colSpan={cols} className="px-3 py-12 text-center text-gray-400">
        No data available for {position === 'ALL' ? 'all positions' : position} in {season}
      </td>
    </tr>
  );

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 bg-white min-h-screen">
      <div className="mb-6">
        <Link href="/tiber-data-lab" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#ca8a04] transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />
          Data Lab
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <Clock className="h-6 w-6 text-[#ca8a04]" />
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
            Situational Lab
          </h1>
          <Badge variant="secondary" className="text-xs font-medium bg-[#ca8a04]/10 text-[#ca8a04] border-0">
            NEW
          </Badge>
        </div>
        <p className="text-gray-500 text-sm">Context-Dependent Performance</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Tabs value={position} onValueChange={setPosition}>
          <TabsList className="bg-[#f4f4f4]">
            <TabsTrigger value="ALL" className="data-[state=active]:bg-[#ca8a04] data-[state=active]:text-white">ALL</TabsTrigger>
            <TabsTrigger value="QB" className="data-[state=active]:bg-[#ca8a04] data-[state=active]:text-white">QB</TabsTrigger>
            <TabsTrigger value="RB" className="data-[state=active]:bg-[#ca8a04] data-[state=active]:text-white">RB</TabsTrigger>
            <TabsTrigger value="WR" className="data-[state=active]:bg-[#ca8a04] data-[state=active]:text-white">WR</TabsTrigger>
            <TabsTrigger value="TE" className="data-[state=active]:bg-[#ca8a04] data-[state=active]:text-white">TE</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={season} onValueChange={setSeason}>
          <SelectTrigger className="w-28 bg-[#f4f4f4] border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={String(currentSeason)}>{currentSeason}</SelectItem>
            <SelectItem value={String(currentSeason - 1)}>{currentSeason - 1}</SelectItem>
          </SelectContent>
        </Select>
        {response && (
          <span className="text-xs text-gray-400 font-mono">
            {response.count} players · Wk {response.weekRange?.from}–{response.weekRange?.to}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {response?.data?.length ? (
            <>
              <AiPromptHints
                accentColor="#ca8a04"
                module="sit_situational"
              />
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#ca8a04] bg-[#ca8a04]/10 hover:bg-[#ca8a04]/20 rounded-md transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            </>
          ) : null}
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
                <TrendingUp className="h-3.5 w-3.5 text-[#ca8a04]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg 3rd Down Conv %</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtPct(summaryStats.avg3dConv)}</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-100 bg-[#fafafa]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <BarChart3 className="h-3.5 w-3.5 text-[#ca8a04]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg Early Down Success %</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtPct(summaryStats.avgEarlyDown)}</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-100 bg-[#fafafa]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3.5 w-3.5 text-[#ca8a04]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg 2-Min Success %</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtPct(summaryStats.avg2min)}</div>
            </CardContent>
          </Card>
          <Card className="border border-gray-100 bg-[#fafafa]">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="h-3.5 w-3.5 text-[#ca8a04]" />
                <span className="text-xs text-gray-400 uppercase tracking-wider">Avg Hurry-Up Success %</span>
              </div>
              <div className="text-xl font-mono font-semibold text-gray-900">{fmtPct(summaryStats.avgHurryUp)}</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#f4f4f4] mb-4">
          <TabsTrigger value="down-distance" className="data-[state=active]:bg-[#ca8a04] data-[state=active]:text-white">Down & Distance</TabsTrigger>
          <TabsTrigger value="two-minute" className="data-[state=active]:bg-[#ca8a04] data-[state=active]:text-white">Two-Minute Drill</TabsTrigger>
          <TabsTrigger value="hurry-up" className="data-[state=active]:bg-[#ca8a04] data-[state=active]:text-white">Hurry-Up</TabsTrigger>
        </TabsList>

        <TabsContent value="down-distance">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f4f4f4] border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
                    {th('Player', 'playerName', 'dd', 'min-w-[160px]')}
                    {th('Team', 'teamId', 'dd')}
                    {position === 'ALL' && <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pos</th>}
                    {th('GP', 'gamesPlayed', 'dd')}
                    {th('3D Snaps', 'totalThirdDownSnaps', 'dd')}
                    {th('3D Conv', 'totalThirdDownConversions', 'dd')}
                    {th('3D Conv %', 'avgThirdDownConversionRate', 'dd')}
                    {th('Early Down %', 'avgEarlyDownSuccessRate', 'dd')}
                    {th('Late Down %', 'avgLateDownSuccessRate', 'dd')}
                    {showRbCols && th('SY Att', 'totalShortYardageAttempts', 'dd')}
                    {showRbCols && th('SY Conv', 'totalShortYardageConversions', 'dd')}
                    {showRbCols && th('SY %', 'avgShortYardageRate', 'dd')}
                    {showWrTeCols && th('3D Tgt', 'totalThirdDownTargets', 'dd')}
                    {showWrTeCols && th('3D Rec', 'totalThirdDownReceptions', 'dd')}
                    {showWrTeCols && th('3D Rec Conv', 'totalThirdDownRecConversions', 'dd')}
                    {th('FPTS', 'totalFptsPpr', 'dd')}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? skeletonRows(position === 'ALL' ? 11 : showRbCols || showWrTeCols ? 13 : 10) : ddData.length === 0 ? emptyRow(13) : ddData.map((p, i) => (
                    <tr key={p.playerId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'} hover:bg-[#ca8a04]/5 transition-colors`}>
                      <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{p.playerName}</td>
                      <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.teamId ?? '—'}</td>
                      {position === 'ALL' && <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.position ?? '—'}</td>}
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.gamesPlayed)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalThirdDownSnaps)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalThirdDownConversions)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgThirdDownConversionRate)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgEarlyDownSuccessRate)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgLateDownSuccessRate)}</td>
                      {showRbCols && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalShortYardageAttempts)}</td>}
                      {showRbCols && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalShortYardageConversions)}</td>}
                      {showRbCols && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgShortYardageRate)}</td>}
                      {showWrTeCols && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalThirdDownTargets)}</td>}
                      {showWrTeCols && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalThirdDownReceptions)}</td>}
                      {showWrTeCols && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalThirdDownRecConversions)}</td>}
                      <td className="px-3 py-2.5 font-mono font-semibold text-[#ca8a04]">{p.totalFptsPpr?.toFixed(1) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="two-minute">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f4f4f4] border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
                    {th('Player', 'playerName', 'tm', 'min-w-[160px]')}
                    {th('Team', 'teamId', 'tm')}
                    {position === 'ALL' && <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pos</th>}
                    {th('GP', 'gamesPlayed', 'tm')}
                    {th('2-Min Snaps', 'totalTwoMinuteSnaps', 'tm')}
                    {th('2-Min Successful', 'totalTwoMinuteSuccessful', 'tm')}
                    {th('2-Min Success %', 'avgTwoMinuteSuccessRate', 'tm')}
                    {showWrTeCols && th('2-Min Tgt', 'totalTwoMinuteTargets', 'tm')}
                    {showWrTeCols && th('2-Min Rec', 'totalTwoMinuteReceptions', 'tm')}
                    {th('FPTS', 'totalFptsPpr', 'tm')}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? skeletonRows(position === 'ALL' ? 8 : showWrTeCols ? 10 : 8) : tmData.length === 0 ? emptyRow(10) : tmData.map((p, i) => (
                    <tr key={p.playerId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'} hover:bg-[#ca8a04]/5 transition-colors`}>
                      <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{p.playerName}</td>
                      <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.teamId ?? '—'}</td>
                      {position === 'ALL' && <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.position ?? '—'}</td>}
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.gamesPlayed)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalTwoMinuteSnaps)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalTwoMinuteSuccessful)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgTwoMinuteSuccessRate)}</td>
                      {showWrTeCols && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalTwoMinuteTargets)}</td>}
                      {showWrTeCols && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalTwoMinuteReceptions)}</td>}
                      <td className="px-3 py-2.5 font-mono font-semibold text-[#ca8a04]">{p.totalFptsPpr?.toFixed(1) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="hurry-up">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f4f4f4] border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
                    {th('Player', 'playerName', 'hu', 'min-w-[160px]')}
                    {th('Team', 'teamId', 'hu')}
                    {position === 'ALL' && <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pos</th>}
                    {th('GP', 'gamesPlayed', 'hu')}
                    {th('Hurry-Up Snaps', 'totalHurryUpSnaps', 'hu')}
                    {th('Hurry-Up Successful', 'totalHurryUpSuccessful', 'hu')}
                    {th('Hurry-Up Success %', 'avgHurryUpSuccessRate', 'hu')}
                    {th('FPTS', 'totalFptsPpr', 'hu')}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? skeletonRows(position === 'ALL' ? 9 : 8) : huData.length === 0 ? emptyRow(9) : huData.map((p, i) => (
                    <tr key={p.playerId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'} hover:bg-[#ca8a04]/5 transition-colors`}>
                      <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{p.playerName}</td>
                      <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.teamId ?? '—'}</td>
                      {position === 'ALL' && <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.position ?? '—'}</td>}
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.gamesPlayed)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalHurryUpSnaps)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalHurryUpSuccessful)}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgHurryUpSuccessRate)}</td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-[#ca8a04]">{p.totalFptsPpr?.toFixed(1) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
