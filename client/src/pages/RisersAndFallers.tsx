import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Activity, Star, AlertCircle, Target } from 'lucide-react';

interface Player {
  rank: number;
  name: string;
  team: string;
  position: string;
  power_score: number;
  week1Notes?: string;
}

interface PowerRankingsResponse {
  items: Player[];
  source: string;
  total: number;
}

export default function RisersAndFallers() {
  const [selectedPosition, setSelectedPosition] = useState<'ALL' | 'QB' | 'RB' | 'WR' | 'TE'>('ALL');

  // Fetch power rankings data
  const { data: overallData, isLoading: overallLoading } = useQuery<PowerRankingsResponse>({
    queryKey: ['/api/power/OVERALL'],
    queryFn: () => fetch('/api/power/OVERALL').then(res => res.json()),
  });

  const { data: qbData } = useQuery<PowerRankingsResponse>({
    queryKey: ['/api/power/QB'],
    queryFn: () => fetch('/api/power/QB').then(res => res.json()),
  });

  const { data: rbData } = useQuery<PowerRankingsResponse>({
    queryKey: ['/api/power/RB'],
    queryFn: () => fetch('/api/power/RB').then(res => res.json()),
  });

  const { data: wrData } = useQuery<PowerRankingsResponse>({
    queryKey: ['/api/power/WR'],
    queryFn: () => fetch('/api/power/WR').then(res => res.json()),
  });

  const { data: teData } = useQuery<PowerRankingsResponse>({
    queryKey: ['/api/power/TE'],
    queryFn: () => fetch('/api/power/TE').then(res => res.json()),
  });

  const getPositionData = () => {
    switch (selectedPosition) {
      case 'QB': return qbData?.items || [];
      case 'RB': return rbData?.items || [];
      case 'WR': return wrData?.items || [];
      case 'TE': return teData?.items || [];
      default: return overallData?.items || [];
    }
  };

  const categorizePlayer = (player: Player) => {
    const notes = player.week1Notes?.toLowerCase() || '';
    if (notes.includes('riser')) return 'riser';
    if (notes.includes('faller')) return 'faller';
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

  const extractReasonFromNotes = (notes: string) => {
    // Extract the reason after the colon in notes like "RISER: 143 yards, 8.9 YPC, bell-cow status"
    if (notes?.includes(':')) {
      return notes.split(':')[1].trim();
    }
    return notes || 'No specific notes';
  };

  const players = getPositionData();
  const risers = players.filter(p => categorizePlayer(p) === 'riser');
  const fallers = players.filter(p => categorizePlayer(p) === 'faller');
  const stable = players.filter(p => categorizePlayer(p) === 'stable');

  const renderPlayerCard = (player: Player) => {
    const category = categorizePlayer(player);
    const reason = extractReasonFromNotes(player.week1Notes || '');
    
    return (
      <Card key={`${player.position}-${player.name}`} className={`border-l-4 ${getMovementColor(category)}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              {getMovementIcon(category)}
              {player.name}
              <Badge variant="outline" className="text-xs">
                {player.team} {player.position}
              </Badge>
            </CardTitle>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">#{player.rank} Overall</div>
              <div className="font-bold text-lg">{player.power_score}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-2">
            <strong>Week 1 Impact:</strong>
          </div>
          <div className="text-sm">
            {reason}
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

      {/* Position Filter */}
      <div className="mb-6">
        <Tabs value={selectedPosition} onValueChange={(value) => setSelectedPosition(value as typeof selectedPosition)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="ALL">All Positions</TabsTrigger>
            <TabsTrigger value="QB">QB</TabsTrigger>
            <TabsTrigger value="RB">RB</TabsTrigger>
            <TabsTrigger value="WR">WR</TabsTrigger>
            <TabsTrigger value="TE">TE</TabsTrigger>
          </TabsList>
        </Tabs>
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