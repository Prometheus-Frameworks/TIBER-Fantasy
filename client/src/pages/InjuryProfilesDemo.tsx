import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, TrendingDown, Calendar, AlertTriangle } from "lucide-react";

// Local implementation for demo - mirrors server/consensus/injuryProfiles.ts
const INJURY_PROFILES = {
  "acl tear": {
    injury_type: "ACL tear",
    severity_class: "major" as const,
    avg_recovery_weeks: 32,
    base_impact_multipliers: {
      year_of_injury: { QB: 0.75, RB: 0.65, WR: 0.70, TE: 0.72 },
      year_after_return: { QB: 0.92, RB: 0.85, WR: 0.90, TE: 0.88 }
    },
    age_penalty_factors: {
      threshold_ages: { QB: 32, RB: 26, WR: 28, TE: 29 },
      annual_decay_over_threshold: { QB: 0.96, RB: 0.92, WR: 0.94, TE: 0.95 }
    },
    recurrence_risk_12m: 0.12
  },
  "achilles rupture": {
    injury_type: "Achilles rupture",
    severity_class: "catastrophic" as const,
    avg_recovery_weeks: 40,
    base_impact_multipliers: {
      year_of_injury: { QB: 0.60, RB: 0.45, WR: 0.55, TE: 0.58 },
      year_after_return: { QB: 0.88, RB: 0.75, WR: 0.82, TE: 0.80 }
    },
    age_penalty_factors: {
      threshold_ages: { QB: 30, RB: 25, WR: 27, TE: 28 },
      annual_decay_over_threshold: { QB: 0.94, RB: 0.88, WR: 0.91, TE: 0.92 }
    },
    recurrence_risk_12m: 0.08
  },
  "hamstring grade ii/iii": {
    injury_type: "Hamstring Grade II/III",
    severity_class: "moderate" as const,
    avg_recovery_weeks: 8,
    base_impact_multipliers: {
      year_of_injury: { QB: 0.92, RB: 0.85, WR: 0.88, TE: 0.90 },
      year_after_return: { QB: 0.98, RB: 0.94, WR: 0.96, TE: 0.97 }
    },
    age_penalty_factors: {
      threshold_ages: { QB: 34, RB: 28, WR: 30, TE: 31 },
      annual_decay_over_threshold: { QB: 0.98, RB: 0.95, WR: 0.97, TE: 0.97 }
    },
    recurrence_risk_12m: 0.25
  },
  "concussion": {
    injury_type: "Concussion",
    severity_class: "minor" as const,
    avg_recovery_weeks: 3,
    base_impact_multipliers: {
      year_of_injury: { QB: 0.94, RB: 0.96, WR: 0.95, TE: 0.96 },
      year_after_return: { QB: 0.97, RB: 0.99, WR: 0.98, TE: 0.98 }
    },
    age_penalty_factors: {
      threshold_ages: { QB: 30, RB: 26, WR: 28, TE: 29 },
      annual_decay_over_threshold: { QB: 0.96, RB: 0.98, WR: 0.97, TE: 0.97 }
    },
    recurrence_risk_12m: 0.15
  }
};

type Pos = "QB"|"RB"|"WR"|"TE";

function computeDynastyMultiplier(opts: {
  injuryType: string; pos: Pos; age: number;
  phase: "year_of_injury" | "year_after_return";
  weeksRecovered?: number;
}) {
  const { injuryType, pos, age, phase, weeksRecovered } = opts;
  const prof = INJURY_PROFILES[injuryType.toLowerCase() as keyof typeof INJURY_PROFILES];
  if (!prof) return 1.0;

  const baseTable = prof.base_impact_multipliers[phase];
  let base = baseTable[pos] ?? 1.0;

  if (phase === "year_of_injury" && typeof weeksRecovered === "number" && prof.avg_recovery_weeks > 0) {
    const t = Math.max(0, Math.min(1, weeksRecovered / prof.avg_recovery_weeks));
    const y1 = prof.base_impact_multipliers.year_after_return[pos] ?? base;
    base = base * (1 - t) + y1 * t;
  }

  const threshold = prof.age_penalty_factors.threshold_ages[pos];
  const decay = prof.age_penalty_factors.annual_decay_over_threshold[pos];
  const yearsOver = Math.max(0, Math.floor(age - threshold));
  const ageK = Math.pow(decay, yearsOver);

  const recAdj = 1.0 - (prof.recurrence_risk_12m * 0.1);
  const k = Math.max(0.5, Math.min(1.05, Number((base * ageK * recAdj).toFixed(4))));
  return k;
}

function adjustRankWithMultiplier(rank: number, k: number) {
  const a = 1000, b = 1.2;
  const score = a / Math.pow(Math.max(1, rank), b);
  const adjScore = score * k;
  return Math.round(Math.pow(a / Math.max(1e-6, adjScore), 1 / b));
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "minor": return "bg-yellow-100 text-yellow-800";
    case "moderate": return "bg-orange-100 text-orange-800";
    case "major": return "bg-red-100 text-red-800";
    case "catastrophic": return "bg-purple-100 text-purple-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

export default function InjuryProfilesDemo() {
  const [selectedInjury, setSelectedInjury] = useState("acl tear");
  const [position, setPosition] = useState<Pos>("RB");
  const [age, setAge] = useState(26);
  const [phase, setPhase] = useState<"year_of_injury" | "year_after_return">("year_of_injury");
  const [weeksRecovered, setWeeksRecovered] = useState(0);
  const [testRank, setTestRank] = useState(15);

  const profile = INJURY_PROFILES[selectedInjury as keyof typeof INJURY_PROFILES];
  const multiplier = computeDynastyMultiplier({
    injuryType: selectedInjury,
    pos: position,
    age,
    phase,
    weeksRecovered: phase === "year_of_injury" ? weeksRecovered : undefined
  });
  const adjustedRank = adjustRankWithMultiplier(testRank, multiplier);
  const rankDrop = adjustedRank - testRank;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Dynasty Injury Profiles v2</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Grok's injury data integration with Claude Lamar's collaboration. 
          Position-specific impacts, age penalties, and recovery phases.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Test Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Injury Type</Label>
              <Select value={selectedInjury} onValueChange={setSelectedInjury}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(INJURY_PROFILES).map(key => (
                    <SelectItem key={key} value={key}>
                      {INJURY_PROFILES[key as keyof typeof INJURY_PROFILES].injury_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Position</Label>
                <Select value={position} onValueChange={(v) => setPosition(v as Pos)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="QB">QB</SelectItem>
                    <SelectItem value="RB">RB</SelectItem>
                    <SelectItem value="WR">WR</SelectItem>
                    <SelectItem value="TE">TE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Age</Label>
                <Input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(parseInt(e.target.value) || 0)}
                  min="20"
                  max="40"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Recovery Phase</Label>
              <Select value={phase} onValueChange={(v) => setPhase(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="year_of_injury">Year of Injury</SelectItem>
                  <SelectItem value="year_after_return">Year After Return</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {phase === "year_of_injury" && (
              <div className="space-y-2">
                <Label>Weeks Recovered</Label>
                <Input
                  type="number"
                  value={weeksRecovered}
                  onChange={(e) => setWeeksRecovered(parseInt(e.target.value) || 0)}
                  min="0"
                  max={profile?.avg_recovery_weeks || 50}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Test Rank</Label>
              <Input
                type="number"
                value={testRank}
                onChange={(e) => setTestRank(parseInt(e.target.value) || 1)}
                min="1"
                max="300"
              />
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Dynasty Impact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-2">
              <div className="text-3xl font-bold">{multiplier.toFixed(3)}</div>
              <div className="text-sm text-muted-foreground">Dynasty Multiplier</div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-xl font-semibold">{testRank}</div>
                <div className="text-xs text-muted-foreground">Original Rank</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-blue-600">{adjustedRank}</div>
                <div className="text-xs text-muted-foreground">Adjusted Rank</div>
              </div>
            </div>

            {rankDrop !== 0 && (
              <div className="text-center">
                <Badge variant={rankDrop > 0 ? "destructive" : "default"}>
                  {rankDrop > 0 ? `Drops ${rankDrop}` : `Rises ${Math.abs(rankDrop)}`} spots
                </Badge>
              </div>
            )}

            {profile && (
              <div className="space-y-2">
                <Badge className={getSeverityColor(profile.severity_class)}>
                  {profile.severity_class}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  Recovery: {profile.avg_recovery_weeks} weeks avg
                </div>
                <div className="text-sm text-muted-foreground">
                  Recurrence risk: {(profile.recurrence_risk_12m * 100).toFixed(0)}%
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Profile Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile && (
              <Tabs defaultValue="impact">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="impact">Impact</TabsTrigger>
                  <TabsTrigger value="age">Age Factors</TabsTrigger>
                </TabsList>
                <TabsContent value="impact" className="space-y-3">
                  <div>
                    <h4 className="font-medium text-sm">Year of Injury</h4>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {Object.entries(profile.base_impact_multipliers.year_of_injury).map(([pos, mult]) => (
                        <div key={pos} className="flex justify-between">
                          <span>{pos}:</span>
                          <span className="font-mono">{mult}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">Year After Return</h4>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {Object.entries(profile.base_impact_multipliers.year_after_return).map(([pos, mult]) => (
                        <div key={pos} className="flex justify-between">
                          <span>{pos}:</span>
                          <span className="font-mono">{mult}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="age" className="space-y-3">
                  <div>
                    <h4 className="font-medium text-sm">Age Thresholds</h4>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {Object.entries(profile.age_penalty_factors.threshold_ages).map(([pos, age]) => (
                        <div key={pos} className="flex justify-between">
                          <span>{pos}:</span>
                          <span className="font-mono">{age}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">Annual Decay</h4>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {Object.entries(profile.age_penalty_factors.annual_decay_over_threshold).map(([pos, decay]) => (
                        <div key={pos} className="flex justify-between">
                          <span>{pos}:</span>
                          <span className="font-mono">{decay}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Test Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Quick Test Scenarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: "Prime RB ACL", injury: "acl tear", pos: "RB", age: 25, phase: "year_of_injury" },
              { name: "Aging RB Achilles", injury: "achilles rupture", pos: "RB", age: 29, phase: "year_of_injury" },
              { name: "WR Hamstring", injury: "hamstring grade ii/iii", pos: "WR", age: 26, phase: "year_of_injury" },
              { name: "QB Concussion", injury: "concussion", pos: "QB", age: 30, phase: "year_of_injury" }
            ].map((scenario, index) => {
              const k = computeDynastyMultiplier({
                injuryType: scenario.injury,
                pos: scenario.pos as Pos,
                age: scenario.age,
                phase: scenario.phase as any
              });
              const adj = adjustRankWithMultiplier(20, k);
              
              return (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start"
                  onClick={() => {
                    setSelectedInjury(scenario.injury);
                    setPosition(scenario.pos as Pos);
                    setAge(scenario.age);
                    setPhase(scenario.phase as any);
                    setTestRank(20);
                  }}
                >
                  <div className="font-medium">{scenario.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {scenario.pos} {scenario.age}yo
                  </div>
                  <div className="text-xs">k={k.toFixed(3)} → Rank {adj}</div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}