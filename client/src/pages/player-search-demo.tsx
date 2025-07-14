import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerSearch } from "@/components/player-search";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Star, TrendingUp, Users } from "lucide-react";

interface Player {
  id: number;
  name: string;
  position: string;
  team: string;
  avgPoints: number;
  imageUrl?: string;
}

interface TierInfo {
  tier: string;
  tierDescription: string;
  dynastyScore: number;
  strengths: string[];
  concerns: string[];
}

export default function PlayerSearchDemo() {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const { data: tierInfo, isLoading: loadingTier } = useQuery({
    queryKey: [`/api/players/${selectedPlayer?.id}/tier`],
    enabled: !!selectedPlayer?.id,
  });

  const { data: eliteTier = [] } = useQuery({
    queryKey: ['/api/tiers/Elite'],
  });

  const { data: tier1Players = [] } = useQuery({
    queryKey: ['/api/tiers/Tier1'],
  });

  const handlePlayerSelect = (player: Player) => {
    setSelectedPlayer(player);
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Elite': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'Tier1': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'Tier2': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Tier3': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Tier4': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'Tier5': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Dynasty Player Search & Tiers
        </h1>
        <p className="text-muted-foreground">
          Search players and view their dynasty tier rankings based on proprietary methodology
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Search Section */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Player Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PlayerSearch
                onPlayerSelect={handlePlayerSelect}
                placeholder="Search for dynasty players..."
                className="w-full"
              />
            </CardContent>
          </Card>

          {selectedPlayer && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Selected Player</span>
                  {loadingTier ? (
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
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

                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {selectedPlayer.avgPoints.toFixed(1)} PPG
                    </span>
                  </div>

                  {tierInfo && (
                    <div className="space-y-3 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                        <Badge className={getTierColor(tierInfo.tier.tier)}>
                          {tierInfo.tier.tier}
                        </Badge>
                        <span className="text-sm font-medium">
                          Score: {tierInfo.tier.dynastyScore}
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {tierInfo.tier.tierDescription}
                      </p>

                      {tierInfo.tier.strengths && tierInfo.tier.strengths.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                            Strengths:
                          </h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {tierInfo.tier.strengths.map((strength: string, index: number) => (
                              <li key={index} className="flex items-start gap-1">
                                <span className="text-green-500 mt-1">•</span>
                                {strength}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {tierInfo.tier.concerns && tierInfo.tier.concerns.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-1">
                            Concerns:
                          </h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {tierInfo.tier.concerns.map((concern: string, index: number) => (
                              <li key={index} className="flex items-start gap-1">
                                <span className="text-orange-500 mt-1">•</span>
                                {concern}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tier Display Section */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Dynasty Tiers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="elite" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="elite">Elite Tier</TabsTrigger>
                  <TabsTrigger value="tier1">Premium Tier</TabsTrigger>
                </TabsList>
                
                <TabsContent value="elite" className="space-y-3">
                  <div className="text-sm text-muted-foreground mb-3">
                    Generational dynasty assets with perfect age and elite production
                  </div>
                  {eliteTier.map((player: any, index: number) => (
                    <div key={index} className="p-3 rounded-lg border border-border bg-background/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{player.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary">{player.position}</Badge>
                            <span className="text-sm text-muted-foreground">{player.team}</span>
                            <span className="text-sm text-muted-foreground">Age {player.age}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-purple-600 dark:text-purple-400">
                            {player.dynastyScore}
                          </div>
                          <div className="text-xs text-muted-foreground">Score</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="tier1" className="space-y-3">
                  <div className="text-sm text-muted-foreground mb-3">
                    Premium young assets with high dynasty value
                  </div>
                  {tier1Players.map((player: any, index: number) => (
                    <div key={index} className="p-3 rounded-lg border border-border bg-background/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{player.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary">{player.position}</Badge>
                            <span className="text-sm text-muted-foreground">{player.team}</span>
                            <span className="text-sm text-muted-foreground">Age {player.age}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-blue-600 dark:text-blue-400">
                            {player.dynastyScore}
                          </div>
                          <div className="text-xs text-muted-foreground">Score</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}