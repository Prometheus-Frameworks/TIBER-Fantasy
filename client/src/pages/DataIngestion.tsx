import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Database, 
  Upload, 
  Zap, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  TrendingUp,
  FileSpreadsheet
} from "lucide-react";

interface ProcessingResult {
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errors: string[];
  processingTime: number;
  batchResults: any[];
}

export default function DataIngestion() {
  const [customData, setCustomData] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');
  const { toast } = useToast();

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

        <Tabs defaultValue="mysportsfeeds" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="mysportsfeeds">MySportsFeeds Sync</TabsTrigger>
          <TabsTrigger value="custom-dump">Custom Data Dump</TabsTrigger>
        </TabsList>

        <TabsContent value="mysportsfeeds" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Database className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>MySportsFeeds Integration</CardTitle>
                    <CardDescription>
                      Sync real-time injury reports and roster data from MySportsFeeds API
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
                    onClick={() => window.open('/api/mysportsfeeds/test', '_blank')}
                    disabled={isLoading}
                    variant="outline"
                    size="sm"
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Test Connection
                  </Button>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Available Actions:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Button
                      onClick={() => window.open('/api/mysportsfeeds/injuries', '_blank')}
                      disabled={isLoading}
                      variant="outline"
                      className="w-full"
                    >
                      <AlertCircle className="mr-2 h-4 w-4" />
                      View Injuries
                    </Button>
                    <Button
                      onClick={() => window.open('/api/mysportsfeeds/roster', '_blank')}
                      disabled={isLoading}
                      variant="outline"
                      className="w-full"
                    >
                      <Database className="mr-2 h-4 w-4" />
                      Roster Updates
                    </Button>
                    <Button
                      onClick={() => window.open('/api/mysportsfeeds/stats', '_blank')}
                      disabled={isLoading}
                      variant="outline"
                      className="w-full"
                    >
                      <TrendingUp className="mr-2 h-4 w-4" />
                      Player Stats
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
                    placeholder={`Example format:\n${JSON.stringify(exampleCustomData, null, 2)}`}
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={processCustomDataDump}
                    disabled={isLoading || !customData.trim()}
                    className="flex-1"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {isLoading ? 'Processing...' : 'Process Data Dump'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCustomData(JSON.stringify(exampleCustomData, null, 2))}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Load Example
                  </Button>
                </div>

                {processingResult && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Processing Results
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Total Records</div>
                        <div className="font-semibold">{processingResult.totalRecords}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Successful</div>
                        <div className="font-semibold text-green-600">{processingResult.successfulRecords}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Failed</div>
                        <div className="font-semibold text-red-600">{processingResult.failedRecords}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Processing Time</div>
                        <div className="font-semibold flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {processingResult.processingTime}ms
                        </div>
                      </div>
                    </div>
                    
                    {processingResult.errors.length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-medium text-red-600 mb-2">Errors:</div>
                        <div className="text-sm text-red-500 space-y-1">
                          {processingResult.errors.map((error, index) => (
                            <div key={index} className="font-mono">{error}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}