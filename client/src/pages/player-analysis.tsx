import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, TrendingUp, Target, BarChart3, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import MobileNav from "@/components/mobile-nav";

interface PlayerAnalysis {
  player: {
    name: string;
    team: string;
    position: string;
    season: number;
  };
  separation_metrics: {
    avg_separation: number;
    avg_cushion: number;
    avg_separation_percentile: number;
    avg_intended_air_yards: number;
    percent_share_of_intended_air_yards: number;
  };
  receiving_metrics: {
    targets: number;
    receptions: number;
    receiving_yards: number;
    receiving_tds: number;
    catch_percentage: number;
    avg_yac: number;
    avg_yac_above_expectation: number;
  };
  efficiency_metrics: {
    yards_per_target: number;
    yards_per_reception: number;
    air_yards_vs_separation: number;
  };
  weekly_progression?: Array<{
    week: number;
    targets: number;
    receptions: number;
    receiving_yards: number;
    receiving_tds: number;
    target_share: number;
    air_yards_share: number;
    fantasy_points_ppr: number;
  }>;
  season_trends?: {
    target_trend: string;
    early_season_avg_targets: number;
    late_season_avg_targets: number;
    target_improvement: number;
  };
  error?: string;
}

interface PlayerSearchResult {
  id: number;
  name: string;
  team: string;
  position: string;
}

export default function PlayerAnalysisPage() {
  const [searchTerm, setSearchTerm] = useState("Rome Odunze");
  const [searchInput, setSearchInput] = useState("Rome Odunze");
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: analysis, isLoading, error } = useQuery<PlayerAnalysis>({
    queryKey: ["/api/analysis/player", searchTerm],
    queryFn: async () => {
      const response = await fetch(`/api/analysis/player/${encodeURIComponent(searchTerm)}`);
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!searchTerm,
  });

  const handleSearch = () => {
    if (searchInput.trim()) {
      setSearchTerm(searchInput.trim());
    }
  };

  const getSeparationRating = (percentile: number) => {
    if (percentile >= 75) return { label: "Elite", color: "text-green-600", bgColor: "bg-green-50", borderColor: "border-green-200" };
    if (percentile >= 50) return { label: "Above Avg", color: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-200" };
    if (percentile >= 25) return { label: "Below Avg", color: "text-yellow-600", bgColor: "bg-yellow-50", borderColor: "border-yellow-200" };
    return { label: "Poor", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200" };
  };

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 75) return "text-green-600";
    if (percentile >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getMetricColor = (value: number, thresholds: { good: number; avg: number }) => {
    if (value >= thresholds.good) return "text-green-600";
    if (value >= thresholds.avg) return "text-yellow-600";
    return "text-red-600";
  };

  const getMetricBoxStyle = (value: number, thresholds: { good: number; avg: number }) => {
    if (value >= thresholds.good) return "bg-green-50 border-green-200";
    if (value >= thresholds.avg) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  };

  const getTargetTrendIcon = (trend: string) => {
    return trend === "increasing" ? (
      <TrendingUp className="w-4 h-4 text-green-600" />
    ) : (
      <div className="w-4 h-4 text-red-600">↓</div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mr-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Player Analysis</h1>
              <p className="text-sm text-gray-500">NFL performance data and season trends</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search */}
        <Card className="p-6 mb-6">
          <div className="flex space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Search player name (e.g., Rome Odunze, Justin Jefferson)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} className="bg-field-green hover:bg-dark-green">
              <Search className="w-4 h-4 mr-2" />
              Analyze
            </Button>
          </div>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-field-green mx-auto"></div>
            <p className="text-gray-600 mt-2">Analyzing player data...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="p-6 text-center">
            <p className="text-red-600 mb-4">Error loading player analysis. Please try another player.</p>
            <p className="text-sm text-gray-600">Available players: Rome Odunze, Justin Jefferson, Tyreek Hill, CeeDee Lamb</p>
            <p className="text-xs text-gray-500 mt-2">Note: Search is case-insensitive. Try "justin jefferson" or "rome odunze"</p>
          </Card>
        )}

        {/* Analysis Results */}
        {analysis && !analysis.error && (
          <div className="space-y-6">
            {/* Player Header */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-field-green rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">{analysis.player.position}</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{analysis.player.name}</h2>
                    <p className="text-gray-600">{analysis.player.team} • {analysis.player.season} Season</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Powered by</div>
                  <div className="font-semibold text-field-green">NFL Next Gen Stats</div>
                </div>
              </div>
            </Card>

            {/* Separation Metrics */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2" />
                Separation Analytics
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className={`${getSeparationRating(analysis.separation_metrics.avg_separation_percentile).bgColor} ${getSeparationRating(analysis.separation_metrics.avg_separation_percentile).borderColor} border rounded-lg p-4`}>
                  <div className="text-2xl font-bold text-gray-900">{analysis.separation_metrics.avg_separation.toFixed(2)}</div>
                  <div className="text-sm text-gray-600">Avg Separation (yards)</div>
                  <div className="flex items-center mt-2">
                    <Progress value={analysis.separation_metrics.avg_separation_percentile} className="flex-1 h-2" />
                    <span className={`ml-2 text-sm font-medium ${getSeparationRating(analysis.separation_metrics.avg_separation_percentile).color}`}>
                      {getSeparationRating(analysis.separation_metrics.avg_separation_percentile).label}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{analysis.separation_metrics.avg_separation_percentile.toFixed(1)}th percentile</div>
                </div>

                <div className={`${getMetricBoxStyle(analysis.separation_metrics.avg_cushion, { good: 6.0, avg: 4.5 })} border rounded-lg p-4`}>
                  <div className="text-2xl font-bold text-gray-900">{analysis.separation_metrics.avg_cushion.toFixed(1)}</div>
                  <div className="text-sm text-gray-600">Avg Cushion (yards)</div>
                  <div className="text-xs text-gray-500 mt-1">Pre-snap defender distance</div>
                </div>

                <div className={`${getMetricBoxStyle(analysis.separation_metrics.percent_share_of_intended_air_yards, { good: 25, avg: 15 })} border rounded-lg p-4`}>
                  <div className="text-2xl font-bold text-gray-900">{analysis.separation_metrics.percent_share_of_intended_air_yards.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">Air Yards Share</div>
                  <div className="text-xs text-gray-500 mt-1">Team target quality</div>
                </div>
              </div>
            </Card>

            {/* Season Trends */}
            {analysis.season_trends && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Season Progression
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Target Trend</span>
                      {getTargetTrendIcon(analysis.season_trends.target_trend)}
                    </div>
                    <div className="text-lg font-bold capitalize text-gray-900">
                      {analysis.season_trends.target_trend}
                    </div>
                    <div className="text-sm text-gray-600">
                      {analysis.season_trends.target_improvement > 0 ? '+' : ''}{analysis.season_trends.target_improvement} targets/game improvement
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Early Season Avg:</span>
                      <span className="font-medium">{analysis.season_trends.early_season_avg_targets} targets/game</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Late Season Avg:</span>
                      <span className="font-medium">{analysis.season_trends.late_season_avg_targets} targets/game</span>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Production Metrics */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Production & Efficiency</h3>
              <div className="grid gap-4 md:grid-cols-4">
                <div className={`${getMetricBoxStyle(analysis.receiving_metrics.targets, { good: 100, avg: 60 })} border rounded-lg p-4 text-center`}>
                  <div className="text-2xl font-bold text-gray-900">{analysis.receiving_metrics.targets}</div>
                  <div className="text-sm text-gray-600">Targets</div>
                </div>
                <div className={`${getMetricBoxStyle(analysis.receiving_metrics.receptions, { good: 70, avg: 40 })} border rounded-lg p-4 text-center`}>
                  <div className="text-2xl font-bold text-gray-900">{analysis.receiving_metrics.receptions}</div>
                  <div className="text-sm text-gray-600">Receptions</div>
                </div>
                <div className={`${getMetricBoxStyle(analysis.receiving_metrics.receiving_yards, { good: 1000, avg: 600 })} border rounded-lg p-4 text-center`}>
                  <div className="text-2xl font-bold text-gray-900">{analysis.receiving_metrics.receiving_yards}</div>
                  <div className="text-sm text-gray-600">Receiving Yards</div>
                </div>
                <div className={`${getMetricBoxStyle(analysis.receiving_metrics.receiving_tds, { good: 8, avg: 4 })} border rounded-lg p-4 text-center`}>
                  <div className="text-2xl font-bold text-gray-900">{analysis.receiving_metrics.receiving_tds}</div>
                  <div className="text-sm text-gray-600">Touchdowns</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3 mt-6 pt-6 border-t">
                <div className={`${getMetricBoxStyle(analysis.efficiency_metrics.yards_per_target, { good: 8.5, avg: 6.5 })} border rounded-lg p-4 text-center`}>
                  <div className="text-lg font-bold text-gray-900">{analysis.efficiency_metrics.yards_per_target.toFixed(2)}</div>
                  <div className="text-sm text-gray-600">Yards per Target</div>
                </div>
                <div className={`${getMetricBoxStyle(analysis.receiving_metrics.catch_percentage, { good: 65, avg: 55 })} border rounded-lg p-4 text-center`}>
                  <div className="text-lg font-bold text-gray-900">{analysis.receiving_metrics.catch_percentage.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">Catch Rate</div>
                </div>
                <div className={`${getMetricBoxStyle(analysis.receiving_metrics.avg_yac, { good: 5.5, avg: 4.0 })} border rounded-lg p-4 text-center`}>
                  <div className="text-lg font-bold text-gray-900">{analysis.receiving_metrics.avg_yac.toFixed(1)}</div>
                  <div className="text-sm text-gray-600">Avg YAC</div>
                </div>
              </div>
            </Card>

            {/* Value Assessment */}
            <Card className="p-6 bg-blue-50 border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">Value Arbitrage Assessment</h3>
              <div className="space-y-2 text-sm">
                <p className="text-blue-800">
                  <strong>Separation:</strong> {analysis.separation_metrics.avg_separation_percentile < 50 ? "Needs improvement" : "Above average"} - Key area for development
                </p>
                <p className="text-blue-800">
                  <strong>Target Quality:</strong> {analysis.separation_metrics.percent_share_of_intended_air_yards > 30 ? "Excellent" : "Good"} air yards share indicates valuable role
                </p>
                {analysis.season_trends && (
                  <p className="text-blue-800">
                    <strong>Trajectory:</strong> {analysis.season_trends.target_trend === "increasing" ? "Positive" : "Concerning"} target trend suggests {analysis.season_trends.target_trend === "increasing" ? "growing chemistry" : "declining usage"}
                  </p>
                )}
                <p className="text-blue-800">
                  <strong>Efficiency:</strong> {analysis.efficiency_metrics.yards_per_target > 7 ? "Strong" : "Below average"} yards per target efficiency
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* Error case */}
        {analysis?.error && (
          <Card className="p-6 text-center">
            <p className="text-red-600">{analysis.error}</p>
          </Card>
        )}
      </div>

      <MobileNav />
    </div>
  );
}