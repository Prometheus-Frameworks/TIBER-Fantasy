import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Search, Trophy, Star, Crown, Award, Target, Zap, Shield, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import type { Player } from "@shared/schema";
import { PlayerSearch } from "@/components/player-search";
import { calculateDynastyScore, getTierFromScore, getTierColor, getTierLabel, getTierIcon, DYNASTY_TIERS } from "@/lib/dynastyTiers";
import RankingDisclaimer from "@/components/ranking-disclaimer";

interface SimpleRankedPlayer {
  rank: number;
  player: Player;
  isUserPlayer: boolean;
}

export default function SimpleRankings() {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [activeTab, setActiveTab] = useState("search");
  const { data: allPlayers, isLoading: allPlayersLoading } = useQuery<Player[]>({
    queryKey: ["/api/players/available"],
  });

  if (allPlayersLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Filter out irrelevant players for dynasty rankings
  const isRelevantDynastyPlayer = (player: Player): boolean => {
    // Filter out players with unrealistic stats
    if (player.avgPoints < 1 || player.avgPoints > 35) return false;
    
    // Filter out inactive/irrelevant players by name
    const excludedPlayers = [
      'Deshaun Watson', 'Trent Taylor', 'Practice Squad', 'Free Agent',
      'Injured Reserve', 'Unknown Player', 'Test Player', 'Demarcus Robinson',
      'Tim Patrick', 'Allen Robinson', 'Sterling Shepard', 'Parris Campbell',
      'Nelson Agholor', 'Marquise Goodwin', 'JuJu Smith-Schuster'
    ];
    
    if (excludedPlayers.some(name => player.name.includes(name))) return false;
    
    // Age-based dynasty relevance (dynasty focuses on future value)
    const age = player.age || 25;
    const maxAges = {
      QB: 32,   // QBs can be valuable longer
      RB: 28,   // RBs fall off quickly
      WR: 30,   // WRs have moderate longevity  
      TE: 31    // TEs peak later, last longer
    };
    
    const maxAge = maxAges[player.position as keyof typeof maxAges] || 30;
    if (age > maxAge) return false;
    
    // Higher thresholds for dynasty relevance (not just any production)
    const minThresholds = {
      QB: 12.0,   // QBs need at least 12 PPG to be dynasty relevant
      RB: 8.0,    // RBs need at least 8 PPG 
      WR: 8.0,    // WRs need at least 8 PPG (raised significantly)
      TE: 5.0     // TEs need at least 5 PPG
    };
    
    const threshold = minThresholds[player.position as keyof typeof minThresholds] || 0;
    if (player.avgPoints < threshold) return false;
    
    // Calculate dynasty value with age penalty
    const ageMultiplier = Math.max(0.5, 1 - (age - 22) * 0.03); // 3% penalty per year over 22
    const dynastyValue = player.avgPoints * ageMultiplier;
    
    return dynastyValue > 6.0; // Minimum dynasty value threshold
  };

  // Calculate dynasty value using the 6-tier system
  const calculateDynastyValue = (player: Player): number => {
    const result = calculateDynastyScore({
      name: player.name,
      position: player.position,
      age: player.age || 25,
      avgPoints: player.avgPoints || 0,
      team: player.team
    });
    return result.score;
  };

  // Group players by tiers for comprehensive rankings
  const getPlayersByTier = (players: SimpleRankedPlayer[], tierName: string) => {
    return players.filter(p => {
      const score = calculateDynastyValue(p.player);
      const tier = getTierFromScore(score);
      return tier.name === tierName;
    });
  };

  // Simple list view for showing all players without tier grouping
  const generateSimpleList = (position: string): SimpleRankedPlayer[] => {
    const positionPlayers = (allPlayers || [])
      .filter(p => p.position === position)
      .sort((a, b) => calculateDynastyValue(b) - calculateDynastyValue(a));

    return positionPlayers.map((player, index) => ({
      rank: index + 1,
      player,
      isUserPlayer: false,
    }));
  };

  // Generate simple rankings for each position
  const generateSimpleRankings = (position: string): SimpleRankedPlayer[] => {
    const positionPlayers = (allPlayers || [])
      .filter(p => p.position === position)
      // Show ALL players for the position, not just dynasty relevant ones
      .sort((a, b) => calculateDynastyValue(b) - calculateDynastyValue(a)) // Sort by dynasty value
      // Don't limit to top 50 - show all available players

    return positionPlayers.map((player, index) => ({
      rank: index + 1,
      player,
      isUserPlayer: false,
    }));
  };

  const positions = ["QB", "RB", "WR", "TE"];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dynasty Rankings</h1>
        <p className="text-gray-600">Simple numbered rankings for your league</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search
          </TabsTrigger>
          {positions.map((position) => (
            <TabsTrigger key={position} value={position}>
              {position}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Player Search & Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <PlayerSearch
                onPlayerSelect={setSelectedPlayer}
                placeholder="Search for dynasty players..."
                className="w-full"
              />
              
              {selectedPlayer && (
                <div className="border-t pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Users className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{selectedPlayer.name}</h3>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{selectedPlayer.position}</Badge>
                            <span className="text-sm text-muted-foreground">{selectedPlayer.team}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Fantasy Points</span>
                          <span className="font-medium">{selectedPlayer.avgPoints.toFixed(1)} PPG</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Dynasty Score</span>
                          <span className="font-medium">{calculateDynastyValue(selectedPlayer).toFixed(0)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Position Rank</span>
                          <span className="font-medium">
                            #{generateSimpleRankings(selectedPlayer.position).findIndex(p => p.player.id === selectedPlayer.id) + 1} {selectedPlayer.position}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Dynasty Analysis</h4>
                      <div className="space-y-3">
                        {calculateDynastyValue(selectedPlayer) >= 85 && (
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-purple-500" />
                            <span className="text-sm">Elite Dynasty Asset</span>
                          </div>
                        )}
                        {calculateDynastyValue(selectedPlayer) >= 80 && calculateDynastyValue(selectedPlayer) < 85 && (
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-blue-500" />
                            <span className="text-sm">Premium Dynasty Asset</span>
                          </div>
                        )}
                        {selectedPlayer.age && selectedPlayer.age <= 25 && (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              Youth Premium
                            </Badge>
                          </div>
                        )}
                        {selectedPlayer.avgPoints >= 15 && (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-blue-600 border-blue-600">
                              High Production
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {positions.map((position) => (
          <TabsContent key={position} value={position}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {position === "QB" ? "Quarterbacks" :
                   position === "RB" ? "Running Backs" :
                   position === "WR" ? "Wide Receivers" :
                   "Tight Ends"}
                  <span className="text-sm text-gray-500">
                    Dynasty Rankings
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {/* Show all players in simple ranked list */}
                  {generateSimpleList(position).map((ranking) => {
                    const score = calculateDynastyValue(ranking.player);
                    const tierInfo = getTierFromScore(score);
                    
                    return (
                      <div
                        key={ranking.player.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <span className="text-sm font-bold text-gray-700">
                              {ranking.rank}
                            </span>
                          </div>
                          
                          <div>
                            <Link 
                              href={`/player/${ranking.player.id}`}
                              className="font-medium text-gray-900 hover:text-blue-600 hover:underline cursor-pointer transition-colors flex items-center gap-1"
                            >
                              {ranking.player.name}
                              <ExternalLink className="w-3 h-3 opacity-50" />
                            </Link>
                            <div className="text-sm text-gray-500">
                              {ranking.player.team} • {(ranking.player.avgPoints || 0).toFixed(1)} PPG
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-3">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              Score: {score.toFixed(1)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {position}{ranking.rank}
                            </div>
                          </div>
                          <Badge 
                            style={{ backgroundColor: tierInfo.color, color: 'white' }}
                            className="text-xs"
                          >
                            {tierInfo.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}