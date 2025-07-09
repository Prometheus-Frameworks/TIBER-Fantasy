import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Target, TrendingUp, Shield, BarChart3, AlertTriangle, CheckCircle } from 'lucide-react';

interface WRTestResult {
  contextScore: number;
  forecastGrade: string;
  componentScores: {
    usageProfile: number;
    efficiency: number;
    roleSecurity: number;
    growthTrajectory: number;
  };
  forecastTags: string[];
  riskFactors: string[];
  upside: string[];
  playerName: string;
  logs: string[];
}

interface TestData {
  testResults: WRTestResult[];
  methodology: any;
}

export default function WRForecastEvaluation() {
  const [testData, setTestData] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWR, setSelectedWR] = useState<WRTestResult | null>(null);

  useEffect(() => {
    fetchTestCases();
  }, []);

  const fetchTestCases = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/wr-evaluation-test-cases');
      const data = await response.json();
      
      if (data.success) {
        setTestData(data.data);
        setSelectedWR(data.data.testResults[0]); // Select first WR by default
      }
    } catch (error) {
      console.error('Failed to fetch WR test cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'ELITE': return 'bg-green-600';
      case 'STRONG': return 'bg-blue-600';
      case 'SOLID': return 'bg-yellow-600';
      case 'CONCERNING': return 'bg-orange-600';
      case 'AVOID': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const getComponentIcon = (component: string) => {
    switch (component) {
      case 'Usage Profile': return <Target className="h-4 w-4" />;
      case 'Efficiency': return <BarChart3 className="h-4 w-4" />;
      case 'Role Security': return <Shield className="h-4 w-4" />;
      case 'Growth Trajectory': return <TrendingUp className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading WR Evaluation test cases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">WR Evaluation & Forecast Score (v1.1)</h1>
        <p className="text-gray-600 mt-2">
          Forward-looking dynasty WR evaluation using 4-component scoring system for predictive dynasty forecasting
        </p>
      </div>

      {testData && (
        <Tabs defaultValue="test-cases" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="test-cases">Test Cases</TabsTrigger>
            <TabsTrigger value="methodology">Methodology</TabsTrigger>
            <TabsTrigger value="evaluation">Detailed Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="test-cases">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>WR Archetypes</CardTitle>
                  <CardDescription>Test different WR profile types</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {testData.testResults.map((wr, index) => (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedWR?.playerName === wr.playerName ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedWR(wr)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{wr.playerName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-600">Score: {wr.contextScore}</span>
                            <Badge className={`text-white ${getGradeColor(wr.forecastGrade)}`}>
                              {wr.forecastGrade}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">
                            {wr.forecastTags.slice(0, 2).join(', ')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {selectedWR && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{selectedWR.playerName}</CardTitle>
                      <Badge className={`text-white ${getGradeColor(selectedWR.forecastGrade)}`}>
                        {selectedWR.forecastGrade} ({selectedWR.contextScore})
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Component Scores */}
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(selectedWR.componentScores).map(([component, score]) => {
                        const componentName = component.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        return (
                          <div key={component} className="space-y-2">
                            <div className="flex items-center gap-2">
                              {getComponentIcon(componentName)}
                              <span className="text-sm font-medium">{componentName}</span>
                              <span className="text-sm text-gray-600">{score}</span>
                            </div>
                            <Progress value={score} className="h-2" />
                          </div>
                        );
                      })}
                    </div>

                    <Separator />

                    {/* Tags and Factors */}
                    <div className="space-y-3">
                      {selectedWR.forecastTags.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Forecast Tags</h4>
                          <div className="flex flex-wrap gap-1">
                            {selectedWR.forecastTags.map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedWR.upside.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            Upside Factors
                          </h4>
                          <ul className="space-y-1">
                            {selectedWR.upside.slice(0, 3).map((factor, index) => (
                              <li key={index} className="text-sm text-green-700">• {factor}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedWR.riskFactors.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                            Risk Factors
                          </h4>
                          <ul className="space-y-1">
                            {selectedWR.riskFactors.slice(0, 3).map((risk, index) => (
                              <li key={index} className="text-sm text-orange-700">• {risk}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="methodology">
            <Card>
              <CardHeader>
                <CardTitle>WR Evaluation Methodology</CardTitle>
                <CardDescription>Research-based dynasty forecasting framework</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Target className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Focus:</strong> Forward-looking dynasty forecasting with predictive metrics rather than descriptive analysis
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Component Weights</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          <span>Usage Profile</span>
                        </div>
                        <span className="font-medium">35%</span>
                      </div>
                      <Progress value={35} className="h-2" />
                      <p className="text-sm text-gray-600">Most predictive for fantasy success - TPRR, route participation, first read %</p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          <span>Efficiency</span>
                        </div>
                        <span className="font-medium">25%</span>
                      </div>
                      <Progress value={25} className="h-2" />
                      <p className="text-sm text-gray-600">Quality of usage - YPRR, first downs, route wins, explosives</p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          <span>Role Security</span>
                        </div>
                        <span className="font-medium">25%</span>
                      </div>
                      <Progress value={25} className="h-2" />
                      <p className="text-sm text-gray-600">Dynasty stability - age, draft capital, contract, injury history</p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          <span>Growth Trajectory</span>
                        </div>
                        <span className="font-medium">15%</span>
                      </div>
                      <Progress value={15} className="h-2" />
                      <p className="text-sm text-gray-600">Forward-looking - historical trends, QB stability, offseason changes</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Key Innovations</h3>
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-900">TPRR Focus</h4>
                        <p className="text-sm text-blue-700">0.817 correlation with fantasy success vs 0.763 for raw targets</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <h4 className="font-medium text-green-900">Risk Assessment</h4>
                        <p className="text-sm text-green-700">Comprehensive risk factors with grade overrides for high-risk players</p>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <h4 className="font-medium text-purple-900">Upside Identification</h4>
                        <p className="text-sm text-purple-700">Specific upside factors for dynasty value opportunities</p>
                      </div>
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <h4 className="font-medium text-orange-900">Forward-Looking</h4>
                        <p className="text-sm text-orange-700">Historical trends + QB stability + offseason changes for projections</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evaluation">
            {selectedWR && (
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Analysis: {selectedWR.playerName}</CardTitle>
                  <CardDescription>Complete evaluation breakdown and reasoning</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Evaluation Logs</h3>
                      <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                        {selectedWR.logs.map((log, index) => (
                          <div key={index} className="text-sm font-mono mb-1 text-gray-700">
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Component Breakdown</h3>
                        <div className="space-y-3">
                          {Object.entries(selectedWR.componentScores).map(([component, score]) => {
                            const componentName = component.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            return (
                              <div key={component} className="p-3 border rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    {getComponentIcon(componentName)}
                                    <span className="font-medium">{componentName}</span>
                                  </div>
                                  <span className="text-lg font-bold">{score}</span>
                                </div>
                                <Progress value={score} className="h-2" />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3">Final Assessment</h3>
                        <div className="p-4 border rounded-lg">
                          <div className="text-center mb-3">
                            <div className="text-3xl font-bold">{selectedWR.contextScore}</div>
                            <Badge className={`text-white ${getGradeColor(selectedWR.forecastGrade)}`}>
                              {selectedWR.forecastGrade} FORECAST
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 text-center">
                            Based on 4-component weighted analysis with forward-looking projections
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      <div className="mt-6">
        <Button onClick={fetchTestCases} variant="outline">
          Refresh Test Cases
        </Button>
      </div>
    </div>
  );
}