import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle, TrendingUp, Zap } from "lucide-react";

export default function QBEvaluationLogic() {
  const [customPlayerId, setCustomPlayerId] = useState("");
  const [customPlayerName, setCustomPlayerName] = useState("");

  // Load methodology
  const { data: methodology } = useQuery({
    queryKey: ["/api/analytics/qb-evaluation-methodology"],
  });

  // Test with Jayden Daniels
  const { data: jaydenTest, isLoading: jaydenLoading } = useQuery({
    queryKey: ["/api/analytics/qb-evaluation-test-jayden-daniels"],
  });

  // Custom QB evaluation
  const customEvaluation = useMutation({
    mutationFn: async (context: any) => {
      const response = await fetch("/api/analytics/qb-evaluation-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: customPlayerId,
          playerName: customPlayerName,
          context,
          season: 2024,
        }),
      });
      return response.json();
    },
  });

  const handleCustomEvaluation = () => {
    const testContext = {
      season: 2024,
      epaPerPlay: 0.12,
      rushYards: 350,
      rushTDs: 3,
      deepBallAttempts: 35,
      deepBallCompletionRate: 0.42,
      cleanPocketEPA: 0.18,
      pressureEPA: 0.08,
      redZonePassRate: 0.58,
      redZonePassTDConversion: 0.22,
      scrambleEPA: 0.09,
      contractYearsRemaining: 2,
      teamPassRateOverExpected: 0.03,
      age: 27,
      dynastyExperience: 4,
    };

    customEvaluation.mutate(testContext);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <Zap className="text-blue-500" />
            QB Evaluation Logic (v1.1)
          </h1>
          <p className="text-gray-600">
            Modular QB dynasty evaluation using rushing upside, EPA metrics, and scheme fit analysis
          </p>
        </div>

        {/* Methodology Overview */}
        {methodology?.success && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="text-green-500" size={20} />
                Methodology Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Integration Safety</h4>
                  <div className="space-y-1">
                    {methodology.integrationSafety.safeguards.map((safeguard: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <CheckCircle size={12} className="text-green-500" />
                        {safeguard}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Evaluation Scope</h4>
                  <div className="space-y-1">
                    {methodology.methodology.triggerScope.map((scope: string, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {methodology.methodology.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Jayden Daniels Test Case */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="text-orange-500" size={20} />
              Jayden Daniels (2024) Test Case
            </CardTitle>
            <CardDescription>
              Elite rushing QB with franchise potential - validation test case
            </CardDescription>
          </CardHeader>
          <CardContent>
            {jaydenLoading ? (
              <div className="text-center py-4">Loading test case...</div>
            ) : jaydenTest?.success ? (
              <div className="space-y-4">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      +{jaydenTest.testResult.dynastyValueAdjustment.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">Dynasty Adjustment</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {jaydenTest.testResult.contextAnalysis.totalFlags}
                    </div>
                    <div className="text-sm text-gray-600">Evaluation Flags</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {jaydenTest.testResult.tags.length}
                    </div>
                    <div className="text-sm text-gray-600">Dynasty Tags</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {jaydenTest.testResult.lastEvaluatedSeason}
                    </div>
                    <div className="text-sm text-gray-600">Season Data</div>
                  </div>
                </div>

                <Separator />

                {/* Tags */}
                <div>
                  <h4 className="font-semibold mb-2">Dynasty Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {jaydenTest.testResult.tags.map((tag: string, idx: number) => (
                      <Badge key={idx} variant="default">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Context Analysis */}
                <div>
                  <h4 className="font-semibold mb-2">Context Analysis</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${jaydenTest.testResult.contextAnalysis.rushingUpside ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm">Rushing Upside</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${jaydenTest.testResult.contextAnalysis.passingEfficiency ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm">Passing Efficiency</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${jaydenTest.testResult.contextAnalysis.schemeFit ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm">Scheme Fit</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${jaydenTest.testResult.contextAnalysis.dynastyWindow ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm">Dynasty Window</span>
                    </div>
                  </div>
                </div>

                {/* Validation Results */}
                <div>
                  <h4 className="font-semibold mb-2">Test Validation</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-500" />
                      <span className="text-sm">Expected adjustment &gt; +0.20: {jaydenTest.validation.testsPassed ? 'PASS' : 'FAIL'}</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      Expected tags: {jaydenTest.validation.expectedTags.join(', ')}
                    </div>
                  </div>
                </div>

                {/* Evaluation Logs */}
                <div>
                  <h4 className="font-semibold mb-2">Evaluation Logs</h4>
                  <div className="bg-gray-100 p-3 rounded-md max-h-32 overflow-y-auto">
                    {jaydenTest.testResult.logs.map((log: string, idx: number) => (
                      <div key={idx} className="text-xs text-gray-700">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-red-600">
                <AlertCircle className="mx-auto mb-2" />
                Failed to load test case
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custom QB Evaluation */}
        <Card>
          <CardHeader>
            <CardTitle>Custom QB Evaluation</CardTitle>
            <CardDescription>
              Test the QB evaluation logic with custom player data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="playerId">Player ID</Label>
                  <Input
                    id="playerId"
                    value={customPlayerId}
                    onChange={(e) => setCustomPlayerId(e.target.value)}
                    placeholder="e.g., custom-qb-001"
                  />
                </div>
                <div>
                  <Label htmlFor="playerName">Player Name</Label>
                  <Input
                    id="playerName"
                    value={customPlayerName}
                    onChange={(e) => setCustomPlayerName(e.target.value)}
                    placeholder="e.g., Test QB"
                  />
                </div>
              </div>

              <Button
                onClick={handleCustomEvaluation}
                disabled={!customPlayerId || !customPlayerName || customEvaluation.isPending}
                className="w-full"
              >
                {customEvaluation.isPending ? "Evaluating..." : "Run Custom Evaluation"}
              </Button>

              {customEvaluation.data?.success && (
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-semibold">Custom Evaluation Results</h4>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">
                        +{customEvaluation.data.assessment.dynastyValueAdjustment.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600">Dynasty Adjustment</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">
                        {customEvaluation.data.assessment.evaluationFlags.length}
                      </div>
                      <div className="text-sm text-gray-600">Evaluation Flags</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-600">
                        {customEvaluation.data.assessment.tags.length}
                      </div>
                      <div className="text-sm text-gray-600">Dynasty Tags</div>
                    </div>
                  </div>

                  <div>
                    <h5 className="font-medium mb-2">Tags Applied</h5>
                    <div className="flex flex-wrap gap-2">
                      {customEvaluation.data.assessment.tags.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {customEvaluation.error && (
                <div className="text-red-600 text-sm">
                  Error: {(customEvaluation.error as any).message}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Integration Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="text-green-500" size={20} />
              2024 Data Prioritization Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-500" />
                <span className="text-sm">QB module defaults to 2024 season data</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-500" />
                <span className="text-sm">Legacy season validation and warnings enabled</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-500" />
                <span className="text-sm">lastEvaluatedSeason field confirms current data usage</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-500" />
                <span className="text-sm">Modular integration preserves existing logic</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}