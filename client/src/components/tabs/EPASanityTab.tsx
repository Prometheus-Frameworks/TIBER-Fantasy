import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, MinusCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface EPAComparison {
  playerId: string;
  playerName: string;
  baldwin: {
    rawEpa: number;
    adjEpa: number;
    diff: number;
  };
  tiber: {
    rawEpa: number | null;
    adjEpa: number | null;
    totalAdj: number;
    dropAdj: number;
    pressureAdj: number;
    yacAdj: number;
    defAdj: number;
  } | null;
  difference: number | null;
}

export default function EPASanityTab() {
  const [isCalculating, setIsCalculating] = useState(false);

  // Query Baldwin reference data
  const { data: baldwinData, isLoading: isLoadingBaldwin } = useQuery({
    queryKey: ['/api/sanity-check/baldwin-reference'],
  });

  // Query comparison data
  const { data: comparisonData, isLoading: isLoadingComparison, refetch: refetchComparison } = useQuery({
    queryKey: ['/api/sanity-check/compare-epa'],
  });

  const handleCalculateContext = async () => {
    setIsCalculating(true);
    try {
      await apiRequest('POST', '/api/sanity-check/calculate-context', { season: 2025 });
      await apiRequest('POST', '/api/sanity-check/calculate-tiber-epa', { season: 2025 });
      await refetchComparison();
    } catch (error) {
      console.error('Failed to calculate:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const comparisons: EPAComparison[] = (comparisonData as any)?.data?.comparisons || [];
  
  // Test cases: Flacco, Allen, Darnold
  const testCases = comparisons.filter(c => 
    c.playerName.includes('Flacco') || 
    c.playerName.includes('Allen') || 
    c.playerName.includes('Darnold')
  );

  const getDifferenceColor = (diff: number | null) => {
    if (diff === null) return 'text-gray-500';
    const abs = Math.abs(diff);
    if (abs < 0.03) return 'text-green-500';
    if (abs < 0.10) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getDifferenceIcon = (diff: number | null) => {
    if (diff === null) return MinusCircle;
    const abs = Math.abs(diff);
    if (abs < 0.03) return CheckCircle2;
    if (abs < 0.10) return AlertCircle;
    return AlertCircle;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            EPA Sanity Check
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Validate our EPA calculations against Ben Baldwin's adjusted EPA methodology
          </p>
        </div>
        <Button
          onClick={handleCalculateContext}
          disabled={isCalculating}
          className="bg-gradient-to-r from-blue-500 to-purple-600"
          data-testid="button-calculate-epa"
        >
          <FlaskConical className="w-4 h-4 mr-2" />
          {isCalculating ? 'Calculating...' : 'Calculate EPA'}
        </Button>
      </div>

      {/* Summary Card */}
      {(comparisonData as any)?.data?.summary && (
        <Card className="bg-[#141824] border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg text-gray-100">System Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-400">Total QBs</p>
              <p className="text-2xl font-bold text-gray-100">{(comparisonData as any).data.summary.total}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">With Tiber Data</p>
              <p className="text-2xl font-bold text-blue-400">{(comparisonData as any).data.summary.withTiberData}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Avg Difference</p>
              <p className="text-2xl font-bold text-purple-400">
                {(comparisonData as any).data.summary.avgDifference?.toFixed(3) || 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Cases: Flacco, Allen, Darnold */}
      {testCases.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-100 mb-4">Test Cases</h2>
          <div className="grid gap-4">
            {testCases.map(qb => {
              const DiffIcon = getDifferenceIcon(qb.difference);
              const diffColor = getDifferenceColor(qb.difference);
              
              return (
                <Card key={qb.playerId} className="bg-[#141824] border-gray-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg text-gray-100">{qb.playerName}</CardTitle>
                      {qb.difference !== null && (
                        <Badge className={`${diffColor} bg-opacity-10`}>
                          <DiffIcon className="w-3 h-3 mr-1" />
                          Diff: {qb.difference > 0 ? '+' : ''}{qb.difference.toFixed(3)}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-6">
                      {/* Baldwin Column */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-400 mb-3">Ben Baldwin's EPA</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Raw EPA</span>
                            <span className="text-sm font-mono text-gray-300">{qb.baldwin.rawEpa.toFixed(3)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Adjusted EPA</span>
                            <span className="text-sm font-mono text-blue-400">{qb.baldwin.adjEpa.toFixed(3)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Adjustment</span>
                            <span className="text-sm font-mono text-gray-300">
                              {qb.baldwin.diff > 0 ? '+' : ''}{qb.baldwin.diff.toFixed(3)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tiber Column */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-400 mb-3">Tiber's EPA</h3>
                        {qb.tiber ? (
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">Raw EPA</span>
                              <span className="text-sm font-mono text-gray-300">
                                {qb.tiber.rawEpa?.toFixed(3) || 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">Adjusted EPA</span>
                              <span className="text-sm font-mono text-purple-400">
                                {qb.tiber.adjEpa?.toFixed(3) || 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">Total Adjustment</span>
                              <span className="text-sm font-mono text-gray-300">
                                {qb.tiber.totalAdj > 0 ? '+' : ''}{qb.tiber.totalAdj.toFixed(3)}
                              </span>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-700">
                              <p className="text-xs text-gray-500 mb-2">Context Breakdown:</p>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Drop Adj</span>
                                  <span className="font-mono text-gray-400">{qb.tiber.dropAdj?.toFixed(3)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Pressure Adj</span>
                                  <span className="font-mono text-gray-400">{qb.tiber.pressureAdj?.toFixed(3)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">YAC Adj</span>
                                  <span className="font-mono text-gray-400">{qb.tiber.yacAdj?.toFixed(3)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Def Adj</span>
                                  <span className="font-mono text-gray-400">{qb.tiber.defAdj?.toFixed(3)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No Tiber data available</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Comparison Table */}
      {comparisons.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-100 mb-4">All QBs Comparison</h2>
          <Card className="bg-[#141824] border-gray-800">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left p-4 text-sm font-semibold text-gray-400">QB</th>
                      <th className="text-right p-4 text-sm font-semibold text-gray-400">Baldwin Adj</th>
                      <th className="text-right p-4 text-sm font-semibold text-gray-400">Tiber Adj</th>
                      <th className="text-right p-4 text-sm font-semibold text-gray-400">Difference</th>
                      <th className="text-center p-4 text-sm font-semibold text-gray-400">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisons.map(qb => {
                      const DiffIcon = getDifferenceIcon(qb.difference);
                      const diffColor = getDifferenceColor(qb.difference);
                      
                      return (
                        <tr key={qb.playerId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="p-4 text-sm text-gray-300">{qb.playerName}</td>
                          <td className="p-4 text-sm font-mono text-right text-blue-400">
                            {qb.baldwin.adjEpa.toFixed(3)}
                          </td>
                          <td className="p-4 text-sm font-mono text-right text-purple-400">
                            {qb.tiber?.adjEpa?.toFixed(3) || 'N/A'}
                          </td>
                          <td className={`p-4 text-sm font-mono text-right ${diffColor}`}>
                            {qb.difference !== null 
                              ? `${qb.difference > 0 ? '+' : ''}${qb.difference.toFixed(3)}`
                              : 'N/A'
                            }
                          </td>
                          <td className="p-4 text-center">
                            {qb.difference !== null && (
                              <DiffIcon className={`w-4 h-4 ${diffColor} mx-auto`} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {(isLoadingBaldwin || isLoadingComparison) && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  );
}
