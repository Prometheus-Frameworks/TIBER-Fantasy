import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TrendingUp, Users, Target } from 'lucide-react';

interface TEData {
  playerName: string;
  team: string;
  targets: number;
  receptions: number;
  receivingYards: number;
  receivingTouchdowns: number;
  yardsPerRouteRun: number;
  firstDowns: number;
  redZoneTargets: number;
  targetShare: number;
  snapPercentage: number;
  fantasyPoints: number;
}

interface TEAnalyticsResponse {
  success: boolean;
  data: TEData[];
  count: number;
  timestamp: string;
}

// Small sample detection: TEs with under 50 targets
const isSmallSample = (te: TEData): boolean => te.targets < 50;

const TEAnalyticsTable = () => {
  const { data, isLoading, error } = useQuery<TEAnalyticsResponse>({
    queryKey: ['/api/analytics/te-advanced-stats'],
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
        <p className="text-red-600">Failed to load TE analytics data</p>
      </div>
    );
  }

  const teStats = data?.data || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold">TE Analytics Table</h1>
        <p className="text-gray-600 mt-1">
          2024 NFL Season • Small Sample: &lt;50 targets
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total TEs</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{teStats.length}</div>
            <div className="text-sm text-gray-600">Players analyzed</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Elite TEs</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {teStats.filter(te => te.targets >= 80 && te.yardsPerRouteRun >= 1.5).length}
            </div>
            <div className="text-sm text-gray-600">80+ targets, 1.5+ YPRR</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">TD Leaders</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {teStats.filter(te => te.receivingTouchdowns >= 6).length}
            </div>
            <div className="text-sm text-gray-600">6+ receiving TDs</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Small Sample</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {teStats.filter(te => isSmallSample(te)).length}
            </div>
            <div className="text-sm text-gray-600">Small Sample (&lt; 50 targets)</div>
          </CardContent>
        </Card>
      </div>

      {/* TE Analytics Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            TE Analytics • {teStats.length} Players
          </CardTitle>
          <CardDescription>
            Comprehensive tight end statistics with small sample warnings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">Player</th>
                  <th className="text-right p-3 font-medium">Targets</th>
                  <th className="text-right p-3 font-medium">Rec</th>
                  <th className="text-right p-3 font-medium">Rec Yds</th>
                  <th className="text-right p-3 font-medium">Rec TDs</th>
                  <th className="text-right p-3 font-medium">YPRR</th>
                  <th className="text-right p-3 font-medium">1st Downs</th>
                  <th className="text-right p-3 font-medium">RZ Targets</th>
                  <th className="text-right p-3 font-medium">Target %</th>
                  <th className="text-right p-3 font-medium">Snap %</th>
                  <th className="text-right p-3 font-medium">Fantasy Pts</th>
                </tr>
              </thead>
              <tbody>
                {teStats.map((te, index) => {
                  const smallSample = isSmallSample(te);
                  const isElite = te.targets >= 80 && te.yardsPerRouteRun >= 1.5;
                  
                  return (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {smallSample && (
                            <span 
                              className="text-orange-500 cursor-help" 
                              title="Small sample size (< 50 targets)"
                            >
                              🚧
                            </span>
                          )}
                          <div>
                            <div className="font-medium">{te.playerName}</div>
                            <div className="text-sm text-gray-500">{te.team}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-right p-3">
                        {te.targets}
                        {smallSample && (
                          <span className="text-orange-500 ml-1 text-sm">(SS)</span>
                        )}
                      </td>
                      <td className="text-right p-3">{te.receptions}</td>
                      <td className="text-right p-3">{te.receivingYards}</td>
                      <td className="text-right p-3">
                        <span className={te.receivingTouchdowns >= 6 ? 'text-purple-600 font-semibold' : ''}>
                          {te.receivingTouchdowns}
                        </span>
                      </td>
                      <td className="text-right p-3">
                        <span className={te.yardsPerRouteRun >= 1.5 ? 'text-green-600 font-semibold' : ''}>
                          {te.yardsPerRouteRun.toFixed(2)}
                        </span>
                      </td>
                      <td className="text-right p-3">{te.firstDowns}</td>
                      <td className="text-right p-3 text-gray-500">
                        {te.redZoneTargets === 0 ? 'NA' : te.redZoneTargets}
                      </td>
                      <td className="text-right p-3">
                        <span className={te.targetShare >= 15 ? 'text-blue-600 font-semibold' : ''}>
                          {te.targetShare === 0 ? 'NA' : `${te.targetShare.toFixed(2)}%`}
                        </span>
                      </td>
                      <td className="text-right p-3 text-gray-500">
                        {te.snapPercentage === 0 ? 'NA' : `${te.snapPercentage.toFixed(2)}%`}
                      </td>
                      <td className="text-right p-3">
                        <span className={te.fantasyPoints >= 150 ? 'text-blue-600 font-semibold' : ''}>
                          {te.fantasyPoints}
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

export default TEAnalyticsTable;