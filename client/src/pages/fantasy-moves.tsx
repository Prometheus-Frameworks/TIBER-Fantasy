import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Trophy, AlertTriangle, Calendar, Target, ArrowUpDown } from "lucide-react";

interface FantasyMove {
  id: string;
  type: 'trade' | 'draft' | 'waiver' | 'free_agent';
  date: string;
  description: string;
  
  // Assets involved
  playersGained: { name: string; position: string; valueAtTime: number; currentValue: number }[];
  playersLost: { name: string; position: string; valueAtTime: number; currentValue: number }[];
  picksGained: { pick: string; year: number; value: number }[];
  picksLost: { pick: string; year: number; value: number }[];
  
  // Calculated values
  valueGained: number;
  valueLost: number;
  netValue: number;
  currentNetValue: number;
  valueChangePercent: number;
  
  // Assessment
  impact: 'smash-win' | 'good-move' | 'fair' | 'poor-move' | 'disaster';
  confidence: number;
}

interface MoveStats {
  overview: {
    totalMoves: number;
    wins: number;
    losses: number;
    neutral: number;
    winRate: number;
    totalValueGained: number;
    totalValueLost: number;
    netPortfolioValue: number;
    bestMove: FantasyMove;
    worstMove: FantasyMove;
  };
  analysis: {
    topWins: FantasyMove[];
    topLosses: FantasyMove[];
    smashWins: FantasyMove[];
    disasters: FantasyMove[];
  };
}

export default function FantasyMoves() {
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  
  const { data: moves = [], isLoading: movesLoading } = useQuery({
    queryKey: ['/api/teams/1/moves', selectedType, selectedYear],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedType !== "all") params.set("type", selectedType);
      if (selectedYear !== "all") params.set("year", selectedYear);
      
      return fetch(`/api/teams/1/moves?${params.toString()}`).then(res => res.json());
    }
  });

  const { data: stats, isLoading: statsLoading } = useQuery<MoveStats>({
    queryKey: ['/api/teams/1/moves/stats'],
  });

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'smash-win': return 'bg-green-100 text-green-800 border-green-200';
      case 'good-move': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'fair': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'poor-move': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'disaster': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'smash-win': return <Trophy className="h-4 w-4" />;
      case 'good-move': return <TrendingUp className="h-4 w-4" />;
      case 'fair': return <ArrowUpDown className="h-4 w-4" />;
      case 'poor-move': return <TrendingDown className="h-4 w-4" />;
      case 'disaster': return <AlertTriangle className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const formatValue = (value: number) => {
    return value >= 0 ? `+${value.toLocaleString()}` : value.toLocaleString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (movesLoading || statsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fantasy Moves Tracker</h1>
          <p className="text-muted-foreground">
            Analyze your dynasty moves with value-based scoring to identify wins and losses
          </p>
        </div>
      </div>

      {/* Overview Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.overview.winRate}%
                  </p>
                  <p className="text-sm text-muted-foreground">Win Rate</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {stats.overview.wins} wins, {stats.overview.losses} losses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {formatValue(stats.overview.netPortfolioValue)}
                  </p>
                  <p className="text-sm text-muted-foreground">Net Value</p>
                </div>
                <Target className="h-8 w-8 text-blue-600" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Dynasty points gained/lost
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.analysis?.smashWins?.length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Smash Wins</p>
                </div>
                <Trophy className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                High-impact successes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {stats.overview.totalMoves}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Moves</p>
                </div>
                <Calendar className="h-8 w-8 text-gray-600" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Trades, drafts, waivers
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Move Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="trade">Trades</SelectItem>
            <SelectItem value="draft">Draft Picks</SelectItem>
            <SelectItem value="waiver">Waivers</SelectItem>
            <SelectItem value="free_agent">Free Agents</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2023">2023</SelectItem>
            <SelectItem value="2022">2022</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="all-moves" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all-moves">All Moves</TabsTrigger>
          <TabsTrigger value="top-wins">Top Wins</TabsTrigger>
          <TabsTrigger value="worst-losses">Worst Losses</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="all-moves" className="space-y-4">
          <div className="grid gap-4">
            {moves.map((move: FantasyMove) => (
              <Card key={move.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={getImpactColor(move.impact)}>
                        {getImpactIcon(move.impact)}
                        <span className="ml-1 capitalize">{move.impact.replace('-', ' ')}</span>
                      </Badge>
                      <Badge variant="secondary">
                        {move.type.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(move.date)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-semibold ${move.netValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatValue(move.netValue)}
                      </p>
                      <p className="text-sm text-muted-foreground">Dynasty Points</p>
                    </div>
                  </div>

                  <h3 className="font-semibold mb-3">{move.description}</h3>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Assets Gained */}
                    {(move.playersGained.length > 0 || move.picksGained.length > 0) && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-green-700">Acquired</h4>
                        <div className="space-y-1">
                          {move.playersGained.map((player, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{player.name} ({player.position})</span>
                              <span className="text-green-600">{player.currentValue.toLocaleString()}</span>
                            </div>
                          ))}
                          {move.picksGained.map((pick, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{pick.year} {pick.pick}</span>
                              <span className="text-green-600">{pick.value.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Assets Lost */}
                    {(move.playersLost.length > 0 || move.picksLost.length > 0) && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-red-700">Given Up</h4>
                        <div className="space-y-1">
                          {move.playersLost.map((player, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{player.name} ({player.position})</span>
                              <span className="text-red-600">{player.currentValue.toLocaleString()}</span>
                            </div>
                          ))}
                          {move.picksLost.map((pick, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{pick.year} {pick.pick}</span>
                              <span className="text-red-600">{pick.value.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      Confidence: {move.confidence}%
                    </span>
                    {move.valueChangePercent !== 0 && (
                      <span className={`font-medium ${move.valueChangePercent > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {move.valueChangePercent > 0 ? '+' : ''}{move.valueChangePercent.toFixed(1)}% value change
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="top-wins" className="space-y-4">
          {stats?.analysis.topWins.map((move) => (
            <Card key={move.id} className="border-l-4 border-l-green-500">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-green-700">{move.description}</h3>
                  <Badge className="bg-green-100 text-green-800">
                    +{move.netValue.toLocaleString()} points
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{formatDate(move.date)}</p>
                
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium mb-1">Key Assets Gained:</p>
                    {move.playersGained.slice(0, 2).map((player, idx) => (
                      <p key={idx} className="text-green-600">• {player.name} ({player.currentValue.toLocaleString()} value)</p>
                    ))}
                  </div>
                  <div>
                    <p className="font-medium mb-1">Impact:</p>
                    <p className="text-green-600">{move.valueChangePercent.toFixed(0)}% value increase</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="worst-losses" className="space-y-4">
          {stats?.analysis.topLosses.map((move) => (
            <Card key={move.id} className="border-l-4 border-l-red-500">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-red-700">{move.description}</h3>
                  <Badge variant="destructive">
                    {move.netValue.toLocaleString()} points
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{formatDate(move.date)}</p>
                
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium mb-1">Assets Given Up:</p>
                    {move.playersLost.slice(0, 2).map((player, idx) => (
                      <p key={idx} className="text-red-600">• {player.name} (now {player.currentValue.toLocaleString()} value)</p>
                    ))}
                    {move.picksLost.slice(0, 1).map((pick, idx) => (
                      <p key={idx} className="text-red-600">• {pick.year} {pick.pick} ({pick.value.toLocaleString()} value)</p>
                    ))}
                  </div>
                  <div>
                    <p className="font-medium mb-1">Lessons:</p>
                    <p className="text-red-600">-{Math.abs(move.valueChangePercent).toFixed(0)}% value loss</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Move Type Performance</CardTitle>
                <CardDescription>Success rate by move category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Draft Picks</span>
                    <span className="text-green-600 font-medium">Strong</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waiver Claims</span>
                    <span className="text-green-600 font-medium">Excellent</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Trades</span>
                    <span className="text-orange-600 font-medium">Mixed</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Key Insights</CardTitle>
                <CardDescription>Dynasty management patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="p-3 bg-green-50 rounded border-l-4 border-green-400">
                    <p className="font-medium text-green-800">Strength: Rookie identification</p>
                    <p className="text-green-700">Excellent at finding breakout rookies early</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                    <p className="font-medium text-blue-800">Opportunity: Trade timing</p>
                    <p className="text-blue-700">Consider selling aging assets earlier</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}