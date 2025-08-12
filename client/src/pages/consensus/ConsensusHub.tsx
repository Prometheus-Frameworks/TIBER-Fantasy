import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Users, BarChart3, Settings, ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import PlayerRow from "@/components/PlayerRow";

interface ConsensusPlayer {
  id: string;
  playerId: string;
  format: string;
  season?: number;
  rank: number;
  tier: number;
  score: number;
  source: string;
  updatedAt: string;
}

interface ConsensusResponse {
  meta: {
    defaultFormat: string;
    boardVersion: number;
  };
  rows: ConsensusPlayer[];
}

export default function ConsensusHub() {
  const [activeFormat, setActiveFormat] = useState<"dynasty" | "redraft">("dynasty");
  const [positionFilter, setPositionFilter] = useState<"ALL" | "QB" | "RB" | "WR" | "TE">("ALL");

  const { data: consensusData, isLoading } = useQuery<ConsensusResponse>({
    queryKey: [`/api/consensus`, { format: activeFormat }],
    queryFn: async () => {
      const response = await fetch(`/api/consensus?format=${activeFormat}`);
      if (!response.ok) throw new Error('Failed to fetch consensus data');
      return response.json();
    }
  });

  const filteredPlayers = consensusData?.rows?.filter(player => {
    if (positionFilter === "ALL") return true;
    // For now, since we have numeric player IDs, we'll show all until we have proper position filtering
    return true;
  }) || [];

  const positions = ["ALL", "QB", "RB", "WR", "TE"] as const;

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-xl">
          <Trophy className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            OTC Consensus
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Community-driven dynasty and redraft boards. Transparent and versioned.
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

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Consensus Table */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {activeFormat === "dynasty" ? "Dynasty" : "Redraft 2025"} Consensus
                <Badge variant="outline" className="text-xs">
                  v{consensusData?.meta.boardVersion || 1}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  ))}
                </div>
              ) : filteredPlayers.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No entries yet
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Seeding live — check again soon.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 pb-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="col-span-1">Rank</div>
                    <div className="col-span-5">Player</div>
                    <div className="col-span-2">Tier</div>
                    <div className="col-span-2">Score</div>
                    <div className="col-span-2">Actions</div>
                  </div>
                  {filteredPlayers.slice(0, 50).map((player) => (
                    <PlayerRow
                      key={player.id}
                      player={{
                        id: player.id,
                        playerId: player.playerId,
                        rank: player.rank,
                        tier: typeof player.tier === 'string' ? parseInt(player.tier.replace(/[A-Z]/g, '')) || 1 : player.tier,
                        score: player.score
                      }}
                      showActions={true}
                      format={activeFormat}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Rail */}
        <div className="space-y-4">
          {/* Consensus Transparency */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <h3 className="font-medium">Consensus Transparency</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                View changelog, seeds, and movement tracking
              </p>
              <Link href="/consensus-transparency">
                <Button variant="outline" size="sm" className="w-full">
                  View Details →
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Architect J */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Users className="h-5 w-5 text-purple-600" />
                <h3 className="font-medium">Architect J</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Personal board and seeding activity
              </p>
              <Link href="/consensus/expert/architect-j">
                <Button variant="outline" size="sm" className="w-full">
                  View Board →
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Switch to Compass */}
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Settings className="h-5 w-5 text-blue-600" />
                <h3 className="font-medium">Need Context?</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Get scenario-based player guidance instead
              </p>
              <Link href="/compass">
                <Badge variant="outline" className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30">
                  Player Compass →
                </Badge>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}