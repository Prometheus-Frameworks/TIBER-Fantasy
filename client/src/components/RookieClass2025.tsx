import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Star, Calendar } from "lucide-react";
import { nameOf } from "@/hooks/usePlayerPool";

interface RookieClass2025Props {
  season: number;
  week: number;
  limit?: number;
}

interface WarehouseRecord {
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  targets?: number | null;
  receptions?: number | null;
  fantasy_ppr?: number | null;
  depth_rank?: string | null;
  college?: string;
  adp?: number;
  tier?: string;
  dynasty_score?: number;
}

export default function RookieClass2025({ season, week, limit = 8 }: RookieClass2025Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/rookies'],
    queryFn: () => fetch('/api/rookies').then(r => r.json()),
  });

  // Use actual rookie data from API
  const rookieData = data?.rookies?.slice(0, limit) || [];
  
  // Build player index for name lookup
  const playerIndex: Record<string, any> = {};
  rookieData.forEach((player: any) => {
    if (player.player_id) {
      playerIndex[player.player_id] = player;
    }
  });
  
  const nameOf = (id: string, idx: Record<string, any>) => idx[id]?.player_name ?? idx[id]?.name ?? id;

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'RB': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'WR': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'TE': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    if (index === 1) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    if (index === 2) return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200';
  };

  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 's': case 'elite': return 'bg-purple-500 text-white';
      case 'a': case 'tier-1': return 'bg-blue-500 text-white';
      case 'b': case 'tier-2': return 'bg-green-500 text-white';
      case 'c': case 'tier-3': return 'bg-yellow-500 text-white';
      case 'd': case 'tier-4': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Rookie Class 2025
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          Rookie Class 2025
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ml-2">
            <Calendar className="h-3 w-3 mr-1" />
            Week {week}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rookieData.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No rookie performance data found for Week {week}</p>
            <p className="text-xs mt-1">Check back during the 2025 season</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rookieData.map((record: any, index: number) => (
              <div
                key={`${record.player_id}-${index}`}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${getRankBadge(index)}`}>
                    {index + 1}
                  </div>
                  
                  <div>
                    <div className="font-semibold text-sm">
                      {nameOf(record.player_id)}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs">
                      <Badge className={getPositionColor(record.position)}>
                        {record.position}
                      </Badge>
                      <span>•</span>
                      <span>{record.team}</span>
                      {record.college && (
                        <>
                          <span>•</span>
                          <span>{record.college}</span>
                        </>
                      )}
                      {record.depth_rank && (
                        <>
                          <span>•</span>
                          <span>#{record.depth_rank} depth</span>
                        </>
                      )}
                      {record.targets && (
                        <>
                          <span>•</span>
                          <span>{record.targets} targets</span>
                        </>
                      )}
                      {record.receptions && (
                        <>
                          <span>•</span>
                          <span>{record.receptions} rec</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-lg">
                    {record.fantasy_ppr?.toFixed(1) || "0.0"}
                  </div>
                  <div className="text-xs text-muted-foreground">PPR pts</div>
                  
                  {(record.position === 'WR' || record.position === 'TE') && record.targets && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {record.targets} tgt • {record.receptions || 0} rec
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t text-center">
          <p className="text-xs text-muted-foreground">
            Showing top {Math.min(limit, rookieData.length)} performers • {season} Season Week {week}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Data from OTC Weekly Pipeline
          </p>
        </div>
      </CardContent>
    </Card>
  );
}