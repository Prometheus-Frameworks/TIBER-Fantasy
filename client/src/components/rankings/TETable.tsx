import { ArrowUpDown } from 'lucide-react';

interface TESandboxPlayer {
  playerId: string;
  playerName: string;
  team: string;
  gamesPlayed: number;
  totalTargets: number;
  totalReceptions: number;
  totalReceivingYards: number;
  totalReceivingTDs: number;
  fantasyPointsPpr: number;
  fpPerGame: number;
  fpPerTarget: number;
  slotPct: number;
  inlinePct: number;
  snapStickinessIndex: number;
  rzTargets: number;
  tdRoleScore: number;
  archetype: 'BIG_SLOT' | 'INLINE' | 'HYBRID' | 'H_BACK';
  floorFp: number;
  ceilingFp: number;
  contextTag: string | null;
  customAlphaScore?: number;
  alphaScore?: number;
  injuryStatus: string | null;
  forge_env_score_100?: number | null;
  forge_env_multiplier?: number;
  forge_matchup_score_100?: number | null;
  forge_matchup_multiplier?: number;
  forge_opponent?: string | null;
}

type SortField = string;

interface TETableProps {
  sortedData: TESandboxPlayer[] | undefined;
  isLoading: boolean;
  isCustomWeights: boolean;
  sortField: SortField;
  handleSort: (field: SortField) => void;
}

const ARCHETYPE_COLORS: Record<string, string> = {
  'BIG_SLOT': 'bg-indigo-600/40 text-indigo-200',
  'INLINE': 'bg-amber-600/40 text-amber-200',
  'HYBRID': 'bg-cyan-600/40 text-cyan-200',
  'H_BACK': 'bg-gray-600/40 text-gray-300',
};

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

export default function TETable({ sortedData, isLoading, isCustomWeights, sortField, handleSort }: TETableProps) {
  return (
    <div className="bg-[#111217] border border-gray-800/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#0d0e11] border-b border-gray-800/50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Rank</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="playerName" label="Player" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="team" label="Team" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <SortButton field="gamesPlayed" label="G" sortField={sortField} handleSort={handleSort} />
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-lime-400 uppercase tracking-wider" title="TE Role Archetype (Phase 2)">Type</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-green-400 uppercase tracking-wider">Tgts</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-red-400 uppercase tracking-wider" title="Red Zone Targets (Phase 2)">RZ</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-amber-400 uppercase tracking-wider" title="Total Receiving TDs">TDs</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-pink-400 uppercase tracking-wider" title="TD Role Score (Phase 2)">TD Role</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-cyan-400 uppercase tracking-wider">FP/G</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-orange-400 uppercase tracking-wider">FP/Tgt</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-indigo-400 uppercase tracking-wider" title="Slot% / Inline%">Align</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-emerald-400 uppercase tracking-wider" title="Snap Stickiness Index 2.0">SSI</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-yellow-400 uppercase tracking-wider" title="Floor/Ceiling (P20/P80)">Range</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider" title="Context Tag (Phase 2)">Context</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-sky-400 uppercase tracking-wider" title="Team Offensive Environment (v0.2.1)">Env</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-rose-400 uppercase tracking-wider" title="Matchup vs Opponent Defense (v0.2.2)">Matchup</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-purple-400 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('alphaScore')}
                  className="flex items-center gap-1 hover:text-purple-300 transition-colors"
                  data-testid="te-sort-alphaScore"
                >
                  <span>Alpha</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(10)].map((_, idx) => (
                <tr key={idx} className="border-b border-gray-800/30">
                  <td colSpan={16} className="px-4 py-4">
                    <div className="h-8 bg-gray-700/30 rounded animate-pulse"></div>
                  </td>
                </tr>
              ))
            ) : (
              sortedData?.map((tePlayer, idx) => (
                <tr
                  key={tePlayer.playerId}
                  className="border-b border-gray-800/30 hover:bg-amber-500/5 transition-colors"
                  data-testid={`te-sandbox-row-${idx}`}
                >
                  <td className="px-3 py-3 text-gray-500 font-medium">{idx + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{tePlayer.playerName}</span>
                      {(tePlayer.injuryStatus === 'IR' || tePlayer.injuryStatus === 'OUT' || tePlayer.injuryStatus === 'PUP') && (
                        <span className="px-1.5 py-0.5 bg-red-600/80 text-white text-[10px] font-bold rounded uppercase tracking-wide">
                          {tePlayer.injuryStatus}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-1 bg-gray-800/70 text-gray-300 rounded text-xs font-medium">{tePlayer.team}</span>
                  </td>
                  <td className="px-3 py-3 text-center text-gray-300">{tePlayer.gamesPlayed}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${ARCHETYPE_COLORS[tePlayer.archetype] || 'bg-gray-600/40 text-gray-300'}`}>
                      {tePlayer.archetype === 'BIG_SLOT' ? 'Slot' :
                       tePlayer.archetype === 'INLINE' ? 'Inline' :
                       tePlayer.archetype === 'H_BACK' ? 'H-back' : 'Hybrid'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-green-300 font-semibold">{tePlayer.totalTargets}</td>
                  <td className="px-3 py-3 text-center text-red-300 font-medium">{tePlayer.rzTargets ?? 0}</td>
                  <td className="px-3 py-3 text-center text-amber-300 font-bold">{tePlayer.totalReceivingTDs}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-semibold ${(tePlayer.tdRoleScore ?? 0) >= 0.5 ? 'text-pink-400' : (tePlayer.tdRoleScore ?? 0) >= 0.3 ? 'text-pink-300' : 'text-gray-400'}`}>
                      {((tePlayer.tdRoleScore ?? 0) * 100).toFixed(0)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-cyan-300 font-medium">{tePlayer.fpPerGame.toFixed(1)}</td>
                  <td className="px-3 py-3 text-center text-orange-300">{tePlayer.fpPerTarget.toFixed(2)}</td>
                  <td className="px-3 py-3 text-center text-indigo-300 text-xs">
                    {(tePlayer.slotPct * 100).toFixed(0)}/{(tePlayer.inlinePct * 100).toFixed(0)}
                  </td>
                  <td className="px-3 py-3 text-center text-emerald-300 font-medium">{tePlayer.snapStickinessIndex.toFixed(0)}</td>
                  <td className="px-3 py-3 text-center text-yellow-300 text-xs">
                    {tePlayer.floorFp?.toFixed(1) ?? '–'}/{tePlayer.ceilingFp?.toFixed(1) ?? '–'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {tePlayer.contextTag ? (
                      <span className="text-[10px] text-gray-400 italic">{tePlayer.contextTag.split(' – ')[0]}</span>
                    ) : (
                      <span className="text-gray-600">–</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {tePlayer.forge_env_score_100 != null ? (
                      <span
                        className={`font-medium ${
                          tePlayer.forge_env_score_100 >= 60 ? 'text-green-400' :
                          tePlayer.forge_env_score_100 >= 55 ? 'text-emerald-400' :
                          tePlayer.forge_env_score_100 >= 45 ? 'text-sky-300' :
                          tePlayer.forge_env_score_100 >= 40 ? 'text-orange-400' :
                          'text-red-400'
                        }`}
                        title={`Env: ${tePlayer.forge_env_score_100} (${tePlayer.forge_env_multiplier?.toFixed(3)}x)`}
                      >
                        {tePlayer.forge_env_score_100}
                      </span>
                    ) : (
                      <span className="text-gray-600">–</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {tePlayer.forge_matchup_score_100 != null && tePlayer.forge_opponent ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={`text-xs font-medium ${
                            tePlayer.forge_matchup_score_100 >= 70 ? 'text-green-400' :
                            tePlayer.forge_matchup_score_100 >= 55 ? 'text-emerald-400' :
                            tePlayer.forge_matchup_score_100 >= 45 ? 'text-rose-300' :
                            tePlayer.forge_matchup_score_100 >= 30 ? 'text-orange-400' :
                            'text-red-400'
                          }`}
                          title={`vs ${tePlayer.forge_opponent}: ${tePlayer.forge_matchup_score_100} (${tePlayer.forge_matchup_multiplier?.toFixed(3)}x)`}
                        >
                          {tePlayer.forge_opponent}
                        </span>
                        <span className="text-[10px] text-gray-500">{tePlayer.forge_matchup_score_100}</span>
                      </div>
                    ) : (
                      <span className="text-gray-600">–</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-bold text-purple-400 text-base">{tePlayer.alphaScore?.toFixed(1) ?? tePlayer.customAlphaScore ?? 0}</span>
                      {isCustomWeights && (
                        <span className="text-[9px] text-purple-300/60 uppercase tracking-wide">custom</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
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
