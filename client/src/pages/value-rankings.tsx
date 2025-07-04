import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Target, AlertTriangle } from "lucide-react";

interface PlayerRanking {
  player: {
    id: number;
    name: string;
    position: string;
    team: string;
    avgPoints: number;
  };
  ourOverallRank: number;
  ourPositionRank: number;
  consensusADP: number;
  consensusPositionRank: number;
  adpDifference: number;
  positionDifference: number;
  valueCategory: 'STEAL' | 'VALUE' | 'FAIR' | 'OVERVALUED' | 'AVOID';
  analyticsScore: number;
  reasoning: string[];
  confidence: number;
}

export default function ValueRankings() {
  const { data: rankings, isLoading, error } = useQuery({
    queryKey: ['/api/rankings/comparison'],
  });

  const getValueColor = (category: string) => {
    switch (category) {
      case 'STEAL': return 'bg-green-600 text-white';
      case 'VALUE': return 'bg-blue-600 text-white';
      case 'FAIR': return 'bg-gray-600 text-white';
      case 'OVERVALUED': return 'bg-orange-600 text-white';
      case 'AVOID': return 'bg-red-600 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  const getValueIcon = (category: string) => {
    switch (category) {
      case 'STEAL':
      case 'VALUE': return <TrendingUp className="h-4 w-4" />;
      case 'OVERVALUED':
      case 'AVOID': return <TrendingDown className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const filterByCategory = (rankings: PlayerRanking[], category: string) => {
    return rankings?.filter(r => r.valueCategory === category) || [];
  };

  const filterByPosition = (rankings: PlayerRanking[], position: string) => {
    return rankings?.filter(r => r.player.position === position) || [];
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mb-4"></div>
          <p>Calculating value rankings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">Failed to load rankings</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Value Rankings</h1>
        <p className="text-gray-600">
          Our analytics-based rankings vs consensus ADP - find the steals and avoid the busts
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {filterByCategory(rankings, 'STEAL').length}
            </div>
            <div className="text-sm text-gray-600">Steals</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {filterByCategory(rankings, 'VALUE').length}
            </div>
            <div className="text-sm text-gray-600">Values</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">
              {filterByCategory(rankings, 'FAIR').length}
            </div>
            <div className="text-sm text-gray-600">Fair</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {filterByCategory(rankings, 'OVERVALUED').length}
            </div>
            <div className="text-sm text-gray-600">Overvalued</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {filterByCategory(rankings, 'AVOID').length}
            </div>
            <div className="text-sm text-gray-600">Avoid</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="steals" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="steals">Steals</TabsTrigger>
          <TabsTrigger value="values">Values</TabsTrigger>
          <TabsTrigger value="qb">QBs</TabsTrigger>
          <TabsTrigger value="rb">RBs</TabsTrigger>
          <TabsTrigger value="wr">WRs</TabsTrigger>
          <TabsTrigger value="te">TEs</TabsTrigger>
        </TabsList>

        <TabsContent value="steals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Draft Steals
              </CardTitle>
              <CardDescription>
                Players being drafted significantly later than our analytics suggest
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filterByCategory(rankings, 'STEAL').map((ranking, index) => (
                  <div key={ranking.player.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {ranking.player.name} - {ranking.player.team} {ranking.player.position}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {ranking.player.avgPoints.toFixed(1)} PPG • {ranking.analyticsScore}/100 Analytics Score
                        </p>
                      </div>
                      <Badge className={getValueColor(ranking.valueCategory)}>
                        {getValueIcon(ranking.valueCategory)}
                        {ranking.valueCategory}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div className="text-center p-2 bg-green-50 rounded">
                        <div className="font-bold text-green-800">#{ranking.ourOverallRank}</div>
                        <div className="text-xs text-green-600">Our Rank</div>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded">
                        <div className="font-bold text-red-800">#{ranking.consensusADP}</div>
                        <div className="text-xs text-red-600">Market ADP</div>
                      </div>
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <div className="font-bold text-blue-800">{ranking.player.position}{ranking.ourPositionRank}</div>
                        <div className="text-xs text-blue-600">Our Position Rank</div>
                      </div>
                      <div className="text-center p-2 bg-purple-50 rounded">
                        <div className="font-bold text-purple-800">+{ranking.adpDifference}</div>
                        <div className="text-xs text-purple-600">ADP Difference</div>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-700">
                      <strong>Why this is a steal:</strong>
                      <ul className="mt-1 space-y-1">
                        {ranking.reasoning.map((reason, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">•</span>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
                
                {filterByCategory(rankings, 'STEAL').length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No steals identified in current rankings
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="values">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                Value Picks
              </CardTitle>
              <CardDescription>
                Solid players being drafted later than they should be
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filterByCategory(rankings, 'VALUE').map((ranking) => (
                  <div key={ranking.player.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">
                          {ranking.player.name} - {ranking.player.team} {ranking.player.position}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {ranking.player.avgPoints.toFixed(1)} PPG
                        </p>
                      </div>
                      <Badge className={getValueColor(ranking.valueCategory)}>
                        {getValueIcon(ranking.valueCategory)}
                        {ranking.valueCategory}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 text-center text-sm mb-2">
                      <div>
                        <div className="font-bold">#{ranking.ourOverallRank}</div>
                        <div className="text-xs text-gray-500">Our Rank</div>
                      </div>
                      <div>
                        <div className="font-bold">#{ranking.consensusADP}</div>
                        <div className="text-xs text-gray-500">Market ADP</div>
                      </div>
                      <div>
                        <div className="font-bold">{ranking.player.position}{ranking.ourPositionRank}</div>
                        <div className="text-xs text-gray-500">Position Rank</div>
                      </div>
                      <div>
                        <div className="font-bold text-blue-600">+{ranking.adpDifference.toFixed(1)}</div>
                        <div className="text-xs text-gray-500">Difference</div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-600">
                      {ranking.reasoning.join(' • ')}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {['qb', 'rb', 'wr', 'te'].map((position) => (
          <TabsContent key={position} value={position}>
            <Card>
              <CardHeader>
                <CardTitle>{position.toUpperCase()} Rankings</CardTitle>
                <CardDescription>
                  Position-specific value analysis for {position.toUpperCase()}s
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filterByPosition(rankings, position.toUpperCase()).map((ranking) => (
                    <div key={ranking.player.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="font-bold">{position.toUpperCase()}{ranking.ourPositionRank}</div>
                          <div className="text-xs text-gray-500">Our Rank</div>
                        </div>
                        <div>
                          <div className="font-semibold">{ranking.player.name}</div>
                          <div className="text-sm text-gray-600">
                            {ranking.player.team} • {ranking.player.avgPoints.toFixed(1)} PPG
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="font-bold">#{ranking.consensusADP}</div>
                          <div className="text-xs text-gray-500">Market ADP</div>
                        </div>
                        <div className="text-center">
                          <div className={`font-bold ${ranking.adpDifference > 0 ? 'text-green-600' : ranking.adpDifference < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                            {ranking.adpDifference > 0 ? '+' : ''}{ranking.adpDifference.toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-500">Difference</div>
                        </div>
                        <Badge className={getValueColor(ranking.valueCategory)} variant="secondary">
                          {ranking.valueCategory}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}