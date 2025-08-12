import { useState } from "react";
import { useConsensus, useConsensusMeta } from "@/hooks/useConsensus";
import type { ConsensusFormat } from "@shared/types/consensus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkeletonTableRow } from "@/components/Skeleton";

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE"] as const;
type Position = typeof POSITIONS[number];

const TIER_COLORS = {
  S: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  A: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", 
  B: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  C: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  D: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function OTCConsensus() {
  const [format, setFormat] = useState<ConsensusFormat>("dynasty");
  const [position, setPosition] = useState<Position>("ALL");
  
  const season = format === "redraft" ? 2025 : undefined;
  const { data: consensusData, isLoading, error } = useConsensus(format, season);
  const { data: meta } = useConsensusMeta();

  const filteredRows = consensusData?.rows?.filter(row => 
    position === "ALL" || row.format === format
  ) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 bg-zinc-200/80 rounded w-48"></div>
            <div className="h-4 bg-zinc-200/80 rounded w-80"></div>
          </div>
          <div className="h-4 bg-zinc-200/80 rounded w-32"></div>
        </div>
        
        {/* Table skeleton */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line">
                    <th className="p-3 text-left">Rank</th>
                    <th className="p-3 text-left">Player</th>
                    <th className="p-3 text-left">Tier</th>
                    <th className="p-3 text-left">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <SkeletonTableRow key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-red-600 dark:text-red-400">Failed to load consensus data</p>
              <p className="text-sm text-gray-500 mt-2">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            OTC Consensus
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Community-driven dynasty and redraft rankings
          </p>
        </div>
        <div className="text-sm text-gray-500">
          Board v{meta?.boardVersion || 1} • {consensusData?.rows?.length || 0} players
        </div>
      </div>

      {/* Format Tabs */}
      <Tabs value={format} onValueChange={(value) => setFormat(value as ConsensusFormat)}>
        <TabsList>
          <TabsTrigger value="dynasty">Dynasty</TabsTrigger>
          <TabsTrigger value="redraft">Redraft 2025</TabsTrigger>
        </TabsList>

        <TabsContent value={format} className="space-y-4">
          {/* Position Filter */}
          <div className="flex gap-2">
            {POSITIONS.map((pos) => (
              <Button
                key={pos}
                variant={position === pos ? "default" : "outline"}
                size="sm"
                onClick={() => setPosition(pos)}
              >
                {pos}
              </Button>
            ))}
          </div>

          {/* Rankings Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {format.charAt(0).toUpperCase() + format.slice(1)} Rankings
                {position !== "ALL" && ` - ${position}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                          Rank
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                          Player
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                          Tier
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                          Score
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                          Source
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => (
                        <tr 
                          key={`${row.format}-${row.season}-${row.playerId}`}
                          className="border-b border-gray-100 dark:border-gray-800 hover-lift cursor-pointer"
                        >
                          <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                            {row.rank}
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                Player {row.playerId}
                              </div>
                              <div className="text-sm text-gray-500">
                                {/* TODO: Get team from player pool */}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={TIER_COLORS[row.tier as keyof typeof TIER_COLORS] || TIER_COLORS.D}>
                              {row.tier}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-900 dark:text-gray-100">
                            {row.score.toFixed(1)}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500 capitalize">
                            {row.source}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No consensus data available for {format}
                  {position !== "ALL" && ` ${position} players`}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}