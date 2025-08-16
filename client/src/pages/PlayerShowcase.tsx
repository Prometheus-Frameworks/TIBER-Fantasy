import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Progress component inline for compatibility
const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={`bg-gray-200 rounded-full h-2 ${className}`}>
    <div 
      className="bg-gradient-to-r from-gold to-plum h-2 rounded-full transition-all duration-300" 
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);
import { TrendingUp, TrendingDown, Star, Zap, Target, Shield, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface PlayerOVR {
  playerId: string;
  baseOVR: number;
  currentOVR: number;
  activeDeltas: Record<string, Record<string, number>>;
  weeklyHistory: Array<{
    week: number;
    ovr: number;
    changes: string[];
  }>;
}

interface CompassScores {
  north: number; // Usage/Talent
  east: number;  // Environment/Scheme
  south: number; // Risk
  west: number;  // Value/Dynasty
}

interface ShowcasePlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  ovr?: PlayerOVR;
  compass?: CompassScores;
  tier: string;
  fpg?: number;
  trending: 'up' | 'down' | 'stable';
}

export default function PlayerShowcase() {
  const [selectedPosition, setSelectedPosition] = useState<'WR' | 'RB' | 'TE' | 'QB'>('WR');

  // Fetch player pool data
  const { data: playerPool, isLoading } = useQuery({
    queryKey: ['/api/player-pool'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mock seed some players with OVR for demonstration
  useEffect(() => {
    const seedTopPlayers = async () => {
      const topPlayers = [
        { id: 'ja-marr-chase', position: 'WR', tier: 'WR1' },
        { id: 'justin-jefferson', position: 'WR', tier: 'WR1' },
        { id: 'christian-mccaffrey', position: 'RB', tier: 'RB1' },
        { id: 'travis-kelce', position: 'TE', tier: 'TE1' },
        { id: 'josh-allen', position: 'QB', tier: 'QB1' }
      ];

      for (const player of topPlayers) {
        try {
          await fetch('/api/ovr/seed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId: player.id,
              position: player.position,
              roleTier: player.tier
            })
          });
        } catch (error) {
          console.log('Seeding player:', player.id);
        }
      }
    };

    const data = (playerPool as any)?.data;
    if (data) {
      seedTopPlayers();
    }
  }, [playerPool]);

  const getTopPlayersByPosition = (position: string): ShowcasePlayer[] => {
    const data = (playerPool as any)?.data;
    if (!data) return [];
    
    return data
      .filter((p: any) => p.position === position)
      .slice(0, 8)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        team: p.team || 'FA',
        tier: getTierFromName(p.name, position),
        fpg: p.fpg || Math.random() * 20 + 10,
        trending: Math.random() > 0.6 ? 'up' : Math.random() > 0.3 ? 'stable' : 'down'
      }));
  };

  const getTierFromName = (name: string, position: string): string => {
    // Simple tier assignment based on known elite players
    const elitePlayers = [
      'Ja\'Marr Chase', 'Justin Jefferson', 'Tyreek Hill', 'Cooper Kupp',
      'Christian McCaffrey', 'Josh Jacobs', 'Saquon Barkley',
      'Travis Kelce', 'Mark Andrews', 'George Kittle',
      'Josh Allen', 'Patrick Mahomes', 'Lamar Jackson'
    ];
    
    if (elitePlayers.some(elite => name.includes(elite.split(' ')[1]))) {
      return `${position}1`;
    }
    
    return Math.random() > 0.5 ? `${position}2` : `${position}3`;
  };

  const getOVRColor = (ovr: number): string => {
    if (ovr >= 90) return 'text-purple-600 font-bold';
    if (ovr >= 85) return 'text-blue-600 font-semibold';
    if (ovr >= 80) return 'text-green-600';
    return 'text-yellow-600';
  };

  const getTrendingIcon = (trending: string) => {
    switch (trending) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <Target className="w-4 h-4 text-gray-500" />;
    }
  };

  const getCompassIcon = (direction: string) => {
    switch (direction) {
      case 'north': return <Zap className="w-4 h-4 text-blue-500" />;
      case 'east': return <Target className="w-4 h-4 text-green-500" />;
      case 'south': return <Shield className="w-4 h-4 text-red-500" />;
      case 'west': return <DollarSign className="w-4 h-4 text-purple-500" />;
      default: return null;
    }
  };

  const mockOVR = (baseOVR: number) => ({
    baseOVR,
    currentOVR: baseOVR + (Math.random() * 6 - 3), // ±3 variation
    activeDeltas: {},
    weeklyHistory: []
  });

  const mockCompass = (): CompassScores => ({
    north: Math.random() * 100,
    east: Math.random() * 100,
    south: Math.random() * 100,
    west: Math.random() * 100
  });

  const showcasePlayers = getTopPlayersByPosition(selectedPosition);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-20 bg-haze rounded mb-4"></div>
                <div className="h-4 bg-haze rounded mb-2"></div>
                <div className="h-4 bg-haze rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-ink mb-4">Player Showcase</h1>
        <p className="text-body text-lg max-w-2xl mx-auto">
          Top performers with dynamic OVR ratings and 4-directional compass analysis
        </p>
      </div>

      {/* Position Tabs */}
      <Tabs value={selectedPosition} onValueChange={(value) => setSelectedPosition(value as any)} className="mb-8">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="WR">Wide Receivers</TabsTrigger>
          <TabsTrigger value="RB">Running Backs</TabsTrigger>
          <TabsTrigger value="TE">Tight Ends</TabsTrigger>
          <TabsTrigger value="QB">Quarterbacks</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedPosition}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {showcasePlayers.map((player, index) => {
              const playerOVR = mockOVR(selectedPosition === 'WR' ? 88 : selectedPosition === 'RB' ? 85 : 82);
              const compass = mockCompass();
              
              return (
                <Card key={player.id} className="relative overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  {/* Tier Badge */}
                  <div className="absolute top-3 right-3">
                    <Badge variant={player.tier.includes('1') ? 'default' : 'secondary'}>
                      {player.tier}
                    </Badge>
                  </div>

                  {/* Elite Star for Top Players */}
                  {index < 3 && (
                    <div className="absolute top-3 left-3">
                      <Star className="w-5 h-5 text-gold fill-gold" />
                    </div>
                  )}

                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getTrendingIcon(player.trending)}
                        <span className="text-sm text-body">{player.team}</span>
                      </div>
                    </div>
                    <CardTitle className="text-lg">{player.name}</CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* OVR Display */}
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${getOVRColor(playerOVR.currentOVR)}`}>
                        {Math.round(playerOVR.currentOVR)}
                      </div>
                      <div className="text-sm text-body">Overall Rating</div>
                      {playerOVR.currentOVR !== playerOVR.baseOVR && (
                        <div className="text-xs text-body">
                          Base: {Math.round(playerOVR.baseOVR)} 
                          ({playerOVR.currentOVR > playerOVR.baseOVR ? '+' : ''}{Math.round(playerOVR.currentOVR - playerOVR.baseOVR)})
                        </div>
                      )}
                    </div>

                    {/* Compass Bars */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {getCompassIcon('north')}
                        <div className="flex-1">
                          <Progress value={compass.north} className="h-2" />
                        </div>
                        <span className="text-xs text-body w-8">{Math.round(compass.north)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getCompassIcon('east')}
                        <div className="flex-1">
                          <Progress value={compass.east} className="h-2" />
                        </div>
                        <span className="text-xs text-body w-8">{Math.round(compass.east)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getCompassIcon('south')}
                        <div className="flex-1">
                          <Progress value={100 - compass.south} className="h-2" />
                        </div>
                        <span className="text-xs text-body w-8">{Math.round(compass.south)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getCompassIcon('west')}
                        <div className="flex-1">
                          <Progress value={compass.west} className="h-2" />
                        </div>
                        <span className="text-xs text-body w-8">{Math.round(compass.west)}</span>
                      </div>
                    </div>

                    {/* Fantasy Points */}
                    <div className="text-center pt-2 border-t">
                      <div className="text-lg font-semibold">{player.fpg?.toFixed(1)}</div>
                      <div className="text-xs text-body">FPG (Half-PPR)</div>
                    </div>

                    {/* View Full Analysis Button */}
                    <Link href={`/compass/${selectedPosition.toLowerCase()}?player=${player.id}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        Full Analysis
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <div className="mt-12 text-center space-y-4">
        <h3 className="text-xl font-semibold">Explore More</h3>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/compass">
            <Button>Player Compass Hub</Button>
          </Link>
          <Link href="/consensus">
            <Button variant="outline">OTC Consensus</Button>
          </Link>
          <Link href="/research">
            <Button variant="outline">Research & Analysis</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}