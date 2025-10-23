import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface EPARanking {
  rank: number;
  playerId: string;
  playerName: string;
  team: string;
  rawEpa: number;
  adjustedEpa: number;
  totalAdjustment: number;
  attempts: number;
  cpoe: number | null;
  completionPct: number | null;
  tier: 'elite' | 'good' | 'average' | 'below-average' | 'poor';
}

export default function EPARankingsTab() {
  // Query EPA rankings
  const { data: rankingsData, isLoading } = useQuery({
    queryKey: ['/api/sanity-check/epa-rankings'],
  });

  const rankings: EPARanking[] = (rankingsData as any)?.data?.rankings || [];

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'elite': return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
      case 'good': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'average': return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
      case 'below-average': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'poor': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case 'elite': return 'Elite';
      case 'good': return 'Good';
      case 'average': return 'Average';
      case 'below-average': return 'Below Avg';
      case 'poor': return 'Poor';
      default: return tier;
    }
  };

  const getEPAColor = (epa: number) => {
    if (epa >= 0.20) return 'text-purple-400';
    if (epa >= 0.10) return 'text-blue-400';
    if (epa >= 0.00) return 'text-green-400';
    if (epa >= -0.10) return 'text-orange-400';
    return 'text-red-400';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-4 h-4 text-yellow-400" />;
    if (rank === 2) return <Trophy className="w-4 h-4 text-gray-300" />;
    if (rank === 3) return <Trophy className="w-4 h-4 text-amber-600" />;
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">Loading EPA rankings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            QB EPA Rankings
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            QBs ranked by adjusted EPA/play (context-adjusted performance)
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      {(rankingsData as any)?.data?.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-[#141824] border-gray-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-400">Total QBs</p>
                <p className="text-3xl font-bold text-gray-100">{(rankingsData as any).data.summary.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#141824] border-gray-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-400">Avg Adjusted EPA</p>
                <p className="text-3xl font-bold text-blue-400">
                  {(rankingsData as any).data.summary.avgAdjustedEpa?.toFixed(3) || 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#141824] border-gray-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-400">Elite Tier (Top 20%)</p>
                <p className="text-3xl font-bold text-purple-400">
                  {rankings.filter(r => r.tier === 'elite').length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rankings Table */}
      <Card className="bg-[#141824] border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg text-gray-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            QB Performance Rankings
          </CardTitle>
          <CardDescription className="text-gray-400">
            Ranked by context-adjusted EPA per play (higher is better)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Player</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Team</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Raw EPA</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Adj EPA</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">CPOE</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Comp %</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Attempts</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Tier</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((qb) => (
                  <tr 
                    key={qb.playerId} 
                    className="border-b border-gray-800 hover:bg-[#1e2330] transition-colors"
                    data-testid={`ranking-row-${qb.playerId}`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getRankIcon(qb.rank)}
                        <span className="font-mono text-gray-300">{qb.rank}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-100">{qb.playerName}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-400">{qb.team}</span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-mono ${getEPAColor(qb.rawEpa)}`}>
                        {qb.rawEpa.toFixed(3)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-mono font-semibold ${getEPAColor(qb.adjustedEpa)}`}>
                        {qb.adjustedEpa.toFixed(3)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-mono text-sm ${qb.cpoe !== null && qb.cpoe !== undefined ? (qb.cpoe > 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-500'}`}>
                        {qb.cpoe !== null && qb.cpoe !== undefined ? `${(qb.cpoe * 100).toFixed(1)}%` : 'N/A'}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className="font-mono text-sm text-gray-400">
                        {qb.completionPct !== null && qb.completionPct !== undefined ? `${(qb.completionPct * 100).toFixed(1)}%` : 'N/A'}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className="font-mono text-sm text-gray-400">{qb.attempts}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <Badge className={`${getTierColor(qb.tier)} text-xs border`}>
                        {getTierLabel(qb.tier)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rankings.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No EPA data available. Run the EPA calculation first.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
