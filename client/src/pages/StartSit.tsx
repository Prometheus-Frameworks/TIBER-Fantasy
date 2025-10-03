import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useStartSitAnalysis, useStartSitComparison } from "@shared/startSitHooks";
import type { StartSitPlayerProfile, StartSitVerdict, Position } from "@shared/startSit";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Target, Users, Zap, X } from "lucide-react";
import { usePlayerPool } from "@/hooks/usePlayerPool";

type Mode = "single" | "compare";

interface SelectedPlayer {
  id: string;
  name: string;
  position: Position;
  team: string;
}

export default function StartSit() {
  const [mode, setMode] = useState<Mode>("single");
  const [week, setWeek] = useState(5);
  const [season] = useState(2024);
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(null);
  const [comparePlayers, setComparePlayers] = useState<SelectedPlayer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPlayerSearch, setShowPlayerSearch] = useState(false);
  const [searchingFor, setSearchingFor] = useState<"single" | "compare">("single");
  
  const { toast } = useToast();
  const analysisMutation = useStartSitAnalysis();
  const comparisonMutation = useStartSitComparison();
  
  const { data: playerPool = [], isLoading: isLoadingPlayers } = usePlayerPool({
    search: searchQuery,
    limit: 50
  });

  const handleAnalyze = () => {
    if (!selectedPlayer) {
      toast({
        title: "Error",
        description: "Please select a player to analyze",
        variant: "destructive"
      });
      return;
    }

    analysisMutation.mutate(
      { playerId: selectedPlayer.id, week, season },
      {
        onError: (error: any) => {
          toast({
            title: "Analysis Failed",
            description: error?.message || "Failed to analyze player. Please try again.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const handleCompare = () => {
    if (comparePlayers.length < 2) {
      toast({
        title: "Error",
        description: "Please select at least 2 players to compare",
        variant: "destructive"
      });
      return;
    }

    if (comparePlayers.length > 4) {
      toast({
        title: "Error",
        description: "Maximum 4 players can be compared at once",
        variant: "destructive"
      });
      return;
    }

    comparisonMutation.mutate(
      { 
        playerIds: comparePlayers.map(p => p.id), 
        week, 
        season 
      },
      {
        onError: (error: any) => {
          toast({
            title: "Comparison Failed",
            description: error?.message || "Failed to compare players. Please try again.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const handlePlayerSelect = (player: any) => {
    const selected: SelectedPlayer = {
      id: player.id,
      name: player.name,
      position: player.pos as Position,
      team: player.team
    };

    if (searchingFor === "single") {
      setSelectedPlayer(selected);
    } else {
      if (comparePlayers.length < 4 && !comparePlayers.find(p => p.id === player.id)) {
        setComparePlayers([...comparePlayers, selected]);
      } else if (comparePlayers.find(p => p.id === player.id)) {
        toast({
          title: "Player already added",
          description: "This player is already in the comparison list",
          variant: "destructive"
        });
      }
    }
    setShowPlayerSearch(false);
    setSearchQuery("");
  };

  const removeComparePlayer = (playerId: string) => {
    setComparePlayers(comparePlayers.filter(p => p.id !== playerId));
  };

  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-6">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
          <Target className="h-8 w-8 text-green-600 dark:text-green-400" />
          Start/Sit Decision System
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          AI-powered lineup decisions with detailed factor analysis
        </p>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="single" data-testid="tab-single">
            <Zap className="h-4 w-4 mr-2" />
            Single Analysis
          </TabsTrigger>
          <TabsTrigger value="compare" data-testid="tab-compare">
            <Users className="h-4 w-4 mr-2" />
            Compare Players
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Analyze Player</CardTitle>
              <CardDescription>Get a comprehensive start/sit decision for a single player</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
                <div className="space-y-2">
                  <Label htmlFor="player-search-single">Player</Label>
                  <div className="relative">
                    <Input
                      id="player-search-single"
                      data-testid="input-player-single"
                      placeholder="Search for a player..."
                      value={selectedPlayer?.name || searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowPlayerSearch(true);
                        setSearchingFor("single");
                        if (e.target.value === "") setSelectedPlayer(null);
                      }}
                      onFocus={() => {
                        setShowPlayerSearch(true);
                        setSearchingFor("single");
                      }}
                    />
                    {selectedPlayer && (
                      <Badge className="absolute right-2 top-2" variant="secondary">
                        {selectedPlayer.position} - {selectedPlayer.team}
                      </Badge>
                    )}
                  </div>
                  {showPlayerSearch && searchingFor === "single" && searchQuery.length >= 2 && (
                    <Card className="absolute z-50 mt-1 max-h-80 overflow-y-auto">
                      <CardContent className="p-2">
                        {isLoadingPlayers ? (
                          <div className="p-4 text-center">Loading players...</div>
                        ) : playerPool.length > 0 ? (
                          playerPool.map((player) => (
                            <div
                              key={player.id}
                              className="p-3 hover:bg-accent rounded-md cursor-pointer"
                              onClick={() => handlePlayerSelect(player)}
                              data-testid={`player-option-${player.id}`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">{player.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {player.pos} - {player.team}
                                  </div>
                                </div>
                                <Badge variant="outline">{player.pos}</Badge>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-muted-foreground">
                            No players found
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="week-single">Week</Label>
                  <Select value={week.toString()} onValueChange={(v) => setWeek(Number(v))}>
                    <SelectTrigger id="week-single" data-testid="select-week-single" className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                        <SelectItem key={w} value={w.toString()}>
                          Week {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={handleAnalyze}
                    disabled={!selectedPlayer || analysisMutation.isPending}
                    data-testid="button-analyze"
                  >
                    {analysisMutation.isPending ? "Analyzing..." : "Analyze"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {analysisMutation.isSuccess && analysisMutation.data && (
            <DecisionCard profile={analysisMutation.data} />
          )}

          {analysisMutation.isError && (
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Failed to analyze player. Please try again.</span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="compare">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Compare Players</CardTitle>
              <CardDescription>Compare 2-4 players head-to-head for Week {week}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
                  <div className="space-y-2">
                    <Label htmlFor="player-search-compare">Add Player</Label>
                    <div className="relative">
                      <Input
                        id="player-search-compare"
                        data-testid="input-player-compare"
                        placeholder="Search to add player..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowPlayerSearch(true);
                          setSearchingFor("compare");
                        }}
                        onFocus={() => {
                          setShowPlayerSearch(true);
                          setSearchingFor("compare");
                        }}
                      />
                      {showPlayerSearch && searchingFor === "compare" && searchQuery.length >= 2 && (
                        <Card className="absolute z-50 mt-1 max-h-80 overflow-y-auto w-full">
                          <CardContent className="p-2">
                            {isLoadingPlayers ? (
                              <div className="p-4 text-center">Loading players...</div>
                            ) : playerPool.length > 0 ? (
                              playerPool.map((player) => (
                                <div
                                  key={player.id}
                                  className="p-3 hover:bg-accent rounded-md cursor-pointer"
                                  onClick={() => handlePlayerSelect(player)}
                                  data-testid={`player-option-compare-${player.id}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-medium">{player.name}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {player.pos} - {player.team}
                                      </div>
                                    </div>
                                    <Badge variant="outline">{player.pos}</Badge>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="p-4 text-center text-muted-foreground">
                                No players found
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="week-compare">Week</Label>
                    <Select value={week.toString()} onValueChange={(v) => setWeek(Number(v))}>
                      <SelectTrigger id="week-compare" data-testid="select-week-compare" className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                          <SelectItem key={w} value={w.toString()}>
                            Week {w}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button
                      onClick={handleCompare}
                      disabled={comparePlayers.length < 2 || comparisonMutation.isPending}
                      data-testid="button-compare"
                    >
                      {comparisonMutation.isPending ? "Comparing..." : "Compare"}
                    </Button>
                  </div>
                </div>

                {comparePlayers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {comparePlayers.map((player) => (
                      <Badge key={player.id} variant="secondary" className="text-sm px-3 py-1.5">
                        {player.name} ({player.position} - {player.team})
                        <button
                          onClick={() => removeComparePlayer(player.id)}
                          className="ml-2 hover:text-destructive"
                          data-testid={`remove-player-${player.id}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {comparisonMutation.isSuccess && comparisonMutation.data && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
              {comparisonMutation.data
                .sort((a, b) => (b.expectedRange?.median || 0) - (a.expectedRange?.median || 0))
                .map((verdict, index) => (
                  <ComparisonCard key={verdict.playerId} verdict={verdict} rank={index + 1} />
                ))}
            </div>
          )}

          {comparisonMutation.isError && (
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Failed to compare players. Please try again.</span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DecisionCard({ profile }: { profile: StartSitPlayerProfile }) {
  const verdictColor = getVerdictColor(profile.factorBreakdown.normalizedScore);
  const verdict = getVerdict(profile.factorBreakdown.normalizedScore);
  const confidence = getConfidence(profile.factorBreakdown);

  return (
    <Card className="border-2" data-testid="decision-card">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-2xl">{profile.name}</CardTitle>
            <CardDescription>
              {profile.position} - {profile.team} vs {profile.opponent} | Week {profile.week}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={verdictColor} data-testid="verdict-badge">
              {verdict}
            </Badge>
            <Badge variant="outline" data-testid="confidence-badge">
              {confidence} Confidence
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Start/Sit Score</span>
            <span className="text-2xl font-bold" data-testid="score-value">
              {profile.factorBreakdown.normalizedScore}/100
            </span>
          </div>
          <Progress value={profile.factorBreakdown.normalizedScore} className="h-3" />
        </div>

        {profile.projection && (
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-semibold mb-3">Expected Points Range</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Floor</div>
                <div className="text-xl font-bold" data-testid="projection-floor">
                  {profile.projection.floor?.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Median</div>
                <div className="text-xl font-bold text-primary" data-testid="projection-median">
                  {profile.projection.median?.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Ceiling</div>
                <div className="text-xl font-bold" data-testid="projection-ceiling">
                  {profile.projection.ceiling?.toFixed(1)}
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <h4 className="font-semibold mb-3">Factor Breakdown</h4>
          <div className="grid gap-3">
            {profile.factorBreakdown.factors.map((factor) => (
              <FactorDisplay key={factor.key} factor={factor} />
            ))}
          </div>
        </div>

        {profile.factorBreakdown.riskFlags && profile.factorBreakdown.riskFlags.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Risk Flags
            </h4>
            <div className="flex flex-wrap gap-2">
              {profile.factorBreakdown.riskFlags.map((flag, i) => (
                <Badge key={i} variant="destructive" data-testid={`risk-flag-${i}`}>
                  {flag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {profile.notes && profile.notes.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Analysis Notes</h4>
            <ul className="space-y-2">
              {profile.notes.map((note, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonCard({ verdict, rank }: { verdict: StartSitVerdict; rank: number }) {
  const verdictColor = getVerdictColor(verdict.expectedRange?.median || 50);
  const confidence = verdict.confidence;

  return (
    <Card className={`border-2 ${rank === 1 ? 'border-green-500 dark:border-green-700' : ''}`} data-testid={`comparison-card-${rank}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            {rank === 1 && <span className="text-2xl">🏆</span>}
            Rank #{rank}
          </CardTitle>
          <Badge className={verdictColor}>{verdict.verdict}</Badge>
        </div>
        <CardDescription>
          Player ID: {verdict.playerId} | Week {verdict.week}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Expected Points</span>
            <Badge variant="outline">{confidence} Confidence</Badge>
          </div>
          {verdict.expectedRange && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-muted-foreground">Floor</div>
                <div className="font-bold">{verdict.expectedRange.floor.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Median</div>
                <div className="font-bold text-primary text-lg">{verdict.expectedRange.median.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Ceiling</div>
                <div className="font-bold">{verdict.expectedRange.ceiling.toFixed(1)}</div>
              </div>
            </div>
          )}
        </div>

        {verdict.tier && (
          <Badge variant="secondary" className="w-full justify-center py-2">
            {verdict.tier.replace(/_/g, ' ')}
          </Badge>
        )}

        {verdict.rationale && verdict.rationale.length > 0 && (
          <div>
            <h5 className="text-sm font-semibold mb-2">Key Points</h5>
            <ul className="space-y-1">
              {verdict.rationale.slice(0, 3).map((point, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {verdict.factorSummary && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {verdict.factorSummary.boost.length > 0 && (
              <div>
                <div className="font-semibold text-green-600 dark:text-green-400 mb-1">Boosts</div>
                {verdict.factorSummary.boost.slice(0, 2).map((b, i) => (
                  <div key={i} className="truncate">↑ {b}</div>
                ))}
              </div>
            )}
            {verdict.factorSummary.downgrade.length > 0 && (
              <div>
                <div className="font-semibold text-red-600 dark:text-red-400 mb-1">Concerns</div>
                {verdict.factorSummary.downgrade.slice(0, 2).map((d, i) => (
                  <div key={i} className="truncate">↓ {d}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FactorDisplay({ factor }: { factor: any }) {
  const impactIcon = factor.impact === "boost" ? 
    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" /> :
    factor.impact === "downgrade" ?
    <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" /> :
    <Minus className="h-4 w-4 text-gray-500" />;

  const impactColor = factor.impact === "boost" ? 
    "text-green-600 dark:text-green-400" :
    factor.impact === "downgrade" ?
    "text-red-600 dark:text-red-400" :
    "text-gray-500";

  return (
    <div className="bg-muted/30 p-3 rounded-lg" data-testid={`factor-${factor.key}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {impactIcon}
          <span className="font-medium text-sm">{factor.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            {(factor.weight * 100).toFixed(0)}% weight
          </Badge>
          <span className={`font-bold ${impactColor}`}>
            {factor.score.toFixed(0)}/100
          </span>
        </div>
      </div>
      {factor.note && (
        <p className="text-xs text-muted-foreground mt-2">{factor.note}</p>
      )}
    </div>
  );
}

function getVerdictColor(score: number): string {
  if (score >= 75) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
  if (score >= 50) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
  if (score >= 30) return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
  return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
}

function getVerdict(score: number): string {
  if (score >= 75) return "START";
  if (score >= 50) return "FLEX";
  if (score >= 30) return "SIT";
  return "BENCH";
}

function getConfidence(breakdown: any): string {
  const factors = breakdown.factors || [];
  const avgScore = factors.reduce((sum: number, f: any) => sum + f.score, 0) / factors.length;
  if (avgScore >= 70) return "HIGH";
  if (avgScore >= 40) return "MEDIUM";
  return "LOW";
}
