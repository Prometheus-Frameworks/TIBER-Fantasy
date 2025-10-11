import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';

interface OVRPlayer {
  player_id: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  ovr: number;
  tier: string;
  confidence: number;
}

interface OVRResponse {
  success: boolean;
  data: {
    players: OVRPlayer[];
  };
}

export default function RankingsTab() {
  const [selectedPosition, setSelectedPosition] = useState('ALL');
  const [selectedFormat, setSelectedFormat] = useState<'dynasty' | 'redraft'>('redraft');

  const { data: ovrData, isLoading } = useQuery<OVRResponse>({
    queryKey: ['/api/ovr', { format: selectedFormat, position: selectedPosition, limit: 100 }],
  });

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      S: 'from-purple-500 to-purple-700',
      Elite: 'from-purple-500 to-purple-700',
      A: 'from-blue-500 to-blue-700',
      Great: 'from-blue-500 to-blue-700',
      B: 'from-green-500 to-green-700',
      Good: 'from-green-500 to-green-700',
      C: 'from-yellow-500 to-yellow-700',
      D: 'from-red-500 to-red-700'
    };
    return colors[tier] || colors.C;
  };

  const players = ovrData?.data?.players || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Power Rankings</h2>
          <p className="text-gray-400 mt-1">
            Top {selectedPosition === 'ALL' ? '100' : selectedPosition} players • {selectedFormat === 'dynasty' ? 'Dynasty' : 'Redraft'} • Week 5
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Position Filters */}
        <div className="flex gap-2">
          {['ALL', 'QB', 'RB', 'WR', 'TE'].map(pos => (
            <button
              key={pos}
              onClick={() => setSelectedPosition(pos)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPosition === pos
                  ? 'bg-blue-500 text-white'
                  : 'bg-[#1e2330] text-gray-400 hover:text-gray-300'
              }`}
              data-testid={`button-filter-${pos.toLowerCase()}`}
            >
              {pos}
            </button>
          ))}
        </div>

        {/* Format Toggle */}
        <div className="flex gap-2 ml-auto">
          {[
            { id: 'redraft', label: 'Redraft' },
            { id: 'dynasty', label: 'Dynasty' }
          ].map(format => (
            <button
              key={format.id}
              onClick={() => setSelectedFormat(format.id as 'dynasty' | 'redraft')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedFormat === format.id
                  ? 'bg-purple-500 text-white'
                  : 'bg-[#1e2330] text-gray-400 hover:text-gray-300'
              }`}
              data-testid={`button-format-${format.id}`}
            >
              {format.label}
            </button>
          ))}
        </div>
      </div>

      {/* Player Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, idx) => (
            <div key={idx} className="bg-[#1e2330] border border-gray-700 rounded-lg p-4 animate-pulse">
              <div className="h-20 bg-gray-700/50 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {players.map((player, idx) => (
            <div
              key={player.player_id}
              className="bg-[#1e2330] border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
              data-testid={`player-card-${idx}`}
            >
              <div className="flex items-start gap-4">
                {/* Rank */}
                <div className="flex-shrink-0 w-8 text-center">
                  <span className="text-2xl font-bold text-gray-500">{idx + 1}</span>
                </div>

                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-gray-100">{player.name}</h3>
                    <span className="text-sm text-gray-400">{player.position} • {player.team}</span>
                  </div>

                  {/* Stats Bar */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${getTierColor(player.tier)} transition-all`}
                          style={{ width: `${player.ovr}%` }}
                        />
                      </div>
                      <span className={`text-lg font-bold px-2 py-1 rounded bg-gradient-to-r ${getTierColor(player.tier)}`}>
                        {player.ovr}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>Tier: <span className="text-gray-300 font-semibold">{player.tier}</span></span>
                      <span>Confidence: <span className="text-gray-300 font-mono">{(player.confidence * 100).toFixed(0)}%</span></span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex flex-col gap-2">
                  <Link 
                    href={`/players/${player.player_id}`}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors text-center"
                    data-testid={`button-view-${idx}`}
                  >
                    View
                  </Link>
                  <button
                    className="px-4 py-2 bg-[#141824] hover:bg-[#1e2330] border border-gray-700 rounded-lg text-sm font-medium transition-colors text-center"
                    data-testid={`button-compare-${idx}`}
                  >
                    Compare
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
