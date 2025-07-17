import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingDown, Shield, Info } from 'lucide-react';

interface DeclineIndicator {
  metric: string;
  currentValue: number;
  previousValue: number;
  twoYearsAgo?: number;
  decline: number;
  isSignificant: boolean;
}

interface DeclineAssessment {
  playerId: string;
  playerName: string;
  position: string;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  declineIndicators: DeclineIndicator[];
  riskTags: string[];
  overallScore: number;
  recommendation: string;
  contextualFactors: string[];
}

export default function DynastyDeclineAnalysis() {
  const [selectedExample, setSelectedExample] = useState<string>('aging-wr');

  // Fetch framework information
  const { data: frameworkData } = useQuery({
    queryKey: ['/api/analytics/dynasty-decline-framework'],
  });

  // Example player scenarios for demonstration
  const exampleScenarios = {
    'aging-wr': {
      name: 'Aging Elite WR',
      playerHistory: [
        {
          playerId: 'demo-wr-1',
          season: 2024,
          yacOverExpected: 0.8,
          missedTacklesForced: 12,
          targetShare: 0.22,
          epaPerTouch: 0.15,
          wopr: 0.45,
          yprr: 1.8,
          snapCount: 850,
          contextualFactors: { qbRating: 88, offensiveScheme: 'West Coast' }
        },
        {
          playerId: 'demo-wr-1',
          season: 2023,
          yacOverExpected: 1.2,
          missedTacklesForced: 18,
          targetShare: 0.28,
          epaPerTouch: 0.22,
          wopr: 0.52,
          yprr: 2.1,
          snapCount: 920,
          contextualFactors: { qbRating: 92, offensiveScheme: 'West Coast' }
        },
        {
          playerId: 'demo-wr-1',
          season: 2022,
          yacOverExpected: 1.4,
          missedTacklesForced: 22,
          targetShare: 0.31,
          epaPerTouch: 0.28,
          wopr: 0.58,
          yprr: 2.3,
          snapCount: 940,
          contextualFactors: { qbRating: 89, offensiveScheme: 'West Coast' }
        }
      ]
    },
    'system-dependent': {
      name: 'System-Dependent Player',
      playerHistory: [
        {
          playerId: 'demo-rb-1',
          season: 2024,
          yacOverExpected: 0.3,
          missedTacklesForced: 8,
          epaPerTouch: 0.05,
          snapCount: 420,
          contextualFactors: { qbRating: 76, offensiveScheme: 'Spread' }
        },
        {
          playerId: 'demo-rb-1',
          season: 2023,
          yacOverExpected: 1.1,
          missedTacklesForced: 15,
          epaPerTouch: 0.18,
          snapCount: 680,
          contextualFactors: { qbRating: 88, offensiveScheme: 'Power Run' }
        }
      ]
    }
  };

  const [assessmentResult, setAssessmentResult] = useState<DeclineAssessment | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const runAnalysis = async (scenario: keyof typeof exampleScenarios) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analytics/dynasty-decline-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerHistory: exampleScenarios[scenario].playerHistory })
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

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MODERATE': return 'secondary';
      case 'LOW': return 'default';
      default: return 'default';
    }
  };

  const getRiskTagColor = (tag: string) => {
    switch (tag) {
      case 'DeclineVerified': return 'destructive';
      case 'Post-Context Cliff': return 'destructive';
      case 'SkillDecayRisk': return 'secondary';
      case 'SystemDependent': return 'outline';
      default: return 'default';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dynasty Decline Detection Framework</h1>
        <p className="text-lg text-muted-foreground">
          Advanced risk assessment through skill-isolating metrics and multi-season trend analysis
        </p>
      </div>

      <Tabs defaultValue="framework" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="framework">Framework</TabsTrigger>
          <TabsTrigger value="analysis">Live Analysis</TabsTrigger>
          <TabsTrigger value="methodology">Methodology</TabsTrigger>
        </TabsList>

        <TabsContent value="framework" className="space-y-6">
          {frameworkData?.success && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5" />
                    Core Decline Indicators
                  </CardTitle>
                  <CardDescription>
                    Skill-isolating metrics that measure intrinsic player ability
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {frameworkData.framework.coreIndicators.map((indicator: string, index: number) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                        {indicator}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Risk Categories
                  </CardTitle>
                  <CardDescription>
                    Player risk tags for dynasty management
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {frameworkData.framework.riskTags.map((tag: any, index: number) => (
                      <div key={index} className="border rounded-lg p-3">
                        <Badge variant={getRiskTagColor(tag.tag)} className="mb-2">
                          {tag.tag}
                        </Badge>
                        <p className="text-sm text-muted-foreground">{tag.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Key Principle:</strong> Two or more consecutive seasons of skill-based decline 
              triggers devaluation, focusing on metrics that measure player ability beyond scheme dependency.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Live Decline Assessment</CardTitle>
              <CardDescription>
                Select a player scenario to run decline detection analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {Object.entries(exampleScenarios).map(([key, scenario]) => (
                  <Button
                    key={key}
                    variant={selectedExample === key ? "default" : "outline"}
                    className="h-auto p-4 text-left justify-start"
                    onClick={() => {
                      setSelectedExample(key);
                      setAssessmentResult(null);
                    }}
                  >
                    <div>
                      <div className="font-semibold">{scenario.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {scenario.playerHistory.length} seasons of data
                      </div>
                    </div>
                  </Button>
                ))}
              </div>

              <Button 
                onClick={() => runAnalysis(selectedExample as keyof typeof exampleScenarios)}
                disabled={isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? 'Analyzing...' : 'Run Decline Analysis'}
              </Button>
            </CardContent>
          </Card>

          {assessmentResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Assessment Results
                  <Badge variant={getRiskColor(assessmentResult.riskLevel)}>
                    {assessmentResult.riskLevel} RISK
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Dynasty value analysis for {exampleScenarios[selectedExample as keyof typeof exampleScenarios].name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{assessmentResult.overallScore}</div>
                    <div className="text-sm text-muted-foreground">Decline Score</div>
                    <Progress value={assessmentResult.overallScore} className="mt-2" />
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{assessmentResult.declineIndicators.length}</div>
                    <div className="text-sm text-muted-foreground">Metrics Analyzed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{assessmentResult.riskTags.length}</div>
                    <div className="text-sm text-muted-foreground">Risk Tags</div>
                  </div>
                </div>

                <Alert variant={assessmentResult.riskLevel === 'HIGH' || assessmentResult.riskLevel === 'CRITICAL' ? 'destructive' : 'default'}>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Recommendation:</strong> {assessmentResult.recommendation}
                  </AlertDescription>
                </Alert>

                {assessmentResult.riskTags.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Risk Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {assessmentResult.riskTags.map((tag, index) => (
                        <Badge key={index} variant={getRiskTagColor(tag)}>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-3">Decline Indicators</h4>
                  <div className="space-y-3">
                    {assessmentResult.declineIndicators.map((indicator, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{indicator.metric}</span>
                          <Badge variant={indicator.isSignificant ? 'destructive' : 'secondary'}>
                            {indicator.decline > 0 ? '+' : ''}{indicator.decline.toFixed(1)}%
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Current: {indicator.currentValue.toFixed(2)} | 
                          Previous: {indicator.previousValue.toFixed(2)}
                          {indicator.twoYearsAgo && ` | Two years ago: ${indicator.twoYearsAgo.toFixed(2)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {assessmentResult.contextualFactors.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Contextual Factors</h4>
                    <ul className="space-y-1">
                      {assessmentResult.contextualFactors.map((factor, index) => (
                        <li key={index} className="text-sm text-muted-foreground">
                          • {factor}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="methodology" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dynasty Decline Detection Methodology</CardTitle>
              <CardDescription>
                Comprehensive framework for identifying dynasty value deterioration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Interpretation Philosophy</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If a player is no longer creating yards, no longer earning priority reads, and no longer 
                  separating — they are now system-dependent. System-dependent players should be marked as 
                  volatile, especially when their production is inflated by a currently favorable offensive environment.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Assessment Thresholds</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <h5 className="font-medium mb-2">Significance Thresholds</h5>
                    <ul className="text-sm space-y-1">
                      <li>• YAC over Expected: -15% decline</li>
                      <li>• Missed Tackles Forced: -20% decline</li>
                      <li>• Target Share (snap-adjusted): -10% decline</li>
                      <li>• EPA per Touch: -25% decline</li>
                      <li>• WOPR: -15% decline</li>
                      <li>• YPRR: -12% decline</li>
                    </ul>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h5 className="font-medium mb-2">Risk Level Calculation</h5>
                    <ul className="text-sm space-y-1">
                      <li>• <Badge variant="destructive" className="text-xs">CRITICAL</Badge>: DeclineVerified + Post-Context Cliff</li>
                      <li>• <Badge variant="destructive" className="text-xs">HIGH</Badge>: DeclineVerified OR 3+ significant declines</li>
                      <li>• <Badge variant="secondary" className="text-xs">MODERATE</Badge>: SkillDecayRisk OR 2+ significant declines</li>
                      <li>• <Badge variant="default" className="text-xs">LOW</Badge>: Minimal decline indicators</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Integration with Signal v2.0</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The Dynasty Decline Detection Framework integrates with our existing Signal v2.0 algorithm 
                  by applying risk-based penalties to the Stability component (15% weighting). Players with 
                  "DeclineVerified" or "Post-Context Cliff" tags receive significant stability penalties, 
                  while "SkillDecayRisk" players receive moderate adjustments.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}