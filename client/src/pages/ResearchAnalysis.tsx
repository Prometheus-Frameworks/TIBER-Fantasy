import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Users, TrendingUp, Zap, AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Player {
  player_id: string;
  name: string;
  team: string;
  pos: string;
  depth_chart_order?: number;
  depth_chart_position?: string;
}

interface RostersByTeam {
  [team: string]: Player[];
}

interface IntelEntry {
  player: string;
  team: string;
  position: string;
  signal_strength: "high" | "medium" | "low";
  category: string;
  headline: string;
  content: string;
  fantasy_impact: "positive" | "negative" | "neutral" | "watch";
  tags: string[];
}

interface IntelFeed {
  date: string;
  source: string;
  intel_type: string;
  entries: IntelEntry[];
  summary: {
    total_intel: number;
    high_signal: number;
    medium_signal: number;
    low_signal: number;
    key_takeaways: string[];
  };
}

const NFL_TEAMS = [
  { code: "ARI", name: "Arizona Cardinals", division: "NFC West" },
  { code: "ATL", name: "Atlanta Falcons", division: "NFC South" },
  { code: "BAL", name: "Baltimore Ravens", division: "AFC North" },
  { code: "BUF", name: "Buffalo Bills", division: "AFC East" },
  { code: "CAR", name: "Carolina Panthers", division: "NFC South" },
  { code: "CHI", name: "Chicago Bears", division: "NFC North" },
  { code: "CIN", name: "Cincinnati Bengals", division: "AFC North" },
  { code: "CLE", name: "Cleveland Browns", division: "AFC North" },
  { code: "DAL", name: "Dallas Cowboys", division: "NFC East" },
  { code: "DEN", name: "Denver Broncos", division: "AFC West" },
  { code: "DET", name: "Detroit Lions", division: "NFC North" },
  { code: "GB", name: "Green Bay Packers", division: "NFC North" },
  { code: "HOU", name: "Houston Texans", division: "AFC South" },
  { code: "IND", name: "Indianapolis Colts", division: "AFC South" },
  { code: "JAX", name: "Jacksonville Jaguars", division: "AFC South" },
  { code: "KC", name: "Kansas City Chiefs", division: "AFC West" },
  { code: "LAC", name: "Los Angeles Chargers", division: "AFC West" },
  { code: "LAR", name: "Los Angeles Rams", division: "NFC West" },
  { code: "LV", name: "Las Vegas Raiders", division: "AFC West" },
  { code: "MIA", name: "Miami Dolphins", division: "AFC East" },
  { code: "MIN", name: "Minnesota Vikings", division: "NFC North" },
  { code: "NE", name: "New England Patriots", division: "AFC East" },
  { code: "NO", name: "New Orleans Saints", division: "NFC South" },
  { code: "NYG", name: "New York Giants", division: "NFC East" },
  { code: "NYJ", name: "New York Jets", division: "AFC East" },
  { code: "PHI", name: "Philadelphia Eagles", division: "NFC East" },
  { code: "PIT", name: "Pittsburgh Steelers", division: "AFC North" },
  { code: "SEA", name: "Seattle Seahawks", division: "NFC West" },
  { code: "SF", name: "San Francisco 49ers", division: "NFC West" },
  { code: "TB", name: "Tampa Bay Buccaneers", division: "NFC South" },
  { code: "TEN", name: "Tennessee Titans", division: "AFC South" },
  { code: "WAS", name: "Washington Commanders", division: "NFC East" },
];

const POSITION_ORDER = ["QB", "RB", "WR", "TE"];
const POSITION_COLORS = {
  QB: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  RB: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", 
  WR: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  TE: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const IMPACT_COLORS = {
  positive: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  negative: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  neutral: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  watch: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

const SIGNAL_ICONS = {
  high: <Zap className="w-4 h-4 text-orange-500" />,
  medium: <Info className="w-4 h-4 text-blue-500" />,
  low: <AlertTriangle className="w-4 h-4 text-gray-500" />,
};

function IntelCard({ entry }: { entry: IntelEntry }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className={POSITION_COLORS[entry.position as keyof typeof POSITION_COLORS]}>
                {entry.position}
              </Badge>
              <span className="font-bold text-sm">{entry.player}</span>
              <Badge variant="outline" className="text-xs">{entry.team}</Badge>
            </div>
            <h3 className="font-semibold text-base leading-tight">{entry.headline}</h3>
          </div>
          <div className="flex items-center gap-1">
            {SIGNAL_ICONS[entry.signal_strength]}
            <Badge className={IMPACT_COLORS[entry.fantasy_impact]} variant="outline">
              {entry.fantasy_impact}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">{entry.content}</p>
        <div className="flex flex-wrap gap-1">
          {entry.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag.replace(/_/g, ' ')}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TeamDepthChart({ team, players }: { team: string, players: Player[] }) {
  const teamInfo = NFL_TEAMS.find(t => t.code === team);
  const teamName = teamInfo?.name || team;
  
  // Group players by position
  const playersByPosition = POSITION_ORDER.reduce((acc, pos) => {
    acc[pos] = players.filter(p => p.pos === pos);
    return acc;
  }, {} as Record<string, Player[]>);

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">{teamName}</CardTitle>
          <Badge variant="outline" className="text-xs">{team}</Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          {teamInfo?.division} • {players.length} players
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {POSITION_ORDER.map(position => {
          const positionPlayers = playersByPosition[position];
          if (positionPlayers.length === 0) return null;

          return (
            <div key={position} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className={POSITION_COLORS[position as keyof typeof POSITION_COLORS]}>
                  {position}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {positionPlayers.length} players
                </span>
              </div>
              <div className="space-y-1">
                {positionPlayers
                  .sort((a, b) => {
                    const aOrder = a.depth_chart_order || 999;
                    const bOrder = b.depth_chart_order || 999;
                    return aOrder - bOrder;
                  })
                  .map((player, index) => {
                    // Use actual depth_chart_order if available, otherwise use sorted index + 1
                    const depthNumber = player.depth_chart_order || (index + 1);
                    return (
                      <div key={player.player_id} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/50">
                        <span className="font-medium">
                          {depthNumber}. {player.name}
                        </span>
                        <div className="flex items-center gap-1">
                          {player.depth_chart_order && (
                            <Badge variant="outline" className="text-xs">
                              #{player.depth_chart_order}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function ResearchAnalysis() {
  const { toast } = useToast();
  const [selectedDivision, setSelectedDivision] = useState<string>("All");
  const [selectedImpact, setSelectedImpact] = useState<string>("All");
  
  const { data: rosters, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["/api/rosters"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: intel } = useQuery<IntelFeed>({
    queryKey: ["/api/intel"],
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const { mutate: syncRosters, isPending: isSyncing } = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/sync/rosters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: 2025 })
      });
      if (!response.ok) throw new Error('Failed to sync rosters');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Roster Sync Complete",
        description: "All team rosters have been updated with latest data"
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Sync Failed", 
        description: error instanceof Error ? error.message : "Failed to sync rosters",
        variant: "destructive"
      });
    }
  });

  const divisions = ["All", ...Array.from(new Set(NFL_TEAMS.map(t => t.division)))];
  
  const filteredTeams = selectedDivision === "All" 
    ? NFL_TEAMS
    : NFL_TEAMS.filter(t => t.division === selectedDivision);

  const totalPlayers = rosters ? Object.values(rosters as RostersByTeam)
    .reduce((sum, teamPlayers) => sum + teamPlayers.length, 0) : 0;

  const totalTeams = rosters ? Object.keys(rosters as RostersByTeam).length : 0;

  const filteredIntel = intel?.entries?.filter((entry: IntelEntry) => 
    selectedImpact === "All" || entry.fantasy_impact === selectedImpact
  ) || [];

  const impactFilters = ["All", "positive", "negative", "watch", "neutral"];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Research & Analysis</h1>
        <p className="text-muted-foreground mb-6">
          NFL team depth charts, roster analysis, and real-time intelligence for fantasy football research
        </p>
        
        {/* Stats and Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">{totalTeams} Teams</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">{totalPlayers} Players</span>
            </div>
          </div>
          
          <Button
            onClick={() => syncRosters()}
            disabled={isSyncing || isRefetching}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${(isSyncing || isRefetching) ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Rosters'}
          </Button>
        </div>

      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="depth-charts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="depth-charts">Team Depth Charts</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence Feed</TabsTrigger>
        </TabsList>

        <TabsContent value="depth-charts" className="space-y-6">
          {/* Division Filter */}
          <div className="flex flex-wrap gap-2">
            {divisions.map(division => (
              <Button
                key={division}
                onClick={() => setSelectedDivision(division)}
                variant={selectedDivision === division ? "default" : "outline"}
                size="sm"
              >
                {division}
              </Button>
            ))}
          </div>

          {/* Depth Charts Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-6 w-5/6" />
                <Skeleton className="h-6 w-4/5" />
                <Skeleton className="h-6 w-3/4" />
              </div>
            </Card>
          ))}
        </div>
      ) : rosters ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTeams.map(team => {
            const teamPlayers = (rosters as RostersByTeam)[team.code] || [];
            return (
              <TeamDepthChart
                key={team.code}
                team={team.code}
                players={teamPlayers}
              />
            );
          })}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <div className="space-y-4">
            <div className="text-muted-foreground">
              No roster data available. Click "Sync Rosters" to load team depth charts.
            </div>
            <Button onClick={() => syncRosters()} disabled={isSyncing} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing Rosters...' : 'Load Roster Data'}
            </Button>
          </div>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="intelligence" className="space-y-6">
          {/* Intelligence Filters */}
          <div className="flex flex-wrap gap-2">
            {impactFilters.map(impact => (
              <Button
                key={impact}
                onClick={() => setSelectedImpact(impact)}
                variant={selectedImpact === impact ? "default" : "outline"}
                size="sm"
                className="capitalize"
              >
                {impact}
              </Button>
            ))}
          </div>

          {/* Intelligence Feed */}
          {intel ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Intelligence Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{intel.summary?.high_signal || 0}</div>
                      <div className="text-sm text-muted-foreground">High Signal</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{intel.summary?.medium_signal || 0}</div>
                      <div className="text-sm text-muted-foreground">Medium Signal</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">{intel.summary?.low_signal || 0}</div>
                      <div className="text-sm text-muted-foreground">Low Signal</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{intel.summary?.total_intel || 0}</div>
                      <div className="text-sm text-muted-foreground">Total Intel</div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Source: {intel.source} • Date: {intel.date}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredIntel.map((entry: IntelEntry, index: number) => (
                  <IntelCard key={index} entry={entry} />
                ))}
              </div>

              {filteredIntel.length === 0 && (
                <Card className="p-8 text-center">
                  <div className="text-muted-foreground">
                    No intelligence entries found for the selected impact filter.
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <div className="space-y-4">
                <div className="text-muted-foreground">
                  Intelligence feed will be activated during the regular season for real-time player updates, injury reports, and roster moves.
                </div>
                <div className="text-sm text-muted-foreground">
                  This system will aggregate trusted sources for actionable fantasy intelligence.
                </div>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}