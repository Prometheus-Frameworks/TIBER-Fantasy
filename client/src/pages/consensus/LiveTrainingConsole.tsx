import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUpdateConsensus } from "@/hooks/useConsensus";
import { useToast } from "@/hooks/use-toast";
import type { ConsensusFormat } from "@shared/types/consensus";

interface LiveTrainingConsoleProps {
  format: ConsensusFormat;
  season?: number;
}

export default function LiveTrainingConsole({ format, season }: LiveTrainingConsoleProps) {
  const [pending, setPending] = useState<Array<{id: string, action: string}>>([]);
  const updateConsensusMutation = useUpdateConsensus();
  const { toast } = useToast();

  // 2025 Redraft QB Elite Tier - dual-threat dominance
  const eliteQBs = ["josh-allen", "lamar-jackson"];
  const eliteRBs = ["christian-mccaffrey", "austin-ekeler", "derrick-henry"];
  const eliteWRs = ["cooper-kupp", "stefon-diggs", "tyreek-hill", "davante-adams", "justin-jefferson"];
  const eliteTEs = ["travis-kelce", "mark-andrews"];

  const greenLightTierChange = async (playerIds: string[], tier: number, positionName: string) => {
    try {
      // Use the consensus update endpoint directly
      const response = await fetch('/api/consensus/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: format,
          season: season || 2025,
          updates: playerIds.map(playerId => ({ playerId, tier }))
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      toast({
        title: "🟢 GREEN LIGHT EXECUTED",
        description: `${positionName} Tier ${tier} pushed live to consensus`,
        className: "border-green-500 bg-green-100 text-green-900",
      });
    } catch (error) {
      console.error('Green light failed:', error);
      toast({
        title: "🔴 PUSH FAILED",
        description: `Could not execute green light for ${positionName}`,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="bg-gray-50 border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
          Live Training Console
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 text-sm">
          <div>
            <strong className="text-green-800">QB Training Complete:</strong> 4-tier structure ready for deployment
          </div>
          <div>
            <strong className="text-blue-800">Next: RB Training</strong> - Volatility management and handcuff strategy
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {/* RB 2025 Redraft Training */}
          <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-sm text-blue-800">🏃‍♂️ 2025 RB Redraft Elite Tier</h4>
            <div className="space-y-2">
              <div className="text-xs text-gray-700 space-y-1">
                <div className="font-medium">Tier 1 Elite (Bell-cow ceiling):</div>
                <div className="pl-2">• Christian McCaffrey (when healthy - workload king)</div>
                <div className="pl-2">• Saquon Barkley (Eagles system + volume)</div>
                <div className="pl-2">• Jahmyr Gibbs (explosive ceiling + Lions offense)</div>
              </div>
              <div className="text-xs text-gray-500">
                Context: RBs with 300+ touch potential and game-breaking weekly ceiling
              </div>
            </div>
            <Button 
              size="sm" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
              onClick={() => greenLightTierChange(["christian-mccaffrey", "saquon-barkley", "jahmyr-gibbs"], 1, "2025 RB Elite")}
              disabled={updateConsensusMutation.isPending}
            >
              🟢 GREEN LIGHT: Push RB Elite Tier Live
            </Button>
          </div>

          {/* RB Tier 2 Analysis */}
          <div className="space-y-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h4 className="font-semibold text-sm text-orange-800">🟡 RB Tier 2 - Proven Volume vs Explosive Upside</h4>
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="font-medium text-orange-700">Proven Workhorses:</div>
                  <div className="pl-2 text-gray-600">• Derrick Henry (age vs volume)</div>
                  <div className="pl-2 text-gray-600">• Josh Jacobs (proven 300+ touches)</div>
                  <div className="pl-2 text-gray-600">• Kenneth Walker III (volume questions)</div>
                </div>
                
                <div>
                  <div className="font-medium text-orange-700">Explosive Ceiling:</div>
                  <div className="pl-2 text-gray-600">• De'Von Achane (game-breaking speed)</div>
                  <div className="pl-2 text-gray-600">• Kyren Williams (Rams system fit)</div>
                  <div className="pl-2 text-gray-600">• Breece Hall (injury bounce-back)</div>
                </div>
              </div>
              
              <div className="mt-2 p-2 bg-orange-100 rounded border-l-4 border-orange-400">
                <div className="font-medium text-orange-800 text-xs">Handcuff Strategy Integration:</div>
                <div className="text-xs text-gray-600 pl-2">• Target Mason (LV), Davis (SEA), Charbonnet (SEA)</div>
                <div className="text-xs text-gray-600 pl-2">• Volume upside if starters miss time</div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="text-xs bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => greenLightTierChange(["derrick-henry", "josh-jacobs", "kenneth-walker"], 2, "RB Tier 2A - Workhorses")}
                disabled={updateConsensusMutation.isPending}
              >
                💪 Proven Volume
              </Button>
              <Button 
                size="sm" 
                className="text-xs bg-yellow-600 hover:bg-yellow-700 text-white"
                onClick={() => greenLightTierChange(["devon-achane", "kyren-williams", "breece-hall"], 2, "RB Tier 2B - Explosive")}
                disabled={updateConsensusMutation.isPending}
              >
                ⚡ Explosive Ceiling
              </Button>
            </div>
          </div>

          {/* QB 2025 Redraft Training */}
          <div className="space-y-3 p-4 bg-white rounded-lg border border-green-200">
            <h4 className="font-semibold text-sm text-green-800">🏈 2025 QB Redraft Elite Tier</h4>
            <div className="space-y-2">
              <div className="text-xs text-gray-700 space-y-1">
                <div className="font-medium">Tier 1 Elite (Single-season ceiling):</div>
                {eliteQBs.map(qb => (
                  <div key={qb} className="pl-2">• {qb.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                ))}
              </div>
              <div className="text-xs text-gray-500">
                Context: Nuclear ceiling weeks - Allen's 50-point games, Lamar's championship correlation
              </div>
            </div>
            <Button 
              size="sm" 
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium"
              onClick={() => greenLightTierChange(eliteQBs, 1, "2025 QB Elite")}
              disabled={updateConsensusMutation.isPending}
            >
              🟢 GREEN LIGHT: Push QB Elite Tier Live
            </Button>
          </div>

          {/* Tier 2 Options */}
          <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-sm text-blue-800">🔵 QB Tier 2 Debate</h4>
            <div className="space-y-2 text-xs">
              <div className="font-medium text-gray-700">Option A: Rushing + Ceiling QBs</div>
              <div className="pl-2 text-gray-600">• Jalen Hurts (tush push, elite weapons)</div>
              <div className="pl-2 text-gray-600">• Jayden Daniels (QB5 rookie finish)</div>
              
              <div className="font-medium text-gray-700 mt-2">Option B: Pure Passing Elite</div>
              <div className="pl-2 text-gray-600">• Joe Burrow (Chase/Higgins ceiling)</div>
              <div className="pl-2 text-gray-600">• Patrick Mahomes (historic arm talent)</div>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => greenLightTierChange(["jalen-hurts", "jayden-daniels"], 2, "QB Tier 2A")}
                disabled={updateConsensusMutation.isPending}
              >
                🟣 Rushing + Ceiling
              </Button>
              <Button 
                size="sm" 
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => greenLightTierChange(["joe-burrow", "patrick-mahomes"], 2, "QB Tier 2B")}
                disabled={updateConsensusMutation.isPending}
              >
                🔵 Passing Elite
              </Button>
            </div>
          </div>

          {/* Tier 3 Development */}
          <div className="space-y-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h4 className="font-semibold text-sm text-yellow-800">🟡 QB Tier 3 - High Upside, High Risk</h4>
            <div className="space-y-2 text-xs">
              <div className="font-medium text-gray-700">Candidate QBs for Tier 3:</div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="font-medium text-yellow-700">Elite Value Plays:</div>
                  <div className="pl-2 text-gray-600">• Drake Maye (Josh Allen lite @ ADP 133.9)</div>
                  <div className="pl-2 text-gray-600">• Baker Mayfield (2024 QB4, dual-threat)</div>
                </div>
                
                <div>
                  <div className="font-medium text-yellow-700">High Ceiling Gambles:</div>
                  <div className="pl-2 text-gray-600">• Anthony Richardson (Fields v2 rushing)</div>
                  <div className="pl-2 text-gray-600">• Justin Herbert (breakout potential)</div>
                </div>
              </div>
              
              <div className="mt-2 p-2 bg-green-100 rounded border-l-4 border-green-400">
                <div className="font-medium text-green-800 text-xs">Tier 3 Final: 5 QBs</div>
                <div className="text-xs text-gray-600 pl-2">• Elite Value: Maye (133.9), Mayfield (QB4)</div>
                <div className="text-xs text-gray-600 pl-2">• Proven: Purdy (QB14), Kyler (QB10 + weapons)</div>
                <div className="text-xs text-gray-600 pl-2">• Believe: Richardson (elite rushing ceiling)</div>
              </div>
              
              <div className="text-xs text-gray-500 mt-2">
                Context: QBs with QB1 weeks potential but consistency/injury/system concerns
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button 
                size="sm" 
                className="text-xs bg-green-600 hover:bg-green-700 text-white"
                onClick={() => greenLightTierChange(["drake-maye", "baker-mayfield"], 3, "QB Tier 3A - Elite Value")}
                disabled={updateConsensusMutation.isPending}
              >
                💎 Elite Value
              </Button>
              <Button 
                size="sm" 
                className="text-xs bg-yellow-600 hover:bg-yellow-700 text-white"
                onClick={() => greenLightTierChange(["anthony-richardson", "justin-herbert"], 3, "QB Tier 3B - High Ceiling")}
                disabled={updateConsensusMutation.isPending}
              >
                🎯 High Ceiling
              </Button>
              <Button 
                size="sm" 
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => greenLightTierChange(["brock-purdy", "anthony-richardson", "baker-mayfield", "kyler-murray"], 3, "QB Tier 3 Final")}
                disabled={updateConsensusMutation.isPending}
              >
                ✅ Finalize Tier 3 + Kyler
              </Button>
            </div>
          </div>

          {/* Tier 4 - Waiver Wire Monitoring */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-300">
            <h4 className="font-semibold text-sm text-gray-700">📊 QB Tier 4 - Waiver Wire Monitoring</h4>
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="font-medium text-gray-600">Injury Concerns:</div>
                  <div className="pl-2 text-gray-500">• Dak Prescott (hamstring IR, ADP 121.5)</div>
                  <div className="pl-2 text-gray-500">• Tua (ADP 178, concussion risk)</div>
                </div>
                
                <div>
                  <div className="font-medium text-gray-600">Age/System Issues:</div>
                  <div className="pl-2 text-gray-500">• Aaron Rodgers (age, system fit)</div>
                  <div className="pl-2 text-gray-500">• Russell Wilson (mobility decline)</div>
                </div>
              </div>
              
              <div className="text-xs text-gray-400 mt-2">
                Context: Waiver wire pickups with specific upside scenarios but major concerns
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="font-medium text-gray-700 text-xs">Tier 4 Leaders:</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="pl-2 text-gray-500">• Kyler Murray → Tier 3 (QB10 + weapons)</div>
                <div className="pl-2 text-gray-600">• Bo Nix (QB7 rookie, ADP 82.4)</div>
                <div className="pl-2 text-gray-600">• Justin Fields (QB32, ADP 128.6)</div>
                <div className="pl-2 text-gray-600">• JJ McCarthy (cheaper Maye, ADP 141.6)</div>
                <div className="pl-2 text-gray-600">• Bryce Young (Y3 breakout potential)</div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="text-xs bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => greenLightTierChange(["bo-nix"], 4, "QB Tier 4A - Bo Leads")}
                disabled={updateConsensusMutation.isPending}
              >
                🎯 Bo Leads Tier 4
              </Button>
              <Button 
                size="sm" 
                className="text-xs bg-gray-500 hover:bg-gray-600 text-white"
                onClick={() => greenLightTierChange(["justin-fields", "jj-mccarthy", "bryce-young"], 4, "QB Tier 4B - Development")}
                disabled={updateConsensusMutation.isPending}
              >
                📈 Development
              </Button>
            </div>
          </div>

          {/* Tier 5 - Streaming/Starting Options */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-300">
            <h4 className="font-semibold text-sm text-slate-700">📋 QB Tier 5 - Current NFL Starters & Streaming Options</h4>
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="font-medium text-slate-600">Current Starters:</div>
                  <div className="pl-2 text-gray-500">• Trevor Lawrence (JAX)</div>
                  <div className="pl-2 text-gray-500">• Russell Wilson (PIT)</div>
                  <div className="pl-2 text-gray-500">• Sam Darnold (SEA)</div>
                  <div className="pl-2 text-gray-500">• Jared Goff (DET)</div>
                  <div className="pl-2 text-gray-500">• Jordan Love (GB)</div>
                </div>
                
                <div>
                  <div className="font-medium text-slate-600">Rookies/Young:</div>
                  <div className="pl-2 text-gray-500">• Cam Ward (TEN - #1 pick)</div>
                  <div className="pl-2 text-gray-500">• Michael Penix Jr (ATL)</div>
                  <div className="pl-2 text-gray-500">• Tyler Shough (NO)</div>
                  <div className="pl-2 text-gray-500">• Mac Jones (NE)</div>
                </div>
                
                <div>
                  <div className="font-medium text-slate-600">Competition/Backup:</div>
                  <div className="pl-2 text-gray-500">• Aidan O'Connell (LV)</div>
                  <div className="pl-2 text-gray-500">• Joe Flacco (CLE)</div>
                  <div className="pl-2 text-gray-500">• Spencer Rattler (NO)</div>
                  <div className="pl-2 text-gray-500">• Shedeur Sanders (CLE)</div>
                  <div className="pl-2 text-gray-500">• Matthew Stafford (LAR)</div>
                </div>
              </div>
              
              <div className="text-xs text-gray-400 mt-2">
                Context: Current NFL starters, rookies taking over, and competition winners (32 total QBs)
              </div>
            </div>
            
            <Button 
              size="sm" 
              className="text-xs bg-slate-500 hover:bg-slate-600 text-white w-full"
              onClick={() => greenLightTierChange(["trevor-lawrence", "russell-wilson", "cam-ward"], 5, "QB Tier 5 - Current Starters")}
              disabled={updateConsensusMutation.isPending}
            >
              📋 Accurate 32 QB Structure
            </Button>
          </div>
        </div>

        {updateConsensusMutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            Pushing tier changes to live frontend...
          </div>
        )}
      </CardContent>
    </Card>
  );
}