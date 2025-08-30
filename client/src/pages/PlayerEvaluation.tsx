import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Compass, TrendingUp, Shield, DollarSign, Star, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Mode = "dynasty" | "redraft";
type Position = "QB" | "RB" | "WR" | "TE" | undefined;

interface FusionPlayer {
  player_id: string;
  name: string;
  pos: string;
  team: string;
  age: number;
  north: number;
  east: number;
  south: number;
  west: number;
  score: number;
  tier: string;
  rank: number;
  badges: string[];
  xfp_recent?: number;
  season_fpts?: number;
}

interface QuadrantInfo {
  icon: React.ReactNode;
  color: string;
  description: string;
}

const quadrantInfo: Record<string, QuadrantInfo> = {
  north: {
    icon: <TrendingUp className="h-4 w-4" />,
    color: "text-blue-600",
    description: "Volume & Talent"
  },
  east: {
    icon: <Activity className="h-4 w-4" />,
    color: "text-green-600", 
    description: "Environment & Scheme"
  },
  south: {
    icon: <Shield className="h-4 w-4" />,
    color: "text-purple-600",
    description: "Safety & Durability"
  },
  west: {
    icon: <DollarSign className="h-4 w-4" />,
    color: "text-orange-600",
    description: "Value & Market"
  }
};

const getBadgeColor = (badge: string) => {
  switch (badge) {
    case "Alpha Usage": return "bg-blue-100 text-blue-800";
    case "Context Boost": return "bg-green-100 text-green-800";
    case "Aging Elite": return "bg-purple-100 text-purple-800";
    case "Market Mispriced": return "bg-orange-100 text-orange-800";
    case "FPTS Monster": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

export default function PlayerEvaluation() {
  const [location, setLocation] = useLocation();
  
  // Extract params from URL
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const initialMode = (urlParams.get('mode') as Mode) || "dynasty";
  const initialPosition = urlParams.get('position') as Position;
  
  const [mode, setMode] = useState<Mode>(initialMode);
  const [position, setPosition] = useState<Position>(initialPosition);

  const { data: fusionData, isLoading, error, refetch } = useQuery({
    queryKey: ["fusion-rankings", mode, position],
    queryFn: async () => {
      const posParam = position ? `&position=${position}` : '';
      const response = await fetch(`/api/rankings/deepseek/v3.2?mode=${mode}${posParam}`);
      if (!response.ok) throw new Error('Failed to load fusion data');
      return response.json();
    },
    retry: 1
  });

  const updateURL = (newMode: Mode, newPosition: Position) => {
    const params = new URLSearchParams();
    params.set('mode', newMode);
    if (newPosition) params.set('position', newPosition);
    setLocation(`/player-evaluation?${params.toString()}`);
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    updateURL(newMode, position);
  };

  const handlePositionChange = (newPosition: Position) => {
    setPosition(newPosition);
    updateURL(mode, newPosition);
  };

  const players: FusionPlayer[] = fusionData?.data || [];

  return (
    <div className="min-h-screen bg-gray-50 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Compact Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                🚀 Player Evaluation
              </h1>
              <p className="text-sm text-gray-600">
                v3.2 Fusion • 4-directional analysis with xFP rankings
              </p>
            </div>
          </div>
          
          {/* Compact Quadrant Legend */}
          <div className="bg-gray-50 border rounded-lg p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {Object.entries(quadrantInfo).map(([key, info]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={info.color}>{info.icon}</div>
                  <span className="capitalize font-medium">{key[0].toUpperCase()}:</span>
                  <span className="text-gray-600 text-xs">{info.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Compact Controls */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Mode Toggle */}
          <div className="flex gap-1">
            <Button 
              variant={mode === "dynasty" ? "default" : "outline"}
              size="sm"
              onClick={() => handleModeChange("dynasty")}
            >
              Dynasty
            </Button>
            <Button 
              variant={mode === "redraft" ? "default" : "outline"}
              size="sm"
              onClick={() => handleModeChange("redraft")}
            >
              Redraft
            </Button>
          </div>
          
          {/* Position Filter */}
          <div className="flex gap-1">
            <Button 
              variant={!position ? "default" : "outline"}
              size="sm"
              onClick={() => handlePositionChange(undefined)}
            >
              All
            </Button>
            {(["QB", "RB", "WR", "TE"] as const).map((pos) => (
              <Button 
                key={pos}
                variant={position === pos ? "default" : "outline"}
                size="sm"
                onClick={() => handlePositionChange(pos)}
              >
                {pos}
              </Button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading fusion rankings...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 mb-4">Failed to load fusion data</p>
            <Button onClick={() => refetch()} variant="outline">
              Try Again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Compact Summary */}
            <div className="bg-white border rounded-lg p-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-blue-600">{players.length}</div>
                  <div className="text-xs text-gray-600">Players</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-600">v3.2</div>
                  <div className="text-xs text-gray-600">Version</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-purple-600">
                    {mode === "dynasty" ? "Dynasty" : "Redraft"}
                  </div>
                  <div className="text-xs text-gray-600">Mode</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-orange-600">
                    {position || "ALL"}
                  </div>
                  <div className="text-xs text-gray-600">Position</div>
                </div>
              </div>
            </div>

            {/* Player Rankings - Condensed */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Fusion Rankings</CardTitle>
                <CardDescription className="text-sm">
                  4-quadrant fusion scores • Dynasty/Redraft optimized
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {players.slice(0, 30).map((player) => (
                    <div key={player.player_id} className="border-b border-gray-100 p-3 hover:bg-gray-50 transition-colors">
                      {/* Main Row */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="text-sm font-bold text-gray-500 w-6">
                            {player.rank}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold">{player.name}</div>
                            <div className="text-xs text-gray-500">
                              {player.pos} • {player.team} • {player.age}y
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">
                            {player.tier}
                          </Badge>
                          <div className="text-lg font-bold text-blue-600">
                            {player.score}
                          </div>
                        </div>
                      </div>

                      {/* Compact Compass Row */}
                      <div className="flex items-center gap-4 mb-2">
                        {Object.entries(quadrantInfo).map(([key, info]) => (
                          <div key={key} className="flex items-center gap-1.5 flex-1">
                            <div className={`${info.color} flex-shrink-0`}>{info.icon}</div>
                            <div className="flex-1 min-w-0">
                              <Progress 
                                value={player[key as keyof Pick<FusionPlayer, 'north' | 'east' | 'south' | 'west'>]} 
                                className="h-1.5" 
                              />
                            </div>
                            <span className="text-xs font-medium w-6 text-right">
                              {Math.round(player[key as keyof Pick<FusionPlayer, 'north' | 'east' | 'south' | 'west'>])}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Compact Badges */}
                      {player.badges.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {player.badges.map((badge, idx) => (
                            <Badge 
                              key={idx}
                              className={`${getBadgeColor(badge)} text-xs px-1.5 py-0.5`}
                              variant="secondary"
                            >
                              {badge}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}