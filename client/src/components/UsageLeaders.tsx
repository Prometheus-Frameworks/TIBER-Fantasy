import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp } from "lucide-react";

interface UsageLeader {
  player_name: string;
  position: string;
  team: string;
  target_share?: number;
  snap_percentage?: number;
  usage_score?: number;
}

export default function UsageLeaders() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/usage-leaders'],
    queryFn: () => fetch('/api/usage-leaders').then(r => r.json()),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Usage Leaders</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const leaders = (data as any)?.leaders || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Usage Leaders</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {leaders.slice(0, 10).map((player: UsageLeader, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Badge variant="outline">{player.position}</Badge>
                <div>
                  <div className="font-medium">{player.player_name}</div>
                  <div className="text-sm text-gray-500">{player.team}</div>
                </div>
              </div>
              <div className="text-right space-y-1">
                {player.target_share && (
                  <div className="text-sm">
                    <span className="font-medium">{player.target_share}%</span>
                    <span className="text-gray-500 ml-1">Tgt</span>
                  </div>
                )}
                {player.snap_percentage && (
                  <div className="text-sm">
                    <span className="font-medium">{player.snap_percentage}%</span>
                    <span className="text-gray-500 ml-1">Snaps</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {leaders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No usage data available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}