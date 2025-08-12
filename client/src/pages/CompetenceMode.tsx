import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Target, TrendingUp, AlertTriangle, Lightbulb, BarChart3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { CompetenceRequest, CompetenceResponse } from "@shared/types/competence";

export default function CompetenceMode() {
  const [query, setQuery] = useState("");
  const [riskTolerance, setRiskTolerance] = useState<"conservative" | "balanced" | "aggressive">("balanced");
  const [response, setResponse] = useState<CompetenceResponse | null>(null);

  const analysisMutation = useMutation({
    mutationFn: async (request: CompetenceRequest) => {
      return apiRequest('/api/competence/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
    },
    onSuccess: (data) => {
      setResponse(data);
    },
  });

  const handleSubmit = () => {
    if (!query.trim()) return;
    
    const request: CompetenceRequest = {
      query: query.trim(),
      riskTolerance,
      // TODO: Add user context from localStorage or user profile
    };

    analysisMutation.mutate(request);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800'; 
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Brain className="h-6 w-6 text-plum" />
          <h1 className="text-2xl font-bold text-ink">Competence Mode</h1>
        </div>
        <p className="text-body max-w-2xl mx-auto">
          Truth-first fantasy football guidance. Get evidence-based advice that prioritizes 
          accuracy over agreement and your growth as a player.
        </p>
      </div>

      {/* Charter Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Competence Charter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="font-medium text-sm">Truth Over Agreement</div>
              <div className="text-xs text-body">Evidence-based advice, even if unpopular</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-sm">Context Awareness</div>
              <div className="text-xs text-body">Tailored to your league and history</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-sm">Proactive Guidance</div>
              <div className="text-xs text-body">Anticipates trends and opportunities</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-sm">Transparent Reasoning</div>
              <div className="text-xs text-body">Shows data and logic behind advice</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-sm">Risk Awareness</div>
              <div className="text-xs text-body">Clear confidence and alternatives</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-sm">User Growth Focus</div>
              <div className="text-xs text-body">Makes you a sharper player</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Query Input */}
      <Card>
        <CardHeader>
          <CardTitle>Ask for Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Ask about trades, draft strategy, roster moves, player analysis, or any fantasy football decision..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={4}
          />
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Risk Tolerance:</label>
              <Select value={riskTolerance} onValueChange={(value: any) => setRiskTolerance(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">Conservative</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="aggressive">Aggressive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={handleSubmit}
              disabled={!query.trim() || analysisMutation.isPending}
              loading={analysisMutation.isPending}
            >
              Analyze
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Response */}
      {response && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Competence Analysis</span>
              <div className="flex items-center gap-2">
                <Badge className={getRiskColor(response.riskLevel)}>
                  {response.riskLevel} risk
                </Badge>
                <Badge variant="outline">
                  <span className={getConfidenceColor(response.confidence)}>
                    {response.confidence}% confidence
                  </span>
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="recommendation">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="recommendation">Recommendation</TabsTrigger>
                <TabsTrigger value="alternatives">Alternatives</TabsTrigger>
                <TabsTrigger value="insights">Proactive</TabsTrigger>
                <TabsTrigger value="data">Data Support</TabsTrigger>
              </TabsList>

              <TabsContent value="recommendation" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Recommendation</h4>
                  <p className="text-body">{response.recommendation}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Reasoning</h4>
                  <p className="text-body">{response.reasoning}</p>
                </div>

                {response.challengesToUserThinking && response.challengesToUserThinking.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Challenges to Consider
                    </h4>
                    <ul className="space-y-1">
                      {response.challengesToUserThinking.map((challenge, index) => (
                        <li key={index} className="text-body text-sm">• {challenge}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="alternatives" className="space-y-4">
                {response.alternatives && response.alternatives.length > 0 ? (
                  response.alternatives.map((alt, index) => (
                    <div key={index} className="border rounded-lg p-4 hover-lift">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{alt.option}</h4>
                        <Badge className={getRiskColor(alt.riskLevel)}>
                          {alt.riskLevel} risk
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <div className="text-sm font-medium text-green-700 mb-1">Pros</div>
                          <ul className="text-sm space-y-1">
                            {alt.pros.map((pro, i) => (
                              <li key={i} className="text-body">• {pro}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-red-700 mb-1">Cons</div>
                          <ul className="text-sm space-y-1">
                            {alt.cons.map((con, i) => (
                              <li key={i} className="text-body">• {con}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-body text-center py-8">No alternatives provided</p>
                )}
              </TabsContent>

              <TabsContent value="insights" className="space-y-4">
                {response.proactiveInsights && response.proactiveInsights.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-600" />
                      Proactive Insights
                    </h4>
                    {response.proactiveInsights.map((insight, index) => (
                      <div key={index} className="border-l-4 border-amber-400 pl-4 py-2">
                        <p className="text-body">{insight}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-body text-center py-8">No proactive insights available</p>
                )}
              </TabsContent>

              <TabsContent value="data" className="space-y-4">
                {response.dataSupport && response.dataSupport.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-blue-600" />
                      Supporting Data
                    </h4>
                    {response.dataSupport.map((data, index) => (
                      <div key={index} className="border rounded-lg p-3 hover-lift">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium">{data.metric}</div>
                          <div className="font-mono text-lg">{data.value}</div>
                        </div>
                        <div className="text-sm text-body mb-1">{data.context}</div>
                        <div className="text-xs text-gray-500">Source: {data.source}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-body text-center py-8">No data support provided</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {analysisMutation.isError && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-red-600">Failed to analyze request</p>
              <p className="text-sm text-gray-500 mt-2">
                {analysisMutation.error?.message || "Unknown error occurred"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}