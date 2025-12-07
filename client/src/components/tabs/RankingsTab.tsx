import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import PlayerDetailDrawer from '@/components/PlayerDetailDrawer';
import RoleBankRankings from '@/components/RoleBankRankings';

interface TiberPlayer {
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  tiberScore: number;
  tier: 'breakout' | 'stable' | 'regression';
  positionalRank: number;
  tiberRank: string;
  nflfastrId: string;
}

interface TiberRankingsResponse {
  success: boolean;
  data: {
    week: number;
    season: number;
    total: number;
    qbCount: number;
    rbCount: number;
    wrCount: number;
    teCount: number;
    players: TiberPlayer[];
  };
}

type Position = 'QB' | 'RB' | 'WR' | 'TE';

// Available weeks for the 2025 season (weeks with completed games)
const AVAILABLE_WEEKS = [1, 2, 3, 4, 5, 6, 7];

type RankingView = 'weekly' | 'roles';

export default function RankingsTab() {
  const [rankingView, setRankingView] = useState<RankingView>('weekly'); // Default to Weekly Trends
  const [selectedPosition, setSelectedPosition] = useState<Position | 'ALL'>('ALL');
  const [selectedWeek, setSelectedWeek] = useState<number>(7); // Default to latest week
  const [qbExpanded, setQbExpanded] = useState(true);
  const [rbExpanded, setRbExpanded] = useState(true);
  const [wrExpanded, setWrExpanded] = useState(true);
  const [teExpanded, setTeExpanded] = useState(true);
  
  // Player detail drawer state
  const [selectedPlayer, setSelectedPlayer] = useState<TiberPlayer | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handlePlayerClick = (player: TiberPlayer) => {
    setSelectedPlayer(player);
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    // Delay clearing to avoid flicker during close animation
    setTimeout(() => setSelectedPlayer(null), 300);
  };

  const { data, isLoading } = useQuery<TiberRankingsResponse>({
    queryKey: ['/api/tiber/rankings', selectedWeek, 2025],
    queryFn: async () => {
      const res = await fetch(`/api/tiber/rankings?week=${selectedWeek}&season=2025&limit=150`);
      if (!res.ok) throw new Error('Failed to fetch TIBER rankings');
      return res.json();
    }
  });

  const allPlayers = data?.data?.players || [];
  const qbPlayers = allPlayers.filter(p => p.position === 'QB');
  const rbPlayers = allPlayers.filter(p => p.position === 'RB');
  const wrPlayers = allPlayers.filter(p => p.position === 'WR');
  const tePlayers = allPlayers.filter(p => p.position === 'TE');

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      breakout: 'from-green-500 to-green-700',
      stable: 'from-blue-500 to-blue-700',
      regression: 'from-red-500 to-red-700',
    };
    return colors[tier] || colors.stable;
  };

  const getPositionLabel = (position: Position): string => {
    const labels: Record<Position, string> = {
      QB: 'Quarterbacks',
      RB: 'Running Backs',
      WR: 'Wide Receivers',
      TE: 'Tight Ends',
    };
    return labels[position];
  };

  const renderPlayerSection = (players: TiberPlayer[], position: Position, expanded: boolean, setExpanded: (val: boolean) => void) => (
    <div className="bg-[#111217] border border-gray-800/50 rounded-xl overflow-hidden shadow-lg shadow-black/20">
      {/* Section Header Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#1a1f2e] transition-all border-b border-red-500/10"
        data-testid={`button-toggle-${position.toLowerCase()}`}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="text-gray-400" size={20} /> : <ChevronRight className="text-gray-400" size={20} />}
          <h3 className="text-xl font-bold text-white tracking-wide">{getPositionLabel(position)}</h3>
          <span className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/30 rounded text-sm font-medium">
            {players.length}
          </span>
        </div>
      </button>

      {/* Player List */}
      {expanded && (
        <div>
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, idx) => (
                <div key={idx} className="h-16 bg-gray-700/30 rounded animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div>
              {players.map((player, idx) => (
                <button
                  key={`${player.name}-${idx}`}
                  onClick={() => handlePlayerClick(player)}
                  className="w-full text-left px-3 sm:px-6 py-3.5 border-b border-white/5 hover:bg-gradient-to-r hover:from-red-500/5 hover:to-transparent transition-all cursor-pointer"
                  data-testid={`player-card-${position.toLowerCase()}-${idx}`}
                >
                  <div className="flex items-center justify-between gap-2 sm:gap-4">
                    {/* Left: Rank & Player Info */}
                    <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                      <div className="text-base sm:text-lg font-semibold text-gray-500 w-6 sm:w-8 flex-shrink-0 tracking-wide">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm sm:text-base font-semibold text-white tracking-wide break-words">
                          {player.name}
                        </h4>
                      </div>
                    </div>

                    {/* Right: Team, Position, and TIBER Score Badge */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
                      <span className="hidden sm:inline-block px-2 py-1 bg-gray-800/70 text-gray-300 rounded text-xs font-medium tracking-wide">
                        {player.team}
                      </span>
                      <span className="hidden sm:inline-block text-gray-500 text-xs font-medium tracking-wide min-w-[2.5rem] text-center">
                        {player.tiberRank}
                      </span>
                      <div className={`px-2.5 sm:px-3 py-1.5 rounded-md font-bold text-sm tracking-wide shadow-md min-w-[3rem] sm:min-w-[3.5rem] text-center ${
                        player.tier === 'breakout' 
                          ? 'bg-gradient-to-r from-green-600/30 to-green-500/30 text-green-400 border border-green-500/30 shadow-green-500/20' :
                        player.tier === 'regression' 
                          ? 'bg-gradient-to-r from-red-600/30 to-red-500/30 text-red-400 border border-red-500/30 shadow-red-500/20' :
                          'bg-gradient-to-r from-blue-600/30 to-blue-500/30 text-blue-400 border border-blue-500/30 shadow-blue-500/20'
                      }`}>
                        {player.tiberScore}
                      </div>
                    </div>
                  </div>
                </button>
              ))}

              {players.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No {position} players available
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const visiblePositions = selectedPosition === 'ALL' 
    ? ['QB', 'RB', 'WR', 'TE'] as Position[]
    : [selectedPosition] as Position[];

  return (
    <div className="space-y-6">
      {/* Header with crimson accent */}
      <div className="border-b border-red-500/20 pb-4">
        <h2 className="text-2xl font-bold text-white tracking-wide">TIBER TIERS</h2>
        <p className="text-gray-400 mt-1 text-sm tracking-wide">
          Use Weekly Trends to see who's hot right now. Use Season Roles to understand how players are being used.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-3">
        <div className="flex flex-col">
          <button
            onClick={() => setRankingView('weekly')}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all tracking-wide ${
              rankingView === 'weekly'
                ? 'bg-gradient-to-r from-red-600/30 to-red-500/30 border border-red-500/50 text-white shadow-lg shadow-red-500/20'
                : 'bg-[#0d0e11] text-gray-400 hover:text-gray-300 border border-gray-800/50 hover:border-gray-700'
            }`}
            data-testid="button-view-weekly"
          >
            Weekly Trends
          </button>
          {rankingView === 'weekly' && (
            <p className="text-xs text-gray-500 mt-1 px-2">
              This week's performance-based fantasy rankings (0–100 TIBER score)
            </p>
          )}
        </div>
        <div className="flex flex-col">
          <button
            onClick={() => setRankingView('roles')}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all tracking-wide ${
              rankingView === 'roles'
                ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 border border-blue-500/50 text-white shadow-lg shadow-blue-500/20'
                : 'bg-[#0d0e11] text-gray-400 hover:text-gray-300 border border-gray-800/50 hover:border-gray-700'
            }`}
            data-testid="button-view-roles"
          >
            Season Roles
          </button>
          {rankingView === 'roles' && (
            <p className="text-xs text-gray-500 mt-1 px-2">
              Season-long offensive role and usage profile based on Role Bank tiers
            </p>
          )}
        </div>
      </div>

      {/* Conditional Rendering Based on View */}
      {rankingView === 'roles' ? (
        <RoleBankRankings />
      ) : (
        <>
      {/* Original TIBER Rankings Content */}

      {/* Clarity Note */}
      <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
        <p className="text-xs text-red-300 tracking-wide">
          📈 <span className="font-semibold">Scores represent this week's performance (0–100), not season role.</span> TIBER measures recent trending efficiency based on First Downs per Route, snap counts, and 4-week momentum.
        </p>
      </div>

      {/* Week Selector - Tactical Style */}
      <div className="space-y-2">
        <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Week Selection</label>
        <div className="flex gap-2 flex-wrap">
          {AVAILABLE_WEEKS.map(week => (
            <button
              key={week}
              onClick={() => setSelectedWeek(week)}
              className={`px-4 py-2 rounded font-medium transition-all tracking-wide ${
                selectedWeek === week
                  ? 'bg-gradient-to-r from-red-600/30 to-red-500/30 border border-red-500/50 text-white shadow-lg shadow-red-500/20'
                  : 'bg-[#0d0e11] text-gray-400 hover:text-gray-300 border border-gray-800/50 hover:border-gray-700'
              }`}
              data-testid={`button-week-${week}`}
            >
              Week {week}
            </button>
          ))}
        </div>
      </div>

      {/* Position Filter Buttons - Tactical Style */}
      <div className="space-y-2">
        <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Position Filter</label>
        <div className="flex gap-2 flex-wrap">
          {(['ALL', 'QB', 'RB', 'WR', 'TE'] as const).map(pos => (
            <button
              key={pos}
              onClick={() => setSelectedPosition(pos)}
              className={`px-4 py-2 rounded font-medium transition-all tracking-wide ${
                selectedPosition === pos
                  ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 border border-blue-500/50 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-[#0d0e11] text-gray-400 hover:text-gray-300 border border-gray-800/50 hover:border-gray-700'
              }`}
              data-testid={`button-filter-${pos.toLowerCase()}`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Position Sections */}
      <div className="space-y-4">
        {visiblePositions.includes('QB') && renderPlayerSection(qbPlayers, 'QB', qbExpanded, setQbExpanded)}
        {visiblePositions.includes('RB') && renderPlayerSection(rbPlayers, 'RB', rbExpanded, setRbExpanded)}
        {visiblePositions.includes('WR') && renderPlayerSection(wrPlayers, 'WR', wrExpanded, setWrExpanded)}
        {visiblePositions.includes('TE') && renderPlayerSection(tePlayers, 'TE', teExpanded, setTeExpanded)}
      </div>

      {/* Footer with TIBER Watermark */}
      <div className="mt-8 pt-6 border-t border-red-500/10 space-y-3">
        <div className="text-center text-sm text-gray-500 tracking-wide">
          {data?.data?.season || 2025} Season • Week {data?.data?.week || selectedWeek} • Data from NFLfastR
        </div>
        <div className="text-center text-xs text-gray-600/70 tracking-wider font-light">
          TIBER v1.0 — Tactical Index for Breakout Efficiency & Regression
        </div>
      </div>

      {/* Player Detail Drawer */}
      {selectedPlayer && (
        <PlayerDetailDrawer
          isOpen={isDrawerOpen}
          onClose={handleDrawerClose}
          nflfastrId={selectedPlayer.nflfastrId}
          playerName={selectedPlayer.name}
          team={selectedPlayer.team}
          position={selectedPlayer.position}
          week={selectedWeek}
          season={2025}
        />
      )}
        </>
      )}
    </div>
  );
}
