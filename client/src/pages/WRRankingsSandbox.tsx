import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown } from 'lucide-react';

type Position = 'WR' | 'RB';
type SortField = 'playerName' | 'team' | 'gamesPlayed' | 'targets' | 'totalCarries' | 'totalRushingYards' | 'fantasyPointsPerRushAttempt' | 'fantasyPoints' | 'pointsPerTarget' | 'samplePenalty' | 'adjustedEfficiency' | 'alphaScore' | 'roleScore' | 'deepTargetRate' | 'slotRouteShareEst' | 'weightedTargetsPerGame' | 'boomRate' | 'bustRate' | 'talentIndex' | 'usageStabilityIndex' | 'roleDelta' | 'redZoneDomScore' | 'energyIndex';
type SortOrder = 'asc' | 'desc';

type RoleTier = 'ALPHA' | 'CO_ALPHA' | 'PRIMARY_SLOT' | 'SECONDARY' | 'ROTATIONAL' | 'UNKNOWN' | null;

interface SandboxPlayer {
  playerId: string;
  playerName: string;
  team: string;
  gamesPlayed: number;
  targets: number;
  fantasyPoints: number;
  pointsPerTarget: number;
  samplePenalty: number;
  adjustedEfficiency: number;
  volumeIndex: number;
  pointsIndex: number;
  efficiencyIndex: number;
  alphaScore: number;
  // Injury status (IR/OUT badges)
  injuryStatus: string | null;
  injuryType: string | null;
  // WR Role Bank metrics
  roleScore: number | null;
  pureRoleScore: number | null;
  volumeScore: number | null;
  consistencyScore: number | null;
  highValueUsageScore: number | null;
  momentumScore: number | null;
  deepTargetRate: number | null;
  slotRouteShareEst: number | null;
  roleTier: RoleTier;
  // Advanced metrics (NEW)
  weightedTargetsPerGame: number | null;
  weightedTargetsIndex: number | null;
  boomRate: number | null;
  bustRate: number | null;
  talentIndex: number | null;
  yardsPerTarget: number | null;
  yardsPerRoute: number | null;
  usageStabilityIndex: number | null;
  roleDelta: number | null;
  recentTargetsPerGame: number | null;
  seasonTargetsPerGame: number | null;
  redZoneDomScore: number | null;
  redZoneTargetsPerGame: number | null;
  endZoneTargetsPerGame: number | null;
  energyIndex: number | null;
  efficiencyTrend: number | null;
}

// RB-specific player interface
interface RBSandboxPlayer {
  playerId: string;
  playerName: string;
  team: string;
  gamesPlayed: number;
  totalCarries: number;
  totalRushingYards: number;
  fantasyPoints: number;
  fantasyPointsPerRushAttempt: number;
  injuryStatus: string | null;
  injuryType: string | null;
}

interface SandboxResponse {
  success: boolean;
  season: number;
  minGames: number;
  minTargets?: number;
  minCarries?: number;
  count: number;
  data: SandboxPlayer[] | RBSandboxPlayer[];
}

export default function WRRankingsSandbox() {
  const [position, setPosition] = useState<Position>('WR');
  const [sortField, setSortField] = useState<SortField>('alphaScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Filter controls
  const [filterCoAlphaSecondary, setFilterCoAlphaSecondary] = useState(false);
  const [highlightDeepThreats, setHighlightDeepThreats] = useState(false);
  const [highlightSlotHeavy, setHighlightSlotHeavy] = useState(false);

  const { data, isLoading } = useQuery<SandboxResponse>({
    queryKey: [position === 'WR' ? '/api/admin/wr-rankings-sandbox' : '/api/admin/rb-rankings-sandbox'],
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Apply filters and sort
  const filteredData = data?.data.filter(player => {
    // Filter: Only CO_ALPHA / SECONDARY
    if (filterCoAlphaSecondary) {
      if (player.roleTier !== 'CO_ALPHA' && player.roleTier !== 'SECONDARY') {
        return false;
      }
    }
    return true;
  });

  const sortedData = filteredData?.slice().sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    // Handle null values (role bank fields may be null)
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1; // null goes to end
    if (bVal === null) return -1; // null goes to end
    
    return sortOrder === 'asc' 
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });
  
  // Helper to check if player should be highlighted
  const isDeepThreat = (player: SandboxPlayer) => 
    highlightDeepThreats && player.deepTargetRate !== null && player.deepTargetRate >= 0.20;
  
  const isSlotHeavy = (player: SandboxPlayer) => 
    highlightSlotHeavy && player.slotRouteShareEst !== null && player.slotRouteShareEst >= 0.45;

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-white transition-colors"
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-blue-400' : 'text-gray-600'}`} />
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-blue-500/20 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-wide">
                {position} RANKINGS SANDBOX
              </h1>
              <p className="text-gray-400 mt-2 text-sm">
                {position === 'WR' 
                  ? 'Algorithm test page - 2025 season, minimum 2 games / 10 targets (includes IR players)'
                  : 'Algorithm test page - 2025 season, minimum 2 games / 15 carries (includes IR players)'
                }
              </p>
            </div>
            {/* Position Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPosition('WR');
                  setSortField('alphaScore');
                }}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  position === 'WR'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                }`}
                data-testid="toggle-wr"
              >
                WR
              </button>
              <button
                onClick={() => {
                  setPosition('RB');
                  setSortField('fantasyPoints');
                }}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  position === 'RB'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                }`}
                data-testid="toggle-rb"
              >
                RB
              </button>
            </div>
          </div>
        </div>

        {/* Info Box - WR only */}
        {position === 'WR' && (
          <>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-blue-300 mb-2">Alpha Composite Score (0-100)</h3>
                <p className="text-xs text-gray-400 mb-1">
                  Blends volume, total fantasy points, and efficiency into a single diagnostic score:
                </p>
                <p className="text-xs text-gray-500">
                  <strong className="text-purple-300">Alpha Score</strong> = 45% Volume + 35% Total Points + 20% Efficiency
                </p>
              </div>
              <div className="border-t border-blue-500/20 pt-2">
                <p className="text-xs text-gray-500">
                  High-volume, high-scoring WRs (JSN, ARSB, Lamb, Puka, Chase) rank at the top. 
                  Low-volume spike guys can still rank well but won't eclipse true workhorse alphas.
                </p>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Filters & Highlights</h3>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterCoAlphaSecondary}
                    onChange={(e) => setFilterCoAlphaSecondary(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-2 focus:ring-blue-500"
                    data-testid="filter-co-alpha-secondary"
                  />
                  <span className="text-sm text-gray-300">Only show CO_ALPHA / SECONDARY</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highlightDeepThreats}
                    onChange={(e) => setHighlightDeepThreats(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-orange-500 focus:ring-2 focus:ring-orange-500"
                    data-testid="highlight-deep-threats"
                  />
                  <span className="text-sm text-gray-300">Highlight deep threats (≥20% deep target rate)</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highlightSlotHeavy}
                    onChange={(e) => setHighlightSlotHeavy(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-2 focus:ring-cyan-500"
                    data-testid="highlight-slot-heavy"
                  />
                  <span className="text-sm text-gray-300">Highlight slot-heavy (≥45% slot share)</span>
                </label>
              </div>
            </div>
          </>
        )}

        {/* Stats Summary */}
        {data && (
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="font-medium text-white">{sortedData?.length || 0}</span>
            <span>{position}s shown (from {data.count} total)</span>
            <span className="text-gray-600">•</span>
            <span>Season: {data.season}</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-500">Sorted by {sortField}</span>
          </div>
        )}

        {/* Table */}
        {position === 'RB' ? (
          // RB Simple Table (Total Carries, Total Rush Yds, FP/Rush)
          <div className="bg-[#111217] border border-gray-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0d0e11] border-b border-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="playerName" label="Player" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="team" label="Team" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="gamesPlayed" label="Games" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="totalCarries" label="Total Carries" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="totalRushingYards" label="Total Rush Yds" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="fantasyPoints" label="Fantasy Pts" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="fantasyPointsPerRushAttempt" label="FP/Rush" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    [...Array(10)].map((_, idx) => (
                      <tr key={idx} className="border-b border-gray-800/30">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="h-8 bg-gray-700/30 rounded animate-pulse"></div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    sortedData?.map((player, idx) => {
                      const rbPlayer = player as RBSandboxPlayer;
                      return (
                        <tr
                          key={rbPlayer.playerId}
                          className="border-b border-gray-800/30 hover:bg-green-500/5 transition-colors"
                          data-testid={`sandbox-row-${idx}`}
                        >
                          <td className="px-4 py-3 text-gray-500 font-medium">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{rbPlayer.playerName}</span>
                              {(rbPlayer.injuryStatus === 'IR' || rbPlayer.injuryStatus === 'OUT' || rbPlayer.injuryStatus === 'PUP') && (
                                <span className="px-1.5 py-0.5 bg-red-600/80 text-white text-[10px] font-bold rounded uppercase tracking-wide">
                                  {rbPlayer.injuryStatus}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-gray-800/70 text-gray-300 rounded text-xs font-medium">
                              {rbPlayer.team}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-300">{rbPlayer.gamesPlayed}</td>
                          <td className="px-4 py-3 text-center text-green-300 font-semibold">{rbPlayer.totalCarries}</td>
                          <td className="px-4 py-3 text-center text-blue-300">{rbPlayer.totalRushingYards}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{rbPlayer.fantasyPoints.toFixed(1)}</td>
                          <td className="px-4 py-3 text-center text-purple-300 font-bold">{rbPlayer.fantasyPointsPerRushAttempt}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {!isLoading && sortedData?.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No data available
                </div>
              )}
            </div>
          </div>
        ) : (
          // WR Complex Table (all the advanced metrics)
          <div className="bg-[#111217] border border-gray-800/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0d0e11] border-b border-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="playerName" label="Player" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="team" label="Team" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="gamesPlayed" label="Games" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="targets" label="Targets" />
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <SortButton field="fantasyPoints" label="Fantasy Pts" />
                    </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="pointsPerTarget" label="Pts/Tgt" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="samplePenalty" label="Sample" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="adjustedEfficiency" label="Adj Pts/Tgt" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="alphaScore" label="Alpha Score" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="roleScore" label="Role Score" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="deepTargetRate" label="Deep %" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="slotRouteShareEst" label="Slot %" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="weightedTargetsPerGame" label="Wt Tgt/G" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="boomRate" label="Boom %" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="bustRate" label="Bust %" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="talentIndex" label="Talent" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="usageStabilityIndex" label="Stability" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="roleDelta" label="Role Δ" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="redZoneDomScore" label="RZ Dom" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <SortButton field="energyIndex" label="Energy" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(10)].map((_, idx) => (
                    <tr key={idx} className="border-b border-gray-800/30">
                      <td colSpan={21} className="px-4 py-4">
                        <div className="h-8 bg-gray-700/30 rounded animate-pulse"></div>
                      </td>
                    </tr>
                  ))
                ) : (
                  sortedData?.map((player, idx) => {
                    const deepThreat = isDeepThreat(player);
                    const slotHeavy = isSlotHeavy(player);
                    const highEnergy = (player.energyIndex ?? 0) >= 80;
                    const rowClassName = `border-b border-gray-800/30 hover:bg-blue-500/5 transition-colors ${
                      deepThreat ? 'bg-orange-500/10' : slotHeavy ? 'bg-cyan-500/10' : highEnergy ? 'bg-green-500/5' : ''
                    }`;
                    
                    return (
                      <tr
                        key={player.playerId}
                        className={rowClassName}
                        data-testid={`sandbox-row-${idx}`}
                      >
                        <td className="px-4 py-3 text-gray-500 font-medium">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{player.playerName}</span>
                            {(player.injuryStatus === 'IR' || player.injuryStatus === 'OUT' || player.injuryStatus === 'PUP') && (
                              <span className="px-1.5 py-0.5 bg-red-600/80 text-white text-[10px] font-bold rounded uppercase tracking-wide">
                                {player.injuryStatus}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-gray-800/70 text-gray-300 rounded text-xs font-medium">
                            {player.team}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-300">{player.gamesPlayed}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{player.targets}</td>
                        <td className="px-4 py-3 text-center text-gray-300">{player.fantasyPoints.toFixed(1)}</td>
                        <td className="px-4 py-3 text-center text-gray-400">{player.pointsPerTarget.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center text-gray-400">{player.samplePenalty.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center text-gray-400">{player.adjustedEfficiency.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-purple-400 text-base">{player.alphaScore}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.roleScore !== null ? (
                            <span className="text-blue-300 font-medium">{player.roleScore}</span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.deepTargetRate !== null ? (
                            <span className={deepThreat ? 'text-orange-400 font-bold' : 'text-gray-300'}>
                              {(player.deepTargetRate * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.slotRouteShareEst !== null ? (
                            <span className={slotHeavy ? 'text-cyan-400 font-bold' : 'text-gray-300'}>
                              {(player.slotRouteShareEst * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        {/* Advanced Metrics (NEW) */}
                        <td className="px-4 py-3 text-center">
                          {player.weightedTargetsPerGame !== null ? (
                            <span className="text-amber-300 font-medium">{player.weightedTargetsPerGame.toFixed(1)}</span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.boomRate !== null ? (
                            <span className="text-green-300">{(player.boomRate * 100).toFixed(0)}%</span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.bustRate !== null ? (
                            <span className="text-red-300">{(player.bustRate * 100).toFixed(0)}%</span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.talentIndex !== null ? (
                            <span className="text-purple-300 font-medium">{player.talentIndex}</span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.usageStabilityIndex !== null ? (
                            <span className="text-blue-300">{player.usageStabilityIndex}</span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.roleDelta !== null ? (
                            <span className={player.roleDelta >= 80 ? 'text-green-400 font-bold' : player.roleDelta <= 50 ? 'text-red-400' : 'text-gray-300'}>
                              {player.roleDelta}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.redZoneDomScore !== null ? (
                            <span className="text-orange-300 font-medium">{player.redZoneDomScore}</span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {player.energyIndex !== null ? (
                            <span className={highEnergy ? 'text-yellow-400 font-bold text-base' : 'text-gray-300'}>
                              {player.energyIndex}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {!isLoading && sortedData?.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>
        )}

        {/* Future Evolution Notes */}
        <div className="bg-gray-800/20 border border-gray-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Next Steps</h3>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• Add weight sliders to adjust formula (e.g., 60% targets, 40% points)</li>
            <li>• Compare multiple formulas side-by-side</li>
            <li>• Add more metrics: target share, routes, red zone targets</li>
            <li>• Export winning formula for other positions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
