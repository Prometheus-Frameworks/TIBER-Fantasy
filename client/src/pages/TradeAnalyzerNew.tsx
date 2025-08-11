import React, { useState, useTransition } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, X, ArrowLeftRight, BarChart3, Target } from 'lucide-react';

interface Player {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  overall_rating: number;
  vorp?: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  format_ratings?: {
    dynasty: number;
    redraft: number;
    superflex: number;
  };
}

interface TradeAnalysis {
  team_a_total: number;
  team_b_total: number;
  vorp_difference: number;
  verdict: 'Team A wins' | 'Team B wins' | 'Fair trade';
  confidence: number;
  analysis: string;
}

const TradeAnalyzerNew: React.FC = () => {
  const [teamAPlayers, setTeamAPlayers] = useState<Player[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<Player[]>([]);
  const [searchTermA, setSearchTermA] = useState('');
  const [searchTermB, setSearchTermB] = useState('');
  const [format, setFormat] = useState<'dynasty' | 'redraft' | 'superflex'>('dynasty');
  const [isPending, startTransition] = useTransition();

  // Search for players
  const { data: playerPoolData } = useQuery<{ok: boolean, data: Player[]}>({
    queryKey: ['/api/player-pool', { limit: 1000 }],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const allPlayers = playerPoolData?.data || [];

  // Filter players based on search
  const getFilteredPlayers = (searchTerm: string) => {
    if (!searchTerm) return [];
    return allPlayers
      .filter(player => 
        player.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.team.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .slice(0, 8);
  };

  const filteredPlayersA = getFilteredPlayers(searchTermA);
  const filteredPlayersB = getFilteredPlayers(searchTermB);

  const addPlayerToTeam = (player: Player, team: 'A' | 'B') => {
    startTransition(() => {
      if (team === 'A') {
        if (!teamAPlayers.find(p => p.player_id === player.player_id)) {
          setTeamAPlayers([...teamAPlayers, player]);
        }
        setSearchTermA('');
      } else {
        if (!teamBPlayers.find(p => p.player_id === player.player_id)) {
          setTeamBPlayers([...teamBPlayers, player]);
        }
        setSearchTermB('');
      }
    });
  };

  const removePlayerFromTeam = (playerId: string, team: 'A' | 'B') => {
    startTransition(() => {
      if (team === 'A') {
        setTeamAPlayers(teamAPlayers.filter(p => p.player_id !== playerId));
      } else {
        setTeamBPlayers(teamBPlayers.filter(p => p.player_id !== playerId));
      }
    });
  };

  // Calculate team totals
  const calculateTeamValue = (players: Player[]) => {
    return players.reduce((total, player) => {
      const rating = player.format_ratings?.[format] || player.overall_rating;
      return total + rating;
    }, 0);
  };

  const calculateVORPTotal = (players: Player[]) => {
    return players.reduce((total, player) => total + (player.vorp || 0), 0);
  };

  const teamAValue = calculateTeamValue(teamAPlayers);
  const teamBValue = calculateTeamValue(teamBPlayers);
  const teamAVORP = calculateVORPTotal(teamAPlayers);
  const teamBVORP = calculateVORPTotal(teamBPlayers);

  const valueDifference = Math.abs(teamAValue - teamBValue);
  const vorpDifference = Math.abs(teamAVORP - teamBVORP);

  const getTradeVerdict = (): TradeAnalysis => {
    const totalDiff = teamAValue - teamBValue;
    const threshold = 10; // Fair trade threshold
    
    if (Math.abs(totalDiff) <= threshold) {
      return {
        team_a_total: teamAValue,
        team_b_total: teamBValue,
        vorp_difference: vorpDifference,
        verdict: 'Fair trade',
        confidence: 85,
        analysis: 'This appears to be a balanced trade with minimal value disparity.'
      };
    } else if (totalDiff > 0) {
      return {
        team_a_total: teamAValue,
        team_b_total: teamBValue,
        vorp_difference: vorpDifference,
        verdict: 'Team A wins',
        confidence: Math.min(95, 60 + (Math.abs(totalDiff) / 2)),
        analysis: `Team A receives significantly more value (+${totalDiff.toFixed(1)} points).`
      };
    } else {
      return {
        team_a_total: teamAValue,
        team_b_total: teamBValue,
        vorp_difference: vorpDifference,
        verdict: 'Team B wins',
        confidence: Math.min(95, 60 + (Math.abs(totalDiff) / 2)),
        analysis: `Team B receives significantly more value (+${Math.abs(totalDiff).toFixed(1)} points).`
      };
    }
  };

  const tradeAnalysis = (teamAPlayers.length > 0 && teamBPlayers.length > 0) ? getTradeVerdict() : null;

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'S': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'A': return 'bg-green-100 text-green-800 border-green-200';
      case 'B': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'D': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'Fair trade': return 'text-green-600 bg-green-50 border-green-200';
      case 'Team A wins': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'Team B wins': return 'text-purple-600 bg-purple-50 border-purple-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <ArrowLeftRight className="h-6 w-6 text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Trade Analyzer
            </h1>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Compare player values & VORP
            </span>
          </div>

          {/* Format Selector */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-fit">
            {(['dynasty', 'redraft', 'superflex'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setFormat(fmt)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
                  format === fmt
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Trade Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Team A */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-blue-600 mb-4">Team A</h3>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search players..."
                value={searchTermA}
                onChange={(e) => setSearchTermA(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>

            {/* Search Results */}
            {searchTermA && filteredPlayersA.length > 0 && (
              <div className="mb-4 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                {filteredPlayersA.map((player) => (
                  <button
                    key={player.player_id}
                    onClick={() => addPlayerToTeam(player, 'A')}
                    className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {player.player_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {player.position} • {player.team}
                        </div>
                      </div>
                      <Plus className="h-4 w-4 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Players */}
            <div className="space-y-2">
              {teamAPlayers.map((player) => (
                <div key={player.player_id} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {player.player_name}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {player.position} • {player.team}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${getTierColor(player.tier)}`}>
                        {player.tier}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                      Rating: {player.format_ratings?.[format] || player.overall_rating}
                    </div>
                  </div>
                  <button
                    onClick={() => removePlayerFromTeam(player.player_id, 'A')}
                    className="text-red-500 hover:text-red-700 ml-2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {teamAPlayers.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Add players to Team A</p>
                </div>
              )}
            </div>

            {/* Team A Total */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Total Value:
                </span>
                <span className="text-lg font-bold text-blue-600">
                  {teamAValue.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  VORP:
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {teamAVORP.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Analysis Center */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Trade Analysis
              </h3>
              
              {tradeAnalysis ? (
                <div className="space-y-4">
                  <div className={`inline-flex px-4 py-2 rounded-full border font-semibold ${getVerdictColor(tradeAnalysis.verdict)}`}>
                    {tradeAnalysis.verdict}
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Confidence: {tradeAnalysis.confidence}%
                  </div>
                  
                  <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-md p-3">
                    {tradeAnalysis.analysis}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">Value Diff</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {valueDifference.toFixed(1)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">VORP Diff</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {vorpDifference.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 dark:text-gray-400">
                  <p className="mb-2">Add players to both teams</p>
                  <p className="text-xs">to see trade analysis</p>
                </div>
              )}
            </div>
          </div>

          {/* Team B */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-purple-600 mb-4">Team B</h3>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search players..."
                value={searchTermB}
                onChange={(e) => setSearchTermB(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>

            {/* Search Results */}
            {searchTermB && filteredPlayersB.length > 0 && (
              <div className="mb-4 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                {filteredPlayersB.map((player) => (
                  <button
                    key={player.player_id}
                    onClick={() => addPlayerToTeam(player, 'B')}
                    className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {player.player_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {player.position} • {player.team}
                        </div>
                      </div>
                      <Plus className="h-4 w-4 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Players */}
            <div className="space-y-2">
              {teamBPlayers.map((player) => (
                <div key={player.player_id} className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {player.player_name}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {player.position} • {player.team}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${getTierColor(player.tier)}`}>
                        {player.tier}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                      Rating: {player.format_ratings?.[format] || player.overall_rating}
                    </div>
                  </div>
                  <button
                    onClick={() => removePlayerFromTeam(player.player_id, 'B')}
                    className="text-red-500 hover:text-red-700 ml-2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {teamBPlayers.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Add players to Team B</p>
                </div>
              )}
            </div>

            {/* Team B Total */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Total Value:
                </span>
                <span className="text-lg font-bold text-purple-600">
                  {teamBValue.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  VORP:
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {teamBVORP.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Info Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Trade analysis powered by {format} ratings • 
            Includes VORP calculations and tier-based evaluation • 
            Values updated from backend spine
          </p>
        </div>
      </div>
    </div>
  );
};

export default TradeAnalyzerNew;