import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, TrendingUp, Users, Target, Brain } from "lucide-react";

interface VORPPlayer {
  player_name: string;
  position: string;
  team: string;
  vorp_score: number;
  rank: number;
  tier: string;
  fantasy_points_over_replacement: number;
}

interface IntelEntry {
  date: string;
  source: string;
  type: string;
  team: string;
  details: {
    player_name?: string;
    position?: string;
    dynasty_impact?: string;
    note: string;
  };
}

interface UsageLeader {
  player_name: string;
  position: string;
  team: string;
  usage_score: number;
  target_share?: number;
  snap_percentage?: number;
}

export default function Analytics() {
  const { data: vorpData, isLoading: vorpLoading } = useQuery({
    queryKey: ['/api/vorp-rankings'],
  });

  const { data: intelData, isLoading: intelLoading } = useQuery({
    queryKey: ['/api/intel/current'],
  });

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['/api/usage-leaders'],
  });

  const { data: rookieData, isLoading: rookieLoading } = useQuery({
    queryKey: ['/api/rookies/evaluation-summary'],
  });

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'major_positive': return 'bg-green-500 text-white';
      case 'positive': return 'bg-green-100 text-green-800';
      case 'concerning': return 'bg-yellow-100 text-yellow-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <Brain className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Analytics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Advanced player insights and dynasty intelligence
          </p>
        </div>
      </div>

      <Tabs defaultValue="vorp" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="vorp">VORP Rankings</TabsTrigger>
          <TabsTrigger value="intel">Intelligence Feed</TabsTrigger>
          <TabsTrigger value="usage">Usage Leaders</TabsTrigger>
          <TabsTrigger value="rookies">Rookie Eval</TabsTrigger>
        </TabsList>

        <TabsContent value="vorp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Value Over Replacement Player (VORP)</span>
              </CardTitle>
              <CardDescription>
                Dynasty-weighted player values with age penalties and positional scarcity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {vorpLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {(vorpData as any)?.players?.slice(0, 20)?.map((player: VORPPlayer, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Badge className={getTierColor(player.tier)}>
                          {player.tier}
                        </Badge>
                        <div>
                          <div className="font-medium">{player.player_name}</div>
                          <div className="text-sm text-gray-500">
                            {player.position} • {player.team}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{player.vorp_score?.toFixed(1)}</div>
                        <div className="text-sm text-gray-500">VORP</div>
                      </div>
                    </div>
                  )) || (
                    <div className="text-center py-8 text-gray-500">
                      No VORP data available
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>Intelligence Feed</span>
              </CardTitle>
              <CardDescription>
                Real-time roster shifts and dynasty impact analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {intelLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {(intelData as any)?.data?.length > 0 ? (intelData as any).data.map((entry: IntelEntry, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{entry.team}</Badge>
                          <Badge className={getImpactColor(entry.details.dynasty_impact || '')}>
                            {entry.details.dynasty_impact?.replace('_', ' ')}
                          </Badge>
                        </div>
                        <span className="text-sm text-gray-500">{entry.date}</span>
                      </div>
                      <div className="font-medium mb-1">
                        {entry.details.player_name} ({entry.details.position})
                      </div>
                      <div className="text-sm text-gray-600">
                        {entry.details.note}
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-gray-500">
                      {(intelData as any)?.message || "No current intelligence - ready for season updates"}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Usage Leaders</span>
              </CardTitle>
              <CardDescription>
                Target share and snap percentage leaders by position
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usageLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {(usageData as any)?.leaders?.slice(0, 15)?.map((player: UsageLeader, idx: number) => (
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
                  )) || (
                    <div className="text-center py-8 text-gray-500">
                      No usage data available
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rookies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ArrowUp className="h-5 w-5" />
                <span>Rookie Evaluation</span>
              </CardTitle>
              <CardDescription>
                2025 rookie class analysis with dynasty flags and trait detection
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rookieLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {(rookieData as any)?.rookies?.slice(0, 10)?.map((rookie: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Badge className={getTierColor(rookie.tier)}>
                          {rookie.tier}
                        </Badge>
                        <div>
                          <div className="font-medium">{rookie.name}</div>
                          <div className="text-sm text-gray-500">
                            {rookie.position} • {rookie.college}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{rookie.dynasty_score?.toFixed(1)}</div>
                        <div className="text-sm text-gray-500">Dynasty Score</div>
                      </div>
                    </div>
                  )) || (
                    <div className="text-center py-8 text-gray-500">
                      No rookie evaluation data available
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}