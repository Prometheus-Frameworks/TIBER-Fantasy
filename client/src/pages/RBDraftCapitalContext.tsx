import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Trophy, 
  Target, 
  AlertTriangle,
  CheckCircle,
  Crown,
  Zap,
  Clock,
  TrendingUp
} from "lucide-react";

interface RBDraftCapitalContext {
  playerId: string;
  playerName: string;
  draftRound: number;
  draftTier: 'PremiumBack' | 'StrongBack' | 'RiskBack' | 'FragileBack';
  currentStartingRole: boolean;
  twoTop24Seasons: boolean;
  noTop3RBThreat: boolean;
  contextOverride: boolean;
  contextOverrideTag?: 'LeadBack' | 'ProvenAsset';
  displayTag: string;
  productionThresholds?: {
    hasTopTierSeason: boolean;
    hasMultipleRB2Seasons: boolean;
    has1000YardSeason: boolean;
    hasWorkloadIncrease: boolean;
  };
  draftCapitalPenaltySupressed?: boolean;
}

export default function RBDraftCapitalContext() {
  const [testInput, setTestInput] = useState({
    playerId: 'test-rb-001',
    playerName: 'Kyren Williams',
    draftRound: 5,
    currentStartingRole: true,
    twoTop24Seasons: true,
    noTop3RBThreat: true,
    seasons: [
      {
        year: 2024,
        positionalRank: 8,
        rushingYards: 1144,
        receivingYards: 367,
        totalTouches: 317,
        gamesPlayed: 17
      },
      {
        year: 2023,
        positionalRank: 18,
        rushingYards: 590,
        receivingYards: 206,
        totalTouches: 180,
        gamesPlayed: 12
      }
    ]
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Test single RB evaluation
  const testMutation = useMutation({
    mutationFn: async (input: any) => {
      const response = await apiRequest('/api/rb-draft-capital/evaluate', {
        method: 'POST',
        body: input
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Evaluation Complete",
        description: `${data.playerName}: ${data.displayTag}`,
      });
    }
  });

  // Example RBs for batch testing
  const exampleRBs = [
    {
      playerId: 'kyren-williams',
      playerName: 'Kyren Williams',
      draftRound: 5,
      currentStartingRole: true,
      twoTop24Seasons: true,
      noTop3RBThreat: true
    },
    {
      playerId: 'rachaad-white',
      playerName: 'Rachaad White',
      draftRound: 3,
      currentStartingRole: true,
      twoTop24Seasons: false,
      noTop3RBThreat: false
    },
    {
      playerId: 'saquon-barkley',
      playerName: 'Saquon Barkley',
      draftRound: 1,
      currentStartingRole: true,
      twoTop24Seasons: true,
      noTop3RBThreat: true
    },
    {
      playerId: 'james-cook',
      playerName: 'James Cook',
      draftRound: 2,
      currentStartingRole: true,
      twoTop24Seasons: true,
      noTop3RBThreat: true
    },
    {
      playerId: 'rico-dowdle',
      playerName: 'Rico Dowdle',
      draftRound: 7,
      currentStartingRole: true,
      twoTop24Seasons: false,
      noTop3RBThreat: false
    }
  ];

  // Batch evaluation
  const batchMutation = useMutation({
    mutationFn: async (inputs: any[]) => {
      const response = await apiRequest('/api/rb-draft-capital/batch-evaluate', {
        method: 'POST',
        body: { inputs }
      });
      return response;
    },
    onSuccess: (data) => {
      const overrideCount = data.filter((rb: any) => rb.contextOverride).length;
      toast({
        title: "Batch Evaluation Complete",
        description: `Processed ${data.length} RBs, ${overrideCount} context overrides applied`,
      });
    }
  });

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'PremiumBack': return <Crown className="h-4 w-4 text-purple-500" />;
      case 'StrongBack': return <Trophy className="h-4 w-4 text-blue-500" />;
      case 'RiskBack': return <Target className="h-4 w-4 text-orange-500" />;
      case 'FragileBack': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'PremiumBack': return 'bg-purple-100 text-purple-800';
      case 'StrongBack': return 'bg-blue-100 text-blue-800';
      case 'RiskBack': return 'bg-orange-100 text-orange-800';
      case 'FragileBack': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            RB Draft Capital Context Override
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Enhanced production threshold system that prevents over-penalizing productive players based on draft capital alone
          </p>
        </div>

        {/* Methodology */}
        <Card className="border-0 bg-white/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Context Override Logic
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Step 1: Baseline Tagging</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <Crown className="h-3 w-3 text-purple-500" />
                    <span>Round 1 → PremiumBack</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-3 w-3 text-blue-500" />
                    <span>Round 2 → StrongBack</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-3 w-3 text-orange-500" />
                    <span>Round 3 → RiskBack</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-red-500" />
                    <span>Day 3 → FragileBack</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Step 2: Production Thresholds</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-3 w-3 text-yellow-500" />
                    <span>1x Top-12 Finish</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span>2x Top-24 Finishes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-3 w-3 text-blue-500" />
                    <span>1,000+ Yards</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-purple-500" />
                    <span>Workload Increase</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Step 3: Context Override</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>ProvenAsset Override</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-3 w-3 text-green-500" />
                    <span>LeadBack Override</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Original + New triggers
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Step 4: Value Adjustment</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>Penalty Suppressed</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Draft capital penalty removed for proven performers
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Input */}
        <Card className="border-0 bg-white/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Test RB Evaluation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="playerName">Player Name</Label>
                <Input
                  id="playerName"
                  value={testInput.playerName}
                  onChange={(e) => setTestInput({...testInput, playerName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="draftRound">Draft Round</Label>
                <Input
                  id="draftRound"
                  type="number"
                  min="1"
                  max="7"
                  value={testInput.draftRound}
                  onChange={(e) => setTestInput({...testInput, draftRound: parseInt(e.target.value)})}
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="currentStartingRole"
                  checked={testInput.currentStartingRole}
                  onCheckedChange={(checked) => setTestInput({...testInput, currentStartingRole: checked as boolean})}
                />
                <Label htmlFor="currentStartingRole">Current Starting Role</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="twoTop24Seasons"
                  checked={testInput.twoTop24Seasons}
                  onCheckedChange={(checked) => setTestInput({...testInput, twoTop24Seasons: checked as boolean})}
                />
                <Label htmlFor="twoTop24Seasons">Two Top-24 Fantasy Seasons</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="noTop3RBThreat"
                  checked={testInput.noTop3RBThreat}
                  onCheckedChange={(checked) => setTestInput({...testInput, noTop3RBThreat: checked as boolean})}
                />
                <Label htmlFor="noTop3RBThreat">No Top-3 Round RB Threat</Label>
              </div>
            </div>

            <Button 
              onClick={() => testMutation.mutate(testInput)}
              disabled={testMutation.isPending}
              className="w-full"
            >
              {testMutation.isPending ? 'Evaluating...' : 'Test Evaluation'}
            </Button>
          </CardContent>
        </Card>

        {/* Test Results */}
        {testMutation.data && (
          <Card className="border-0 bg-white/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Evaluation Result</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold">{testMutation.data.playerName}</h3>
                  <Badge className={getTierColor(testMutation.data.draftTier)}>
                    {getTierIcon(testMutation.data.draftTier)}
                    {testMutation.data.draftTier}
                  </Badge>
                  {testMutation.data.contextOverride && (
                    <Badge className="bg-green-100 text-green-800">
                      <Zap className="h-3 w-3 mr-1" />
                      {testMutation.data.contextOverrideTag}
                    </Badge>
                  )}
                  {testMutation.data.draftCapitalPenaltySupressed && (
                    <Badge className="bg-blue-100 text-blue-800">
                      <Target className="h-3 w-3 mr-1" />
                      Penalty Suppressed
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600">{testMutation.data.displayTag}</p>
                {testMutation.data.productionThresholds && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold text-sm mb-2">Production Thresholds Met:</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {testMutation.data.productionThresholds.hasTopTierSeason && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span>Top-12 Season</span>
                        </div>
                      )}
                      {testMutation.data.productionThresholds.hasMultipleRB2Seasons && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span>Multiple RB2 Seasons</span>
                        </div>
                      )}
                      {testMutation.data.productionThresholds.has1000YardSeason && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span>1,000+ Yard Season</span>
                        </div>
                      )}
                      {testMutation.data.productionThresholds.hasWorkloadIncrease && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span>Workload Increase</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Batch Test */}
        <Card className="border-0 bg-white/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Batch Test - Example RBs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {exampleRBs.map((rb) => (
                <div key={rb.playerId} className="p-3 border rounded-lg bg-gray-50">
                  <div className="space-y-1">
                    <h4 className="font-medium">{rb.playerName}</h4>
                    <p className="text-xs text-gray-600">Round {rb.draftRound}</p>
                    <div className="flex gap-1 text-xs">
                      {rb.currentStartingRole && <CheckCircle className="h-3 w-3 text-green-500" />}
                      {rb.twoTop24Seasons && <TrendingUp className="h-3 w-3 text-green-500" />}
                      {rb.noTop3RBThreat && <Zap className="h-3 w-3 text-green-500" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <Button 
              onClick={() => batchMutation.mutate(exampleRBs)}
              disabled={batchMutation.isPending}
              className="w-full"
            >
              {batchMutation.isPending ? 'Processing...' : 'Run Batch Test'}
            </Button>
          </CardContent>
        </Card>

        {/* Batch Results */}
        {batchMutation.data && (
          <Card className="border-0 bg-white/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Batch Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {batchMutation.data.map((rb: RBDraftCapitalContext) => (
                  <div key={rb.playerId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{rb.playerName}</h4>
                        <Badge className={getTierColor(rb.draftTier)}>
                          {getTierIcon(rb.draftTier)}
                          {rb.draftTier}
                        </Badge>
                        {rb.contextOverride && (
                          <Badge className="bg-green-100 text-green-800">
                            <Zap className="h-3 w-3 mr-1" />
                            Override
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{rb.displayTag}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}