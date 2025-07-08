import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Users, TrendingUp, Target, Activity } from 'lucide-react';

interface OASISTestResult {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  contextAdjustments: {
    dynastyValueBoost: number;
    ypcProjectionBoost: number;
    touchdownCeilingBoost: number;
    rushingScoreWeightBoost: number;
  };
  appliedTags: string[];
  logs: string[];
  timestamp: string;
}

export default function OASISTeamContext() {
  const [customPlayer, setCustomPlayer] = useState({
    playerId: '',
    playerName: '',
    position: 'WR',
    team: '',
    dynastyValue: 75
  });
  
  const [customTeamContext, setCustomTeamContext] = useState({
    oasisTags: ['High Tempo Pass Offense']
  });

  // Fetch test cases
  const { data: testData, isLoading } = useQuery({
    queryKey: ['/api/analytics/oasis-test-cases'],
    retry: false,
  });

  // Custom analysis mutation
  const customAnalysisMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/analytics/oasis-team-context', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  const runCustomAnalysis = () => {
    customAnalysisMutation.mutate({
      player: customPlayer,
      teamContext: customTeamContext
    });
  };

  const getBoostColor = (boost: number) => {
    if (boost > 0) return 'text-green-600';
    if (boost < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  const formatBoost = (boost: number, suffix: string = '') => {
    if (boost === 0) return '—';
    return `${boost > 0 ? '+' : ''}${boost.toFixed(3)}${suffix}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">OASIS Contextual Team Mapping</h1>
          <p className="text-muted-foreground">
            Temporary framework for testing team-level schematic context logic. 
            Awaiting final OASIS schema from @EaglesXsandOs.
          </p>
        </div>

        {/* Methodology Overview */}
        {testData?.data?.methodology && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Methodology Overview
              </CardTitle>
              <CardDescription>{testData.data.methodology.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(testData.data.methodology.contextMappings || {}).map(([position, mapping]) => (
                  <div key={position} className="p-3 bg-muted rounded-lg">
                    <div className="font-semibold text-sm mb-1">{position}</div>
                    <div className="text-xs text-muted-foreground">{mapping as string}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Cases Results */}
        {testData?.data?.testResults && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Standard Test Cases
              </CardTitle>
              <CardDescription>Validation of OASIS context mappings across all positions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {testData.data.testResults.map((result: OASISTestResult, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold">{result.playerName}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline">{result.position}</Badge>
                          <span>{result.team}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {result.appliedTags.length} Tags Applied
                        </div>
                      </div>
                    </div>

                    {/* Applied Tags */}
                    <div className="mb-3">
                      <div className="flex flex-wrap gap-1">
                        {result.appliedTags.map((tag, tagIndex) => (
                          <Badge key={tagIndex} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Context Adjustments */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span>Dynasty Value:</span>
                        <span className={getBoostColor(result.contextAdjustments.dynastyValueBoost)}>
                          {formatBoost(result.contextAdjustments.dynastyValueBoost)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>YPC Projection:</span>
                        <span className={getBoostColor(result.contextAdjustments.ypcProjectionBoost)}>
                          {formatBoost(result.contextAdjustments.ypcProjectionBoost)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>TD Ceiling:</span>
                        <span className={getBoostColor(result.contextAdjustments.touchdownCeilingBoost)}>
                          {formatBoost(result.contextAdjustments.touchdownCeilingBoost)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rush Weight:</span>
                        <span className={getBoostColor(result.contextAdjustments.rushingScoreWeightBoost)}>
                          {formatBoost(result.contextAdjustments.rushingScoreWeightBoost)}
                        </span>
                      </div>
                    </div>

                    {/* Logs */}
                    <div className="mt-3 p-2 bg-muted rounded text-xs">
                      {result.logs.map((log, logIndex) => (
                        <div key={logIndex}>{log}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Custom Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Custom Player Analysis
            </CardTitle>
            <CardDescription>Test OASIS context mapping with custom player and team data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Player Input */}
              <div className="space-y-4">
                <h4 className="font-semibold">Player Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="playerName">Player Name</Label>
                    <Input
                      id="playerName"
                      value={customPlayer.playerName}
                      onChange={(e) => setCustomPlayer({...customPlayer, playerName: e.target.value})}
                      placeholder="Enter player name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="position">Position</Label>
                    <Select value={customPlayer.position} onValueChange={(value) => setCustomPlayer({...customPlayer, position: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="QB">QB</SelectItem>
                        <SelectItem value="RB">RB</SelectItem>
                        <SelectItem value="WR">WR</SelectItem>
                        <SelectItem value="TE">TE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="team">Team</Label>
                    <Input
                      id="team"
                      value={customPlayer.team}
                      onChange={(e) => setCustomPlayer({...customPlayer, team: e.target.value})}
                      placeholder="Enter team"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dynastyValue">Dynasty Value</Label>
                    <Input
                      id="dynastyValue"
                      type="number"
                      value={customPlayer.dynastyValue}
                      onChange={(e) => setCustomPlayer({...customPlayer, dynastyValue: Number(e.target.value)})}
                    />
                  </div>
                </div>
              </div>

              {/* Team Context Input */}
              <div className="space-y-4">
                <h4 className="font-semibold">Team Context</h4>
                <div>
                  <Label htmlFor="oasisTags">OASIS Tags (one per line)</Label>
                  <Textarea
                    id="oasisTags"
                    value={customTeamContext.oasisTags.join('\n')}
                    onChange={(e) => setCustomTeamContext({
                      oasisTags: e.target.value.split('\n').filter(tag => tag.trim())
                    })}
                    placeholder="High Tempo Pass Offense&#10;Outside Zone Run&#10;Condensed Red Zone Usage&#10;Designed QB Run Concepts"
                    rows={4}
                  />
                </div>
                <Button 
                  onClick={runCustomAnalysis}
                  disabled={customAnalysisMutation.isPending}
                  className="w-full"
                >
                  {customAnalysisMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Analyzing...
                    </>
                  ) : (
                    'Run OASIS Analysis'
                  )}
                </Button>
              </div>
            </div>

            {/* Custom Analysis Results */}
            {customAnalysisMutation.data && (
              <div className="mt-6 p-4 border rounded-lg">
                <h5 className="font-semibold mb-3">Analysis Results</h5>
                <div className="space-y-2 text-sm">
                  {customAnalysisMutation.data.data.logs.map((log: string, index: number) => (
                    <div key={index} className="text-muted-foreground">{log}</div>
                  ))}
                </div>
                
                {customAnalysisMutation.data.data.appliedTags.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm font-medium mb-2">Applied Adjustments:</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span>Dynasty Value:</span>
                        <span className={getBoostColor(customAnalysisMutation.data.data.contextAdjustments.dynastyValueBoost)}>
                          {formatBoost(customAnalysisMutation.data.data.contextAdjustments.dynastyValueBoost)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>YPC Projection:</span>
                        <span className={getBoostColor(customAnalysisMutation.data.data.contextAdjustments.ypcProjectionBoost)}>
                          {formatBoost(customAnalysisMutation.data.data.contextAdjustments.ypcProjectionBoost)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>TD Ceiling:</span>
                        <span className={getBoostColor(customAnalysisMutation.data.data.contextAdjustments.touchdownCeilingBoost)}>
                          {formatBoost(customAnalysisMutation.data.data.contextAdjustments.touchdownCeilingBoost)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rush Weight:</span>
                        <span className={getBoostColor(customAnalysisMutation.data.data.contextAdjustments.rushingScoreWeightBoost)}>
                          {formatBoost(customAnalysisMutation.data.data.contextAdjustments.rushingScoreWeightBoost)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Integration Safety */}
        {testData?.data?.integrationSafety && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Integration Safety
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="font-semibold mb-2">Preserved Methods</h5>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {testData.data.integrationSafety.preservedMethods.map((method: string, index: number) => (
                      <li key={index}>• {method}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h5 className="font-semibold mb-2">Safety Status</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Safe Integration:</span>
                      <Badge variant={testData.data.integrationSafety.safe ? "default" : "destructive"}>
                        {testData.data.integrationSafety.safe ? "✓" : "✗"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Modular Design:</span>
                      <Badge variant={testData.data.integrationSafety.modular ? "default" : "destructive"}>
                        {testData.data.integrationSafety.modular ? "✓" : "✗"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Rollback Capable:</span>
                      <Badge variant={testData.data.integrationSafety.rollbackCapable ? "default" : "destructive"}>
                        {testData.data.integrationSafety.rollbackCapable ? "✓" : "✗"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Upgrade Ready:</span>
                      <Badge variant={testData.data.integrationSafety.upgradeReady ? "default" : "destructive"}>
                        {testData.data.integrationSafety.upgradeReady ? "✓" : "✗"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}