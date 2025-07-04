import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users } from "lucide-react";
import { useState } from "react";
import type { Player } from "@shared/schema";

interface SimpleRankedPlayer {
  rank: number;
  player: Player;
  isUserPlayer: boolean;
}

export default function SimpleRankings() {
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
      'Tim Patrick', 'Stefon Diggs', 'Allen Robinson'
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

  // Calculate dynasty value with age adjustment
  const calculateDynastyValue = (player: Player): number => {
    const age = player.age || 25;
    const ageMultiplier = Math.max(0.5, 1 - (age - 22) * 0.03); // 3% penalty per year over 22
    const baseValue = (player.avgPoints || 0) + (player.upside || 0);
    return baseValue * ageMultiplier;
  };

  // Generate simple rankings for each position
  const generateSimpleRankings = (position: string): SimpleRankedPlayer[] => {
    const positionPlayers = (allPlayers || [])
      .filter(p => p.position === position)
      .filter(isRelevantDynastyPlayer) // Filter out irrelevant players
      .sort((a, b) => calculateDynastyValue(b) - calculateDynastyValue(a)) // Sort by age-adjusted dynasty value
      .slice(0, 50); // Top 50 for each position

    return positionPlayers.map((player, index) => ({
      rank: index + 1,
      player,
      isUserPlayer: false, // Remove false ownership claims for production
    }));
  };

  const positions = ["QB", "RB", "WR", "TE"];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dynasty Rankings</h1>
        <p className="text-gray-600">Simple numbered rankings for your league</p>
      </div>

      <Tabs defaultValue="WR" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {positions.map((position) => (
            <TabsTrigger key={position} value={position}>
              {position}
            </TabsTrigger>
          ))}
        </TabsList>

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
                  {generateSimpleRankings(position).map((ranking) => (
                    <div
                      key={ranking.player.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <span className="text-sm font-bold text-gray-700">
                            {ranking.rank}
                          </span>
                        </div>
                        
                        <div>
                          <div className="font-medium text-gray-900">
                            {ranking.player.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {ranking.player.team} • {ranking.player.avgPoints.toFixed(1)} PPG
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {position}{ranking.rank}
                        </div>
                        <div className="text-xs text-gray-500">
                          Position Rank
                        </div>
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