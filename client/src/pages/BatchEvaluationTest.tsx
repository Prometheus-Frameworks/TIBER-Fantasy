import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Users, Target, Zap, AlertTriangle, Trophy } from "lucide-react";

interface BatchResult {
  QB: any[];
  RB: any[];
  WR: any[];
  TE: any[];
  totalEvaluated: number;
  errorCount: number;
  rejectedPre2024: number;
}

export default function BatchEvaluationTest() {
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const runBatchTest = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/analytics/batch-evaluation-test');
      const data = await response.json();
      
      if (data.success) {
        setTestResults(data.data);
        toast({
          title: "Batch Test Completed",
          description: `Evaluated ${data.data.fullResults.totalEvaluated} players across all positions`,
        });
      } else {
        throw new Error(data.error || 'Batch test failed');
      }
    } catch (error: any) {
      console.error('Batch test error:', error);
      toast({
        title: "Batch Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getContextGrade = (score: number) => {
    if (score >= 80) return { grade: "ELITE", color: "bg-purple-500" };
    if (score >= 65) return { grade: "STRONG", color: "bg-green-500" };
    if (score >= 45) return { grade: "SOLID", color: "bg-yellow-500" };
    if (score >= 25) return { grade: "DEPTH", color: "bg-orange-500" };
    return { grade: "AVOID", color: "bg-red-500" };
  };

  const renderPositionResults = (position: string, players: any[]) => {
    if (!players || players.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {position} Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">No {position} players evaluated</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {position} Results ({players.length})
            </div>
            <Badge variant="outline">{players.length} players</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {players.map((player: any, index: number) => {
              const gradeInfo = getContextGrade(player.contextScore);
              return (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{player.playerName}</h4>
                    <Badge className={`${gradeInfo.color} text-white`}>
                      {gradeInfo.grade} ({player.contextScore})
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    {Object.entries(player.subScores || {}).map(([key, value]: [string, any]) => (
                      <div key={key} className="text-center">
                        <div className="text-xs font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                        <Progress value={value} className="h-1 mt-1" />
                        <div className="text-xs text-gray-500">{value.toFixed(0)}</div>
                      </div>
                    ))}
                  </div>

                  {player.tags && player.tags.length > 0 && (
                    <div className="mb-2">
                      <div className="flex flex-wrap gap-1">
                        {player.tags.map((tag: string, tagIndex: number) => (
                          <Badge key={tagIndex} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-600 max-h-16 overflow-y-auto">
                    {player.logs && player.logs.slice(0, 3).map((log: string, logIndex: number) => (
                      <div key={logIndex}>• {log}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
            <Zap className="h-8 w-8" />
            Batch Fantasy Evaluator
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Parallel multi-position evaluation system integrating QB, RB, WR, and TE analysis modules
          </p>
        </div>

        {/* Methodology Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Parallel Processing Framework
            </CardTitle>
            <CardDescription>
              Comprehensive batch evaluation using Promise.all for efficient multi-position analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">QB</div>
                <div className="text-sm font-medium">Environment Context</div>
                <div className="text-xs text-gray-500">Rushing upside, EPA, scheme fit</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">RB</div>
                <div className="text-sm font-medium">TD Sustainability</div>
                <div className="text-xs text-gray-500">Goal line work, competition</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">WR</div>
                <div className="text-sm font-medium">Forecast Score</div>
                <div className="text-xs text-gray-500">Usage, efficiency, role security</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">TE</div>
                <div className="text-sm font-medium">Dynasty Evaluation</div>
                <div className="text-xs text-gray-500">Usage, TD regression, volatility</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Interface */}
        <Card>
          <CardHeader>
            <CardTitle>Batch Evaluation Test</CardTitle>
            <CardDescription>
              Run test batch with multiple position players to validate parallel processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={runBatchTest} 
              disabled={loading}
              className="w-full"
            >
              {loading ? "Running Batch Evaluation..." : "Run Batch Fantasy Evaluator Test"}
            </Button>

            {testResults && (
              <div className="mt-6 space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{testResults.fullResults.totalEvaluated}</div>
                      <div className="text-sm text-gray-600">Total Evaluated</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {testResults.fullResults.QB.length + testResults.fullResults.RB.length + 
                         testResults.fullResults.WR.length + testResults.fullResults.TE.length}
                      </div>
                      <div className="text-sm text-gray-600">Successfully Processed</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">{testResults.fullResults.errorCount}</div>
                      <div className="text-sm text-gray-600">Errors</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">{testResults.fullResults.rejectedPre2024}</div>
                      <div className="text-sm text-gray-600">Pre-2024 Rejected</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Position-specific Results */}
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="all">All Positions</TabsTrigger>
                    <TabsTrigger value="qb">QB ({testResults.fullResults.QB.length})</TabsTrigger>
                    <TabsTrigger value="rb">RB ({testResults.fullResults.RB.length})</TabsTrigger>
                    <TabsTrigger value="wr">WR ({testResults.fullResults.WR.length})</TabsTrigger>
                    <TabsTrigger value="te">TE ({testResults.fullResults.TE.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="all" className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {renderPositionResults("QB", testResults.fullResults.QB)}
                      {renderPositionResults("RB", testResults.fullResults.RB)}
                      {renderPositionResults("WR", testResults.fullResults.WR)}
                      {renderPositionResults("TE", testResults.fullResults.TE)}
                    </div>
                  </TabsContent>

                  <TabsContent value="qb">
                    {renderPositionResults("QB", testResults.fullResults.QB)}
                  </TabsContent>

                  <TabsContent value="rb">
                    {renderPositionResults("RB", testResults.fullResults.RB)}
                  </TabsContent>

                  <TabsContent value="wr">
                    {renderPositionResults("WR", testResults.fullResults.WR)}
                  </TabsContent>

                  <TabsContent value="te">
                    {renderPositionResults("TE", testResults.fullResults.TE)}
                  </TabsContent>
                </Tabs>

                {/* Methodology Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Evaluation Methodology</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {testResults.methodology.features.map((feature: string, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}