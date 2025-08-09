import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Target } from "lucide-react";

interface WarehouseRecord {
  player_id: string;
  team: string;
  position: string;
  targets?: number | null;
  receptions?: number | null;
  fantasy_ppr?: number | null;
  depth_rank?: string | null;
}

interface RookieSpotlightProps {
  team?: string;
  week?: number;
  limit?: number;
}

export default function RookieSpotlight({ team = "", week = 1, limit = 5 }: RookieSpotlightProps) {
  const { data, isLoading } = useQuery<{ data: WarehouseRecord[] }>({
    queryKey: ['/api/redraft/weekly', 'rookie-spotlight', { team, week }],
    queryFn: async () => {
      const params = new URLSearchParams({
        season: "2024",
        week: String(week),
        pos: "WR,RB,TE,QB",
        team: team.toUpperCase(),
        limit: "50" // Get more to filter for rookies
      });
      const response = await fetch(`/api/redraft/weekly?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch rookie data');
      }
      return response.json();
    }
  });

  // Filter for potential rookies (simplified - could be enhanced with actual rookie data)
  const rookieData = data?.data
    .filter(record => record.fantasy_ppr && record.fantasy_ppr > 0)
    .sort((a, b) => (b.fantasy_ppr || 0) - (a.fantasy_ppr || 0))
    .slice(0, limit) || [];

  const getPositionIcon = (position: string) => {
    switch (position) {
      case 'RB': return '🏃';
      case 'WR': return '🙌';
      case 'TE': return '💪';
      case 'QB': return '🎯';
      default: return '⚡';
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Rookie Spotlight
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5" />
          Week {week} Top Performers
          {team && (
            <Badge variant="outline" className="ml-2">
              {team.toUpperCase()}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rookieData.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No performance data found for Week {week}
            {team && ` for ${team.toUpperCase()}`}
          </div>
        ) : (
          <div className="space-y-3">
            {rookieData.map((record, index) => (
              <div
                key={`${record.player_id}-${index}`}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{getPositionIcon(record.position)}</div>
                  <div>
                    <div className="font-medium text-sm">
                      {record.player_id}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {record.team}
                      </Badge>
                      <Badge className="text-xs">
                        {record.position}
                      </Badge>
                      {record.depth_rank && (
                        <Badge variant="secondary" className="text-xs">
                          Depth #{record.depth_rank}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-lg">
                    {record.fantasy_ppr?.toFixed(1) || "0.0"}
                  </div>
                  <div className="text-xs text-muted-foreground">PPR pts</div>
                  
                  {record.position === 'WR' || record.position === 'TE' ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Target className="h-3 w-3" />
                      {record.targets || 0} tgt, {record.receptions || 0} rec
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t text-xs text-muted-foreground text-center">
          Data from OTC 2024 Weekly Pipeline • Week {week}
        </div>
      </CardContent>
    </Card>
  );
}