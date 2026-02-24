import { ArrowUpDown } from 'lucide-react';

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
  alphaScore: number;
  customAlphaScore?: number;
  injuryStatus: string | null;
  roleScore: number | null;
  deepTargetRate: number | null;
  slotRouteShareEst: number | null;
  weightedTargetsPerGame: number | null;
  boomRate: number | null;
  bustRate: number | null;
  talentIndex: number | null;
  usageStabilityIndex: number | null;
  roleDelta: number | null;
  redZoneDomScore: number | null;
  energyIndex: number | null;
}

type SortField = string;

interface WRTableProps {
  sortedData: SandboxPlayer[] | undefined;
  isLoading: boolean;
  sortField: SortField;
  handleSort: (field: SortField) => void;
  isDeepThreat: (player: SandboxPlayer) => boolean;
  isSlotHeavy: (player: SandboxPlayer) => boolean;
}

function SortButton({ field, label, sortField, handleSort }: { field: SortField; label: string; sortField: SortField; handleSort: (f: SortField) => void }) {
  return (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-white transition-colors"
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-blue-400' : 'text-gray-600'}`} />
    </button>
  );
}

export default function WRTable({ sortedData, isLoading, sortField, handleSort, isDeepThreat, isSlotHeavy }: WRTableProps) {
  return (
    <div className="bg-[#111217] border border-gray-800/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#0d0e11] border-b border-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="playerName" label="Player" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="team" label="Team" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="gamesPlayed" label="Games" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="targets" label="Targets" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="fantasyPoints" label="Fantasy Pts" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="pointsPerTarget" label="Pts/Tgt" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="samplePenalty" label="Sample" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="adjustedEfficiency" label="Adj Pts/Tgt" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-purple-400 uppercase tracking-wider">
                <SortButton field="customAlphaScore" label="Custom Score" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="roleScore" label="Role Score" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="deepTargetRate" label="Deep %" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="slotRouteShareEst" label="Slot %" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="weightedTargetsPerGame" label="Wt Tgt/G" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="boomRate" label="Boom %" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="bustRate" label="Bust %" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="talentIndex" label="Talent" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="usageStabilityIndex" label="Stability" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="roleDelta" label="Role Δ" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="redZoneDomScore" label="RZ Dom" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="energyIndex" label="Energy" sortField={sortField} handleSort={handleSort} />
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
                      <span className="px-2 py-1 bg-gray-800/70 text-gray-300 rounded text-xs font-medium">{player.team}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-300">{player.gamesPlayed}</td>
                    <td className="px-4 py-3 text-center text-gray-300">{player.targets}</td>
                    <td className="px-4 py-3 text-center text-gray-300">{player.fantasyPoints.toFixed(1)}</td>
                    <td className="px-4 py-3 text-center text-gray-400">{player.pointsPerTarget.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-gray-400">{player.samplePenalty.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-gray-400">{player.adjustedEfficiency.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-bold text-purple-400 text-base">{player.customAlphaScore ?? player.alphaScore}</span>
                        {player.customAlphaScore && player.customAlphaScore !== player.alphaScore && (
                          <span className="text-[9px] text-purple-300/60 uppercase tracking-wide">custom</span>
                        )}
                      </div>
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
  );
}
