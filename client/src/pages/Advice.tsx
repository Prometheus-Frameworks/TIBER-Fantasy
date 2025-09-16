import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Copy, TrendingUp, TrendingDown, Target, Activity, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Types based on handoff specification
interface BuysSellsPlayer {
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  season: number;
  week: number;
  verdict: 'BUY_HARD' | 'BUY' | 'WATCH_BUY' | 'HOLD' | 'WATCH_SELL' | 'SELL' | 'SELL_HARD';
  verdict_score: number;
  confidence: number;
  gap_z: number;
  signal: number;
  market_momentum: number;
  risk_penalty: number;
  format: 'redraft' | 'dynasty';
  ppr: 'ppr' | 'half' | 'standard';
  proof: {
    snapShare?: number;
    routesPerGame?: number;
    targetsPerGame?: number;
    rzTouches?: number;
    epaPerPlay?: number;
    yprr?: number;
    yacPerAtt?: number;
    mtfPerTouch?: number;
    teamProe?: number;
    paceRankPercentile?: number;
    olTier?: number;
    sosNext2?: number;
    injuryPracticeScore?: number;
    committeeIndex?: number;
    coachVolatility?: number;
    ecr7dDelta?: number;
    byeWeek?: boolean;
    rostered7dDelta?: number;
    started7dDelta?: number;
    adpRank?: number;
  };
  explanation: string;
  hit_rate?: number;
  created_at: string;
}

// Updated interface to match actual API response structure
interface BuysSellsResponse {
  ok: boolean;
  data: BuysSellsPlayer[];
  meta: {
    updatedAt: string;
    week: number;
    format: string;
    ppr: string;
  };
}

// Utility function to format trade pitch
function formatTradePitch(player: BuysSellsPlayer): string {
  const verdict = player.verdict.replace('_', ' ');
  const confidence = player.confidence >= 0.7 ? 'High' : player.confidence >= 0.5 ? 'Medium' : 'Low';
  const proof = player.proof;
  
  let pitch = `${verdict}: ${player.player_name} (${player.position}, ${player.team})\n`;
  pitch += `Confidence: ${confidence} (${(player.confidence * 100).toFixed(0)}%)\n\n`;
  pitch += `Key Metrics:\n`;
  
  if (proof.snapShare) pitch += `• Snap Share: ${(proof.snapShare * 100).toFixed(1)}%\n`;
  if (proof.routesPerGame) pitch += `• Routes/Game: ${proof.routesPerGame.toFixed(1)}\n`;
  if (proof.targetsPerGame) pitch += `• Targets/Game: ${proof.targetsPerGame.toFixed(1)}\n`;
  if (proof.rzTouches) pitch += `• RZ Touches: ${proof.rzTouches.toFixed(1)}\n`;
  if (proof.ecr7dDelta) pitch += `• ECR 7d Change: ${proof.ecr7dDelta > 0 ? '+' : ''}${proof.ecr7dDelta}\n`;
  if (proof.rostered7dDelta) pitch += `• Rostered % Change: ${proof.rostered7dDelta > 0 ? '+' : ''}${(proof.rostered7dDelta * 100).toFixed(1)}%\n`;
  
  pitch += `\n${player.explanation}`;
  
  return pitch;
}

export default function AdvicePage() {
  const [position, setPosition] = useState<string>('ALL');
  const [format, setFormat] = useState<'redraft' | 'dynasty'>('redraft');
  const [ppr, setPpr] = useState<'ppr' | 'half' | 'standard'>('half');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // API query
  const { data, isLoading, error, refetch } = useQuery<BuysSellsResponse>({
    queryKey: ['/api/buys-sells/recommendations', position, format, ppr],
    queryFn: async () => {
      const params = new URLSearchParams({
        format,
        ppr,
        ...(position !== 'ALL' && { position: position.toLowerCase() })
      });
      
      const response = await fetch(`/api/buys-sells/recommendations?${params}`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  // Filter and sort recommendations
  const filteredRecommendations = useMemo(() => {
    if (!data?.data) return [];
    
    let filtered = data.data;
    
    // Filter by position if not ALL
    if (position !== 'ALL') {
      filtered = filtered.filter(p => p.position.toLowerCase() === position.toLowerCase());
    }
    
    // Sort by verdict priority and confidence
    const verdictPriority = {
      'BUY_HARD': 6,
      'BUY': 5,
      'WATCH_BUY': 4,
      'HOLD': 3,
      'WATCH_SELL': 2,
      'SELL': 1,
      'SELL_HARD': 0
    };
    
    return filtered.sort((a, b) => {
      const priorityDiff = verdictPriority[b.verdict] - verdictPriority[a.verdict];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });
  }, [data?.data, position]);

  // Verdict badge styling
  const getVerdictBadge = (verdict: string) => {
    const baseClasses = "font-semibold text-xs px-3 py-1";
    switch (verdict) {
      case 'BUY_HARD':
        return { variant: 'default' as const, className: `${baseClasses} bg-emerald-600 text-white` };
      case 'BUY':
        return { variant: 'default' as const, className: `${baseClasses} bg-green-500 text-white` };
      case 'WATCH_BUY':
        return { variant: 'secondary' as const, className: `${baseClasses} bg-blue-100 text-blue-800` };
      case 'HOLD':
        return { variant: 'secondary' as const, className: `${baseClasses} bg-gray-100 text-gray-800` };
      case 'WATCH_SELL':
        return { variant: 'destructive' as const, className: `${baseClasses} bg-orange-100 text-orange-800` };
      case 'SELL':
        return { variant: 'destructive' as const, className: `${baseClasses} bg-red-500 text-white` };
      case 'SELL_HARD':
        return { variant: 'destructive' as const, className: `${baseClasses} bg-red-700 text-white` };
      default:
        return { variant: 'secondary' as const, className: baseClasses };
    }
  };

  // Confidence badge styling
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.7) {
      return { label: 'High', className: 'bg-green-100 text-green-800' };
    } else if (confidence >= 0.5) {
      return { label: 'Medium', className: 'bg-yellow-100 text-yellow-800' };
    } else {
      return { label: 'Low', className: 'bg-red-100 text-red-800' };
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = (playerId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(playerId)) {
      newExpanded.delete(playerId);
    } else {
      newExpanded.add(playerId);
    }
    setExpandedRows(newExpanded);
  };

  // Copy trade pitch to clipboard
  const copyTradePitch = async (player: BuysSellsPlayer) => {
    try {
      const pitch = formatTradePitch(player);
      await navigator.clipboard.writeText(pitch);
      toast({
        title: "Trade Pitch Copied",
        description: `${player.verdict.replace('_', ' ')} recommendation for ${player.player_name} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy trade pitch to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="advice-page">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Target className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Trade Advice
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            AI-powered buys and sells recommendations with supporting evidence
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
          <CardDescription>
            Customize your trade recommendations by position, format, and scoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Position</label>
              <Select value={position} onValueChange={setPosition} data-testid="select-position">
                <SelectTrigger>
                  <SelectValue placeholder="All Positions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Positions</SelectItem>
                  <SelectItem value="QB">Quarterback</SelectItem>
                  <SelectItem value="RB">Running Back</SelectItem>
                  <SelectItem value="WR">Wide Receiver</SelectItem>
                  <SelectItem value="TE">Tight End</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Format</label>
              <Select value={format} onValueChange={(value: 'redraft' | 'dynasty') => setFormat(value)} data-testid="select-format">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="redraft">Redraft</SelectItem>
                  <SelectItem value="dynasty">Dynasty</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Scoring</label>
              <Select value={ppr} onValueChange={(value: 'ppr' | 'half' | 'standard') => setPpr(value)} data-testid="select-scoring">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ppr">PPR</SelectItem>
                  <SelectItem value="half">Half PPR</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Recommendations</span>
            </div>
            {data?.meta?.updatedAt && (
              <div className="flex items-center space-x-1 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                <span>Updated {new Date(data.meta.updatedAt).toLocaleString()}</span>
              </div>
            )}
          </CardTitle>
          <CardDescription>
            Trade recommendations sorted by priority and confidence
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Loading state */}
          {isLoading && (
            <div className="space-y-3" data-testid="loading-state">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center space-x-4 p-4 border rounded">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-4 bg-gray-200 rounded w-16" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                  <div className="h-4 bg-gray-200 rounded flex-1" />
                  <div className="h-4 bg-gray-200 rounded w-24" />
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="p-6 rounded border border-red-300 text-red-700 bg-red-50" data-testid="error-state">
              <div className="font-medium">Failed to load recommendations</div>
              <div className="text-sm mt-1">{(error as Error).message}</div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetch()} 
                className="mt-3"
                data-testid="button-retry"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Recommendations table */}
          {!isLoading && !error && (
            <div className="space-y-2" data-testid="recommendations-table">
              {filteredRecommendations.length === 0 ? (
                <div className="text-center py-8 text-gray-500" data-testid="no-recommendations">
                  No recommendations available for the selected filters
                </div>
              ) : (
                filteredRecommendations.map((player) => {
                  const verdictBadge = getVerdictBadge(player.verdict);
                  const confidenceBadge = getConfidenceBadge(player.confidence);
                  const isExpanded = expandedRows.has(player.player_id);

                  return (
                    <Collapsible key={player.player_id} open={isExpanded} onOpenChange={() => toggleRowExpansion(player.player_id)}>
                      <div className="border rounded-lg overflow-hidden">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer transition-colors" data-testid={`row-player-${player.player_id}`}>
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0">
                                <div className="font-medium text-gray-900">{player.player_name}</div>
                                <div className="text-sm text-gray-500">{player.position} • {player.team}</div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3">
                              <Badge className={verdictBadge.className} data-testid={`badge-verdict-${player.player_id}`}>
                                {player.verdict.replace('_', ' ')}
                              </Badge>

                              <Badge className={`text-xs px-2 py-1 ${confidenceBadge.className}`} data-testid={`badge-confidence-${player.player_id}`}>
                                {confidenceBadge.label}
                              </Badge>

                              <div className="hidden md:block text-sm text-gray-600 max-w-xs truncate">
                                {player.explanation}
                              </div>

                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyTradePitch(player);
                                  }}
                                  data-testid={`button-copy-${player.player_id}`}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                )}
                              </div>
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="border-t bg-gray-50 p-4 space-y-4" data-testid={`expanded-details-${player.player_id}`}>
                            {/* Explanation */}
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Analysis</h4>
                              <p className="text-sm text-gray-700">{player.explanation}</p>
                            </div>

                            {/* Proof metrics */}
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Supporting Metrics</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {player.proof.snapShare && (
                                  <div className="text-sm">
                                    <div className="text-gray-500">Snap Share</div>
                                    <div className="font-medium">{(player.proof.snapShare * 100).toFixed(1)}%</div>
                                  </div>
                                )}
                                {player.proof.routesPerGame && (
                                  <div className="text-sm">
                                    <div className="text-gray-500">Routes/Game</div>
                                    <div className="font-medium">{player.proof.routesPerGame.toFixed(1)}</div>
                                  </div>
                                )}
                                {player.proof.targetsPerGame && (
                                  <div className="text-sm">
                                    <div className="text-gray-500">Targets/Game</div>
                                    <div className="font-medium">{player.proof.targetsPerGame.toFixed(1)}</div>
                                  </div>
                                )}
                                {player.proof.rzTouches && (
                                  <div className="text-sm">
                                    <div className="text-gray-500">RZ Touches</div>
                                    <div className="font-medium">{player.proof.rzTouches.toFixed(1)}</div>
                                  </div>
                                )}
                                {player.proof.epaPerPlay && (
                                  <div className="text-sm">
                                    <div className="text-gray-500">EPA/Play</div>
                                    <div className="font-medium">{player.proof.epaPerPlay.toFixed(2)}</div>
                                  </div>
                                )}
                                {player.proof.ecr7dDelta && (
                                  <div className="text-sm">
                                    <div className="text-gray-500">ECR 7d Change</div>
                                    <div className={`font-medium ${player.proof.ecr7dDelta > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {player.proof.ecr7dDelta > 0 ? '+' : ''}{player.proof.ecr7dDelta}
                                    </div>
                                  </div>
                                )}
                                {player.proof.rostered7dDelta && (
                                  <div className="text-sm">
                                    <div className="text-gray-500">Rostered % Change</div>
                                    <div className={`font-medium ${player.proof.rostered7dDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {player.proof.rostered7dDelta > 0 ? '+' : ''}{(player.proof.rostered7dDelta * 100).toFixed(1)}%
                                    </div>
                                  </div>
                                )}
                                {player.proof.injuryPracticeScore !== undefined && (
                                  <div className="text-sm">
                                    <div className="text-gray-500">Injury Risk</div>
                                    <div className="font-medium">{(player.proof.injuryPracticeScore * 100).toFixed(0)}%</div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Score breakdown */}
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Score Breakdown</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <div className="text-gray-500">Verdict Score</div>
                                  <div className="font-medium">{player.verdictScore.toFixed(2)}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500">Confidence</div>
                                  <div className="font-medium">{(player.confidence * 100).toFixed(0)}%</div>
                                </div>
                                <div>
                                  <div className="text-gray-500">Signal Strength</div>
                                  <div className="font-medium">{player.signal.toFixed(2)}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500">Risk Penalty</div>
                                  <div className="font-medium">{player.riskPenalty.toFixed(2)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}