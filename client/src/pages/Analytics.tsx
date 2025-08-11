import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, TrendingUp, Users, Target, Brain } from "lucide-react";
import WRCompass from "@/components/WRCompass";
import HealthWidget from "@/components/HealthWidget";
import PreseasonIntel from "@/components/PreseasonIntel";

const titleCase = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());
const two = (n: number) => Number.isFinite(n) ? n.toFixed(2) : '0.00';

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
    queryKey: ['/api/analytics/vorp'],
    queryFn: () => fetch('/api/analytics/vorp?season=2025&pos=WR').then(r => r.json()),
  });

  const { data: intelData, isLoading: intelLoading } = useQuery({
    queryKey: ['/api/intel/current'],
  });

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['/api/usage-leaders'],
    queryFn: () => fetch('/api/usage-leaders').then(r => r.json()),
  });

  const { data: rookieData, isLoading: rookieLoading } = useQuery({
    queryKey: ['/api/rookies'],
    queryFn: () => fetch('/api/rookies').then(r => r.json()),
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
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
        <HealthWidget />
      </div>

      <Tabs defaultValue="vorp" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="vorp">VORP Rankings</TabsTrigger>
          <TabsTrigger value="compass">WR Compass</TabsTrigger>
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
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Rank</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Team</th>
                        <th className="text-left p-2">Age</th>
                        <th className="text-left p-2">VORP</th>
                        <th className="text-left p-2">Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(vorpData) ? vorpData.slice(0, 20).map((player: any, idx: number) => (
                        <tr key={player.id || idx} className="border-b hover:bg-gray-50">
                          <td className="p-2">{idx + 1}</td>
                          <td className="p-2 font-medium">{player.name}</td>
                          <td className="p-2">{player.team}</td>
                          <td className="p-2">{player.age}</td>
                          <td className="p-2 font-bold">{player.vorp.toFixed(2)}</td>
                          <td className="p-2">
                            <Badge className={getTierColor(player.tier)}>
                              {player.tier}
                            </Badge>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-gray-500">
                            No VORP data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compass" className="space-y-4">
          <WRCompass />
        </TabsContent>

        <TabsContent value="intel" className="space-y-4">
          <PreseasonIntel />
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