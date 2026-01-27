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
  availableWeeks: number[];
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
  // Usage
  snaps: number | null;
  snapShare: number | null;
  routes: number | null;
  routeRate: number | null;
  // Receiving
  targets: number | null;
  targetShare: number | null;
  receptions: number | null;
  recYards: number | null;
  recTds: number | null;
  aDot: number | null;
  airYards: number | null;
  yac: number | null;
  // Advanced efficiency
  tprr: number | null;
  yprr: number | null;
  epaPerPlay: number | null;
  epaPerTarget: number | null;
  successRate: number | null;
  // xYAC metrics
  xYac: number | null;
  yacOverExpected: number | null;
  xYacSuccessRate: number | null;
  // Rushing
  rushAttempts: number | null;
  rushYards: number | null;
  rushTds: number | null;
  yardsPerCarry: number | null;
  rushEpaPerPlay: number | null;
  // RB Rushing efficiency
  stuffed: number | null;
  stuffRate: number | null;
  rushFirstDowns: number | null;
  rushFirstDownRate: number | null;
  // RB Run Gap Distribution
  insideRunRate: number | null;
  outsideRunRate: number | null;
  insideSuccessRate: number | null;
  outsideSuccessRate: number | null;
  // RB Run Location Distribution
  leftRunRate: number | null;
  middleRunRate: number | null;
  rightRunRate: number | null;
  // RB Receiving efficiency
  yacPerRec: number | null;
  recFirstDowns: number | null;
  firstDownsPerRoute: number | null;
  fptsPerRoute: number | null;
  // WR/TE Efficiency
  catchRate: number | null;
  yardsPerTarget: number | null;
  racr: number | null;
  wopr: number | null;
  slotRate: number | null;
  inlineRate: number | null;
  avgAirEpa: number | null;
  avgCompAirEpa: number | null;
  // WR/TE Target Depth Distribution
  deepTargetRate: number | null;
  intermediateTargetRate: number | null;
  shortTargetRate: number | null;
  // WR/TE Target Location Distribution
  leftTargetRate: number | null;
  middleTargetRate: number | null;
  rightTargetRate: number | null;
  // QB Efficiency
  cpoe: number | null;
  sacks: number | null;
  sackRate: number | null;
  sackYards: number | null;
  qbHits: number | null;
  qbHitRate: number | null;
  scrambles: number | null;
  scrambleYards: number | null;
  scrambleTds: number | null;
  passFirstDowns: number | null;
  passFirstDownRate: number | null;
  deepPassAttempts: number | null;
  deepPassRate: number | null;
  passAdot: number | null;
  shotgunRate: number | null;
  noHuddleRate: number | null;
  shotgunSuccessRate: number | null;
  underCenterSuccessRate: number | null;
  // QB Advanced Metrics (Data Lab v2)
  dropbacks: number | null;
  anyA: number | null;
  fpPerDropback: number | null;
  // Fantasy points
  fptsStd: number | null;
  fptsHalf: number | null;
  fptsPpr: number | null;
  // Phase 2A: Red Zone metrics
  rzSnaps: number | null;
  rzSnapRate: number | null;
  rzTargets: number | null;
  rzReceptions: number | null;
  rzRecTds: number | null;
  rzSuccessRate: number | null;
  rzTargetShare: number | null;
  rzCatchRate: number | null;
  rzRushAttempts: number | null;
  rzRushTds: number | null;
  rzRushTdRate: number | null;
  rzPassAttempts: number | null;
  rzPassTds: number | null;
  rzTdRate: number | null;
  rzInterceptions: number | null;
  // Phase 2A: 3rd Down metrics
  thirdDownSnaps: number | null;
  thirdDownConversions: number | null;
  thirdDownConversionRate: number | null;
  earlyDownSuccessRate: number | null;
  lateDownSuccessRate: number | null;
  shortYardageAttempts: number | null;
  shortYardageConversions: number | null;
  shortYardageRate: number | null;
  thirdDownTargets: number | null;
  thirdDownReceptions: number | null;
  thirdDownRecConversions: number | null;
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
    // TODO: Integrate with Tiber AI chat when available
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

          {/* xYAC Section - WR/TE/RB with receptions */}
          {player.xYac !== null && (player.receptions || 0) > 0 && (
            <>
              <Separator className="bg-gray-700" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-teal-400" />
                  <span className="text-sm text-gray-400 uppercase tracking-wide">Expected YAC</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="xYAC" value={player.xYac} format="decimal" />
                  <StatCard label="YAC vs Exp" value={player.yacOverExpected} format="decimal" />
                  <StatCard label="xYAC Beat%" value={player.xYacSuccessRate} format="pct" />
                </div>
              </div>
            </>
          )}

          {/* WR/TE Target Profile */}
          {(player.position === 'WR' || player.position === 'TE') && (player.targets || 0) > 0 && (
            <>
              <Separator className="bg-gray-700" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-indigo-400" />
                  <span className="text-sm text-gray-400 uppercase tracking-wide">Target Profile</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="Deep%" value={player.deepTargetRate} format="pct" />
                  <StatCard label="Interm%" value={player.intermediateTargetRate} format="pct" />
                  <StatCard label="Short%" value={player.shortTargetRate} format="pct" />
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <StatCard label="Catch%" value={player.catchRate} format="pct" />
                  <StatCard label="RACR" value={player.racr} format="decimal" />
                  <StatCard label="WOPR" value={player.wopr} format="decimal" />
                  <StatCard label="Slot%" value={player.slotRate} format="pct" />
                </div>
                {player.avgAirEpa !== null && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <StatCard label="Tgt EPA" value={player.avgAirEpa} format="decimal" />
                    <StatCard label="Comp Tgt EPA" value={player.avgCompAirEpa} format="decimal" />
                  </div>
                )}
              </div>
            </>
          )}

          {/* QB Formation & Passing */}
          {player.position === 'QB' && (player.snaps || 0) > 0 && (
            <>
              <Separator className="bg-gray-700" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-violet-400" />
                  <span className="text-sm text-gray-400 uppercase tracking-wide">QB Profile</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <StatCard label="CPOE" value={player.cpoe} format="decimal" />
                  <StatCard label="Pass aDOT" value={player.passAdot} format="decimal" />
                  <StatCard label="Deep%" value={player.deepPassRate} format="pct" />
                  <StatCard label="1D Rate" value={player.passFirstDownRate} format="pct" />
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <StatCard label="Shotgun%" value={player.shotgunRate} format="pct" />
                  <StatCard label="No Huddle%" value={player.noHuddleRate} format="pct" />
                  <StatCard label="Sack%" value={player.sackRate} format="pct" />
                  <StatCard label="QB Hits" value={player.qbHits} />
                </div>
              </div>
            </>
          )}

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
                {/* RB-specific rush efficiency */}
                {player.position === 'RB' && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    <StatCard label="Stuffed" value={player.stuffed} />
                    <StatCard label="Stuff%" value={player.stuffRate} format="pct" />
                    <StatCard label="1D" value={player.rushFirstDowns} />
                    <StatCard label="1D Rate" value={player.rushFirstDownRate} format="pct" />
                  </div>
                )}
              </div>
            </>
          )}

          {/* RB Run Profile (Gap + Location) */}
          {player.position === 'RB' && (player.rushAttempts || 0) >= 5 && (
            <>
              <Separator className="bg-gray-700" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-lime-400" />
                  <span className="text-sm text-gray-400 uppercase tracking-wide">Run Profile</span>
                </div>
                <div className="text-xs text-gray-500 mb-2">Gap Distribution</div>
                <div className="grid grid-cols-4 gap-2">
                  <StatCard label="Inside%" value={player.insideRunRate} format="pct" />
                  <StatCard label="Outside%" value={player.outsideRunRate} format="pct" />
                  <StatCard label="In Succ%" value={player.insideSuccessRate} format="pct" />
                  <StatCard label="Out Succ%" value={player.outsideSuccessRate} format="pct" />
                </div>
                <div className="text-xs text-gray-500 mb-2 mt-3">Location Distribution</div>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="Left%" value={player.leftRunRate} format="pct" />
                  <StatCard label="Middle%" value={player.middleRunRate} format="pct" />
                  <StatCard label="Right%" value={player.rightRunRate} format="pct" />
                </div>
              </div>
            </>
          )}

          {/* RB Short Yardage */}
          {player.position === 'RB' && (player.shortYardageAttempts || 0) > 0 && (
            <>
              <Separator className="bg-gray-700" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-amber-400" />
                  <span className="text-sm text-gray-400 uppercase tracking-wide">Short Yardage</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="Attempts" value={player.shortYardageAttempts} />
                  <StatCard label="Conversions" value={player.shortYardageConversions} />
                  <StatCard label="Conv%" value={player.shortYardageRate} format="pct" />
                </div>
              </div>
            </>
          )}

          {((player.rzSnaps || 0) > 0 || (player.rzTargets || 0) > 0) && (
            <>
              <Separator className="bg-gray-700" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-red-400" />
                  <span className="text-sm text-gray-400 uppercase tracking-wide">Red Zone</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <StatCard label="RZ Snaps" value={player.rzSnaps} />
                  <StatCard label="RZ Tgt" value={player.rzTargets} />
                  <StatCard label="RZ Rec" value={player.rzReceptions} />
                  <StatCard label="RZ TDs" value={player.rzRecTds} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <StatCard label="RZ Succ%" value={player.rzSuccessRate} format="pct" />
                  <StatCard label="RZ Tgt Share" value={player.rzTargetShare} format="pct" />
                </div>
              </div>
            </>
          )}

          {((player.thirdDownSnaps || 0) > 0) && (
            <>
              <Separator className="bg-gray-700" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-orange-400" />
                  <span className="text-sm text-gray-400 uppercase tracking-wide">3rd Down / Situational</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="3D Snaps" value={player.thirdDownSnaps} />
                  <StatCard label="3D Conv" value={player.thirdDownConversions} />
                  <StatCard label="3D Conv%" value={player.thirdDownConversionRate} format="pct" />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <StatCard label="Early Down%" value={player.earlyDownSuccessRate} format="pct" />
                  <StatCard label="Late Down%" value={player.lateDownSuccessRate} format="pct" />
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
  const [performanceFilter, setPerformanceFilter] = useState<'ALL' | 'RISER' | 'FALLER' | 'NEUTRAL'>('ALL');

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

  // Check if selected week has data available
  const selectedWeekHasData = viewMode === 'week' && week != null
    ? metaData?.availableWeeks?.includes(week) ?? true
    : true;

  // Check if range includes any available weeks
  const rangeHasData = viewMode === 'range' && weekFrom != null && weekTo != null
    ? metaData?.availableWeeks?.some(w => w >= weekFrom && w <= weekTo) ?? true
    : true;

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
    enabled: searchReady && viewMode === 'week',
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
    enabled: searchReady && viewMode !== 'week',
  });

  const isLoading = searchLoading || aggLoading;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (viewMode === 'week') {
      refetchSearch();
    } else {
      refetchAgg();
    }
  };

  const handlePlayerClick = (player: PlayerWeekData) => {
    setSelectedPlayer(player);
    setDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
              <Database className="h-6 w-6 text-blue-400" />
              Tiber Data Lab
            </h1>
            <p className="text-gray-400 text-sm">NFL player analytics with usage, efficiency, and expected fantasy metrics</p>
          </div>
        </div>

        {metaError && (
          <Card className="bg-[#141824] border-red-700 mb-6" data-testid="card-snapshot-error">
            <CardContent className="p-4">
              <div className="text-red-400 text-center flex items-center justify-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Failed to load snapshot data. Search is disabled until snapshot is available.
              </div>
            </CardContent>
          </Card>
        )}

        {metaLoading && (
          <Card className="bg-[#141824] border-gray-700 mb-6" data-testid="card-data-status-loading">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-32 bg-gray-700" />
                  <div className="h-4 w-px bg-gray-600" />
                  <div className="flex gap-1">
                    {Array.from({ length: 18 }, (_, i) => (
                      <Skeleton key={i} className="w-5 h-5 rounded bg-gray-700" />
                    ))}
                  </div>
                </div>
                <Skeleton className="h-5 w-20 bg-gray-700" />
              </div>
            </CardContent>
          </Card>
        )}

        {metaData && !metaError && !metaLoading && (
          <Card className="bg-[#141824] border-gray-700 mb-6" data-testid="card-data-status">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Database className="h-4 w-4 text-green-400" />
                    <span className="text-sm">
                      {metaData.season} Season Data
                    </span>
                  </div>
                  <div className="h-4 w-px bg-gray-600" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Available:</span>
                    <div className="flex gap-1">
                      {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                        <div
                          key={w}
                          className={`w-5 h-5 rounded text-[10px] font-medium flex items-center justify-center ${
                            metaData.availableWeeks?.includes(w)
                              ? 'bg-green-600/30 text-green-400 border border-green-600/50'
                              : 'bg-gray-700/30 text-gray-600 border border-gray-700/50'
                          }`}
                          title={`Week ${w}: ${metaData.availableWeeks?.includes(w) ? 'Data available' : 'No data'}`}
                        >
                          {w}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="border-green-600 text-green-400 text-xs">
                  {metaData.availableWeeks?.length || 0} / 18 weeks
                </Badge>
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
              <Badge variant="outline" className="border-blue-600 text-blue-400">
                NFL Mode
              </Badge>
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
            </div>

            <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-4">
              {viewMode === 'week' && (
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-gray-400 text-sm">Player Name</Label>
                  <Input
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-[#0a0e1a] border-gray-600 text-white placeholder:text-gray-400"
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

              {(viewMode === 'season' || viewMode === 'range') && (
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
                  className="bg-[#0a0e1a] border-gray-600 text-white placeholder:text-gray-400"
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
                    className="bg-[#0a0e1a] border-gray-600 text-white placeholder:text-gray-400"
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
                      className="bg-[#0a0e1a] border-gray-600 text-white placeholder:text-gray-400"
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
                      className="bg-[#0a0e1a] border-gray-600 text-white placeholder:text-gray-400"
                      placeholder="..."
                      min={1}
                      max={18}
                      data-testid="input-week-to"
                    />
                  </div>
                </>
              )}

              {viewMode === 'week' && (
                <div className="w-28">
                  <Label className="text-gray-400 text-sm">Min Routes</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={minRoutes}
                    onChange={(e) => setMinRoutes(e.target.value)}
                    className="bg-[#0a0e1a] border-gray-600 text-white placeholder:text-gray-400"
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

            {/* Week availability warning */}
            {viewMode === 'week' && week && !selectedWeekHasData && metaData && (
              <div className="mt-3 p-3 bg-yellow-600/10 border border-yellow-600/30 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                <span className="text-yellow-400 text-sm">
                  Week {week} does not have data available. Available weeks: {metaData.availableWeeks?.join(', ') || 'None'}
                </span>
              </div>
            )}

            {viewMode === 'range' && weekFrom && weekTo && !rangeHasData && metaData && (
              <div className="mt-3 p-3 bg-yellow-600/10 border border-yellow-600/30 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                <span className="text-yellow-400 text-sm">
                  No data available for weeks {weekFrom}-{weekTo}. Available weeks: {metaData.availableWeeks?.join(', ') || 'None'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#141824] border-gray-700" data-testid="card-results">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                Results
                {viewMode === 'season' && <Badge className="bg-green-600/50 text-green-200">Season</Badge>}
                {viewMode === 'range' && <Badge className="bg-orange-600/50 text-orange-200">Range</Badge>}
              </CardTitle>
              <span className="text-gray-400 text-sm">
                {viewMode === 'week' 
                  ? `${searchData?.total ?? 0} players` 
                  : `${aggData?.count ?? 0} players`
                }
              </span>
            </div>
            {aggData?.modeLabel && viewMode !== 'week' && (
              <CardDescription className="text-gray-500">
                {aggData?.modeLabel}
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
            ) : viewMode !== 'week' ? (
              aggData?.data.length === 0 ? (
                <div className="p-8 text-center">
                  <Database className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No data found</p>
                  <p className="text-gray-500 text-sm mt-1">
                    {viewMode === 'season'
                      ? `No player data available for the ${season} season yet.`
                      : `No player data available for weeks ${weekFrom}-${weekTo}.`}
                  </p>
                  {metaData?.availableWeeks && metaData.availableWeeks.length > 0 && (
                    <p className="text-gray-600 text-xs mt-2">
                      Data is available for weeks: {metaData.availableWeeks.join(', ')}
                    </p>
                  )}
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
              <div className="p-8 text-center">
                <Search className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No players found</p>
                <p className="text-gray-500 text-sm mt-1">
                  {searchQuery
                    ? `No players matching "${searchQuery}" for Week ${week}.`
                    : `No player data available for Week ${week}.`}
                </p>
                {!selectedWeekHasData && metaData?.availableWeeks && (
                  <p className="text-yellow-500 text-xs mt-2">
                    Week {week} may not have data. Try weeks: {metaData.availableWeeks.join(', ')}
                  </p>
                )}
              </div>
            ) : position === 'QB' ? (
              /* QB-Specific Table */
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-results-qb">
                  <thead className="bg-[#0a0e1a] text-gray-400 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 text-left">Player</th>
                      <th className="px-4 py-3 text-center">Team</th>
                      <th className="px-4 py-3 text-center" title="Sack Percentage">Sack%</th>
                      <th className="px-4 py-3 text-center" title="Yards Lost to Sacks">Sack Yds</th>
                      <th className="px-4 py-3 text-center" title="Adjusted Net Yards per Attempt">ANY/A</th>
                      <th className="px-4 py-3 text-center" title="Rush Attempts">R ATT</th>
                      <th className="px-4 py-3 text-center" title="Rush Yards">R YDS</th>
                      <th className="px-4 py-3 text-center" title="Rush TDs">R TD</th>
                      <th className="px-4 py-3 text-center text-purple-400" title="Fantasy Points Per Dropback">FP/DB</th>
                      <th className="px-4 py-3 text-center text-purple-400" title="Total Fantasy Points (PPR)">FPTS</th>
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
                        <td className="px-4 py-3 text-center font-mono text-red-400">
                          {formatPct(player.sackRate)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-red-400">
                          {player.sackYards ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-green-400 font-semibold">
                          {formatStat(player.anyA, 2)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {player.rushAttempts ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {player.rushYards ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-green-400">
                          {player.rushTds ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-purple-400 font-semibold">
                          {formatStat(player.fpPerDropback, 2)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-purple-400 font-semibold">
                          {formatStat(player.fptsPpr, 1)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* WR/RB/TE Table */
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
                      <th className="px-4 py-3 text-center text-red-400" title="Red Zone TDs">RZ TD</th>
                      <th className="px-4 py-3 text-center text-orange-400" title="3rd Down Conversion Rate">3D%</th>
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
                        <td className="px-4 py-3 text-center font-mono text-red-400 font-semibold">
                          {(player.rzRecTds ?? 0) + (player.rzRushTds ?? 0) > 0
                            ? (player.rzRecTds ?? 0) + (player.rzRushTds ?? 0)
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-orange-400">
                          {formatPct(player.thirdDownConversionRate)}
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
    </div>
  );
}
