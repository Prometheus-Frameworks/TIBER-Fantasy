import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Target, Zap, BarChart3, Trophy, Activity } from "lucide-react";

interface PrometheusBenchmarkData {
  benchmarks: {
    WR: {
      targetShare: number;
      airYardsShare: number;
      wopr: number;
      spikeGameThreshold: number;
      spikeWeekFrequency: number;
    };
    RB: {
      yardsAfterContact: number;
      targetShare: number;
      fantasyPointsPerGame: number;
      spikeGameThreshold: number;
      spikeWeekFrequency: number;
    };
    QB: {
      rushingYardsPerGame: number;
      fantasyPointsPerGame: number;
      spikeGameThreshold: number;
      spikeWeekFrequency: number;
    };
    spikeCorrelations: Array<{
      metric: string;
      correlation: number;
      description: string;
    }>;
  };
  analysis: {
    title: string;
    description: string;
    keyFindings: string[];
    spikeAnalysis: {
      WR: string;
      RB: string;
      QB: string;
    };
  };
  eliteProfiles: Record<string, {
    position: string;
    fantasyPointsPerGame: number;
    spikeWeeks: string;
    keyMetrics: Record<string, string>;
  }>;
}

export default function PrometheusBenchmarks() {
  const { data: benchmarkData, isLoading, error } = useQuery<PrometheusBenchmarkData>({
    queryKey: ['/api/analytics/prometheus-benchmarks'],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading Prometheus Benchmark Cluster...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !benchmarkData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-red-600">Failed to load benchmark data. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { benchmarks, analysis, eliteProfiles } = benchmarkData;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Trophy className="h-8 w-8 text-amber-500" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
            Prometheus Benchmark Cluster
          </h1>
          <Trophy className="h-8 w-8 text-amber-500" />
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          {analysis.description}
        </p>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          2024 NFL Season Analysis
        </Badge>
      </div>

      {/* Key Findings */}
      <Card className="bg-gradient-to-r from-emerald-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            Key Research Findings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {analysis.keyFindings.map((finding, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-sm">{finding}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Elite Player Profiles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Elite Player Analysis
          </CardTitle>
          <CardDescription>
            2024 performance analysis of four premier NFL talents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(eliteProfiles).map(([playerName, profile]) => (
              <Card key={playerName} className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{playerName}</CardTitle>
                    <Badge 
                      variant={profile.position === 'QB' ? 'default' : profile.position === 'RB' ? 'secondary' : 'outline'}
                      className="font-semibold"
                    >
                      {profile.position}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Fantasy PPG</p>
                      <p className="font-bold text-lg">{profile.fantasyPointsPerGame}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Spike Weeks</p>
                      <p className="font-bold text-lg">{profile.spikeWeeks}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {Object.entries(profile.keyMetrics).map(([metric, value]) => (
                      <div key={metric} className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground capitalize">
                          {metric.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Benchmark Thresholds by Position */}
      <Tabs defaultValue="WR" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="WR">Wide Receivers</TabsTrigger>
          <TabsTrigger value="RB">Running Backs</TabsTrigger>
          <TabsTrigger value="QB">Quarterbacks</TabsTrigger>
        </TabsList>

        <TabsContent value="WR" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-600" />
                Wide Receiver Elite Thresholds
              </CardTitle>
              <CardDescription>Based on Ja'Marr Chase's 2024 dominance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Target Share</span>
                      <span className="text-lg font-bold text-emerald-600">{benchmarks.WR.targetShare}%</span>
                    </div>
                    <Progress value={benchmarks.WR.targetShare} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-1">Elite WR1 usage threshold</p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Air Yards Share</span>
                      <span className="text-lg font-bold text-blue-600">{benchmarks.WR.airYardsShare}%</span>
                    </div>
                    <Progress value={benchmarks.WR.airYardsShare} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-1">Deep threat involvement</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">WOPR</span>
                      <span className="text-lg font-bold text-purple-600">{benchmarks.WR.wopr.toFixed(3)}</span>
                    </div>
                    <Progress value={benchmarks.WR.wopr * 100} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-1">Weighted Opportunity Rating</p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Spike Frequency</span>
                      <span className="text-lg font-bold text-amber-600">{benchmarks.WR.spikeWeekFrequency}%</span>
                    </div>
                    <Progress value={benchmarks.WR.spikeWeekFrequency} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-1">Weekly ceiling games</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-emerald-50 p-4 rounded-lg">
                <p className="text-sm text-emerald-800">
                  <strong>Elite Analysis:</strong> {analysis.spikeAnalysis.WR}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="RB" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                Running Back Elite Thresholds
              </CardTitle>
              <CardDescription>Based on Saquon Barkley's 2024 excellence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Fantasy PPG</span>
                      <span className="text-lg font-bold text-emerald-600">{benchmarks.RB.fantasyPointsPerGame}</span>
                    </div>
                    <Progress value={(benchmarks.RB.fantasyPointsPerGame / 30) * 100} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-1">Elite RB production</p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Target Share</span>
                      <span className="text-lg font-bold text-blue-600">{benchmarks.RB.targetShare}%</span>
                    </div>
                    <Progress value={benchmarks.RB.targetShare} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-1">Receiving involvement</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Spike Threshold</span>
                      <span className="text-lg font-bold text-purple-600">{benchmarks.RB.spikeGameThreshold}</span>
                    </div>
                    <Progress value={(benchmarks.RB.spikeGameThreshold / 50) * 100} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-1">Fantasy spike games</p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Spike Frequency</span>
                      <span className="text-lg font-bold text-amber-600">{benchmarks.RB.spikeWeekFrequency}%</span>
                    </div>
                    <Progress value={benchmarks.RB.spikeWeekFrequency} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-1">Weekly ceiling games</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Elite Analysis:</strong> {analysis.spikeAnalysis.RB}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="QB" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                Quarterback Elite Thresholds
              </CardTitle>
              <CardDescription>Based on Lamar Jackson & Josh Allen analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Fantasy PPG</span>
                      <span className="text-lg font-bold text-emerald-600">{benchmarks.QB.fantasyPointsPerGame}</span>
                    </div>
                    <Progress value={(benchmarks.QB.fantasyPointsPerGame / 30) * 100} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-1">Elite QB production</p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Rushing YPG</span>
                      <span className="text-lg font-bold text-blue-600">{benchmarks.QB.rushingYardsPerGame}</span>
                    </div>
                    <Progress value={(benchmarks.QB.rushingYardsPerGame / 80) * 100} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-1">Dual-threat capability</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Spike Threshold</span>
                      <span className="text-lg font-bold text-purple-600">{benchmarks.QB.spikeGameThreshold}</span>
                    </div>
                    <Progress value={(benchmarks.QB.spikeGameThreshold / 50) * 100} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-1">Fantasy spike games</p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Spike Frequency</span>
                      <span className="text-lg font-bold text-amber-600">{benchmarks.QB.spikeWeekFrequency}%</span>
                    </div>
                    <Progress value={benchmarks.QB.spikeWeekFrequency} className="h-3" />
                    <p className="text-xs text-muted-foreground mt-1">Weekly ceiling games</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-800">
                  <strong>Elite Analysis:</strong> {analysis.spikeAnalysis.QB}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Spike Correlations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-600" />
            Spike Week Correlations
          </CardTitle>
          <CardDescription>
            Statistical correlations between advanced metrics and fantasy spike weeks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {benchmarks.spikeCorrelations.map((correlation, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{correlation.metric}</h4>
                  <Badge 
                    variant={correlation.correlation >= 0.8 ? "default" : correlation.correlation >= 0.7 ? "secondary" : "outline"}
                    className="font-mono"
                  >
                    {correlation.correlation.toFixed(2)}
                  </Badge>
                </div>
                <Progress value={correlation.correlation * 100} className="h-2 mb-2" />
                <p className="text-sm text-muted-foreground">{correlation.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Source */}
      <Card className="bg-slate-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Data Source: NFL-Data-Py • 2024 NFL Season</span>
            <span>API: /api/analytics/prometheus-benchmarks</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}