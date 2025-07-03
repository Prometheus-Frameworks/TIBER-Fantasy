import { useQuery } from "@tanstack/react-query";
import { Loader2, Volleyball, RotateCcw, Upload, Target, User } from "lucide-react";
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
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-field-green rounded-lg flex items-center justify-center">
                <Volleyball className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">FantasyWeakness Pro</h1>
                <p className="text-sm text-gray-500">Find Your Team's Weak Spots</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/arbitrage">
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Target className="w-4 h-4 mr-2" />
                  Value Arbitrage
                </Button>
              </Link>
              <Link href="/player-analysis">
                <Button 
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <User className="w-4 h-4 mr-2" />
                  Player Analysis
                </Button>
              </Link>
              <Link href="/sync">
                <Button 
                  variant="outline"
                  className="text-field-green border-field-green hover:bg-field-green hover:text-white"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import Team
                </Button>
              </Link>
              <Button 
                onClick={handleRefresh}
                className="bg-field-green hover:bg-dark-green"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Refresh Data
              </Button>
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Team Overview */}
        <TeamOverview team={team} />

        {/* Position Analysis and Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <PositionAnalysis teamId={teamId} />
          </div>
          <div>
            {/* This will be filled by the PositionAnalysis component with recommendations sidebar */}
          </div>
        </div>

        {/* Performance Chart and Current Roster */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
