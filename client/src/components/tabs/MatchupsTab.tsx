import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface DvPMatchup {
  team: string;
  rank: number;
  position: string;
  pts_allowed_ppr: number;
  avg_epa: number;
  plays_against: number;
  matchup_rating: string;
}

interface DvPResponse {
  success: boolean;
  data: DvPMatchup[];
}

export default function MatchupsTab() {
  const [dvpPosition, setDvpPosition] = useState('QB');

  // Build query URL with params
  const buildDvpUrl = () => {
    const params = new URLSearchParams();
    params.set('position', dvpPosition);
    params.set('season', '2025');
    params.set('week', '5');
    return `/api/dvp?${params.toString()}`;
  };

  const { data: dvpResponse, isLoading } = useQuery<DvPResponse>({
    queryKey: [buildDvpUrl()],
  });

  const getMatchupIcon = (matchup: string) => {
    if (matchup === 'elite-matchup' || matchup === 'elite') return '🎯🎯🎯';
    if (matchup === 'good-matchup' || matchup === 'good') return '🎯🎯';
    if (matchup === 'neutral-matchup' || matchup === 'average') return '🎯';
    if (matchup === 'tough-matchup') return '⚠️';
    return '🚫';
  };

  const getMatchupLabel = (matchup: string) => {
    const labels: Record<string, string> = {
      'elite-matchup': 'ELITE MATCHUP',
      'good-matchup': 'Good Matchup',
      'neutral-matchup': 'Average',
      'tough-matchup': 'Tough',
      'avoid-matchup': 'AVOID'
    };
    return labels[matchup] || 'Average';
  };

  const getMatchupColor = (matchup: string) => {
    const colors: Record<string, string> = {
      'elite-matchup': 'text-green-400 bg-green-500/10',
      'good-matchup': 'text-blue-400 bg-blue-500/10',
      'neutral-matchup': 'text-gray-400 bg-gray-500/10',
      'tough-matchup': 'text-orange-400 bg-orange-500/10',
      'avoid-matchup': 'text-red-400 bg-red-500/10'
    };
    return colors[matchup] || colors['neutral-matchup'];
  };

  const dvpData = dvpResponse?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Defense vs Position Matchups</h2>
          <p className="text-gray-400 mt-1">Week 5 • 2025 Season</p>
        </div>
      </div>

      {/* Position Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['QB', 'RB', 'WR', 'TE'].map(pos => (
          <button
            key={pos}
            onClick={() => setDvpPosition(pos)}
            className={`px-6 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              dvpPosition === pos
                ? 'bg-blue-500 text-white'
                : 'bg-[#1e2330] text-gray-400 hover:text-gray-300'
            }`}
            data-testid={`dvp-position-${pos.toLowerCase()}`}
          >
            {pos}
          </button>
        ))}
      </div>

      {/* Matchup Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="bg-[#1e2330] border border-gray-700 rounded-lg p-4 animate-pulse">
              <div className="h-24 bg-gray-700/50 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {dvpData.slice(0, 10).map((def, idx) => (
            <div 
              key={idx} 
              className={`bg-[#1e2330] border rounded-lg p-4 ${
                def.matchup_rating === 'elite-matchup' ? 'border-green-500/20' : 'border-gray-700'
              }`}
              data-testid={`dvp-matchup-${idx}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-lg font-bold text-gray-100">{def.team}</h4>
                  <p className="text-sm text-gray-400">Rank: #{def.rank} vs {def.position}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${getMatchupColor(def.matchup_rating)}`}>
                  {getMatchupIcon(def.matchup_rating)} {getMatchupLabel(def.matchup_rating)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-400 text-xs mb-1">Fantasy Pts Allowed</div>
                  <div className="text-xl font-bold text-gray-100">
                    {def.pts_allowed_ppr != null ? def.pts_allowed_ppr.toFixed(1) : 'N/A'}
                  </div>
                  <div className="text-gray-500 text-xs">PPR PPG</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs mb-1">EPA</div>
                  <div className="text-xl font-bold text-gray-100">
                    {def.avg_epa != null ? `${def.avg_epa > 0 ? '+' : ''}${def.avg_epa.toFixed(2)}` : 'N/A'}
                  </div>
                  <div className="text-gray-500 text-xs">per play</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs mb-1">Sample Size</div>
                  <div className="text-xl font-bold text-gray-100">{def.plays_against || 0}</div>
                  <div className="text-gray-500 text-xs">plays</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
