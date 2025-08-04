import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, TestTube, FileJson, FileSpreadsheet } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ProjectionResult {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  projectedYards: number;
  projectedTDs: number;
  receptions?: number;
  source: string;
}

interface TestResults {
  oasisJSON: ProjectionResult[];
  fantasyProsCSV: ProjectionResult[];
  oasisCSV: ProjectionResult[];
  fantasyProsJSON: ProjectionResult[];
}

export default function ProjectionsTest() {
  const [oasisData, setOasisData] = useState('');
  const [fantasyProsData, setFantasyProsData] = useState('');
  const [results, setResults] = useState<ProjectionResult[] | null>(null);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Example data for testing
  const exampleData = {
    oasisJSON: `[
  {
    "playerName": "Patrick Mahomes",
    "position": "QB",
    "team": "KC",
    "projectedYards": 4600,
    "projectedTDs": 36
  },
  {
    "playerName": "Josh Allen",
    "position": "QB", 
    "team": "BUF",
    "projectedYards": 4400,
    "projectedTDs": 35,
    "receptions": 0
  }
]`,
    fantasyProsCSV: `playerName,position,team,projectedYards,projectedTDs,receptions
Patrick Mahomes,QB,KC,4500,35,0
Ja'Marr Chase,WR,CIN,1200,8,85
Saquon Barkley,RB,PHI,1400,12,45
Travis Kelce,TE,KC,900,8,75`,
    oasisCSV: `playerName,position,team,projectedYards,projectedTDs
Justin Jefferson,WR,MIN,1350,9
CeeDee Lamb,WR,DAL,1300,8
Christian McCaffrey,RB,SF,1500,14`,
    fantasyProsJSON: `[
  {
    "playerName": "Lamar Jackson",
    "position": "QB",
    "team": "BAL", 
    "projectedYards": 3800,
    "projectedTDs": 28
  },
  {
    "playerName": "Tyreek Hill",
    "position": "WR",
    "team": "MIA",
    "projectedYards": 1250,
    "projectedTDs": 7,
    "receptions": 95
  }
]`
  };

  const ingestOasis = async () => {
    if (!oasisData.trim()) {
      setError('Please enter OASIS data');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('/api/projections/ingest/oasis', {
        method: 'POST',
        body: JSON.stringify({ data: oasisData }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      setResults(response.projections);
    } catch (err: any) {
      setError(err.message || 'Failed to ingest OASIS data');
    } finally {
      setLoading(false);
    }
  };

  const ingestFantasyPros = async () => {
    if (!fantasyProsData.trim()) {
      setError('Please enter FantasyPros data');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('/api/projections/ingest/fantasy-pros', {
        method: 'POST',
        body: JSON.stringify({ data: fantasyProsData }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      setResults(response.projections);
    } catch (err: any) {
      setError(err.message || 'Failed to ingest FantasyPros data');
    } finally {
      setLoading(false);
    }
  };

  const runAllTests = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('/api/projections/test');
      setTestResults(response.results);
    } catch (err: any) {
      setError(err.message || 'Failed to run tests');
    } finally {
      setLoading(false);
    }
  };

  const loadExample = (source: 'oasisJSON' | 'fantasyProsCSV' | 'oasisCSV' | 'fantasyProsJSON') => {
    if (source.includes('oasis')) {
      setOasisData(exampleData[source]);
    } else {
      setFantasyProsData(exampleData[source]);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Projections Ingestion System
        </h1>
        <p className="text-muted-foreground">
          Test the modular projections ingestion system with support for JSON and CSV formats
        </p>
      </div>

      <Tabs defaultValue="manual" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">Manual Testing</TabsTrigger>
          <TabsTrigger value="automated">Automated Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* OASIS Input */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileJson className="h-5 w-5" />
                  OASIS Projections
                </CardTitle>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => loadExample('oasisJSON')}
                  >
                    Load JSON Example
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => loadExample('oasisCSV')}
                  >
                    Load CSV Example
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Enter OASIS projections data (JSON or CSV format)..."
                  value={oasisData}
                  onChange={(e) => setOasisData(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                <Button 
                  onClick={ingestOasis} 
                  disabled={loading || !oasisData.trim()}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Ingest OASIS Data
                </Button>
              </CardContent>
            </Card>

            {/* MySportsFeeds Input - Replacing FantasyPros */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  MySportsFeeds Data
                </CardTitle>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => loadExample('oasisJSON')}
                  >
                    Load JSON Example
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => loadExample('oasisCSV')}
                  >
                    Load CSV Example
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Enter MySportsFeeds data (JSON or CSV format)..."
                  value={fantasyProsData}
                  onChange={(e) => setFantasyProsData(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                <Button 
                  onClick={ingestFantasyPros} 
                  disabled={loading || !fantasyProsData.trim()}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Ingest MySportsFeeds Data
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="automated">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Automated Test Suite
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Run comprehensive tests with all supported data formats
              </p>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={runAllTests} 
                disabled={loading}
                className="w-full"
              >
                <TestTube className="h-4 w-4 mr-2" />
                Run All Tests
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Manual Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Ingestion Results</CardTitle>
            <p className="text-sm text-muted-foreground">
              Successfully processed {results.length} projections
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((projection, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{projection.position}</Badge>
                    <div>
                      <p className="font-medium">{projection.playerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {projection.team} • ID: {projection.playerId}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      {projection.projectedYards} yards, {projection.projectedTDs} TDs
                    </p>
                    {projection.receptions && (
                      <p className="text-xs text-muted-foreground">
                        {projection.receptions} receptions
                      </p>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {projection.source}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Results */}
      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="oasisJSON" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="oasisJSON">OASIS JSON</TabsTrigger>
                <TabsTrigger value="fantasyProsCSV">FP CSV</TabsTrigger>
                <TabsTrigger value="oasisCSV">OASIS CSV</TabsTrigger>
                <TabsTrigger value="fantasyProsJSON">FP JSON</TabsTrigger>
              </TabsList>
              
              {Object.entries(testResults).map(([key, projections]) => (
                <TabsContent key={key} value={key}>
                  <div className="space-y-2">
                    {projections.map((proj, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{proj.position}</Badge>
                          <span className="font-medium">{proj.playerName}</span>
                          <span className="text-sm text-muted-foreground">{proj.team}</span>
                        </div>
                        <div className="text-sm">
                          {proj.projectedYards} yds, {proj.projectedTDs} TDs
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {proj.source}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}