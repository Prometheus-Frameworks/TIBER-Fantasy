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

interface RBAdvancedStats {
  playerName: string;
  team: string;
  rushingAttempts: number;
  rushingYards: number;
  yardsPerCarry: number;
  targets: number;
  receptions: number;
  receivingYards: number;
  yardsPerReception: number;
  targetShare: number | 'NA';
  totalTouchdowns: number;
  snapPercentage: 'NA';
}

interface RBStatsApiResponse {
  success: boolean;
  data: RBAdvancedStats[];
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

export default function RBAnalyticsTable() {
  const { data: apiResponse, isLoading, error, refetch } = useQuery<RBStatsApiResponse>({
    queryKey: ['/api/analytics/rb-advanced-stats'],
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 2
  });

  const rbStats = apiResponse?.data || [];
  const isDataAvailable = apiResponse?.success === true;

  const formatValue = (value: number | 'NA', decimals: number = 1): string => {
    if (value === 'NA') return 'NA';
    return typeof value === 'number' ? value.toFixed(decimals) : 'NA';
  };

  const formatInteger = (value: number | 'NA'): string => {
    if (value === 'NA') return 'NA';
    return typeof value === 'number' ? value.toString() : 'NA';
  };

  const formatPercentage = (value: number | 'NA'): string => {
    if (value === 'NA') return 'NA';
    return typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : 'NA';
  };

  const getTotalTouches = (player: RBAdvancedStats): number => {
    return player.rushingAttempts + player.targets;
  };

  const isSmallSample = (player: RBAdvancedStats): boolean => {
    return getTotalTouches(player) < 100;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2">Loading RB Analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-red-600">Error Loading RB Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500 mb-4">
            Failed to load running back analytics data. Please try again.
          </p>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Running Back Analytics</h1>
          <p className="text-gray-600 mt-2">
            Comprehensive 2024 RB performance metrics from NFL data
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{rbStats.length}</div>
            <div className="text-sm text-gray-600">Total Running Backs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {rbStats.filter(rb => getTotalTouches(rb) >= 100).length}
            </div>
            <div className="text-sm text-gray-600">High-Touch RBs (100+ touches)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {rbStats.filter(rb => isSmallSample(rb)).length}
            </div>
            <div className="text-sm text-gray-600">Small Sample (&lt; 100 touches)</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {!isDataAvailable && (
          <Card>
            <CardContent className="p-4">
              <div className="text-center text-yellow-600">
                <Info className="w-5 h-5 mx-auto mb-2" />
                <p>RB analytics data is being processed. Please check back shortly.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {isDataAvailable && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                2024 Running Back Analytics
                <div className="ml-2 text-sm text-gray-500">
                  ({rbStats.length} players)
                </div>
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
                          Rush Att
                          <MetricTooltip 
                            metric="Rushing Attempts" 
                            description="Total carries in 2024 season" 
                          />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center">
                          Rush Yds
                          <MetricTooltip 
                            metric="Rushing Yards" 
                            description="Total rushing yards in 2024 season" 
                          />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center">
                          YPC
                          <MetricTooltip 
                            metric="Yards Per Carry" 
                            description="Rushing yards divided by rushing attempts - measures efficiency" 
                          />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center">
                          Targets
                          <MetricTooltip 
                            metric="Targets" 
                            description="Total receiving targets in 2024 season" 
                          />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center">
                          Receptions
                          <MetricTooltip 
                            metric="Receptions" 
                            description="Total catches in 2024 season" 
                          />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center">
                          Rec Yds
                          <MetricTooltip 
                            metric="Receiving Yards" 
                            description="Total receiving yards in 2024 season" 
                          />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center">
                          YPR
                          <MetricTooltip 
                            metric="Yards Per Reception" 
                            description="Receiving yards divided by receptions - measures receiving efficiency" 
                          />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center">
                          Target Share
                          <MetricTooltip 
                            metric="Target Share" 
                            description="Percentage of team targets - measures passing game involvement" 
                          />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center">
                          Total TDs
                          <MetricTooltip 
                            metric="Total Touchdowns" 
                            description="Combined rushing and receiving touchdowns" 
                          />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center">
                          Snap %
                          <MetricTooltip 
                            metric="Snap Percentage" 
                            description="Data Unavailable - Not provided by current NFL data source" 
                          />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rbStats.map((player, index) => (
                      <TableRow key={`${player.playerName}-${player.team}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1">
                            {player.playerName}
                            {isSmallSample(player) && (
                              <span className="text-orange-500 text-xs" title="Small sample size (< 100 touches)">
                                🚧
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-gray-600">
                          {player.team}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {formatInteger(player.rushingAttempts)}
                            {isSmallSample(player) && (
                              <span className="text-orange-500 text-xs font-normal" title="Small sample size (< 100 touches)">
                                (SS)
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatInteger(player.rushingYards)}
                        </TableCell>
                        <TableCell className={`${
                          player.yardsPerCarry >= 4.5 
                            ? 'text-green-600 font-semibold' 
                            : ''
                        }`}>
                          {formatValue(player.yardsPerCarry, 2)}
                        </TableCell>
                        <TableCell>
                          {formatInteger(player.targets)}
                        </TableCell>
                        <TableCell>
                          {formatInteger(player.receptions)}
                        </TableCell>
                        <TableCell>
                          {formatInteger(player.receivingYards)}
                        </TableCell>
                        <TableCell className={`${
                          player.yardsPerReception >= 8.0 
                            ? 'text-green-600 font-semibold' 
                            : ''
                        }`}>
                          {formatValue(player.yardsPerReception, 2)}
                        </TableCell>
                        <TableCell className={`${
                          player.targetShare !== 'NA' && player.targetShare >= 0.15 
                            ? 'text-green-600 font-semibold' 
                            : ''
                        }`}>
                          {formatPercentage(player.targetShare)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatInteger(player.totalTouchdowns)}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {formatPercentage(player.snapPercentage)}
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