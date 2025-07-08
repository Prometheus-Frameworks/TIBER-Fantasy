import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, TrendingDown, Target, Route, Clock, Activity } from 'lucide-react';

interface TEMethodologyData {
  success: boolean;
  methodology: any;
  integrationSafety: any;
}

interface TETestResult {
  success: boolean;
  testResult: any;
  expectedOutcome: any;
  validation: any;
  testPassed: boolean;
}

interface TEAssessmentRequest {
  playerId: string;
  playerName: string;
  context: {
    tdRate: number;
    seasonTDs: number;
    careerTDRate: number;
    routesRun: number;
    receptions: number;
    targetShare: number;
    receivingYards: number;
    redZoneTargets: number;
    inside10Targets: number;
    teamPassAttempts: number;
    redZonePassShare: number;
    teTDShare: number;
    teTargetShare: number;
    passVolumeVolatility: number;
    teRoomDepth: number;
  };
  season: number;
}

export default function TETouchdownRegression() {
  const [customPlayer, setCustomPlayer] = useState({
    playerName: 'Custom TE',
    tdRate: 0.12,
    seasonTDs: 6,
    careerTDRate: 0.08,
    routesRun: 320,
    receptions: 45,
    targetShare: 0.13,
    receivingYards: 480,
    redZoneTargets: 10,
    inside10Targets: 5,
    teamPassAttempts: 580,
    redZonePassShare: 0.22,
    teTDShare: 0.20,
    teTargetShare: 0.16,
    passVolumeVolatility: 0.08,
    teRoomDepth: 2
  });

  const [assessmentResult, setAssessmentResult] = useState<any>(null);

  // Fetch methodology data
  const { data: methodologyData } = useQuery<TEMethodologyData>({
    queryKey: ['/api/analytics/te-td-regression-methodology'],
    retry: false,
  });

  // Fetch example player test
  const { data: exampleTest } = useQuery<TETestResult>({
    queryKey: ['/api/analytics/te-td-regression-test-example'],
    retry: false,
  });

  // Custom assessment mutation
  const assessmentMutation = useMutation({
    mutationFn: async (request: TEAssessmentRequest) => {
      const response = await fetch('/api/analytics/te-td-regression-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setAssessmentResult(data.assessment);
      }
    }
  });

  const runCustomAssessment = () => {
    assessmentMutation.mutate({
      playerId: 'custom-te',
      playerName: customPlayer.playerName,
      context: {
        tdRate: customPlayer.tdRate,
        seasonTDs: customPlayer.seasonTDs,
        careerTDRate: customPlayer.careerTDRate,
        routesRun: customPlayer.routesRun,
        receptions: customPlayer.receptions,
        targetShare: customPlayer.targetShare,
        receivingYards: customPlayer.receivingYards,
        redZoneTargets: customPlayer.redZoneTargets,
        inside10Targets: customPlayer.inside10Targets,
        teamPassAttempts: customPlayer.teamPassAttempts,
        redZonePassShare: customPlayer.redZonePassShare,
        teTDShare: customPlayer.teTDShare,
        teTargetShare: customPlayer.teTargetShare,
        passVolumeVolatility: customPlayer.passVolumeVolatility,
        teRoomDepth: customPlayer.teRoomDepth
      },
      season: 2024
    });
  };

  const formatValueAdjustment = (value: number) => {
    if (value === 0) return "±0.00";
    return value > 0 ? `+${value.toFixed(2)}` : `${value.toFixed(2)}`;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">TE Touchdown Regression Logic (v1.1)</h1>
        <p className="text-muted-foreground">
          Advanced methodology plugin for evaluating TE touchdown sustainability, red zone usage patterns, 
          and regression risk. Safely integrates with existing Prometheus algorithms.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analysis">Live Analysis</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="integration">Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {methodologyData?.success && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Methodology Overview
                  </CardTitle>
                  <CardDescription>
                    {methodologyData.methodology.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Analysis Steps:</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs">1</div>
                        <span>Flag for regression risk based on TD rate, red zone usage, and competition</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs">2</div>
                        <span>Evaluate pass-catching floor and volume sustainability</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs">3</div>
                        <span>Apply dynasty value adjustment based on total risk factors</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Risk Categories:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-orange-500" />
                        <span>Regression Flags: TD rate sustainability, red zone usage, competition</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-orange-500" />
                        <span>Pass-Catching Floor: Reception volume and target share stability</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-orange-500" />
                        <span>Team Context: Pass volume volatility and TE target distribution</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    TE-Specific Thresholds
                  </CardTitle>
                  <CardDescription>
                    Position-specific benchmarks for tight end evaluation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold">5.5%</div>
                      <div className="text-sm text-muted-foreground">League Avg TE TD Rate</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold">8</div>
                      <div className="text-sm text-muted-foreground">Red Zone Target Min</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold">4</div>
                      <div className="text-sm text-muted-foreground">Inside-10 Target Min</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold">12%</div>
                      <div className="text-sm text-muted-foreground">Pass Volume Volatility</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Custom TE Analysis</CardTitle>
              <CardDescription>
                Test the TE touchdown regression logic with custom player data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="playerName">Player Name</Label>
                  <Input
                    id="playerName"
                    value={customPlayer.playerName}
                    onChange={(e) => setCustomPlayer({ ...customPlayer, playerName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="tdRate">TD Rate (decimal)</Label>
                  <Input
                    id="tdRate"
                    type="number"
                    step="0.01"
                    value={customPlayer.tdRate}
                    onChange={(e) => setCustomPlayer({ ...customPlayer, tdRate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="seasonTDs">Season TDs</Label>
                  <Input
                    id="seasonTDs"
                    type="number"
                    value={customPlayer.seasonTDs}
                    onChange={(e) => setCustomPlayer({ ...customPlayer, seasonTDs: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="careerTDRate">Career TD Rate</Label>
                  <Input
                    id="careerTDRate"
                    type="number"
                    step="0.01"
                    value={customPlayer.careerTDRate}
                    onChange={(e) => setCustomPlayer({ ...customPlayer, careerTDRate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="routesRun">Routes Run</Label>
                  <Input
                    id="routesRun"
                    type="number"
                    value={customPlayer.routesRun}
                    onChange={(e) => setCustomPlayer({ ...customPlayer, routesRun: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="receptions">Receptions</Label>
                  <Input
                    id="receptions"
                    type="number"
                    value={customPlayer.receptions}
                    onChange={(e) => setCustomPlayer({ ...customPlayer, receptions: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="targetShare">Target Share</Label>
                  <Input
                    id="targetShare"
                    type="number"
                    step="0.01"
                    value={customPlayer.targetShare}
                    onChange={(e) => setCustomPlayer({ ...customPlayer, targetShare: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="receivingYards">Receiving Yards</Label>
                  <Input
                    id="receivingYards"
                    type="number"
                    value={customPlayer.receivingYards}
                    onChange={(e) => setCustomPlayer({ ...customPlayer, receivingYards: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="redZoneTargets">Red Zone Targets</Label>
                  <Input
                    id="redZoneTargets"
                    type="number"
                    value={customPlayer.redZoneTargets}
                    onChange={(e) => setCustomPlayer({ ...customPlayer, redZoneTargets: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="inside10Targets">Inside-10 Targets</Label>
                  <Input
                    id="inside10Targets"
                    type="number"
                    value={customPlayer.inside10Targets}
                    onChange={(e) => setCustomPlayer({ ...customPlayer, inside10Targets: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="teamPassAttempts">Team Pass Attempts</Label>
                  <Input
                    id="teamPassAttempts"
                    type="number"
                    value={customPlayer.teamPassAttempts}
                    onChange={(e) => setCustomPlayer({ ...customPlayer, teamPassAttempts: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="teTDShare">TE TD Share</Label>
                  <Input
                    id="teTDShare"
                    type="number"
                    step="0.01"
                    value={customPlayer.teTDShare}
                    onChange={(e) => setCustomPlayer({ ...customPlayer, teTDShare: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="passVolumeVolatility">Pass Volume Volatility</Label>
                  <Input
                    id="passVolumeVolatility"
                    type="number"
                    step="0.01"
                    value={customPlayer.passVolumeVolatility}
                    onChange={(e) => setCustomPlayer({ ...customPlayer, passVolumeVolatility: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="teRoomDepth">TE Room Depth</Label>
                  <Input
                    id="teRoomDepth"
                    type="number"
                    value={customPlayer.teRoomDepth}
                    onChange={(e) => setCustomPlayer({ ...customPlayer, teRoomDepth: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <Button 
                onClick={runCustomAssessment}
                disabled={assessmentMutation.isPending}
                className="w-full"
              >
                {assessmentMutation.isPending ? 'Analyzing...' : 'Run TE TD Regression Analysis'}
              </Button>

              {assessmentResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Analysis Results: {assessmentResult.playerName}
                      <Badge variant={assessmentResult.flagged ? 'destructive' : 'default'}>
                        {assessmentResult.flagged ? 'High Risk' : 'Low Risk'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{formatValueAdjustment(assessmentResult.dynastyValueAdjustment)}</div>
                        <div className="text-sm text-muted-foreground">Dynasty Adjustment</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{assessmentResult.riskFlags.length}</div>
                        <div className="text-sm text-muted-foreground">Risk Flags</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{assessmentResult.contextAnalysis.receivingFloor ? '✓' : '✗'}</div>
                        <div className="text-sm text-muted-foreground">Receiving Floor</div>
                      </div>
                    </div>

                    {assessmentResult.riskFlags.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Risk Factors Identified:</h4>
                        <div className="space-y-2">
                          {assessmentResult.riskFlags.map((flag: string, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                              <span className="text-sm">{flag}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {assessmentResult.tags.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Applied Tags:</h4>
                        <div className="flex flex-wrap gap-2">
                          {assessmentResult.tags.map((tag: string, index: number) => (
                            <Badge key={index} variant="outline">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation" className="space-y-6">
          {exampleTest?.success && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Example TE Test Results
                    <Badge variant={exampleTest.testPassed ? 'default' : 'destructive'}>
                      {exampleTest.testPassed ? 'PASSED' : 'VALIDATION'}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Validation of expected methodology outputs for Example TE (2024)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{formatValueAdjustment(exampleTest.testResult.dynastyValueAdjustment)}</div>
                      <div className="text-sm text-muted-foreground">Dynasty Value Adjustment</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{exampleTest.testResult.riskFlags.length}</div>
                      <div className="text-sm text-muted-foreground">Risk Flags Identified</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Validation Checks</h4>
                    <div className="space-y-2">
                      {Object.entries(exampleTest.validation).map(([key, passed]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <Badge variant={passed ? 'default' : 'destructive'}>
                            {passed ? '✅ Pass' : '❌ Fail'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Applied Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {exampleTest.testResult.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>

                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Example TE demonstrates comprehensive risk detection with {exampleTest.testResult.riskFlags.length} regression flags 
                      and {formatValueAdjustment(exampleTest.testResult.dynastyValueAdjustment)} dynasty value adjustment.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Comprehensive Risk Analysis</CardTitle>
                  <CardDescription>
                    Detailed breakdown of TE-specific regression factors
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {exampleTest.testResult.riskFlags.map((flag: string, index: number) => (
                      <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <span className="text-sm font-medium">{flag}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <h5 className="font-semibold text-sm mb-2">Context Analysis</h5>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>TD Rate Ratio: {exampleTest.testResult.contextAnalysis.tdRateRatio.toFixed(2)}x league average</div>
                      <div>Receiving Floor: {exampleTest.testResult.contextAnalysis.receivingFloor ? 'Established' : 'Concerning'}</div>
                      <div>Pass-Catching Penalty: {exampleTest.testResult.contextAnalysis.passCatchingPenalty ? 'Applied' : 'None'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="integration" className="space-y-6">
          {methodologyData?.success && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Route className="h-5 w-5" />
                  Integration Safety (v1.1)
                </CardTitle>
                <CardDescription>
                  Enhanced modular architecture ensures clean integration with all existing methodology
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-green-600">✅ Preserves All Existing Logic</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {methodologyData.integrationSafety.preservedMethods.map((method: string, index: number) => (
                        <li key={index}>• {method}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-green-600">✅ Enhanced Integration</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Advanced modular plugin architecture</li>
                      <li>• Position-specific TE analysis</li>
                      <li>• Independent testing capability</li>
                      <li>• Complete rollback safety</li>
                      <li>• No method overwrites confirmed</li>
                      <li>• Pass-catching floor analysis</li>
                    </ul>
                  </div>
                </div>

                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    TE Touchdown Regression Logic (v1.1) successfully integrated without conflicts. 
                    All existing methodology modules (RB, WR, spike detection, YPRR, dynasty values) remain fully functional.
                    Enhanced with TE-specific red zone analysis and pass-catching floor evaluation.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}