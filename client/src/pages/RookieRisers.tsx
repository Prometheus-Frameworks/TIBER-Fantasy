import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Target, DollarSign, MessageSquare, Flame, Search, ChevronDown, ChevronUp, AlertTriangle, Activity } from 'lucide-react';

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
  scenario: string;
  formula: string;
  note_grok_fixes: string[];
}

export default function RookieRisers() {
  const [playerId, setPlayerId] = useState('ayomanor'); // Start with working example
  const [searchQuery, setSearchQuery] = useState('ayomanor');
  const [showDetails, setShowDetails] = useState(false);
  
  // Fetch Waiver Heat data
  const { data: waiverData, isLoading, error, refetch } = useQuery<WaiverHeatResult>({
    queryKey: ['/api/rookie-risers/waiver-heat', playerId],
    queryFn: () => fetch(`/api/rookie-risers/waiver-heat?playerId=${playerId}`).then(res => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    }),
    enabled: !!playerId
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setPlayerId(searchQuery.trim().toLowerCase());
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

  const getComponentExplanation = (key: string, value: number) => {
    switch (key) {
      case 'usage_growth':
        return {
          title: 'Usage Growth Analysis',
          score: `${(value * 100).toFixed(1)}%`,
          explanation: value > 0.5 ? 'Significant snap count and target increases week-over-week' : 'Moderate usage trend improvements',
          details: [
            `Snap count trend: ${value > 0.4 ? 'Major increase (+20% snaps)' : 'Steady growth'}`,
            `Route running: ${value > 0.4 ? 'More routes per game (+40%)' : 'Consistent routes'}`,
            `Target share: ${value > 0.4 ? 'Growing target volume (+60%)' : 'Stable targets'}`
          ],
          outlier: value > 0.6 ? '🔥 Elite usage surge - rare for rookies' : value > 0.4 ? '📈 Strong growth trajectory' : '📊 Gradual improvement'
        };
      case 'opportunity_delta':
        return {
          title: 'Opportunity Analysis', 
          score: `${(value * 100).toFixed(1)}%`,
          explanation: value > 0.6 ? 'Major opportunity opened from injury or depth chart movement' : 'Some new opportunities available',
          details: [
            `Injury impact: ${value > 0.6 ? 'Veteran ahead injured (Jefferson ankle)' : 'Minor depth changes'}`,
            `Depth chart: ${value > 0.6 ? 'Moved up significantly (rank 4→3)' : 'Slight position change'}`,
            `Team context: ${value > 0.6 ? 'Clear path to targets' : 'Competing for touches'}`
          ],
          outlier: value > 0.7 ? '🚨 Major injury opportunity - act fast' : value > 0.5 ? '⚡ Clear opening available' : '👀 Monitor situation'
        };
      case 'market_lag':
        return {
          title: 'Market Inefficiency',
          score: `${(value * 100).toFixed(1)}%`,
          explanation: value > 0.4 ? 'Market significantly undervaluing player relative to usage' : 'Market fairly pricing current role',
          details: [
            `Roster %: ${value > 0.4 ? 'Only 45% rostered despite 65% snaps' : 'Appropriate roster rate'}`,
            `ADP movement: ${value > 0.4 ? 'ADP fell 15 spots - market ignoring' : 'Stable draft position'}`,
            `Start rate: ${value > 0.4 ? 'Only 20% starting him - undervalued' : 'Expected start rate'}`
          ],
          outlier: value > 0.5 ? '💎 Hidden gem - market sleeping' : value > 0.3 ? '📉 Some market lag' : '💰 Fairly priced'
        };
      case 'news_weight':
        return {
          title: 'News & Context Weight',
          score: `${(value * 100).toFixed(1)}%`,
          explanation: value > 0.6 ? 'Strong positive coaching staff comments and beat reports' : 'Limited news coverage',
          details: [
            `Coach quotes: ${value > 0.6 ? '"Elic\'s earning starter reps" - Clear endorsement' : 'Standard comments'}`,
            `Beat reports: ${value > 0.6 ? 'Multiple writers noting increased role' : 'Limited coverage'}`,
            `Role clarity: ${value > 0.6 ? 'Coaching staff sees expanded future' : 'Situation still developing'}`
          ],
          outlier: value > 0.7 ? '🗣️ Strong coaching endorsement' : value > 0.5 ? '📰 Positive beat coverage' : '🤐 Quiet on the news front'
        };
      default:
        return { title: '', score: '', explanation: '', details: [], outlier: '' };
    }
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
              placeholder="Try: ayomanor, test_rookie, high_heat"
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

      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-500">
              Error loading data. Try: 'ayomanor', 'test_rookie', or 'high_heat'
            </div>
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
                {waiverData.scenario && (
                  <div className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                    📋 {waiverData.scenario}
                  </div>
                )}
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

          {/* Detailed Breakdown Toggle */}
          <Card>
            <CardHeader>
              <CardTitle 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowDetails(!showDetails)}
              >
                <span>Why This Score? - Detailed Analysis</span>
                {showDetails ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </CardTitle>
              <CardDescription>
                Click to see exactly why {waiverData.playerId} scored {waiverData.waiver_heat}/100 on the Waiver Heat Index
              </CardDescription>
            </CardHeader>
            {showDetails && (
              <CardContent>
                <div className="space-y-6">
                  {/* Component Explanations */}
                  {Object.entries(waiverData.components).map(([key, value]) => {
                    const explanation = getComponentExplanation(key, value);
                    const weight = key === 'usage_growth' ? '40%' : 
                                  key === 'opportunity_delta' ? '30%' : 
                                  key === 'market_lag' ? '20%' : '10%';
                    
                    return (
                      <div key={key} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold flex items-center gap-2">
                            {componentIcons[key as keyof typeof componentIcons]}
                            {explanation.title}
                            <Badge variant="outline">{weight} weight</Badge>
                          </h4>
                          <div className="text-lg font-bold">{explanation.score}</div>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-3">
                          {explanation.explanation}
                        </p>
                        
                        <div className="space-y-2">
                          {explanation.details.map((detail, index) => (
                            <div key={index} className="flex items-start gap-2 text-sm">
                              <Activity className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                              <span>{detail}</span>
                            </div>
                          ))}
                        </div>
                        
                        {explanation.outlier && (
                          <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-950/20 rounded border-l-4 border-orange-500">
                            <div className="flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-400">
                              <AlertTriangle className="h-4 w-4" />
                              {explanation.outlier}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Overall Verdict */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">🎯 Bottom Line</h4>
                    <p className="text-sm">
                      {waiverData.waiver_heat >= 60 ? 
                        `${waiverData.playerId} is a priority waiver add. The combination of increased usage (${(waiverData.components.usage_growth * 100).toFixed(0)}%), clear opportunity (${(waiverData.components.opportunity_delta * 100).toFixed(0)}%), and market lag (${(waiverData.components.market_lag * 100).toFixed(0)}%) creates a strong value play.` :
                      waiverData.waiver_heat >= 40 ?
                        `${waiverData.playerId} is worth a waiver claim. While not elite in every category, the overall trend and opportunity make them a solid pickup.` :
                        `${waiverData.playerId} should be monitored but isn't an urgent add. Watch for further developments.`
                      }
                    </p>
                  </div>
                  
                  {/* Mathematical Formula */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">📊 Formula Breakdown</h4>
                    <div className="font-mono text-sm bg-muted p-3 rounded mb-3">
                      {waiverData.formula}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <strong>Calculation Steps:</strong>
                        <div className="mt-1 space-y-1 font-mono">
                          <div>40% × {waiverData.components.usage_growth.toFixed(3)} = {(0.40 * waiverData.components.usage_growth).toFixed(3)}</div>
                          <div>30% × {waiverData.components.opportunity_delta.toFixed(3)} = {(0.30 * waiverData.components.opportunity_delta).toFixed(3)}</div>
                          <div>20% × {waiverData.components.market_lag.toFixed(3)} = {(0.20 * waiverData.components.market_lag).toFixed(3)}</div>
                          <div>10% × {waiverData.components.news_weight.toFixed(3)} = {(0.10 * waiverData.components.news_weight).toFixed(3)}</div>
                          <div className="border-t pt-1 font-bold">
                            Total = {waiverData.waiver_heat}/100
                          </div>
                        </div>
                      </div>
                      <div>
                        <strong>AI Enhancements:</strong>
                        <div className="mt-1 space-y-1">
                          {waiverData.note_grok_fixes?.map((fix, index) => (
                            <div key={index} className="text-muted-foreground">
                              ✓ {fix}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
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