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

  const eliteQBs = ["josh-allen", "lamar-jackson", "patrick-mahomes"];
  const eliteRBs = ["christian-mccaffrey", "austin-ekeler", "derrick-henry"];
  const eliteWRs = ["cooper-kupp", "stefon-diggs", "tyreek-hill", "davante-adams", "justin-jefferson"];
  const eliteTEs = ["travis-kelce", "mark-andrews"];

  const greenLightTierChange = async (playerIds: string[], tier: number, positionName: string) => {
    try {
      const updates = playerIds.map(playerId => ({ playerId, tier }));
      await updateConsensusMutation.mutateAsync({ format, season, updates });
      
      toast({
        title: "🟢 GREEN LIGHT EXECUTED",
        description: `${positionName} Tier ${tier} pushed live to consensus`,
        className: "border-green-500 bg-green-100 text-green-900",
      });
    } catch (error) {
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
          <strong>Quick Deploy:</strong> One-click green light for consensus tier assignments
        </p>

        <div className="grid grid-cols-2 gap-4">
          {/* QB Elite Tier */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">QB Elite Tier</h4>
            <div className="space-y-1 text-xs text-gray-600">
              {eliteQBs.map(qb => (
                <div key={qb}>{qb.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
              ))}
            </div>
            <Button 
              size="sm" 
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => greenLightTierChange(eliteQBs, 1, "QB")}
              disabled={updateConsensusMutation.isPending}
            >
              🟢 Green Light QB Elite
            </Button>
          </div>

          {/* RB Elite Tier */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">RB Elite Tier</h4>
            <div className="space-y-1 text-xs text-gray-600">
              {eliteRBs.map(rb => (
                <div key={rb}>{rb.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
              ))}
            </div>
            <Button 
              size="sm" 
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => greenLightTierChange(eliteRBs, 1, "RB")}
              disabled={updateConsensusMutation.isPending}
            >
              🟢 Green Light RB Elite
            </Button>
          </div>

          {/* WR Elite Tier */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">WR Elite Tier</h4>
            <div className="space-y-1 text-xs text-gray-600">
              {eliteWRs.slice(0, 3).map(wr => (
                <div key={wr}>{wr.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
              ))}
              <div className="text-gray-400">+2 more...</div>
            </div>
            <Button 
              size="sm" 
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => greenLightTierChange(eliteWRs, 1, "WR")}
              disabled={updateConsensusMutation.isPending}
            >
              🟢 Green Light WR Elite
            </Button>
          </div>

          {/* TE Elite Tier */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">TE Elite Tier</h4>
            <div className="space-y-1 text-xs text-gray-600">
              {eliteTEs.map(te => (
                <div key={te}>{te.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
              ))}
            </div>
            <Button 
              size="sm" 
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => greenLightTierChange(eliteTEs, 1, "TE")}
              disabled={updateConsensusMutation.isPending}
            >
              🟢 Green Light TE Elite
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