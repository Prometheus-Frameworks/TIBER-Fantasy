import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

interface Player {
  id: number;
  name: string;
  position: string;
  team: string;
  avgPoints: number;
  isStarter: boolean;
}

interface PositionRanking {
  position: string;
  players: Array<Player & { 
    positionRank: number;
    strengthIndicator: 'strong' | 'moderate' | 'weak';
    isUserPlayer: boolean;
  }>;
  strengthScore: number;
  avgRank: number;
  weakness: string;
}

export default function PositionRankings() {
  const { data: teamPlayers, isLoading: playersLoading } = useQuery<(Player & { isStarter: boolean })[]>({
    queryKey: ["/api/teams", 1, "players"],
  });

  const { data: allPlayers, isLoading: allPlayersLoading } = useQuery<Player[]>({
    queryKey: ["/api/players/available"],
  });

  if (playersLoading || allPlayersLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Create position rankings with user players highlighted
  const createPositionRankings = (): PositionRanking[] => {
    if (!teamPlayers || !allPlayers) return [];

    const positions = ['QB', 'RB', 'WR', 'TE'];
    const userPlayerIds = new Set(teamPlayers.map(p => p.id));

    return positions.map(position => {
      // Get all players at this position, sorted by average points
      const positionPlayers = allPlayers
        .filter(p => p.position === position)
        .sort((a, b) => b.avgPoints - a.avgPoints)
        .map((player, index) => ({
          ...player,
          positionRank: index + 1,
          isUserPlayer: userPlayerIds.has(player.id),
          strengthIndicator: getStrengthIndicator(index + 1, position),
          isStarter: teamPlayers.find(tp => tp.id === player.id)?.isStarter || false
        }));

      // Calculate user's position strength
      const userPlayers = positionPlayers.filter(p => p.isUserPlayer);
      const userRanks = userPlayers.map(p => p.positionRank);
      const avgRank = userRanks.length > 0 ? userRanks.reduce((a, b) => a + b, 0) / userRanks.length : 999;
      
      const strengthScore = calculatePositionStrength(userRanks, position);
      const weakness = identifyWeakness(userPlayers, position);

      return {
        position,
        players: positionPlayers.slice(0, 50), // Show top 50 per position
        strengthScore,
        avgRank,
        weakness
      };
    });
  };

  const getStrengthIndicator = (rank: number, position: string): 'strong' | 'moderate' | 'weak' => {
    const thresholds = {
      QB: { strong: 12, moderate: 24 },
      RB: { strong: 24, moderate: 36 },
      WR: { strong: 36, moderate: 60 },
      TE: { strong: 12, moderate: 24 }
    };

    const threshold = thresholds[position as keyof typeof thresholds];
    if (rank <= threshold.strong) return 'strong';
    if (rank <= threshold.moderate) return 'moderate';
    return 'weak';
  };

  const calculatePositionStrength = (ranks: number[], position: string): number => {
    if (ranks.length === 0) return 0;
    
    const avgRank = ranks.reduce((a, b) => a + b, 0) / ranks.length;
    const maxExpectedRank = position === 'QB' ? 24 : position === 'TE' ? 24 : position === 'RB' ? 48 : 72;
    
    return Math.max(0, Math.min(100, 100 - (avgRank / maxExpectedRank) * 100));
  };

  const identifyWeakness = (userPlayers: any[], position: string): string => {
    if (userPlayers.length === 0) return `No ${position} players owned`;
    
    const starters = userPlayers.filter(p => p.isStarter);
    const bestRank = Math.min(...userPlayers.map(p => p.positionRank));
    const worstRank = Math.max(...userPlayers.map(p => p.positionRank));
    
    if (starters.length === 0) return `No starting ${position}`;
    if (bestRank > 24) return `Weak ${position}1 option`;
    if (userPlayers.length < 2 && position !== 'QB') return `Need depth at ${position}`;
    if (worstRank > 60 && position === 'RB') return `RB depth concerning`;
    if (worstRank > 80 && position === 'WR') return `WR depth concerning`;
    
    return 'Position looks solid';
  };

  const positionRankings = createPositionRankings();

  const getPositionColor = (position: string) => {
    const colors = {
      QB: 'bg-purple-100 text-purple-800',
      RB: 'bg-blue-100 text-blue-800', 
      WR: 'bg-green-100 text-green-800',
      TE: 'bg-orange-100 text-orange-800'
    };
    return colors[position as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStrengthColor = (indicator: string) => {
    switch (indicator) {
      case 'strong': return 'text-green-600 bg-green-50';
      case 'moderate': return 'text-yellow-600 bg-yellow-50';
      case 'weak': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Team
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Position Rankings</h1>
          <p className="text-gray-600">See where your players rank within their positions</p>
        </div>
      </div>

      <div className="grid gap-6">
        {positionRankings.map(({ position, players, strengthScore, weakness }) => (
          <Card key={position}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <Badge className={getPositionColor(position)}>
                    {position}
                  </Badge>
                  <span>Position Rankings</span>
                </CardTitle>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Strength Score</div>
                    <div className={`font-bold ${strengthScore >= 70 ? 'text-green-600' : strengthScore >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {strengthScore.toFixed(0)}/100
                    </div>
                  </div>
                  {strengthScore < 50 && (
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </div>
              {weakness !== 'Position looks solid' && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  <strong>Weakness:</strong> {weakness}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                      player.isUserPlayer 
                        ? 'bg-blue-50 border-blue-200 shadow-md' 
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        player.positionRank <= 12 ? 'bg-green-100 text-green-800' :
                        player.positionRank <= 24 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {player.positionRank}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {player.name}
                          {player.isUserPlayer && (
                            <Badge variant="outline" className="text-xs">
                              {player.isStarter ? 'STARTER' : 'BENCH'}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {player.team} • {player.avgPoints.toFixed(1)} PPG
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {position}{player.positionRank}
                      </div>
                      <div className={`text-xs px-2 py-1 rounded ${getStrengthColor(player.strengthIndicator)}`}>
                        {player.strengthIndicator}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}