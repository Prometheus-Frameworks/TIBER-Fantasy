import { useState, useMemo, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useCurrentNFLWeek } from '@/hooks/useCurrentNFLWeek';
import {
  ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown,
  Clock, TrendingUp, BarChart3, Zap, Download, Target, Search,
} from 'lucide-react';
import { exportLabCsv, CsvColumn } from '@/lib/csvExport';
import { AiPromptHints } from '@/components/AiPromptHints';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const ACCENT = '#e2640d';

interface PlayerRow {
  playerId: string;
  playerName: string;
  teamId: string | null;
  position: string | null;
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
    ? <ArrowUp className="h-3 w-3 ml-1" style={{ color: ACCENT }} />
    : <ArrowDown className="h-3 w-3 ml-1" style={{ color: ACCENT }} />;
}

function useSortState(defaultCol: string) {
  const [col, setCol] = useState(defaultCol);
  const [dir, setDir] = useState<SortDir>('desc');
  const toggle = (c: string) => {
    if (col === c) setDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setCol(c); setDir('desc'); }
  };
  return { col, dir, toggle };
}

const skeletonRows = (cols: number) =>
  [...Array(15)].map((_, i) => (
    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}>
      {[...Array(cols)].map((_, j) => (
        <td key={j} className="px-3 py-2.5"><Skeleton className="h-4 w-10" /></td>
      ))}
    </tr>
  ));

const emptyRow = (cols: number, label: string) => (
  <tr>
    <td colSpan={cols} className="px-3 py-12 text-center text-gray-400">
      No data available for {label}
    </td>
  </tr>
);

export default function SituationalLab() {
  const { season: currentSeason } = useCurrentNFLWeek();
  const [position, setPosition] = useState('ALL');
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [activeTab, setActiveTab] = useState('red-zone');

  useEffect(() => { setSeason(String(currentSeason)); }, [currentSeason]);

  const [searchQuery, setSearchQuery] = useState('');
  const rz = useSortState('totalRzSnaps');
  const dd = useSortState('totalThirdDownSnaps');
  const tm = useSortState('totalTwoMinuteSnaps');
  const hu = useSortState('totalHurryUpSnaps');

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

  const rzData = useMemo(() => {
    if (!response?.data) return [];
    const rows = sortData(response.data, rz.col, rz.dir);
    const q = searchQuery.trim().toLowerCase();
    return q ? rows.filter(r => r.playerName.toLowerCase().includes(q)) : rows;
  }, [response?.data, rz.col, rz.dir, searchQuery]);
  const ddData = useMemo(() => {
    if (!response?.data) return [];
    const rows = sortData(response.data, dd.col, dd.dir);
    const q = searchQuery.trim().toLowerCase();
    return q ? rows.filter(r => r.playerName.toLowerCase().includes(q)) : rows;
  }, [response?.data, dd.col, dd.dir, searchQuery]);
  const tmData = useMemo(() => {
    if (!response?.data) return [];
    const rows = sortData(response.data, tm.col, tm.dir);
    const q = searchQuery.trim().toLowerCase();
    return q ? rows.filter(r => r.playerName.toLowerCase().includes(q)) : rows;
  }, [response?.data, tm.col, tm.dir, searchQuery]);
  const huData = useMemo(() => {
    if (!response?.data) return [];
    const rows = sortData(response.data, hu.col, hu.dir);
    const q = searchQuery.trim().toLowerCase();
    return q ? rows.filter(r => r.playerName.toLowerCase().includes(q)) : rows;
  }, [response?.data, hu.col, hu.dir, searchQuery]);

  const rzStats = useMemo(() => {
    if (!response?.data?.length) return null;
    const d = response.data;
    return {
      totalRzTds: d.reduce((s, p) => s + (p.totalRzRecTds || 0) + (p.totalRzRushTds || 0), 0),
      avgSuccessRate: avg(d.map(p => p.avgRzSuccessRate)),
      avgCatchRate: avg(d.filter(p => p.position === 'WR' || p.position === 'TE').map(p => p.avgRzCatchRate)),
      avgTdRate: avg(d.map(p => p.avgRzTdRate)),
    };
  }, [response?.data]);

  const sitStats = useMemo(() => {
    if (!response?.data?.length) return null;
    const d = response.data;
    return {
      avg3dConv: avg(d.map(p => p.avgThirdDownConversionRate)),
      avgEarlyDown: avg(d.map(p => p.avgEarlyDownSuccessRate)),
      avg2min: avg(d.map(p => p.avgTwoMinuteSuccessRate)),
      avgHurryUp: avg(d.map(p => p.avgHurryUpSuccessRate)),
    };
  }, [response?.data]);

  const showRb = position === 'RB';
  const showWrTe = position === 'WR' || position === 'TE';
  const showQb = position === 'QB';
  const showAll = position === 'ALL';

  const posLabel = position === 'ALL' ? 'all positions' : position;

  const makeTh = (sort: ReturnType<typeof useSortState>) =>
    (label: string, col: string, className = '') => (
      <th
        className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-[#e2640d] transition-colors ${className}`}
        onClick={() => sort.toggle(col)}
      >
        <div className="flex items-center">
          {label}
          <SortIcon column={col} sortColumn={sort.col} sortDirection={sort.dir} />
        </div>
      </th>
    );

  const rzTh = makeTh(rz);
  const ddTh = makeTh(dd);
  const tmTh = makeTh(tm);
  const huTh = makeTh(hu);

  const csvColumnsRz: CsvColumn[] = [
    { key: 'playerName', label: 'Player' }, { key: 'teamId', label: 'Team' },
    { key: 'position', label: 'Position' }, { key: 'gamesPlayed', label: 'Games', format: 'int' },
    { key: 'totalRzSnaps', label: 'RZ Snaps', format: 'int' }, { key: 'avgRzSnapRate', label: 'RZ Snap%', format: 'pct' },
    { key: 'avgRzSuccessRate', label: 'RZ Succ%', format: 'pct' }, { key: 'totalRzTargets', label: 'RZ Tgt', format: 'int' },
    { key: 'totalRzReceptions', label: 'RZ Rec', format: 'int' }, { key: 'totalRzRecTds', label: 'RZ Rec TD', format: 'int' },
    { key: 'avgRzTargetShare', label: 'RZ Tgt Share', format: 'pct' }, { key: 'avgRzCatchRate', label: 'RZ Catch%', format: 'pct' },
    { key: 'totalRzRushAttempts', label: 'RZ Rush Att', format: 'int' }, { key: 'totalRzRushTds', label: 'RZ Rush TD', format: 'int' },
    { key: 'avgRzRushTdRate', label: 'RZ Rush TD%', format: 'pct' }, { key: 'totalRzPassAttempts', label: 'RZ Pass Att', format: 'int' },
    { key: 'totalRzPassTds', label: 'RZ Pass TD', format: 'int' }, { key: 'avgRzTdRate', label: 'RZ TD%', format: 'pct' },
    { key: 'totalRzInterceptions', label: 'RZ INTs', format: 'int' }, { key: 'totalFptsPpr', label: 'FPTS PPR', format: 'dec', decimals: 1 },
  ];

  const csvColumnsSit: CsvColumn[] = [
    { key: 'playerName', label: 'Player' }, { key: 'teamId', label: 'Team' },
    { key: 'position', label: 'Position' }, { key: 'gamesPlayed', label: 'Games', format: 'int' },
    { key: 'totalThirdDownSnaps', label: '3D Snaps', format: 'int' }, { key: 'totalThirdDownConversions', label: '3D Conv', format: 'int' },
    { key: 'avgThirdDownConversionRate', label: '3D Conv%', format: 'pct' }, { key: 'avgEarlyDownSuccessRate', label: 'Early Down%', format: 'pct' },
    { key: 'avgLateDownSuccessRate', label: 'Late Down%', format: 'pct' }, { key: 'totalShortYardageAttempts', label: 'SY Att', format: 'int' },
    { key: 'totalShortYardageConversions', label: 'SY Conv', format: 'int' }, { key: 'avgShortYardageRate', label: 'SY%', format: 'pct' },
    { key: 'totalThirdDownTargets', label: '3D Tgt', format: 'int' }, { key: 'totalThirdDownReceptions', label: '3D Rec', format: 'int' },
    { key: 'totalTwoMinuteSnaps', label: '2-Min Snaps', format: 'int' }, { key: 'avgTwoMinuteSuccessRate', label: '2-Min Succ%', format: 'pct' },
    { key: 'totalHurryUpSnaps', label: 'Hurry Snaps', format: 'int' }, { key: 'avgHurryUpSuccessRate', label: 'Hurry Succ%', format: 'pct' },
    { key: 'totalFptsPpr', label: 'FPTS PPR', format: 'dec', decimals: 1 },
  ];

  const handleExport = () => {
    if (!response) return;
    const meta = { position, season, weekRange: response.weekRange ? `${response.weekRange.from}-${response.weekRange.to}` : undefined, count: response.count };
    if (activeTab === 'red-zone') exportLabCsv(rzData, csvColumnsRz, { module: 'red-zone', ...meta });
    else if (activeTab === 'down-distance') exportLabCsv(ddData, csvColumnsSit, { module: 'situational-down-distance', ...meta });
    else if (activeTab === 'two-minute') exportLabCsv(tmData, csvColumnsSit, { module: 'situational-two-minute', ...meta });
    else exportLabCsv(huData, csvColumnsSit, { module: 'situational-hurry-up', ...meta });
  };

  const hasData = !!(response?.data?.length);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 bg-white min-h-screen">
      <div className="mb-6">
        <Link href="/tiber-data-lab" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#e2640d] transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />
          Data Lab
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <Clock className="h-6 w-6 text-[#e2640d]" />
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
            Situational Lab
          </h1>
          <Badge variant="secondary" className="text-xs font-medium bg-[#e2640d]/10 text-[#e2640d] border-0">
            NEW
          </Badge>
        </div>
        <p className="text-gray-500 text-sm">Red Zone & Context-Dependent Performance</p>
      </div>

      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <Tabs value={position} onValueChange={setPosition}>
          <TabsList className="bg-[#f4f4f4]">
            {['ALL', 'QB', 'RB', 'WR', 'TE'].map(p => (
              <TabsTrigger key={p} value={p} className="data-[state=active]:bg-[#e2640d] data-[state=active]:text-white">{p}</TabsTrigger>
            ))}
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
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search player..."
            className="pl-8 pr-3 py-1.5 text-sm bg-[#f4f4f4] border border-gray-200 rounded-md w-44 focus:outline-none focus:ring-1 focus:ring-[#e2640d]/40 placeholder:text-gray-400"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {hasData && (
            <>
              <AiPromptHints accentColor={ACCENT} module="sit_situational" />
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#e2640d] bg-[#e2640d]/10 hover:bg-[#e2640d]/20 rounded-md transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#f4f4f4] mb-5">
          <TabsTrigger value="red-zone" className="data-[state=active]:bg-[#e2640d] data-[state=active]:text-white">
            <Target className="h-3.5 w-3.5 mr-1.5" />
            Red Zone
          </TabsTrigger>
          <TabsTrigger value="down-distance" className="data-[state=active]:bg-[#e2640d] data-[state=active]:text-white">Down &amp; Distance</TabsTrigger>
          <TabsTrigger value="two-minute" className="data-[state=active]:bg-[#e2640d] data-[state=active]:text-white">Two-Minute Drill</TabsTrigger>
          <TabsTrigger value="hurry-up" className="data-[state=active]:bg-[#e2640d] data-[state=active]:text-white">Hurry-Up</TabsTrigger>
        </TabsList>

        <TabsContent value="red-zone">
          {isLoading && !rzStats ? (
            <div className="grid grid-cols-4 gap-4 mb-5">
              {[...Array(4)].map((_, i) => <Card key={i} className="border border-gray-100"><CardContent className="p-4"><Skeleton className="h-3 w-20 mb-2" /><Skeleton className="h-7 w-16" /></CardContent></Card>)}
            </div>
          ) : rzStats ? (
            <div className="grid grid-cols-4 gap-4 mb-5">
              {[
                { icon: Zap, label: 'Total RZ TDs', val: String(rzStats.totalRzTds) },
                { icon: Target, label: 'Avg RZ Success%', val: fmtPct(rzStats.avgSuccessRate) },
                { icon: BarChart3, label: 'Avg RZ Catch% (WR/TE)', val: fmtPct(rzStats.avgCatchRate) },
                { icon: TrendingUp, label: 'Avg RZ TD Rate', val: fmtPct(rzStats.avgTdRate) },
              ].map(({ icon: Icon, label, val }) => (
                <Card key={label} className="border border-gray-100 bg-[#fafafa]">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="h-3.5 w-3.5 text-[#e2640d]" />
                      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
                    </div>
                    <div className="text-xl font-mono font-semibold text-gray-900">{val}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f4f4f4] border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
                    {rzTh('Player', 'playerName', 'min-w-[160px]')}
                    {rzTh('Team', 'teamId')}
                    {showAll && <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pos</th>}
                    {rzTh('GP', 'gamesPlayed')}
                    {rzTh('RZ Snaps', 'totalRzSnaps')}
                    {rzTh('RZ Snap%', 'avgRzSnapRate')}
                    {rzTh('RZ Succ%', 'avgRzSuccessRate')}
                    {(showWrTe || showAll) && rzTh('RZ Tgt', 'totalRzTargets')}
                    {(showWrTe || showAll) && rzTh('RZ Rec', 'totalRzReceptions')}
                    {(showWrTe || showAll) && rzTh('RZ Rec TD', 'totalRzRecTds')}
                    {showWrTe && rzTh('RZ Tgt%', 'avgRzTargetShare')}
                    {showWrTe && rzTh('RZ Catch%', 'avgRzCatchRate')}
                    {(showRb || showAll) && rzTh('RZ Rush Att', 'totalRzRushAttempts')}
                    {(showRb || showAll) && rzTh('RZ Rush TD', 'totalRzRushTds')}
                    {showRb && rzTh('RZ Rush TD%', 'avgRzRushTdRate')}
                    {showRb && rzTh('RZ Tgt', 'totalRzTargets')}
                    {showRb && rzTh('RZ Rec TD', 'totalRzRecTds')}
                    {showQb && rzTh('RZ Pass Att', 'totalRzPassAttempts')}
                    {showQb && rzTh('RZ Pass TD', 'totalRzPassTds')}
                    {showQb && rzTh('RZ TD%', 'avgRzTdRate')}
                    {showQb && rzTh('RZ INTs', 'totalRzInterceptions')}
                    {showQb && rzTh('RZ Rush TD', 'totalRzRushTds')}
                    {rzTh('FPTS PPR', 'totalFptsPpr')}
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? skeletonRows(9 + (showWrTe ? 5 : 0) + (showRb ? 5 : 0) + (showQb ? 5 : 0) + (showAll ? 5 : 0))
                    : rzData.length === 0
                      ? emptyRow(10, posLabel)
                      : rzData.map((p, i) => (
                        <tr key={p.playerId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'} hover:bg-[#e2640d]/5 transition-colors`}>
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
                          {showRb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzRecTds)}</td>}
                          {showQb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzPassAttempts)}</td>}
                          {showQb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzPassTds)}</td>}
                          {showQb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgRzTdRate)}</td>}
                          {showQb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzInterceptions)}</td>}
                          {showQb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalRzRushTds)}</td>}
                          <td className="px-3 py-2.5 font-mono font-semibold text-[#e2640d]">{fmtDec(p.totalFptsPpr, 1)}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="down-distance">
          {sitStats && (
            <div className="grid grid-cols-4 gap-4 mb-5">
              {[
                { icon: TrendingUp, label: 'Avg 3rd Down Conv%', val: fmtPct(sitStats.avg3dConv) },
                { icon: BarChart3, label: 'Avg Early Down Succ%', val: fmtPct(sitStats.avgEarlyDown) },
                { icon: Clock, label: 'Avg 2-Min Succ%', val: fmtPct(sitStats.avg2min) },
                { icon: Zap, label: 'Avg Hurry-Up Succ%', val: fmtPct(sitStats.avgHurryUp) },
              ].map(({ icon: Icon, label, val }) => (
                <Card key={label} className="border border-gray-100 bg-[#fafafa]">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="h-3.5 w-3.5 text-[#e2640d]" />
                      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
                    </div>
                    <div className="text-xl font-mono font-semibold text-gray-900">{val}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f4f4f4] border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">#</th>
                    {ddTh('Player', 'playerName', 'min-w-[160px]')}
                    {ddTh('Team', 'teamId')}
                    {showAll && <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pos</th>}
                    {ddTh('GP', 'gamesPlayed')}
                    {ddTh('3D Snaps', 'totalThirdDownSnaps')}
                    {ddTh('3D Conv', 'totalThirdDownConversions')}
                    {ddTh('3D Conv%', 'avgThirdDownConversionRate')}
                    {ddTh('Early Down%', 'avgEarlyDownSuccessRate')}
                    {ddTh('Late Down%', 'avgLateDownSuccessRate')}
                    {showRb && ddTh('SY Att', 'totalShortYardageAttempts')}
                    {showRb && ddTh('SY Conv', 'totalShortYardageConversions')}
                    {showRb && ddTh('SY%', 'avgShortYardageRate')}
                    {showWrTe && ddTh('3D Tgt', 'totalThirdDownTargets')}
                    {showWrTe && ddTh('3D Rec', 'totalThirdDownReceptions')}
                    {showWrTe && ddTh('3D Rec Conv', 'totalThirdDownRecConversions')}
                    {ddTh('FPTS', 'totalFptsPpr')}
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? skeletonRows(10 + (showAll ? 1 : 0) + (showRb || showWrTe ? 3 : 0))
                    : ddData.length === 0
                      ? emptyRow(12, posLabel)
                      : ddData.map((p, i) => (
                        <tr key={p.playerId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'} hover:bg-[#e2640d]/5 transition-colors`}>
                          <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{i + 1}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{p.playerName}</td>
                          <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.teamId ?? '—'}</td>
                          {showAll && <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.position ?? '—'}</td>}
                          <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.gamesPlayed)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalThirdDownSnaps)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalThirdDownConversions)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgThirdDownConversionRate)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgEarlyDownSuccessRate)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgLateDownSuccessRate)}</td>
                          {showRb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalShortYardageAttempts)}</td>}
                          {showRb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalShortYardageConversions)}</td>}
                          {showRb && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgShortYardageRate)}</td>}
                          {showWrTe && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalThirdDownTargets)}</td>}
                          {showWrTe && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalThirdDownReceptions)}</td>}
                          {showWrTe && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalThirdDownRecConversions)}</td>}
                          <td className="px-3 py-2.5 font-mono font-semibold text-[#e2640d]">{p.totalFptsPpr?.toFixed(1) ?? '—'}</td>
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
                    {tmTh('Player', 'playerName', 'min-w-[160px]')}
                    {tmTh('Team', 'teamId')}
                    {showAll && <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pos</th>}
                    {tmTh('GP', 'gamesPlayed')}
                    {tmTh('2-Min Snaps', 'totalTwoMinuteSnaps')}
                    {tmTh('2-Min Successful', 'totalTwoMinuteSuccessful')}
                    {tmTh('2-Min Succ%', 'avgTwoMinuteSuccessRate')}
                    {showWrTe && tmTh('2-Min Tgt', 'totalTwoMinuteTargets')}
                    {showWrTe && tmTh('2-Min Rec', 'totalTwoMinuteReceptions')}
                    {tmTh('FPTS', 'totalFptsPpr')}
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? skeletonRows(8 + (showAll ? 1 : 0) + (showWrTe ? 2 : 0))
                    : tmData.length === 0
                      ? emptyRow(10, posLabel)
                      : tmData.map((p, i) => (
                        <tr key={p.playerId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'} hover:bg-[#e2640d]/5 transition-colors`}>
                          <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{i + 1}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{p.playerName}</td>
                          <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.teamId ?? '—'}</td>
                          {showAll && <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.position ?? '—'}</td>}
                          <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.gamesPlayed)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalTwoMinuteSnaps)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalTwoMinuteSuccessful)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgTwoMinuteSuccessRate)}</td>
                          {showWrTe && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalTwoMinuteTargets)}</td>}
                          {showWrTe && <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalTwoMinuteReceptions)}</td>}
                          <td className="px-3 py-2.5 font-mono font-semibold text-[#e2640d]">{p.totalFptsPpr?.toFixed(1) ?? '—'}</td>
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
                    {huTh('Player', 'playerName', 'min-w-[160px]')}
                    {huTh('Team', 'teamId')}
                    {showAll && <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pos</th>}
                    {huTh('GP', 'gamesPlayed')}
                    {huTh('Hurry-Up Snaps', 'totalHurryUpSnaps')}
                    {huTh('Hurry-Up Successful', 'totalHurryUpSuccessful')}
                    {huTh('Hurry-Up Succ%', 'avgHurryUpSuccessRate')}
                    {huTh('FPTS', 'totalFptsPpr')}
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? skeletonRows(7 + (showAll ? 1 : 0))
                    : huData.length === 0
                      ? emptyRow(9, posLabel)
                      : huData.map((p, i) => (
                        <tr key={p.playerId} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'} hover:bg-[#e2640d]/5 transition-colors`}>
                          <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{i + 1}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{p.playerName}</td>
                          <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.teamId ?? '—'}</td>
                          {showAll && <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.position ?? '—'}</td>}
                          <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.gamesPlayed)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalHurryUpSnaps)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{fmtInt(p.totalHurryUpSuccessful)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{fmtPct(p.avgHurryUpSuccessRate)}</td>
                          <td className="px-3 py-2.5 font-mono font-semibold text-[#e2640d]">{p.totalFptsPpr?.toFixed(1) ?? '—'}</td>
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
