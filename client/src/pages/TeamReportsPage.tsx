import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Medal, Award, TrendingUp, TrendingDown, Shield, Target } from 'lucide-react';
import { Link } from 'wouter';

interface TeamStat {
  rank: number;
  team: string;
  gamesPlayed: number;
  totalYards: number;
  passYards: number;
  rushYards: number;
  totalTDs: number;
  passTDs: number;
  rushTDs: number;
  recTDs: number;
  pointsScored: number;
  yardsPerGame: number;
  pointsPerGame: number;
  passingYPG: number;
  rushingYPG: number;
}

interface TeamReportsData {
  season: number;
  weekRange: string;
  offensive: TeamStat[];
  defensive: TeamStat[];
  totalTeams: number;
}

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-400" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
  if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
  return <span className="text-gray-400 font-mono">{rank}</span>;
};

const getRankColor = (rank: number) => {
  if (rank <= 5) return 'text-green-400';
  if (rank <= 10) return 'text-blue-400';
  if (rank <= 20) return 'text-gray-300';
  return 'text-gray-500';
};

export default function TeamReportsPage() {
  const [viewType, setViewType] = useState<'offensive' | 'defensive'>('offensive');

  const { data, isLoading } = useQuery<{ success: boolean; data: TeamReportsData }>({
    queryKey: ['/api/team-reports?season=2025&week=1-7'],
  });

  const teams = data?.data?.[viewType] || [];
  const weekRange = data?.data?.weekRange || '1-7';
  const season = data?.data?.season || 2025;

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#141824] border-b border-gray-800 backdrop-blur-sm bg-opacity-90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-white">
                T
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                TIBER FANTASY
              </span>
            </Link>
            <Link href="/">
              <Button variant="outline" size="sm" data-testid="button-back-home">
                ← Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-100 mb-2" data-testid="header-team-reports">
              Weekly Team Reports
            </h1>
            <p className="text-gray-400">
              NFL team rankings by offensive and defensive performance • {season} Weeks {weekRange}
            </p>
          </div>

          {/* Toggle Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => setViewType('offensive')}
              variant={viewType === 'offensive' ? 'default' : 'outline'}
              className={viewType === 'offensive' ? 'bg-green-600 hover:bg-green-700' : ''}
              data-testid="button-view-offensive"
            >
              <Target className="w-4 h-4 mr-2" />
              Offensive Rankings
            </Button>
            <Button
              onClick={() => setViewType('defensive')}
              variant={viewType === 'defensive' ? 'default' : 'outline'}
              className={viewType === 'defensive' ? 'bg-blue-600 hover:bg-blue-700' : ''}
              data-testid="button-view-defensive"
            >
              <Shield className="w-4 h-4 mr-2" />
              Defensive Rankings
            </Button>
          </div>

          {/* Rankings Card */}
          <Card className="bg-[#141824] border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {viewType === 'offensive' ? (
                  <>
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <span>Offensive Rankings</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-5 h-5 text-blue-400" />
                    <span>Defensive Rankings</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(10)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full bg-gray-800" />
                  ))}
                </div>
              ) : teams.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>No team data available</p>
                </div>
              ) : (
                <div className="overflow-x-auto" data-testid="table-team-reports">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800 text-left">
                        <th className="pb-3 font-semibold text-gray-400 w-16">Rank</th>
                        <th className="pb-3 font-semibold text-gray-400">Team</th>
                        <th className="pb-3 font-semibold text-gray-400 text-right">YPG</th>
                        <th className="pb-3 font-semibold text-gray-400 text-right hidden md:table-cell">Pass YPG</th>
                        <th className="pb-3 font-semibold text-gray-400 text-right hidden md:table-cell">Rush YPG</th>
                        <th className="pb-3 font-semibold text-gray-400 text-right hidden lg:table-cell">Total TDs</th>
                        <th className="pb-3 font-semibold text-gray-400 text-right hidden lg:table-cell">PPG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((team, index) => (
                        <tr
                          key={team.team}
                          className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                          data-testid={`row-team-${index}`}
                        >
                          <td className="py-4">
                            <div className="flex items-center justify-center w-10">
                              {getRankIcon(team.rank)}
                            </div>
                          </td>
                          <td className="py-4">
                            <div className="font-semibold text-gray-100" data-testid={`text-team-name-${index}`}>
                              {team.team}
                            </div>
                            <div className="text-xs text-gray-500">{team.gamesPlayed} games</div>
                          </td>
                          <td className={`py-4 text-right font-mono font-bold ${getRankColor(team.rank)}`}>
                            {team.yardsPerGame.toFixed(1)}
                          </td>
                          <td className="py-4 text-right font-mono text-gray-400 hidden md:table-cell">
                            {team.passingYPG.toFixed(1)}
                          </td>
                          <td className="py-4 text-right font-mono text-gray-400 hidden md:table-cell">
                            {team.rushingYPG.toFixed(1)}
                          </td>
                          <td className="py-4 text-right font-mono text-gray-400 hidden lg:table-cell">
                            {team.totalTDs}
                          </td>
                          <td className="py-4 text-right font-mono text-gray-400 hidden lg:table-cell">
                            {team.pointsPerGame.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer */}
              {!isLoading && teams.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-800 text-center text-sm text-gray-500">
                  {season} Season Weeks {weekRange} • {teams.length} Teams • Data from NFLfastR
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-[#141824] border-gray-800">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-green-400" />
                  About Offensive Rankings
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-400">
                <p>
                  Teams ranked by total yards per game (passing + rushing + receiving).
                  Higher rankings indicate stronger offensive production.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#141824] border-gray-800">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  About Defensive Rankings
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-400">
                <p>
                  Teams ranked by lowest offensive production as a simplified proxy for defensive strength.
                  Note: True defensive rankings would require opponent performance data.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
