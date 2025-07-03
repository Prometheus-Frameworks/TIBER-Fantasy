import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { WeeklyPerformance } from "@shared/schema";

interface PerformanceChartProps {
  teamId: number;
}

export default function PerformanceChart({ teamId }: PerformanceChartProps) {
  const { data: performance, isLoading } = useQuery<WeeklyPerformance[]>({
    queryKey: [`/api/teams/${teamId}/performance`],
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin field-green" />
        </div>
      </Card>
    );
  }

  if (!performance || performance.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Weekly Performance</h3>
        <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="mx-auto text-4xl text-gray-400 mb-4" size={48} />
            <div className="text-gray-600">No performance data available</div>
          </div>
        </div>
      </Card>
    );
  }

  const chartData = performance.map(perf => ({
    week: `Week ${perf.week}`,
    actual: perf.points,
    projected: perf.projectedPoints,
  }));

  const avgScore = performance.reduce((sum, perf) => sum + perf.points, 0) / performance.length;
  const highScore = Math.max(...performance.map(perf => perf.points));
  const lowScore = Math.min(...performance.map(perf => perf.points));

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">Weekly Performance</h3>
        <Select defaultValue="8weeks">
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="8weeks">Last 8 weeks</SelectItem>
            <SelectItem value="4weeks">Last 4 weeks</SelectItem>
            <SelectItem value="season">Season</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="week" 
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke="hsl(142, 68%, 33%)" 
              strokeWidth={3}
              dot={{ fill: "hsl(142, 68%, 33%)", strokeWidth: 2, r: 4 }}
              name="Actual Score"
            />
            <Line 
              type="monotone" 
              dataKey="projected" 
              stroke="hsl(207, 90%, 54%)" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: "hsl(207, 90%, 54%)", strokeWidth: 2, r: 3 }}
              name="Projected Score"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-lg font-bold field-green">{avgScore.toFixed(1)}</div>
          <div className="text-sm text-gray-500">Avg Score</div>
        </div>
        <div>
          <div className="text-lg font-bold text-gray-900">{highScore.toFixed(1)}</div>
          <div className="text-sm text-gray-500">High Score</div>
        </div>
        <div>
          <div className="text-lg font-bold text-gray-900">{lowScore.toFixed(1)}</div>
          <div className="text-sm text-gray-500">Low Score</div>
        </div>
      </div>
    </Card>
  );
}
