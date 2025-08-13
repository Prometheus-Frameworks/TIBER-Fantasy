import React, { useState, useMemo } from "react";
import { useConsensus, useUpdateConsensus } from "@/hooks/useConsensus";
import { usePlayerPool } from "@/hooks/usePlayerPool";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { ConsensusFormat } from "@shared/types/consensus";

type Position = "QB" | "RB" | "WR" | "TE";

const TIER_COLORS = {
  1: "bg-emerald-100 text-emerald-800 border-emerald-200",
  2: "bg-blue-100 text-blue-800 border-blue-200", 
  3: "bg-yellow-100 text-yellow-800 border-yellow-200",
  4: "bg-orange-100 text-orange-800 border-orange-200",
  5: "bg-red-100 text-red-800 border-red-200",
} as const;

const TIER_NAMES = {
  1: "Elite",
  2: "Great", 
  3: "Good",
  4: "Solid",
  5: "Depth",
} as const;

interface TierManagerProps {
  format: ConsensusFormat;
  season?: number;
}

export default function TierManager({ format, season }: TierManagerProps) {
  const [selectedPosition, setSelectedPosition] = useState<Position>("QB");
  const { toast } = useToast();
  
  const { data: consensusData, isLoading: consensusLoading } = useConsensus(format, season);
  const { data: playerPool } = usePlayerPool();
  const updateConsensusMutation = useUpdateConsensus();

  // Create player lookup from player pool
  const playerLookup = useMemo(() => {
    if (!playerPool) return new Map();
    return new Map(playerPool.map((p: any) => [p.id, p]));
  }, [playerPool]);

  // Filter and sort consensus data by position
  const positionData = useMemo(() => {
    if (!consensusData?.rows) return [];
    
    return consensusData.rows
      .map(row => {
        const player = playerLookup.get(row.playerId);
        return {
          ...row,
          playerName: player?.name || row.playerId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          position: "WR" as Position, // For now, will get from player pool later
          team: player?.team || "",
        };
      })
      .filter(row => row.position === selectedPosition)
      .sort((a, b) => a.rank - b.rank);
  }, [consensusData, playerLookup, selectedPosition]);

  // Group players by tier
  const tierGroups = useMemo(() => {
    const groups: Record<number, typeof positionData> = {};
    positionData.forEach(player => {
      const tier = player.tier || 999;
      if (!groups[tier]) groups[tier] = [];
      groups[tier].push(player);
    });
    return groups;
  }, [positionData]);

  const handleTierChange = async (playerId: string, newTier: number) => {
    try {
      await updateConsensusMutation.mutateAsync({
        format,
        season,
        updates: [{ playerId, tier: newTier }]
      });
      
      toast({
        title: "Tier Updated",
        description: `Player moved to Tier ${newTier}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update tier",
        variant: "destructive",
      });
    }
  };

  if (consensusLoading) {
    return <div className="p-6">Loading consensus data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Tier Manager - {format.charAt(0).toUpperCase() + format.slice(1)}
          {season && ` ${season}`}
        </h1>
      </div>

      {/* Position Selector */}
      <div className="flex gap-2">
        {(["QB", "RB", "WR", "TE"] as Position[]).map(pos => (
          <Button
            key={pos}
            variant={selectedPosition === pos ? "default" : "outline"}
            onClick={() => setSelectedPosition(pos)}
            className="text-sm"
          >
            {pos}
          </Button>
        ))}
      </div>

      {/* Tier Groups */}
      <div className="space-y-4">
        {Object.entries(tierGroups)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([tierStr, players]) => {
            const tier = parseInt(tierStr);
            const tierName = TIER_NAMES[tier as keyof typeof TIER_NAMES] || `Tier ${tier}`;
            const tierColor = TIER_COLORS[tier as keyof typeof TIER_COLORS] || "bg-gray-100 text-gray-800 border-gray-200";

            return (
              <Card key={tier} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3">
                    <Badge className={`${tierColor} px-3 py-1`}>
                      Tier {tier}: {tierName}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {players.length} player{players.length !== 1 ? 's' : ''}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid gap-2">
                    {players.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-gray-500 w-8">
                            #{player.rank}
                          </span>
                          <div>
                            <div className="font-medium">{player.playerName}</div>
                            <div className="text-sm text-gray-500">
                              {player.team} • Score: {player.score?.toFixed(1) || 'N/A'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((targetTier) => (
                            <Button
                              key={targetTier}
                              variant={player.tier === targetTier ? "default" : "outline"}
                              size="sm"
                              className="w-8 h-8 p-0 text-xs"
                              onClick={() => handleTierChange(player.playerId, targetTier)}
                              disabled={updateConsensusMutation.isPending}
                            >
                              {targetTier}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Tier Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Quickly assign elite tier (Tier 1) to the best {selectedPosition} players:
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                const topPlayers = positionData.slice(0, 3);
                Promise.all(topPlayers.map(p => handleTierChange(p.playerId, 1)));
              }}
              variant="outline"
              size="sm"
            >
              Top 3 → Tier 1
            </Button>
            <Button
              onClick={() => {
                const topPlayers = positionData.slice(0, 5);
                Promise.all(topPlayers.map(p => handleTierChange(p.playerId, 1)));
              }}
              variant="outline"
              size="sm"
            >
              Top 5 → Tier 1
            </Button>
            <Button
              onClick={() => {
                const tierTwoPlayers = positionData.slice(5, 12);
                Promise.all(tierTwoPlayers.map(p => handleTierChange(p.playerId, 2)));
              }}
              variant="outline"
              size="sm"
            >
              Ranks 6-12 → Tier 2
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}