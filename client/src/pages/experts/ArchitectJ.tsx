import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Username } from "@/components/ui/Username";
import { User, Trophy, TrendingUp, Link2 } from "lucide-react";
import { Link } from "wouter";

interface UserProfile {
  username: string;
  consentConsensus: boolean;
  fireScore: number;
  createdAt: string;
}

interface ConsensusRanking {
  id: string;
  playerId: string;
  format: "dynasty" | "redraft";
  rank: number;
  tier: string;
  source: "seed" | "community";
  updatedAt: string;
}

type Position = "QB" | "RB" | "WR" | "TE" | "ALL";

export default function ArchitectJProfile() {
  const [activeTab, setActiveTab] = useState<"dynasty" | "redraft">("dynasty");
  const [selectedPosition, setSelectedPosition] = useState<Position>("ALL");

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/profile/architect-j"],
  });

  const { data: dynastyConsensus } = useQuery<{ rows: ConsensusRanking[] }>({
    queryKey: ["/api/consensus", "dynasty", selectedPosition],
    queryFn: () => {
      const params = new URLSearchParams({
        format: "dynasty",
        ...(selectedPosition !== "ALL" && { pos: selectedPosition })
      });
      return fetch(`/api/consensus?${params}`).then(r => r.json());
    },
  });

  const { data: redraftConsensus } = useQuery<{ rows: ConsensusRanking[] }>({
    queryKey: ["/api/consensus", "redraft", selectedPosition],
    queryFn: () => {
      const params = new URLSearchParams({
        format: "redraft",
        season: "2025",
        ...(selectedPosition !== "ALL" && { pos: selectedPosition })
      });
      return fetch(`/api/consensus?${params}`).then(r => r.json());
    },
    enabled: activeTab === "redraft"
  });

  const currentConsensus = activeTab === "dynasty" ? dynastyConsensus : redraftConsensus;
  const positions: Position[] = ["ALL", "QB", "RB", "WR", "TE"];

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <User className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {profile ? (
                <Username name={profile.username} fireScore={profile.fireScore} />
              ) : (
                "Architect J"
              )}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                Founder
              </Badge>
              {profile?.consentConsensus && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Contributing to Consensus
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Link href={`/compare/architect-j?format=${activeTab}&pos=${selectedPosition}`}>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Compare to Consensus
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Fire Score
              </span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {profile?.fireScore || 0} 🔥
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Rankings
              </span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {currentConsensus?.rows?.length || 0}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Member Since
              </span>
            </div>
            <p className="text-sm font-bold mt-1">
              {profile?.createdAt 
                ? new Date(profile.createdAt).toLocaleDateString()
                : "2024"
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rankings Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Expert Rankings</CardTitle>
            <div className="text-xs text-gray-500">
              Currently showing as OTC Consensus (1:1 during seed phase)
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "dynasty" | "redraft")}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="dynasty">Dynasty</TabsTrigger>
                <TabsTrigger value="redraft">Redraft (2025)</TabsTrigger>
              </TabsList>
              
              {/* Position Filter */}
              <div className="flex gap-1">
                {positions.map((pos) => (
                  <Button
                    key={pos}
                    variant={selectedPosition === pos ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPosition(pos)}
                  >
                    {pos}
                  </Button>
                ))}
              </div>
            </div>

            <TabsContent value="dynasty" className="space-y-2">
              {dynastyConsensus?.rows?.length ? (
                <div className="space-y-1">
                  {dynastyConsensus.rows.slice(0, 50).map((ranking) => (
                    <div
                      key={ranking.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-gray-500 w-8">
                          {ranking.rank}
                        </span>
                        <span className="font-medium">
                          {ranking.playerId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {ranking.tier}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {ranking.source}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  No dynasty rankings available
                </p>
              )}
            </TabsContent>

            <TabsContent value="redraft" className="space-y-2">
              {redraftConsensus?.rows?.length ? (
                <div className="space-y-1">
                  {redraftConsensus.rows.slice(0, 50).map((ranking) => (
                    <div
                      key={ranking.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-gray-500 w-8">
                          {ranking.rank}
                        </span>
                        <span className="font-medium">
                          {ranking.playerId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {ranking.tier}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {ranking.source}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  No redraft rankings available for 2025
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}