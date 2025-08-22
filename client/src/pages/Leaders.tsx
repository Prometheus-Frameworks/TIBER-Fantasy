import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MetricConfig {
  value: string;
  label: string;
  live: boolean;
  advanced?: boolean;
  planned?: boolean;
}

// Position-specific metrics (aligned with backend)
const METRICS_BY_POSITION: Record<string, MetricConfig[]> = {
  RB: [
    { value: 'rush_yards', label: 'Rush Yards', live: true },
    { value: 'rush_att', label: 'Rush Attempts', live: true },
    { value: 'rush_ypc', label: 'Yards Per Carry', live: true },
    { value: 'targets', label: 'Targets', live: true },
    { value: 'rec_yards', label: 'Receiving Yards', live: true },
    { value: 'td_total', label: 'Total TDs', live: true },
    { value: 'fpts', label: 'Fantasy Pts', live: true },
    { value: 'fpts_ppr', label: 'PPR Fantasy Pts', live: true },
    { value: 'rush_expl_10p', label: 'Explosive Rush %', live: true, advanced: true },
    { value: 'rush_yac_per_att', label: 'YAC Per Rush', live: false, planned: true },
    { value: 'rush_mtf', label: 'Missed Tackles Forced', live: false, planned: true }
  ],
  WR: [
    { value: 'targets', label: 'Targets', live: true },
    { value: 'receptions', label: 'Receptions', live: true },
    { value: 'rec_yards', label: 'Receiving Yards', live: true },
    { value: 'rec_tds', label: 'Receiving TDs', live: true },
    { value: 'fpts', label: 'Fantasy Pts', live: true },
    { value: 'fpts_ppr', label: 'PPR Fantasy Pts', live: true },
    { value: 'adot', label: 'aDOT', live: true, advanced: true },
    { value: 'racr', label: 'RACR', live: true, advanced: true },
    { value: 'target_share', label: 'Target Share', live: true, advanced: true },
    { value: 'wopr', label: 'WOPR', live: true, advanced: true },
    { value: 'yprr', label: 'YPRR', live: false, planned: true }
  ],
  TE: [
    { value: 'targets', label: 'Targets', live: true },
    { value: 'receptions', label: 'Receptions', live: true },
    { value: 'rec_yards', label: 'Receiving Yards', live: true },
    { value: 'rec_tds', label: 'Receiving TDs', live: true },
    { value: 'fpts', label: 'Fantasy Pts', live: true },
    { value: 'fpts_ppr', label: 'PPR Fantasy Pts', live: true },
    { value: 'target_share', label: 'Target Share', live: true, advanced: true },
    { value: 'yprr', label: 'YPRR', live: false, planned: true }
  ],
  QB: [
    { value: 'cmp_pct', label: 'Completion %', live: true },
    { value: 'pass_yards', label: 'Pass Yards', live: true },
    { value: 'pass_tds', label: 'Pass TDs', live: true },
    { value: 'int', label: 'Interceptions', live: true },
    { value: 'ypa', label: 'Yards Per Attempt', live: true },
    { value: 'qb_rush_yards', label: 'Rush Yards', live: true },
    { value: 'qb_rush_tds', label: 'Rush TDs', live: true },
    { value: 'fpts', label: 'Fantasy Pts', live: true },
    { value: 'aypa', label: 'AYPA', live: true, advanced: true },
    { value: 'epa_per_play', label: 'EPA per Play', live: true, advanced: true }
  ]
};

// Default metrics per position
const DEFAULT_METRICS = {
  RB: 'rush_yards',
  WR: 'targets', 
  TE: 'targets',
  QB: 'pass_tds'
};

// Team logo mapping (simplified for now - could be expanded)
const TEAM_COLORS: Record<string, string> = {
  'KC': '#E31837', 'BUF': '#00338D', 'MIA': '#008E97', 'NYJ': '#125740',
  'BAL': '#241773', 'CIN': '#FB4F14', 'CLE': '#311D00', 'PIT': '#FFB612',
  'HOU': '#03202F', 'IND': '#002C5F', 'JAX': '#006778', 'TEN': '#4B92DB',
  'DEN': '#FB4F14', 'LV': '#000000', 'LAC': '#0080C6',
  'DAL': '#003594', 'NYG': '#0B2265', 'PHI': '#004C54', 'WAS': '#5A1414',
  'CHI': '#0B162A', 'DET': '#0076B6', 'GB': '#203731', 'MIN': '#4F2683',
  'ATL': '#A71930', 'CAR': '#0085CA', 'NO': '#D3BC8D', 'TB': '#D50A0A',
  'ARI': '#97233F', 'LA': '#003594', 'SF': '#AA0000', 'SEA': '#002244'
};

interface PlayerData {
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  games: number;
  [key: string]: any;
}

interface LeadersResponse {
  success: boolean;
  data: {
    rows: PlayerData[];
  };
  mode?: string;
  count: number;
  filters: {
    position: string;
    metric: string;
    limit: number;
    direction: string;
    min_games: number;
  };
}

export default function Leaders() {
  const [location, navigate] = useLocation();
  const [position, setPosition] = useState('RB');
  const [metric, setMetric] = useState(DEFAULT_METRICS.RB);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [limit, setLimit] = useState(50);
  const [minGames, setMinGames] = useState(8);
  const [searchQuery, setSearchQuery] = useState('');

  // URL state management
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    const urlPosition = params.get('position') || 'RB';
    const urlMetric = params.get('metric') || DEFAULT_METRICS[urlPosition as keyof typeof DEFAULT_METRICS];
    const urlDir = params.get('dir') || 'desc';
    const urlLimit = params.get('limit') || '50';
    const urlMinGames = params.get('min_games') || '8';
    
    setPosition(urlPosition);
    setMetric(urlMetric);
    setSortDir(urlDir as 'asc' | 'desc');
    setLimit(parseInt(urlLimit));
    setMinGames(parseInt(urlMinGames));
  }, [location]);

  // Update URL when params change
  const updateURL = (newParams: any) => {
    const params = new URLSearchParams();
    params.set('position', newParams.position || position);
    params.set('metric', newParams.metric || metric);
    params.set('dir', newParams.sortDir || sortDir);
    params.set('limit', String(newParams.limit || limit));
    params.set('min_games', String(newParams.minGames || minGames));
    navigate(`/leaders?${params.toString()}`);
  };

  // Determine which API endpoint to use
  const isAdvancedMetric = METRICS_BY_POSITION[position as keyof typeof METRICS_BY_POSITION]
    ?.find(m => m.value === metric)?.advanced;
  
  const apiEndpoint = isAdvancedMetric ? '/api/stats/2024/leaderboard-advanced' : '/api/stats/2024/leaderboard';

  const { data, isLoading, error } = useQuery<LeadersResponse>({
    queryKey: [apiEndpoint, position, metric, sortDir, limit, minGames],
    queryFn: async () => {
      const params = new URLSearchParams({
        position,
        metric,
        dir: sortDir,
        limit: String(limit),
        min_games: String(minGames)
      });
      
      const response = await fetch(`${apiEndpoint}?${params}`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard data');
      return response.json();
    },
  });

  const handlePositionChange = (newPosition: string) => {
    const newMetric = DEFAULT_METRICS[newPosition as keyof typeof DEFAULT_METRICS];
    setPosition(newPosition);
    setMetric(newMetric);
    updateURL({ position: newPosition, metric: newMetric });
  };

  const handleMetricChange = (newMetric: string) => {
    setMetric(newMetric);
    updateURL({ metric: newMetric });
  };

  const handleSortToggle = () => {
    const newDir = sortDir === 'desc' ? 'asc' : 'desc';
    setSortDir(newDir);
    updateURL({ sortDir: newDir });
  };

  const formatValue = (value: any, metricKey: string): string => {
    if (value === null || value === undefined) return '—';
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '—';

    // Percentage metrics
    if (metricKey.includes('_pct') || metricKey === 'cmp_pct') {
      return `${(numValue * 100).toFixed(1)}%`;
    }
    
    // Share metrics (display as percentage)
    if (metricKey.includes('share') || metricKey === 'rush_expl_10p') {
      return `${(numValue * 100).toFixed(1)}%`;
    }

    // Rate metrics (2 decimal places)
    if (metricKey === 'ypc' || metricKey === 'ypa' || metricKey === 'aypa' || 
        metricKey === 'racr' || metricKey === 'wopr' || metricKey === 'adot' ||
        metricKey === 'epa_per_play' || metricKey === 'yprr') {
      return numValue.toFixed(2);
    }

    // Counting stats (no decimals)
    return Math.round(numValue).toLocaleString();
  };

  const filteredData = data?.data?.rows?.filter(player =>
    searchQuery === '' || 
    player.player_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.team.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const currentMetrics = METRICS_BY_POSITION[position] || [];
  const liveMetrics = currentMetrics.filter(m => m.live);
  const plannedMetrics = currentMetrics.filter(m => m.planned);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white">
            2024 NFL Leaders
          </h1>
          <p className="text-lg text-gray-300">
            Complete player statistics and advanced metrics for the 2024 season
          </p>
        </div>

        {/* Position Tabs */}
        <Tabs value={position} onValueChange={handlePositionChange} className="w-full">
          <div className="flex justify-center">
            <TabsList className="grid w-full max-w-md grid-cols-4 bg-slate-800/50">
              <TabsTrigger value="RB" className="data-[state=active]:bg-purple-600">RB</TabsTrigger>
              <TabsTrigger value="WR" className="data-[state=active]:bg-purple-600">WR</TabsTrigger>
              <TabsTrigger value="TE" className="data-[state=active]:bg-purple-600">TE</TabsTrigger>
              <TabsTrigger value="QB" className="data-[state=active]:bg-purple-600">QB</TabsTrigger>
            </TabsList>
          </div>

          {['RB', 'WR', 'TE', 'QB'].map((pos) => (
            <TabsContent key={pos} value={pos} className="space-y-6">
              
              {/* Controls */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    
                    {/* Metric Selection */}
                    <div className="flex items-center space-x-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Metric</label>
                        <Select value={metric} onValueChange={handleMetricChange}>
                          <SelectTrigger className="w-48 bg-slate-700 border-slate-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-700 border-slate-600">
                            {liveMetrics.length > 0 && (
                              <div>
                                {liveMetrics.map((m) => (
                                  <SelectItem key={m.value} value={m.value}>
                                    <div className="flex items-center space-x-2">
                                      <span>{m.label}</span>
                                      {m.advanced && <Badge variant="secondary" className="text-xs bg-purple-600/20 text-purple-300">PBP</Badge>}
                                    </div>
                                  </SelectItem>
                                ))}
                              </div>
                            )}
                            {plannedMetrics.length > 0 && (
                              <div>
                                <div className="px-2 py-1 text-xs text-gray-400 border-t border-slate-600 mt-1">Coming Soon</div>
                                {plannedMetrics.map((m) => (
                                  <SelectItem key={m.value} value={m.value} disabled className="opacity-50">
                                    <div className="flex items-center space-x-2">
                                      <span>{m.label}</span>
                                      <Badge variant="outline" className="text-xs">NGS</Badge>
                                    </div>
                                  </SelectItem>
                                ))}
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Sort Direction */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Sort</label>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleSortToggle}
                          className="bg-slate-700 border-slate-600 hover:bg-slate-600"
                        >
                          {sortDir === 'desc' ? (
                            <>
                              <ArrowDown className="h-4 w-4 mr-1" />
                              High to Low
                            </>
                          ) : (
                            <>
                              <ArrowUp className="h-4 w-4 mr-1" />
                              Low to High
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Search */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">Search</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Player name or team..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 w-64 bg-slate-700 border-slate-600"
                        />
                      </div>
                    </div>
                    
                  </div>
                </CardHeader>
              </Card>

              {/* Results */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-white">
                      {position} Leaders - {currentMetrics.find(m => m.value === metric)?.label}
                    </CardTitle>
                    <div className="text-sm text-gray-400">
                      {filteredData.length} players • Min {minGames} games
                      {data?.mode && (
                        <Badge variant="secondary" className="ml-2 bg-purple-600/20 text-purple-300">
                          {data.mode === 'advanced_pbp_derived' ? 'PBP Data' : 'Season Stats'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                    </div>
                  ) : error ? (
                    <div className="text-center py-12 text-red-400">
                      Error loading data: {error.message}
                    </div>
                  ) : filteredData.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      No players found matching your criteria
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Header */}
                      <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-gray-400 border-b border-slate-600">
                        <div className="col-span-1 text-center">Rank</div>
                        <div className="col-span-4">Player</div>
                        <div className="col-span-1 text-center">Team</div>
                        <div className="col-span-1 text-center">G</div>
                        <div className="col-span-2 text-center">{currentMetrics.find(m => m.value === metric)?.label}</div>
                        <div className="col-span-3 text-center">Season Stats</div>
                      </div>
                      
                      {/* Players */}
                      {filteredData.map((player, index) => (
                        <div 
                          key={player.player_id} 
                          className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-slate-700/30 rounded-lg transition-colors"
                        >
                          <div className="col-span-1 text-center font-bold text-gray-300">
                            {index + 1}
                          </div>
                          <div className="col-span-4">
                            <div className="font-medium text-white">{player.player_name}</div>
                            <div className="text-sm text-gray-400">{player.position}</div>
                          </div>
                          <div className="col-span-1 text-center">
                            <span 
                              className="inline-block w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center"
                              style={{ backgroundColor: TEAM_COLORS[player.team] || '#6B7280' }}
                            >
                              {player.team}
                            </span>
                          </div>
                          <div className="col-span-1 text-center text-gray-300">
                            {player.games || '—'}
                          </div>
                          <div className="col-span-2 text-center font-bold text-white text-lg">
                            {formatValue(player[metric], metric)}
                          </div>
                          <div className="col-span-3 text-center text-sm text-gray-400 space-x-2">
                            {position === 'RB' && (
                              <span>{formatValue(player.fpts_ppr, 'fpts_ppr')} PPR • {formatValue(player.rush_yards, 'rush_yards')} Rush</span>
                            )}
                            {(position === 'WR' || position === 'TE') && (
                              <span>{formatValue(player.fpts_ppr, 'fpts_ppr')} PPR • {formatValue(player.targets, 'targets')} Tgts</span>
                            )}
                            {position === 'QB' && (
                              <span>{formatValue(player.fpts, 'fpts')} Pts • {formatValue(player.pass_yards, 'pass_yards')} Pass</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

            </TabsContent>
          ))}
        </Tabs>

      </div>
    </div>
  );
}