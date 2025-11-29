import { TrendingUp, Target, Shield, BarChart3, ArrowRight, LineChart, Search, Trophy, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import TiberInsights from '@/components/TiberInsights';

interface OVRResponse {
  success: boolean;
  data: {
    players: Array<{
      player_id: string;
      name: string;
      position: string;
      team: string;
      ovr: number;
      tier: string;
    }>;
  };
}

export default function HomeTab() {
  // Fetch top performers with proper query params
  const { data: topPerformers } = useQuery<OVRResponse>({
    queryKey: ['/api/ovr?format=redraft&limit=3'],
  });

  const stats = [
    {
      label: 'Active Players Tracked',
      value: '11,400+',
      icon: BarChart3,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/10'
    },
    {
      label: 'Weekly Matchup Analysis',
      value: '28',
      icon: Shield,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/10'
    },
    {
      label: 'Real-time Updates',
      value: '< 20ms',
      icon: TrendingUp,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-500/10'
    },
    {
      label: 'Data Sources',
      value: '5+',
      icon: Target,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-500/10'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-pink-600/10 border border-gray-800 p-8 md:p-12">
        <div className="relative z-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Advanced Analytics
            </span>
            <br />
            <span className="text-gray-100">For Dynasty Fantasy Football</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8 max-w-2xl">
            Real-time player rankings, defensive matchup analysis, and strategic insights powered by NFL play-by-play data.
            No paywalls. No limits.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/?tab=rankings">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                data-testid="button-view-rankings"
              >
                View Power Rankings
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/matchups">
              <Button
                size="lg"
                variant="outline"
                className="border-gray-700 hover:bg-gray-800"
                data-testid="button-analyze-matchups"
              >
                Analyze Matchups
              </Button>
            </Link>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl"></div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="bg-[#141824] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors"
            data-testid={`stat-card-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center mb-4`}>
              <stat.icon className={`w-6 h-6 bg-gradient-to-br ${stat.color} text-transparent bg-clip-text`} style={{ WebkitTextFillColor: 'transparent' }} />
            </div>
            <div className="text-2xl font-bold text-gray-100 mb-1">{stat.value}</div>
            <div className="text-sm text-gray-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* TIBER Insights Widget */}
      <TiberInsights />

      {/* Top Performers Section */}
      <div className="bg-[#141824] border border-gray-800 rounded-xl p-6">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-400" />
          Top Performers This Week
        </h3>
        
        {topPerformers?.data?.players && topPerformers.data.players.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topPerformers.data.players.slice(0, 3).map((player, idx) => (
              <div
                key={player.player_id}
                className="bg-[#1e2330] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
                data-testid={`top-performer-${idx + 1}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-gray-100">{player.name}</div>
                    <div className="text-sm text-gray-400">{player.position} • {player.team}</div>
                  </div>
                  <div className="text-2xl font-bold bg-gradient-to-br from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    {player.ovr}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    player.tier === 'Elite' ? 'bg-purple-500/20 text-purple-400' :
                    player.tier === 'Great' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {player.tier}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            Loading top performers...
          </div>
        )}
      </div>

      {/* Research Tools */}
      <div>
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Research Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/leaders">
            <button className="w-full bg-[#141824] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors text-left group" data-testid="home-card-leaders">
              <div className="flex items-center justify-between mb-3">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
              <h4 className="font-semibold text-gray-100 mb-2">Leaders</h4>
              <p className="text-sm text-gray-400">Top performers by position and stat category</p>
            </button>
          </Link>

          <Link href="/analytics">
            <button className="w-full bg-[#141824] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors text-left group" data-testid="home-card-analytics">
              <div className="flex items-center justify-between mb-3">
                <LineChart className="w-6 h-6 text-green-400" />
                <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
              <h4 className="font-semibold text-gray-100 mb-2">Analytics</h4>
              <p className="text-sm text-gray-400">Visualize player stats with interactive charts</p>
            </button>
          </Link>

          <Link href="/compare">
            <button className="w-full bg-[#141824] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors text-left group" data-testid="home-card-compare">
              <div className="flex items-center justify-between mb-3">
                <Search className="w-6 h-6 text-blue-400" />
                <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
              <h4 className="font-semibold text-gray-100 mb-2">Player Compare</h4>
              <p className="text-sm text-gray-400">Side-by-side player comparison with stats and matchups</p>
            </button>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/team-reports">
            <button className="w-full bg-[#141824] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors text-left group" data-testid="home-card-team-reports">
              <div className="flex items-center justify-between mb-3">
                <FileText className="w-6 h-6 text-purple-400" />
                <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
              <h4 className="font-semibold text-gray-100 mb-2">Team Reports</h4>
              <p className="text-sm text-gray-400">Weekly NFL team offensive and defensive rankings</p>
            </button>
          </Link>

          <Link href="?tab=strategy">
            <button className="w-full bg-[#141824] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors text-left group">
              <div className="flex items-center justify-between mb-3">
                <Target className="w-6 h-6 text-orange-400" />
                <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
              <h4 className="font-semibold text-gray-100 mb-2">Strategy & SOS</h4>
              <p className="text-sm text-gray-400">Analyze strength of schedule and team matchups</p>
            </button>
          </Link>

          <Link href="?tab=moves">
            <button className="w-full bg-[#141824] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors text-left group">
              <div className="flex items-center justify-between mb-3">
                <TrendingUp className="w-6 h-6 text-green-400" />
                <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
              <h4 className="font-semibold text-gray-100 mb-2">Trade & Moves</h4>
              <p className="text-sm text-gray-400">Evaluate trades and roster decisions (Coming Soon)</p>
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
