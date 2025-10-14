import { X, TrendingUp, TrendingDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';

interface PlayerSearchResult {
  canonicalId: string;
  fullName: string;
  position: string;
  nflTeam: string;
}

interface LatestGameData {
  success: boolean;
  data: {
    season: number;
    week: number;
    opponent: string;
    passing?: {
      attempts: string;
      completions: string;
      yards: string;
      touchdowns: string;
      interceptions: string;
    };
    rushing?: {
      attempts: string;
      yards: string;
      touchdowns: number;
    };
    receiving?: {
      targets: string;
      receptions: number;
      yards: string;
      touchdowns: number;
    };
    fantasyPoints: {
      standard: number;
      halfPPR: number;
      ppr: number;
    };
  };
}

interface PlayerGameCardProps {
  player: PlayerSearchResult;
  onClose: () => void;
}

interface PlayerIdentityResponse {
  success: boolean;
  data: {
    canonicalId: string;
    fullName: string;
    position: string;
    nflTeam: string;
    externalIds?: {
      sleeper?: string;
      nfl_data_py?: string;
      espn?: string;
      yahoo?: string;
    };
  };
}

export default function PlayerGameCard({ player, onClose }: PlayerGameCardProps) {
  // Fetch NFLfastR ID mapping
  const { data: identityData, isLoading: identityLoading, error: identityError } = useQuery<PlayerIdentityResponse>({
    queryKey: [`/api/player-identity/player/${player.canonicalId}`],
  });

  const nflfastrId = identityData?.data?.externalIds?.nfl_data_py;

  // Fetch latest game log
  const { data: gameData, isLoading, error } = useQuery<LatestGameData>({
    queryKey: [`/api/game-logs/${nflfastrId}/latest`],
    enabled: !!nflfastrId,
  });

  const formatStat = (value: string | number | undefined) => {
    if (value === undefined || value === null || value === '' || value === '0') return '-';
    return value;
  };

  return (
    <Card className="bg-[#1e2330] border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-bold text-white">
            {player.position}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-100">{player.fullName}</h3>
            <p className="text-sm text-gray-400">{player.nflTeam} • {player.position}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[#141824] rounded-lg transition-colors"
          data-testid="button-close-game-card"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Game Data */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      ) : error || !gameData?.data ? (
        <div className="text-center py-8">
          <p className="text-gray-400" data-testid="no-game-data">No recent game data available</p>
          <p className="text-xs text-gray-600 mt-1">NFLfastR data may be limited for this player</p>
        </div>
      ) : (
        <>
          {/* Game Info */}
          <div className="mb-4 pb-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Week {gameData.data.week} • vs {gameData.data.opponent}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-blue-400">
                  {gameData.data.fantasyPoints.ppr.toFixed(1)}
                </span>
                <span className="text-xs text-gray-500">PPR pts</span>
              </div>
            </div>
          </div>

          {/* Position-Specific Stats */}
          <div className="space-y-3">
            {/* Passing Stats (QB) */}
            {player.position === 'QB' && gameData.data.passing && (
              <div className="bg-[#141824] rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-2">PASSING</div>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div>
                    <div className="text-gray-400 text-xs">C/A</div>
                    <div className="text-gray-100 font-mono" data-testid="stat-passing-comp-att">
                      {formatStat(gameData.data.passing.completions)}/{formatStat(gameData.data.passing.attempts)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">YDS</div>
                    <div className="text-gray-100 font-mono" data-testid="stat-passing-yards">
                      {formatStat(gameData.data.passing.yards)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">TD</div>
                    <div className="text-green-400 font-mono" data-testid="stat-passing-td">
                      {formatStat(gameData.data.passing.touchdowns)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">INT</div>
                    <div className="text-red-400 font-mono" data-testid="stat-passing-int">
                      {formatStat(gameData.data.passing.interceptions)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Rushing Stats (RB/QB) */}
            {(player.position === 'RB' || player.position === 'QB') && gameData.data.rushing && (
              <div className="bg-[#141824] rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-2">RUSHING</div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-gray-400 text-xs">ATT</div>
                    <div className="text-gray-100 font-mono" data-testid="stat-rushing-att">
                      {formatStat(gameData.data.rushing.attempts)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">YDS</div>
                    <div className="text-gray-100 font-mono" data-testid="stat-rushing-yards">
                      {formatStat(gameData.data.rushing.yards)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">TD</div>
                    <div className="text-green-400 font-mono" data-testid="stat-rushing-td">
                      {formatStat(gameData.data.rushing.touchdowns)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Receiving Stats (WR/TE/RB) */}
            {(player.position === 'WR' || player.position === 'TE' || player.position === 'RB') && gameData.data.receiving && (
              <div className="bg-[#141824] rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-2">RECEIVING</div>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div>
                    <div className="text-gray-400 text-xs">TGT</div>
                    <div className="text-gray-100 font-mono" data-testid="stat-receiving-targets">
                      {formatStat(gameData.data.receiving.targets)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">REC</div>
                    <div className="text-gray-100 font-mono" data-testid="stat-receiving-rec">
                      {formatStat(gameData.data.receiving.receptions)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">YDS</div>
                    <div className="text-gray-100 font-mono" data-testid="stat-receiving-yards">
                      {formatStat(gameData.data.receiving.yards)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">TD</div>
                    <div className="text-green-400 font-mono" data-testid="stat-receiving-td">
                      {formatStat(gameData.data.receiving.touchdowns)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fantasy Points Breakdown */}
          <div className="mt-4 pt-4 border-t border-gray-800">
            <div className="text-xs text-gray-500 mb-2">FANTASY POINTS</div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center">
                <div className="text-gray-400 text-xs">STD</div>
                <div className="text-gray-100 font-mono">{gameData.data.fantasyPoints.standard.toFixed(1)}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 text-xs">HALF</div>
                <div className="text-gray-100 font-mono">{gameData.data.fantasyPoints.halfPPR.toFixed(1)}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 text-xs">PPR</div>
                <div className="text-blue-400 font-mono font-bold">{gameData.data.fantasyPoints.ppr.toFixed(1)}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
