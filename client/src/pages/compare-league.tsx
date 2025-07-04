import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { Users, Trophy, TrendingUp, TrendingDown, Search, Crown, Target, RefreshCw, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import MobileNav from "@/components/mobile-nav";

interface TeamValue {
  teamId: string;
  teamName: string;
  owner: string;
  totalValue: number;
  positionValues: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
  };
  rank: number;
  powerScore: number;
  trend: 'up' | 'down' | 'stable';
  roster?: Player[];
}

interface Player {
  playerId: number;
  playerName: string;
  position: string;
  dynastyValue: number;
  dynastyTier: string;
  isStarter: boolean;
  adp: number;
  ecr: number;
  ourRank: number;
  ppg: number;
}

interface LeagueComparison {
  teams: TeamValue[];
  leagueAverages: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
  };
  topTeams: TeamValue[];
  bottomTeams: TeamValue[];
}

interface LeagueComparisonData {
  leagueId: string;
  leagueName: string;
  leagueSettings: {
    type: string;
    scoring: string;
    teamCount: number;
    positions: string[];
  };
  teams: TeamValue[];
  leagueAverages: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
  };
  lastUpdated: Date;
}

const POSITION_COLORS = {
  QB: "#8b5cf6", // Purple
  RB: "#10b981", // Green  
  WR: "#3b82f6", // Blue
  TE: "#f59e0b"  // Orange
};

export default function CompareLeague() {
  const [leagueData, setLeagueData] = useState<LeagueComparisonData | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [platform, setPlatform] = useState("sleeper");
  const [isSetup, setIsSetup] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamValue | null>(null);
  const [showRosterModal, setShowRosterModal] = useState(false);
  
  // Fetch league comparison data
  const { data: comparison, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/league-comparison', leagueId],
    enabled: false, // Only fetch when user submits
    retry: false
  });

  // Load league comparison
  const loadLeagueMutation = useMutation({
    mutationFn: async ({ leagueId, platform }: { leagueId: string; platform: string }) => {
      const response = await fetch(`/api/league-comparison/${leagueId}?platform=${platform}`);
      if (!response.ok) {
        throw new Error(`Failed to load league: ${response.statusText}`);
      }
      return await response.json();
    },
    onSuccess: (data: LeagueComparisonData) => {
      setLeagueData(data);
      setIsSetup(true);
    }
  });

  const handleLoadLeague = () => {
    if (!leagueId.trim()) return;
    loadLeagueMutation.mutate({ leagueId: leagueId.trim(), platform });
  };

  const handleTeamClick = async (team: TeamValue) => {
    if (!leagueData?.leagueId) {
      console.error('No league ID available - cannot fetch roster');
      return;
    }
    
    setSelectedTeam({ ...team, roster: [] }); // Start with empty roster
    setShowRosterModal(true);
    
    // Fetch authentic roster data from Sleeper API
    try {
      console.log(`Fetching roster for team ${team.teamId} from league ${leagueData.leagueId}...`);
      
      const response = await fetch(`/api/league/team/${team.teamId}/roster?leagueId=${leagueData.leagueId}`);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      
      const rosterData = await response.json();
      
      if (!rosterData.players || rosterData.players.length === 0) {
        console.warn('No players found in roster data');
        return;
      }
      
      console.log(`Successfully loaded ${rosterData.players.length} players for ${team.teamName}`);
      
      setSelectedTeam({
        ...team,
        roster: rosterData.players
      });
      
    } catch (error) {
      console.error('Failed to fetch Sleeper roster data:', error);
      // No fallback - only show authentic data or nothing
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Elite': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Premium': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Strong': return 'bg-green-100 text-green-800 border-green-300';
      case 'Solid': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Depth': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Process team data for charts
  const chartData = leagueData?.teams
    ?.filter(team => 
      searchTerm === "" || 
      team.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.owner.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => b.totalValue - a.totalValue)
    .map((team, index) => ({
      teamId: team.teamId, // Include the actual Sleeper roster ID
      name: team.teamName.length > 12 ? `${team.teamName.substring(0, 12)}...` : team.teamName,
      fullName: team.teamName,
      owner: team.owner,
      QB: Math.round(team.positionValues.QB),
      RB: Math.round(team.positionValues.RB), 
      WR: Math.round(team.positionValues.WR),
      TE: Math.round(team.positionValues.TE),
      total: Math.round(team.totalValue),
      rank: index + 1,
      trend: team.trend
    })) || [];

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <div className="w-4 h-4" />;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank <= 3) return "bg-yellow-100 text-yellow-800";
    if (rank <= 8) return "bg-green-100 text-green-800";
    if (rank <= 12) return "bg-blue-100 text-blue-800";
    return "bg-gray-100 text-gray-800";
  };

  // Show setup interface if no league loaded
  if (!isSetup || !leagueData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-4 md:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Compare League</h1>
              <p className="text-sm text-gray-600">Connect your fantasy league for dynasty analysis</p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Connect Your League
              </CardTitle>
              <CardDescription>
                Enter your league information to analyze all teams and their dynasty values
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form noValidate onSubmit={(e) => { e.preventDefault(); handleLoadLeague(); }}>
                {/* Platform Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Fantasy Platform</label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sleeper">Sleeper</SelectItem>
                      <SelectItem value="espn">ESPN (requires login)</SelectItem>
                      <SelectItem value="yahoo">Yahoo (requires login)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* League ID Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    League ID
                    {platform === 'sleeper' && (
                      <span className="text-xs text-gray-500 ml-1">(found in URL)</span>
                    )}
                  </label>
                  <Input
                    type="text"
                    placeholder={platform === 'sleeper' ? 'e.g., 1197631162923614208' : 'Enter league ID'}
                    value={leagueId}
                    onChange={(e) => setLeagueId(e.target.value)}
                    className="font-mono"
                    autoComplete="off"
                    required={false}
                  />
                  {platform === 'sleeper' && (
                    <p className="text-xs text-gray-500">
                      Find your League ID in the Sleeper URL: sleeper.app/leagues/<strong>1197631162923614208</strong>
                    </p>
                  )}
                </div>

              {/* Error Display */}
              {loadLeagueMutation.error && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {loadLeagueMutation.error.message || 'Failed to load league data'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Load Button */}
              <Button
                onClick={handleLoadLeague}
                disabled={!leagueId.trim() || loadLeagueMutation.isPending}
                className="w-full"
              >
                {loadLeagueMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Loading League...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Load League
                  </>
                )}
              </Button>
              </form>

              {/* Help Text */}
              <div className="mt-6 space-y-3 text-sm text-gray-600">
                <h4 className="font-medium text-gray-900">Supported Platforms:</h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <strong>Sleeper:</strong> Works instantly with League ID
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                    <div>
                      <strong>ESPN/Yahoo:</strong> Requires authentication credentials
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <MobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Compare League</h1>
              <p className="text-sm text-gray-600">
                Dynasty team value analysis • {leagueData?.leagueSettings?.teamCount || leagueData?.teams?.length || 0} teams
                {leagueData?.leagueSettings?.scoring && ` • ${leagueData.leagueSettings.scoring}`}
                {leagueData?.leagueSettings?.positions?.includes('SUPER_FLEX') && ' • Superflex'}
              </p>
            </div>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <Users className="w-3 h-3 mr-1" />
              {leagueData?.leagueName || 'Dynasty League'}
            </Badge>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search teams or owners..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant={selectedPosition === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPosition("all")}
                className="text-xs"
              >
                All Positions
              </Button>
              {Object.keys(POSITION_COLORS).map(pos => (
                <Button
                  key={pos}
                  variant={selectedPosition === pos ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPosition(pos)}
                  className="text-xs"
                  style={{
                    backgroundColor: selectedPosition === pos ? POSITION_COLORS[pos as keyof typeof POSITION_COLORS] : undefined
                  }}
                >
                  {pos}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        {/* League Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Trophy className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
              <div className="text-lg font-bold text-gray-900">
                {chartData[0]?.fullName || "Dynasty Dominators"}
              </div>
              <div className="text-xs text-gray-600">League Leader</div>
              <div className="text-sm font-medium text-green-600 mt-1">
                {chartData[0]?.total.toLocaleString()} pts
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Target className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <div className="text-lg font-bold text-gray-900">
                {Math.round(leagueData.leagueAverages.QB + leagueData.leagueAverages.RB + leagueData.leagueAverages.WR + leagueData.leagueAverages.TE)}
              </div>
              <div className="text-xs text-gray-600">League Average</div>
              <div className="text-sm font-medium text-gray-600 mt-1">Dynasty Points</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <div className="text-lg font-bold text-gray-900">
                {leagueData.teams.filter(t => t.trend === 'up').length}
              </div>
              <div className="text-xs text-gray-600">Teams Rising</div>
              <div className="text-sm font-medium text-green-600 mt-1">Trending Up</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Crown className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <div className="text-lg font-bold text-gray-900">
                {chartData[chartData.length - 1]?.total.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">Last Place</div>
              <div className="text-sm font-medium text-red-600 mt-1">
                {chartData[chartData.length - 1]?.fullName}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Value Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Team Dynasty Values
              {selectedPosition !== "all" && (
                <Badge 
                  variant="outline" 
                  style={{ 
                    backgroundColor: `${POSITION_COLORS[selectedPosition as keyof typeof POSITION_COLORS]}20`,
                    borderColor: POSITION_COLORS[selectedPosition as keyof typeof POSITION_COLORS],
                    color: POSITION_COLORS[selectedPosition as keyof typeof POSITION_COLORS]
                  }}
                >
                  {selectedPosition} Position Focus
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Dynasty point values by position • Higher bars = stronger teams
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] md:h-[500px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={10}
                    interval={0}
                  />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 rounded-lg shadow-lg border">
                            <p className="font-semibold text-gray-900">{data.fullName}</p>
                            <p className="text-sm text-gray-600 mb-2">Owner: {data.owner}</p>
                            <p className="text-sm font-medium">Rank: #{data.rank}</p>
                            <div className="mt-2 space-y-1">
                              <p className="text-sm"><span className="text-purple-600">QB:</span> {data.QB}</p>
                              <p className="text-sm"><span className="text-green-600">RB:</span> {data.RB}</p>
                              <p className="text-sm"><span className="text-blue-600">WR:</span> {data.WR}</p>
                              <p className="text-sm"><span className="text-orange-600">TE:</span> {data.TE}</p>
                              <hr className="my-1" />
                              <p className="text-sm font-semibold">Total: {data.total}</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {selectedPosition === "all" ? (
                    <>
                      <Bar dataKey="QB" stackId="a" fill={POSITION_COLORS.QB} />
                      <Bar dataKey="RB" stackId="a" fill={POSITION_COLORS.RB} />
                      <Bar dataKey="WR" stackId="a" fill={POSITION_COLORS.WR} />
                      <Bar dataKey="TE" stackId="a" fill={POSITION_COLORS.TE} />
                    </>
                  ) : (
                    <Bar 
                      dataKey={selectedPosition} 
                      fill={POSITION_COLORS[selectedPosition as keyof typeof POSITION_COLORS]} 
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Team Rankings List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-600" />
              Dynasty Power Rankings
            </CardTitle>
            <CardDescription>
              Most to least valuable teams • Based on total dynasty points
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {chartData.map((team, index) => {
                const teamValue: TeamValue = {
                  teamId: team.teamId, // Use the authentic Sleeper roster ID
                  teamName: team.fullName,
                  owner: team.owner,
                  totalValue: team.total,
                  positionValues: {
                    QB: team.QB || 0,
                    RB: team.RB || 0,
                    WR: team.WR || 0,
                    TE: team.TE || 0
                  },
                  rank: index + 1,
                  powerScore: team.total,
                  trend: team.trend || 'stable'
                };
                
                return (
                  <div
                    key={team.fullName}
                    onClick={() => handleTeamClick(teamValue)}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <Badge className={`w-8 h-6 flex items-center justify-center text-xs font-bold ${getRankBadgeColor(index + 1)}`}>
                        #{index + 1}
                      </Badge>
                      <div>
                        <div className="font-semibold text-gray-900 group-hover:text-blue-900">{team.fullName}</div>
                        <div className="text-sm text-gray-600">Owner: {team.owner}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold text-lg text-gray-900 group-hover:text-blue-900">
                          {team.total.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-600">dynasty pts</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {getTrendIcon(team.trend)}
                        <div className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                          View Roster →
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Position Averages */}
        <Card>
          <CardHeader>
            <CardTitle>League Position Averages</CardTitle>
            <CardDescription>
              Average dynasty points per position across all teams
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(leagueData.leagueAverages).map(([position, average]) => (
                <div key={position} className="text-center p-4 rounded-lg border">
                  <div 
                    className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: POSITION_COLORS[position as keyof typeof POSITION_COLORS] }}
                  >
                    {position}
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{Math.round(average)}</div>
                  <div className="text-sm text-gray-600">avg points</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full-Page Team Roster View */}
      {showRosterModal && selectedTeam && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-4 md:px-6 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowRosterModal(false)}
                  className="flex items-center gap-2"
                >
                  ← Back to Rankings
                </Button>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-yellow-600" />
                    {selectedTeam.teamName} Roster
                  </h1>
                  <p className="text-sm text-gray-600">
                    Dynasty values and player breakdown • Owner: {selectedTeam.owner}
                  </p>
                </div>
              </div>
              <Badge className={`px-3 py-1 ${getRankBadgeColor(selectedTeam.rank)}`}>
                #{selectedTeam.rank} Overall
              </Badge>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="space-y-6">
              {/* Team Summary */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-lg font-bold text-gray-900">#{selectedTeam.rank}</div>
                    <div className="text-xs text-gray-600">League Rank</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-lg font-bold text-gray-900">
                      {Math.round(selectedTeam.totalValue).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-600">Total Value</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-lg font-bold text-purple-600">{Math.round(selectedTeam.positionValues.QB)}</div>
                    <div className="text-xs text-gray-600">QB Value</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-lg font-bold text-green-600">{Math.round(selectedTeam.positionValues.RB)}</div>
                    <div className="text-xs text-gray-600">RB Value</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-lg font-bold text-blue-600">{Math.round(selectedTeam.positionValues.WR)}</div>
                    <div className="text-xs text-gray-600">WR Value</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-lg font-bold text-orange-600">{Math.round(selectedTeam.positionValues.TE)}</div>
                    <div className="text-xs text-gray-600">TE Value</div>
                  </CardContent>
                </Card>
              </div>

              {/* Roster by Position - Expandable Sections */}
              {selectedTeam.roster && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Team Roster</h3>
                  
                  {Object.keys(POSITION_COLORS).map(position => {
                    const positionPlayers = selectedTeam.roster?.filter(player => player.position === position) || [];
                    const positionValue = Math.round(selectedTeam.positionValues[position as keyof typeof selectedTeam.positionValues] || 0);
                    const isExpanded = selectedPosition === position;
                    
                    if (positionPlayers.length === 0) return null;
                    
                    return (
                      <Card key={position} className="overflow-hidden">
                        <CardContent className="p-0">
                          {/* Position Header - Clickable */}
                          <div 
                            onClick={() => setSelectedPosition(isExpanded ? "all" : position)}
                            className="p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b"
                            style={{
                              backgroundColor: isExpanded ? `${POSITION_COLORS[position as keyof typeof POSITION_COLORS]}10` : undefined
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                                  style={{ backgroundColor: POSITION_COLORS[position as keyof typeof POSITION_COLORS] }}
                                >
                                  {position}
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900">{position} ({positionPlayers.length})</div>
                                  <div className="text-sm text-gray-600">Total Value: {positionValue}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <div className="font-bold text-lg" style={{ color: POSITION_COLORS[position as keyof typeof POSITION_COLORS] }}>
                                    {positionValue}
                                  </div>
                                </div>
                                <div className="text-gray-400">
                                  {isExpanded ? '▼' : '▶'}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Position Players - Expanded */}
                          {isExpanded && (
                            <div className="p-4 space-y-3">
                              {positionPlayers
                                .sort((a, b) => (b.dynastyValue || 0) - (a.dynastyValue || 0))
                                .map((player) => (
                                  <div key={player.playerId} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-4">
                                        {/* Player Position Circle */}
                                        <div 
                                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
                                          style={{ backgroundColor: POSITION_COLORS[player.position as keyof typeof POSITION_COLORS] || '#6B7280' }}
                                        >
                                          {player.position}
                                        </div>
                                        
                                        <div className="flex-1">
                                          <div className="flex items-center gap-3 mb-2">
                                            <div className="font-semibold text-gray-900 text-lg">
                                              {player.playerName}
                                            </div>
                                            <Badge 
                                              className={`text-xs px-2 py-1 ${getTierColor(player.dynastyTier || 'Bench')}`}
                                            >
                                              {player.dynastyTier || 'Bench'}
                                            </Badge>
                                            {player.isStarter && (
                                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Starter
                                              </span>
                                            )}
                                          </div>
                                          
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                            <div className="bg-blue-50 rounded-lg p-2 text-center">
                                              <div className="text-xs text-gray-600">ADP</div>
                                              <div className="font-medium text-blue-700">
                                                {player.adp === 999 ? 'Undrafted' : `#${player.adp}`}
                                              </div>
                                            </div>
                                            <div className="bg-purple-50 rounded-lg p-2 text-center">
                                              <div className="text-xs text-gray-600">ECR</div>
                                              <div className="font-medium text-purple-700">
                                                {player.ecr === 999 ? 'Unranked' : `#${player.ecr}`}
                                              </div>
                                            </div>
                                            <div className="bg-orange-50 rounded-lg p-2 text-center">
                                              <div className="text-xs text-gray-600">Our Rank</div>
                                              <div className="font-medium text-orange-700">
                                                {player.ourRank === 999 ? 'Unranked' : `#${player.ourRank}`}
                                              </div>
                                            </div>
                                            <div className="bg-green-50 rounded-lg p-2 text-center">
                                              <div className="text-xs text-gray-600">PPG</div>
                                              <div className="font-medium text-green-700">
                                                {player.ppg.toFixed(1)}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="text-right ml-4">
                                        <div className="text-2xl font-bold text-gray-900">{Math.round(player.dynastyValue || 0)}</div>
                                        <div className="text-xs text-gray-500 uppercase tracking-wide">Dynasty Value</div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
              
              {!selectedTeam.roster && (
                <div className="text-center py-8 text-gray-500">
                  Loading roster data...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <MobileNav />
    </div>
  );
}