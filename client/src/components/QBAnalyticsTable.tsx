import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TrendingUp, Users, Target } from 'lucide-react';

interface QBData {
  playerName: string;
  team: string;
  passingAttempts: number;
  completions: number;
  passingYards: number;
  passingTouchdowns: number;
  interceptions: number;
  completionPercentage: number;
  yardsPerAttempt: number;
  rushingYards: number;
  rushingTouchdowns: number;
  fantasyPoints: number;
}

interface QBAnalyticsResponse {
  success: boolean;
  data: QBData[];
  count: number;
  timestamp: string;
}

// Small sample detection: QBs with under 150 pass attempts
const isSmallSample = (qb: QBData): boolean => qb.passingAttempts < 150;

const QBAnalyticsTable = () => {
  const { data, isLoading, error } = useQuery<QBAnalyticsResponse>({
    queryKey: ['/api/analytics/qb-advanced-stats'],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">Failed to load QB analytics data</p>
      </div>
    );
  }

  const qbStats = data?.data || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold">QB Analytics Table</h1>
        <p className="text-gray-600 mt-1">
          2024 NFL Season • Small Sample: &lt;150 pass attempts
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total QBs</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{qbStats.length}</div>
            <div className="text-sm text-gray-600">Players analyzed</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Elite QBs</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {qbStats.filter(qb => qb.completionPercentage >= 65 && qb.yardsPerAttempt >= 7.5).length}
            </div>
            <div className="text-sm text-gray-600">65%+ comp, 7.5+ YPA</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Dual-Threat QBs</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {qbStats.filter(qb => qb.rushingYards >= 200).length}
            </div>
            <div className="text-sm text-gray-600">200+ rushing yards</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Small Sample</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {qbStats.filter(qb => isSmallSample(qb)).length}
            </div>
            <div className="text-sm text-gray-600">Small Sample (&lt; 150 attempts)</div>
          </CardContent>
        </Card>
      </div>

      {/* QB Analytics Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            QB Analytics • {qbStats.length} Players
          </CardTitle>
          <CardDescription>
            Comprehensive quarterback statistics with small sample warnings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Player</th>
                  <th className="text-right p-3 font-medium">Pass Att</th>
                  <th className="text-right p-3 font-medium">Comp</th>
                  <th className="text-right p-3 font-medium">Pass Yds</th>
                  <th className="text-right p-3 font-medium">Pass TDs</th>
                  <th className="text-right p-3 font-medium">INTs</th>
                  <th className="text-right p-3 font-medium">Comp%</th>
                  <th className="text-right p-3 font-medium">YPA</th>
                  <th className="text-right p-3 font-medium">Rush Yds</th>
                  <th className="text-right p-3 font-medium">Rush TDs</th>
                  <th className="text-right p-3 font-medium">Fantasy Pts</th>
                </tr>
              </thead>
              <tbody>
                {qbStats.map((qb, index) => {
                  const smallSample = isSmallSample(qb);
                  const isElite = qb.completionPercentage >= 65 && qb.yardsPerAttempt >= 7.5;
                  
                  return (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {smallSample && (
                            <span 
                              className="text-orange-500 cursor-help" 
                              title="Small sample size (< 150 attempts)"
                            >
                              🚧
                            </span>
                          )}
                          <div>
                            <div className="font-medium">{qb.playerName}</div>
                            <div className="text-sm text-gray-500">{qb.team}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-right p-3">
                        {qb.passingAttempts}
                        {smallSample && (
                          <span className="text-orange-500 ml-1 text-sm">(SS)</span>
                        )}
                      </td>
                      <td className="text-right p-3">{qb.completions}</td>
                      <td className="text-right p-3">{qb.passingYards}</td>
                      <td className="text-right p-3">{qb.passingTouchdowns}</td>
                      <td className="text-right p-3">{qb.interceptions}</td>
                      <td className="text-right p-3">
                        <span className={qb.completionPercentage >= 65 ? 'text-green-600 font-semibold' : ''}>
                          {qb.completionPercentage.toFixed(2)}%
                        </span>
                      </td>
                      <td className="text-right p-3">
                        <span className={qb.yardsPerAttempt >= 7.5 ? 'text-green-600 font-semibold' : ''}>
                          {qb.yardsPerAttempt.toFixed(2)}
                        </span>
                      </td>
                      <td className="text-right p-3">
                        <span className={qb.rushingYards >= 200 ? 'text-purple-600 font-semibold' : ''}>
                          {qb.rushingYards}
                        </span>
                      </td>
                      <td className="text-right p-3">{qb.rushingTouchdowns}</td>
                      <td className="text-right p-3">
                        <span className={qb.fantasyPoints >= 300 ? 'text-blue-600 font-semibold' : ''}>
                          {qb.fantasyPoints}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Data Attribution */}
      <div className="text-sm text-gray-500 text-center">
        Data powered by NFL-Data-Py • Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleString() : 'Loading...'}
      </div>
    </div>
  );
};

export default QBAnalyticsTable;