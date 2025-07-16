import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, Database, Zap, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface ProcessingResult {
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errors: string[];
  processingTime: number;
  batchResults: any[];
}

export default function DataIngestion() {
  const [fantasyProsData, setFantasyProsData] = useState('');
  const [customData, setCustomData] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');
  const { toast } = useToast();

  const testFantasyProsConnection = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/fantasy-pros/test-connection');
      const result = await response.json();
      
      setConnectionStatus(result.success ? 'connected' : 'failed');
      
      toast({
        title: result.success ? "Connected!" : "Connection Failed",
        description: result.message,
        variant: result.success ? "default" : "destructive"
      });
    } catch (error) {
      setConnectionStatus('failed');
      toast({
        title: "Connection Test Failed",
        description: "Unable to test FantasyPros API connection",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const syncFantasyProsData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/fantasy-pros/sync-dynasty', {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Sync Complete!",
          description: `${result.playersUpdated} players updated from FantasyPros`,
          variant: "default"
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Unable to sync FantasyPros dynasty rankings",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const processCustomDataDump = async () => {
    try {
      if (!customData.trim()) {
        toast({
          title: "No Data",
          description: "Please paste your custom data before processing",
          variant: "destructive"
        });
        return;
      }

      setIsLoading(true);
      let parsedData;
      
      try {
        parsedData = JSON.parse(customData);
      } catch {
        toast({
          title: "Invalid JSON",
          description: "Please ensure your data is valid JSON format",
          variant: "destructive"
        });
        return;
      }

      const dataArray = Array.isArray(parsedData) ? parsedData : [parsedData];
      
      const response = await fetch('/api/data-ingestion/process-dump', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: dataArray,
          config: {
            source: 'custom-dump',
            format: 'json',
            batchSize: 50,
            validateFields: true,
            updateMode: 'upsert'
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setProcessingResult(result.result);
        toast({
          title: "Processing Complete!",
          description: `${result.result.successfulRecords}/${result.result.totalRecords} records processed successfully`,
          variant: "default"
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: "Processing Failed",
        description: "Unable to process custom data dump",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exampleCustomData = {
    name: "CeeDee Lamb",
    position: "WR",
    team: "DAL",
    age: 25,
    dynasty_value: 88,
    adp: 1.4,
    sleeper_id: "4046"
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Data Ingestion Center</h1>
          <p className="text-gray-600">
            Process large data dumps and integrate with external fantasy data sources
          </p>
        </div>

        <Tabs defaultValue="fantasy-pros" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fantasy-pros">FantasyPros API</TabsTrigger>
            <TabsTrigger value="custom-dump">Custom Data Dump</TabsTrigger>
            <TabsTrigger value="results">Processing Results</TabsTrigger>
          </TabsList>

          <TabsContent value="fantasy-pros" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Database className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>FantasyPros Integration</CardTitle>
                    <CardDescription>
                      Sync expert consensus dynasty rankings from FantasyPros API
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Badge variant={connectionStatus === 'connected' ? 'default' : 
                                 connectionStatus === 'failed' ? 'destructive' : 'secondary'}>
                    {connectionStatus === 'connected' ? 'Connected' :
                     connectionStatus === 'failed' ? 'Failed' : 'Unknown'}
                  </Badge>
                  <Button
                    onClick={testFantasyProsConnection}
                    disabled={isLoading}
                    variant="outline"
                    size="sm"
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Test Connection
                  </Button>
                </div>

                {connectionStatus === 'connected' && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      FantasyPros API is connected and ready for dynasty rankings sync
                    </AlertDescription>
                  </Alert>
                )}

                {connectionStatus === 'failed' && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      FantasyPros API connection failed. Check your API key configuration in environment variables.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  <h4 className="font-semibold">Available Actions:</h4>
                  <div className="space-y-2">
                    <Button
                      onClick={syncFantasyProsData}
                      disabled={isLoading || connectionStatus !== 'connected'}
                      className="w-full"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Sync Dynasty Rankings
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="custom-dump" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Upload className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>Custom Data Processing</CardTitle>
                    <CardDescription>
                      Upload and process large JSON data dumps with batch processing
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data (JSON format):</label>
                  <Textarea
                    value={customData}
                    onChange={(e) => setCustomData(e.target.value)}
                    placeholder={`Paste your JSON data here, for example:\n${JSON.stringify([exampleCustomData], null, 2)}`}
                    className="min-h-[300px] font-mono text-sm"
                  />
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Data will be processed in batches of 50 records with field validation enabled.
                    Expected fields: name, position, team, dynasty_value, adp
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={processCustomDataDump}
                  disabled={isLoading || !customData.trim()}
                  className="w-full"
                >
                  <Database className="mr-2 h-4 w-4" />
                  Process Data Dump
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            {processingResult ? (
              <Card>
                <CardHeader>
                  <CardTitle>Processing Results</CardTitle>
                  <CardDescription>
                    Last data dump processing completed in {processingResult.processingTime}ms
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {processingResult.totalRecords}
                      </div>
                      <div className="text-sm text-gray-600">Total Records</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {processingResult.successfulRecords}
                      </div>
                      <div className="text-sm text-gray-600">Successful</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {processingResult.failedRecords}
                      </div>
                      <div className="text-sm text-gray-600">Failed</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Success Rate:</label>
                    <Progress 
                      value={(processingResult.successfulRecords / processingResult.totalRecords) * 100} 
                      className="w-full"
                    />
                    <div className="text-sm text-gray-600 text-center">
                      {Math.round((processingResult.successfulRecords / processingResult.totalRecords) * 100)}% successful
                    </div>
                  </div>

                  {processingResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Errors:</label>
                      <div className="bg-red-50 p-3 rounded-lg max-h-40 overflow-y-auto">
                        {processingResult.errors.slice(0, 10).map((error, index) => (
                          <div key={index} className="text-sm text-red-700">
                            {error}
                          </div>
                        ))}
                        {processingResult.errors.length > 10 && (
                          <div className="text-sm text-red-500 mt-2">
                            ... and {processingResult.errors.length - 10} more errors
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Processing Results</h3>
                  <p className="text-gray-600">
                    Process some data to see results here
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}