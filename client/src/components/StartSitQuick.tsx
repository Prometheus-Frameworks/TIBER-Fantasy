import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle, TrendingUp, Users, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface QuickStartSitResult {
  query: {
    a: string;
    b: string;
    week: string;
    leagueId: string | null;
  };
  verdict: "A" | "B" | "TOSS_UP";
  margin: number;
  summary: string;
  playerA: {
    name: string;
    team: string;
    position: string;
    breakdown: {
      total: number;
      projections: number;
      usage: number;
      matchup: number;
      volatility: number;
      news: number;
      reasons: string[];
    };
    liveData: {
      projPoints?: number;
      snapPct?: number;
      impliedTeamTotal?: number;
      injuryTag?: string | null;
    };
  };
  playerB: {
    name: string;
    team: string;
    position: string;
    breakdown: {
      total: number;
      projections: number;
      usage: number;
      matchup: number;
      volatility: number;
      news: number;
      reasons: string[];
    };
    liveData: {
      projPoints?: number;
      snapPct?: number;
      impliedTeamTotal?: number;
      injuryTag?: string | null;
    };
  };
  dataSource: string;
}

interface SleeperLeague {
  leagueId: string;
  name: string;
  season: number;
  scoring: {
    ppr?: number;
    sf?: boolean;
    te_premium?: number;
  };
  totalRosters: number;
  status: string;
}

interface SleeperLeaguesResponse {
  leagues: SleeperLeague[];
}

interface QuickTestResponse {
  status: string;
}

export function StartSitQuick() {
  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");
  const [sleeperUsername, setSleeperUsername] = useState("");
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [result, setResult] = useState<QuickStartSitResult | null>(null);
  const { toast } = useToast();

  // Fetch Sleeper leagues when username is provided
  const { data: leagues, isLoading: leaguesLoading } = useQuery<SleeperLeaguesResponse>({
    queryKey: [`/api/sleeper/leagues?username=${sleeperUsername}`],
    enabled: !!sleeperUsername,
  });

  // Test player resolution system
  const { data: resolutionTest } = useQuery<QuickTestResponse>({
    queryKey: ['/api/start-sit/quick/test'],
  });

  const startSitMutation = useMutation({
    mutationFn: async (data: { a: string; b: string; leagueId?: string }) => {
      const response = await apiRequest('POST', '/api/start-sit/quick', data);
      return await response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: "Analysis Complete!",
        description: `Verdict: ${data.verdict === 'TOSS_UP' ? 'Toss-up' : data.verdict === 'A' ? data.playerA.name : data.playerB.name}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!playerA.trim() || !playerB.trim()) {
      toast({
        title: "Missing Players",
        description: "Please enter both player names",
        variant: "destructive",
      });
      return;
    }

    startSitMutation.mutate({
      a: playerA.trim(),
      b: playerB.trim(),
      leagueId: selectedLeague || undefined,
    });
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "A": return "bg-green-500";
      case "B": return "bg-blue-500";
      case "TOSS_UP": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 60) return "text-green-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Zero-Manual-Stats Start/Sit</h1>
        <p className="text-muted-foreground">
          Just enter player names - we handle the rest with live data
        </p>
        {resolutionTest?.status === "quick_resolution_working" && (
          <Badge variant="outline" className="text-green-600">
            <CheckCircle className="w-4 h-4 mr-1" />
            Player Resolution Active
          </Badge>
        )}
      </div>

      {/* Optional Sleeper Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Connect Sleeper (Optional)
          </CardTitle>
          <CardDescription>
            Connect your Sleeper account for league-aware scoring adjustments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter your Sleeper username"
              value={sleeperUsername}
              onChange={(e) => setSleeperUsername(e.target.value)}
            />
          </div>
          
          {leagues?.leagues && leagues.leagues.length > 0 && (
            <div className="space-y-2">
              <Label>Select League for Scoring Context</Label>
              <select
                className="w-full p-2 border rounded"
                value={selectedLeague || ""}
                onChange={(e) => setSelectedLeague(e.target.value || null)}
              >
                <option value="">No league (use defaults)</option>
                {leagues.leagues.map((league: SleeperLeague) => (
                  <option key={league.leagueId} value={league.leagueId}>
                    {league.name} ({league.scoring.ppr}PPR{league.scoring.sf ? ', SF' : ''})
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Start/Sit Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Player Comparison
          </CardTitle>
          <CardDescription>
            Enter player names - no need for teams, positions, or stats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="playerA">Player A</Label>
                <Input
                  id="playerA"
                  placeholder="e.g., Josh Allen"
                  value={playerA}
                  onChange={(e) => setPlayerA(e.target.value)}
                  data-testid="input-player-a"
                />
              </div>
              <div>
                <Label htmlFor="playerB">Player B</Label>
                <Input
                  id="playerB"
                  placeholder="e.g., Lamar Jackson"
                  value={playerB}
                  onChange={(e) => setPlayerB(e.target.value)}
                  data-testid="input-player-b"
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              disabled={startSitMutation.isPending}
              className="w-full"
              data-testid="button-get-verdict"
            >
              {startSitMutation.isPending ? "Analyzing..." : "Get Verdict"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Analysis Results</span>
              <Badge className={getVerdictColor(result.verdict)}>
                {result.verdict === 'TOSS_UP' ? 'Toss-up' : 
                 result.verdict === 'A' ? result.playerA.name : result.playerB.name}
              </Badge>
            </CardTitle>
            <CardDescription>{result.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Player Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Player A */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    {result.playerA.name} ({result.playerA.team})
                  </h3>
                  <Badge variant="outline">{result.playerA.position}</Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Overall Score</span>
                    <span className={`font-semibold ${getScoreColor(result.playerA.breakdown.total)}`}>
                      {result.playerA.breakdown.total.toFixed(1)}
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Projections</span>
                      <span>{result.playerA.breakdown.projections.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Usage</span>
                      <span>{result.playerA.breakdown.usage.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Matchup</span>
                      <span>{result.playerA.breakdown.matchup.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Volatility</span>
                      <span>{result.playerA.breakdown.volatility.toFixed(1)}</span>
                    </div>
                  </div>

                  {result.playerA.liveData.projPoints && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      <div>Proj: {result.playerA.liveData.projPoints} pts</div>
                      <div>Implied Total: {result.playerA.liveData.impliedTeamTotal}</div>
                      {result.playerA.liveData.injuryTag && (
                        <Badge variant="destructive" className="text-xs">
                          {result.playerA.liveData.injuryTag}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Player B */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    {result.playerB.name} ({result.playerB.team})
                  </h3>
                  <Badge variant="outline">{result.playerB.position}</Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Overall Score</span>
                    <span className={`font-semibold ${getScoreColor(result.playerB.breakdown.total)}`}>
                      {result.playerB.breakdown.total.toFixed(1)}
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Projections</span>
                      <span>{result.playerB.breakdown.projections.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Usage</span>
                      <span>{result.playerB.breakdown.usage.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Matchup</span>
                      <span>{result.playerB.breakdown.matchup.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Volatility</span>
                      <span>{result.playerB.breakdown.volatility.toFixed(1)}</span>
                    </div>
                  </div>

                  {result.playerB.liveData.projPoints && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      <div>Proj: {result.playerB.liveData.projPoints} pts</div>
                      <div>Implied Total: {result.playerB.liveData.impliedTeamTotal}</div>
                      {result.playerB.liveData.injuryTag && (
                        <Badge variant="destructive" className="text-xs">
                          {result.playerB.liveData.injuryTag}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Margin & Data Source */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Margin: {result.margin.toFixed(2)} points</span>
              <Badge variant="outline" className="text-xs">
                <TrendingUp className="w-3 h-3 mr-1" />
                {result.dataSource}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}