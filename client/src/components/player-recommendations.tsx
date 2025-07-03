import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, TrendingUp, ArrowRight } from "lucide-react";
import { getPositionBadgeColor, calculatePotentialGain } from "@/lib/utils";
import type { Player } from "@shared/schema";

interface PlayerRecommendationsProps {
  teamId: number;
}

export default function PlayerRecommendations({ teamId }: PlayerRecommendationsProps) {
  const [selectedPosition, setSelectedPosition] = useState<string>("all");

  const { data: recommendations, isLoading } = useQuery<Player[]>({
    queryKey: [`/api/teams/${teamId}/recommendations`, selectedPosition],
    queryFn: async () => {
      const url = selectedPosition && selectedPosition !== "all"
        ? `/api/teams/${teamId}/recommendations?position=${selectedPosition}`
        : `/api/teams/${teamId}/recommendations`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin field-green" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">Recommended Players</h3>
        <div className="flex items-center space-x-4">
          <Select value={selectedPosition} onValueChange={setSelectedPosition}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Positions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Positions</SelectItem>
              <SelectItem value="QB">Quarterbacks</SelectItem>
              <SelectItem value="RB">Running Backs</SelectItem>
              <SelectItem value="WR">Wide Receivers</SelectItem>
              <SelectItem value="TE">Tight Ends</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-field-green hover:bg-dark-green">
            <Search className="mr-2" size={16} />
            Advanced Search
          </Button>
        </div>
      </div>

      {!recommendations || recommendations.length === 0 ? (
        <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Search className="mx-auto text-4xl text-gray-400 mb-4" size={48} />
            <div className="text-gray-600">No player recommendations available</div>
            <div className="text-sm text-gray-500">Try selecting a different position</div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.slice(0, 6).map((player) => {
              const potentialGain = calculatePotentialGain(8.0, player.avgPoints); // Assuming current avg of 8.0
              
              return (
                <div
                  key={player.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getPositionBadgeColor(player.position, "good")}`}>
                        <span className="text-white font-bold text-sm">{player.position}</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{player.name}</div>
                        <div className="text-sm text-gray-500">{player.team} • Available</div>
                      </div>
                    </div>
                    <Badge className="bg-field-green text-white text-xs font-bold">
                      +{potentialGain.toFixed(1)}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        {player.avgPoints.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500">Avg Points</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        {player.ownershipPercentage}%
                      </div>
                      <div className="text-xs text-gray-500">Owned</div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-sm text-gray-600 mb-1">Upside Potential</div>
                    <Progress value={player.upside} className="h-2" />
                  </div>

                  <div className="flex space-x-2">
                    <Button className="flex-1 bg-field-green hover:bg-dark-green text-sm">
                      Add to Watchlist
                    </Button>
                    <Button variant="outline" size="sm" className="px-3">
                      <TrendingUp className="text-gray-600" size={16} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 text-center">
            <Button variant="link" className="field-green font-medium">
              View All Available Players <ArrowRight className="ml-2" size={16} />
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
