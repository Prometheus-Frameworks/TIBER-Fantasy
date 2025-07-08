import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, TrendingUp, Zap, Target, Trophy } from "lucide-react";

export default function PrometheusStressTest() {
  const [testResults, setTestResults] = useState<any>(null);

  const stressTest = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/analytics/stress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      return response.json();
    },
    onSuccess: (data) => {
      setTestResults(data.data);
    },
  });

  const runStressTest = () => {
    setTestResults(null);
    stressTest.mutate();
  };

  const exportRankings = async () => {
    const response = await fetch("/api/rankings/dynasty-rankings.json");
    const data = await response.json();
    
    // Download rankings file
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dynasty-rankings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <Zap className="text-blue-500" />
            Prometheus Player Evaluation Stress Test
          </h1>
          <p className="text-gray-600">
            Comprehensive testing across QB, RB, WR, TE positions with 2024 data prioritization
          </p>
        </div>

        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="text-green-500" size={20} />
              Test Configuration
            </CardTitle>
            <CardDescription>
              Test 12 players across 4 positions with full methodology validation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">12</div>
                  <div className="text-sm text-gray-600">Total Players</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">4</div>
                  <div className="text-sm text-gray-600">Positions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">2024</div>
                  <div className="text-sm text-gray-600">Season Data</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">100%</div>
                  <div className="text-sm text-gray-600">Coverage</div>
                </div>
              </div>

              <Separator />

              <div className="flex gap-4">
                <Button
                  onClick={runStressTest}
                  disabled={stressTest.isPending}
                  className="flex-1"
                >
                  {stressTest.isPending ? "Running Stress Test..." : "Start Stress Test"}
                </Button>
                
                {testResults && (
                  <Button
                    onClick={exportRankings}
                    variant="outline"
                    className="flex-1"
                  >
                    Export Rankings
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Progress */}
        {stressTest.isPending && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="text-blue-500 animate-spin" size={20} />
                  <span className="font-medium">Running comprehensive evaluation...</span>
                </div>
                <Progress value={75} className="w-full" />
                <div className="text-sm text-gray-600">
                  Processing QB, RB, WR, TE methodology modules with 2024 data validation
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Results Summary */}
        {testResults && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="text-green-500" size={20} />
                Stress Test Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Summary Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {testResults.summary.testsPassed}
                    </div>
                    <div className="text-sm text-gray-600">Tests Passed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {testResults.summary.testsFailed}
                    </div>
                    <div className="text-sm text-gray-600">Tests Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {testResults.summary.validationErrors}
                    </div>
                    <div className="text-sm text-gray-600">Validation Errors</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {testResults.summary.avgDynastyAdjustment.toFixed(3)}
                    </div>
                    <div className="text-sm text-gray-600">Avg Adjustment</div>
                  </div>
                </div>

                <Separator />

                {/* Success Rate */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Success Rate</span>
                    <span>{Math.round((testResults.summary.testsPassed / testResults.summary.totalPlayers) * 100)}%</span>
                  </div>
                  <Progress 
                    value={(testResults.summary.testsPassed / testResults.summary.totalPlayers) * 100} 
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Position Rankings */}
        {testResults?.positionRankings && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testResults.positionRankings.map((position: any) => (
              <Card key={position.position}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="text-yellow-500" size={20} />
                    {position.position} Rankings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {position.players.map((player: any) => (
                      <div key={player.playerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {player.rank}
                          </div>
                          <div>
                            <div className="font-medium">{player.playerName}</div>
                            <div className="text-sm text-gray-600">
                              Dynasty Value: {player.adjustedDynastyValue.toFixed(1)}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {player.flagged && (
                            <Badge variant="destructive" className="text-xs">
                              Flagged
                            </Badge>
                          )}
                          {player.tags.map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Individual Player Results */}
        {testResults?.results && (
          <Card>
            <CardHeader>
              <CardTitle>Individual Player Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {testResults.results.map((result: any) => (
                  <div key={result.playerId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{result.position}</Badge>
                        <span className="font-medium">{result.playerName}</span>
                        {result.testPassed ? (
                          <CheckCircle size={16} className="text-green-500" />
                        ) : (
                          <AlertCircle size={16} className="text-red-500" />
                        )}
                      </div>
                      <div className="text-sm">
                        Adjustment: {result.dynastyValueAdjustment > 0 ? '+' : ''}{result.dynastyValueAdjustment.toFixed(3)}
                      </div>
                    </div>
                    
                    {result.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {result.tags.map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {result.validationErrors.length > 0 && (
                      <div className="text-red-600 text-sm">
                        Errors: {result.validationErrors.join(', ')}
                      </div>
                    )}

                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-gray-600">View Audit Log</summary>
                      <div className="mt-2 bg-gray-100 p-2 rounded text-xs">
                        {result.auditLog.map((log: string, idx: number) => (
                          <div key={idx}>{log}</div>
                        ))}
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {stressTest.error && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-4 text-red-600">
                <AlertCircle className="mx-auto mb-2" />
                <div>Stress test failed: {(stressTest.error as any).message}</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}