import { useQuery } from "@tanstack/react-query";
import { Loader2, Volleyball, RotateCcw, Upload, Target, User, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import TeamOverview from "@/components/team-overview";
import PositionAnalysis from "@/components/position-analysis";
import PlayerRecommendations from "@/components/player-recommendations";
import PerformanceChart from "@/components/performance-chart";
import MobileNav from "@/components/mobile-nav";
import type { Team } from "@shared/schema";

export default function Dashboard() {
  const teamId = 1; // Default team ID for demo

  const { data: team, isLoading: teamLoading, refetch } = useQuery<Team>({
    queryKey: [`/api/teams/${teamId}`],
  });

  const handleRefresh = () => {
    refetch();
  };

  if (teamLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin field-green" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Team Not Found</h1>
          <p className="text-gray-600">Unable to load team data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Mobile Optimized */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 md:py-4">
            <div className="flex items-center space-x-2 md:space-x-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-field-green rounded-lg flex items-center justify-center">
                <Volleyball className="text-white" size={16} />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-gray-900">Signal</h1>
                <p className="text-xs md:text-sm text-gray-500 hidden sm:block">fantasy and data</p>
              </div>
            </div>
            {/* Desktop Action Buttons */}
            <div className="hidden lg:flex items-center space-x-3">
              <Link href="/arbitrage">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Target className="w-4 h-4 mr-2" />
                  Value Arbitrage
                </Button>
              </Link>
              <Link href="/dynasty-values">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Crown className="w-4 h-4 mr-2" />
                  Dynasty
                </Button>
              </Link>
              <Link href="/sync">
                <Button 
                  size="sm"
                  variant="outline"
                  className="text-field-green border-field-green hover:bg-field-green hover:text-white"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </Button>
              </Link>
              <Button 
                size="sm"
                onClick={handleRefresh}
                className="bg-field-green hover:bg-dark-green"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Mobile Refresh Button */}
            <div className="flex lg:hidden">
              <Button 
                size="sm"
                onClick={handleRefresh}
                className="bg-field-green hover:bg-dark-green p-2"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Mobile Optimized */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 pb-20 md:pb-6">
        {/* Team Overview */}
        <TeamOverview team={team} />

        {/* Position Analysis and Recommendations - Stacked on Mobile */}
        <div className="grid grid-cols-1 gap-4 md:gap-6 mb-6 md:mb-8">
          <PositionAnalysis teamId={teamId} />
        </div>

        {/* Performance Chart and Current Roster - Stacked on Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
          <PerformanceChart teamId={teamId} />
          <div>
            {/* Current roster will be part of PositionAnalysis */}
          </div>
        </div>

        {/* Player Recommendations */}
        <PlayerRecommendations teamId={teamId} />
      </div>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
}
