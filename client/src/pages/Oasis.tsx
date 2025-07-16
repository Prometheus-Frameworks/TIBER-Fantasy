import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { BarChart3, Target, TrendingUp, Users } from "lucide-react";
import { useState } from "react";

interface TeamData {
  name: string;
  city: string;
  oasisScore: number;
  color: string;
}

const nflTeams: TeamData[] = [
  { name: "Bills", city: "Buffalo", oasisScore: 92, color: "#00338D" },
  { name: "Dolphins", city: "Miami", oasisScore: 89, color: "#008E97" },
  { name: "Chiefs", city: "Kansas City", oasisScore: 87, color: "#E31837" },
  { name: "Ravens", city: "Baltimore", oasisScore: 85, color: "#241773" },
  { name: "Cowboys", city: "Dallas", oasisScore: 83, color: "#041E42" },
  { name: "49ers", city: "San Francisco", oasisScore: 82, color: "#AA0000" },
  { name: "Lions", city: "Detroit", oasisScore: 80, color: "#0076B6" },
  { name: "Bengals", city: "Cincinnati", oasisScore: 78, color: "#FB4F14" },
  { name: "Eagles", city: "Philadelphia", oasisScore: 77, color: "#004C54" },
  { name: "Chargers", city: "Los Angeles", oasisScore: 75, color: "#0080C6" },
  { name: "Packers", city: "Green Bay", oasisScore: 74, color: "#203731" },
  { name: "Texans", city: "Houston", oasisScore: 72, color: "#03202F" },
  { name: "Rams", city: "Los Angeles", oasisScore: 71, color: "#003594" },
  { name: "Vikings", city: "Minnesota", oasisScore: 69, color: "#4F2683" },
  { name: "Seahawks", city: "Seattle", oasisScore: 68, color: "#002244" },
  { name: "Saints", city: "New Orleans", oasisScore: 67, color: "#D3BC8D" },
  { name: "Steelers", city: "Pittsburgh", oasisScore: 66, color: "#FFB612" },
  { name: "Falcons", city: "Atlanta", oasisScore: 65, color: "#A71930" },
  { name: "Jets", city: "New York", oasisScore: 64, color: "#125740" },
  { name: "Buccaneers", city: "Tampa Bay", oasisScore: 63, color: "#D50A0A" },
  { name: "Colts", city: "Indianapolis", oasisScore: 62, color: "#002C5F" },
  { name: "Cardinals", city: "Arizona", oasisScore: 61, color: "#97233F" },
  { name: "Browns", city: "Cleveland", oasisScore: 60, color: "#311D00" },
  { name: "Jaguars", city: "Jacksonville", oasisScore: 59, color: "#006778" },
  { name: "Broncos", city: "Denver", oasisScore: 58, color: "#FB4F14" },
  { name: "Commanders", city: "Washington", oasisScore: 57, color: "#5A1414" },
  { name: "Raiders", city: "Las Vegas", oasisScore: 56, color: "#000000" },
  { name: "Panthers", city: "Carolina", oasisScore: 55, color: "#0085CA" },
  { name: "Titans", city: "Tennessee", oasisScore: 54, color: "#0C2340" },
  { name: "Patriots", city: "New England", oasisScore: 53, color: "#002244" },
  { name: "Bears", city: "Chicago", oasisScore: 52, color: "#0B162A" },
  { name: "Giants", city: "New York", oasisScore: 51, color: "#0B2265" }
];

export default function Oasis() {
  const [selectedTeam, setSelectedTeam] = useState<TeamData | null>(null);

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getBarWidth = (score: number) => {
    return `${(score / 100) * 100}%`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            OASIS: Team Environments Decoded
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Offensive Architecture Scoring & Insight System - Revealing the hidden patterns that drive fantasy production
          </p>
        </div>

        {!selectedTeam ? (
          <>
            {/* Team Rankings Chart */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-teal-600" />
                  NFL Team Environment Rankings
                </CardTitle>
                <CardDescription>
                  Click on any team to explore their offensive architecture insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {nflTeams.map((team, index) => (
                    <div
                      key={team.name}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-teal-300 cursor-pointer transition-colors"
                      onClick={() => setSelectedTeam(team)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500 w-8">
                          #{index + 1}
                        </span>
                        <div>
                          <div className="font-semibold text-gray-900">
                            {team.city} {team.name}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-teal-500 h-2 rounded-full transition-all"
                            style={{ width: getBarWidth(team.oasisScore) }}
                          ></div>
                        </div>
                        <span className={`font-bold text-lg w-12 ${getScoreColor(team.oasisScore)}`}>
                          {team.oasisScore}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          /* Team Insight Page */
          <div className="space-y-6">
            {/* Back Button */}
            <Button 
              variant="outline" 
              onClick={() => setSelectedTeam(null)}
              className="mb-4"
            >
              ← Back to Rankings
            </Button>

            {/* Team Header */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl" style={{ color: selectedTeam.color }}>
                  {selectedTeam.city} {selectedTeam.name}
                </CardTitle>
                <CardDescription>
                  OASIS Score: <span className={`font-bold ${getScoreColor(selectedTeam.oasisScore)}`}>
                    {selectedTeam.oasisScore}/100
                  </span>
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Offense Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-teal-600" />
                  Offense Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">12.4</div>
                    <div className="text-sm text-gray-600">Red zone plays/game</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">0.18</div>
                    <div className="text-sm text-gray-600">EPA per play</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">62/38</div>
                    <div className="text-sm text-gray-600">Pass/run rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">26.8</div>
                    <div className="text-sm text-gray-600">Pace of play</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">B+</div>
                    <div className="text-sm text-gray-600">OL strength</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Positional Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-teal-600" />
                  Positional Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Target Distribution</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>WR1 Target Share</span>
                        <span className="font-semibold">28.5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>WR2 Target Share</span>
                        <span className="font-semibold">18.2%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>TE Target Share</span>
                        <span className="font-semibold">15.7%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>RB Target Share</span>
                        <span className="font-semibold">12.3%</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Key Roles</h4>
                    <div className="space-y-2 text-sm">
                      <div className="bg-teal-50 p-2 rounded">
                        <span className="font-semibold">Slot WR:</span> High-volume target funnel
                      </div>
                      <div className="bg-blue-50 p-2 rounded">
                        <span className="font-semibold">Red Zone TE:</span> Primary scoring threat
                      </div>
                      <div className="bg-green-50 p-2 rounded">
                        <span className="font-semibold">Pass-catching RB:</span> Checkdown specialist
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Usage Funnel & Fantasy Takeaway */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-teal-600" />
                    Usage Funnel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-teal-600 mb-2">
                      Wide Offense
                    </div>
                    <p className="text-sm text-gray-600">
                      Distributes targets across multiple receivers, creating opportunities for deeper bench players
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Fantasy Takeaway</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-teal-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-teal-800">
                      Best team for slot WR production and TE touchdown upside. 
                      RB receiving floor makes this backfield valuable in PPR formats.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Philosophy Footer */}
        <div className="mt-16 text-center">
          <div className="max-w-2xl mx-auto bg-gray-50 p-6 rounded-lg">
            <p className="text-gray-700 font-medium italic">
              "Uncertainty as insight. We don't predict success – we show the patterns that fuel it."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}