import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';

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

  const { data: enhancedData, isLoading } = useQuery<EnhancedRankingsResponse>({
    queryKey: ['/api/rankings/enhanced', selectedPosition],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedPosition !== 'all') {
        params.append('position', selectedPosition);
      }
      params.append('limit', '25');
      return fetch(`/api/rankings/enhanced?${params}`).then(res => res.json());
    },
  });

  const getTierColor = (tier: string): string => {
    switch (tier.toLowerCase()) {
      case 'elite': return 'bg-purple-100 text-purple-800';
      case 'premium': return 'bg-blue-100 text-blue-800';
      case 'strong': return 'bg-green-100 text-green-800';
      case 'solid': return 'bg-yellow-100 text-yellow-800';
      case 'depth': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
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
      {/* Clean Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Enhanced Rankings</h1>
            <p className="text-gray-600">Platform-connected dynasty rankings</p>
          </div>
          {stats && (
            <div className="flex items-center gap-4">
              <div className="text-center bg-green-50 px-4 py-2 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{stats.mappingRate}%</div>
                <div className="text-xs text-green-600">Connected</div>
              </div>
              <div className="text-center bg-blue-50 px-4 py-2 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{stats.mapped}</div>
                <div className="text-xs text-blue-600">Players</div>
              </div>
            </div>
          )}
        </div>
      </div>

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
          <div className="space-y-3">
            {players.map((player, index) => (
              <Card key={player.id} className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    {/* Left: Player Info */}
                    <div className="flex items-center gap-4">
                      <div className="text-xl font-bold text-gray-400 min-w-[3rem]">
                        #{index + 1}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{player.name}</h3>
                        <div className="text-sm text-gray-500">
                          {player.team} {player.position} • {player.avgPoints} PPG
                        </div>
                      </div>
                    </div>

                    {/* Right: Visual Indicators */}
                    <div className="flex items-center gap-4">
                      {/* Dynasty Score */}
                      <div className="text-center bg-blue-50 px-3 py-1 rounded">
                        <div className="text-lg font-bold text-blue-700">{player.dynastyValue}</div>
                        <div className="text-xs text-blue-600">Score</div>
                      </div>

                      {/* Tier Badge */}
                      <Badge className={getTierColor(player.dynastyTier)}>
                        {player.dynastyTier}
                      </Badge>

                      {/* Platform Connection */}
                      {player.sleeperId ? (
                        <div className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-xs font-medium text-green-700">Enhanced</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded">
                          <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                          <span className="text-xs font-medium text-gray-600">Basic</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}