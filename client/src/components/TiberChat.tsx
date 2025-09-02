import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Brain, AlertTriangle } from "lucide-react";
import type { CompetenceRequest, CompetenceResponse } from "@shared/types/competence";

interface TiberChatProps {
  compact?: boolean;
}

export default function TiberChat({ compact = false }: TiberChatProps) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<CompetenceResponse | null>(null);

  const analysisMutation = useMutation({
    mutationFn: async (request: CompetenceRequest) => {
      const response = await fetch('/api/competence/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error('Failed to analyze request');
      return response.json();
    },
    onSuccess: (data: CompetenceResponse) => {
      setResponse(data);
    },
  });

  const handleSubmit = () => {
    if (!query.trim()) return;
    
    const request: CompetenceRequest = {
      query: query.trim(),
      riskTolerance: "balanced",
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

  if (compact) {
    return (
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-plum-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-plum" />
            Ask Tiber
          </CardTitle>
          <p className="text-sm text-gray-600">
            Get blunt, truth-first fantasy advice
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Should I trade for CMC? Start Mahomes over Hurts?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={2}
            className="text-sm"
          />
          
          <Button 
            onClick={handleSubmit}
            disabled={!query.trim() || analysisMutation.isPending}
            className="w-full bg-plum hover:bg-purple-700"
          >
            {analysisMutation.isPending ? "Thinking..." : "Get Reality Check"}
          </Button>

          {response && (
            <div className="bg-white/80 border border-purple-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">Tiber says:</span>
                <Badge className={getRiskColor(response.riskLevel)}>
                  {response.riskLevel} risk
                </Badge>
              </div>
              <p className="text-sm text-gray-700">{response.recommendation}</p>
              {response.challengesToUserThinking && response.challengesToUserThinking.length > 0 && (
                <div className="pt-2 border-t border-purple-100">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                    <div>
                      <div className="text-xs font-medium text-amber-700">Reality Check:</div>
                      <p className="text-xs text-amber-600">{response.challengesToUserThinking[0]}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-plum" />
            Chat with Tiber
          </CardTitle>
          <p className="text-body">
            Ask about trades, draft strategy, roster moves, or any fantasy football decision. 
            Tiber provides blunt, evidence-based advice.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Ask about trades, draft strategy, roster moves, player analysis, or any fantasy football decision..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={4}
          />
          
          <Button 
            onClick={handleSubmit}
            disabled={!query.trim() || analysisMutation.isPending}
            className="bg-plum hover:bg-purple-700"
          >
            {analysisMutation.isPending ? "Analyzing..." : "Get Reality Check"}
          </Button>
        </CardContent>
      </Card>

      {response && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Tiber's Analysis</span>
              <div className="flex items-center gap-2">
                <Badge className={getRiskColor(response.riskLevel)}>
                  {response.riskLevel} risk
                </Badge>
                <Badge variant="outline">
                  {response.confidence}% confidence
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  Reality Checks
                </h4>
                <ul className="space-y-1">
                  {response.challengesToUserThinking.map((challenge, index) => (
                    <li key={index} className="text-body text-sm">• {challenge}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}