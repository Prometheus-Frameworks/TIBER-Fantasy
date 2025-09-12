import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { Calculator, TrendingUp, TrendingDown, Users } from "lucide-react";

type Position = "QB" | "RB" | "WR" | "TE" | "DST" | "K";

interface PlayerForm {
  name: string;
  team: string;
  position: Position;
  projPoints: number | null;
  snapPct: number | null;
  targetShare: number | null;
  defRankVsPos: number | null;
  impliedTeamTotal: number | null;
  injuryTag: "OUT" | "D" | "Q" | "P" | null;
  newsHeat: number | null;
}

interface StartSitResult {
  verdict: "START_A" | "START_B" | "LEAN_A" | "LEAN_B" | "TOSS_UP";
  margin: number;
  summary: string;
  playerA: {
    name: string;
    position: string;
    breakdown: {
      projections: number;
      usage: number;
      matchup: number;
      volatility: number;
      news: number;
      total: number;
      reasons: string[];
    };
  };
  playerB: {
    name: string;
    position: string;
    breakdown: {
      projections: number;
      usage: number;
      matchup: number;
      volatility: number;
      news: number;
      total: number;
      reasons: string[];
    };
  };
}

const initialPlayerForm: PlayerForm = {
  name: "",
  team: "",
  position: "RB",
  projPoints: null,
  snapPct: null,
  targetShare: null,
  defRankVsPos: null,
  impliedTeamTotal: null,
  injuryTag: null,
  newsHeat: null,
};

const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];
const INJURY_TAGS = [
  { value: null, label: "Healthy" },
  { value: "P" as const, label: "Probable" },
  { value: "Q" as const, label: "Questionable" },
  { value: "D" as const, label: "Doubtful" },
  { value: "OUT" as const, label: "Out" },
];

function PlayerFormCard({ 
  player, 
  setPlayer, 
  title, 
  playerKey 
}: { 
  player: PlayerForm;
  setPlayer: (player: PlayerForm) => void;
  title: string;
  playerKey: "A" | "B";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>Enter player information for analysis</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`name-${playerKey}`}>Player Name</Label>
            <Input
              id={`name-${playerKey}`}
              data-testid={`input-player-name-${playerKey.toLowerCase()}`}
              value={player.name}
              onChange={(e) => setPlayer({ ...player, name: e.target.value })}
              placeholder="e.g., Josh Allen"
            />
          </div>
          <div>
            <Label htmlFor={`team-${playerKey}`}>Team</Label>
            <Input
              id={`team-${playerKey}`}
              data-testid={`input-team-${playerKey.toLowerCase()}`}
              value={player.team}
              onChange={(e) => setPlayer({ ...player, team: e.target.value })}
              placeholder="e.g., BUF"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`position-${playerKey}`}>Position</Label>
            <Select
              value={player.position}
              onValueChange={(value: Position) => setPlayer({ ...player, position: value })}
            >
              <SelectTrigger data-testid={`select-position-${playerKey.toLowerCase()}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSITIONS.map(pos => (
                  <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={`proj-${playerKey}`}>Projected Points</Label>
            <Input
              id={`proj-${playerKey}`}
              data-testid={`input-proj-points-${playerKey.toLowerCase()}`}
              type="number"
              step="0.1"
              value={player.projPoints ?? ""}
              onChange={(e) => setPlayer({ ...player, projPoints: e.target.value ? Number(e.target.value) : null })}
              placeholder="e.g., 18.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`snap-${playerKey}`}>Snap % (0-100)</Label>
            <Input
              id={`snap-${playerKey}`}
              data-testid={`input-snap-pct-${playerKey.toLowerCase()}`}
              type="number"
              min="0"
              max="100"
              value={player.snapPct ?? ""}
              onChange={(e) => setPlayer({ ...player, snapPct: e.target.value ? Number(e.target.value) : null })}
              placeholder="e.g., 85"
            />
          </div>
          <div>
            <Label htmlFor={`target-${playerKey}`}>Target Share % (0-100)</Label>
            <Input
              id={`target-${playerKey}`}
              data-testid={`input-target-share-${playerKey.toLowerCase()}`}
              type="number"
              min="0"
              max="100"
              value={player.targetShare ?? ""}
              onChange={(e) => setPlayer({ ...player, targetShare: e.target.value ? Number(e.target.value) : null })}
              placeholder="e.g., 25"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`def-rank-${playerKey}`}>Defense Rank vs Pos (1-32)</Label>
            <Input
              id={`def-rank-${playerKey}`}
              data-testid={`input-def-rank-${playerKey.toLowerCase()}`}
              type="number"
              min="1"
              max="32"
              value={player.defRankVsPos ?? ""}
              onChange={(e) => setPlayer({ ...player, defRankVsPos: e.target.value ? Number(e.target.value) : null })}
              placeholder="e.g., 15 (1=hardest, 32=easiest)"
            />
          </div>
          <div>
            <Label htmlFor={`implied-${playerKey}`}>Team Implied Total</Label>
            <Input
              id={`implied-${playerKey}`}
              data-testid={`input-implied-total-${playerKey.toLowerCase()}`}
              type="number"
              step="0.5"
              value={player.impliedTeamTotal ?? ""}
              onChange={(e) => setPlayer({ ...player, impliedTeamTotal: e.target.value ? Number(e.target.value) : null })}
              placeholder="e.g., 24.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`injury-${playerKey}`}>Injury Status</Label>
            <Select
              value={player.injuryTag ?? "healthy"}
              onValueChange={(value) => setPlayer({ ...player, injuryTag: value === "healthy" ? null : value as any })}
            >
              <SelectTrigger data-testid={`select-injury-${playerKey.toLowerCase()}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INJURY_TAGS.map(tag => (
                  <SelectItem key={tag.value ?? "healthy"} value={tag.value ?? "healthy"}>
                    {tag.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={`news-${playerKey}`}>News Heat (0-100)</Label>
            <Input
              id={`news-${playerKey}`}
              data-testid={`input-news-heat-${playerKey.toLowerCase()}`}
              type="number"
              min="0"
              max="100"
              value={player.newsHeat ?? ""}
              onChange={(e) => setPlayer({ ...player, newsHeat: e.target.value ? Number(e.target.value) : null })}
              placeholder="e.g., 75 (positive news)"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultsCard({ result }: { result: StartSitResult }) {
  const getVerdictBadge = (verdict: string) => {
    if (verdict.includes("START")) return "default";
    if (verdict.includes("LEAN")) return "secondary";
    return "outline";
  };

  const getVerdictIcon = (verdict: string) => {
    if (verdict.includes("_A")) return <TrendingUp className="h-4 w-4" />;
    if (verdict.includes("_B")) return <TrendingDown className="h-4 w-4" />;
    return <Users className="h-4 w-4" />;
  };

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Start/Sit Analysis Results
        </CardTitle>
        <CardDescription>AI-powered recommendation with detailed reasoning</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Verdict Summary */}
        <div className="text-center p-6 bg-muted rounded-lg">
          <Badge 
            variant={getVerdictBadge(result.verdict)} 
            className="mb-4 text-lg px-4 py-2"
          >
            <span className="flex items-center gap-2">
              {getVerdictIcon(result.verdict)}
              {result.verdict.replace("_", " ")}
            </span>
          </Badge>
          <p className="text-lg font-medium mb-2">{result.summary}</p>
          <p className="text-sm text-muted-foreground">
            Confidence Margin: {result.margin.toFixed(1)} points
          </p>
        </div>

        {/* Side-by-Side Comparison */}
        <div className="grid grid-cols-2 gap-6">
          {/* Player A */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-xl font-bold">{result.playerA.name}</h3>
              <p className="text-muted-foreground">{result.playerA.position}</p>
              <div className="text-2xl font-bold mt-2">
                {result.playerA.breakdown.total.toFixed(1)}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Projections</span>
                  <span>{result.playerA.breakdown.projections.toFixed(1)}</span>
                </div>
                <Progress value={result.playerA.breakdown.projections} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Usage</span>
                  <span>{result.playerA.breakdown.usage.toFixed(1)}</span>
                </div>
                <Progress value={result.playerA.breakdown.usage} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Matchup</span>
                  <span>{result.playerA.breakdown.matchup.toFixed(1)}</span>
                </div>
                <Progress value={result.playerA.breakdown.matchup} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Reliability</span>
                  <span>{result.playerA.breakdown.volatility.toFixed(1)}</span>
                </div>
                <Progress value={result.playerA.breakdown.volatility} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>News/Market</span>
                  <span>{result.playerA.breakdown.news.toFixed(1)}</span>
                </div>
                <Progress value={result.playerA.breakdown.news} />
              </div>
            </div>
          </div>

          {/* Player B */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-xl font-bold">{result.playerB.name}</h3>
              <p className="text-muted-foreground">{result.playerB.position}</p>
              <div className="text-2xl font-bold mt-2">
                {result.playerB.breakdown.total.toFixed(1)}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Projections</span>
                  <span>{result.playerB.breakdown.projections.toFixed(1)}</span>
                </div>
                <Progress value={result.playerB.breakdown.projections} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Usage</span>
                  <span>{result.playerB.breakdown.usage.toFixed(1)}</span>
                </div>
                <Progress value={result.playerB.breakdown.usage} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Matchup</span>
                  <span>{result.playerB.breakdown.matchup.toFixed(1)}</span>
                </div>
                <Progress value={result.playerB.breakdown.matchup} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Reliability</span>
                  <span>{result.playerB.breakdown.volatility.toFixed(1)}</span>
                </div>
                <Progress value={result.playerB.breakdown.volatility} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>News/Market</span>
                  <span>{result.playerB.breakdown.news.toFixed(1)}</span>
                </div>
                <Progress value={result.playerB.breakdown.news} />
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Reasoning */}
        <Separator />
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-3">{result.playerA.name} Analysis</h4>
            <div className="space-y-2 text-sm">
              {result.playerA.breakdown.reasons.map((reason, idx) => (
                <div key={idx} className="p-2 bg-muted rounded text-xs font-mono">
                  {reason}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-3">{result.playerB.name} Analysis</h4>
            <div className="space-y-2 text-sm">
              {result.playerB.breakdown.reasons.map((reason, idx) => (
                <div key={idx} className="p-2 bg-muted rounded text-xs font-mono">
                  {reason}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StartSit() {
  const [playerA, setPlayerA] = useState<PlayerForm>(initialPlayerForm);
  const [playerB, setPlayerB] = useState<PlayerForm>({ ...initialPlayerForm, name: "", team: "" });
  const [result, setResult] = useState<StartSitResult | null>(null);

  const { mutate: calculateStartSit, isPending } = useMutation({
    mutationFn: async (data: { playerA: PlayerForm; playerB: PlayerForm }) => {
      const requestBody = {
        playerA: {
          id: data.playerA.name.toLowerCase().replace(/\s+/g, ''),
          name: data.playerA.name,
          team: data.playerA.team,
          position: data.playerA.position,
          projPoints: data.playerA.projPoints,
          snapPct: data.playerA.snapPct,
          targetShare: data.playerA.targetShare,
          defRankVsPos: data.playerA.defRankVsPos,
          impliedTeamTotal: data.playerA.impliedTeamTotal,
          injuryTag: data.playerA.injuryTag,
          newsHeat: data.playerA.newsHeat,
        },
        playerB: {
          id: data.playerB.name.toLowerCase().replace(/\s+/g, ''),
          name: data.playerB.name,
          team: data.playerB.team,
          position: data.playerB.position,
          projPoints: data.playerB.projPoints,
          snapPct: data.playerB.snapPct,
          targetShare: data.playerB.targetShare,
          defRankVsPos: data.playerB.defRankVsPos,
          impliedTeamTotal: data.playerB.impliedTeamTotal,
          injuryTag: data.playerB.injuryTag,
          newsHeat: data.playerB.newsHeat,
        },
      };

      const response = await fetch('/api/start-sit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to calculate start/sit');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setResult(data as StartSitResult);
    },
  });

  const handleCalculate = () => {
    if (!playerA.name || !playerB.name) {
      alert("Please enter names for both players");
      return;
    }
    calculateStartSit({ playerA, playerB });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Start/Sit Calculator</h1>
        <p className="text-xl text-muted-foreground">
          AI-powered fantasy football decision making with detailed reasoning
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Enter player data to get evidence-based start/sit recommendations with factor breakdowns
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <PlayerFormCard
          player={playerA}
          setPlayer={setPlayerA}
          title="Player A"
          playerKey="A"
        />
        <PlayerFormCard
          player={playerB}
          setPlayer={setPlayerB}
          title="Player B"
          playerKey="B"
        />
      </div>

      <div className="text-center mb-8">
        <Button 
          onClick={handleCalculate} 
          disabled={isPending || !playerA.name || !playerB.name}
          size="lg"
          data-testid="button-calculate-startsit"
          className="px-8 py-3 text-lg"
        >
          <Calculator className="h-5 w-5 mr-2" />
          {isPending ? "Calculating..." : "Calculate Start/Sit"}
        </Button>
      </div>

      {result && <ResultsCard result={result} />}

      {/* Help Section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h4 className="font-semibold mb-2">5-Factor Analysis</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Projections (45%)</li>
                <li>• Usage patterns (25%)</li>
                <li>• Matchup context (15%)</li>
                <li>• Reliability factors (10%)</li>
                <li>• News/market sentiment (5%)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Position Awareness</h4>
              <p className="text-muted-foreground">
                Different positions are weighted appropriately - RBs emphasize usage more, 
                QBs focus on matchup context, etc.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Confidence Levels</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Clear Start: 8+ point edge</li>
                <li>• Lean Start: 3-8 point edge</li>
                <li>• Toss-up: Under 3 points</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}