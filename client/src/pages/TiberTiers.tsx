import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { 
  Home, 
  TrendingUp, 
  ArrowUpDown, 
  RefreshCw, 
  Crown,
  Star,
  Zap,
  ChevronDown,
  ChevronUp,
  Save,
  RotateCcw,
  Calendar,
  BarChart3,
  Target,
  Activity,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useCurrentNFLWeek } from '@/hooks/useCurrentNFLWeek';

type Position = 'WR' | 'RB' | 'TE' | 'QB';
type ViewMode = 'season' | 'weekly';

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
  confidence?: number;
  trajectory?: 'rising' | 'flat' | 'declining';
  gamesPlayed: number;
  subScores?: {
    volume: number;
    efficiency: number;
    stability: number;
    contextFit: number;
  };
}

interface ForgeBatchResponse {
  success: boolean;
  scores: ForgePlayer[];
  meta: {
    position: string;
    limit: number;
    season: number;
    week: number;
    count: number;
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

function getTrajectoryIcon(trajectory?: string): { icon: string; color: string } {
  if (trajectory === 'rising') return { icon: '↗', color: 'text-green-400' };
  if (trajectory === 'declining') return { icon: '↘', color: 'text-red-400' };
  return { icon: '→', color: 'text-slate-400' };
}

function recalculateAlpha(player: ForgePlayer, weights: ForgeWeights): number {
  if (!player.subScores) return player.alpha;
  
  const { volume, efficiency, stability, contextFit } = player.subScores;
  const totalWeight = weights.volume + weights.efficiency + weights.stability + weights.context;
  
  if (totalWeight === 0) return player.alpha;
  
  const weightedAlpha = (
    (volume * weights.volume) +
    (efficiency * weights.efficiency) +
    (stability * weights.stability) +
    (contextFit * weights.context)
  ) / totalWeight;
  
  return Math.round(weightedAlpha * 10) / 10;
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

  const handleSliderChange = (field: keyof ForgeWeights, value: number[]) => {
    onWeightsChange({ ...weights, [field]: value[0] });
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

  return (
    <div className="bg-[#141824] border border-slate-700 rounded-xl mb-6">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors rounded-t-xl"
        data-testid="toggle-weights-panel"
      >
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">FORGE Formula Weights</h3>
          <span className={`text-xs px-2 py-1 rounded ${isValidTotal ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
            {isValidTotal ? '100%' : `${totalWeight}%`}
          </span>
        </div>
        {isCollapsed ? (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronUp className="h-5 w-5 text-slate-400" />
        )}
      </button>

      {!isCollapsed && (
        <div className="p-4 pt-0 space-y-4">
          <p className="text-xs text-slate-500 border-l-2 border-purple-500/50 pl-3">
            Adjust how FORGE weighs different performance factors. Changes apply instantly to rankings below.
          </p>

          <div className="flex flex-wrap gap-2">
            {WEIGHT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  activePreset === preset.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                data-testid={`preset-${preset.id}`}
              >
                {preset.label}
              </button>
            ))}
            {activePreset === 'custom' && (
              <span className="px-3 py-1.5 rounded-md text-sm bg-slate-800 text-slate-400 border border-slate-600">
                Custom
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300 flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-400" />
                  Volume
                </label>
                <span className="text-sm font-mono text-blue-400">{weights.volume}%</span>
              </div>
              <Slider
                value={[weights.volume]}
                onValueChange={(v) => handleSliderChange('volume', v)}
                min={0}
                max={100}
                step={5}
                className="w-full"
                data-testid="slider-volume"
              />
              <p className="text-xs text-slate-500">Targets, touches, snap share, routes</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  Efficiency
                </label>
                <span className="text-sm font-mono text-yellow-400">{weights.efficiency}%</span>
              </div>
              <Slider
                value={[weights.efficiency]}
                onValueChange={(v) => handleSliderChange('efficiency', v)}
                min={0}
                max={100}
                step={5}
                className="w-full"
                data-testid="slider-efficiency"
              />
              <p className="text-xs text-slate-500">YPRR, EPA, success rate, yards/touch</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-400" />
                  Stability
                </label>
                <span className="text-sm font-mono text-purple-400">{weights.stability}%</span>
              </div>
              <Slider
                value={[weights.stability]}
                onValueChange={(v) => handleSliderChange('stability', v)}
                min={0}
                max={100}
                step={5}
                className="w-full"
                data-testid="slider-stability"
              />
              <p className="text-xs text-slate-500">Week-to-week consistency, floor</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-400" />
                  Context
                </label>
                <span className="text-sm font-mono text-emerald-400">{weights.context}%</span>
              </div>
              <Slider
                value={[weights.context]}
                onValueChange={(v) => handleSliderChange('context', v)}
                min={0}
                max={100}
                step={5}
                className="w-full"
                data-testid="slider-context"
              />
              <p className="text-xs text-slate-500">Team environment, matchups, role fit</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-700">
            <div className="text-xs text-slate-500">
              Alpha Score = weighted blend of sub-scores
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={resetToDefaults}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
                data-testid="button-reset-weights"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-save-weights"
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerRow({ player, rank, weights }: { player: ForgePlayer; rank: number; weights: ForgeWeights }) {
  const adjustedAlpha = recalculateAlpha(player, weights);
  const tierInfo = getTierFromAlpha(adjustedAlpha, player.position);
  const trajectory = getTrajectoryIcon(player.trajectory);

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors" data-testid={`player-row-${player.playerId}`}>
      <td className="py-3 px-4 text-center">
        <span className="text-slate-400 font-mono">{rank}</span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${tierInfo.bg} ${tierInfo.color}`}>
            {tierInfo.tier}
          </span>
          <div>
            <div className="font-medium text-white">{player.playerName}</div>
            <div className="text-xs text-slate-500">{player.nflTeam || 'FA'} • {player.gamesPlayed}G</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl font-bold text-white font-mono">{adjustedAlpha.toFixed(1)}</span>
          <span className={`text-lg ${trajectory.color}`}>{trajectory.icon}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-center hidden md:table-cell">
        <Tooltip>
          <TooltipTrigger>
            <span className="text-blue-400 font-mono">{player.subScores?.volume?.toFixed(0) || '-'}</span>
          </TooltipTrigger>
          <TooltipContent>Volume Score</TooltipContent>
        </Tooltip>
      </td>
      <td className="py-3 px-4 text-center hidden md:table-cell">
        <Tooltip>
          <TooltipTrigger>
            <span className="text-yellow-400 font-mono">{player.subScores?.efficiency?.toFixed(0) || '-'}</span>
          </TooltipTrigger>
          <TooltipContent>Efficiency Score</TooltipContent>
        </Tooltip>
      </td>
      <td className="py-3 px-4 text-center hidden md:table-cell">
        <Tooltip>
          <TooltipTrigger>
            <span className="text-purple-400 font-mono">{player.subScores?.stability?.toFixed(0) || '-'}</span>
          </TooltipTrigger>
          <TooltipContent>Stability Score</TooltipContent>
        </Tooltip>
      </td>
      <td className="py-3 px-4 text-center hidden lg:table-cell">
        <Tooltip>
          <TooltipTrigger>
            <span className="text-emerald-400 font-mono">{player.subScores?.contextFit?.toFixed(0) || '-'}</span>
          </TooltipTrigger>
          <TooltipContent>Context Fit Score</TooltipContent>
        </Tooltip>
      </td>
      <td className="py-3 px-4 text-center hidden lg:table-cell">
        <div className="w-16 bg-slate-700 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full" 
            style={{ width: `${player.confidence || 0}%` }}
          />
        </div>
        <span className="text-xs text-slate-500">{player.confidence || 0}%</span>
      </td>
    </tr>
  );
}

export default function TiberTiers() {
  const [position, setPosition] = useState<Position>('WR');
  const [viewMode, setViewMode] = useState<ViewMode>('season');
  const [weightsCollapsed, setWeightsCollapsed] = useState(false);
  const [weights, setWeights] = useState<ForgeWeights>(DEFAULT_WEIGHTS);
  
  const { currentWeek, isLoading: weekLoading } = useCurrentNFLWeek();
  const displayWeek = currentWeek || 13;

  const { data, isLoading, refetch, isFetching } = useQuery<ForgeBatchResponse>({
    queryKey: ['/api/forge/batch', position, displayWeek, viewMode],
    queryFn: async () => {
      const week = viewMode === 'weekly' ? displayWeek : displayWeek;
      const res = await fetch(`/api/forge/batch?position=${position}&limit=50&season=2025&week=${week}`);
      if (!res.ok) throw new Error('Failed to fetch FORGE data');
      return res.json();
    },
    staleTime: 60000,
  });

  const rankedPlayers = useMemo(() => {
    if (!data?.scores) return [];
    
    return [...data.scores]
      .map(player => ({
        ...player,
        adjustedAlpha: recalculateAlpha(player, weights),
      }))
      .sort((a, b) => b.adjustedAlpha - a.adjustedAlpha);
  }, [data?.scores, weights]);

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      <header className="bg-[#141824] border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" data-testid="button-home">
                  <Home className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Crown className="h-6 w-6 text-purple-400" />
                <h1 className="text-xl font-bold text-white">Tiber Tiers</h1>
                <Badge variant="outline" className="border-purple-500 text-purple-400 text-xs">
                  FORGE v1.1
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <TabsList className="bg-slate-800">
                  <TabsTrigger value="season" className="data-[state=active]:bg-purple-600" data-testid="tab-season">
                    <BarChart3 className="h-4 w-4 mr-1" />
                    Season
                  </TabsTrigger>
                  <TabsTrigger value="weekly" className="data-[state=active]:bg-purple-600" data-testid="tab-weekly">
                    <Calendar className="h-4 w-4 mr-1" />
                    Week {displayWeek}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetch()}
                disabled={isFetching}
                className="border-slate-600"
                data-testid="button-refresh"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <WeightsPanel 
          weights={weights}
          onWeightsChange={setWeights}
          isCollapsed={weightsCollapsed}
          onToggle={() => setWeightsCollapsed(!weightsCollapsed)}
        />

        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {(['WR', 'RB', 'TE', 'QB'] as Position[]).map((pos) => (
              <button
                key={pos}
                onClick={() => setPosition(pos)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
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
          
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Info className="h-4 w-4" />
            <span>{rankedPlayers.length} players ranked</span>
          </div>
        </div>

        <div className="bg-[#141824] border border-gray-800 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-purple-400 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-slate-400">Loading {position} rankings...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="tiers-table">
                <thead className="bg-[#0a0e1a] text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="py-3 px-4 text-center w-16">#</th>
                    <th className="py-3 px-4 text-left">Player</th>
                    <th className="py-3 px-4 text-center">Alpha</th>
                    <th className="py-3 px-4 text-center hidden md:table-cell">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center justify-center gap-1">
                          <Target className="h-3 w-3 text-blue-400" />
                          VOL
                        </TooltipTrigger>
                        <TooltipContent>Volume Score</TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="py-3 px-4 text-center hidden md:table-cell">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center justify-center gap-1">
                          <Zap className="h-3 w-3 text-yellow-400" />
                          EFF
                        </TooltipTrigger>
                        <TooltipContent>Efficiency Score</TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="py-3 px-4 text-center hidden md:table-cell">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center justify-center gap-1">
                          <Activity className="h-3 w-3 text-purple-400" />
                          STB
                        </TooltipTrigger>
                        <TooltipContent>Stability Score</TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="py-3 px-4 text-center hidden lg:table-cell">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center justify-center gap-1">
                          <BarChart3 className="h-3 w-3 text-emerald-400" />
                          CTX
                        </TooltipTrigger>
                        <TooltipContent>Context Fit Score</TooltipContent>
                      </Tooltip>
                    </th>
                    <th className="py-3 px-4 text-center hidden lg:table-cell">Conf</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedPlayers.map((player, index) => (
                    <PlayerRow 
                      key={player.playerId} 
                      player={player} 
                      rank={index + 1}
                      weights={weights}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 text-xs text-slate-500">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-slate-400 mt-0.5" />
            <div>
              <strong className="text-slate-300">Tiber Tiers</strong> are powered by FORGE (Football-Oriented Recursive Grading Engine). 
              Alpha scores (0-100) combine Volume, Efficiency, Stability, and Context sub-scores. 
              Tiers are position-specific thresholds calibrated for cumulative season data.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
