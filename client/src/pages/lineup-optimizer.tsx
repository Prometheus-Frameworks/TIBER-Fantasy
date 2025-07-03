import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { BarChart, Users, TrendingUp, AlertTriangle } from "lucide-react";

interface OptimizedLineup {
  qb: any;
  rb1: any;
  rb2: any;
  wr1: any;
  wr2: any;
  te: any;
  flex: any;
  def: any;
  k: any;
  totalProjected: number;
  recommendations: string[];
}

interface AnalyticsData {
  lineup: OptimizedLineup;
  trades: any;
  waivers: any;
}

export default function LineupOptimizer() {
  const teamId = 1; // Your team ID

  const { data: lineupData, isLoading: lineupLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/lineup-optimizer`],
  });

  const { data: tradeData, isLoading: tradeLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/trade-analyzer`],
  });

  const { data: waiverData, isLoading: waiverLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/waiver-wire`],
  });

  if (lineupLoading || tradeLoading || waiverLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Analyzing your team with advanced algorithms...</p>
          </div>
        </div>
      </div>
    );
  }

  const lineup = lineupData?.optimizedLineup;
  const confidence = Math.round((lineupData?.confidence || 0) * 100);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Advanced Analytics</h1>
          <p className="text-muted-foreground">
            AI-powered insights for your fantasy team optimization
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <BarChart className="h-3 w-3" />
            Week 18 Analysis
          </Badge>
          <Badge 
            variant={confidence > 80 ? "default" : confidence > 60 ? "secondary" : "destructive"}
            className="flex items-center gap-1"
          >
            <TrendingUp className="h-3 w-3" />
            {confidence}% Confidence
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="lineup" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="lineup">Lineup Optimizer</TabsTrigger>
          <TabsTrigger value="trades">Trade Analyzer</TabsTrigger>
          <TabsTrigger value="waivers">Waiver Wire</TabsTrigger>
        </TabsList>

        {/* Lineup Optimizer Tab */}
        <TabsContent value="lineup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Optimized Lineup
              </CardTitle>
              <CardDescription>
                Projected {lineupData?.projectedPoints?.toFixed(1) || 0} points - 
                Based on matchups, form, and statistical analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Starting Lineup */}
                {[
                  { pos: 'QB', player: lineup?.qb },
                  { pos: 'RB1', player: lineup?.rb1 },
                  { pos: 'RB2', player: lineup?.rb2 },
                  { pos: 'WR1', player: lineup?.wr1 },
                  { pos: 'WR2', player: lineup?.wr2 },
                  { pos: 'TE', player: lineup?.te },
                  { pos: 'FLEX', player: lineup?.flex },
                  { pos: 'DEF', player: lineup?.def },
                  { pos: 'K', player: lineup?.k },
                ].map(({ pos, player }) => (
                  <div key={pos} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{pos}</Badge>
                      <span className="text-sm font-medium">
                        {player?.projectedPoints?.toFixed(1) || 0} pts
                      </span>
                    </div>
                    {player ? (
                      <div>
                        <p className="font-medium">{player.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {player.team} • Avg: {player.avgPoints?.toFixed(1)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No player available</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Recommendations */}
              {lineup?.recommendations && lineup.recommendations.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Optimization Tips
                  </h4>
                  <div className="space-y-2">
                    {lineup.recommendations.map((rec: string, index: number) => (
                      <div key={index} className="flex items-start gap-2 p-2 bg-muted/50 rounded">
                        <span className="text-xs bg-primary text-primary-foreground rounded px-1.5 py-0.5 mt-0.5">
                          {index + 1}
                        </span>
                        <p className="text-sm">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trade Analyzer Tab */}
        <TabsContent value="trades" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Team Needs</CardTitle>
                <CardDescription>Positions requiring improvement</CardDescription>
              </CardHeader>
              <CardContent>
                {tradeData?.teamNeeds?.length > 0 ? (
                  <div className="space-y-2">
                    {tradeData.teamNeeds.map((need: string) => (
                      <Badge key={need} variant="destructive">{need}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No critical needs identified</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Trade Targets</CardTitle>
                <CardDescription>High-value players to pursue</CardDescription>
              </CardHeader>
              <CardContent>
                {tradeData?.tradeTargets?.length > 0 ? (
                  <div className="space-y-3">
                    {tradeData.tradeTargets.slice(0, 5).map((player: any) => (
                      <div key={player.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium">{player.name}</p>
                          <p className="text-sm text-muted-foreground">{player.team} {player.position}</p>
                        </div>
                        <Badge>{player.avgPoints?.toFixed(1)} avg</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No trade targets identified</p>
                )}
              </CardContent>
            </Card>
          </div>

          {tradeData?.recommendations && (
            <Card>
              <CardHeader>
                <CardTitle>Trade Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tradeData.recommendations.map((rec: string, index: number) => (
                    <div key={index} className="p-3 bg-muted/50 rounded">
                      <p className="text-sm">{rec}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Waiver Wire Tab */}
        <TabsContent value="waivers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Priority Pickups</CardTitle>
              <CardDescription>
                Top waiver wire targets for your team ({waiverData?.totalAvailable || 0} players available)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {waiverData?.priorityPickups?.length > 0 ? (
                <div className="space-y-4">
                  {waiverData.priorityPickups.map((player: any, index: number) => (
                    <div key={player.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                          {index + 1}
                        </Badge>
                        <div>
                          <p className="font-medium">{player.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {player.team} {player.position} • {player.ownershipPercentage}% owned
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{player.reason}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{player.projectedPoints?.toFixed(1)} pts</p>
                        <p className="text-sm text-muted-foreground">Priority: {player.priority?.toFixed(1)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No priority pickups identified</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}