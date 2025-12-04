import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Brain, AlertTriangle, Lightbulb, GraduationCap, Info } from "lucide-react";
import type { TiberResponse, TiberCompatResponse } from "@shared/types/tiber";

type ChatMode = 'insight' | 'analyst';

interface TiberChatProps {
  compact?: boolean;
}

export default function TiberChat({ compact = false }: TiberChatProps) {
  const [query, setQuery] = useState("");
  const [chatMode, setChatMode] = useState<ChatMode>('insight');
  const [response, setResponse] = useState<TiberResponse | null>(null);
  const [rawReply, setRawReply] = useState<string | null>(null);

  const analysisMutation = useMutation({
    mutationFn: async (params: { query: string; chatMode: ChatMode }) => {
      const response = await fetch('/api/tiber/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: params.query,
          chatMode: params.chatMode,
        }),
      });
      if (!response.ok) throw new Error('Failed to analyze request');
      return response.json();
    },
    onSuccess: (data: any) => {
      setRawReply(data.reply);
      if (data.answer) {
        setResponse(data.answer);
      }
    },
  });

  const handleSubmit = () => {
    if (!query.trim()) return;
    analysisMutation.mutate({ query: query.trim(), chatMode });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800'; 
    if (confidence >= 40) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const ModeSelector = () => (
    <div className="flex items-center gap-2">
      <Select value={chatMode} onValueChange={(val: ChatMode) => setChatMode(val)}>
        <SelectTrigger 
          className="w-[140px] h-8 text-xs bg-[#1a1f2e] border-gray-700"
          data-testid="select-chat-mode"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="insight" data-testid="option-insight-mode">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-3 w-3" />
              <span>Insight Mode</span>
            </div>
          </SelectItem>
          <SelectItem value="analyst" data-testid="option-analyst-mode">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-3 w-3" />
              <span>Analyst Mode</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white">
              <Info className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[280px] p-3">
            <div className="space-y-2 text-xs">
              <div>
                <span className="font-semibold flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" /> Insight Mode
                </span>
                <p className="text-gray-400 mt-0.5">
                  Clear, direct answers with actionable recommendations. Best for quick decisions.
                </p>
              </div>
              <div>
                <span className="font-semibold flex items-center gap-1">
                  <GraduationCap className="h-3 w-3" /> Analyst Mode
                </span>
                <p className="text-gray-400 mt-0.5">
                  Socratic coaching style. Forces you to think like a pro. Type <code className="bg-gray-700 px-1 rounded">/pro</code> for direct answers.
                </p>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  const CommandHints = () => (
    <div className="flex items-center gap-3 text-[10px] text-gray-500">
      <span><code className="bg-gray-800 px-1 rounded">/pro</code> direct answer</span>
      <span><code className="bg-gray-800 px-1 rounded">/raw</code> show metrics</span>
      <span className="text-gray-600">⌘+Enter to send</span>
    </div>
  );

  if (compact) {
    return (
      <Card className="border-purple-800/30 bg-gradient-to-br from-[#141824] to-[#1a1f2e]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Brain className="h-5 w-5 text-purple-400" />
              Ask Tiber
            </CardTitle>
            <ModeSelector />
          </div>
          <p className="text-sm text-gray-400">
            {chatMode === 'insight' 
              ? 'Get clear, actionable fantasy advice' 
              : 'Think like a pro analyst'
            }
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder={chatMode === 'insight' 
              ? "Should I trade for CMC? Start Mahomes over Hurts?"
              : "Challenge me on Puka vs Amon-Ra this week..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="text-sm bg-[#0a0e1a] border-gray-700 text-white placeholder:text-gray-500"
            data-testid="input-tiber-query"
          />
          
          <div className="flex items-center justify-between">
            <CommandHints />
            <Button 
              onClick={handleSubmit}
              disabled={!query.trim() || analysisMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium"
              data-testid="button-ask-tiber"
            >
              {analysisMutation.isPending ? "Thinking..." : "Ask Tiber"}
            </Button>
          </div>

          {rawReply && (
            <div className="bg-[#0a0e1a] border border-purple-800/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-white">Tiber says:</span>
                <Badge variant="outline" className="text-xs border-purple-600 text-purple-300">
                  {chatMode === 'analyst' ? 'Analyst' : 'Insight'}
                </Badge>
              </div>
              <div className="text-sm text-gray-200 whitespace-pre-wrap" data-testid="text-tiber-reply">
                {rawReply}
              </div>
            </div>
          )}

          {response && !rawReply && (
            <div className="bg-[#0a0e1a] border border-purple-800/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-white">Tiber says:</span>
                <Badge className={getConfidenceColor(response.confidence)}>
                  {response.confidence}% conf
                </Badge>
              </div>
              <p className="text-sm font-medium text-gray-200">{response.verdict}</p>
              
              {response.metrics && (
                <div className="space-y-2">
                  {response.metrics.name && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-gray-300">{response.metrics.name}</span>
                      <span className="text-gray-500">({response.metrics.team} {response.metrics.pos})</span>
                      {response.metrics.rag_color && (
                        <Badge variant="outline" className={`text-xs px-1 py-0 ${
                          response.metrics.rag_color === 'GREEN' ? 'border-green-500 text-green-400' :
                          response.metrics.rag_color === 'YELLOW' ? 'border-yellow-500 text-yellow-400' :
                          'border-red-500 text-red-400'
                        }`}>
                          {response.metrics.rag_color}
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {response.metrics.expected_points && (
                      <div>
                        <span className="text-gray-500">Expected:</span>
                        <span className="font-medium ml-1 text-white">{response.metrics.expected_points} pts</span>
                      </div>
                    )}
                    {response.metrics.ceiling_points && (
                      <div>
                        <span className="text-gray-500">Ceiling:</span>
                        <span className="font-medium ml-1 text-white">{response.metrics.ceiling_points} pts</span>
                      </div>
                    )}
                    {response.metrics.delta_vs_ecr && (
                      <div>
                        <span className="text-gray-500">vs ECR:</span>
                        <span className={`font-medium ml-1 ${response.metrics.delta_vs_ecr > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {response.metrics.delta_vs_ecr > 0 ? '+' : ''}{response.metrics.delta_vs_ecr}
                        </span>
                      </div>
                    )}
                    {response.metrics.upside_index && (
                      <div>
                        <span className="text-gray-500">Upside:</span>
                        <span className="font-medium ml-1 text-white">{response.metrics.upside_index}/100</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {response.reasons && response.reasons.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-purple-800/30">
                  {response.reasons.map((reason, index) => (
                    <p key={index} className="text-xs text-gray-400">• {reason}</p>
                  ))}
                </div>
              )}
              
              {response.contingencies && response.contingencies.length > 0 && (
                <div className="pt-2 border-t border-purple-800/30">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                    <div>
                      <div className="text-xs font-medium text-amber-400">Note:</div>
                      <p className="text-xs text-amber-300">{response.contingencies[0]}</p>
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
      <Card className="bg-[#141824] border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <Brain className="h-5 w-5 text-purple-400" />
              Chat with Tiber
            </CardTitle>
            <ModeSelector />
          </div>
          <p className="text-gray-400">
            {chatMode === 'insight' 
              ? 'Ask about trades, draft strategy, roster moves, or any fantasy football decision. Get clear, actionable advice.'
              : 'Challenge your thinking with Socratic analysis. Tiber will ask questions to sharpen your decision-making.'
            }
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder={chatMode === 'insight'
              ? "Ask about trades, draft strategy, roster moves, player analysis, or any fantasy football decision..."
              : "Ask a question and prepare to defend your position..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            className="bg-[#0a0e1a] border-gray-700 text-white placeholder:text-gray-500"
            data-testid="input-tiber-query-full"
          />
          
          <div className="flex items-center justify-between">
            <CommandHints />
            <Button 
              onClick={handleSubmit}
              disabled={!query.trim() || analysisMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium"
              data-testid="button-ask-tiber-full"
            >
              {analysisMutation.isPending ? "Analyzing..." : "Ask Tiber"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {rawReply && (
        <Card className="bg-[#141824] border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <span>Tiber's Analysis</span>
              <Badge variant="outline" className="border-purple-600 text-purple-300">
                {chatMode === 'analyst' ? 'Analyst Mode' : 'Insight Mode'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-gray-200 whitespace-pre-wrap" data-testid="text-tiber-reply-full">
              {rawReply}
            </div>
          </CardContent>
        </Card>
      )}

      {response && !rawReply && (
        <Card className="bg-[#141824] border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <span>Tiber's Analysis</span>
              <div className="flex items-center gap-2">
                <Badge className={getConfidenceColor(response.confidence)}>
                  {response.confidence}% conf
                </Badge>
                <Badge variant="outline" className="border-gray-600 text-gray-300">
                  {response.tone}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 text-white">Verdict</h4>
              <p className="text-gray-300">{response.verdict}</p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2 text-white">Reasons</h4>
              <ul className="space-y-1">
                {response.reasons.map((reason, index) => (
                  <li key={index} className="text-gray-400 text-sm">• {reason}</li>
                ))}
              </ul>
            </div>

            {response.contingencies && response.contingencies.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Contingencies
                </h4>
                <ul className="space-y-1">
                  {response.contingencies.map((contingency, index) => (
                    <li key={index} className="text-gray-400 text-sm">• {contingency}</li>
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
