import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, TrendingUp, Activity, Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ConsensusExplanation {
  playerId: string;
  format: "dynasty" | "redraft";
  season?: number;
  decayDays: number;
  surgeActive: boolean;
  injury: any;
  gates: {
    recoveryGamesMet: boolean;
    snapShareMet: boolean;
  };
  notes: string[];
  baseRank: number;
  adjustedRank: number;
  adjustmentFactors: {
    surge?: number;
    injuryPenalty?: number;
    ageRisk?: number;
    injuryTypeRisk?: number;
  };
}

interface RebuildResult {
  success: boolean;
  adjustments: number;
}

export default function AdaptiveConsensusDemo() {
  const [selectedPlayer, setSelectedPlayer] = useState("puka-nacua");
  const [selectedFormat, setSelectedFormat] = useState<"dynasty" | "redraft">("dynasty");
  const [selectedSeason, setSelectedSeason] = useState("2025");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for consensus explanation
  const { data: explanation, isLoading: explanationLoading, error } = useQuery<ConsensusExplanation>({
    queryKey: [`/api/consensus/why`, selectedPlayer, selectedFormat, selectedSeason],
    queryFn: async () => {
      const params = new URLSearchParams({
        playerId: selectedPlayer,
        format: selectedFormat,
        ...(selectedSeason && { season: selectedSeason })
      });
      
      const response = await fetch(`/api/consensus/why?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch explanation: ${response.status}`);
      }
      return response.json();
    },
    retry: 1
  });

  // Mutation for rebuilding consensus
  const rebuildMutation = useMutation<RebuildResult, Error, { format: string; season?: number }>({
    mutationFn: async ({ format, season }) => {
      const response = await fetch('/api/consensus/adaptive-rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, season })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to rebuild consensus: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Consensus Rebuilt",
        description: `Successfully made ${data.adjustments} adjustments to ${selectedFormat} consensus`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/consensus/why`] });
    },
    onError: (error) => {
      toast({
        title: "Rebuild Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleRebuild = () => {
    rebuildMutation.mutate({
      format: selectedFormat,
      season: selectedSeason ? parseInt(selectedSeason) : undefined
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Adaptive Surge Detection + Injury-Aware Consensus</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Equal-weight consensus with intelligent context adjustments for breakouts and injuries. 
          Different logic for redraft vs dynasty formats.
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Test Adaptive Consensus System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="player">Player ID</Label>
              <Input
                id="player"
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                placeholder="e.g., puka-nacua"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="format">Format</Label>
              <Select value={selectedFormat} onValueChange={(value: "dynasty" | "redraft") => setSelectedFormat(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dynasty">Dynasty</SelectItem>
                  <SelectItem value="redraft">Redraft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="season">Season</Label>
              <Input
                id="season"
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                placeholder="e.g., 2025"
              />
            </div>
            
            <div className="flex items-end">
              <Button 
                onClick={handleRebuild}
                disabled={rebuildMutation.isPending}
                className="w-full"
              >
                {rebuildMutation.isPending ? "Rebuilding..." : "Rebuild Consensus"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {explanationLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">Loading explanation...</div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              <span>No explanation found for this player/format combination</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Try rebuilding the consensus first, or check if the player exists in the consensus board.
            </p>
          </CardContent>
        </Card>
      )}

      {explanation && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main Explanation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Consensus Explanation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Base Rank</div>
                  <div className="text-2xl font-bold">{explanation.baseRank}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Adjusted Rank</div>
                  <div className="text-2xl font-bold text-blue-600">{explanation.adjustedRank}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Decay Window:</span>
                  <Badge variant={explanation.surgeActive ? "default" : "secondary"}>
                    {explanation.decayDays} days
                  </Badge>
                  {explanation.surgeActive && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Surge Active
                    </Badge>
                  )}
                </div>

                {explanation.injury && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Injury Status:</span>
                    <Badge variant="outline">{explanation.injury.status}</Badge>
                    {explanation.injury.injuryType && (
                      <Badge variant="outline">{explanation.injury.injuryType}</Badge>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Adjustment Notes:</div>
                <div className="space-y-1">
                  {explanation.notes.map((note, index) => (
                    <div key={index} className="text-sm bg-muted p-2 rounded">
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technical Details */}
          <Card>
            <CardHeader>
              <CardTitle>Technical Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium">Format</div>
                  <div className="text-muted-foreground">{explanation.format}</div>
                </div>
                <div>
                  <div className="font-medium">Season</div>
                  <div className="text-muted-foreground">{explanation.season || "N/A"}</div>
                </div>
              </div>

              {explanation.gates && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Recovery Gates:</div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Recovery Games Met</span>
                      <Badge variant={explanation.gates.recoveryGamesMet ? "default" : "secondary"}>
                        {explanation.gates.recoveryGamesMet ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Snap Share Met</span>
                      <Badge variant={explanation.gates.snapShareMet ? "default" : "secondary"}>
                        {explanation.gates.snapShareMet ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {Object.keys(explanation.adjustmentFactors).length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Adjustment Factors:</div>
                  <div className="space-y-1">
                    {Object.entries(explanation.adjustmentFactors).map(([factor, value]) => (
                      <div key={factor} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{factor.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">{value}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Feature Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>System Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Surge Detection</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Detects &gt;25% rank improvement in 7 days</li>
                <li>• Requires ≥20% recent submission volume</li>
                <li>• Shortens decay window to 21 days</li>
                <li>• Prevents troll submissions affecting real breakouts</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Injury Adjustments</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Redraft: Harsh penalties for absences</li>
                <li>• Dynasty: Soft penalties with age/position risk</li>
                <li>• Recovery gates for return-to-play</li>
                <li>• Out-for-season = Unranked in redraft</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}