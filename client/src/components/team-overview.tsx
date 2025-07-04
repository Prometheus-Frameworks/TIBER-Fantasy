import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Search, TrendingUp, ArrowLeftRight, Users, Crown, Target } from "lucide-react";
import { Link } from "wouter";
import type { Team } from "@shared/schema";

interface TeamOverviewProps {
  team: Team;
}

export default function TeamOverview({ team }: TeamOverviewProps) {
  return (
    <div className="mb-6 md:mb-8">
      <Card className="p-4 md:p-6">
        <div className="flex flex-col space-y-4 md:space-y-6">
          {/* Team Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className="mb-4 sm:mb-0">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">{team.name}</h2>
              <p className="text-sm md:text-base text-gray-600">{team.leagueName} • 1 PPR SF TEP</p>
            </div>
            
            {/* Stats Grid - Mobile Responsive */}
            <div className="grid grid-cols-3 gap-4 w-full sm:w-auto sm:flex sm:items-center sm:space-x-6">
              <div className="text-center">
                <div className="text-xl md:text-2xl font-bold text-gray-900">{team.record}</div>
                <div className="text-xs md:text-sm text-gray-500">Record</div>
              </div>
              <div className="text-center">
                <div className="text-xl md:text-2xl font-bold field-green">#{team.leagueRank}</div>
                <div className="text-xs md:text-sm text-gray-500">League Rank</div>
              </div>
              <div className="text-center">
                <div className="text-xl md:text-2xl font-bold text-gray-900">{team.totalPoints.toLocaleString()}</div>
                <div className="text-xs md:text-sm text-gray-500">Total Points</div>
              </div>
            </div>
          </div>

          {/* Team Health Score */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4">
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

          {/* Quick Actions - Mobile Optimized */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Link href="/dynasty-values">
              <Button variant="outline" className="bg-blue-50 hover:bg-blue-100 border-blue-200 h-auto p-3 md:p-4 flex flex-col items-center text-center w-full touch-manipulation">
                <Crown className="text-blue-600 mb-1 md:mb-2" size={18} />
                <div className="font-medium text-gray-900 text-sm md:text-base">Dynasty</div>
                <div className="text-xs text-gray-600 hidden md:block">Player values</div>
              </Button>
            </Link>
            
            <Link href="/arbitrage">
              <Button variant="outline" className="bg-orange-50 hover:bg-orange-100 border-orange-200 h-auto p-3 md:p-4 flex flex-col items-center text-center w-full touch-manipulation">
                <Target className="text-orange-600 mb-1 md:mb-2" size={18} />
                <div className="font-medium text-gray-900 text-sm md:text-base">Value</div>
                <div className="text-xs text-gray-600 hidden md:block">Arbitrage</div>
              </Button>
            </Link>
            
            <Link href="/player-analysis">
              <Button variant="outline" className="bg-purple-50 hover:bg-purple-100 border-purple-200 h-auto p-3 md:p-4 flex flex-col items-center text-center w-full touch-manipulation">
                <Search className="text-purple-600 mb-1 md:mb-2" size={18} />
                <div className="font-medium text-gray-900 text-sm md:text-base">Analysis</div>
                <div className="text-xs text-gray-600 hidden md:block">Player stats</div>
              </Button>
            </Link>
            
            <Link href="/compare-league">
              <Button variant="outline" className="bg-green-50 hover:bg-green-100 border-green-200 h-auto p-3 md:p-4 flex flex-col items-center text-center w-full touch-manipulation">
                <Users className="text-green-600 mb-1 md:mb-2" size={18} />
                <div className="font-medium text-gray-900 text-sm md:text-base">Compare</div>
                <div className="text-xs text-gray-600 hidden md:block">League teams</div>
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}