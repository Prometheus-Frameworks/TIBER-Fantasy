import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, TrendingUp, Database, Zap } from 'lucide-react';

interface EnhancedPlayer {
  id: number;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  age: number;
  avgPoints: number;
  dynastyValue: number;
  dynastyTier: string;
  sleeperId: string | null;
  fantasyOwnership: number | null;
  mappingConfidence: number;
  enhancementStatus: 'Enhanced' | 'Basic';
  dataQuality: 'High' | 'Medium' | 'Low';
}

interface MappingStats {
  total: number;
  mapped: number;
  unmapped: number;
  mappingRate: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
}

interface EnhancedRankingsResponse {
  players: EnhancedPlayer[];
  mappingStats: MappingStats;
  message: string;
}

export default function EnhancedRankings() {
  const [selectedPosition, setSelectedPosition] = useState<string>('all');
  const [isGeneratingMapping, setIsGeneratingMapping] = useState(false);

  const { data: enhancedData, isLoading, refetch } = useQuery<EnhancedRankingsResponse>({
    queryKey: ['/api/rankings/enhanced', selectedPosition],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedPosition !== 'all') {
        params.append('position', selectedPosition);
      }
      params.append('limit', '25');
      
      return fetch(`/api/rankings/enhanced?${params}`).then(r => r.json());
    }
  });

  const handleGenerateMapping = async () => {
    setIsGeneratingMapping(true);
    try {
      await fetch('/api/mapping/generate');
      await refetch();
    } finally {
      setIsGeneratingMapping(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'elite': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'premium': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'strong': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'solid': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'High': return 'bg-green-500';
      case 'Medium': return 'bg-yellow-500';
      case 'Low': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading enhanced rankings...</span>
        </div>
      </div>
    );
  }

  const stats = enhancedData?.mappingStats;
  const players = enhancedData?.players || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="h-8 w-8 text-yellow-500" />
          <h1 className="text-3xl font-bold">Enhanced Rankings System</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Dynasty rankings enhanced with fantasy platform integration - showcasing how player mapping feeds into better valuations
        </p>
      </div>

      {/* Mapping Statistics */}
      {stats && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Player Mapping Integration Stats
            </CardTitle>
            <CardDescription>
              Real-time connectivity between NFL database and fantasy platforms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{stats.mappingRate}%</div>
                <div className="text-sm text-muted-foreground">Platform Integration</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{stats.mapped}</div>
                <div className="text-sm text-muted-foreground">Enhanced Players</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total Players</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{stats.highConfidence}</div>
                <div className="text-sm text-muted-foreground">High Confidence</div>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Mapping Progress</span>
                <span className="text-sm text-muted-foreground">{stats.mapped}/{stats.total}</span>
              </div>
              <Progress value={stats.mappingRate} className="h-2" />
            </div>

            <Button 
              onClick={handleGenerateMapping}
              disabled={isGeneratingMapping}
              className="w-full"
            >
              {isGeneratingMapping ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Regenerating Mappings...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Regenerate Player Mappings
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Position Filter */}
      <Tabs value={selectedPosition} onValueChange={setSelectedPosition} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All Positions</TabsTrigger>
          <TabsTrigger value="QB">QB</TabsTrigger>
          <TabsTrigger value="RB">RB</TabsTrigger>
          <TabsTrigger value="WR">WR</TabsTrigger>
          <TabsTrigger value="TE">TE</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedPosition} className="mt-6">
          <div className="grid gap-4">
            {players.map((player, index) => (
              <Card key={player.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold text-muted-foreground">
                        #{index + 1}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{player.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{player.position}</span>
                          <span>•</span>
                          <span>{player.team}</span>
                          <span>•</span>
                          <span>Age {player.age}</span>
                          <span>•</span>
                          <span>{player.avgPoints} PPG</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Dynasty Tier */}
                      <Badge className={getTierColor(player.dynastyTier)}>
                        {player.dynastyTier}
                      </Badge>

                      {/* Dynasty Value */}
                      <div className="text-center">
                        <div className="text-lg font-bold">{player.dynastyValue}</div>
                        <div className="text-xs text-muted-foreground">Dynasty</div>
                      </div>

                      {/* Enhancement Status */}
                      <div className="flex items-center gap-2">
                        <div 
                          className={`w-3 h-3 rounded-full ${getQualityColor(player.dataQuality)}`}
                        />
                        <div className="text-center">
                          <div className="text-sm font-medium">
                            {player.enhancementStatus}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {player.dataQuality} Quality
                          </div>
                        </div>
                      </div>

                      {/* Fantasy Platform Data */}
                      {player.sleeperId && (
                        <div className="text-center border-l pl-3">
                          <div className="text-sm font-medium text-green-600">
                            ✓ Sleeper Linked
                          </div>
                          {player.fantasyOwnership && (
                            <div className="text-xs text-muted-foreground">
                              {player.fantasyOwnership}% Owned
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mapping Confidence Bar */}
                  {player.mappingConfidence > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-muted-foreground">
                          Mapping Confidence
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {player.mappingConfidence}%
                        </span>
                      </div>
                      <Progress value={player.mappingConfidence} className="h-1" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* System Explanation */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>How Enhanced Rankings Work</CardTitle>
          <CardDescription>
            Understanding the player mapping integration process
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <Database className="h-8 w-8 mx-auto mb-3 text-blue-500" />
              <h4 className="font-semibold mb-2">NFL Database</h4>
              <p className="text-sm text-muted-foreground">
                Authentic player statistics and performance data from NFL sources
              </p>
            </div>
            <div className="text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-3 text-green-500" />
              <h4 className="font-semibold mb-2">Fantasy Platform Mapping</h4>
              <p className="text-sm text-muted-foreground">
                Links NFL players to Sleeper IDs using fuzzy matching algorithms
              </p>
            </div>
            <div className="text-center">
              <Zap className="h-8 w-8 mx-auto mb-3 text-yellow-500" />
              <h4 className="font-semibold mb-2">Enhanced Dynasty Values</h4>
              <p className="text-sm text-muted-foreground">
                Dynasty rankings improved with ownership data and market context
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}