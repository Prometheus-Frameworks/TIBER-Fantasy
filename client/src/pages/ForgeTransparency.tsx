import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useCurrentNFLWeek } from '@/hooks/useCurrentNFLWeek';
import {
  Home,
  Search,
  Calendar,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Activity,
  BarChart3,
  Target,
  Shield,
  Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

type Position = 'QB' | 'RB' | 'WR' | 'TE';

interface TransparencyPillar {
  score: number;
  weight: number;
  metrics: {
    name: string;
    key: string;
    rawValue: number | null;
    weight: number;
    source: string;
    inverted: boolean;
  }[];
}

interface TransparencyResponse {
  success: boolean;
  player: {
    id: string;
    name: string;
    position: Position;
    team: string;
  };
  season: number;
  week: number;
  mode: string;
  gamesPlayed: number;
  alphaFinal: number;
  alphaRaw: number;
  tier: string;
  pillars: {
    volume: TransparencyPillar;
    efficiency: TransparencyPillar;
    teamContext: TransparencyPillar;
    stability: TransparencyPillar;
  };
  recursion: {
    pass0Alpha: number;
    pass1Alpha: number;
    alphaPrev: number | null;
    expectedAlpha: number | null;
    surprise: number | null;
    volatility: number | null;
    momentum: number | null;
    stabilityAdjustment: number | null;
    isFirstWeek: boolean;
  };
  weeklyHistory: { week: number; alpha: number; alphaRaw: number }[];
  issues: { code: string; message: string; severity: string }[];
  summary: string;
}

interface SearchResult {
  playerId: string;
  displayName: string;
  position: string;
  currentTeam: string;
}

const POSITION_COLORS: Record<Position, string> = {
  QB: 'bg-red-500',
  RB: 'bg-green-500',
  WR: 'bg-blue-500',
  TE: 'bg-yellow-500',
};

const TIER_COLORS: Record<string, string> = {
  T1: 'text-green-400 border-green-400',
  T2: 'text-emerald-400 border-emerald-400',
  T3: 'text-yellow-400 border-yellow-400',
  T4: 'text-orange-400 border-orange-400',
  T5: 'text-red-400 border-red-400',
};

function getAlphaColor(alpha: number): string {
  if (alpha >= 85) return 'text-green-400';
  if (alpha >= 70) return 'text-emerald-400';
  if (alpha >= 55) return 'text-yellow-400';
  if (alpha >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getAlphaGradient(alpha: number): string {
  if (alpha >= 85) return 'from-green-500 to-emerald-500';
  if (alpha >= 70) return 'from-emerald-500 to-teal-500';
  if (alpha >= 55) return 'from-yellow-500 to-amber-500';
  if (alpha >= 40) return 'from-orange-500 to-red-500';
  return 'from-red-500 to-red-700';
}

export default function ForgeTransparency() {
  const { season } = useCurrentNFLWeek();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPlayerName, setSelectedPlayerName] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('17');
  const [expandedPillars, setExpandedPillars] = useState<Record<string, boolean>>({
    volume: true,
    efficiency: true,
    teamContext: false,
    stability: false,
  });

  // Search players
  const { data: searchResults = [], isLoading: searchLoading } = useQuery<SearchResult[]>({
    queryKey: ['/api/forge/search-players', searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 2) return [];
      const res = await fetch(`/api/forge/search-players?query=${encodeURIComponent(searchTerm)}&limit=10`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: searchTerm.length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch transparency data
  const { data: transparencyData, isLoading: dataLoading, error } = useQuery<TransparencyResponse>({
    queryKey: ['/api/forge/transparency', selectedPlayerId, selectedWeek],
    queryFn: async () => {
      const res = await fetch(
        `/api/forge/transparency/${selectedPlayerId}?week=${selectedWeek}&season=${season}`
      );
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch transparency data');
      }
      return res.json();
    },
    enabled: !!selectedPlayerId,
    staleTime: 1000 * 60 * 2,
  });

  const handlePlayerSelect = (player: SearchResult) => {
    setSelectedPlayerId(player.playerId);
    setSelectedPlayerName(player.displayName);
    setSearchTerm(player.displayName);
    setSearchOpen(false);
  };

  const togglePillar = (pillar: string) => {
    setExpandedPillars(prev => ({ ...prev, [pillar]: !prev[pillar] }));
  };

  const renderPillarCard = (
    name: string,
    key: string,
    pillar: TransparencyPillar,
    icon: React.ReactNode
  ) => {
    const isExpanded = expandedPillars[key];

    return (
      <Card className="bg-[#141824] border-slate-700 p-4">
        <button
          onClick={() => togglePillar(key)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-800">{icon}</div>
            <div className="text-left">
              <div className="text-sm text-slate-400">{name}</div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-white">{pillar.score.toFixed(1)}</span>
                <span className="text-xs text-slate-500">({pillar.weight}%)</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${getAlphaGradient(pillar.score)}`}
                style={{ width: `${pillar.score}%` }}
              />
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
            {pillar.metrics.map((metric, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">{metric.name}</span>
                  {metric.inverted && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-slate-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Lower is better (inverted)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-300 font-mono">
                    {metric.rawValue !== null ?
                      (typeof metric.rawValue === 'number' ? metric.rawValue.toFixed(2) : metric.rawValue)
                      : 'N/A'}
                  </span>
                  <span className="text-xs text-slate-500 w-10 text-right">{metric.weight}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0a0e1a]/95 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <a className="text-slate-400 hover:text-white transition-colors">
                  <Home className="h-5 w-5" />
                </a>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white">FORGE Transparency</h1>
                <p className="text-xs text-slate-500">
                  Football-Oriented Recursive Grading Engine
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-purple-400 border-purple-400">
              See exactly how every score is calculated
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Controls Row */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Player Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search for a player..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              className="pl-10 bg-[#141824] border-slate-700 text-white placeholder:text-slate-500"
            />
            {searchOpen && searchResults.length > 0 && (
              <Card className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#141824] border-slate-700 max-h-64 overflow-y-auto">
                {searchResults.map((player) => (
                  <button
                    key={player.playerId}
                    onClick={() => handlePlayerSelect(player)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-800 transition-colors text-left"
                  >
                    <Badge className={`${POSITION_COLORS[player.position as Position]} text-white text-xs`}>
                      {player.position}
                    </Badge>
                    <span className="text-white">{player.displayName}</span>
                    <span className="text-slate-500 text-sm">{player.currentTeam}</span>
                  </button>
                ))}
              </Card>
            )}
          </div>

          {/* Week Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-32 bg-[#141824] border-slate-700 text-white">
                <SelectValue placeholder="Week" />
              </SelectTrigger>
              <SelectContent className="bg-[#141824] border-slate-700">
                {Array.from({ length: 17 }, (_, i) => i + 1).map((week) => (
                  <SelectItem key={week} value={week.toString()} className="text-white">
                    Week {week}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Empty State */}
        {!selectedPlayerId && (
          <Card className="bg-[#141824] border-slate-700 p-12 text-center">
            <Search className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Search for a Player
            </h2>
            <p className="text-slate-400 max-w-md mx-auto">
              Type a player's name above to see exactly how their FORGE score is calculated.
              No black box. Complete transparency.
            </p>
          </Card>
        )}

        {/* Loading State */}
        {selectedPlayerId && dataLoading && (
          <Card className="bg-[#141824] border-slate-700 p-12 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-slate-400">Loading transparency data...</p>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="bg-[#141824] border-slate-700 border-red-500/50 p-6">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <span>{(error as Error).message}</span>
            </div>
          </Card>
        )}

        {/* Transparency Data */}
        {transparencyData && transparencyData.success && (
          <div className="space-y-6">
            {/* Alpha Score Hero */}
            <Card className="bg-[#141824] border-slate-700 p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <Badge className={`${POSITION_COLORS[transparencyData.player.position]} text-white`}>
                      {transparencyData.player.position}
                    </Badge>
                    <span className="text-slate-400 text-sm">{transparencyData.player.team}</span>
                    <Badge variant="outline" className={TIER_COLORS[transparencyData.tier] || 'text-slate-400 border-slate-400'}>
                      {transparencyData.tier}
                    </Badge>
                  </div>
                  <h2 className="text-3xl font-bold text-white">{transparencyData.player.name}</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Week {transparencyData.week} | {transparencyData.gamesPlayed} games played
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-5xl font-bold ${getAlphaColor(transparencyData.alphaFinal)}`}>
                    {transparencyData.alphaFinal.toFixed(1)}
                  </div>
                  <div className="text-slate-500 text-sm">Alpha Score</div>
                </div>
              </div>

              {/* Alpha Bar */}
              <div className="mt-6">
                <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${getAlphaGradient(transparencyData.alphaFinal)} transition-all duration-500`}
                    style={{ width: `${transparencyData.alphaFinal}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
              </div>
            </Card>

            {/* Pillar Breakdown */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-400" />
                Pillar Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderPillarCard('Volume', 'volume', transparencyData.pillars.volume,
                  <Target className="h-5 w-5 text-blue-400" />)}
                {renderPillarCard('Efficiency', 'efficiency', transparencyData.pillars.efficiency,
                  <Zap className="h-5 w-5 text-green-400" />)}
                {renderPillarCard('Team Context', 'teamContext', transparencyData.pillars.teamContext,
                  <Activity className="h-5 w-5 text-yellow-400" />)}
                {renderPillarCard('Stability', 'stability', transparencyData.pillars.stability,
                  <Shield className="h-5 w-5 text-purple-400" />)}
              </div>
            </div>

            {/* Recursive Adjustments */}
            <Card className="bg-[#141824] border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-400" />
                Recursive Adjustments
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Raw Alpha (Pass 0)</div>
                  <div className="text-xl font-bold text-white">
                    {transparencyData.recursion.pass0Alpha.toFixed(1)}
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Volatility</div>
                  <div className="text-xl font-bold text-white">
                    {transparencyData.recursion.volatility?.toFixed(1) ?? 'N/A'}
                  </div>
                  {transparencyData.recursion.volatility !== null && (
                    <div className="text-xs text-slate-400">
                      {transparencyData.recursion.volatility < 5 ? '(stable)' :
                       transparencyData.recursion.volatility > 10 ? '(volatile)' : '(moderate)'}
                    </div>
                  )}
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Momentum</div>
                  <div className={`text-xl font-bold flex items-center gap-1 ${
                    (transparencyData.recursion.momentum ?? 0) > 0 ? 'text-green-400' :
                    (transparencyData.recursion.momentum ?? 0) < 0 ? 'text-red-400' : 'text-white'
                  }`}>
                    {transparencyData.recursion.momentum !== null ? (
                      <>
                        {transparencyData.recursion.momentum > 0 && '+'}
                        {transparencyData.recursion.momentum.toFixed(1)}
                        {transparencyData.recursion.momentum > 2 && <TrendingUp className="h-4 w-4" />}
                        {transparencyData.recursion.momentum < -2 && <TrendingDown className="h-4 w-4" />}
                        {Math.abs(transparencyData.recursion.momentum) <= 2 && <Minus className="h-4 w-4" />}
                      </>
                    ) : 'N/A'}
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">Stability Adj.</div>
                  <div className={`text-xl font-bold ${
                    (transparencyData.recursion.stabilityAdjustment ?? 0) > 0 ? 'text-green-400' :
                    (transparencyData.recursion.stabilityAdjustment ?? 0) < 0 ? 'text-red-400' : 'text-white'
                  }`}>
                    {transparencyData.recursion.stabilityAdjustment !== null ? (
                      `${transparencyData.recursion.stabilityAdjustment > 0 ? '+' : ''}${transparencyData.recursion.stabilityAdjustment.toFixed(1)}`
                    ) : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Math breakdown */}
              <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-700/50">
                <div className="text-sm text-slate-400 mb-2">Score Calculation:</div>
                <div className="font-mono text-sm text-white flex flex-wrap items-center gap-2">
                  <span className="bg-slate-800 px-2 py-1 rounded">
                    Raw: {transparencyData.recursion.pass0Alpha.toFixed(1)}
                  </span>
                  <span className="text-slate-500">+</span>
                  <span className="bg-slate-800 px-2 py-1 rounded">
                    Adj: {transparencyData.recursion.stabilityAdjustment !== null ?
                      `${transparencyData.recursion.stabilityAdjustment > 0 ? '+' : ''}${transparencyData.recursion.stabilityAdjustment.toFixed(1)}` : '0'}
                  </span>
                  <span className="text-slate-500">=</span>
                  <span className={`bg-gradient-to-r ${getAlphaGradient(transparencyData.alphaFinal)} px-3 py-1 rounded font-bold`}>
                    Final: {transparencyData.alphaFinal.toFixed(1)}
                  </span>
                </div>
              </div>

              {transparencyData.recursion.isFirstWeek && (
                <div className="mt-4 text-sm text-slate-500 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  First week of data - no historical context for recursion adjustments.
                </div>
              )}
            </Card>

            {/* Weekly Trend Chart */}
            {transparencyData.weeklyHistory.length > 1 && (
              <Card className="bg-[#141824] border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-400" />
                  Weekly Trend
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={transparencyData.weeklyHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="week"
                        stroke="#64748b"
                        tickFormatter={(week) => `W${week}`}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke="#64748b"
                        tickFormatter={(val) => val.toFixed(0)}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #475569',
                          borderRadius: '8px',
                        }}
                        labelFormatter={(week) => `Week ${week}`}
                        formatter={(value: number, name: string) => [
                          value.toFixed(1),
                          name === 'alpha' ? 'Final Alpha' : 'Raw Alpha',
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="alpha"
                        stroke="#a855f7"
                        strokeWidth={2}
                        dot={{ fill: '#a855f7', strokeWidth: 0, r: 4 }}
                        activeDot={{ r: 6, fill: '#a855f7' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* Football Lens Issues */}
            {transparencyData.issues.length > 0 && (
              <Card className="bg-[#141824] border-slate-700 border-yellow-500/30 p-6">
                <h3 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Football Lens Flags
                </h3>
                <div className="space-y-2">
                  {transparencyData.issues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        issue.severity === 'block' ? 'bg-red-900/20 border border-red-700/50' :
                        issue.severity === 'warn' ? 'bg-yellow-900/20 border border-yellow-700/50' :
                        'bg-slate-800/50'
                      }`}
                    >
                      <Badge variant="outline" className={
                        issue.severity === 'block' ? 'text-red-400 border-red-400' :
                        issue.severity === 'warn' ? 'text-yellow-400 border-yellow-400' :
                        'text-slate-400 border-slate-400'
                      }>
                        {issue.code}
                      </Badge>
                      <span className="text-slate-300 text-sm">{issue.message}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Plain English Summary */}
            <Card className="bg-[#141824] border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Info className="h-5 w-5 text-purple-400" />
                Why This Score?
              </h3>
              <p className="text-slate-300 leading-relaxed">{transparencyData.summary}</p>
            </Card>

            {/* Footer Note */}
            <div className="text-center text-xs text-slate-600 pb-8">
              FORGE v0.2 | Transparency Mode | Week {transparencyData.week} | Season {transparencyData.season}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
