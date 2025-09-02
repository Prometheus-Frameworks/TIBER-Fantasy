import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Target, DollarSign, MessageSquare, Flame, Search } from 'lucide-react';

interface WaiverHeatResult {
  success: boolean;
  playerId: string;
  week: number;
  waiver_heat: number;
  components: {
    usage_growth: number;
    opportunity_delta: number;
    market_lag: number;
    news_weight: number;
  };
  formula: string;
  note_grok_fixes: string[];
}

export default function RookieRisers() {
  const [playerId, setPlayerId] = useState('test_rookie');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Fetch Waiver Heat data
  const { data: waiverData, isLoading, refetch } = useQuery<WaiverHeatResult>({
    queryKey: ['/api/rookie-risers/waiver-heat', playerId],
    enabled: !!playerId
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setPlayerId(searchQuery.trim());
      refetch();
    }
  };

  const getHeatColor = (heat: number) => {
    if (heat >= 70) return 'text-red-500';
    if (heat >= 50) return 'text-orange-500';
    if (heat >= 30) return 'text-yellow-500';
    return 'text-gray-500';
  };

  const getHeatLabel = (heat: number) => {
    if (heat >= 70) return 'Must Add';
    if (heat >= 50) return 'Strong Add';
    if (heat >= 30) return 'Warm Add';
    return 'Monitor';
  };

  const componentIcons = {
    usage_growth: <TrendingUp className="h-4 w-4" />,
    opportunity_delta: <Target className="h-4 w-4" />,
    market_lag: <DollarSign className="h-4 w-4" />,
    news_weight: <MessageSquare className="h-4 w-4" />
  };

  const componentLabels = {
    usage_growth: 'Usage Growth',
    opportunity_delta: 'Opportunity',
    market_lag: 'Market Lag',
    news_weight: 'News Weight'
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Flame className="h-8 w-8 text-orange-500" />
          Rookie Risers
        </h1>
        <p className="text-muted-foreground">
          AI-powered waiver heat detection using Grok's formula: 40% Usage + 30% Opportunity + 20% Market + 10% News
        </p>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Player Search
          </CardTitle>
          <CardDescription>
            Enter a player ID or name to calculate their Waiver Heat Index
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter player ID (e.g., test_rookie, ayomanor)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={!searchQuery.trim()}>
              Calculate Heat
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">Calculating Waiver Heat...</div>
          </CardContent>
        </Card>
      )}

      {waiverData && (
        <div className="grid gap-6">
          {/* Main Heat Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Waiver Heat Index</span>
                <Badge variant="outline" className={getHeatColor(waiverData.waiver_heat)}>
                  {getHeatLabel(waiverData.waiver_heat)}
                </Badge>
              </CardTitle>
              <CardDescription>
                Player: {waiverData.playerId} • Week {waiverData.week}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className={`text-6xl font-bold mb-2 ${getHeatColor(waiverData.waiver_heat)}`}>
                  {waiverData.waiver_heat}
                </div>
                <div className="text-muted-foreground mb-4">out of 100</div>
                <Progress 
                  value={waiverData.waiver_heat} 
                  className="w-full h-3"
                />
              </div>
            </CardContent>
          </Card>

          {/* Component Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(waiverData.components).map(([key, value]) => (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    {componentIcons[key as keyof typeof componentIcons]}
                    {componentLabels[key as keyof typeof componentLabels]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-1">
                    {(value * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Normalized Score: {value.toFixed(3)}
                  </div>
                  <Progress 
                    value={value * 100} 
                    className="mt-2 h-2"
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Formula Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Calculation Formula</CardTitle>
              <CardDescription>
                Mathematically verified against Grok's analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="font-mono text-sm bg-muted p-3 rounded">
                  {waiverData.formula}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Calculation:</strong>
                    <div className="mt-1 space-y-1 font-mono">
                      <div>40% × {waiverData.components.usage_growth.toFixed(3)} = {(0.40 * waiverData.components.usage_growth).toFixed(3)}</div>
                      <div>30% × {waiverData.components.opportunity_delta.toFixed(3)} = {(0.30 * waiverData.components.opportunity_delta).toFixed(3)}</div>
                      <div>20% × {waiverData.components.market_lag.toFixed(3)} = {(0.20 * waiverData.components.market_lag).toFixed(3)}</div>
                      <div>10% × {waiverData.components.news_weight.toFixed(3)} = {(0.10 * waiverData.components.news_weight).toFixed(3)}</div>
                    </div>
                  </div>
                  
                  <div>
                    <strong>Grok's Enhancements:</strong>
                    <div className="mt-1 space-y-1">
                      {waiverData.note_grok_fixes?.map((fix, index) => (
                        <div key={index} className="text-xs text-muted-foreground">
                          ✓ {fix}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Example Players */}
          <Card>
            <CardHeader>
              <CardTitle>Try These Examples</CardTitle>
              <CardDescription>
                Click to test different player scenarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { id: 'ayomanor', name: 'Elic Ayomanor', scenario: 'Injury opportunity' },
                  { id: 'test_rookie', name: 'Test Rookie', scenario: 'Baseline calculation' },
                  { id: 'high_heat', name: 'High Heat Player', scenario: 'Must-add candidate' }
                ].map((player) => (
                  <Button
                    key={player.id}
                    variant="outline"
                    className="p-4 h-auto flex flex-col items-start"
                    onClick={() => {
                      setPlayerId(player.id);
                      setSearchQuery(player.id);
                      refetch();
                    }}
                  >
                    <div className="font-semibold">{player.name}</div>
                    <div className="text-xs text-muted-foreground">{player.scenario}</div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}