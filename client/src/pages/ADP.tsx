import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Target, Users, Calendar, Trophy } from "lucide-react";

interface ADPPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  adp: number;
  adpTrend: number;
  ownership: number;
  ownershipTrend: number;
  draftCount: number;
  rankChange: number;
  isRising: boolean;
  isFalling: boolean;
  sleeperId: string;
}

interface ADPData {
  players: ADPPlayer[];
  lastUpdated: string;
  totalDrafts: number;
  avgDraftSize: number;
}

export default function ADP() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("ALL");
  const [selectedFormat, setSelectedFormat] = useState("superflex");

  const { data: adpData, isLoading } = useQuery<ADPData>({
    queryKey: ['/api/adp/sleeper', selectedFormat],
  });

  const { data: trendingData } = useQuery({
    queryKey: ['/api/adp/trending', selectedFormat],
  });

  const filteredPlayers = adpData?.players?.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = selectedPosition === "ALL" || player.position === selectedPosition;
    return matchesSearch && matchesPosition;
  }) || [];

  const getTrendIcon = (trend: number) => {
    if (trend > 2) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend < -2) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return null;
  };

  const getADPColor = (adp: number) => {
    if (adp <= 12) return "text-yellow-600 font-bold"; // First round
    if (adp <= 24) return "text-orange-600 font-semibold"; // Second round
    if (adp <= 36) return "text-blue-600"; // Third round
    return "text-gray-600";
  };

  const formatADP = (adp: number) => {
    if (adp <= 120) return adp.toFixed(1);
    return Math.round(adp).toString();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="grid gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Average Draft Position (ADP)</h1>
        <p className="text-muted-foreground">
          Real-time dynasty ADP data from {adpData?.totalDrafts?.toLocaleString()} Sleeper drafts
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Trophy className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Drafts</p>
                <p className="text-xl font-bold">{adpData?.totalDrafts?.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Draft Size</p>
                <p className="text-xl font-bold">{adpData?.avgDraftSize} teams</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="text-sm font-medium">{adpData?.lastUpdated}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Format</p>
                <p className="text-sm font-medium capitalize">{selectedFormat}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder="Search players..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="md:w-80"
        />
        
        <Select value={selectedPosition} onValueChange={setSelectedPosition}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Positions</SelectItem>
            <SelectItem value="QB">QB</SelectItem>
            <SelectItem value="RB">RB</SelectItem>
            <SelectItem value="WR">WR</SelectItem>
            <SelectItem value="TE">TE</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedFormat} onValueChange={setSelectedFormat}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="superflex">Superflex</SelectItem>
            <SelectItem value="1qb">1QB</SelectItem>
            <SelectItem value="ppr">PPR</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="adp" className="space-y-4">
        <TabsList>
          <TabsTrigger value="adp">ADP Rankings</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="ownership">Ownership</TabsTrigger>
          <TabsTrigger value="analysis">ADP Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="adp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dynasty ADP Rankings</CardTitle>
              <CardDescription>
                Based on {adpData?.totalDrafts?.toLocaleString()} recent Sleeper dynasty drafts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-muted rounded text-sm font-medium">
                  <div className="col-span-1">ADP</div>
                  <div className="col-span-4">Player</div>
                  <div className="col-span-1">Pos</div>
                  <div className="col-span-1">Team</div>
                  <div className="col-span-2">Trend</div>
                  <div className="col-span-2">Ownership</div>
                  <div className="col-span-1">Drafts</div>
                </div>

                {/* Player Rows */}
                <div className="space-y-1">
                  {filteredPlayers.slice(0, 100).map((player, index) => (
                    <div key={player.id} className="grid grid-cols-12 gap-4 px-4 py-3 rounded hover-lift cursor-pointer">
                      <div className="col-span-1">
                        <span className={getADPColor(player.adp)}>
                          {formatADP(player.adp)}
                        </span>
                      </div>
                      
                      <div className="col-span-4">
                        <div className="font-medium">{player.name}</div>
                        {(player.isRising || player.isFalling) && (
                          <div className="flex items-center space-x-1 mt-1">
                            {player.isRising && (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                Rising
                              </Badge>
                            )}
                            {player.isFalling && (
                              <Badge variant="secondary" className="text-xs bg-red-100 text-red-800">
                                Falling
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="col-span-1">
                        <Badge variant="outline">{player.position}</Badge>
                      </div>
                      
                      <div className="col-span-1 text-sm text-muted-foreground">
                        {player.team}
                      </div>
                      
                      <div className="col-span-2 flex items-center space-x-1">
                        {getTrendIcon(player.adpTrend)}
                        <span className="text-sm">
                          {player.adpTrend > 0 ? '+' : ''}{player.adpTrend.toFixed(1)}
                        </span>
                      </div>
                      
                      <div className="col-span-2">
                        <div className="text-sm">{player.ownership.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">
                          {player.ownershipTrend > 0 ? '+' : ''}{player.ownershipTrend.toFixed(1)}%
                        </div>
                      </div>
                      
                      <div className="col-span-1 text-sm text-muted-foreground">
                        {player.draftCount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trending" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span>Biggest Risers</span>
                </CardTitle>
                <CardDescription>Players moving up in ADP</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredPlayers
                    .filter(p => p.adpTrend > 0)
                    .sort((a, b) => b.adpTrend - a.adpTrend)
                    .slice(0, 10)
                    .map((player) => (
                      <div key={player.id} className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{player.name}</div>
                          <div className="text-sm text-muted-foreground">{player.position} • {player.team}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-green-600 font-medium">+{player.adpTrend.toFixed(1)}</div>
                          <div className="text-sm text-muted-foreground">ADP {formatADP(player.adp)}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <span>Biggest Fallers</span>
                </CardTitle>
                <CardDescription>Players dropping in ADP</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredPlayers
                    .filter(p => p.adpTrend < 0)
                    .sort((a, b) => a.adpTrend - b.adpTrend)
                    .slice(0, 10)
                    .map((player) => (
                      <div key={player.id} className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{player.name}</div>
                          <div className="text-sm text-muted-foreground">{player.position} • {player.team}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-red-600 font-medium">{player.adpTrend.toFixed(1)}</div>
                          <div className="text-sm text-muted-foreground">ADP {formatADP(player.adp)}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ownership" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ownership Trends</CardTitle>
              <CardDescription>
                Percentage of dynasty teams that own each player
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredPlayers
                  .sort((a, b) => b.ownership - a.ownership)
                  .slice(0, 50)
                  .map((player) => (
                    <div key={player.id} className="flex justify-between items-center py-2">
                      <div className="flex-1">
                        <div className="font-medium">{player.name}</div>
                        <div className="text-sm text-muted-foreground">{player.position} • {player.team}</div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${Math.min(player.ownership, 100)}%` }}
                          ></div>
                        </div>
                        <div className="w-16 text-right">
                          <span className="font-medium">{player.ownership.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>ADP Insights</CardTitle>
                <CardDescription>Market trends and analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">Position ADP Averages</h4>
                    <div className="mt-2 space-y-2">
                      {['QB', 'RB', 'WR', 'TE'].map(pos => {
                        const posPlayers = filteredPlayers.filter(p => p.position === pos);
                        const avgADP = posPlayers.length > 0 
                          ? posPlayers.reduce((sum, p) => sum + p.adp, 0) / posPlayers.length 
                          : 0;
                        return (
                          <div key={pos} className="flex justify-between">
                            <span>{pos}</span>
                            <span className="font-medium">{avgADP.toFixed(1)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Draft Frequency</CardTitle>
                <CardDescription>Most drafted players</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredPlayers
                    .sort((a, b) => b.draftCount - a.draftCount)
                    .slice(0, 10)
                    .map((player) => (
                      <div key={player.id} className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{player.name}</div>
                          <div className="text-sm text-muted-foreground">{player.position}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{player.draftCount.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">drafts</div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}