import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Command } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface CommandResult {
  success: boolean;
  message: string;
  logEntry?: string;
  command?: {
    position: string;
    rank: number;
    playerName: string;
    format: string;
  };
  shifts?: Array<{
    playerName: string;
    fromRank: number;
    toRank: number;
  }>;
}

export default function ConsensusSeeding() {
  const [command, setCommand] = useState("");
  const [results, setResults] = useState<CommandResult[]>([]);
  const queryClient = useQueryClient();

  const seedMutation = useMutation({
    mutationFn: async (command: string) => {
      return apiRequest("/api/consensus/seed", {
        method: "POST",
        body: JSON.stringify({ command }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (result: CommandResult) => {
      setResults(prev => [result, ...prev]);
      setCommand("");
      // Invalidate consensus data to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/consensus"] });
    },
    onError: (error: any) => {
      const errorResult: CommandResult = {
        success: false,
        message: error.message || "Failed to process command"
      };
      setResults(prev => [errorResult, ...prev]);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    seedMutation.mutate(command.trim());
  };

  const examples = [
    "OTC consensus WR1 : Ja'Marr Chase",
    "OTC consensus RB4 : Omarion Hampton",
    "OTC consensus QB8 : Caleb Williams",
    "OTC consensus TE3 : Brock Bowers"
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Command className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            OTC Consensus Seeding Protocol v1
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manual ranking updates using shorthand syntax
          </p>
        </div>
      </div>

      {/* Command Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seed Command</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="command">Consensus Command</Label>
              <Input
                id="command"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="OTC consensus RB4 : Omarion Hampton"
                className="font-mono"
                disabled={seedMutation.isPending}
              />
              <p className="text-sm text-gray-500 mt-1">
                Format: OTC consensus &lt;POSITION&gt;&lt;RANK&gt; : &lt;PLAYER NAME&gt;
              </p>
            </div>
            
            <Button 
              type="submit" 
              disabled={!command.trim() || seedMutation.isPending}
              className="w-full"
            >
              {seedMutation.isPending ? "Processing..." : "Execute Command"}
            </Button>
          </form>

          {/* Examples */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Example Commands
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {examples.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => setCommand(example)}
                  className="text-left p-2 text-sm font-mono bg-gray-50 dark:bg-gray-800 rounded border hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  disabled={seedMutation.isPending}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Command Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map((result, idx) => (
              <Alert 
                key={idx} 
                className={result.success ? "border-green-200 bg-green-50 dark:bg-green-900/20" : "border-red-200 bg-red-50 dark:bg-red-900/20"}
              >
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-2">
                    <AlertDescription className="text-sm">
                      {result.message}
                    </AlertDescription>
                    
                    {result.command && (
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary">
                          {result.command.position}{result.command.rank}
                        </Badge>
                        <Badge variant="outline">
                          {result.command.playerName}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {result.command.format}
                        </Badge>
                      </div>
                    )}
                    
                    {result.logEntry && (
                      <div className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded">
                        {result.logEntry}
                      </div>
                    )}
                    
                    {result.shifts && result.shifts.length > 0 && (
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        <p className="font-medium">Rank shifts:</p>
                        <ul className="list-disc list-inside ml-2">
                          {result.shifts.map((shift, shiftIdx) => (
                            <li key={shiftIdx}>
                              {shift.playerName}: #{shift.fromRank} → #{shift.toRank}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Protocol Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Protocol Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Syntax</h4>
            <p className="text-gray-600 dark:text-gray-400">
              OTC consensus &lt;POSITION&gt;&lt;RANK&gt; : &lt;PLAYER NAME&gt;
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Positions</h4>
            <p className="text-gray-600 dark:text-gray-400">
              QB, RB, WR, TE (case-insensitive)
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Ranks</h4>
            <p className="text-gray-600 dark:text-gray-400">
              1-99 (if rank exists, existing players shift down)
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Player Names</h4>
            <p className="text-gray-600 dark:text-gray-400">
              Must match exactly with database entries
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}