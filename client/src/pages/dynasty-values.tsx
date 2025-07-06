import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Target, Zap, Activity, Users, MapPin } from 'lucide-react';
import { Link } from 'wouter';

interface DynastyValueScore {
  player: {
    id: number;
    name: string;
    team: string;
    position: string;
    avgPoints: number;
  };
  totalScore: number;
  grade: 'Elite' | 'Great' | 'Good' | 'Average' | 'Poor';
  components: {
    fantasyProduction: number;
    advancedMetrics: number;
    opportunity: number;
    efficiency: number;
    situational: number;
  };
  marketComparison: {
    ourValue: number;
    marketValue: number;
    arbitrageOpportunity: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
  };
  reasoning: string[];
}

export default function DynastyValuesPage() {
  const [selectedTeamId] = useState(1); // Default to first team

  const { data: valuations, isLoading } = useQuery<DynastyValueScore[]>({
    queryKey: ["/api/dynasty/team", selectedTeamId, "valuations"],
    queryFn: async () => {
      const response = await fetch(`/api/dynasty/team/${selectedTeamId}/valuations`);
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
  });

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'Elite': return 'bg-green-100 text-green-800 border-green-200';
      case 'Great': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Good': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Average': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Poor': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getArbitrageIcon = (opportunity: string) => {
    switch (opportunity) {
      case 'BUY': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'SELL': return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'HOLD': return <Minus className="w-4 h-4 text-gray-600" />;
      default: return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getComponentIcon = (component: string) => {
    switch (component) {
      case 'fantasyProduction': return <Target className="w-4 h-4" />;
      case 'advancedMetrics': return <Zap className="w-4 h-4" />;
      case 'opportunity': return <Users className="w-4 h-4" />;
      case 'efficiency': return <Activity className="w-4 h-4" />;
      case 'situational': return <MapPin className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  const getComponentColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 65) return 'text-blue-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mr-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Dynasty Player Values</h1>
              <p className="text-sm text-gray-500">Advanced analytical framework utilizing proprietary scoring algorithms for dynasty optimization</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Methodology Card */}
        <Card className="p-4 md:p-6 mb-4 md:mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-2 md:mb-3">Proprietary Dynasty Valuation System</h2>
          <p className="text-sm text-gray-600 mb-3 md:mb-4">Advanced multi-factor modeling combining predictive analytics with market intelligence to identify high-value dynasty assets</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
            <div className="text-center">
              <Target className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <div className="font-medium text-sm">Fantasy Production</div>
              <div className="text-xs text-gray-600">30% Weight</div>
            </div>
            <div className="text-center">
              <Users className="w-6 h-6 mx-auto mb-2 text-purple-600" />
              <div className="font-medium text-sm">Opportunity</div>
              <div className="text-xs text-gray-600">35% Weight</div>
              <div className="text-xs text-green-600 font-medium">Most Predictive</div>
            </div>
            <div className="text-center">
              <Zap className="w-6 h-6 mx-auto mb-2 text-green-600" />
              <div className="font-medium text-sm">Advanced Metrics</div>
              <div className="text-xs text-gray-600">20% Weight</div>
            </div>
            <div className="text-center">
              <Activity className="w-6 h-6 mx-auto mb-2 text-orange-600" />
              <div className="font-medium text-sm">Efficiency</div>
              <div className="text-xs text-gray-600">10% Weight</div>
              <div className="text-xs text-red-600 font-medium">Low Correlation</div>
            </div>
            <div className="text-center">
              <MapPin className="w-6 h-6 mx-auto mb-2 text-red-600" />
              <div className="font-medium text-sm">Situational</div>
              <div className="text-xs text-gray-600">5% Weight</div>
            </div>
          </div>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Calculating dynasty values...</p>
          </div>
        )}

        {/* Player Valuations */}
        {valuations && (
          <div className="space-y-4">
            {valuations.map((valuation, index) => (
              <Card key={valuation.player.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-blue-800">#{index + 1}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{valuation.player.name}</h3>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{valuation.player.position}</Badge>
                        <span className="text-sm text-gray-600">{valuation.player.team}</span>
                        <span className="text-sm text-gray-600">•</span>
                        <span className="text-sm text-gray-600">{valuation.player.avgPoints?.toFixed(1)} PPG</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center space-x-3">
                      <Badge className={getGradeColor(valuation.grade)}>
                        {valuation.grade}
                      </Badge>
                      <div className="text-2xl font-bold text-gray-900">
                        {valuation.totalScore}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">Dynasty Score</div>
                  </div>
                </div>

                {/* Component Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                  {Object.entries(valuation.components).map(([component, score]) => (
                    <div key={component} className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        {getComponentIcon(component)}
                        <span className={`ml-1 font-bold ${getComponentColor(score)}`}>
                          {score}
                        </span>
                      </div>
                      <Progress value={score} className="h-2 mb-1" />
                      <div className="text-xs text-gray-600 capitalize">
                        {component.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Market Arbitrage */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getArbitrageIcon(valuation.marketComparison.arbitrageOpportunity)}
                      <span className="font-medium">Market Analysis</span>
                    </div>
                    <Badge 
                      variant={valuation.marketComparison.arbitrageOpportunity === 'BUY' ? 'default' : 
                              valuation.marketComparison.arbitrageOpportunity === 'SELL' ? 'destructive' : 'secondary'}
                    >
                      {valuation.marketComparison.arbitrageOpportunity}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    Our Value: {valuation.marketComparison.ourValue} • 
                    Market: {valuation.marketComparison.marketValue} • 
                    Confidence: {valuation.marketComparison.confidence}%
                  </div>
                </div>

                {/* Reasoning */}
                <div>
                  <h4 className="font-medium text-sm text-gray-900 mb-2">Key Insights</h4>
                  <ul className="space-y-1">
                    {valuation.reasoning.map((reason, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {valuations && valuations.length === 0 && (
          <Card className="p-8 text-center">
            <div className="text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No players found</p>
              <p className="text-sm">Add players to your team to see dynasty valuations.</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}