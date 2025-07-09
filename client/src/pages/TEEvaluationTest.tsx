import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Target, TrendingUp, AlertTriangle } from "lucide-react";

interface TEEvaluationResult {
  contextScore: number;
  logs: string[];
  tags: string[];
  subScores: {
    usageProfile: number;
    efficiency: number;
    tdRegression: number;
    volatilityPenalty: number;
  };
  lastEvaluatedSeason: number;
}

export default function TEEvaluationTest() {
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [customPlayer, setCustomPlayer] = useState({
    season: 2024,
    position: "TE",
    tpRR: 0.15,
    ypRR: 1.4,
    routeParticipation: 0.65,
    redZoneTargetShare: 0.12,
    expectedTDs: 3.0,
    actualTDs: 3,
    targetShare: 0.12,
    catchRateOverExpected: 0.0,
    redZoneTargetConsistency: 0.6,
    age: 26,
    contractYearsRemaining: 2,
    teamEPARank: 16,
    wrTargetCompetition: 1.5,
    qbStabilityScore: 0.6,
    teamPassVolume: 500
  });
  const [customResult, setCustomResult] = useState<TEEvaluationResult | null>(null);
  const { toast } = useToast();

  const runTestCases = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/analytics/te-evaluation-test-cases');
      const data = await response.json();
      
      if (data.success) {
        setTestResults(data.data);
        toast({
          title: "Test Cases Completed",
          description: `Successfully ran ${data.data.testResults.length} TE evaluation test cases`,
        });
      } else {
        throw new Error(data.error || 'Test failed');
      }
    } catch (error: any) {
      console.error('Test error:', error);
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const evaluateCustomPlayer = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/analytics/te-evaluation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ player: customPlayer }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCustomResult(data.evaluation);
        toast({
          title: "Evaluation Complete",
          description: `TE context score: ${data.evaluation.contextScore}`,
        });
      } else {
        throw new Error(data.error || 'Evaluation failed');
      }
    } catch (error: any) {
      console.error('Evaluation error:', error);
      toast({
        title: "Evaluation Failed",
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            TE Evaluation & Forecast Score v1.1
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Dynasty tight end evaluation using usage profile, efficiency, TD regression, and volatility analysis
          </p>
        </div>

        {/* Methodology Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Methodology Overview
            </CardTitle>
            <CardDescription>
              Four-component scoring system for comprehensive TE dynasty evaluation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">30%</div>
                <div className="text-sm font-medium">Usage Profile</div>
                <div className="text-xs text-gray-500">TPRR, target share, route participation</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">30%</div>
                <div className="text-sm font-medium">Efficiency</div>
                <div className="text-xs text-gray-500">YPRR, catch rate over expected</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">20%</div>
                <div className="text-sm font-medium">TD Regression</div>
                <div className="text-xs text-gray-500">Expected vs actual TDs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">20%</div>
                <div className="text-sm font-medium">Volatility</div>
                <div className="text-xs text-gray-500">Team context, competition</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Interface */}
        <Tabs defaultValue="test-cases" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="test-cases">Run Test Cases</TabsTrigger>
            <TabsTrigger value="custom">Custom Evaluation</TabsTrigger>
          </TabsList>

          <TabsContent value="test-cases" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Test Case Validation</CardTitle>
                <CardDescription>
                  Run predefined test cases to validate TE evaluation methodology
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={runTestCases} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Running Tests..." : "Run TE Evaluation Test Cases"}
                </Button>

                {testResults && (
                  <div className="mt-6 space-y-4">
                    <h3 className="text-lg font-semibold">Test Results</h3>
                    {testResults.testResults.map((result: any, index: number) => {
                      const gradeInfo = getContextGrade(result.evaluation.contextScore);
                      return (
                        <Card key={index}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">
                                Test Case {index + 1}: {result.player.tpRR > 0.18 ? "Elite Usage" : result.player.ypRR > 1.7 ? "High Efficiency" : "Standard Profile"}
                              </CardTitle>
                              <Badge className={`${gradeInfo.color} text-white`}>
                                {gradeInfo.grade} ({result.evaluation.contextScore})
                              </Badge>
                            </div>
                            <CardDescription>{result.expectedOutcome}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                              <div>
                                <div className="text-sm font-medium">Usage Profile</div>
                                <Progress 
                                  value={result.evaluation.subScores.usageProfile} 
                                  className="h-2 mt-1"
                                />
                                <div className="text-xs text-gray-500 mt-1">
                                  {result.evaluation.subScores.usageProfile.toFixed(0)}%
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium">Efficiency</div>
                                <Progress 
                                  value={result.evaluation.subScores.efficiency} 
                                  className="h-2 mt-1"
                                />
                                <div className="text-xs text-gray-500 mt-1">
                                  {result.evaluation.subScores.efficiency.toFixed(0)}%
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium">TD Regression</div>
                                <Progress 
                                  value={result.evaluation.subScores.tdRegression} 
                                  className="h-2 mt-1"
                                />
                                <div className="text-xs text-gray-500 mt-1">
                                  {result.evaluation.subScores.tdRegression.toFixed(0)}%
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium">Volatility</div>
                                <Progress 
                                  value={result.evaluation.subScores.volatilityPenalty} 
                                  className="h-2 mt-1"
                                />
                                <div className="text-xs text-gray-500 mt-1">
                                  {result.evaluation.subScores.volatilityPenalty.toFixed(0)}%
                                </div>
                              </div>
                            </div>

                            {result.evaluation.tags.length > 0 && (
                              <div className="mb-3">
                                <div className="text-sm font-medium mb-2">Tags:</div>
                                <div className="flex flex-wrap gap-1">
                                  {result.evaluation.tags.map((tag: string, tagIndex: number) => (
                                    <Badge key={tagIndex} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div>
                              <div className="text-sm font-medium mb-2">Evaluation Logs:</div>
                              <div className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                                {result.evaluation.logs.map((log: string, logIndex: number) => (
                                  <div key={logIndex}>• {log}</div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Custom TE Evaluation</CardTitle>
                <CardDescription>
                  Input custom player data to test TE evaluation methodology
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="tpRR">TPRR</Label>
                    <Input
                      id="tpRR"
                      type="number"
                      step="0.01"
                      value={customPlayer.tpRR}
                      onChange={(e) => setCustomPlayer(prev => ({ ...prev, tpRR: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ypRR">YPRR</Label>
                    <Input
                      id="ypRR"
                      type="number"
                      step="0.1"
                      value={customPlayer.ypRR}
                      onChange={(e) => setCustomPlayer(prev => ({ ...prev, ypRR: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="targetShare">Target Share</Label>
                    <Input
                      id="targetShare"
                      type="number"
                      step="0.01"
                      value={customPlayer.targetShare}
                      onChange={(e) => setCustomPlayer(prev => ({ ...prev, targetShare: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="expectedTDs">Expected TDs</Label>
                    <Input
                      id="expectedTDs"
                      type="number"
                      step="0.1"
                      value={customPlayer.expectedTDs}
                      onChange={(e) => setCustomPlayer(prev => ({ ...prev, expectedTDs: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="actualTDs">Actual TDs</Label>
                    <Input
                      id="actualTDs"
                      type="number"
                      value={customPlayer.actualTDs}
                      onChange={(e) => setCustomPlayer(prev => ({ ...prev, actualTDs: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      value={customPlayer.age}
                      onChange={(e) => setCustomPlayer(prev => ({ ...prev, age: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="teamEPARank">Team EPA Rank</Label>
                    <Input
                      id="teamEPARank"
                      type="number"
                      min="1"
                      max="32"
                      value={customPlayer.teamEPARank}
                      onChange={(e) => setCustomPlayer(prev => ({ ...prev, teamEPARank: parseInt(e.target.value) || 16 }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="qbStabilityScore">QB Stability</Label>
                    <Input
                      id="qbStabilityScore"
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={customPlayer.qbStabilityScore}
                      onChange={(e) => setCustomPlayer(prev => ({ ...prev, qbStabilityScore: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <Button 
                  onClick={evaluateCustomPlayer} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Evaluating..." : "Evaluate TE"}
                </Button>

                {customResult && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Custom Evaluation Result</CardTitle>
                        <Badge className={`${getContextGrade(customResult.contextScore).color} text-white`}>
                          {getContextGrade(customResult.contextScore).grade} ({customResult.contextScore})
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <div className="text-sm font-medium">Usage Profile</div>
                          <Progress 
                            value={customResult.subScores.usageProfile} 
                            className="h-2 mt-1"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            {customResult.subScores.usageProfile.toFixed(0)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium">Efficiency</div>
                          <Progress 
                            value={customResult.subScores.efficiency} 
                            className="h-2 mt-1"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            {customResult.subScores.efficiency.toFixed(0)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium">TD Regression</div>
                          <Progress 
                            value={customResult.subScores.tdRegression} 
                            className="h-2 mt-1"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            {customResult.subScores.tdRegression.toFixed(0)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium">Volatility</div>
                          <Progress 
                            value={customResult.subScores.volatilityPenalty} 
                            className="h-2 mt-1"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            {customResult.subScores.volatilityPenalty.toFixed(0)}%
                          </div>
                        </div>
                      </div>

                      {customResult.tags.length > 0 && (
                        <div className="mb-3">
                          <div className="text-sm font-medium mb-2">Tags:</div>
                          <div className="flex flex-wrap gap-1">
                            {customResult.tags.map((tag: string, tagIndex: number) => (
                              <Badge key={tagIndex} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="text-sm font-medium mb-2">Evaluation Logs:</div>
                        <div className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                          {customResult.logs.map((log: string, logIndex: number) => (
                            <div key={logIndex}>• {log}</div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}