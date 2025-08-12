import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, GitCompare, ArrowRight } from "lucide-react";
import { Link } from "wouter";

interface ExpertConsensusPlayer {
  id: string;
  playerId: string;
  format: string;
  rank: number;
  tier: number;
  source: string;
  updatedAt: string;
}

export default function ExpertView() {
  const [activeFormat, setActiveFormat] = useState<"dynasty" | "redraft">("dynasty");
  const [positionFilter, setPositionFilter] = useState<"ALL" | "QB" | "RB" | "WR" | "TE">("ALL");

  // Mock data for expert view - would be replaced with actual API call
  const expertData: ExpertConsensusPlayer[] = [
    { id: "1", playerId: "jahmyr-gibbs", format: "redraft", rank: 1, tier: 1, source: "J", updatedAt: new Date().toISOString() },
    { id: "2", playerId: "luther-burden", format: "dynasty", rank: 12, tier: 2, source: "J", updatedAt: new Date().toISOString() },
    { id: "3", playerId: "josh-allen", format: "redraft", rank: 3, tier: 1, source: "J", updatedAt: new Date().toISOString() },
  ];

  const filteredPlayers = expertData.filter(player => 
    player.format === activeFormat && 
    (positionFilter === "ALL" || player.playerId.includes(positionFilter.toLowerCase()))
  );

  const positions = ["ALL", "QB", "RB", "WR", "TE"] as const;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-xl">
          <Users className="h-8 w-8 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Architect J — Personal Board
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Currently seeding OTC Consensus (1:1 during seed phase)
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Format Toggle */}
        <div className="flex gap-2">
          <Button
            variant={activeFormat === "dynasty" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFormat("dynasty")}
          >
            Dynasty
          </Button>
          <Button
            variant={activeFormat === "redraft" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFormat("redraft")}
          >
            Redraft 2025
          </Button>
        </div>

        {/* Position Filters */}
        <div className="flex gap-2 flex-wrap">
          {positions.map((pos) => (
            <Button
              key={pos}
              variant={positionFilter === pos ? "default" : "outline"}
              size="sm"
              onClick={() => setPositionFilter(pos)}
              className="text-xs"
            >
              {pos}
            </Button>
          ))}
        </div>
      </div>

      {/* Personal Board Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {activeFormat === "dynasty" ? "Dynasty" : "Redraft 2025"} Personal Board
            </CardTitle>
            <Button variant="outline" size="sm">
              <GitCompare className="h-4 w-4 mr-2" />
              Compare to OTC Consensus
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPlayers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No rankings yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Personal board is being seeded. Check back soon.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 border-b border-gray-200 dark:border-gray-700">
                <div className="col-span-1">Rank</div>
                <div className="col-span-6">Player</div>
                <div className="col-span-2">Tier</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-1"></div>
              </div>
              {filteredPlayers.map((player) => (
                <Link key={player.id} href={`/players/${player.playerId}`}>
                  <div className="grid grid-cols-12 gap-2 py-3 px-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded cursor-pointer transition-colors">
                    <div className="col-span-1 font-medium">
                      {player.rank}
                    </div>
                    <div className="col-span-6">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {player.playerId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Badge variant="outline" className="text-xs">
                        Tier {player.tier}
                      </Badge>
                    </div>
                    <div className="col-span-2">
                      <Badge variant={player.source === "J" ? "default" : "outline"} className="text-xs">
                        {player.source === "J" ? "Manual" : "System"}
                      </Badge>
                    </div>
                    <div className="col-span-1">
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note */}
      <Card className="bg-gray-50 dark:bg-gray-800/50">
        <CardContent className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Note:</strong> During seed phase, Architect J updates may mirror OTC Consensus.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}