import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Search, TrendingUp, ArrowLeftRight, Users } from "lucide-react";
import type { Team } from "@shared/schema";

interface TeamOverviewProps {
  team: Team;
}

export default function TeamOverview({ team }: TeamOverviewProps) {
  return (
    <div className="mb-8">
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{team.name}</h2>
            <p className="text-gray-600">Week 8 • League: {team.leagueName}</p>
          </div>
          <div className="flex items-center space-x-4 mt-4 lg:mt-0">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{team.record}</div>
              <div className="text-sm text-gray-500">Record</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold field-green">#{team.leagueRank}</div>
              <div className="text-sm text-gray-500">League Rank</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{team.totalPoints.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Total Points</div>
            </div>
          </div>
        </div>

        {/* Team Health Score */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Team Health Score</h3>
              <p className="text-gray-600">Overall strength assessment</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold field-green">{team.healthScore}</div>
              <div className="text-sm text-gray-500">/ 100</div>
            </div>
          </div>
          <div className="mt-3">
            <Progress value={team.healthScore} className="h-3" />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Button variant="outline" className="bg-blue-50 hover:bg-blue-100 border-blue-200 h-auto p-4 flex flex-col items-start text-left">
            <Search className="text-blue-600 mb-2" size={20} />
            <div className="font-medium text-gray-900">Find Players</div>
            <div className="text-sm text-gray-600">Search waiver wire</div>
          </Button>
          
          <Button variant="outline" className="bg-orange-50 hover:bg-orange-100 border-orange-200 h-auto p-4 flex flex-col items-start text-left">
            <TrendingUp className="text-orange-600 mb-2" size={20} />
            <div className="font-medium text-gray-900">Trends</div>
            <div className="text-sm text-gray-600">Performance analysis</div>
          </Button>
          
          <Button variant="outline" className="bg-purple-50 hover:bg-purple-100 border-purple-200 h-auto p-4 flex flex-col items-start text-left">
            <ArrowLeftRight className="text-purple-600 mb-2" size={20} />
            <div className="font-medium text-gray-900">Trade Ideas</div>
            <div className="text-sm text-gray-600">Suggested trades</div>
          </Button>
          
          <Button variant="outline" className="bg-green-50 hover:bg-green-100 border-green-200 h-auto p-4 flex flex-col items-start text-left">
            <Users className="text-green-600 mb-2" size={20} />
            <div className="font-medium text-gray-900">Lineup</div>
            <div className="text-sm text-gray-600">Optimize starters</div>
          </Button>
        </div>
      </Card>
    </div>
  );
}
