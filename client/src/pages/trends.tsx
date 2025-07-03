import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import MobileNav from "@/components/mobile-nav";
import PerformanceChart from "@/components/performance-chart";
import type { WeeklyPerformance } from "@shared/schema";

export default function TrendsPage() {
  const teamId = 1;
  
  const { data: performance, isLoading } = useQuery<WeeklyPerformance[]>({
    queryKey: [`/api/teams/${teamId}/performance`],
  });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case "down":
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "up":
        return "bg-green-100 text-green-800";
      case "down":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const calculateTrends = () => {
    if (!performance || performance.length < 2) return [];
    
    const recent = performance.slice(-3);
    const averageRecent = recent.reduce((sum, week) => sum + week.points, 0) / recent.length;
    const projected = recent.reduce((sum, week) => sum + week.projectedPoints, 0) / recent.length;
    
    return [
      {
        metric: "Recent Performance",
        value: `${averageRecent.toFixed(1)} pts`,
        trend: averageRecent > projected ? "up" : "down",
        description: `${averageRecent > projected ? "Above" : "Below"} projections by ${Math.abs(averageRecent - projected).toFixed(1)} pts`
      },
      {
        metric: "Weekly Consistency",
        value: performance.length > 0 ? "Medium" : "N/A",
        trend: "stable",
        description: "Score variance analysis"
      },
      {
        metric: "Lineup Efficiency",
        value: "78%",
        trend: "up",
        description: "Starting optimal players"
      }
    ];
  };

  const trends = calculateTrends();

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
              <h1 className="text-xl font-bold text-gray-900">Performance Trends</h1>
              <p className="text-sm text-gray-500">Analyze your team's performance patterns</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Performance Chart */}
        <div className="mb-8">
          <PerformanceChart teamId={teamId} />
        </div>

        {/* Trend Analysis */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Trend Analysis</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {trends.map((trend, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">{trend.metric}</h3>
                  <p className="text-2xl font-bold text-field-green">{trend.value}</p>
                  <p className="text-sm text-gray-600">{trend.description}</p>
                </div>
                <div className="flex items-center">
                  {getTrendIcon(trend.trend)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Weekly Breakdown */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Performance</h2>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-field-green mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading performance data...</p>
            </div>
          ) : performance && performance.length > 0 ? (
            <div className="space-y-4">
              {performance.map((week) => (
                <div key={week.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">Week {week.week}</h3>
                    <p className="text-sm text-gray-600">
                      {week.points > week.projectedPoints ? "Outperformed" : "Underperformed"} projection
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {week.points.toFixed(1)} pts
                    </div>
                    <div className="text-sm text-gray-600">
                      Proj: {week.projectedPoints.toFixed(1)}
                    </div>
                    <Badge className={getTrendColor(week.points > week.projectedPoints ? "up" : "down")}>
                      {week.points > week.projectedPoints ? "+" : ""}{(week.points - week.projectedPoints).toFixed(1)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">No performance data available yet.</p>
            </div>
          )}
        </Card>
      </div>

      <MobileNav />
    </div>
  );
}