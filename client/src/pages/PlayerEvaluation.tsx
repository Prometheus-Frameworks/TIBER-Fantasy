import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Compass, TrendingUp, Shield, DollarSign, Star, Activity, Target, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

type Mode = "dynasty" | "redraft";
type Position = "QB" | "RB" | "WR" | "TE" | undefined;
type PredictionPosition = "QB" | "RB" | "WR" | "TE";

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

// Prediction data interfaces based on the prediction engine
interface WeeklyPrediction {
  run_id: string;
  player_id: string;
  name: string;
  team: string;
  pos: PredictionPosition;
  week: number;
  mean_pts: number;
  ci_low: number;
  ci_high: number;
  compass_breakdown: { N: number; E: number; S: number; W: number };
  reasons: string[];
  our_rank: number;
  ecr_rank?: number;
  ecr_points?: number;
  edge_vs_ecr?: number;
  beat_flag?: boolean;
}

interface PredictionSummary {
  run_id: string;
  total: number;
  beat_count: number;
  by_position: Array<{
    pos: string;
    total: number;
    beat: number;
  }>;
  sample_highlights: Array<{
    name: string;
    pos: string;
    team: string;
    our_rank: number;
    ecr_rank?: number;
    edge?: number;
    reasons: string[];
  }>;
}

interface PredictionResponse {
  summary: PredictionSummary;
  players: WeeklyPrediction[];
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
  const [activeTab, setActiveTab] = useState<"compass" | "predictions">("compass");

  // Helper function to get current week (simplified)
  const getCurrentWeek = () => {
    // Simple week calculation - in production this should use proper week detection
    const now = new Date();
    const startOfSeason = new Date('2024-09-05'); // Approximate start of NFL season
    const diffTime = now.getTime() - startOfSeason.getTime();
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1;
    return Math.max(1, Math.min(18, diffWeeks));
  };

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

  // Fetch prediction data - using public read-only endpoints
  const currentWeek = getCurrentWeek();
  
  const { data: predictionSummary, isLoading: summaryLoading, error: summaryError, refetch: refetchSummary } = useQuery({
    queryKey: ["predictions", "summary", currentWeek],
    queryFn: async () => {
      const response = await fetch('/api/predictions/latest/summary');
      if (!response.ok) throw new Error('Failed to load prediction summary');
      return await response.json();
    },
    retry: 1,
    enabled: activeTab === "predictions"
  });
  
  const { data: predictionPlayers, isLoading: playersLoading, error: playersError, refetch: refetchPlayers } = useQuery({
    queryKey: ["predictions", "players", position, currentWeek],
    queryFn: async () => {
      const posParam = position ? `pos=${position}` : '';
      const params = new URLSearchParams();
      if (position) params.set('pos', position);
      params.set('beat_only', 'false');
      
      const response = await fetch(`/api/predictions/latest/players?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load prediction players');
      return await response.json();
    },
    retry: 1,
    enabled: activeTab === "predictions"
  });
  
  const predictionLoading = summaryLoading || playersLoading;
  const predictionError = summaryError || playersError;
  const refetchPredictions = () => {
    // Invalidate cache for all prediction-related queries
    queryClient.invalidateQueries({ queryKey: ["predictions"] });
    refetchSummary();
    refetchPlayers();
  };
  
  // Combine the data to match the expected PredictionResponse format
  const predictionData = predictionSummary?.success && predictionPlayers?.success ? {
    summary: predictionSummary.data,
    players: predictionPlayers.data
  } : null;

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

  // Helper function to get badge color for prediction beat status
  const getBadgeColorForPrediction = (beatFlag: boolean) => {
    return beatFlag 
      ? "bg-green-100 text-green-800 border-green-300"
      : "bg-red-100 text-red-800 border-red-300";
  };

  // Render predictions tab content
  const renderPredictionsTab = () => {
    if (predictionLoading) {
      return (
        <div className="space-y-4" data-testid="predictions-loading">
          <div className="bg-white border rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="text-center">
                  <Skeleton className="h-6 w-12 mx-auto mb-2" />
                  <Skeleton className="h-3 w-16 mx-auto" />
                </div>
              ))}
            </div>
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="border-b border-gray-100 p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <div className="flex space-x-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      );
    }

    if (predictionError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center" data-testid="predictions-error">
          <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <p className="text-red-800 mb-4">Failed to load prediction data</p>
          <p className="text-sm text-red-600 mb-4">
            {predictionError instanceof Error ? predictionError.message : 'Unknown error occurred'}
          </p>
          <Button onClick={() => refetchPredictions()} variant="outline" data-testid="button-retry-predictions">
            <Clock className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      );
    }

    if (!predictionData || !predictionData.players?.length) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center" data-testid="predictions-empty">
          <Target className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <p className="text-yellow-800 mb-2">No prediction data available</p>
          <p className="text-sm text-yellow-600">
            Predictions may not be available for the current week or selected position.
          </p>
        </div>
      );
    }

    const predictions = predictionData.players;
    const summary = predictionData.summary;

    return (
      <div className="space-y-4">
        {/* Prediction Summary */}
        <div className="bg-white border rounded-lg p-4" data-testid="predictions-summary">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Prediction Summary</h3>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refetchPredictions}
              data-testid="button-refresh-predictions"
            >
              <Clock className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-blue-600" data-testid="text-total-predictions">
                {summary.total}
              </div>
              <div className="text-xs text-gray-600">Total Predictions</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600" data-testid="text-beat-ecr-count">
                {summary.beat_count}
              </div>
              <div className="text-xs text-gray-600">Beat ECR</div>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-600" data-testid="text-week">
                Week {currentWeek}
              </div>
              <div className="text-xs text-gray-600">Current Week</div>
            </div>
            <div>
              <div className="text-lg font-bold text-orange-600" data-testid="text-beat-rate">
                {summary.total > 0 ? ((summary.beat_count / summary.total) * 100).toFixed(1) : 0}%
              </div>
              <div className="text-xs text-gray-600">Beat Rate</div>
            </div>
          </div>
        </div>

        {/* Predictions List */}
        <Card data-testid="predictions-list">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">ECR-Beating Predictions</CardTitle>
            <CardDescription className="text-sm">
              Weekly point projections with confidence intervals and ECR comparison
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {predictions.slice(0, 30).map((prediction: WeeklyPrediction) => (
                <div 
                  key={prediction.player_id} 
                  className="border-b border-gray-100 p-4 hover:bg-gray-50 transition-colors"
                  data-testid={`card-prediction-${prediction.player_id}`}
                >
                  {/* Main Row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-sm font-bold text-gray-500 w-6" data-testid={`text-our-rank-${prediction.player_id}`}>
                        {prediction.our_rank}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold" data-testid={`text-prediction-name-${prediction.player_id}`}>
                          {prediction.name}
                        </div>
                        <div className="text-xs text-gray-500" data-testid={`text-prediction-details-${prediction.player_id}`}>
                          {prediction.pos} • {prediction.team} • Week {prediction.week}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {prediction.beat_flag !== undefined && (
                        <Badge 
                          className={`text-xs ${getBadgeColorForPrediction(prediction.beat_flag)}`}
                          data-testid={`badge-beat-flag-${prediction.player_id}`}
                        >
                          {prediction.beat_flag ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Beats ECR
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3 w-3 mr-1" />
                              No Edge
                            </>
                          )}
                        </Badge>
                      )}
                      <div className="text-lg font-bold text-blue-600" data-testid={`text-predicted-points-${prediction.player_id}`}>
                        {prediction.mean_pts.toFixed(1)}
                      </div>
                    </div>
                  </div>

                  {/* Prediction Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 text-sm">
                    <div>
                      <div className="font-medium text-gray-700">Confidence Interval</div>
                      <div className="text-gray-600" data-testid={`text-confidence-interval-${prediction.player_id}`}>
                        {prediction.ci_low.toFixed(1)} - {prediction.ci_high.toFixed(1)} pts
                      </div>
                    </div>
                    {prediction.ecr_rank && prediction.ecr_points && (
                      <div>
                        <div className="font-medium text-gray-700">ECR Comparison</div>
                        <div className="text-gray-600" data-testid={`text-ecr-comparison-${prediction.player_id}`}>
                          Rank {prediction.ecr_rank} ({prediction.ecr_points.toFixed(1)} pts)
                        </div>
                      </div>
                    )}
                    {prediction.edge_vs_ecr !== undefined && (
                      <div>
                        <div className="font-medium text-gray-700">Edge vs ECR</div>
                        <div 
                          className={`font-medium ${prediction.edge_vs_ecr > 0 ? 'text-green-600' : 'text-red-600'}`}
                          data-testid={`text-edge-vs-ecr-${prediction.player_id}`}
                        >
                          {prediction.edge_vs_ecr > 0 ? '+' : ''}{prediction.edge_vs_ecr.toFixed(1)} pts
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Compass Breakdown */}
                  <div className="mb-3">
                    <div className="font-medium text-gray-700 mb-2">Compass Breakdown</div>
                    <div className="flex items-center gap-4">
                      {Object.entries(quadrantInfo).map(([key, info]) => {
                        const compassKey = key.toUpperCase() as keyof typeof prediction.compass_breakdown;
                        const value = prediction.compass_breakdown[compassKey];
                        return (
                          <div key={key} className="flex items-center gap-1.5 flex-1">
                            <div className={`${info.color} flex-shrink-0`}>{info.icon}</div>
                            <div className="flex-1 min-w-0">
                              <Progress 
                                value={value} 
                                className="h-2" 
                                data-testid={`progress-compass-${key}-${prediction.player_id}`}
                              />
                            </div>
                            <span className="text-xs font-medium w-6 text-right" data-testid={`text-compass-${key}-${prediction.player_id}`}>
                              {Math.round(value)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reasoning */}
                  {prediction.reasons && prediction.reasons.length > 0 && (
                    <div>
                      <div className="font-medium text-gray-700 mb-1">Analysis</div>
                      <div className="space-y-1">
                        {prediction.reasons.map((reason: string, idx: number) => (
                          <div 
                            key={idx} 
                            className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded"
                            data-testid={`text-reason-${idx}-${prediction.player_id}`}
                          >
                            {reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

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

        {/* Tab Content */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "compass" | "predictions")} data-testid="evaluation-tabs">
          <TabsList className="grid w-full grid-cols-2" data-testid="evaluation-tabs-list">
            <TabsTrigger value="compass" data-testid="tab-compass">
              <Compass className="h-4 w-4 mr-2" />
              Compass
            </TabsTrigger>
            <TabsTrigger value="predictions" data-testid="tab-predictions">
              <Target className="h-4 w-4 mr-2" />
              Predictions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compass" data-testid="compass-content">
            {isLoading ? (
              <div className="text-center py-12" data-testid="compass-loading">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading fusion rankings...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center" data-testid="compass-error">
                <p className="text-red-800 mb-4">Failed to load fusion data</p>
                <Button onClick={() => refetch()} variant="outline" data-testid="button-retry-compass">
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Compact Summary */}
                <div className="bg-white border rounded-lg p-3" data-testid="compass-summary">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-600" data-testid="text-player-count">{players.length}</div>
                      <div className="text-xs text-gray-600">Players</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-600">v3.2</div>
                      <div className="text-xs text-gray-600">Version</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-purple-600" data-testid="text-mode">
                        {mode === "dynasty" ? "Dynasty" : "Redraft"}
                      </div>
                      <div className="text-xs text-gray-600">Mode</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-orange-600" data-testid="text-position">
                        {position || "ALL"}
                      </div>
                      <div className="text-xs text-gray-600">Position</div>
                    </div>
                  </div>
                </div>

                {/* Player Rankings - Condensed */}
                <Card data-testid="compass-rankings">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Fusion Rankings</CardTitle>
                    <CardDescription className="text-sm">
                      4-quadrant fusion scores • Dynasty/Redraft optimized
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="space-y-1">
                      {players.slice(0, 30).map((player) => (
                        <div key={player.player_id} className="border-b border-gray-100 p-3 hover:bg-gray-50 transition-colors" data-testid={`card-player-${player.player_id}`}>
                          {/* Main Row */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="text-sm font-bold text-gray-500 w-6" data-testid={`text-rank-${player.player_id}`}>
                                {player.rank}
                              </div>
                              <div className="flex-1">
                                <div className="font-semibold" data-testid={`text-name-${player.player_id}`}>{player.name}</div>
                                <div className="text-xs text-gray-500" data-testid={`text-details-${player.player_id}`}>
                                  {player.pos} • {player.team} • {player.age}y
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="text-xs" data-testid={`badge-tier-${player.player_id}`}>
                                {player.tier}
                              </Badge>
                              <div className="text-lg font-bold text-blue-600" data-testid={`text-score-${player.player_id}`}>
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
                                    data-testid={`progress-${key}-${player.player_id}`}
                                  />
                                </div>
                                <span className="text-xs font-medium w-6 text-right" data-testid={`text-${key}-score-${player.player_id}`}>
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
                                  data-testid={`badge-${badge.toLowerCase().replace(/\s+/g, '-')}-${player.player_id}`}
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
          </TabsContent>

          <TabsContent value="predictions" data-testid="predictions-content">
            {renderPredictionsTab()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}