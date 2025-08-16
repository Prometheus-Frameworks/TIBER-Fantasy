import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Star, Zap, Target, Shield, DollarSign, Flame } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

// Progress component inline
const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={`bg-gray-200 rounded-full h-2 ${className}`}>
    <div 
      className="bg-gradient-to-r from-gold to-plum h-2 rounded-full transition-all duration-300" 
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

interface HotListPlayer {
  playerId: string;
  name: string;
  team: string;
  position: string;
  currentOVR: number;
  baseOVR: number;
  deltaTotal: number;
  compass: {
    north: number;
    east: number;
    south: number;
    west: number;
  };
  reasons: string[];
  confidence: string;
  percentiles: {
    ovr: number;
    north: number;
    east: number;
    south: number;
    west: number;
  };
}

interface HotListResponse {
  players: HotListPlayer[];
  metadata: {
    week: string;
    bucket: string;
    position: string;
    totalPlayers: number;
  };
  criteria: {
    [key: string]: string;
  };
}

export default function HotList() {
  const [selectedBucket, setSelectedBucket] = useState<'risers' | 'elite' | 'usage_surge' | 'value'>('risers');
  const [selectedPosition, setSelectedPosition] = useState<'ALL' | 'WR' | 'RB' | 'TE' | 'QB'>('ALL');

  // Fetch hot list data
  const { data: hotListData, isLoading, error } = useQuery({
    queryKey: ['/api/players/hot-list', selectedBucket, selectedPosition],
    queryFn: async () => {
      const params = new URLSearchParams({
        bucket: selectedBucket,
        limit: '12'
      });
      
      if (selectedPosition !== 'ALL') {
        params.append('pos', selectedPosition);
      }

      const response = await fetch(`/api/players/hot-list?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch hot list');
      }
      return response.json() as Promise<HotListResponse>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const getBucketInfo = (bucket: string) => {
    switch (bucket) {
      case 'risers':
        return {
          title: 'OVR Risers',
          description: 'Players with +5 OVR gains sustained 2+ weeks',
          icon: <TrendingUp className="w-5 h-5 text-green-500" />,
          color: 'text-green-600'
        };
      case 'elite':
        return {
          title: 'Compass Elite',
          description: 'Top percentile in all 4 compass directions',
          icon: <Star className="w-5 h-5 text-gold" />,
          color: 'text-gold'
        };
      case 'usage_surge':
        return {
          title: 'Usage Surge',
          description: 'Significant snap or route percentage increases',
          icon: <Flame className="w-5 h-5 text-red-500" />,
          color: 'text-red-600'
        };
      case 'value':
        return {
          title: 'Value Targets',
          description: 'High OVR vs ADP discrepancy with strong usage',
          icon: <DollarSign className="w-5 h-5 text-purple-500" />,
          color: 'text-purple-600'
        };
      default:
        return {
          title: bucket,
          description: '',
          icon: null,
          color: 'text-gray-600'
        };
    }
  };

  const getOVRColor = (ovr: number): string => {
    if (ovr >= 90) return 'text-purple-600 font-bold';
    if (ovr >= 85) return 'text-blue-600 font-semibold';
    if (ovr >= 80) return 'text-green-600';
    return 'text-yellow-600';
  };

  const getCompassIcon = (direction: string) => {
    switch (direction) {
      case 'north': return <Zap className="w-3 h-3 text-blue-500" />;
      case 'east': return <Target className="w-3 h-3 text-green-500" />;
      case 'south': return <Shield className="w-3 h-3 text-red-500" />;
      case 'west': return <DollarSign className="w-3 h-3 text-purple-500" />;
      default: return null;
    }
  };

  const bucketInfo = getBucketInfo(selectedBucket);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              Failed to load hot list data. Please try again.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          {bucketInfo.icon}
          <h1 className="text-4xl font-bold text-ink">{bucketInfo.title}</h1>
        </div>
        <p className="text-body text-lg max-w-2xl">
          {bucketInfo.description}
        </p>
      </div>

      {/* Controls */}
      <div className="mb-8 space-y-6">
        {/* Bucket Selection */}
        <Tabs value={selectedBucket} onValueChange={(value) => setSelectedBucket(value as any)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="risers">OVR Risers</TabsTrigger>
            <TabsTrigger value="elite">Compass Elite</TabsTrigger>
            <TabsTrigger value="usage_surge">Usage Surge</TabsTrigger>
            <TabsTrigger value="value">Value Targets</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Position Filter */}
        <div className="flex gap-2">
          {(['ALL', 'WR', 'RB', 'TE', 'QB'] as const).map(pos => (
            <Button
              key={pos}
              variant={selectedPosition === pos ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPosition(pos)}
            >
              {pos}
            </Button>
          ))}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-24 bg-haze rounded mb-4"></div>
                <div className="h-4 bg-haze rounded mb-2"></div>
                <div className="h-4 bg-haze rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Metadata */}
          {hotListData && (
            <div className="mb-6 text-sm text-body">
              <div className="flex items-center gap-4">
                <span>Week: {hotListData.metadata.week}</span>
                <span>Players: {hotListData.metadata.totalPlayers}</span>
                <span>Position: {hotListData.metadata.position}</span>
              </div>
            </div>
          )}

          {/* Player Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hotListData?.players.map((player, index) => (
              <Card key={player.playerId} className="relative overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                {/* Rank Badge */}
                <div className="absolute top-3 right-3">
                  <Badge variant={index < 3 ? 'default' : 'secondary'}>
                    #{index + 1}
                  </Badge>
                </div>

                {/* Elite Badge for Top 3 */}
                {index < 3 && (
                  <div className="absolute top-3 left-3">
                    <Star className="w-5 h-5 text-gold fill-gold" />
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{player.position}</Badge>
                      <span className="text-sm text-body">{player.team}</span>
                    </div>
                    <div className="text-xs text-body">
                      {Math.round(player.percentiles.ovr * 100)}th pct
                    </div>
                  </div>
                  <CardTitle className="text-lg">{player.name}</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* OVR Display */}
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${getOVRColor(player.currentOVR)}`}>
                      {player.currentOVR}
                    </div>
                    <div className="text-sm text-body">
                      Base: {player.baseOVR} 
                      <span className={player.deltaTotal > 0 ? 'text-green-600' : 'text-red-600'}>
                        ({player.deltaTotal > 0 ? '+' : ''}{player.deltaTotal})
                      </span>
                    </div>
                  </div>

                  {/* Compass Mini Bars */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      {getCompassIcon('north')}
                      <Progress value={player.compass.north} className="flex-1 h-1" />
                      <span className="w-6">{player.compass.north}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {getCompassIcon('east')}
                      <Progress value={player.compass.east} className="flex-1 h-1" />
                      <span className="w-6">{player.compass.east}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {getCompassIcon('south')}
                      <Progress value={100 - player.compass.south} className="flex-1 h-1" />
                      <span className="w-6">{player.compass.south}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {getCompassIcon('west')}
                      <Progress value={player.compass.west} className="flex-1 h-1" />
                      <span className="w-6">{player.compass.west}</span>
                    </div>
                  </div>

                  {/* Reasons */}
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-body">Key Factors:</div>
                    {player.reasons.slice(0, 2).map((reason, idx) => (
                      <div key={idx} className="text-xs text-body bg-haze/50 px-2 py-1 rounded">
                        {reason}
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link href={`/compass/${player.position.toLowerCase()}?player=${player.playerId}`}>
                      <Button variant="outline" size="sm" className="flex-1 text-xs">
                        Full Analysis
                      </Button>
                    </Link>
                    <Badge variant="outline" className="text-xs">
                      {player.confidence}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Empty State */}
          {hotListData?.players.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-body">
                  No players match the current criteria. Try adjusting your filters.
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Quick Actions */}
      <div className="mt-12 text-center space-y-4">
        <h3 className="text-xl font-semibold">Explore More</h3>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/showcase">
            <Button>Player Showcase</Button>
          </Link>
          <Link href="/compass">
            <Button variant="outline">Player Compass</Button>
          </Link>
          <Link href="/consensus">
            <Button variant="outline">OTC Consensus</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}