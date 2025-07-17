import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { TrendingDown, Target, AlertTriangle, Info, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface RBSustainabilityContext {
  tdRate: number;
  totalTouches: number;
  inside5Carries: number;
  inside10Carries: number;
  teamInside5Share: number;
  teamInside10Share: number;
  qbRedZoneRushes: number;
  teamRushingAttempts: number;
  opportunityShare: number;
  receivingShare: number;
  targetShare: number;
  receivingYards: number;
  receivingTDs: number;
  backfieldCompetition: string[];
}

interface SustainabilityAssessment {
  playerId: string;
  playerName: string;
  season: number;
  flagged: boolean;
  riskFlags: string[];
  passCatchingBonus: number;
  dynastyValueAdjustment: number;
  tags: string[];
  logs: string[];
  validation: {
    requiredFieldsPresent: boolean;
    missingFields: string[];
  };
  contextAnalysis: {
    tdRateRatio: number;
    teamRushRatio: number;
    targetShareRatio: number;
    riskFactorCount: number;
  };
}

export default function RBTouchdownRegression() {
  return <RBTouchdownSustainabilityPage />;
}

function RBTouchdownSustainabilityPage() {
  const [assessmentResult, setAssessmentResult] = useState<SustainabilityAssessment | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Custom player analysis form
  const [customPlayer, setCustomPlayer] = useState({
    playerId: '',
    playerName: '',
    tdRate: 0.08,
    totalTouches: 240,
    inside5Carries: 3,
    inside10Carries: 6,
    teamInside5Share: 0.15,
    teamInside10Share: 0.18,
    qbRedZoneRushes: 25,
    teamRushingAttempts: 480,
    opportunityShare: 0.33,
    receivingShare: 0.10,
    targetShare: 0.12,
    receivingYards: 450,
    receivingTDs: 3,
    backfieldCompetition: ["Ray Davis (rookie)", "Ty Johnson (veteran)"]
  });

  // Fetch methodology information
  const { data: methodologyData } = useQuery({
    queryKey: ['/api/analytics/rb-td-sustainability-methodology'],
  });

  // Test James Cook example
  const { data: jamesCookTest } = useQuery({
    queryKey: ['/api/analytics/rb-td-sustainability-test-james-cook'],
  });

  const runCustomAnalysis = async () => {
    if (!customPlayer.playerName.trim()) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analytics/rb-td-sustainability-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: customPlayer.playerId || customPlayer.playerName.toLowerCase().replace(/\s+/g, '-'),
          playerName: customPlayer.playerName,
          context: {
            tdRate: customPlayer.tdRate,
            totalTouches: customPlayer.totalTouches,
            inside5Carries: customPlayer.inside5Carries,
            inside10Carries: customPlayer.inside10Carries,
            teamInside5Share: customPlayer.teamInside5Share,
            teamInside10Share: customPlayer.teamInside10Share,
            qbRedZoneRushes: customPlayer.qbRedZoneRushes,
            teamRushingAttempts: customPlayer.teamRushingAttempts,
            opportunityShare: customPlayer.opportunityShare,
            receivingShare: customPlayer.receivingShare,
            targetShare: customPlayer.targetShare,
            receivingYards: customPlayer.receivingYards,
            receivingTDs: customPlayer.receivingTDs,
            backfieldCompetition: customPlayer.backfieldCompetition
          },
          season: 2024
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setAssessmentResult(data.assessment);
      }
    } catch (error) {
      console.error('Analysis error:', error);
    }
    setIsAnalyzing(false);
  };

  const runExampleAnalysis = async () => {
    if (!jamesCookTest?.testResult) return;
    setAssessmentResult(jamesCookTest.testResult);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MODERATE': return 'secondary';
      case 'LOW': return 'default';
      default: return 'default';
    }
  };

  const formatValueAdjustment = (adjustment: number) => {
    if (adjustment === 0) return 'No adjustment';
    return `${adjustment > 0 ? '+' : ''}${adjustment}%`;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">RB Touchdown Sustainability (v1.0)</h1>
        <p className="text-lg text-muted-foreground">
          Comprehensive methodology for evaluating TD sustainability, pass-catching upside, and regression risk
        </p>
      </div>

      <Tabs defaultValue="methodology" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="methodology">Methodology</TabsTrigger>
          <TabsTrigger value="analysis">Live Analysis</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="integration">Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="methodology" className="space-y-6">
          {methodologyData?.success && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Regression Analysis Steps
                  </CardTitle>
                  <CardDescription>
                    Three-step process for TD sustainability evaluation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {methodologyData.methodology.steps.map((step: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4">
                        <h4 className="font-semibold mb-2">Step {index + 1}: {step.step}</h4>
                        <ul className="space-y-1">
                          {step.logic.map((logic: string, logicIndex: number) => (
                            <li key={logicIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                              <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                              {logic}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Example: James Cook Analysis
                  </CardTitle>
                  <CardDescription>
                    Real-world application of TD regression methodology
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="bg-muted rounded-lg p-3">
                      <h5 className="font-medium mb-2">Context Factors</h5>
                      <ul className="text-sm space-y-1">
                        <li>• TD Rate: {methodologyData.methodology.examplePlayer.context.tdRate}</li>
                        <li>• Volume: {methodologyData.methodology.examplePlayer.context.totalTouches}</li>
                        <li>• QB Competition: {methodologyData.methodology.examplePlayer.context.qb}</li>
                        <li>• Backfield: {methodologyData.methodology.examplePlayer.context.competition.join(', ')}</li>
                      </ul>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <h5 className="font-medium mb-2">Assessment Outcome</h5>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <Badge variant="destructive">TD Regression Risk</Badge>
                        <Badge variant="secondary">{methodologyData.methodology.examplePlayer.outcome.valueAdjustment}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {methodologyData.methodology.examplePlayer.context.note}
                      </p>
                    </div>
                    <Button onClick={runExampleAnalysis} variant="outline" className="w-full">
                      Run James Cook Analysis
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Modular Design:</strong> This methodology safely appends to existing evaluation logic 
              without overwriting spike week detection, YPRR analysis, or adjustedDynastyValue calculations.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Custom RB Analysis</CardTitle>
                <CardDescription>
                  Analyze any running back for touchdown regression risk
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="playerName">Player Name</Label>
                    <Input
                      id="playerName"
                      value={customPlayer.playerName}
                      onChange={(e) => setCustomPlayer({ ...customPlayer, playerName: e.target.value })}
                      placeholder="e.g., James Cook"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tdRate">TD Rate (%)</Label>
                    <Input
                      id="tdRate"
                      type="number"
                      step="0.1"
                      value={customPlayer.tdRate}
                      onChange={(e) => setCustomPlayer({ ...customPlayer, tdRate: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="totalTouches">Total Touches</Label>
                    <Input
                      id="totalTouches"
                      type="number"
                      value={customPlayer.totalTouches}
                      onChange={(e) => setCustomPlayer({ ...customPlayer, totalTouches: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="inside5Carries">Inside 5 Carries</Label>
                    <Input
                      id="inside5Carries"
                      type="number"
                      value={customPlayer.inside5Carries}
                      onChange={(e) => setCustomPlayer({ ...customPlayer, inside5Carries: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="teamInside5Share">Team Inside 5 Share</Label>
                    <Input
                      id="teamInside5Share"
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={customPlayer.teamInside5Share}
                      onChange={(e) => setCustomPlayer({ ...customPlayer, teamInside5Share: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="qbRedZoneRushes">QB Red Zone Rushes</Label>
                    <Input
                      id="qbRedZoneRushes"
                      type="number"
                      value={customPlayer.qbRedZoneRushes}
                      onChange={(e) => setCustomPlayer({ ...customPlayer, qbRedZoneRushes: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={customPlayer.hasRookieCompetition}
                      onChange={(e) => setCustomPlayer({ ...customPlayer, hasRookieCompetition: e.target.checked })}
                    />
                    <span className="text-sm">Rookie Competition</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={customPlayer.hasVetCompetition}
                      onChange={(e) => setCustomPlayer({ ...customPlayer, hasVetCompetition: e.target.checked })}
                    />
                    <span className="text-sm">Veteran Competition</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={customPlayer.schemeChange}
                      onChange={(e) => setCustomPlayer({ ...customPlayer, schemeChange: e.target.checked })}
                    />
                    <span className="text-sm">Scheme Change</span>
                  </label>
                </div>

                <Button 
                  onClick={runCustomAnalysis}
                  disabled={isAnalyzing || !customPlayer.playerName.trim()}
                  className="w-full"
                >
                  {isAnalyzing ? 'Analyzing...' : 'Run TD Regression Analysis'}
                </Button>
              </CardContent>
            </Card>

            {assessmentResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    TD Regression Assessment
                    <Badge variant={getRiskColor(assessmentResult.riskLevel)}>
                      {assessmentResult.riskLevel} RISK
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Analysis for {assessmentResult.playerName}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{formatValueAdjustment(assessmentResult.valueAdjustment)}</div>
                      <div className="text-sm text-muted-foreground">Dynasty Value Adjustment</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{assessmentResult.tags.length}</div>
                      <div className="text-sm text-muted-foreground">Risk Tags Applied</div>
                    </div>
                  </div>

                  <Alert variant={assessmentResult.riskLevel === 'HIGH' || assessmentResult.riskLevel === 'CRITICAL' ? 'destructive' : 'default'}>
                    <TrendingDown className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Recommendation:</strong> {assessmentResult.recommendation}
                    </AlertDescription>
                  </Alert>

                  {assessmentResult.tags.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3">Applied Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {assessmentResult.tags.map((tag, index) => (
                          <Badge key={index} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold mb-3">Risk Factor Analysis</h4>
                    <div className="space-y-2">
                      {Object.entries(assessmentResult.riskFlags).map(([factor, present]) => (
                        <div key={factor} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{factor.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <Badge variant={present ? 'destructive' : 'outline'}>
                            {present ? 'Present' : 'Not Present'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Contextual Analysis</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {assessmentResult.contextualNote}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="validation" className="space-y-6">
          {jamesCookTest?.success && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    James Cook Test Results
                    <Badge variant={jamesCookTest.testPassed ? 'default' : 'destructive'}>
                      {jamesCookTest.testPassed ? 'PASSED' : 'FAILED'}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Validation of expected methodology outputs
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{formatValueAdjustment(jamesCookTest.testResult.dynastyValueAdjustment)}</div>
                      <div className="text-sm text-muted-foreground">Dynasty Value Adjustment</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">+{(jamesCookTest.testResult.passCatchingBonus * 100).toFixed(0)}%</div>
                      <div className="text-sm text-muted-foreground">Pass-Catching Bonus</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Validation Checks</h4>
                    <div className="space-y-2">
                      {Object.entries(jamesCookTest.validation).map(([key, passed]) => (
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
                      {jamesCookTest.testResult.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Processing Logs</CardTitle>
                  <CardDescription>
                    Step-by-step methodology execution
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {jamesCookTest.testResult.logs.map((log: string, index: number) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs text-primary font-medium">{index + 1}</span>
                        </div>
                        <span className="text-muted-foreground">{log}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Context Analysis</CardTitle>
                  <CardDescription>
                    Detailed breakdown of James Cook's sustainability metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-bold">{jamesCookTest.testResult.contextAnalysis.tdRateRatio.toFixed(2)}x</div>
                      <div className="text-sm text-muted-foreground">TD Rate Ratio</div>
                      <div className="text-xs text-muted-foreground mt-1">vs League Avg</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-bold">{jamesCookTest.testResult.contextAnalysis.teamRushRatio.toFixed(2)}x</div>
                      <div className="text-sm text-muted-foreground">Team Rush Ratio</div>
                      <div className="text-xs text-muted-foreground mt-1">vs League Avg</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-bold">{jamesCookTest.testResult.contextAnalysis.targetShareRatio.toFixed(2)}x</div>
                      <div className="text-sm text-muted-foreground">Target Share Ratio</div>
                      <div className="text-xs text-muted-foreground mt-1">vs League Avg</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-bold">{jamesCookTest.testResult.contextAnalysis.riskFactorCount}</div>
                      <div className="text-sm text-muted-foreground">Risk Factors</div>
                      <div className="text-xs text-muted-foreground mt-1">Identified</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {!jamesCookTest?.success && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                James Cook test validation data not available. The methodology is still functional for live analysis.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="integration" className="space-y-6">
          {methodologyData?.success && (
            <Card>
              <CardHeader>
                <CardTitle>Signal Integration</CardTitle>
                <CardDescription>
                  How TD regression analysis integrates with existing methodology
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">Preserves</h4>
                    <p className="text-sm text-muted-foreground">
                      {methodologyData.integration.preserves}
                    </p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">Trigger Scope</h4>
                    <div className="space-y-1">
                      {methodologyData.methodology.triggerScope.map((scope: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">Module Type</h4>
                    <p className="text-sm text-muted-foreground">
                      Appended modularly
                    </p>
                  </div>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Safe Integration:</strong> This module is designed to safely append to the existing 
                    Signal methodology without overwriting or deleting any current evaluation logic, including 
                    spike week detection, YPRR analysis, or adjustedDynastyValue formula calculations.
                  </AlertDescription>
                </Alert>

                <div>
                  <h4 className="font-semibold mb-3">Implementation Details</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                      <span>Modular plugin architecture allows safe addition without affecting existing code</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                      <span>Triggers only during dynasty valuation, player profile, and analytics panel contexts</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                      <span>Value adjustments apply as separate layer, preserving original calculation methods</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                      <span>Risk tags provide additional context without replacing existing player tags</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}