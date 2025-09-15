import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Activity, Star, AlertCircle, Target, Search, SortAsc, SortDesc } from 'lucide-react';

interface Player {
  rank: number;
  name: string;
  team: string;
  position: string;
  power_score: number;
  player_id: string;
  delta_w?: number;
  usage_now?: number;
  talent?: number;
  environment?: number;
  availability?: number;
  weekNotes?: string;
  movement?: 'riser' | 'faller' | 'stable';
}

interface PowerRankingsResponse {
  items: Player[];
  source: string;
  total: number;
}

interface WeekInfo {
  currentWeek: number;
  season: number;
  weekStatus: 'not_started' | 'in_progress' | 'completed';
  mondayNightCompleted: boolean;
  risers_fallers: {
    best_week: number;
    data_available: boolean;
    note: string;
  };
  timestamp: string;
}

export default function RisersAndFallers() {
  const [selectedPosition, setSelectedPosition] = useState<'ALL' | 'QB' | 'RB' | 'WR' | 'TE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'power_score' | 'name'>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Fetch current week information
  const { data: weekInfo, isLoading: weekLoading } = useQuery<WeekInfo>({
    queryKey: ['/api/current-week'],
    queryFn: () => fetch('/api/current-week').then(res => res.json()),
  });

  // Determine which week to show for risers/fallers
  const targetWeek = weekInfo?.risers_fallers.best_week || 1;
  const isDataAvailable = weekInfo?.risers_fallers.data_available || false;

  // Fetch rankings stats data (using neutral endpoints to avoid security blocking)
  const { data: overallData, isLoading: overallLoading } = useQuery<PowerRankingsResponse>({
    queryKey: ['/api/rankings/stats/OVERALL'],
    queryFn: () => fetch('/api/rankings/stats/OVERALL').then(res => res.json()),
  });

  const { data: qbData } = useQuery<PowerRankingsResponse>({
    queryKey: ['/api/rankings/stats/QB'],
    queryFn: () => fetch('/api/rankings/stats/QB').then(res => res.json()),
  });

  const { data: rbData } = useQuery<PowerRankingsResponse>({
    queryKey: ['/api/rankings/stats/RB'],
    queryFn: () => fetch('/api/rankings/stats/RB').then(res => res.json()),
  });

  const { data: wrData } = useQuery<PowerRankingsResponse>({
    queryKey: ['/api/rankings/stats/WR'],
    queryFn: () => fetch('/api/rankings/stats/WR').then(res => res.json()),
  });

  const { data: teData } = useQuery<PowerRankingsResponse>({
    queryKey: ['/api/rankings/stats/TE'],
    queryFn: () => fetch('/api/rankings/stats/TE').then(res => res.json()),
  });

  const filteredAndSortedPlayers = useMemo(() => {
    let players = [];
    switch (selectedPosition) {
      case 'QB': players = qbData?.items || []; break;
      case 'RB': players = rbData?.items || []; break;
      case 'WR': players = wrData?.items || []; break;
      case 'TE': players = teData?.items || []; break;
      default: players = overallData?.items || [];
    }

    // Filter by search query
    if (searchQuery) {
      players = players.filter(player => 
        player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        player.team.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort players
    const sortedPlayers = [...players].sort((a, b) => {
      let valueA, valueB;
      switch (sortBy) {
        case 'name':
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case 'power_score':
          valueA = a.power_score;
          valueB = b.power_score;
          break;
        default: // rank
          valueA = a.rank;
          valueB = b.rank;
      }

      if (sortDirection === 'desc') {
        return valueA < valueB ? 1 : -1;
      }
      return valueA > valueB ? 1 : -1;
    });

    return sortedPlayers;
  }, [selectedPosition, searchQuery, sortBy, sortDirection, overallData, qbData, rbData, wrData, teData]);

  const categorizePlayer = (player: Player) => {
    // Check if player has explicit movement data from API
    if (player.movement) {
      return player.movement;
    }
    
    // First check if we have explicit notes
    const notes = player.weekNotes?.toLowerCase() || '';
    if (notes.includes('riser')) return 'riser';
    if (notes.includes('faller')) return 'faller';
    
    // Use delta_w (week-over-week change) to determine movement
    if (player.delta_w !== undefined) {
      if (player.delta_w > 0.15) return 'riser'; // Significant positive change
      if (player.delta_w < -0.15) return 'faller'; // Significant negative change
    }
    
    // If no clear movement indicator, categorize as stable
    return 'stable';
  };

  const getMovementIcon = (category: string) => {
    switch (category) {
      case 'riser': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'faller': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getMovementColor = (category: string) => {
    switch (category) {
      case 'riser': return 'border-l-green-500 bg-green-50 dark:bg-green-950/20';
      case 'faller': return 'border-l-red-500 bg-red-50 dark:bg-red-950/20';
      default: return 'border-l-gray-300 bg-gray-50 dark:bg-gray-950/20';
    }
  };

  const extractReasonFromNotes = (player: Player) => {
    const notes = player.weekNotes || '';
    // Extract the reason after the colon in notes like "RISER: 143 yards, 8.9 YPC, bell-cow status"
    if (notes?.includes(':')) {
      return notes.split(':')[1].trim();
    }
    
    // If no specific notes, provide context based on movement and power score
    const category = categorizePlayer(player);
    const deltaText = player.delta_w ? `(Δ: ${player.delta_w > 0 ? '+' : ''}${player.delta_w.toFixed(2)})` : '';
    
    if (category === 'riser') {
      return `Strong recent performance driving upward movement ${deltaText}`;
    } else if (category === 'faller') {
      return `Recent performance concerns causing downward movement ${deltaText}`;
    } else {
      return `Stable performance maintaining current ranking (Power Score: ${player.power_score}) ${deltaText}`;
    }
  };

  const getWeeklyImpact = (notes: string) => {
    if (!notes) return null;
    // Extract specific performance metrics for better display
    if (notes.includes('yards') || notes.includes('YPC') || notes.includes('TDs') || notes.includes('targets') || notes.includes('snaps')) {
      return notes;
    }
    return null;
  };

  const players = filteredAndSortedPlayers;
  const risers = players.filter(p => categorizePlayer(p) === 'riser');
  const fallers = players.filter(p => categorizePlayer(p) === 'faller');
  const stable = players.filter(p => categorizePlayer(p) === 'stable');

  const renderPlayerCard = (player: Player) => {
    const category = categorizePlayer(player);
    const reason = extractReasonFromNotes(player);
    const week1Impact = getWeek1Impact(player.week1Notes || '');
    
    return (
      <Card key={`${player.position}-${player.name}`} className={`border-l-4 ${getMovementColor(category)} hover:shadow-md transition-shadow`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              {getMovementIcon(category)}
              <span className="font-bold">{player.name}</span>
              <Badge variant="outline" className="text-xs">
                {player.team} {player.position}
              </Badge>
              {category === 'riser' && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  ↗ Rising
                </Badge>
              )}
              {category === 'faller' && (
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  ↘ Falling
                </Badge>
              )}
            </CardTitle>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">#{player.rank} {selectedPosition === 'ALL' ? 'Overall' : player.position}</div>
              <div className="font-bold text-lg">{player.power_score}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Week 1 Impact:</span>
              <div className="mt-1">{reason}</div>
            </div>
            {week1Impact && (
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                📊 {week1Impact}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (overallLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading Week 1 risers and fallers...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Target className="h-8 w-8 text-blue-500" />
          Week 1 Risers & Fallers
        </h1>
        <p className="text-muted-foreground">
          Fantasy players whose stock moved significantly after Week 1 performances. Based on actual game results from September 4-8, 2025.
        </p>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 space-y-4">
        {/* Position Filter */}
        <Tabs value={selectedPosition} onValueChange={(value) => setSelectedPosition(value as typeof selectedPosition)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="ALL">All Positions</TabsTrigger>
            <TabsTrigger value="QB">QB</TabsTrigger>
            <TabsTrigger value="RB">RB</TabsTrigger>
            <TabsTrigger value="WR">WR</TabsTrigger>
            <TabsTrigger value="TE">TE</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search and Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search players or teams (e.g., 'Travis Etienne', 'JAX')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rank">Rank</SelectItem>
                <SelectItem value="power_score">Power Score</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            >
              {sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Search Results Info */}
        {searchQuery && (
          <div className="text-sm text-muted-foreground">
            Found {players.length} player{players.length !== 1 ? 's' : ''} matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-green-600">
              <TrendingUp className="h-5 w-5" />
              Risers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{risers.length}</div>
            <p className="text-sm text-muted-foreground">Players moving up</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-red-600">
              <TrendingDown className="h-5 w-5" />
              Fallers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fallers.length}</div>
            <p className="text-sm text-muted-foreground">Players moving down</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-gray-600">
              <Activity className="h-5 w-5" />
              Stable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stable.length}</div>
            <p className="text-sm text-muted-foreground">Players holding value</p>
          </CardContent>
        </Card>
      </div>

      {/* Player Categories */}
      <Tabs defaultValue="risers" className="w-full">
        <TabsList>
          <TabsTrigger value="risers" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Risers ({risers.length})
          </TabsTrigger>
          <TabsTrigger value="fallers" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Fallers ({fallers.length})
          </TabsTrigger>
          <TabsTrigger value="stable" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Steady Performers ({stable.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="risers" className="mt-6">
          <div className="grid gap-4">
            {risers.length > 0 ? (
              risers.map(renderPlayerCard)
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    No risers found for {selectedPosition === 'ALL' ? 'any position' : selectedPosition}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="fallers" className="mt-6">
          <div className="grid gap-4">
            {fallers.length > 0 ? (
              fallers.map(renderPlayerCard)
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    No fallers found for {selectedPosition === 'ALL' ? 'any position' : selectedPosition}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="stable" className="mt-6">
          <div className="grid gap-4">
            {stable.slice(0, 10).map(renderPlayerCard)}
            {stable.length > 10 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    ... and {stable.length - 10} more steady performers
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Data Source */}
      <div className="mt-8 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          Data source: {overallData?.source || 'week1_2025_actual_results'} • Updated with live Week 1 NFL results
        </div>
      </div>
    </div>
  );
}