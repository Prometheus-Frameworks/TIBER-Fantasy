import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WRAdvancedStats {
  playerName: string;
  team: string;
  yardsPerRouteRun: number | 'NA';
  firstDownsPerRouteRun: number | 'NA';
  targetShare: number | 'NA';
  airYardsShare: number | 'NA';
  snapPercentage: number | 'NA';
  routesRun: number | 'NA';
  redZoneTargets: number | 'NA';
  touchdowns: number | 'NA';
  yardsAfterCatch: number | 'NA';
  receivingYards: number | 'NA';
}

interface WRStatsApiResponse {
  success: boolean;
  data: WRAdvancedStats[];
  count: number;
  timestamp: string;
}

const MetricTooltip = ({ metric, description }: { metric: string; description: string }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger>
        <Info className="w-3 h-3 text-gray-400 ml-1" />
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-sm max-w-xs">{description}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export default function WRAnalyticsTable() {
  const { data: apiResponse, isLoading, error, refetch } = useQuery<WRStatsApiResponse>({
    queryKey: ['/api/analytics/wr-advanced-stats'],
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 2
  });

  const wrStats = apiResponse?.data || [];
  const isDataAvailable = apiResponse?.success === true;

  const formatValue = (value: number | 'NA', decimals: number = 1): string => {
    if (value === 'NA') return 'NA';
    return typeof value === 'number' ? value.toFixed(decimals) : 'NA';
  };

  const formatInteger = (value: number | 'NA'): string => {
    if (value === 'NA') return 'NA';
    return typeof value === 'number' ? value.toString() : 'NA';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Wide Receiver Usage & Efficiency Metrics
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-4">
            Comprehensive 2024 NFL receiving statistics for fantasy-relevant wide receivers
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Currently supports Sleeper leagues. ESPN & Yahoo integrations hopefully coming soon, one day.
          </p>
          
          {/* Status and Refresh Controls */}
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
              isDataAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isDataAvailable ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              {isLoading ? 'Loading...' : isDataAvailable ? 'Live NFL Data' : 'Data Unavailable'}
            </div>
            
            <span className="text-gray-500">
              {apiResponse?.count || 0} players loaded
            </span>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          
          {error && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
              ⚠️ Error loading data: {error.message}
            </div>
          )}
        </div>

        {/* Main Content */}
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading WR analytics data...</span>
              </div>
            </CardContent>
          </Card>
        ) : wrStats.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-red-600 mb-4">
                ⚠️ No WR data available
              </div>
              <Button onClick={() => refetch()} className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                2024 NFL Wide Receiver Advanced Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">
                        Player
                      </TableHead>
                      <TableHead className="font-semibold">
                        Team
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center">
                          YPRR
                          <MetricTooltip 
                            metric="YPRR" 
                            description="Yards Per Route Run - measures efficiency regardless of target volume" 
                          />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center">
                          1D/RR
                          <MetricTooltip 
                            metric="1D/RR" 
                            description="First Downs Per Route Run - measures ability to move the chains" 
                          />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center">
                          Target %
                          <MetricTooltip 
                            metric="Target Share" 
                            description="Percentage of team targets - measures involvement in offense" 
                          />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center">
                          Air Yards %
                          <MetricTooltip 
                            metric="Air Yards Share" 
                            description="Percentage of team air yards - measures downfield involvement" 
                          />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center">
                          Snap %
                          <MetricTooltip 
                            metric="Snap Percentage" 
                            description="Percentage of offensive snaps played - measures usage" 
                          />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        Routes
                      </TableHead>
                      <TableHead className="font-semibold">
                        RZ Targets
                      </TableHead>
                      <TableHead className="font-semibold">
                        TDs
                      </TableHead>
                      <TableHead className="font-semibold">
                        YAC
                      </TableHead>
                      <TableHead className="font-semibold">
                        Rec Yards
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wrStats.map((player, index) => (
                      <TableRow key={`${player.playerName}-${player.team}`}>
                        <TableCell className="font-medium">
                          {player.playerName}
                        </TableCell>
                        <TableCell className="font-medium text-gray-600">
                          {player.team}
                        </TableCell>
                        <TableCell className={`${
                          player.yardsPerRouteRun !== 'NA' && player.yardsPerRouteRun >= 2.0 
                            ? 'text-green-600 font-semibold' 
                            : ''
                        }`}>
                          {formatValue(player.yardsPerRouteRun, 2)}
                        </TableCell>
                        <TableCell className={`${
                          player.firstDownsPerRouteRun !== 'NA' && player.firstDownsPerRouteRun >= 0.15 
                            ? 'text-green-600 font-semibold' 
                            : ''
                        }`}>
                          {formatValue(player.firstDownsPerRouteRun, 3)}
                        </TableCell>
                        <TableCell className={`${
                          player.targetShare !== 'NA' && player.targetShare >= 20 
                            ? 'text-green-600 font-semibold' 
                            : ''
                        }`}>
                          {formatValue(player.targetShare, 1)}%
                        </TableCell>
                        <TableCell className={`${
                          player.airYardsShare !== 'NA' && player.airYardsShare >= 25 
                            ? 'text-green-600 font-semibold' 
                            : ''
                        }`}>
                          {formatValue(player.airYardsShare, 1)}%
                        </TableCell>
                        <TableCell className={`${
                          player.snapPercentage !== 'NA' && player.snapPercentage >= 75 
                            ? 'text-green-600 font-semibold' 
                            : ''
                        }`}>
                          {formatValue(player.snapPercentage, 1)}%
                        </TableCell>
                        <TableCell>
                          {formatInteger(player.routesRun)}
                        </TableCell>
                        <TableCell>
                          {formatInteger(player.redZoneTargets)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatInteger(player.touchdowns)}
                        </TableCell>
                        <TableCell>
                          {formatInteger(player.yardsAfterCatch)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatInteger(player.receivingYards)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}