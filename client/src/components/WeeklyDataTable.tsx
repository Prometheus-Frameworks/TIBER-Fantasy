import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Filter } from "lucide-react";

interface WarehouseRecord {
  player_id: string;
  player_name?: string;
  season: number;
  week: number;
  team: string;
  position: string;
  routes?: number | null;
  targets?: number | null;
  air_yards?: number | null;
  receptions?: number | null;
  receiving_yards?: number | null;
  receiving_tds?: number | null;
  rushing_att?: number | null;
  rushing_yards?: number | null;
  rushing_tds?: number | null;
  fantasy_ppr?: number | null;
  depth_rank?: string | null;
  formation?: string | null;
}

interface ApiResponse {
  data: WarehouseRecord[];
  next_cursor: string | null;
  total_filtered?: number;
}

const POSITION_OPTIONS = [
  { value: "QB,RB,WR,TE,K,DST", label: "All Fantasy" },
  { value: "QB", label: "QB" },
  { value: "RB", label: "RB" },
  { value: "WR", label: "WR" },
  { value: "TE", label: "TE" },
  { value: "QB,RB,WR,TE", label: "Skill Positions" },
];

export default function WeeklyDataTable() {
  const [week, setWeek] = useState<number>(1);
  const [team, setTeam] = useState<string>("");
  const [position, setPosition] = useState<string>("QB,RB,WR,TE");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Fetch weekly data
  const { data: weeklyData, isLoading, refetch } = useQuery<ApiResponse>({
    queryKey: ['/api/redraft/weekly', { week, team, position }],
    queryFn: async () => {
      const params = new URLSearchParams({
        season: "2024",
        week: String(week),
        pos: position,
        team: team.toUpperCase(),
        limit: "200"
      });
      const response = await fetch(`/api/redraft/weekly?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch weekly data: ${response.statusText}`);
      }
      return response.json();
    }
  });

  // Fetch available weeks
  const { data: weeksData } = useQuery<{ weeks: number[], latest_week: number }>({
    queryKey: ['/api/redraft/weeks', { season: 2024 }],
    queryFn: async () => {
      const response = await fetch('/api/redraft/weeks?season=2024');
      if (!response.ok) {
        throw new Error('Failed to fetch weeks');
      }
      return response.json();
    }
  });

  // Filter data by search term
  const filteredData = weeklyData?.data.filter(record => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      record.player_id.toLowerCase().includes(searchLower) ||
      record.team.toLowerCase().includes(searchLower) ||
      record.position.toLowerCase().includes(searchLower)
    );
  }) || [];

  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "-";
    return typeof value === 'number' ? value.toFixed(1) : "-";
  };

  const getPositionBadgeColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'RB': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'WR': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'TE': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getDepthRankBadge = (depth: string | null) => {
    if (!depth) return null;
    const rank = parseInt(depth);
    if (rank === 1) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
    if (rank === 2) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          2024 Weekly Player Data
        </CardTitle>
        
        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Week:</label>
            <Select value={String(week)} onValueChange={(value) => setWeek(Number(value))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(weeksData?.weeks || [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]).map(w => (
                  <SelectItem key={w} value={String(w)}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Position:</label>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSITION_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Team:</label>
            <Input 
              placeholder="e.g. KC, BUF" 
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="w-32"
            />
          </div>

          <div className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <Input 
              placeholder="Search players..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-40"
            />
          </div>

          <Button onClick={() => refetch()} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading weekly data...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No data found for the selected filters.
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-muted-foreground">
              Showing {filteredData.length} players for Week {week} 
              {team && ` • Team: ${team.toUpperCase()}`}
              {weeklyData?.total_filtered && ` • Total in dataset: ${weeklyData.total_filtered}`}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-1">Player ID</th>
                    <th className="text-left py-2 px-1">Team</th>
                    <th className="text-left py-2 px-1">Pos</th>
                    <th className="text-right py-2 px-1">Depth</th>
                    <th className="text-right py-2 px-1">Targets</th>
                    <th className="text-right py-2 px-1">Rec</th>
                    <th className="text-right py-2 px-1">Rec Yds</th>
                    <th className="text-right py-2 px-1">Rush Att</th>
                    <th className="text-right py-2 px-1">Rush Yds</th>
                    <th className="text-right py-2 px-1">PPR Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((record, index) => (
                    <tr key={`${record.player_id}-${record.week}`} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-1 font-mono text-xs">
                        {record.player_id}
                      </td>
                      <td className="py-2 px-1">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                          {record.team}
                        </span>
                      </td>
                      <td className="py-2 px-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getPositionBadgeColor(record.position)}`}>
                          {record.position}
                        </span>
                      </td>
                      <td className="py-2 px-1 text-right">
                        {record.depth_rank && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getDepthRankBadge(record.depth_rank)}`}>
                            {record.depth_rank}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-1 text-right">{record.targets || "-"}</td>
                      <td className="py-2 px-1 text-right">{record.receptions || "-"}</td>
                      <td className="py-2 px-1 text-right">{formatNumber(record.receiving_yards)}</td>
                      <td className="py-2 px-1 text-right">{record.rushing_att || "-"}</td>
                      <td className="py-2 px-1 text-right">{formatNumber(record.rushing_yards)}</td>
                      <td className="py-2 px-1 text-right font-medium">
                        {formatNumber(record.fantasy_ppr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {weeklyData?.next_cursor && (
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm">
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}