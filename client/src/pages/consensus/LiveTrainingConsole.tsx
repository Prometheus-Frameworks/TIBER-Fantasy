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
        <p className="text-sm text-gray-700">
          <strong>2025 QB Redraft Training:</strong> 4-tier structure with rushing upside vs passing ceiling trade-offs
        </p>

        <div className="grid grid-cols-1 gap-4">
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
                  <div className="font-medium text-yellow-700">Young Upside:</div>
                  <div className="pl-2 text-gray-600">• Anthony Richardson (injury bounce-back)</div>
                  <div className="pl-2 text-gray-600">• Caleb Williams (rookie development)</div>
                </div>
                
                <div>
                  <div className="font-medium text-yellow-700">Veteran Ceiling:</div>
                  <div className="pl-2 text-gray-600">• Dak Prescott (weapons upgrade)</div>
                  <div className="pl-2 text-gray-600">• Justin Herbert (new system)</div>
                </div>
              </div>
              
              <div className="text-xs text-gray-500 mt-2">
                Context: QBs with QB1 weeks potential but consistency/injury/system concerns
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="text-xs bg-yellow-600 hover:bg-yellow-700 text-white"
                onClick={() => greenLightTierChange(["anthony-richardson", "caleb-williams"], 3, "QB Tier 3A - Young")}
                disabled={updateConsensusMutation.isPending}
              >
                🟡 Young Upside
              </Button>
              <Button 
                size="sm" 
                className="text-xs bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => greenLightTierChange(["dak-prescott", "justin-herbert"], 3, "QB Tier 3B - Veteran")}
                disabled={updateConsensusMutation.isPending}
              >
                🟠 Veteran Ceiling
              </Button>
            </div>
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