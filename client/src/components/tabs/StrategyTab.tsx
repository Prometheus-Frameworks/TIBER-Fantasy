import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, TrendingUp, TrendingDown, Target } from 'lucide-react';

interface SOSRanking {
  team: string;
  score: number; // API returns "score" not "overall_score"
  passDefScore?: number; // API returns camelCase
  rushDefScore?: number;
  pressureScore?: number;
  rank: number;
}

interface SOSResponse {
  season: number;
  week: number;
  rankings: SOSRanking[]; // API returns "rankings" not "data"
}

export default function StrategyTab() {
  const [sosView, setSosView] = useState<'defense' | 'offense'>('defense');
  const [sosPosition, setSosPosition] = useState<'ALL' | 'QB' | 'RB' | 'WR' | 'TE'>('ALL');

  // Build query URLs with params
  const buildSosUrl = (type: 'defense' | 'offense') => {
    const params = new URLSearchParams();
    if (sosPosition !== 'ALL') {
      params.set('position', sosPosition);
    }
    const queryString = params.toString();
    return `/api/sos/rankings/${type}${queryString ? `?${queryString}` : ''}`;
  };

  // Fetch SOS defense rankings
  const { data: sosDefense, isLoading: defenseLoading } = useQuery<SOSResponse>({
    queryKey: [buildSosUrl('defense')],
    enabled: sosView === 'defense',
  });

  // Fetch SOS offense rankings
  const { data: sosOffense, isLoading: offenseLoading } = useQuery<SOSResponse>({
    queryKey: [buildSosUrl('offense')],
    enabled: sosView === 'offense',
  });

  const isLoading = sosView === 'defense' ? defenseLoading : offenseLoading;
  const sosData = sosView === 'defense' ? sosDefense?.rankings || [] : sosOffense?.rankings || [];

  const getRankColor = (rank: number, isOffense: boolean) => {
    if (isOffense) {
      // For offense: higher rank = better
      if (rank <= 3) return 'text-green-400 bg-green-500/10';
      if (rank <= 10) return 'text-blue-400 bg-blue-500/10';
      if (rank <= 20) return 'text-gray-400 bg-gray-500/10';
      return 'text-orange-400 bg-orange-500/10';
    } else {
      // For defense: lower rank = harder matchup
      if (rank <= 3) return 'text-red-400 bg-red-500/10';
      if (rank <= 10) return 'text-orange-400 bg-orange-500/10';
      if (rank <= 20) return 'text-gray-400 bg-gray-500/10';
      return 'text-green-400 bg-green-500/10';
    }
  };

  const getRankIcon = (rank: number, isOffense: boolean) => {
    if (isOffense) {
      if (rank <= 3) return <TrendingUp className="w-5 h-5 text-green-400" />;
      if (rank <= 10) return <Target className="w-5 h-5 text-blue-400" />;
      return <TrendingDown className="w-5 h-5 text-orange-400" />;
    } else {
      if (rank <= 3) return <Shield className="w-5 h-5 text-red-400" />;
      if (rank <= 10) return <Shield className="w-5 h-5 text-orange-400" />;
      return <Shield className="w-5 h-5 text-green-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Strategy & SOS Analysis</h2>
          <p className="text-gray-400 mt-1">Strength of Schedule and Matchup Intelligence</p>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        {[
          { id: 'defense', label: 'Defense Rankings', icon: Shield },
          { id: 'offense', label: 'Offense Rankings', icon: TrendingUp }
        ].map(view => {
          const Icon = view.icon;
          return (
            <button
              key={view.id}
              onClick={() => setSosView(view.id as 'defense' | 'offense')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                sosView === view.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-[#1e2330] text-gray-400 hover:text-gray-300'
              }`}
              data-testid={`button-sos-${view.id}`}
            >
              <Icon className="w-4 h-4" />
              {view.label}
            </button>
          );
        })}
      </div>

      {/* Position Filters */}
      <div className="flex gap-2">
        {['ALL', 'QB', 'RB', 'WR', 'TE'].map(pos => (
          <button
            key={pos}
            onClick={() => setSosPosition(pos as typeof sosPosition)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              sosPosition === pos
                ? 'bg-purple-500 text-white'
                : 'bg-[#1e2330] text-gray-400 hover:text-gray-300'
            }`}
            data-testid={`button-sos-position-${pos.toLowerCase()}`}
          >
            {pos}
          </button>
        ))}
      </div>

      {/* SOS Rankings */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, idx) => (
            <div key={idx} className="bg-[#1e2330] border border-gray-700 rounded-lg p-4 animate-pulse">
              <div className="h-16 bg-gray-700/50 rounded"></div>
            </div>
          ))}
        </div>
      ) : sosData.length > 0 ? (
        <div className="grid gap-3">
          {sosData.slice(0, 28).map((team, idx) => (
            <div
              key={idx}
              className="bg-[#1e2330] border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
              data-testid={`sos-team-${idx}`}
            >
              <div className="flex items-center gap-4">
                {/* Rank */}
                <div className="flex-shrink-0 w-12">
                  <div className="text-2xl font-bold text-gray-500">#{team.rank}</div>
                </div>

                {/* Icon */}
                <div className="flex-shrink-0">
                  {getRankIcon(team.rank, sosView === 'offense')}
                </div>

                {/* Team Info */}
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-gray-100">{team.team}</h4>
                  <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                    {team.passDefScore !== undefined && (
                      <span>Pass Def: <span className="text-gray-300">{team.passDefScore.toFixed(1)}</span></span>
                    )}
                    {team.rushDefScore !== undefined && (
                      <span>Rush Def: <span className="text-gray-300">{team.rushDefScore.toFixed(1)}</span></span>
                    )}
                    {team.pressureScore !== undefined && (
                      <span>Pressure: <span className="text-gray-300">{team.pressureScore.toFixed(1)}</span></span>
                    )}
                  </div>
                </div>

                {/* Overall Score */}
                <div className="flex-shrink-0">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${getRankColor(team.rank, sosView === 'offense')}`}>
                    {team.score.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No SOS data available for this position</p>
          <p className="text-sm mt-2">Try selecting a different position or view</p>
        </div>
      )}
    </div>
  );
}
