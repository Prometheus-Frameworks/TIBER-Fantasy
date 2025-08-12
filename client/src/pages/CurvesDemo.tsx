import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingDown, TrendingUp } from "lucide-react";

// Local implementation of curves for demo
const RANK_SCORE_CURVE = { a: 1000, b: 1.2 } as const;

function rankToScore(rank: number, a = RANK_SCORE_CURVE.a, b = RANK_SCORE_CURVE.b) {
  const r = Math.max(1, rank);
  return a / Math.pow(r, b);
}

function scoreToRank(score: number, a = RANK_SCORE_CURVE.a, b = RANK_SCORE_CURVE.b) {
  const s = Math.max(1e-6, score);
  return Math.round(Math.pow(a / s, 1 / b));
}

function adjustRankWithMultiplier(rank: number, k: number) {
  const base = rankToScore(rank);
  const adj = base * k;
  return scoreToRank(adj);
}

export default function CurvesDemo() {
  const [testRank, setTestRank] = useState(20);
  const [injuryMultiplier, setInjuryMultiplier] = useState([0.90]);

  const k = injuryMultiplier[0];
  const adjustedRank = adjustRankWithMultiplier(testRank, k);
  const rankDrop = adjustedRank - testRank;

  // Predefined injury scenarios
  const injuryScenarios = [
    { name: "Minor Hamstring", k: 0.96, color: "bg-yellow-100 text-yellow-800" },
    { name: "ACL (Prime Player)", k: 0.92, color: "bg-orange-100 text-orange-800" },
    { name: "Achilles (Older RB)", k: 0.70, color: "bg-red-100 text-red-800" },
    { name: "Concussion", k: 0.94, color: "bg-purple-100 text-purple-800" }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Dynasty Injury Curves System</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Smooth rank-score transformations for realistic dynasty injury adjustments. 
          Ready for Grok's data integration.
        </p>
      </div>

      {/* Interactive Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Interactive Curve Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rank">Player Rank</Label>
                <Input
                  id="rank"
                  type="number"
                  value={testRank}
                  onChange={(e) => setTestRank(parseInt(e.target.value) || 1)}
                  min="1"
                  max="300"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Injury Multiplier (k): {k.toFixed(2)}</Label>
                <Slider
                  value={injuryMultiplier}
                  onValueChange={setInjuryMultiplier}
                  min={0.5}
                  max={1.2}
                  step={0.01}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground">
                  k &lt; 1.0 = penalty (rank drops) • k &gt; 1.0 = boost (rare)
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{testRank}</div>
                  <div className="text-sm text-muted-foreground">Original Rank</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{adjustedRank}</div>
                  <div className="text-sm text-muted-foreground">Adjusted Rank</div>
                </div>
              </div>
              
              <div className="text-center">
                {rankDrop > 0 ? (
                  <Badge variant="destructive" className="flex items-center gap-1 w-fit mx-auto">
                    <TrendingDown className="h-3 w-3" />
                    Drops {rankDrop} spots
                  </Badge>
                ) : rankDrop < 0 ? (
                  <Badge variant="default" className="flex items-center gap-1 w-fit mx-auto">
                    <TrendingUp className="h-3 w-3" />
                    Rises {Math.abs(rankDrop)} spots
                  </Badge>
                ) : (
                  <Badge variant="secondary">No change</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Injury Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle>Dynasty Injury Scenarios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {injuryScenarios.map((scenario, index) => {
              const demoRank = 15;
              const demoAdjusted = adjustRankWithMultiplier(demoRank, scenario.k);
              const demoDrop = demoAdjusted - demoRank;
              
              return (
                <div key={index} className="p-4 border rounded-lg space-y-2">
                  <Badge className={scenario.color}>{scenario.name}</Badge>
                  <div className="text-sm">
                    <div>k = {scenario.k}</div>
                    <div>Rank {demoRank} → {demoAdjusted}</div>
                    <div className="text-muted-foreground">({demoDrop > 0 ? '+' : ''}{demoDrop} spots)</div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setInjuryMultiplier([scenario.k])}
                  >
                    Test This
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle>Technical Implementation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium">Curve Mathematics</h4>
              <div className="text-sm space-y-1">
                <div><code>score = a / rank^b</code> where a=1000, b=1.2</div>
                <div><code>rank = (a / score)^(1/b)</code></div>
                <div><code>adjustedRank = scoreToRank(rankToScore(rank) * k)</code></div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium">Grok Integration Ready</h4>
              <div className="text-sm space-y-1 text-muted-foreground">
                <div>• Maps year1_prod_delta → k multiplier</div>
                <div>• Age penalty integration points</div>
                <div>• Position-specific risk factors</div>
                <div>• Smooth consensus adjustments</div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-muted rounded text-sm">
            <strong>When Grok delivers:</strong> Tiber maps JSON fields to k values and calls 
            <code className="mx-1 px-1 bg-background rounded">adjustRankWithMultiplier(rank, k)</code> 
            for precise, smooth dynasty injury adjustments.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}