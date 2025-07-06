/**
 * Data Sources Management Page
 * Shows status and capabilities of all integrated APIs
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Database, 
  Zap, 
  Shield, 
  RefreshCw,
  Trash2,
  Activity,
  Globe,
  Lock,
  Unlock
} from "lucide-react";

interface DataSource {
  name: string;
  available: boolean;
  hasAuth: boolean;
  lastChecked: string;
  responseTime?: number;
  errorMessage?: string;
}

interface DataSourceSummary {
  sources: DataSource[];
  summary: {
    total: number;
    available: number;
    authenticated: number;
  };
}

interface UnifiedPlayer {
  name: string;
  position: string;
  team: string;
  stats: {
    fantasyPointsPPR: number;
    avgPointsPerGame: number;
  };
  dynastyData: {
    value: number;
    tier: string;
    confidenceScore: number;
  };
  dataSources: {
    primary: string;
    completeness: number;
  };
}

export default function DataSourcesPage() {
  const [selectedPosition, setSelectedPosition] = useState<string>("");
  const queryClient = useQueryClient();

  // Get data source statuses
  const { data: sourceStatus, isLoading: statusLoading } = useQuery<DataSourceSummary>({
    queryKey: ['/api/data-sources/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get unified players data
  const { data: unifiedData, isLoading: playersLoading } = useQuery({
    queryKey: [`/api/unified/players?position=${selectedPosition}&limit=20`],
    enabled: !!sourceStatus?.summary.available, // Only fetch if sources are available
  });

  // Refresh data sources mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/data-sources/refresh', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to refresh data sources');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-sources/status'] });
    },
  });

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/data-sources/clear-cache', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to clear cache');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/unified/players'] });
    },
  });

  // Test specific data source
  const testSourceMutation = useMutation({
    mutationFn: async (sourceName: string) => {
      const response = await fetch(`/api/data-sources/${sourceName}/test`, { method: 'POST' });
      if (!response.ok) throw new Error(`Failed to test ${sourceName}`);
      return response.json();
    },
  });

  const getStatusIcon = (available: boolean, hasAuth: boolean) => {
    if (available && hasAuth) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (available) return <Globe className="h-5 w-5 text-blue-600" />;
    return <XCircle className="h-5 w-5 text-red-600" />;
  };

  const getStatusColor = (available: boolean, hasAuth: boolean) => {
    if (available && hasAuth) return 'bg-green-500';
    if (available) return 'bg-blue-500';
    return 'bg-red-500';
  };

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Database className="h-8 w-8 text-blue-600" />
                Data Sources Management
              </h1>
              <p className="text-gray-600 mt-2">
                Monitor and manage all integrated fantasy football APIs and data sources
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={() => clearCacheMutation.mutate()}
                disabled={clearCacheMutation.isPending}
                variant="outline"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Cache
              </Button>
            </div>
          </div>

          {/* Status Summary */}
          {sourceStatus && (
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Sources</p>
                      <p className="text-2xl font-bold">{sourceStatus.summary.total}</p>
                    </div>
                    <Activity className="h-8 w-8 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Available</p>
                      <p className="text-2xl font-bold text-green-600">{sourceStatus.summary.available}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Authenticated</p>
                      <p className="text-2xl font-bold text-blue-600">{sourceStatus.summary.authenticated}</p>
                    </div>
                    <Shield className="h-8 w-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 max-w-7xl mx-auto">
        <Tabs defaultValue="sources" className="space-y-6">
          <TabsList>
            <TabsTrigger value="sources">Data Sources</TabsTrigger>
            <TabsTrigger value="unified">Unified Data</TabsTrigger>
            <TabsTrigger value="testing">API Testing</TabsTrigger>
          </TabsList>

          <TabsContent value="sources" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Integrated Data Sources</CardTitle>
                <CardDescription>
                  Status and capabilities of all connected fantasy football APIs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sourceStatus?.sources.map((source) => (
                  <div key={source.name} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(source.available, source.hasAuth)}
                        <div>
                          <h3 className="font-semibold text-gray-900">{source.name}</h3>
                          <p className="text-sm text-gray-600">
                            Last checked: {new Date(source.lastChecked).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {source.responseTime && (
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            {source.responseTime}ms
                          </Badge>
                        )}
                        <Badge className={getStatusColor(source.available, source.hasAuth)}>
                          {source.available ? 'Active' : 'Offline'}
                        </Badge>
                        {source.hasAuth ? (
                          <Lock className="h-4 w-4 text-green-600" />
                        ) : (
                          <Unlock className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                    
                    {source.errorMessage && (
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <p className="text-sm text-red-700">{source.errorMessage}</p>
                      </div>
                    )}

                    {/* Data Source Details */}
                    <div className="grid md:grid-cols-2 gap-4 mt-3">
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-800">Capabilities</h4>
                        {source.name === 'MySportsFeeds' && (
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Real-time scores and standings</li>
                            <li>• Comprehensive player statistics</li>
                            <li>• Injury reports and lineups</li>
                            <li>• Fantasy points calculation</li>
                          </ul>
                        )}
                        {source.name === 'FantasyFootballDataPros' && (
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Historical data (1970-present)</li>
                            <li>• Weekly fantasy data</li>
                            <li>• Season projections</li>
                            <li>• No authentication required</li>
                          </ul>
                        )}
                        {source.name === 'RealTimeNFLAnalytics' && (
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Advanced NFL metrics (28 total)</li>
                            <li>• Position-specific analytics</li>
                            <li>• Dynasty scoring algorithms</li>
                            <li>• Confidence calculations</li>
                          </ul>
                        )}
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-800">Data Types</h4>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">Player Stats</Badge>
                          <Badge variant="secondary" className="text-xs">Team Data</Badge>
                          <Badge variant="secondary" className="text-xs">Fantasy Points</Badge>
                          {source.name === 'MySportsFeeds' && (
                            <>
                              <Badge variant="secondary" className="text-xs">Live Scores</Badge>
                              <Badge variant="secondary" className="text-xs">Injuries</Badge>
                            </>
                          )}
                          {source.name === 'RealTimeNFLAnalytics' && (
                            <>
                              <Badge variant="secondary" className="text-xs">YPRR</Badge>
                              <Badge variant="secondary" className="text-xs">Target Share</Badge>
                              <Badge variant="secondary" className="text-xs">EPA</Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="unified" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Unified Data Preview</CardTitle>
                <CardDescription>
                  Sample data from our unified API combining multiple sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <select
                    value={selectedPosition}
                    onChange={(e) => setSelectedPosition(e.target.value)}
                    className="border rounded px-3 py-2"
                  >
                    <option value="">All Positions</option>
                    <option value="QB">Quarterbacks</option>
                    <option value="RB">Running Backs</option>
                    <option value="WR">Wide Receivers</option>
                    <option value="TE">Tight Ends</option>
                  </select>
                </div>

                {playersLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(unifiedData as any)?.players?.slice(0, 10).map((player: UnifiedPlayer, index: number) => (
                      <div key={index} className="border rounded p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">{player.name}</h4>
                            <p className="text-sm text-gray-600">
                              {player.team} • {player.position} • 
                              {player.stats.avgPointsPerGame?.toFixed(1) || '0.0'} PPG
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-3">
                              <div className="text-center">
                                <p className="text-sm text-gray-500">Dynasty Value</p>
                                <p className="font-semibold text-blue-600">
                                  {player.dynastyData.value.toFixed(0)}/100
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-sm text-gray-500">Confidence</p>
                                <Progress 
                                  value={player.dynastyData.confidenceScore} 
                                  className="w-16 h-2"
                                />
                              </div>
                              <Badge className="bg-blue-500">
                                {player.dataSources.primary}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="testing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>API Testing</CardTitle>
                <CardDescription>
                  Test individual data source connections and performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sourceStatus?.sources.map((source) => (
                  <div key={source.name} className="border rounded p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{source.name}</h4>
                        <p className="text-sm text-gray-600">
                          Test connection and response time
                        </p>
                      </div>
                      <Button
                        onClick={() => testSourceMutation.mutate(source.name.toLowerCase().replace(/\s+/g, ''))}
                        disabled={testSourceMutation.isPending}
                        size="sm"
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Test Connection
                      </Button>
                    </div>
                    
                    {testSourceMutation.data && (
                      <div className="mt-3 p-3 bg-gray-50 rounded">
                        <pre className="text-xs text-gray-700">
                          {JSON.stringify(testSourceMutation.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}