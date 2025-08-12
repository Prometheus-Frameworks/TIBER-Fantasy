import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, ArrowLeft, Minus, TrendingUp, TrendingDown } from "lucide-react";

interface CompareRanking {
  playerId: string;
  playerName: string;
  yourRank?: number;
  consensusRank?: number;
  delta?: number; // consensusRank - yourRank
}

type Format = "dynasty" | "redraft";
type Position = "QB" | "RB" | "WR" | "TE" | "ALL";

export default function CompareRankings() {
  const [location] = useLocation();
  const [format, setFormat] = useState<Format>("dynasty");
  const [position, setPosition] = useState<Position>("ALL");
  
  // Extract username from URL
  const username = location.split("/compare/")[1]?.split("?")[0] || "architect-j";
  
  // Parse URL parameters
  const urlParams = new URLSearchParams(location.split("?")[1] || "");
  const initialFormat = (urlParams.get("format") as Format) || "dynasty";
  const initialPos = (urlParams.get("pos") as Position) || "ALL";
  
  // Set initial values from URL
  useState(() => {
    setFormat(initialFormat);
    setPosition(initialPos);
  });

  const { data: comparisons, isLoading } = useQuery<CompareRanking[]>({
    queryKey: ["/api/compare", username, format, position],
    queryFn: () => {
      const params = new URLSearchParams({
        format,
        ...(position !== "ALL" && { pos: position })
      });
      return fetch(`/api/compare/${username}?${params}`).then(r => r.json());
    }
  });

  const positions: Position[] = ["ALL", "QB", "RB", "WR", "TE"];

  const getDeltaDisplay = (delta?: number) => {
    if (delta === undefined) return null;
    
    if (delta === 0) {
      return (
        <Badge variant="outline" className="text-gray-600">
          <Minus className="h-3 w-3 mr-1" />
          Perfect Match
        </Badge>
      );
    }
    
    if (delta > 0) {
      return (
        <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200">
          <TrendingDown className="h-3 w-3 mr-1" />
          +{delta} (Lower in consensus)
        </Badge>
      );
    }
    
    return (
      <Badge variant="default" className="bg-green-50 text-green-700 border-green-200">
        <TrendingUp className="h-3 w-3 mr-1" />
        {delta} (Higher in consensus)
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Rankings Comparison
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {username} vs OTC Consensus
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Tabs value={format} onValueChange={(v) => setFormat(v as Format)}>
              <TabsList>
                <TabsTrigger value="dynasty">Dynasty</TabsTrigger>
                <TabsTrigger value="redraft">Redraft (2025)</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="flex gap-1">
              {positions.map((pos) => (
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
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Ranking Comparison
            <Badge variant="secondary">
              {comparisons?.length || 0} players
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Loading comparison...</div>
            </div>
          ) : comparisons?.length ? (
            <div className="space-y-2">
              {/* Header Row */}
              <div className="grid grid-cols-5 gap-4 py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg font-medium text-sm text-gray-600 dark:text-gray-400">
                <div>Player</div>
                <div className="text-center">Your Rank</div>
                <div className="text-center">OTC Consensus</div>
                <div className="text-center">Difference</div>
                <div className="text-center">Status</div>
              </div>
              
              {/* Data Rows */}
              {comparisons.map((comparison, idx) => (
                <div
                  key={comparison.playerId}
                  className="grid grid-cols-5 gap-4 py-3 px-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="font-medium">
                    {comparison.playerName}
                  </div>
                  
                  <div className="text-center">
                    {comparison.yourRank ? (
                      <Badge variant="outline">#{comparison.yourRank}</Badge>
                    ) : (
                      <span className="text-gray-400 text-sm">Unranked</span>
                    )}
                  </div>
                  
                  <div className="text-center">
                    {comparison.consensusRank ? (
                      <Badge variant="secondary">#{comparison.consensusRank}</Badge>
                    ) : (
                      <span className="text-gray-400 text-sm">Unranked</span>
                    )}
                  </div>
                  
                  <div className="text-center font-mono text-sm">
                    {comparison.delta !== undefined ? (
                      comparison.delta === 0 ? (
                        <span className="text-gray-600">0</span>
                      ) : comparison.delta > 0 ? (
                        <span className="text-red-600">+{comparison.delta}</span>
                      ) : (
                        <span className="text-green-600">{comparison.delta}</span>
                      )
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                  
                  <div className="text-center">
                    {getDeltaDisplay(comparison.delta)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-500">
                No ranking data found for comparison
              </div>
              <p className="text-sm text-gray-400 mt-2">
                {username} may not have rankings for {format} {position} yet
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Understanding the Comparison</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <Badge variant="default" className="bg-green-50 text-green-700 border-green-200">
              <TrendingUp className="h-3 w-3 mr-1" />
              Negative Delta
            </Badge>
            <span>You ranked this player higher than consensus</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200">
              <TrendingDown className="h-3 w-3 mr-1" />
              Positive Delta
            </Badge>
            <span>You ranked this player lower than consensus</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-gray-600">
              <Minus className="h-3 w-3 mr-1" />
              Perfect Match
            </Badge>
            <span>Your ranking matches consensus exactly</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}