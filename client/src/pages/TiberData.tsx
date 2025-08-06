import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, CheckCircle, XCircle, AlertCircle, Zap } from 'lucide-react';

interface DiagnosticResults {
  nfl_data_py: string;
  sleeper: string;
  espn: string;
  player_count?: number;
}

interface TiberDataResponse {
  status: string;
  diagnostic_results?: DiagnosticResults;
  capabilities?: Record<string, string[]>;
  error?: string;
}

export default function TiberData() {
  const [diagnostic, setDiagnostic] = useState<TiberDataResponse | null>(null);
  const [capabilities, setCapabilities] = useState<TiberDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<TiberDataResponse | null>(null);

  const runDiagnostic = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tiber-data/diagnostic');
      if (!response.ok) throw new Error('Failed to run diagnostic');
      const data = await response.json();
      setDiagnostic(data);
    } catch (error) {
      console.error('Diagnostic error:', error);
      setDiagnostic({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCapabilities = async () => {
    try {
      const response = await fetch('/api/tiber-data/capabilities');
      if (!response.ok) throw new Error('Failed to load capabilities');
      const data = await response.json();
      setCapabilities(data);
    } catch (error) {
      console.error('Capabilities error:', error);
    }
  };

  const testSources = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tiber-data/test-sources');
      if (!response.ok) throw new Error('Failed to test sources');
      const data = await response.json();
      setTestResults(data);
    } catch (error) {
      console.error('Source testing error:', error);
      setTestResults({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCapabilities();
  }, []);

  const getStatusIcon = (status: string) => {
    if (status.includes('✅') || status === 'working') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status.includes('❌') || status === 'error') return <XCircle className="w-4 h-4 text-red-500" />;
    return <AlertCircle className="w-4 h-4 text-yellow-500" />;
  };

  const getStatusColor = (status: string) => {
    if (status.includes('✅') || status === 'working') return 'bg-green-500';
    if (status.includes('❌') || status === 'error') return 'bg-red-500';
    return 'bg-yellow-500';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Database className="w-8 h-8" />
          Tiber Data Integration
        </h1>
        <p className="text-gray-600">Multi-source fantasy football data aggregator</p>
        <p className="text-sm text-gray-500">Built on community principles - serve, not take</p>
      </div>

      <Tabs defaultValue="diagnostic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="diagnostic">Diagnostic</TabsTrigger>
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="testing">Live Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="diagnostic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Data Source Diagnostic
              </CardTitle>
              <CardDescription>
                Test connection and status of all data sources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={runDiagnostic} disabled={loading}>
                {loading ? 'Running Diagnostic...' : 'Run Diagnostic'}
              </Button>

              {diagnostic && (
                <div className="space-y-4">
                  {diagnostic.status === 'error' ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="text-red-600 font-medium">Error</div>
                      <div className="text-red-500 text-sm">{diagnostic.error}</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-lg font-medium">Data Source Status</div>
                      
                      {diagnostic.diagnostic_results && (
                        <div className="grid gap-3">
                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(diagnostic.diagnostic_results.nfl_data_py)}
                              <span className="font-medium">NFL-Data-Py</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(diagnostic.diagnostic_results.nfl_data_py)}>
                                {diagnostic.diagnostic_results.nfl_data_py}
                              </Badge>
                              {diagnostic.player_count && (
                                <span className="text-sm text-gray-600">
                                  {diagnostic.player_count} players
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(diagnostic.diagnostic_results.sleeper)}
                              <span className="font-medium">Sleeper API</span>
                            </div>
                            <Badge className="bg-blue-500">Existing Integration</Badge>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(diagnostic.diagnostic_results.espn)}
                              <span className="font-medium">ESPN Public</span>
                            </div>
                            <Badge className="bg-gray-500">Available</Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capabilities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>NFL-Data-Py Capabilities</CardTitle>
              <CardDescription>
                Free, authentic NFL data sources available for integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              {capabilities?.capabilities && (
                <div className="space-y-6">
                  {Object.entries(capabilities.capabilities).map(([category, functions]) => (
                    <div key={category}>
                      <h3 className="text-lg font-semibold mb-3 text-blue-600">{category}</h3>
                      <div className="space-y-2">
                        {functions.map((func, index) => (
                          <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                            {func}
                          </div>
                        ))}
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
              <CardTitle>Live Source Testing</CardTitle>
              <CardDescription>
                Test real-time connection to data sources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={testSources} disabled={loading}>
                {loading ? 'Testing Sources...' : 'Test All Sources'}
              </Button>

              {testResults && (
                <div className="space-y-4">
                  {testResults.status === 'error' ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="text-red-600 font-medium">Error</div>
                      <div className="text-red-500 text-sm">{testResults.error}</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-lg font-medium">Live Test Results</div>
                      
                      {testResults.diagnostic_results && (
                        <div className="space-y-3">
                          {Object.entries(testResults.diagnostic_results).map(([source, status]) => (
                            <div key={source} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(status as string)}
                                <span className="font-medium">{source.replace('_', ' ').toUpperCase()}</span>
                              </div>
                              <Badge className={getStatusColor(status as string)}>
                                {status}
                              </Badge>
                            </div>
                          ))}

                          {testResults.diagnostic_results.output && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                              <div className="text-green-600 font-medium">Output</div>
                              <div className="text-green-700 text-sm font-mono">
                                {testResults.diagnostic_results.output}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Integration Benefits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong className="text-blue-600">Enhanced Player Compass:</strong>
              <p className="text-gray-600 mt-1">Real-time data feeds to improve RB/WR compass accuracy</p>
            </div>
            <div>
              <strong className="text-green-600">Cross-Platform IDs:</strong>
              <p className="text-gray-600 mt-1">Map players across ESPN, Yahoo, Sleeper for seamless integration</p>
            </div>
            <div>
              <strong className="text-purple-600">Community Principles:</strong>
              <p className="text-gray-600 mt-1">100% free data sources, serving fantasy community without paywalls</p>
            </div>
            <div>
              <strong className="text-orange-600">Authentic Data:</strong>
              <p className="text-gray-600 mt-1">No mock data - only real NFL statistics and player information</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}