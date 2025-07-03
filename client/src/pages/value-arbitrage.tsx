import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Target, TrendingUp, TrendingDown, AlertTriangle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import MobileNav from "@/components/mobile-nav";

interface ArbitrageOpportunity {
  player: {
    id: number;
    name: string;
    team: string;
    position: string;
    avgPoints: number;
    projectedPoints: number;
  };
  recommendation: 'undervalued' | 'overvalued' | 'fair';
  confidence: number;
  valueGap: number;
  reasonCode: string;
  metrics: {
    yardsPerRouteRun?: number;
    targetShare?: number;
    redZoneTargets?: number;
    snapCountPercent?: number;
  };
  market: {
    adp: number;
    ownershipPercent: number;
  };
}

// Hit rate interface removed - requires actual historical validation

export default function ValueArbitragePage() {
  const [positionFilter, setPositionFilter] = useState<string>("all");
  
  const { data: opportunities, isLoading } = useQuery<ArbitrageOpportunity[]>({
    queryKey: ["/api/arbitrage/opportunities", positionFilter === "all" ? undefined : positionFilter],
    queryFn: async () => {
      const url = positionFilter === "all" 
        ? "/api/arbitrage/opportunities" 
        : `/api/arbitrage/opportunities?position=${positionFilter}`;
      const response = await fetch(url);
      return response.json();
    }
  });

  // Hit rate query removed - requires actual historical validation data

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'undervalued':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'overvalued':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'undervalued':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'overvalued':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Target className="w-4 h-4 text-gray-600" />;
    }
  };

  const getReasonText = (reasonCode: string) => {
    const reasons: Record<string, string> = {
      'elite_yprr_low_adp': 'Elite YPRR (>2.0) with low ADP',
      'high_target_share_available': 'High target share (>25%) but available',
      'red_zone_upside_undervalued': 'Strong red zone usage undervalued',
      'strong_metrics_low_price': 'Strong overall metrics vs low market price',
      'poor_metrics_high_adp': 'Poor underlying metrics vs high ADP',
      'slight_undervalue': 'Marginally undervalued by market',
      'slight_overvalue': 'Marginally overvalued by market',
      'metrics_balanced': 'Metrics align with market value'
    };
    return reasons[reasonCode] || 'Analysis pending';
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
              <h1 className="text-xl font-bold text-gray-900">Value Arbitrage</h1>
              <p className="text-sm text-gray-500">Find market inefficiencies using advanced metrics</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Performance tracking requires historical validation data */}
        <Card className="p-6 mb-6 bg-blue-50 border-blue-200">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">System Status</h2>
          <p className="text-blue-800 text-sm">
            Currently collecting baseline metrics and market data. Historical performance tracking will be available after accumulating sufficient validation data over multiple NFL weeks.
          </p>
        </Card>

        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positions</SelectItem>
                <SelectItem value="QB">Quarterback</SelectItem>
                <SelectItem value="RB">Running Back</SelectItem>
                <SelectItem value="WR">Wide Receiver</SelectItem>
                <SelectItem value="TE">Tight End</SelectItem>
                <SelectItem value="K">Kicker</SelectItem>
                <SelectItem value="DEF">Defense</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-gray-600">
            {opportunities?.length || 0} opportunities found
          </div>
        </div>

        {/* Arbitrage Opportunities */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-field-green mx-auto"></div>
              <p className="text-gray-600 mt-2">Analyzing market inefficiencies...</p>
            </div>
          ) : opportunities && opportunities.length > 0 ? (
            opportunities.map((opportunity, index) => (
              <Card key={`${opportunity.player.id}-${index}`} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-field-green rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">{opportunity.player.position}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{opportunity.player.name}</h3>
                      <p className="text-sm text-gray-600">{opportunity.player.team}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge className={getRecommendationColor(opportunity.recommendation)}>
                      <div className="flex items-center space-x-1">
                        {getRecommendationIcon(opportunity.recommendation)}
                        <span className="capitalize">{opportunity.recommendation}</span>
                      </div>
                    </Badge>
                    <div className="text-right">
                      <div className="text-lg font-bold text-field-green">{opportunity.confidence.toFixed(0)}%</div>
                      <div className="text-xs text-gray-500">confidence</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3 mb-4">
                  {/* Market Data */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Market Data</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">ADP:</span>
                        <span className="text-sm font-medium">#{opportunity.market.adp}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Ownership:</span>
                        <span className="text-sm font-medium">{opportunity.market.ownershipPercent}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Avg Points:</span>
                        <span className="text-sm font-medium">{opportunity.player.avgPoints.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Metrics */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Advanced Metrics</h4>
                    <div className="space-y-1">
                      {opportunity.metrics.yardsPerRouteRun && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">YPRR:</span>
                          <span className="text-sm font-medium">{opportunity.metrics.yardsPerRouteRun.toFixed(2)}</span>
                        </div>
                      )}
                      {opportunity.metrics.targetShare && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Target Share:</span>
                          <span className="text-sm font-medium">{opportunity.metrics.targetShare.toFixed(1)}%</span>
                        </div>
                      )}
                      {opportunity.metrics.redZoneTargets && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">RZ Targets:</span>
                          <span className="text-sm font-medium">{opportunity.metrics.redZoneTargets}</span>
                        </div>
                      )}
                      {opportunity.metrics.snapCountPercent && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Snap %:</span>
                          <span className="text-sm font-medium">{opportunity.metrics.snapCountPercent.toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Value Gap */}
                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Value Analysis</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Value Gap:</span>
                        <span className={`text-sm font-medium ${opportunity.valueGap > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {opportunity.valueGap > 0 ? '+' : ''}{opportunity.valueGap.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Projected:</span>
                        <span className="text-sm font-medium">{opportunity.player.projectedPoints.toFixed(1)} pts</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Analysis</p>
                      <p className="text-sm text-yellow-700">{getReasonText(opportunity.reasonCode)}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-8">
              <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No arbitrage opportunities found for the selected filters.</p>
              <p className="text-sm text-gray-500 mt-2">Try adjusting your position filter or check back later.</p>
            </div>
          )}
        </div>
      </div>

      <MobileNav />
    </div>
  );
}