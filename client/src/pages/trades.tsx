import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowLeftRight, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import MobileNav from "@/components/mobile-nav";
import type { Player } from "@shared/schema";

export default function TradesPage() {
  const teamId = 1;
  
  const { data: teamPlayers, isLoading: loadingTeam } = useQuery<(Player & { isStarter: boolean })[]>({
    queryKey: [`/api/teams/${teamId}/players`],
  });

  const { data: availablePlayers, isLoading: loadingAvailable } = useQuery<Player[]>({
    queryKey: ["/api/teams/1/recommendations"],
  });

  // Mock trade suggestions based on team analysis
  const getTradeOpportunities = () => {
    if (!teamPlayers || !availablePlayers) return [];

    // Find weak positions
    const positionCounts = teamPlayers.reduce((acc, player) => {
      acc[player.position] = (acc[player.position] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const tradeSuggestions = [
      {
        id: 1,
        type: "Upgrade",
        fromPlayer: teamPlayers.find(p => p.position === "RB" && p.avgPoints < 10),
        toPlayer: availablePlayers.find(p => p.position === "RB" && p.avgPoints > 12),
        reason: "Upgrade RB2 position",
        confidence: "High",
        impact: "+3.2 pts/week"
      },
      {
        id: 2,
        type: "Need Fill",
        fromPlayer: teamPlayers.find(p => p.position === "WR" && p.avgPoints > 15),
        toPlayer: availablePlayers.find(p => p.position === "TE" && p.avgPoints > 8),
        reason: "Address TE weakness",
        confidence: "Medium",
        impact: "+1.8 pts/week"
      }
    ].filter(trade => trade.fromPlayer && trade.toPlayer);

    return tradeSuggestions;
  };

  const tradeOpportunities = getTradeOpportunities();

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "High":
        return "bg-green-100 text-green-800";
      case "Medium":
        return "bg-yellow-100 text-yellow-800";
      case "Low":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
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
              <h1 className="text-xl font-bold text-gray-900">Trade Ideas</h1>
              <p className="text-sm text-gray-500">Strategic trade recommendations for your team</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Trade Analysis Overview */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Trade Analysis</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900">Surplus Positions</h3>
              <p className="text-2xl font-bold text-blue-600">WR</p>
              <p className="text-sm text-blue-700">Strong depth to trade from</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <h3 className="font-medium text-orange-900">Need Positions</h3>
              <p className="text-2xl font-bold text-orange-600">TE, RB</p>
              <p className="text-sm text-orange-700">Areas to strengthen</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-900">Trade Value</h3>
              <p className="text-2xl font-bold text-green-600">High</p>
              <p className="text-sm text-green-700">Good assets to move</p>
            </div>
          </div>
        </Card>

        {/* Trade Opportunities */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Suggested Trades</h2>
          {loadingTeam || loadingAvailable ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-field-green mx-auto"></div>
              <p className="text-gray-600 mt-2">Analyzing trade opportunities...</p>
            </div>
          ) : tradeOpportunities.length > 0 ? (
            <div className="space-y-6">
              {tradeOpportunities.map((trade) => (
                <div key={trade.id} className="border rounded-lg p-6 bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{trade.type}</Badge>
                      <Badge className={getConfidenceColor(trade.confidence)}>
                        {trade.confidence} Confidence
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Potential Impact</div>
                      <div className="font-semibold text-field-green">{trade.impact}</div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 items-center">
                    {/* From Player */}
                    <div className="text-center">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                          <span className="text-white font-bold">{trade.fromPlayer?.position}</span>
                        </div>
                        <h3 className="font-semibold text-gray-900">{trade.fromPlayer?.name}</h3>
                        <p className="text-sm text-gray-600">{trade.fromPlayer?.team}</p>
                        <p className="text-sm font-medium text-red-600">
                          {trade.fromPlayer?.avgPoints?.toFixed(1)} pts/week
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Trade Away</p>
                    </div>

                    {/* Arrow */}
                    <div className="flex justify-center">
                      <ArrowLeftRight className="w-8 h-8 text-gray-400" />
                    </div>

                    {/* To Player */}
                    <div className="text-center">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                          <span className="text-white font-bold">{trade.toPlayer?.position}</span>
                        </div>
                        <h3 className="font-semibold text-gray-900">{trade.toPlayer?.name}</h3>
                        <p className="text-sm text-gray-600">{trade.toPlayer?.team}</p>
                        <p className="text-sm font-medium text-green-600">
                          {trade.toPlayer?.avgPoints?.toFixed(1)} pts/week
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Target</p>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <strong>Strategy:</strong> {trade.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ArrowLeftRight className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No obvious trade opportunities found.</p>
              <p className="text-sm text-gray-500 mt-2">Your roster appears well-balanced!</p>
            </div>
          )}
        </Card>
      </div>

      <MobileNav />
    </div>
  );
}