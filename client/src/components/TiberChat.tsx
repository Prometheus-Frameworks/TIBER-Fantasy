import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Brain, AlertTriangle } from "lucide-react";
import type { TiberResponse, TiberCompatResponse } from "@shared/types/tiber";

interface TiberChatProps {
  compact?: boolean;
}

export default function TiberChat({ compact = false }: TiberChatProps) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<TiberResponse | null>(null);

  const analysisMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) throw new Error('Failed to analyze request');
      return response.json();
    },
    onSuccess: (data: any) => {
      setResponse(data.answer);
    },
  });

  const handleSubmit = () => {
    if (!query.trim()) return;
    analysisMutation.mutate(query.trim());
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800'; 
    if (confidence >= 40) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
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
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium"
          >
            {analysisMutation.isPending ? "Thinking..." : "Ask Tiber"}
          </Button>

          {response && (
            <div className="bg-white/80 border border-purple-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">Tiber says:</span>
                <Badge className={getConfidenceColor(response.confidence)}>
                  {response.confidence}% conf
                </Badge>
              </div>
              <p className="text-sm font-medium text-gray-800">{response.verdict}</p>
              
              {/* Show detailed reasoning in compact mode too */}
              {response.reasons && response.reasons.length > 0 && (
                <div className="space-y-1">
                  {response.reasons.map((reason, index) => (
                    <p key={index} className="text-xs text-gray-600">• {reason}</p>
                  ))}
                </div>
              )}
              
              {response.contingencies && response.contingencies.length > 0 && (
                <div className="pt-2 border-t border-purple-100">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                    <div>
                      <div className="text-xs font-medium text-amber-700">Note:</div>
                      <p className="text-xs text-amber-600">{response.contingencies[0]}</p>
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
            Tiber provides blunt, evidence-based advice from a curated knowledge base.
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
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium"
          >
            {analysisMutation.isPending ? "Analyzing..." : "Ask Tiber"}
          </Button>
        </CardContent>
      </Card>

      {response && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Tiber's Analysis</span>
              <div className="flex items-center gap-2">
                <Badge className={getConfidenceColor(response.confidence)}>
                  {response.confidence}% conf
                </Badge>
                <Badge variant="outline">
                  {response.tone}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Verdict</h4>
              <p className="text-body">{response.verdict}</p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Reasons</h4>
              <ul className="space-y-1">
                {response.reasons.map((reason, index) => (
                  <li key={index} className="text-body text-sm">• {reason}</li>
                ))}
              </ul>
            </div>

            {response.contingencies && response.contingencies.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Contingencies
                </h4>
                <ul className="space-y-1">
                  {response.contingencies.map((contingency, index) => (
                    <li key={index} className="text-body text-sm">• {contingency}</li>
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