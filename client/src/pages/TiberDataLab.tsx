import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Search, 
  Database, 
  RefreshCw, 
  ChevronRight,
  Target,
  Zap,
  BarChart3,
  Activity,
  X,
  MessageSquare,
  AlertCircle,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SnapshotMeta {
  snapshotId: number;
  season: number;
  week: number;
  snapshotAt: string;
  dataVersion: string;
  rowCount: number;
  teamCount: number;
  validationPassed: boolean;
}

interface PlayerWeekData {
  id: number;
  snapshotId: number;
  season: number;
  week: number;
  playerId: string;
  playerName: string;
  teamId: string | null;
  position: string | null;
  snaps: number | null;
  snapShare: number | null;
  routes: number | null;
  routeRate: number | null;
  targets: number | null;
  targetShare: number | null;
  receptions: number | null;
  recYards: number | null;
  recTds: number | null;
  aDot: number | null;
  airYards: number | null;
  yac: number | null;
  tprr: number | null;
  yprr: number | null;
  epaPerPlay: number | null;
  epaPerTarget: number | null;
  successRate: number | null;
  rushAttempts: number | null;
  rushYards: number | null;
  rushTds: number | null;
  yardsPerCarry: number | null;
  rushEpaPerPlay: number | null;
  fptsStd: number | null;
  fptsHalf: number | null;
  fptsPpr: number | null;
}

interface SearchResponse {
  snapshotId: number;
  season: number;
  week: number;
  total: number;
  limit: number;
  offset: number;
  data: PlayerWeekData[];
}

type PerformanceTag = "RISER" | "FALLER" | "NEUTRAL" | null;

interface AggregatedPlayerData {
  playerId: string;
  playerName: string;
  teamId: string | null;
  position: string | null;
  gamesPlayed: number;
  totalRoutes: number;
  totalTargets: number;
  avgTprr: number | null;
  avgTargetShare: number | null;
  totalReceptions: number;
  totalRecYards: number;
  totalRecTds: number;
  avgAdot: number | null;
  totalAirYards: number;
  totalYac: number;
  avgEpaPerTarget: number | null;
  avgSuccessRate: number | null;
  totalRushAttempts: number;
  totalRushYards: number;
  totalRushTds: number;
  avgRushEpa: number | null;
  yprr: number | null;
  yardsPerCarry: number | null;
  totalFptsStd: number;
  totalFptsHalf: number;
  totalFptsPpr: number;
  fptsStdPerGame: number;
  fptsHalfPerGame: number;
  fptsPprPerGame: number;
  xPprPerGame: number;
  xFPGoePprPerGame: number;
  performanceTag: PerformanceTag;
}

interface AggResponse {
  modeLabel: string;
  season: number;
  weekMode: 'week' | 'season' | 'range';
  weekRange: { from: number; to: number } | null;
  position: string;
  count: number;
  data: AggregatedPlayerData[];
}

interface V2Context {
  rzShare: number;
  yacRatio: number;
  rushEpaContribution: number;
  rushSuccessContribution: number;
}

interface FantasyLogData {
  playerId: string;
  playerName: string;
  teamId: string | null;
  position: string | null;
  season: number;
  week: number;
  targets: number;
  receptions: number;
  recYards: number;
  recTds: number;
  rushAttempts: number;
  rushYards: number;
  rushTds: number;
  fptsStd: number;
  fptsHalf: number;
  fptsPpr: number;
  routes: number;
  tprr: number | null;
  targetShare: number | null;
  adot: number | null;
  airYards: number;
  xPpr: number | null;
  xFpgoePpr: number | null;
  v2Context: V2Context | null;
}

interface FantasyLogResponse {
  mode: 'fantasy';
  season: number;
  week: number | null;
  weekRange: { from: number; to: number } | null;
  position: string;
  count: number;
  data: FantasyLogData[];
}

type ViewMode = 'week' | 'season' | 'range';

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE'];

function formatStat(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined) return '-';
  return value.toFixed(decimals);
}

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return `${(value * 100).toFixed(1)}%`;
}

function StatCard({ label, value, format = 'number', showZeroAsNA = false }: { label: string; value: any; format?: 'number' | 'pct' | 'decimal'; showZeroAsNA?: boolean }) {
  let displayValue: string;
  
  if (value == null || value === undefined) {
    displayValue = '0';
  } else if (showZeroAsNA && value === 0) {
    displayValue = 'N/A';
  } else {
    if (format === 'pct') {
      displayValue = `${(Number(value) * 100).toFixed(1)}%`;
    } else if (format === 'decimal') {
      displayValue = Number(value).toFixed(2);
    } else {
      displayValue = String(value);
    }
  }

  return (
    <div className="bg-[#1a1f2e] p-3 rounded-lg text-center" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="text-gray-500 text-xs uppercase tracking-wide">{label}</div>
      <div className="font-mono text-white text-lg mt-1">{displayValue}</div>
    </div>
  );
}

function PositionBadge({ position }: { position: string | null }) {
  if (!position) return null;
  
  const colors: Record<string, string> = {
    QB: 'bg-purple-600',
    RB: 'bg-green-600',
    WR: 'bg-blue-600',
    TE: 'bg-orange-600',
  };

  return (
    <Badge className={`${colors[position] || 'bg-gray-600'} text-white`} data-testid="position-badge">
      {position}
    </Badge>
  );
}

function PlayerDrawer({ 
  player, 
  open, 
  onClose 
}: { 
  player: PlayerWeekData | null; 
  open: boolean; 
  onClose: () => void;
}) {
  if (!player) return null;

  const handleAskTiber = () => {
    console.log('[DataLab] Ask Tiber to explain profile:', {
      playerId: player.playerId,
      playerName: player.playerName,
      position: player.position,
      metrics: {
        routes: player.routes,
        targets: player.targets,
        tprr: player.tprr,
        yprr: player.yprr,
        epaPerPlay: player.epaPerPlay,
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px] bg-[#0a0e1a] border-gray-700 overflow-y-auto" data-testid="player-drawer">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <PositionBadge position={player.position} />
            <SheetTitle className="text-white text-xl" data-testid="drawer-player-name">{player.playerName}</SheetTitle>
          </div>
          <SheetDescription className="text-gray-400">
            {player.teamId || 'N/A'} • Week {player.week} • {player.season}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-gray-400 uppercase tracking-wide">Usage</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatCard label="Snaps" value={player.snaps} />
              <StatCard label="Snap %" value={player.snapShare} format="pct" />
              <StatCard label="Routes" value={player.routes} />
              <StatCard label="Route %" value={player.routeRate} format="pct" />
            </div>
          </div>

          <Separator className="bg-gray-700" />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-gray-400 uppercase tracking-wide">Receiving</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatCard label="Targets" value={player.targets} />
              <StatCard label="Rec" value={player.receptions} />
              <StatCard label="Yards" value={player.recYards} />
              <StatCard label="TDs" value={player.recTds} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <StatCard label="aDOT" value={player.aDot} format="decimal" />
              <StatCard label="Air Yds" value={player.airYards} />
              <StatCard label="YAC" value={player.yac} />
            </div>
          </div>

          <Separator className="bg-gray-700" />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-gray-400 uppercase tracking-wide">Efficiency</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatCard label="TPRR" value={player.tprr} format="decimal" />
              <StatCard label="YPRR" value={player.yprr} format="decimal" />
              <StatCard label="EPA/Play" value={player.epaPerPlay} format="decimal" />
              <StatCard label="Success %" value={player.successRate} format="pct" />
            </div>
          </div>

          {(player.rushAttempts || 0) > 0 && (
            <>
              <Separator className="bg-gray-700" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-gray-400 uppercase tracking-wide">Rushing</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <StatCard label="Carries" value={player.rushAttempts} />
                  <StatCard label="Yards" value={player.rushYards} />
                  <StatCard label="TDs" value={player.rushTds} />
                  <StatCard label="YPC" value={player.yardsPerCarry} format="decimal" />
                </div>
              </div>
            </>
          )}

          <Separator className="bg-gray-700" />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              <span className="text-sm text-gray-400 uppercase tracking-wide">Fantasy Points (Week {player.week})</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Week PPR" value={player.fptsPpr} format="decimal" />
              <StatCard label="Week Half" value={player.fptsHalf} format="decimal" />
              <StatCard label="Week Std" value={player.fptsStd} format="decimal" />
            </div>
          </div>

          <div className="pt-4">
            <Button 
              variant="outline" 
              className="w-full border-blue-600 text-blue-400 hover:bg-blue-600/20"
              onClick={handleAskTiber}
              data-testid="button-ask-tiber"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Ask Tiber to explain this profile
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface XFptsPlayerData {
  season: number;
  week: number;
  playerId: string;
  position: string | null;
  actualPpr: number;
  xPprV1: number;
  xfpgoePprV1: number;
  xPprV2: number;
  xfpgoePprV2: number;
  recMultiplier: number;
  rushMultiplier: number;
  v2Context: V2Context;
}

interface XFptsPlayerResponse {
  playerId: string;
  season: number;
  weekRange: { from: number; to: number } | null;
  count: number;
  data: XFptsPlayerData[];
}

function FantasyPlayerDrawer({ 
  player, 
  open, 
  onClose,
  season: currentSeason
}: { 
  player: FantasyLogData | null; 
  open: boolean; 
  onClose: () => void;
  season: number | undefined;
}) {
  const { data: xfptsData, isLoading, isError } = useQuery<XFptsPlayerResponse>({
    queryKey: ['/api/data-lab/xfpts/player', player?.playerId, currentSeason],
    queryFn: async () => {
      const res = await fetch(`/api/data-lab/xfpts/player?player_id=${player?.playerId}&season=${currentSeason}`);
      if (!res.ok) throw new Error('Failed to load xFPTS data');
      return res.json();
    },
    enabled: open && !!player && !!currentSeason,
  });

  if (!player) return null;

  const weeklyData = xfptsData?.data || [];
  const hasXfptsData = weeklyData.length > 0;
  
  const seasonSummary = hasXfptsData ? {
    totalPpr: weeklyData.reduce((sum, w) => sum + w.actualPpr, 0),
    totalXPpr: weeklyData.reduce((sum, w) => sum + w.xPprV2, 0),
    gamesPlayed: weeklyData.length,
  } : null;

  const pprPerGame = seasonSummary ? Math.round((seasonSummary.totalPpr / seasonSummary.gamesPlayed) * 10) / 10 : null;
  const xPprPerGame = seasonSummary ? Math.round((seasonSummary.totalXPpr / seasonSummary.gamesPlayed) * 10) / 10 : null;
  const deltaPprPerGame = pprPerGame !== null && xPprPerGame !== null 
    ? Math.round((pprPerGame - xPprPerGame) * 10) / 10 
    : null;

  const recentWeeks = weeklyData.slice(-5).reverse();
  const latestContext = weeklyData.length > 0 ? weeklyData[weeklyData.length - 1].v2Context : null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px] bg-[#0a0e1a] border-gray-700 overflow-y-auto" data-testid="fantasy-player-drawer">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <PositionBadge position={player.position} />
            <SheetTitle className="text-white text-xl" data-testid="drawer-fantasy-player-name">{player.playerName}</SheetTitle>
          </div>
          <SheetDescription className="text-gray-400">
            {player.teamId || 'N/A'} • Week {player.week} • {player.season}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-gray-400 uppercase tracking-wide">Expected vs Actual (PPR – v2)</span>
            </div>
            
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full bg-gray-700" />
                <Skeleton className="h-24 w-full bg-gray-700" />
              </div>
            ) : isError || !hasXfptsData ? (
              <div className="bg-[#1a1f2e] p-4 rounded-lg text-center text-gray-500">
                Expected points data unavailable
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-[#1a1f2e] p-3 rounded-lg text-center">
                    <div className="text-gray-500 text-xs uppercase tracking-wide">Actual PPR/G</div>
                    <div className="font-mono text-purple-400 text-lg font-bold mt-1" data-testid="stat-actual-ppr">{pprPerGame}</div>
                  </div>
                  <div className="bg-[#1a1f2e] p-3 rounded-lg text-center">
                    <div className="text-gray-500 text-xs uppercase tracking-wide">Expected PPR/G</div>
                    <div className="font-mono text-gray-400 text-lg mt-1" data-testid="stat-expected-ppr">{xPprPerGame}</div>
                  </div>
                  <div className="bg-[#1a1f2e] p-3 rounded-lg text-center">
                    <div className="text-gray-500 text-xs uppercase tracking-wide">Δ PPR/G</div>
                    <div className={`font-mono text-lg font-bold mt-1 ${
                      deltaPprPerGame !== null && deltaPprPerGame > 0 ? 'text-green-400' : 
                      deltaPprPerGame !== null && deltaPprPerGame < 0 ? 'text-red-400' : 'text-gray-400'
                    }`} data-testid="stat-delta-ppr">
                      {deltaPprPerGame !== null ? `${deltaPprPerGame > 0 ? '+' : ''}${deltaPprPerGame}` : '-'}
                    </div>
                  </div>
                </div>

                {recentWeeks.length > 0 && (
                  <div className="bg-[#1a1f2e] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="text-gray-500 text-xs uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Week</th>
                          <th className="px-3 py-2 text-center">PPR</th>
                          <th className="px-3 py-2 text-center">xPPR</th>
                          <th className="px-3 py-2 text-center">Δ PPR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {recentWeeks.map((w) => (
                          <tr key={w.week}>
                            <td className="px-3 py-2 text-gray-400">{w.week}</td>
                            <td className="px-3 py-2 text-center font-mono text-white">{w.actualPpr.toFixed(1)}</td>
                            <td className="px-3 py-2 text-center font-mono text-gray-400">{w.xPprV2.toFixed(1)}</td>
                            <td className={`px-3 py-2 text-center font-mono font-semibold ${
                              w.xfpgoePprV2 > 0 ? 'text-green-400' : 
                              w.xfpgoePprV2 < 0 ? 'text-red-400' : 'text-gray-400'
                            }`}>
                              {w.xfpgoePprV2 > 0 ? '+' : ''}{w.xfpgoePprV2.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          {latestContext && (
            <>
              <Separator className="bg-gray-700" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-gray-400 uppercase tracking-wide">v2 Context (Usage Quality)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#1a1f2e] p-3 rounded-lg">
                    <div className="text-gray-500 text-xs uppercase tracking-wide">RZ Share</div>
                    <div className="font-mono text-white text-lg mt-1" data-testid="stat-rz-share">{latestContext.rzShare.toFixed(2)}</div>
                  </div>
                  <div className="bg-[#1a1f2e] p-3 rounded-lg">
                    <div className="text-gray-500 text-xs uppercase tracking-wide">YAC Ratio</div>
                    <div className="font-mono text-white text-lg mt-1" data-testid="stat-yac-ratio">{latestContext.yacRatio.toFixed(2)}</div>
                  </div>
                  <div className="bg-[#1a1f2e] p-3 rounded-lg">
                    <div className="text-gray-500 text-xs uppercase tracking-wide">Rush EPA Adj</div>
                    <div className={`font-mono text-lg mt-1 ${
                      latestContext.rushEpaContribution > 0 ? 'text-green-400' : 
                      latestContext.rushEpaContribution < 0 ? 'text-red-400' : 'text-white'
                    }`} data-testid="stat-rush-epa">
                      {latestContext.rushEpaContribution > 0 ? '+' : ''}{latestContext.rushEpaContribution.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-[#1a1f2e] p-3 rounded-lg">
                    <div className="text-gray-500 text-xs uppercase tracking-wide">Success Adj</div>
                    <div className={`font-mono text-lg mt-1 ${
                      latestContext.rushSuccessContribution > 0 ? 'text-green-400' : 
                      latestContext.rushSuccessContribution < 0 ? 'text-red-400' : 'text-white'
                    }`} data-testid="stat-success-adj">
                      {latestContext.rushSuccessContribution > 0 ? '+' : ''}{latestContext.rushSuccessContribution.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator className="bg-gray-700" />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              <span className="text-sm text-gray-400 uppercase tracking-wide">This Week ({player.week})</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="PPR" value={player.fptsPpr} format="decimal" />
              <StatCard label="xPPR" value={player.xPpr} format="decimal" />
              <div className="bg-[#1a1f2e] p-3 rounded-lg text-center">
                <div className="text-gray-500 text-xs uppercase tracking-wide">Δ PPR</div>
                <div className={`font-mono text-lg mt-1 ${
                  player.xFpgoePpr != null && player.xFpgoePpr > 0 ? 'text-green-400' : 
                  player.xFpgoePpr != null && player.xFpgoePpr < 0 ? 'text-red-400' : 'text-white'
                }`}>
                  {player.xFpgoePpr != null ? `${player.xFpgoePpr > 0 ? '+' : ''}${player.xFpgoePpr.toFixed(1)}` : '-'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2">
              <StatCard label="Tgt" value={player.targets} />
              <StatCard label="Rec" value={player.receptions} />
              <StatCard label="Yds" value={player.recYards} />
              <StatCard label="TDs" value={player.recTds} />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function TiberDataLab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [position, setPosition] = useState('ALL');
  const [season, setSeason] = useState<number | undefined>(undefined);
  const [week, setWeek] = useState<number | undefined>(undefined);
  const [weekFrom, setWeekFrom] = useState<number | undefined>(undefined);
  const [weekTo, setWeekTo] = useState<number | undefined>(undefined);
  const [minRoutes, setMinRoutes] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWeekData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [fantasyMode, setFantasyMode] = useState(false);
  const [performanceFilter, setPerformanceFilter] = useState<'ALL' | 'RISER' | 'FALLER' | 'NEUTRAL'>('ALL');
  const [selectedFantasyPlayer, setSelectedFantasyPlayer] = useState<FantasyLogData | null>(null);
  const [fantasyDrawerOpen, setFantasyDrawerOpen] = useState(false);

  const { data: metaData, isLoading: metaLoading, isError: metaError } = useQuery<SnapshotMeta>({
    queryKey: ['/api/data-lab/meta/current'],
  });

  useEffect(() => {
    if (metaData && metaData.season && metaData.week) {
      setSeason(metaData.season);
      setWeek(metaData.week);
      setWeekTo(metaData.week);
      setWeekFrom(1);
    }
  }, [metaData]);
  
  const searchReady = !metaError && season != null && season > 0 && (
    viewMode === 'season' || 
    (viewMode === 'week' && week != null && week > 0) ||
    (viewMode === 'range' && weekFrom != null && weekTo != null && weekFrom > 0 && weekTo > 0)
  );

  const buildSearchParams = () => {
    const params = new URLSearchParams({
      season: String(season ?? ''),
      ...(position !== 'ALL' && { position }),
      limit: '50',
    });
    
    if (viewMode === 'week') {
      params.set('week', String(week ?? ''));
    } else if (viewMode === 'range') {
      params.set('weekFrom', String(weekFrom ?? ''));
      params.set('weekTo', String(weekTo ?? ''));
    }
    
    if (searchQuery) params.set('q', searchQuery);
    if (minRoutes) params.set('min_routes', minRoutes);
    
    return params;
  };

  const buildAggParams = () => {
    const params = new URLSearchParams({
      season: String(season ?? ''),
      weekMode: viewMode,
      ...(position !== 'ALL' && { position }),
      limit: '50',
    });
    
    if (viewMode === 'week') {
      params.set('week', String(week ?? ''));
    } else if (viewMode === 'range') {
      params.set('weekFrom', String(weekFrom ?? ''));
      params.set('weekTo', String(weekTo ?? ''));
    }
    
    if (performanceFilter !== 'ALL' && (viewMode === 'season' || viewMode === 'range')) {
      params.set('performanceFilter', performanceFilter);
    }
    
    return params;
  };

  const buildFantasyParams = () => {
    const params = new URLSearchParams({
      season: String(season ?? ''),
      ...(position !== 'ALL' && { position }),
      limit: '50',
    });
    
    if (viewMode === 'week') {
      params.set('week', String(week ?? ''));
    } else if (viewMode === 'range') {
      params.set('weekFrom', String(weekFrom ?? ''));
      params.set('weekTo', String(weekTo ?? ''));
    }
    
    return params;
  };

  const { 
    data: searchData, 
    isLoading: searchLoading, 
    refetch: refetchSearch 
  } = useQuery<SearchResponse>({
    queryKey: ['/api/data-lab/search', season, week, searchQuery, position, minRoutes, viewMode],
    queryFn: async () => {
      const res = await fetch(`/api/data-lab/search?${buildSearchParams().toString()}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Search failed');
      }
      return res.json();
    },
    enabled: searchReady && !fantasyMode && viewMode === 'week',
  });

  const {
    data: aggData,
    isLoading: aggLoading,
    refetch: refetchAgg
  } = useQuery<AggResponse>({
    queryKey: ['/api/data-lab/usage-agg', season, week, weekFrom, weekTo, position, viewMode, performanceFilter],
    queryFn: async () => {
      const res = await fetch(`/api/data-lab/usage-agg?${buildAggParams().toString()}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Aggregation failed');
      }
      return res.json();
    },
    enabled: searchReady && !fantasyMode && viewMode !== 'week',
  });

  const {
    data: fantasyData,
    isLoading: fantasyLoading,
    refetch: refetchFantasy
  } = useQuery<FantasyLogResponse>({
    queryKey: ['/api/data-lab/fantasy-logs', season, week, weekFrom, weekTo, position, viewMode],
    queryFn: async () => {
      const res = await fetch(`/api/data-lab/fantasy-logs?${buildFantasyParams().toString()}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Fantasy logs failed');
      }
      return res.json();
    },
    enabled: searchReady && fantasyMode,
  });

  const isLoading = searchLoading || aggLoading || fantasyLoading;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (fantasyMode) {
      refetchFantasy();
    } else if (viewMode === 'week') {
      refetchSearch();
    } else {
      refetchAgg();
    }
  };

  const handlePlayerClick = (player: PlayerWeekData) => {
    setSelectedPlayer(player);
    setDrawerOpen(true);
  };

  const handleFantasyPlayerClick = (player: FantasyLogData) => {
    setSelectedFantasyPlayer(player);
    setFantasyDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/forge-hub">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
              <Database className="h-6 w-6 text-blue-400" />
              Tiber Data Lab
            </h1>
            <p className="text-gray-400 text-sm">Snapshot-based NFL data spine for analytics</p>
          </div>
        </div>

        {metaLoading ? (
          <Card className="bg-[#141824] border-gray-700 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-32 bg-gray-700" />
                <Skeleton className="h-5 w-24 bg-gray-700" />
                <Skeleton className="h-5 w-20 bg-gray-700" />
              </div>
            </CardContent>
          </Card>
        ) : metaData ? (
          <Card className="bg-[#141824] border-gray-700 mb-6" data-testid="card-snapshot-meta">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="border-green-600 text-green-400">
                    Snapshot #{metaData.snapshotId}
                  </Badge>
                  <span className="text-gray-400">
                    {metaData.season} Week {metaData.week}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {metaData.rowCount} players • {metaData.teamCount} teams
                  </span>
                </div>
                <span className="text-gray-500 text-sm">
                  {new Date(metaData.snapshotAt).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        ) : metaError ? (
          <Card className="bg-[#141824] border-red-700 mb-6" data-testid="card-snapshot-error">
            <CardContent className="p-4">
              <div className="text-red-400 text-center flex items-center justify-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Failed to load snapshot data. Search is disabled until snapshot is available.
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-[#141824] border-gray-700 mb-6">
            <CardContent className="p-4">
              <div className="text-yellow-400 text-center">
                No snapshot available. Run a snapshot first using the admin endpoint.
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-[#141824] border-gray-700 mb-6" data-testid="card-search-filters">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-400" />
                Search Players
              </CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="fantasy-mode"
                    checked={fantasyMode}
                    onCheckedChange={setFantasyMode}
                    data-testid="switch-fantasy-mode"
                  />
                  <Label htmlFor="fantasy-mode" className="text-sm text-gray-400 flex items-center gap-1 cursor-pointer">
                    <TrendingUp className="h-4 w-4" />
                    Fantasy Mode
                  </Label>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-auto">
                <TabsList className="bg-[#0a0e1a] border border-gray-700">
                  <TabsTrigger 
                    value="week" 
                    className="data-[state=active]:bg-blue-600 text-gray-400 data-[state=active]:text-white"
                    data-testid="tab-view-week"
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Single Week
                  </TabsTrigger>
                  <TabsTrigger 
                    value="season" 
                    className="data-[state=active]:bg-blue-600 text-gray-400 data-[state=active]:text-white"
                    data-testid="tab-view-season"
                  >
                    Season Total
                  </TabsTrigger>
                  <TabsTrigger 
                    value="range" 
                    className="data-[state=active]:bg-blue-600 text-gray-400 data-[state=active]:text-white"
                    data-testid="tab-view-range"
                  >
                    Week Range
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {fantasyMode && (
                <Badge className="bg-purple-600/30 text-purple-300 border-purple-600">
                  Fantasy Points Focus
                </Badge>
              )}
            </div>

            <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-4">
              {!fantasyMode && viewMode === 'week' && (
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-gray-400 text-sm">Player Name</Label>
                  <Input
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-[#0a0e1a] border-gray-600 text-white"
                    data-testid="input-search"
                  />
                </div>
              )}

              <div className="w-32">
                <Label className="text-gray-400 text-sm">Position</Label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger className="bg-[#0a0e1a] border-gray-600 text-white" data-testid="select-position">
                    <SelectValue placeholder="Position" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141824] border-gray-600">
                    {POSITIONS.map((pos) => (
                      <SelectItem key={pos} value={pos} className="text-white hover:bg-gray-700">
                        {pos}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(viewMode === 'season' || viewMode === 'range') && !fantasyMode && (
                <div className="w-32">
                  <Label className="text-gray-400 text-sm">Performance</Label>
                  <Select value={performanceFilter} onValueChange={(v) => setPerformanceFilter(v as any)}>
                    <SelectTrigger className="bg-[#0a0e1a] border-gray-600 text-white" data-testid="select-performance">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#141824] border-gray-600">
                      <SelectItem value="ALL" className="text-white hover:bg-gray-700">All</SelectItem>
                      <SelectItem value="RISER" className="text-green-400 hover:bg-gray-700">Risers</SelectItem>
                      <SelectItem value="FALLER" className="text-red-400 hover:bg-gray-700">Fallers</SelectItem>
                      <SelectItem value="NEUTRAL" className="text-gray-400 hover:bg-gray-700">Neutral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="w-24">
                <Label className="text-gray-400 text-sm">Season</Label>
                <Input
                  type="number"
                  value={season ?? ''}
                  onChange={(e) => setSeason(e.target.value ? Number(e.target.value) : undefined)}
                  className="bg-[#0a0e1a] border-gray-600 text-white"
                  placeholder="..."
                  data-testid="input-season"
                />
              </div>

              {viewMode === 'week' && (
                <div className="w-24">
                  <Label className="text-gray-400 text-sm">Week</Label>
                  <Input
                    type="number"
                    value={week ?? ''}
                    onChange={(e) => setWeek(e.target.value ? Number(e.target.value) : undefined)}
                    className="bg-[#0a0e1a] border-gray-600 text-white"
                    placeholder="..."
                    min={1}
                    max={18}
                    data-testid="input-week"
                  />
                </div>
              )}

              {viewMode === 'range' && (
                <>
                  <div className="w-24">
                    <Label className="text-gray-400 text-sm">From Week</Label>
                    <Input
                      type="number"
                      value={weekFrom ?? ''}
                      onChange={(e) => setWeekFrom(e.target.value ? Number(e.target.value) : undefined)}
                      className="bg-[#0a0e1a] border-gray-600 text-white"
                      placeholder="1"
                      min={1}
                      max={18}
                      data-testid="input-week-from"
                    />
                  </div>
                  <div className="w-24">
                    <Label className="text-gray-400 text-sm">To Week</Label>
                    <Input
                      type="number"
                      value={weekTo ?? ''}
                      onChange={(e) => setWeekTo(e.target.value ? Number(e.target.value) : undefined)}
                      className="bg-[#0a0e1a] border-gray-600 text-white"
                      placeholder="..."
                      min={1}
                      max={18}
                      data-testid="input-week-to"
                    />
                  </div>
                </>
              )}

              {!fantasyMode && viewMode === 'week' && (
                <div className="w-28">
                  <Label className="text-gray-400 text-sm">Min Routes</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={minRoutes}
                    onChange={(e) => setMinRoutes(e.target.value)}
                    className="bg-[#0a0e1a] border-gray-600 text-white"
                    data-testid="input-min-routes"
                  />
                </div>
              )}

              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={isLoading || !searchReady}
                data-testid="button-search"
              >
                <Search className="h-4 w-4 mr-2" />
                {isLoading ? 'Loading...' : 'Search'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-[#141824] border-gray-700" data-testid="card-results">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                Results
                {fantasyMode && <Badge className="bg-purple-600/50 text-purple-200">Fantasy</Badge>}
                {viewMode === 'season' && <Badge className="bg-green-600/50 text-green-200">Season</Badge>}
                {viewMode === 'range' && <Badge className="bg-orange-600/50 text-orange-200">Range</Badge>}
              </CardTitle>
              <span className="text-gray-400 text-sm">
                {fantasyMode 
                  ? `${fantasyData?.count ?? 0} records` 
                  : viewMode === 'week' 
                    ? `${searchData?.total ?? 0} players` 
                    : `${aggData?.count ?? 0} players`
                }
              </span>
            </div>
            {aggData?.modeLabel && !fantasyMode && viewMode !== 'week' && (
              <CardDescription className="text-gray-500">
                {aggData.modeLabel}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-gray-700" />
                ))}
              </div>
            ) : fantasyMode ? (
              fantasyData?.data.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No fantasy data found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-fantasy">
                    <thead className="bg-[#0a0e1a] text-gray-400 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 text-left">Player</th>
                        <th className="px-4 py-3 text-center">Team</th>
                        <th className="px-4 py-3 text-center">Pos</th>
                        <th className="px-4 py-3 text-center">Week</th>
                        <th className="px-4 py-3 text-center">PPR</th>
                        <th className="px-4 py-3 text-center">xPPR</th>
                        <th className="px-4 py-3 text-center">Δ PPR</th>
                        <th className="px-4 py-3 text-center">Tgt</th>
                        <th className="px-4 py-3 text-center">Rec</th>
                        <th className="px-4 py-3 text-center">RecYds</th>
                        <th className="px-4 py-3 text-center">RecTD</th>
                        <th className="px-4 py-3 text-center">Rush</th>
                        <th className="px-4 py-3 text-center">RshYds</th>
                        <th className="px-4 py-3 text-center">RshTD</th>
                        <th className="px-4 py-3 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {fantasyData?.data.map((row, idx) => (
                        <tr 
                          key={`${row.playerId}-${row.week}-${idx}`} 
                          className="hover:bg-[#1a1f2e] cursor-pointer transition-colors"
                          onClick={() => handleFantasyPlayerClick(row)}
                          data-testid={`row-fantasy-${row.playerId}-${row.week}`}
                        >
                          <td className="px-4 py-3 font-medium text-white">{row.playerName}</td>
                          <td className="px-4 py-3 text-center text-gray-400">{row.teamId || '-'}</td>
                          <td className="px-4 py-3 text-center"><PositionBadge position={row.position} /></td>
                          <td className="px-4 py-3 text-center font-mono text-gray-300">{row.week}</td>
                          <td className="px-4 py-3 text-center font-mono text-purple-400 font-semibold">{formatStat(row.fptsPpr, 1)}</td>
                          <td className="px-4 py-3 text-center font-mono text-gray-400">{row.xPpr != null ? formatStat(row.xPpr, 1) : '-'}</td>
                          <td className={`px-4 py-3 text-center font-mono font-semibold ${
                            row.xFpgoePpr != null && row.xFpgoePpr > 0 ? 'text-green-400' : 
                            row.xFpgoePpr != null && row.xFpgoePpr < 0 ? 'text-red-400' : 'text-gray-400'
                          }`} data-testid={`xfpgoe-${row.playerId}-${row.week}`}>
                            {row.xFpgoePpr != null ? `${row.xFpgoePpr > 0 ? '+' : ''}${formatStat(row.xFpgoePpr, 1)}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-gray-300">{row.targets}</td>
                          <td className="px-4 py-3 text-center font-mono text-gray-300">{row.receptions}</td>
                          <td className="px-4 py-3 text-center font-mono text-gray-300">{row.recYards}</td>
                          <td className="px-4 py-3 text-center font-mono text-green-400">{row.recTds || 0}</td>
                          <td className="px-4 py-3 text-center font-mono text-gray-300">{row.rushAttempts}</td>
                          <td className="px-4 py-3 text-center font-mono text-gray-300">{row.rushYards}</td>
                          <td className="px-4 py-3 text-center font-mono text-orange-400">{row.rushTds || 0}</td>
                          <td className="px-4 py-3 text-center">
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : viewMode !== 'week' ? (
              aggData?.data.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No aggregated data found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-aggregated">
                    <thead className="bg-[#0a0e1a] text-gray-400 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 text-left">Player</th>
                        <th className="px-4 py-3 text-center">Team</th>
                        <th className="px-4 py-3 text-center">Pos</th>
                        <th className="px-4 py-3 text-center">GP</th>
                        <th className="px-4 py-3 text-center">Tgt</th>
                        <th className="px-4 py-3 text-center">TPRR</th>
                        <th className="px-4 py-3 text-center">Rec</th>
                        <th className="px-4 py-3 text-center">Yds</th>
                        <th className="px-4 py-3 text-center">TDs</th>
                        <th className="px-4 py-3 text-center">YPRR</th>
                        <th className="px-4 py-3 text-center">aDOT</th>
                        <th className="px-4 py-3 text-center">EPA/Tgt</th>
                        <th className="px-4 py-3 text-center">PPR/G</th>
                        <th className="px-4 py-3 text-center">xPPR/G</th>
                        <th className="px-4 py-3 text-center">xFPGoe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {aggData?.data.map((player) => (
                        <tr 
                          key={player.playerId} 
                          className="hover:bg-[#1a1f2e] transition-colors"
                          data-testid={`row-agg-${player.playerId}`}
                        >
                          <td className="px-4 py-3 font-medium text-white">
                            <div className="flex items-center gap-2">
                              {player.playerName}
                              {player.performanceTag === 'RISER' && <Badge className="bg-green-600/20 text-green-400 text-[10px] px-1.5" data-testid={`tag-${player.playerId}`}>↑</Badge>}
                              {player.performanceTag === 'FALLER' && <Badge className="bg-red-600/20 text-red-400 text-[10px] px-1.5" data-testid={`tag-${player.playerId}`}>↓</Badge>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-400">{player.teamId || '-'}</td>
                          <td className="px-4 py-3 text-center"><PositionBadge position={player.position} /></td>
                          <td className="px-4 py-3 text-center font-mono text-gray-300">{player.gamesPlayed}</td>
                          <td className="px-4 py-3 text-center font-mono text-gray-300">{player.totalTargets}</td>
                          <td className="px-4 py-3 text-center font-mono text-blue-400">{formatStat(player.avgTprr, 2)}</td>
                          <td className="px-4 py-3 text-center font-mono text-gray-300">{player.totalReceptions}</td>
                          <td className="px-4 py-3 text-center font-mono text-gray-300">{player.totalRecYards}</td>
                          <td className="px-4 py-3 text-center font-mono text-green-400">{player.totalRecTds}</td>
                          <td className="px-4 py-3 text-center font-mono text-green-400">{formatStat(player.yprr, 2)}</td>
                          <td className="px-4 py-3 text-center font-mono text-gray-300">{formatStat(player.avgAdot, 1)}</td>
                          <td className="px-4 py-3 text-center font-mono text-yellow-400">{formatStat(player.avgEpaPerTarget, 2)}</td>
                          <td className="px-4 py-3 text-center font-mono text-purple-400 font-semibold">{formatStat(player.fptsPprPerGame, 1)}</td>
                          <td className="px-4 py-3 text-center font-mono text-gray-400">{formatStat(player.xPprPerGame, 1)}</td>
                          <td className={`px-4 py-3 text-center font-mono font-semibold ${
                            player.xFPGoePprPerGame > 0 ? 'text-green-400' : 
                            player.xFPGoePprPerGame < 0 ? 'text-red-400' : 'text-gray-400'
                          }`} data-testid={`xfpgoe-${player.playerId}`}>
                            {player.xFPGoePprPerGame > 0 ? '+' : ''}{formatStat(player.xFPGoePprPerGame, 1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : searchData?.data.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No players found matching your criteria
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-results">
                  <thead className="bg-[#0a0e1a] text-gray-400 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 text-left">Player</th>
                      <th className="px-4 py-3 text-center">Team</th>
                      <th className="px-4 py-3 text-center">Pos</th>
                      <th className="px-4 py-3 text-center">Routes</th>
                      <th className="px-4 py-3 text-center">Tgt</th>
                      <th className="px-4 py-3 text-center">TPRR</th>
                      <th className="px-4 py-3 text-center">Rec</th>
                      <th className="px-4 py-3 text-center">Yds</th>
                      <th className="px-4 py-3 text-center">YPRR</th>
                      <th className="px-4 py-3 text-center">aDOT</th>
                      <th className="px-4 py-3 text-center">EPA/P</th>
                      <th className="px-4 py-3 text-center">Succ%</th>
                      <th className="px-4 py-3 text-center">Snaps</th>
                      <th className="px-4 py-3 text-center">Snap%</th>
                      <th className="px-4 py-3 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {searchData?.data.map((player) => (
                      <tr 
                        key={player.id} 
                        className="hover:bg-[#1a1f2e] cursor-pointer transition-colors"
                        onClick={() => handlePlayerClick(player)}
                        data-testid={`row-player-${player.playerId}`}
                      >
                        <td className="px-4 py-3 font-medium text-white" data-testid={`text-name-${player.playerId}`}>
                          {player.playerName}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-400">
                          {player.teamId || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <PositionBadge position={player.position} />
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {player.routes ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {player.targets ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-blue-400">
                          {formatStat(player.tprr, 2)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {player.receptions ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {player.recYards ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-green-400">
                          {formatStat(player.yprr, 2)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {formatStat(player.aDot, 1)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-yellow-400">
                          {formatStat(player.epaPerPlay, 2)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {formatPct(player.successRate)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {player.snaps ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {formatPct(player.snapShare)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PlayerDrawer
        player={selectedPlayer}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <FantasyPlayerDrawer
        player={selectedFantasyPlayer}
        open={fantasyDrawerOpen}
        onClose={() => setFantasyDrawerOpen(false)}
        season={season}
      />
    </div>
  );
}
