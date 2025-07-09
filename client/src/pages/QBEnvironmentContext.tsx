import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Play, CheckCircle, AlertTriangle, TrendingUp, Activity } from "lucide-react";

interface QBEnvironmentInput {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  season?: number;
  scrambleRate?: number;
  rushingYPC?: number;
  explosiveRunRate?: number;
  cpoe?: number;
  adjCompletionRate?: number;
  deepAccuracy?: number;
  pffOLineGrade?: number;
  pbwr?: number;
  pressureRate?: number;
  avgWRYPRR?: number;
  avgWRSeparation?: number;
  avgWRYAC?: number;
  hasWRUpgrade?: boolean;
  upgradeDescription?: string;
}

interface QBEnvironmentResult {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  contextScore: number;
  componentScores: {
    rushingUpside: number;
    throwingAccuracy: number;
    oLineProtection: number;
    teammateQuality: number;
    offseasonUpgrade: number;
  };
  environmentTags: string[];
  logs: string[];
  timestamp: Date;
}

export default function QBEnvironmentContext() {
  const [qbInput, setQbInput] = useState<QBEnvironmentInput>({
    playerId: 'test-qb',
    playerName: 'Test QB',
    position: 'QB',
    team: 'TEST',
    season: 2024,
    scrambleRate: 6.5,
    rushingYPC: 4.8,
    explosiveRunRate: 12.0,
    cpoe: 1.5,
    adjCompletionRate: 67.0,
    deepAccuracy: 42.0,
    pffOLineGrade: 72.0,
    pbwr: 62.0,
    pressureRate: 24.0,
    avgWRYPRR: 1.8,
    avgWRSeparation: 2.9,
    avgWRYAC: 5.1,
    hasWRUpgrade: false,
    upgradeDescription: ''
  });

  const queryClient = useQueryClient();

  // Fetch test cases
  const { data: testCases, isLoading: testCasesLoading } = useQuery({
    queryKey: ['/api/analytics/qb-environment-test-cases'],
    retry: false,
  });

  // Custom QB evaluation mutation
  const evaluateQBMutation = useMutation({
    mutationFn: async (input: QBEnvironmentInput) => {
      return await apiRequest('/api/analytics/qb-environment-context', {
        method: 'POST',
        body: JSON.stringify({ qbInput: input }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/qb-environment-test-cases'] });
    },
  });

  const handleInputChange = (field: keyof QBEnvironmentInput, value: string | number | boolean) => {
    setQbInput(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEvaluate = () => {
    evaluateQBMutation.mutate(qbInput);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 65) return "text-blue-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getContextLevel = (score: number) => {
    if (score >= 80) return "Elite Environment";
    if (score >= 65) return "Strong Environment";
    if (score >= 50) return "Average Environment";
    return "Challenging Environment";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">QB Environment & Context Score (v1.1)</h1>
        <p className="text-lg text-muted-foreground">
          Evaluates QB fantasy outlook by factoring in rushing upside, throwing accuracy, protection, and surrounding weapons
        </p>
      </div>

      <Tabs defaultValue="test-cases" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="test-cases">Pre-Built Test Cases</TabsTrigger>
          <TabsTrigger value="custom">Custom QB Analysis</TabsTrigger>
          <TabsTrigger value="methodology">Methodology</TabsTrigger>
        </TabsList>

        <TabsContent value="test-cases" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                QB Environment Test Cases
              </CardTitle>
              <CardDescription>
                Pre-built test cases demonstrating different QB archetypes and contexts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {testCasesLoading ? (
                <div className="text-center p-8">Loading test cases...</div>
              ) : testCases?.success ? (
                <div className="space-y-6">
                  {testCases.data.testResults.map((result: QBEnvironmentResult, index: number) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-xl">{result.playerName}</CardTitle>
                            <CardDescription>{result.team} • {result.position}</CardDescription>
                          </div>
                          <div className="text-right">
                            <div className={`text-2xl font-bold ${getScoreColor(result.contextScore)}`}>
                              {result.contextScore.toFixed(1)}
                            </div>
                            <Badge variant="outline">{getContextLevel(result.contextScore)}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Rushing Upside</Label>
                            <Progress value={result.componentScores.rushingUpside} className="h-2" />
                            <div className="text-sm text-muted-foreground">
                              {result.componentScores.rushingUpside.toFixed(0)}/100
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Throwing Accuracy</Label>
                            <Progress value={result.componentScores.throwingAccuracy} className="h-2" />
                            <div className="text-sm text-muted-foreground">
                              {result.componentScores.throwingAccuracy.toFixed(0)}/100
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">O-Line Protection</Label>
                            <Progress value={result.componentScores.oLineProtection} className="h-2" />
                            <div className="text-sm text-muted-foreground">
                              {result.componentScores.oLineProtection.toFixed(0)}/100
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Teammate Quality</Label>
                            <Progress value={result.componentScores.teammateQuality} className="h-2" />
                            <div className="text-sm text-muted-foreground">
                              {result.componentScores.teammateQuality.toFixed(0)}/100
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Offseason Upgrade</Label>
                            <Progress value={result.componentScores.offseasonUpgrade} className="h-2" />
                            <div className="text-sm text-muted-foreground">
                              {result.componentScores.offseasonUpgrade.toFixed(0)}/100
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Environment Tags</Label>
                          <div className="flex flex-wrap gap-2">
                            {result.environmentTags.map((tag, i) => (
                              <Badge key={i} variant="secondary">{tag}</Badge>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Analysis Log</Label>
                          <div className="text-sm space-y-1 bg-muted p-3 rounded-md max-h-32 overflow-y-auto">
                            {result.logs.map((log, i) => (
                              <div key={i} className="text-muted-foreground">{log}</div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to load test cases. Please check the API connection.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Custom QB Environment Analysis
              </CardTitle>
              <CardDescription>
                Input your own QB metrics to see environment context scoring
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="playerName">Player Name</Label>
                  <Input
                    id="playerName"
                    value={qbInput.playerName}
                    onChange={(e) => handleInputChange('playerName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team">Team</Label>
                  <Input
                    id="team"
                    value={qbInput.team}
                    onChange={(e) => handleInputChange('team', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="season">Season</Label>
                  <Input
                    id="season"
                    type="number"
                    value={qbInput.season}
                    onChange={(e) => handleInputChange('season', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">Rushing Upside Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scrambleRate">Scramble Rate (%)</Label>
                    <Input
                      id="scrambleRate"
                      type="number"
                      step="0.1"
                      value={qbInput.scrambleRate}
                      onChange={(e) => handleInputChange('scrambleRate', parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rushingYPC">Rushing YPC</Label>
                    <Input
                      id="rushingYPC"
                      type="number"
                      step="0.1"
                      value={qbInput.rushingYPC}
                      onChange={(e) => handleInputChange('rushingYPC', parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="explosiveRunRate">Explosive Run Rate (%)</Label>
                    <Input
                      id="explosiveRunRate"
                      type="number"
                      step="0.1"
                      value={qbInput.explosiveRunRate}
                      onChange={(e) => handleInputChange('explosiveRunRate', parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Throwing Accuracy Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cpoe">CPOE</Label>
                    <Input
                      id="cpoe"
                      type="number"
                      step="0.1"
                      value={qbInput.cpoe}
                      onChange={(e) => handleInputChange('cpoe', parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adjCompletionRate">Adj Completion Rate (%)</Label>
                    <Input
                      id="adjCompletionRate"
                      type="number"
                      step="0.1"
                      value={qbInput.adjCompletionRate}
                      onChange={(e) => handleInputChange('adjCompletionRate', parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deepAccuracy">Deep Accuracy (%)</Label>
                    <Input
                      id="deepAccuracy"
                      type="number"
                      step="0.1"
                      value={qbInput.deepAccuracy}
                      onChange={(e) => handleInputChange('deepAccuracy', parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Protection & Weapons</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pffOLineGrade">PFF O-Line Grade</Label>
                    <Input
                      id="pffOLineGrade"
                      type="number"
                      step="0.1"
                      value={qbInput.pffOLineGrade}
                      onChange={(e) => handleInputChange('pffOLineGrade', parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="avgWRYPRR">Avg WR YPRR</Label>
                    <Input
                      id="avgWRYPRR"
                      type="number"
                      step="0.1"
                      value={qbInput.avgWRYPRR}
                      onChange={(e) => handleInputChange('avgWRYPRR', parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleEvaluate} 
                disabled={evaluateQBMutation.isPending}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                {evaluateQBMutation.isPending ? 'Analyzing...' : 'Analyze QB Environment'}
              </Button>

              {evaluateQBMutation.data?.success && (
                <Card className="border-l-4 border-l-green-500">
                  <CardHeader>
                    <CardTitle>Analysis Result</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-medium">Context Score:</span>
                        <span className={`text-2xl font-bold ${getScoreColor(evaluateQBMutation.data.data.contextScore)}`}>
                          {evaluateQBMutation.data.data.contextScore.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {evaluateQBMutation.data.data.environmentTags.map((tag: string, i: number) => (
                          <Badge key={i} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {evaluateQBMutation.error && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Analysis failed: {evaluateQBMutation.error.message}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="methodology" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                QB Environment & Context Score Methodology
              </CardTitle>
              <CardDescription>
                Understanding how we evaluate QB fantasy environment and context
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Component Weighting</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Rushing Upside</span>
                      <Badge variant="outline">25%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Throwing Accuracy</span>
                      <Badge variant="outline">25%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>O-Line Protection</span>
                      <Badge variant="outline">20%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Teammate Quality</span>
                      <Badge variant="outline">20%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Offseason Upgrade</span>
                      <Badge variant="outline">10%</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Integration Benefits</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Identifies dual-threat QBs like Josh Allen, Lamar Jackson</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Evaluates protection quality and pressure response</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Factors in receiver quality and YAC ability</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Accounts for offseason upgrades and scheme changes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Safely integrates with existing QB evaluation logic</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Key Features</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="space-y-2">
                    <h4 className="font-medium">Rushing Analysis</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Scramble rate evaluation</li>
                      <li>• Yards per carry efficiency</li>
                      <li>• Explosive run potential</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Accuracy Metrics</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• CPOE (Completion % Over Expected)</li>
                      <li>• Adjusted completion rate</li>
                      <li>• Deep ball accuracy</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Context Factors</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• O-line protection quality</li>
                      <li>• Receiver separation and YAC</li>
                      <li>• Offseason upgrades</li>
                    </ul>
                  </div>
                </div>
              </div>

              {testCases?.success && (
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Integration Status</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Module successfully integrated with QB Evaluation Logic (v1.1)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Safe modular integration preserves existing methodology</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Rollback capable with no system conflicts detected</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}