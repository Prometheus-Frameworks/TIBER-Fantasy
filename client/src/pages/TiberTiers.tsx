import { useState, useMemo, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { 
  Home, 
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw, 
  Crown,
  Zap,
  ChevronDown,
  ChevronUp,
  Save,
  RotateCcw,
  Calendar,
  BarChart3,
  Target,
  Activity,
  Info,
  Trophy,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Download,
  Eye
} from 'lucide-react';
import PlayerDetailDrawer from '@/components/PlayerDetailDrawer';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrentNFLWeek } from '@/hooks/useCurrentNFLWeek';

type Position = 'WR' | 'RB' | 'TE' | 'QB';
type ViewMode = 'season' | 'weekly';
type ForgeMode = 'redraft' | 'dynasty' | 'bestball';
type ScoringFormat = 'ppr' | 'half';
type SortColumn = 'alpha' | 'ppg' | 'total' | 'l3' | 'volume' | 'rec' | 'tds' | 'snap' | 'rz' | 'gp' | 'xfpts' | 'fpoe';
type SortDirection = 'desc' | 'asc';
type WeekRange = 'full' | 'last4' | 'last6' | 'weeks1-6' | 'weeks7-12' | 'weeks13+';

interface FootballLensIssue {
  code: string;
  message: string;
  severity: 'info' | 'warn' | 'block';
  position: string;
  pillar: string;
}

const WEEK_RANGE_OPTIONS: { value: WeekRange; label: string }[] = [
  { value: 'full', label: 'Full Season' },
  { value: 'last4', label: 'Last 4 Weeks' },
  { value: 'last6', label: 'Last 6 Weeks' },
  { value: 'weeks1-6', label: 'Weeks 1-6' },
  { value: 'weeks7-12', label: 'Weeks 7-12' },
  { value: 'weeks13+', label: 'Weeks 13+' },
];

function getWeekRangeParams(weekRange: WeekRange, currentWeek: number): { startWeek?: number; endWeek?: number } {
  switch (weekRange) {
    case 'full':
      return {};
    case 'last4':
      return { startWeek: Math.max(1, currentWeek - 3), endWeek: currentWeek };
    case 'last6':
      return { startWeek: Math.max(1, currentWeek - 5), endWeek: currentWeek };
    case 'weeks1-6':
      return { startWeek: 1, endWeek: 6 };
    case 'weeks7-12':
      return { startWeek: 7, endWeek: 12 };
    case 'weeks13+':
      return { startWeek: 13, endWeek: currentWeek };
    default:
      return {};
  }
}

interface ForgeWeights {
  volume: number;
  efficiency: number;
  stability: number;
  context: number;
}

interface ForgePlayer {
  playerId: string;
  playerName: string;
  position: Position;
  nflTeam?: string;
  alpha: number;
  rawAlpha?: number;
  tier?: string;
  confidence?: number;
  trajectory?: 'rising' | 'flat' | 'declining';
  gamesPlayed: number;
  issues?: FootballLensIssue[] | null;
  pillars?: {
    volume: number;
    efficiency: number;
    teamContext: number;
    stability: number;
  };
  subScores?: {
    volume: number;
    efficiency: number;
    stability: number;
    contextFit: number;
  };
  fantasyStats?: {
    seasonFptsPpr: number;
    seasonFptsHalf: number;
    ppgPpr: number;
    ppgHalf: number;
    last3AvgPpr: number;
    last3AvgHalf: number;
    targets?: number;
    touches?: number;
    receptions?: number;
    recTds?: number;
    snapPct?: number;
    rzOpps?: number;
    xFpts?: number;
    fpoe?: number;
  };
  nextMatchup?: {
    opponent: string;
    dvpRank: number;
    isHome: boolean;
  };
}

interface ForgeBatchResponse {
  success?: boolean;
  scores: ForgePlayer[];
  meta: {
    position: string;
    mode: ForgeMode;
    limit?: number;
    season: number;
    week: number | 'season';
    count: number;
    playersWithIssues?: number;
    version?: string;
  };
}

const DEFAULT_WEIGHTS: ForgeWeights = {
  volume: 40,
  efficiency: 35,
  stability: 15,
  context: 10,
};

const WEIGHT_PRESETS = [
  { id: 'balanced', label: 'Balanced', weights: { volume: 40, efficiency: 35, stability: 15, context: 10 } },
  { id: 'workhorse', label: 'Workhorse', weights: { volume: 55, efficiency: 25, stability: 15, context: 5 } },
  { id: 'efficient', label: 'Efficiency', weights: { volume: 25, efficiency: 50, stability: 15, context: 10 } },
  { id: 'stable', label: 'High Floor', weights: { volume: 30, efficiency: 30, stability: 30, context: 10 } },
  { id: 'upside', label: 'Upside', weights: { volume: 35, efficiency: 45, stability: 10, context: 10 } },
];

function getTierFromAlpha(alpha: number, position: Position): { tier: string; color: string; bg: string } {
  const thresholds = {
    QB: { T1: 70, T2: 55, T3: 42, T4: 32 },
    RB: { T1: 78, T2: 68, T3: 55, T4: 42 },
    WR: { T1: 82, T2: 72, T3: 58, T4: 45 },
    TE: { T1: 82, T2: 70, T3: 55, T4: 42 },
  };
  
  const t = thresholds[position];
  if (alpha >= t.T1) return { tier: 'T1', color: 'text-green-400', bg: 'bg-green-900/40 border-green-600/50' };
  if (alpha >= t.T2) return { tier: 'T2', color: 'text-emerald-400', bg: 'bg-emerald-900/40 border-emerald-600/50' };
  if (alpha >= t.T3) return { tier: 'T3', color: 'text-yellow-400', bg: 'bg-yellow-900/40 border-yellow-600/50' };
  if (alpha >= t.T4) return { tier: 'T4', color: 'text-orange-400', bg: 'bg-orange-900/40 border-orange-600/50' };
  return { tier: 'T5', color: 'text-red-400', bg: 'bg-red-900/40 border-red-600/50' };
}

function TrajectoryIcon({ trajectory }: { trajectory?: string }) {
  if (trajectory === 'rising') {
    return <TrendingUp className="h-4 w-4 text-green-400" />;
  }
  if (trajectory === 'declining') {
    return <TrendingDown className="h-4 w-4 text-red-400" />;
  }
  return <Minus className="h-4 w-4 text-slate-500" />;
}

// v1.2: Calibration bands matching backend ALPHA_CALIBRATION constants
const ALPHA_CALIBRATION: Record<Position, { p10: number; p90: number; outMin: number; outMax: number }> = {
  WR: { p10: 35, p90: 65, outMin: 25, outMax: 95 },
  RB: { p10: 32, p90: 62, outMin: 25, outMax: 95 },
  TE: { p10: 33, p90: 58, outMin: 25, outMax: 95 },
  QB: { p10: 30, p90: 60, outMin: 25, outMax: 95 },
};

function calibrateAlpha(position: Position, rawAlpha: number): number {
  const config = ALPHA_CALIBRATION[position];
  if (!config) return rawAlpha;
  
  const { p10, p90, outMin, outMax } = config;
  if (p90 === p10) return (outMin + outMax) / 2;
  
  // Linear mapping from raw score to calibrated output
  // Scores above p90 can exceed outMax (capped at 100)
  const t = (rawAlpha - p10) / (p90 - p10);
  const mapped = outMin + t * (outMax - outMin);
  return Math.min(100, Math.max(0, mapped));
}

function recalculateAlpha(player: ForgePlayer, weights: ForgeWeights, position: Position): number {
  const pillars = player.pillars || player.subScores;
  if (!pillars) return player.alpha;
  
  const volume = pillars.volume;
  const efficiency = pillars.efficiency;
  const stability = pillars.stability;
  const context = 'teamContext' in pillars ? pillars.teamContext : ('contextFit' in pillars ? pillars.contextFit : 50);
  
  const totalWeight = weights.volume + weights.efficiency + weights.stability + weights.context;
  
  if (totalWeight === 0) return player.alpha;
  
  const rawAlpha = (
    (volume * weights.volume) +
    (efficiency * weights.efficiency) +
    (stability * weights.stability) +
    (context * weights.context)
  ) / totalWeight;
  
  const calibrated = calibrateAlpha(position, rawAlpha);
  
  return Math.round(calibrated * 10) / 10;
}

// Custom compact slider with colored track
function CompactSlider({ 
  value, 
  onChange, 
  color,
  testId 
}: { 
  value: number; 
  onChange: (v: number) => void; 
  color: string;
  testId: string;
}) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      step={5}
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      className="slider-compact"
      style={{
        '--slider-color': color,
        '--slider-value': `${value}%`
      } as CSSProperties}
      data-testid={testId}
    />
  );
}

function WeightsPanel({ 
  weights, 
  onWeightsChange,
  isCollapsed,
  onToggle
}: { 
  weights: ForgeWeights; 
  onWeightsChange: (weights: ForgeWeights) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const [activePreset, setActivePreset] = useState<string>('balanced');
  const totalWeight = weights.volume + weights.efficiency + weights.stability + weights.context;
  const isValidTotal = totalWeight === 100;

  const handleSliderChange = (field: keyof ForgeWeights, value: number) => {
    onWeightsChange({ ...weights, [field]: value });
    setActivePreset('custom');
  };

  const applyPreset = (presetId: string) => {
    const preset = WEIGHT_PRESETS.find(p => p.id === presetId);
    if (preset) {
      onWeightsChange(preset.weights);
      setActivePreset(presetId);
    }
  };

  const resetToDefaults = () => {
    onWeightsChange(DEFAULT_WEIGHTS);
    setActivePreset('balanced');
  };

  // Colors for each slider
  const SLIDER_COLORS = {
    volume: 'rgb(59, 130, 246)',    // blue-500
    efficiency: 'rgb(234, 179, 8)', // yellow-500
    stability: 'rgb(168, 85, 247)', // purple-500
    context: 'rgb(20, 184, 166)'    // teal-500
  };

  return (
    <div className="rounded-md border border-gray-800/60 bg-gray-900/40 backdrop-blur-sm mb-2">
      {/* Sleek Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/20 transition-colors"
        data-testid="toggle-weights-panel"
      >
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-semibold text-white tracking-wide uppercase">Weights</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isValidTotal ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
            {totalWeight}%
          </span>
        </div>
        {isCollapsed ? (
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
        )}
      </button>

      {/* Collapsible Content */}
      <div 
        className={`overflow-hidden transition-all duration-200 ease-out ${
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[300px] opacity-100'
        }`}
      >
        <div className="px-3 pb-2.5 space-y-2">
          {/* Tight Preset Buttons */}
          <div className="flex flex-wrap gap-1.5">
            {WEIGHT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-all duration-150 ${
                  activePreset === preset.id
                    ? 'bg-purple-500/90 text-white shadow-sm shadow-purple-500/40'
                    : 'bg-gray-800/70 text-gray-400 hover:bg-gray-700/80 hover:text-gray-300'
                }`}
                data-testid={`preset-${preset.id}`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Tight 2x2 Slider Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {/* Volume Slider */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Target className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] text-gray-500 font-medium">VOL</span>
                </div>
                <span className="text-[11px] font-semibold text-blue-400 font-mono">{weights.volume}</span>
              </div>
              <CompactSlider
                value={weights.volume}
                onChange={(v) => handleSliderChange('volume', v)}
                color={SLIDER_COLORS.volume}
                testId="slider-volume"
              />
            </div>

            {/* Efficiency Slider */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  <span className="text-[10px] text-gray-500 font-medium">EFF</span>
                </div>
                <span className="text-[11px] font-semibold text-yellow-400 font-mono">{weights.efficiency}</span>
              </div>
              <CompactSlider
                value={weights.efficiency}
                onChange={(v) => handleSliderChange('efficiency', v)}
                color={SLIDER_COLORS.efficiency}
                testId="slider-efficiency"
              />
            </div>

            {/* Stability Slider */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] text-gray-500 font-medium">STB</span>
                </div>
                <span className="text-[11px] font-semibold text-purple-400 font-mono">{weights.stability}</span>
              </div>
              <CompactSlider
                value={weights.stability}
                onChange={(v) => handleSliderChange('stability', v)}
                color={SLIDER_COLORS.stability}
                testId="slider-stability"
              />
            </div>

            {/* Context Slider */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <BarChart3 className="w-3 h-3 text-teal-400" />
                  <span className="text-[10px] text-gray-500 font-medium">CTX</span>
                </div>
                <span className="text-[11px] font-semibold text-teal-400 font-mono">{weights.context}</span>
              </div>
              <CompactSlider
                value={weights.context}
                onChange={(v) => handleSliderChange('context', v)}
                color={SLIDER_COLORS.context}
                testId="slider-context"
              />
            </div>
          </div>

          {/* Inline Reset */}
          <div className="flex justify-end">
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              data-testid="button-reset-weights"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RankedPlayer extends ForgePlayer {
  adjustedAlpha: number;
}

function PlayerRow({ 
  player, 
  rank, 
  scoringFormat,
  position,
  onQuickView
}: { 
  player: RankedPlayer; 
  rank: number; 
  scoringFormat: ScoringFormat;
  position: Position;
  onQuickView: (player: RankedPlayer) => void;
}) {
  const tierInfo = getTierFromAlpha(player.adjustedAlpha, player.position);
  const stats = player.fantasyStats;
  
  const ppg = scoringFormat === 'ppr' ? stats?.ppgPpr : stats?.ppgHalf;
  const seasonTotal = scoringFormat === 'ppr' ? stats?.seasonFptsPpr : stats?.seasonFptsHalf;
  const last3Avg = scoringFormat === 'ppr' ? stats?.last3AvgPpr : stats?.last3AvgHalf;
  
  const volumeLabel = position === 'RB' ? 'Touches' : 'Targets';
  const volumeValue = position === 'RB' ? stats?.touches : stats?.targets;

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors group" data-testid={`player-row-${player.playerId}`}>
      {/* Rank */}
      <td className="py-2 sm:py-3 px-2 sm:px-3 text-center">
        <span className="text-slate-400 font-mono text-xs sm:text-sm">{rank}</span>
      </td>
      
      {/* Player Info */}
      <td className="py-2 sm:py-3 px-2 sm:px-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className={`px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-bold border ${tierInfo.bg} ${tierInfo.color}`}>
            {tierInfo.tier}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <Link 
                href={`/player/${player.playerId}`}
                className="font-medium text-white text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none hover:text-purple-400 transition-colors"
                data-testid={`player-link-${player.playerId}`}
              >
                {player.playerName}
              </Link>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickView(player);
                }}
                className="p-0.5 rounded hover:bg-slate-700/50 text-slate-500 hover:text-purple-400 transition-colors opacity-0 group-hover:opacity-100"
                title="Quick View"
                data-testid={`quick-view-${player.playerId}`}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              {player.issues && player.issues.length > 0 && (
                <Tooltip>
                  <TooltipTrigger>
                    <span className={`px-1 py-0.5 rounded text-[8px] font-semibold ${
                      player.issues[0].severity === 'warn' 
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                        : player.issues[0].severity === 'block'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`} data-testid={`issue-badge-${player.playerId}`}>
                      !
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-slate-800 border-slate-700 max-w-xs">
                    <div className="text-xs space-y-1">
                      <div className="font-semibold text-amber-400">Football Lens Alert</div>
                      {player.issues.map((issue, i) => (
                        <div key={i} className="text-slate-300">{issue.message}</div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500">{player.nflTeam || 'FA'}</div>
          </div>
        </div>
      </td>
      
      {/* Alpha Score + Raw + Trajectory */}
      <td className="py-2 sm:py-3 px-2 sm:px-3 text-center">
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center justify-center gap-0.5 sm:gap-1">
              <span className="text-sm sm:text-lg font-bold text-white font-mono">{player.adjustedAlpha.toFixed(1)}</span>
              {player.rawAlpha && player.rawAlpha !== player.adjustedAlpha && (
                <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                  ({player.rawAlpha.toFixed(0)})
                </span>
              )}
              <TrajectoryIcon trajectory={player.trajectory} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-slate-800 border-slate-700">
            <div className="text-xs space-y-1">
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Calibrated:</span>
                <span className="text-white font-mono">{player.adjustedAlpha.toFixed(1)}</span>
              </div>
              {player.rawAlpha && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Raw:</span>
                  <span className="text-slate-300 font-mono">{player.rawAlpha.toFixed(1)}</span>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </td>
      
      {/* Fantasy Points - PPG */}
      <td className="py-2 sm:py-3 px-2 sm:px-3 text-center">
        <span className="text-white font-mono text-xs sm:text-sm">{ppg?.toFixed(1) || '-'}</span>
      </td>
      
      {/* Fantasy Points - Season Total */}
      <td className="py-3 px-3 text-center hidden md:table-cell">
        <span className="text-slate-300 font-mono text-sm">{seasonTotal?.toFixed(1) || '-'}</span>
      </td>
      
      {/* Last 3 Avg */}
      <td className="py-3 px-3 text-center hidden lg:table-cell">
        <span className="text-slate-300 font-mono text-sm">{last3Avg?.toFixed(1) || '-'}</span>
      </td>
      
      {/* Volume - Targets/Touches */}
      <td className="py-3 px-3 text-center hidden md:table-cell">
        <Tooltip>
          <TooltipTrigger>
            <span className="text-blue-400 font-mono text-sm">{volumeValue || '-'}</span>
          </TooltipTrigger>
          <TooltipContent>{volumeLabel}</TooltipContent>
        </Tooltip>
      </td>
      
      {/* Snap % */}
      <td className="py-3 px-3 text-center hidden lg:table-cell">
        <span className="text-slate-300 font-mono text-sm">{stats?.snapPct ? `${stats.snapPct}%` : '-'}</span>
      </td>
      
      {/* RZ Opps */}
      <td className="py-3 px-3 text-center hidden lg:table-cell">
        <span className="text-orange-400 font-mono text-sm">{stats?.rzOpps || '-'}</span>
      </td>
      
      {/* Receptions */}
      <td className="py-3 px-3 text-center hidden lg:table-cell">
        <span className="text-cyan-400 font-mono text-sm">{stats?.receptions || '-'}</span>
      </td>
      
      {/* Receiving TDs */}
      <td className="py-3 px-3 text-center hidden lg:table-cell">
        <span className="text-yellow-400 font-mono text-sm">{stats?.recTds || '-'}</span>
      </td>
      
      {/* xFPTS */}
      <td className="py-3 px-3 text-center hidden xl:table-cell">
        <Tooltip>
          <TooltipTrigger>
            <span className="text-slate-400 font-mono text-sm">{stats?.xFpts?.toFixed(1) || '-'}</span>
          </TooltipTrigger>
          <TooltipContent>Expected Fantasy Points</TooltipContent>
        </Tooltip>
      </td>
      
      {/* FPOE - Color coded */}
      <td className="py-3 px-3 text-center hidden xl:table-cell">
        <Tooltip>
          <TooltipTrigger>
            <span className={`font-mono text-sm font-medium ${
              stats?.fpoe !== undefined 
                ? stats.fpoe > 0 
                  ? 'text-green-400' 
                  : stats.fpoe < 0 
                    ? 'text-red-400' 
                    : 'text-slate-400'
                : 'text-slate-500'
            }`}>
              {stats?.fpoe !== undefined ? (stats.fpoe > 0 ? '+' : '') + stats.fpoe.toFixed(1) : '-'}
            </span>
          </TooltipTrigger>
          <TooltipContent>Fantasy Points Over Expected (Actual - xFPTS)</TooltipContent>
        </Tooltip>
      </td>
      
      {/* Next Matchup - DvP Rank */}
      <td className="py-3 px-3 text-center hidden xl:table-cell">
        {player.nextMatchup ? (
          <Tooltip>
            <TooltipTrigger>
              <span className={`font-mono text-sm ${
                player.nextMatchup.dvpRank <= 8 
                  ? 'text-green-400 font-medium' 
                  : player.nextMatchup.dvpRank >= 25 
                    ? 'text-red-400 font-medium' 
                    : 'text-slate-400'
              }`}>
                {player.nextMatchup.isHome ? '' : '@'}{player.nextMatchup.opponent}
                <span className="ml-1 text-xs opacity-70">({player.nextMatchup.dvpRank})</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              vs {player.nextMatchup.opponent} - DvP Rank #{player.nextMatchup.dvpRank} 
              {player.nextMatchup.dvpRank <= 8 ? ' (Smash Spot)' : player.nextMatchup.dvpRank >= 25 ? ' (Tough Matchup)' : ''}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-slate-600">-</span>
        )}
      </td>
      
      {/* Sub-scores (Pillars) */}
      <td className="py-3 px-3 text-center hidden xl:table-cell">
        <div className="flex items-center justify-center gap-1 text-xs">
          <span className="text-blue-400">{(player.pillars?.volume ?? player.subScores?.volume)?.toFixed(0) || '-'}</span>
          <span className="text-slate-600">/</span>
          <span className="text-yellow-400">{(player.pillars?.efficiency ?? player.subScores?.efficiency)?.toFixed(0) || '-'}</span>
          <span className="text-slate-600">/</span>
          <span className="text-purple-400">{(player.pillars?.stability ?? player.subScores?.stability)?.toFixed(0) || '-'}</span>
          <span className="text-slate-600">/</span>
          <span className="text-emerald-400">{(player.pillars?.teamContext ?? player.subScores?.contextFit)?.toFixed(0) || '-'}</span>
        </div>
      </td>
      
      {/* Games */}
      <td className="py-3 px-3 text-center hidden md:table-cell">
        <span className="text-slate-500 text-sm">{player.gamesPlayed}G</span>
      </td>
    </tr>
  );
}

interface DrawerPlayerInfo {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
}

export default function TiberTiers() {
  const [position, setPosition] = useState<Position>('WR');
  const [viewMode, setViewMode] = useState<ViewMode>('season');
  const [forgeMode, setForgeMode] = useState<ForgeMode>('redraft');
  const [scoringFormat, setScoringFormat] = useState<ScoringFormat>('ppr');
  const [weightsCollapsed, setWeightsCollapsed] = useState(false);
  const [weights, setWeights] = useState<ForgeWeights>(DEFAULT_WEIGHTS);
  const [weekRange, setWeekRange] = useState<WeekRange>('full');
  const [sortColumn, setSortColumn] = useState<SortColumn>('alpha');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [drawerPlayer, setDrawerPlayer] = useState<DrawerPlayerInfo | null>(null);
  
  const { currentWeek, isLoading: weekLoading } = useCurrentNFLWeek();
  const displayWeek = currentWeek || 14;
  
  const weekRangeParams = useMemo(() => getWeekRangeParams(weekRange, displayWeek), [weekRange, displayWeek]);

  const { data, isLoading, refetch, isFetching } = useQuery<ForgeBatchResponse>({
    queryKey: ['/api/forge/eg/batch', position, displayWeek, viewMode, weekRange, forgeMode, scoringFormat],
    queryFn: async () => {
      let url = `/api/forge/eg/batch?position=${position}&limit=50&mode=${forgeMode}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch FORGE data');
      return res.json();
    },
    staleTime: 60000,
  });

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortValue = (player: RankedPlayer, column: SortColumn): number => {
    const stats = player.fantasyStats;
    const ppg = scoringFormat === 'ppr' ? stats?.ppgPpr : stats?.ppgHalf;
    const total = scoringFormat === 'ppr' ? stats?.seasonFptsPpr : stats?.seasonFptsHalf;
    const l3 = scoringFormat === 'ppr' ? stats?.last3AvgPpr : stats?.last3AvgHalf;
    const volume = position === 'RB' ? stats?.touches : stats?.targets;

    switch (column) {
      case 'alpha': return player.adjustedAlpha || 0;
      case 'ppg': return ppg || 0;
      case 'total': return total || 0;
      case 'l3': return l3 || 0;
      case 'volume': return volume || 0;
      case 'rec': return stats?.receptions || 0;
      case 'tds': return stats?.recTds || 0;
      case 'snap': return stats?.snapPct || 0;
      case 'rz': return stats?.rzOpps || 0;
      case 'gp': return player.gamesPlayed || 0;
      case 'xfpts': return stats?.xFpts || 0;
      case 'fpoe': return stats?.fpoe || 0;
      default: return 0;
    }
  };

  const rankedPlayers = useMemo(() => {
    if (!data?.scores) return [];
    
    const playersWithAlpha = [...data.scores].map(player => ({
      ...player,
      adjustedAlpha: recalculateAlpha(player, weights, position),
    }));

    return playersWithAlpha.sort((a, b) => {
      const aVal = getSortValue(a, sortColumn);
      const bVal = getSortValue(b, sortColumn);
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [data?.scores, weights, position, sortColumn, sortDirection, scoringFormat]);

  const volumeLabel = position === 'RB' ? 'TCH' : 'TGT';

  const exportToCsv = () => {
    if (!rankedPlayers.length) return;
    
    const headers = ['Rank', 'Player', 'Team', 'Alpha', 'PPG', 'Total', 'L3', volumeLabel, 'REC', 'TDs', 'Snap%', 'RZ', 'xFPTS', 'FPOE', 'Matchup', 'DvP Rank', 'GP'];
    const rows = rankedPlayers.map((player, idx) => {
      const stats = player.fantasyStats;
      const ppg = scoringFormat === 'ppr' ? stats?.ppgPpr : stats?.ppgHalf;
      const total = scoringFormat === 'ppr' ? stats?.seasonFptsPpr : stats?.seasonFptsHalf;
      const l3 = scoringFormat === 'ppr' ? stats?.last3AvgPpr : stats?.last3AvgHalf;
      const volume = position === 'RB' ? stats?.touches : stats?.targets;
      const matchup = player.nextMatchup;
      
      return [
        idx + 1,
        player.playerName,
        player.nflTeam || '',
        player.adjustedAlpha?.toFixed(1) ?? '',
        ppg?.toFixed(1) ?? '',
        total?.toFixed(1) ?? '',
        l3?.toFixed(1) ?? '',
        volume ?? '',
        stats?.receptions ?? '',
        stats?.recTds ?? '',
        stats?.snapPct ? `${stats.snapPct}%` : '',
        stats?.rzOpps ?? '',
        stats?.xFpts?.toFixed(1) ?? '',
        stats?.fpoe?.toFixed(1) ?? '',
        matchup ? `${matchup.isHome ? 'vs ' : '@'}${matchup.opponent}` : '',
        matchup?.dvpRank ?? '',
        player.gamesPlayed ?? '',
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tiber-tiers-${position}-${weekRange}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-2.5 w-2.5 text-slate-600 ml-0.5" />;
    }
    return sortDirection === 'desc' 
      ? <ArrowDown className="h-2.5 w-2.5 text-purple-400 ml-0.5" />
      : <ArrowUp className="h-2.5 w-2.5 text-purple-400 ml-0.5" />;
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#0a0e1a] overflow-x-hidden">
        <header className="bg-[#141824] border-b border-gray-800 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            {/* Mobile: Two rows, Desktop: Single row */}
            <div className="flex items-center justify-between h-14 sm:h-16">
              <div className="flex items-center gap-2 sm:gap-4">
                <Link href="/">
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white h-8 w-8 sm:h-10 sm:w-10" data-testid="button-home">
                    <Home className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </Link>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
                  <div>
                    <h1 className="text-base sm:text-xl font-bold text-white">Tiber Tiers</h1>
                    <p className="text-[10px] sm:text-xs text-slate-400 -mt-0.5 hidden sm:block">Fantasy Football Rankings</p>
                  </div>
                  <Badge variant="outline" className="border-purple-500 text-purple-400 text-[10px] sm:text-xs ml-1 sm:ml-2 hidden sm:inline-flex">
                    FORGE E+G v2
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center gap-1 sm:gap-3">
                {/* FORGE Mode Toggle - Hidden on mobile */}
                <div className="hidden sm:flex items-center bg-slate-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setForgeMode('redraft')}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                      forgeMode === 'redraft'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    data-testid="toggle-redraft"
                  >
                    <Trophy className="h-3 w-3 sm:h-3.5 sm:w-3.5 inline mr-1" />
                    Redraft
                  </button>
                  <button
                    onClick={() => setForgeMode('dynasty')}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                      forgeMode === 'dynasty'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    data-testid="toggle-dynasty"
                  >
                    <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 inline mr-1" />
                    Dynasty
                  </button>
                  <button
                    onClick={() => setForgeMode('bestball')}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                      forgeMode === 'bestball'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    data-testid="toggle-bestball"
                  >
                    <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 inline mr-1" />
                    BestBall
                  </button>
                </div>

                {/* Scoring Format Toggle */}
                <div className="flex items-center bg-slate-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setScoringFormat('ppr')}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                      scoringFormat === 'ppr'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    data-testid="toggle-ppr"
                  >
                    PPR
                  </button>
                  <button
                    onClick={() => setScoringFormat('half')}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                      scoringFormat === 'half'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    data-testid="toggle-half-ppr"
                  >
                    Half
                  </button>
                </div>

                {/* View Mode Toggle */}
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                  <TabsList className="bg-slate-800 h-8 sm:h-10">
                    <TabsTrigger value="season" className="data-[state=active]:bg-purple-600 text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-season">
                      <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                      <span className="hidden sm:inline">Season</span>
                      <span className="sm:hidden">Szn</span>
                    </TabsTrigger>
                    <TabsTrigger value="weekly" className="data-[state=active]:bg-purple-600 text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-weekly">
                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                      Wk {displayWeek}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={exportToCsv}
                      disabled={!rankedPlayers.length}
                      className="border-slate-600 h-8 w-8 sm:h-9 sm:w-9 p-0 hover:border-blue-500 hover:text-blue-400"
                      data-testid="button-export-csv"
                    >
                      <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export to CSV</TooltipContent>
                </Tooltip>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="border-slate-600 h-8 w-8 sm:h-9 sm:w-9 p-0"
                  data-testid="button-refresh"
                >
                  <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${isFetching ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <WeightsPanel 
            weights={weights}
            onWeightsChange={setWeights}
            isCollapsed={weightsCollapsed}
            onToggle={() => setWeightsCollapsed(!weightsCollapsed)}
          />

          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex gap-1 sm:gap-2">
                {(['WR', 'RB', 'TE', 'QB'] as Position[]).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setPosition(pos)}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-colors flex-1 sm:flex-none ${
                      position === pos
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                    data-testid={`position-${pos.toLowerCase()}`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Select value={weekRange} onValueChange={(v) => setWeekRange(v as WeekRange)}>
                        <SelectTrigger className="w-[130px] sm:w-[140px] h-8 bg-slate-800 border-slate-700 text-xs sm:text-sm" data-testid="select-week-range">
                          <Filter className="h-3 w-3 mr-1.5 text-slate-400" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {WEEK_RANGE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs sm:text-sm">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Filter rankings by specific weeks</TooltipContent>
                </Tooltip>
                
                <div className="flex items-center gap-1 sm:gap-2 text-xs text-slate-500">
                  <Info className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>{rankedPlayers.length} players</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Sort by:</span>
                <span className="text-purple-400 font-medium">
                  {sortColumn === 'alpha' ? 'Alpha' : 
                   sortColumn === 'ppg' ? 'PPG' :
                   sortColumn === 'total' ? 'Total' :
                   sortColumn === 'l3' ? 'L3 Avg' :
                   sortColumn === 'volume' ? volumeLabel :
                   sortColumn === 'rec' ? 'REC' :
                   sortColumn === 'tds' ? 'TDs' :
                   sortColumn === 'snap' ? 'Snap%' :
                   sortColumn === 'rz' ? 'RZ' :
                   sortColumn === 'xfpts' ? 'xFPTS' :
                   sortColumn === 'fpoe' ? 'FPOE' : 'GP'}
                  {sortDirection === 'desc' ? ' ↓' : ' ↑'}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-blue-400">V</span>/
                <span className="text-yellow-400">E</span>/
                <span className="text-purple-400">S</span>/
                <span className="text-emerald-400">C</span>
                <span className="ml-1">= Sub-scores</span>
              </div>
            </div>
          </div>

          <div className="bg-[#141824] border border-gray-800 rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="p-6 sm:p-8 text-center">
                <div className="animate-spin h-6 w-6 sm:h-8 sm:w-8 border-2 border-purple-400 border-t-transparent rounded-full mx-auto mb-3 sm:mb-4"></div>
                <p className="text-sm sm:text-base text-slate-400">Loading {position} rankings...</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-w-full">
                <table className="w-full min-w-[400px]" data-testid="tiers-table">
                  <thead className="bg-[#0a0e1a] text-[10px] sm:text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="py-2 sm:py-3 px-2 sm:px-3 text-center w-8 sm:w-12">#</th>
                      <th className="py-2 sm:py-3 px-2 sm:px-3 text-left">Player</th>
                      <th className="py-2 sm:py-3 px-2 sm:px-3 text-center">
                        <button 
                          onClick={() => handleSort('alpha')} 
                          className={`flex items-center justify-center gap-0.5 mx-auto hover:text-purple-400 transition-colors ${sortColumn === 'alpha' ? 'text-purple-400' : ''}`}
                          data-testid="sort-alpha"
                        >
                          <Crown className="h-3 w-3 text-purple-400" />
                          Alpha
                          <SortIcon column="alpha" />
                        </button>
                      </th>
                      <th className="py-2 sm:py-3 px-2 sm:px-3 text-center">
                        <button 
                          onClick={() => handleSort('ppg')} 
                          className={`flex items-center justify-center gap-0.5 mx-auto hover:text-blue-400 transition-colors ${sortColumn === 'ppg' ? 'text-blue-400' : ''}`}
                          data-testid="sort-ppg"
                        >
                          PPG
                          <SortIcon column="ppg" />
                        </button>
                      </th>
                      <th className="py-3 px-3 text-center hidden md:table-cell">
                        <button 
                          onClick={() => handleSort('total')} 
                          className={`flex items-center justify-center gap-0.5 mx-auto hover:text-blue-400 transition-colors ${sortColumn === 'total' ? 'text-blue-400' : ''}`}
                          data-testid="sort-total"
                        >
                          Total
                          <SortIcon column="total" />
                        </button>
                      </th>
                      <th className="py-3 px-3 text-center hidden lg:table-cell">
                        <button 
                          onClick={() => handleSort('l3')} 
                          className={`flex items-center justify-center gap-0.5 mx-auto hover:text-green-400 transition-colors ${sortColumn === 'l3' ? 'text-green-400' : ''}`}
                          data-testid="sort-l3"
                        >
                          L3
                          <SortIcon column="l3" />
                        </button>
                      </th>
                      <th className="py-3 px-3 text-center hidden md:table-cell">
                        <button 
                          onClick={() => handleSort('volume')} 
                          className={`flex items-center justify-center gap-0.5 mx-auto hover:text-blue-400 transition-colors ${sortColumn === 'volume' ? 'text-blue-400' : ''}`}
                          data-testid="sort-volume"
                        >
                          <Target className="h-3 w-3 text-blue-400" />
                          {volumeLabel}
                          <SortIcon column="volume" />
                        </button>
                      </th>
                      <th className="py-3 px-3 text-center hidden lg:table-cell">
                        <button 
                          onClick={() => handleSort('snap')} 
                          className={`flex items-center justify-center gap-0.5 mx-auto hover:text-slate-300 transition-colors ${sortColumn === 'snap' ? 'text-slate-300' : ''}`}
                          data-testid="sort-snap"
                        >
                          Snap%
                          <SortIcon column="snap" />
                        </button>
                      </th>
                      <th className="py-3 px-3 text-center hidden lg:table-cell">
                        <button 
                          onClick={() => handleSort('rz')} 
                          className={`flex items-center justify-center gap-0.5 mx-auto hover:text-orange-400 transition-colors ${sortColumn === 'rz' ? 'text-orange-400' : ''}`}
                          data-testid="sort-rz"
                        >
                          <Zap className="h-3 w-3 text-orange-400" />
                          RZ
                          <SortIcon column="rz" />
                        </button>
                      </th>
                      <th className="py-3 px-3 text-center hidden lg:table-cell">
                        <button 
                          onClick={() => handleSort('rec')} 
                          className={`flex items-center justify-center gap-0.5 mx-auto hover:text-cyan-400 transition-colors ${sortColumn === 'rec' ? 'text-cyan-400' : ''}`}
                          data-testid="sort-rec"
                        >
                          REC
                          <SortIcon column="rec" />
                        </button>
                      </th>
                      <th className="py-3 px-3 text-center hidden lg:table-cell">
                        <button 
                          onClick={() => handleSort('tds')} 
                          className={`flex items-center justify-center gap-0.5 mx-auto hover:text-yellow-400 transition-colors ${sortColumn === 'tds' ? 'text-yellow-400' : ''}`}
                          data-testid="sort-tds"
                        >
                          TDs
                          <SortIcon column="tds" />
                        </button>
                      </th>
                      <th className="py-3 px-3 text-center hidden xl:table-cell">
                        <Tooltip>
                          <TooltipTrigger>
                            <button 
                              onClick={() => handleSort('xfpts')} 
                              className={`flex items-center justify-center gap-0.5 mx-auto hover:text-slate-300 transition-colors ${sortColumn === 'xfpts' ? 'text-slate-300' : ''}`}
                              data-testid="sort-xfpts"
                            >
                              xFPTS
                              <SortIcon column="xfpts" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Expected Fantasy Points (NFLfastR model)</TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="py-3 px-3 text-center hidden xl:table-cell">
                        <Tooltip>
                          <TooltipTrigger>
                            <button 
                              onClick={() => handleSort('fpoe')} 
                              className={`flex items-center justify-center gap-0.5 mx-auto hover:text-emerald-400 transition-colors ${sortColumn === 'fpoe' ? 'text-emerald-400' : ''}`}
                              data-testid="sort-fpoe"
                            >
                              FPOE
                              <SortIcon column="fpoe" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Fantasy Points Over Expected (Actual - xFPTS)</TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="py-3 px-3 text-center hidden xl:table-cell">
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="text-slate-400">Matchup</span>
                          </TooltipTrigger>
                          <TooltipContent>Next week opponent DvP rank (1 = easiest)</TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="py-3 px-3 text-center hidden xl:table-cell">
                        <Tooltip>
                          <TooltipTrigger>V/E/S/C</TooltipTrigger>
                          <TooltipContent>Volume / Efficiency / Stability / Context Sub-scores</TooltipContent>
                        </Tooltip>
                      </th>
                      <th className="py-3 px-3 text-center hidden md:table-cell">
                        <button 
                          onClick={() => handleSort('gp')} 
                          className={`flex items-center justify-center gap-0.5 mx-auto hover:text-slate-300 transition-colors ${sortColumn === 'gp' ? 'text-slate-300' : ''}`}
                          data-testid="sort-gp"
                        >
                          GP
                          <SortIcon column="gp" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedPlayers.map((player, index) => (
                      <PlayerRow 
                        key={player.playerId} 
                        player={player} 
                        rank={index + 1}
                        scoringFormat={scoringFormat}
                        position={position}
                        onQuickView={(p) => setDrawerPlayer({
                          playerId: p.playerId,
                          playerName: p.playerName,
                          team: p.nflTeam || 'FA',
                          position: p.position,
                        })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 text-[10px] sm:text-xs text-slate-500">
            <div className="flex items-start gap-2">
              <Info className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="hidden sm:block">
                <strong className="text-slate-300">FORGE</strong> (Football-Oriented Recursive Grading Engine) powers Tiber Tiers. 
                Alpha scores combine <span className="text-blue-400">Volume</span>, <span className="text-yellow-400">Efficiency</span>, 
                <span className="text-purple-400"> Stability</span>, and <span className="text-emerald-400">Context</span> sub-scores.
                Adjust the sliders above to weight what matters most for your fantasy strategy.
              </div>
              <div className="sm:hidden">
                <strong className="text-slate-300">FORGE</strong> powers these rankings. Adjust sliders above to customize.
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Quick View Drawer */}
      {drawerPlayer && (
        <PlayerDetailDrawer
          isOpen={!!drawerPlayer}
          onClose={() => setDrawerPlayer(null)}
          nflfastrId={drawerPlayer.playerId}
          playerName={drawerPlayer.playerName}
          team={drawerPlayer.team}
          position={drawerPlayer.position}
          week={displayWeek}
          season={2025}
        />
      )}
    </TooltipProvider>
  );
}
