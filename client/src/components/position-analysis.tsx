import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, AlertCircle, CheckCircle, Flame, ArrowRight, Wand2 } from "lucide-react";
import { getPositionColor, getPositionBadgeColor } from "@/lib/utils";
import type { PositionAnalysis, Player } from "@shared/schema";

interface PositionAnalysisProps {
  teamId: number;
}

export default function PositionAnalysis({ teamId }: PositionAnalysisProps) {
  const { data: analysis, isLoading: analysisLoading } = useQuery<PositionAnalysis[]>({
    queryKey: [`/api/teams/${teamId}/analysis`],
  });

  const { data: players, isLoading: playersLoading } = useQuery<(Player & { isStarter: boolean })[]>({
    queryKey: [`/api/teams/${teamId}/players`],
  });

  if (analysisLoading || playersLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin field-green" />
      </div>
    );
  }

  const starters = players?.filter(p => p.isStarter) || [];
  const totalProjected = starters.reduce((sum, player) => sum + player.projectedPoints, 0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "critical":
        return <AlertTriangle className="text-red-500" size={20} />;
      case "warning":
        return <AlertCircle className="text-yellow-500" size={20} />;
      case "good":
        return <CheckCircle className="text-green-500" size={20} />;
      default:
        return <AlertCircle className="text-gray-500" size={20} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical":
        return "text-red-500";
      case "warning":
        return "text-yellow-500";
      case "good":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };

  const urgentActions = analysis?.filter(a => a.status === "critical" || a.status === "warning") || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Position Analysis */}
      <div className="lg:col-span-2">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Position Analysis</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Last Updated:</span>
              <span className="text-sm font-medium text-gray-900">2 hours ago</span>
            </div>
          </div>

          <div className="space-y-4">
            {analysis?.map((position) => (
              <div
                key={position.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${getPositionColor(position.status)}`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getPositionBadgeColor(position.position, position.status)}`}>
                    <span className="text-white font-bold text-sm">{position.position}</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {position.position === "QB" ? "Quarterback" :
                       position.position === "RB" ? "Running Back" :
                       position.position === "WR" ? "Wide Receiver" :
                       position.position === "TE" ? "Tight End" : position.position}
                    </div>
                    <div className="text-sm text-gray-600">
                      {position.status === "critical" ? "Critical weakness detected" :
                       position.status === "warning" ? "Moderate concern" :
                       "Strong position"}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getStatusColor(position.status)}`}>
                        {position.strengthScore}
                      </div>
                      <div className="text-xs text-gray-500">Strength Score</div>
                    </div>
                    {getStatusIcon(position.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Urgent Actions */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Flame className="text-red-500 mr-2" size={20} />
            Urgent Actions
          </h3>
          <div className="space-y-4">
            {urgentActions.map((action) => (
              <div
                key={action.id}
                className={`rounded-lg p-4 border ${getPositionColor(action.status)}`}
              >
                <div className="font-medium text-gray-900 mb-1">
                  Fix {action.position} Position
                </div>
                <div className="text-sm text-gray-600 mb-3">
                  {action.status === "critical" 
                    ? `Your ${action.position}s are underperforming by ${Math.round(((action.leagueAverage - action.weeklyAverage) / action.leagueAverage) * 100)}% vs league average`
                    : `Available ${action.position}s could boost your weekly score by 4-6 points`}
                </div>
                <Button variant="link" className={`p-0 h-auto text-sm font-medium ${getStatusColor(action.status)}`}>
                  {action.status === "critical" ? "View Solutions" : "View Players"}
                  <ArrowRight className="ml-1" size={14} />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* League Comparison */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">League Standing</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Scoring Rank</span>
              <span className="font-medium text-gray-900">#3 of 12</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Avg Points/Week</span>
              <span className="font-medium text-gray-900">155.9</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">League Average</span>
              <span className="font-medium text-gray-500">142.3</span>
            </div>
            <div className="pt-2 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Potential Gain</span>
                <span className="font-bold field-green">+12.4 pts/wk</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Current Roster */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Active Lineup</h3>
            <Button variant="link" className="field-green p-0 h-auto">
              Optimize <Wand2 className="ml-1" size={14} />
            </Button>
          </div>
          <div className="space-y-3">
            {starters.map((player) => {
              const positionAnalysis = analysis?.find(a => a.position === player.position);
              const isWeak = positionAnalysis?.status === "critical" || positionAnalysis?.status === "warning";
              
              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    isWeak ? getPositionColor(positionAnalysis?.status || "good") : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded text-white text-xs font-bold flex items-center justify-center ${
                      isWeak ? getPositionBadgeColor(player.position, positionAnalysis?.status || "good") : "bg-field-green"
                    }`}>
                      {player.position}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{player.name}</div>
                      <div className="text-sm text-gray-500">{player.team}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-medium ${isWeak ? getStatusColor(positionAnalysis?.status || "good") : "text-gray-900"}`}>
                      {player.projectedPoints.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">Projected</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-900">Total Projected</span>
              <span className="text-xl font-bold field-green">{totalProjected.toFixed(1)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
