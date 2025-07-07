import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Search } from "lucide-react";

interface ADPPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  adp: number;
  ownership: number;
  adpTrend: number;
  isRising: boolean;
  isFalling: boolean;
}

interface ADPData {
  players: ADPPlayer[];
  lastUpdated: string;
  totalDrafts: number;
}

export default function SimplifiedADP() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("ALL");

  const { data: adpData, isLoading } = useQuery<ADPData>({
    queryKey: ['/api/adp/sleeper', 'superflex'],
  });

  const filteredPlayers = adpData?.players?.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = selectedPosition === "ALL" || player.position === selectedPosition;
    return matchesSearch && matchesPosition;
  }) || [];

  const getTrendIcon = (trend: number) => {
    if (trend > 5) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend < -5) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="container mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-700 rounded w-1/3"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header - Clean Sleeper Style */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Dynasty ADP Rankings</h1>
          <p className="text-gray-400 text-sm">
            Based on {adpData?.totalDrafts?.toLocaleString()} recent Sleeper dynasty drafts
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <div className="flex gap-2">
            {['ALL', 'QB', 'RB', 'WR', 'TE'].map((pos) => (
              <Button
                key={pos}
                variant={selectedPosition === pos ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPosition(pos)}
                className={selectedPosition === pos ? 
                  "bg-blue-600 hover:bg-blue-700" : 
                  "border-gray-600 text-gray-300 hover:bg-gray-800"
                }
              >
                {pos}
              </Button>
            ))}
          </div>
        </div>

        {/* Players List - Sleeper Style */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white">ADP Player</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-0">
              {filteredPlayers.slice(0, 50).map((player, index) => (
                <div 
                  key={player.id} 
                  className="flex items-center justify-between p-4 border-b border-gray-700 hover:bg-gray-750 transition-colors"
                >
                  {/* Player Info */}
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="w-8 text-sm text-gray-400 font-mono">
                      {player.adp.toFixed(1)}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant="outline" 
                        className={
                          player.position === 'QB' ? 'border-red-500 text-red-400' :
                          player.position === 'RB' ? 'border-green-500 text-green-400' :
                          player.position === 'WR' ? 'border-blue-500 text-blue-400' :
                          'border-purple-500 text-purple-400'
                        }
                      >
                        {player.position}
                      </Badge>
                      <div>
                        <div className="font-medium text-white">{player.name}</div>
                        <div className="text-sm text-gray-400">{player.team}</div>
                      </div>
                    </div>
                  </div>

                  {/* Trend & Ownership */}
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm text-gray-300">{player.ownership.toFixed(1)}%</div>
                      <div className="text-xs text-gray-500">Owned</div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {getTrendIcon(player.adpTrend)}
                      {player.isRising && (
                        <Badge variant="outline" className="border-green-500 text-green-400 text-xs">
                          Rising
                        </Badge>
                      )}
                      {player.isFalling && (
                        <Badge variant="outline" className="border-red-500 text-red-400 text-xs">
                          Falling
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500">
          Last updated: {adpData?.lastUpdated ? new Date(adpData.lastUpdated).toLocaleString() : 'Unknown'}
        </div>
      </div>
    </div>
  );
}