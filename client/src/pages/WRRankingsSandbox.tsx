import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown } from 'lucide-react';

type SortField = 'playerName' | 'team' | 'gamesPlayed' | 'targets' | 'fantasyPoints' | 'pointsPerTarget' | 'samplePenalty' | 'adjustedEfficiency';
type SortOrder = 'asc' | 'desc';

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
}

interface SandboxResponse {
  success: boolean;
  season: number;
  minGames: number;
  minTargets?: number;
  count: number;
  data: SandboxPlayer[];
}

export default function WRRankingsSandbox() {
  const [sortField, setSortField] = useState<SortField>('adjustedEfficiency');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const { data, isLoading } = useQuery<SandboxResponse>({
    queryKey: ['/api/admin/wr-rankings-sandbox'],
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedData = data?.data.slice().sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    return sortOrder === 'asc' 
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

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
          <h1 className="text-3xl font-bold text-white tracking-wide">WR RANKINGS SANDBOX</h1>
          <p className="text-gray-400 mt-2 text-sm">
            Algorithm test page - 2025 season, minimum 4 games played
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-300 mb-2">Volume-Weighted Efficiency</h3>
          <p className="text-xs text-gray-400 mb-2">
            <strong className="text-blue-300">Adjusted Pts/Tgt</strong> = Points per Target × Sample Penalty (min 1, targets ÷ 50)
          </p>
          <p className="text-xs text-gray-500">
            This formula prevents low-volume outliers from dominating rankings. 
            WRs need both <span className="text-gray-300">efficiency</span> and <span className="text-gray-300">volume</span> to rank highly.
          </p>
        </div>

        {/* Stats Summary */}
        {data && (
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="font-medium text-white">{data.count}</span>
            <span>WRs with {data.minGames}+ games & {data.minTargets || 15}+ targets</span>
            <span className="text-gray-600">•</span>
            <span>Season: {data.season}</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-500">Sorted by Adjusted Efficiency</span>
          </div>
        )}

        {/* Table */}
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
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(10)].map((_, idx) => (
                    <tr key={idx} className="border-b border-gray-800/30">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="h-8 bg-gray-700/30 rounded animate-pulse"></div>
                      </td>
                    </tr>
                  ))
                ) : (
                  sortedData?.map((player, idx) => (
                    <tr
                      key={player.playerId}
                      className="border-b border-gray-800/30 hover:bg-blue-500/5 transition-colors"
                      data-testid={`sandbox-row-${idx}`}
                    >
                      <td className="px-4 py-3 text-gray-500 font-medium">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{player.playerName}</div>
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
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-green-400">{player.adjustedEfficiency.toFixed(2)}</span>
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
