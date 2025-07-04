import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Trophy, TrendingUp, TrendingDown, Search, Crown, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
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

// Sample league data with 16 teams for demonstration
const SAMPLE_LEAGUE_DATA: LeagueComparison = {
  teams: [
    {
      teamId: "team1",
      teamName: "Dynasty Dominators",
      owner: "JohnSmith",
      totalValue: 2850,
      positionValues: { QB: 780, RB: 950, WR: 850, TE: 270 },
      rank: 1,
      powerScore: 95,
      trend: 'up'
    },
    {
      teamId: "team2", 
      teamName: "Championship Chasers",
      owner: "SarahJones",
      totalValue: 2720,
      positionValues: { QB: 720, RB: 890, WR: 820, TE: 290 },
      rank: 2,
      powerScore: 89,
      trend: 'stable'
    },
    {
      teamId: "team3",
      teamName: "Future Champions",
      owner: "MikeWilson",
      totalValue: 2680,
      positionValues: { QB: 690, RB: 860, WR: 870, TE: 260 },
      rank: 3,
      powerScore: 87,
      trend: 'up'
    },
    {
      teamId: "team4",
      teamName: "Playoff Pushers",
      owner: "EmilyDavis",
      totalValue: 2590,
      positionValues: { QB: 710, RB: 780, WR: 830, TE: 270 },
      rank: 4,
      powerScore: 82,
      trend: 'down'
    },
    {
      teamId: "team5",
      teamName: "Rising Stars",
      owner: "ChrisBrown",
      totalValue: 2540,
      positionValues: { QB: 650, RB: 820, WR: 790, TE: 280 },
      rank: 5,
      powerScore: 79,
      trend: 'up'
    },
    {
      teamId: "team6",
      teamName: "Contenders",
      owner: "JessicaTaylor",
      totalValue: 2480,
      positionValues: { QB: 680, RB: 750, WR: 780, TE: 270 },
      rank: 6,
      powerScore: 76,
      trend: 'stable'
    },
    {
      teamId: "team7",
      teamName: "Rebuilding Kings",
      owner: "DavidMiller",
      totalValue: 2420,
      positionValues: { QB: 590, RB: 780, WR: 760, TE: 290 },
      rank: 7,
      powerScore: 73,
      trend: 'up'
    },
    {
      teamId: "team8",
      teamName: "Mid-Tier Mayhem",
      owner: "AmandaWilson",
      totalValue: 2380,
      positionValues: { QB: 620, RB: 720, WR: 750, TE: 290 },
      rank: 8,
      powerScore: 70,
      trend: 'stable'
    },
    {
      teamId: "team9",
      teamName: "Sleeper Squad",
      owner: "RyanJohnson",
      totalValue: 2340,
      positionValues: { QB: 580, RB: 710, WR: 760, TE: 290 },
      rank: 9,
      powerScore: 67,
      trend: 'up'
    },
    {
      teamId: "team10",
      teamName: "Wild Cards",
      owner: "LisaAnderson",
      totalValue: 2290,
      positionValues: { QB: 610, RB: 680, WR: 730, TE: 270 },
      rank: 10,
      powerScore: 64,
      trend: 'down'
    },
    {
      teamId: "team11",
      teamName: "Underdog United",
      owner: "KevinThomas",
      totalValue: 2240,
      positionValues: { QB: 550, RB: 690, WR: 720, TE: 280 },
      rank: 11,
      powerScore: 61,
      trend: 'stable'
    },
    {
      teamId: "team12",
      teamName: "Rookie Revolution",
      owner: "NicoleMoore",
      totalValue: 2180,
      positionValues: { QB: 520, RB: 650, WR: 710, TE: 300 },
      rank: 12,
      powerScore: 58,
      trend: 'up'
    },
    {
      teamId: "team13",
      teamName: "Veteran Voyage",
      owner: "BrianClark",
      totalValue: 2120,
      positionValues: { QB: 590, RB: 620, WR: 680, TE: 230 },
      rank: 13,
      powerScore: 55,
      trend: 'down'
    },
    {
      teamId: "team14",
      teamName: "Tank Squad",
      owner: "MeganLewis",
      totalValue: 2050,
      positionValues: { QB: 480, RB: 580, WR: 690, TE: 300 },
      rank: 14,
      powerScore: 52,
      trend: 'stable'
    },
    {
      teamId: "team15",
      teamName: "Rebuilding Block",
      owner: "JasonWalker",
      totalValue: 1980,
      positionValues: { QB: 450, RB: 560, WR: 660, TE: 310 },
      rank: 15,
      powerScore: 48,
      trend: 'down'
    },
    {
      teamId: "team16",
      teamName: "Future Focus",
      owner: "TiffanyHall",
      totalValue: 1890,
      positionValues: { QB: 420, RB: 520, WR: 630, TE: 320 },
      rank: 16,
      powerScore: 43,
      trend: 'up'
    }
  ],
  leagueAverages: {
    QB: 605,
    RB: 720,
    WR: 756,
    TE: 281
  },
  topTeams: [],
  bottomTeams: []
};

const POSITION_COLORS = {
  QB: "#8b5cf6", // Purple
  RB: "#10b981", // Green  
  WR: "#3b82f6", // Blue
  TE: "#f59e0b"  // Orange
};

export default function CompareLeague() {
  const [leagueData, setLeagueData] = useState<LeagueComparison>(SAMPLE_LEAGUE_DATA);
  const [selectedPosition, setSelectedPosition] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  // Process team data for charts
  const chartData = leagueData.teams
    .filter(team => 
      searchTerm === "" || 
      team.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.owner.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => b.totalValue - a.totalValue)
    .map((team, index) => ({
      name: team.teamName.length > 12 ? `${team.teamName.substring(0, 12)}...` : team.teamName,
      fullName: team.teamName,
      owner: team.owner,
      QB: team.positionValues.QB,
      RB: team.positionValues.RB, 
      WR: team.positionValues.WR,
      TE: team.positionValues.TE,
      total: team.totalValue,
      rank: index + 1,
      trend: team.trend
    }));

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Compare League</h1>
              <p className="text-sm text-gray-600">Dynasty team value analysis • 16 teams</p>
            </div>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <Users className="w-3 h-3 mr-1" />
              Morts FF Dynasty
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
              {chartData.map((team, index) => (
                <div
                  key={team.fullName}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={`w-8 h-6 flex items-center justify-center text-xs font-bold ${getRankBadgeColor(index + 1)}`}>
                      #{index + 1}
                    </Badge>
                    <div>
                      <div className="font-semibold text-gray-900">{team.fullName}</div>
                      <div className="text-sm text-gray-600">Owner: {team.owner}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold text-lg text-gray-900">
                        {team.total.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600">dynasty pts</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(team.trend)}
                    </div>
                  </div>
                </div>
              ))}
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

      <MobileNav />
    </div>
  );
}