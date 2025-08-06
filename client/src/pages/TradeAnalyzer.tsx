import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, TrendingUp, TrendingDown, Users, Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CompassScores {
  north: number;
  east: number;
  south: number;
  west: number;
  final_score: number;
}

interface PlayerData {
  name: string;
  position: string;
  team: string;
  compass_scores: CompassScores;
  tier?: string;
}

interface TradeAnalysisResponse {
  status: string;
  player1: PlayerData;
  player2: PlayerData;
  verdict: string;
  analysis: {
    score_difference: number;
    winner: string;
    reasoning: string[];
  };
  error?: string;
}

export default function TradeAnalyzer() {
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');
  const [analysis, setAnalysis] = useState<TradeAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const analyzeTrade = async () => {
    if (!player1Name.trim() || !player2Name.trim()) {
      toast({
        title: "Missing Players",
        description: "Please enter both player names to analyze the trade.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/trade-analyzer/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player1: player1Name.trim(),
          player2: player2Name.trim()
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === 'error') {
        throw new Error(data.error || 'Analysis failed');
      }

      setAnalysis(data);
      
      toast({
        title: "Trade Analysis Complete",
        description: `Compared ${data.player1.name} vs ${data.player2.name}`,
      });

    } catch (error) {
      console.error('Trade analysis error:', error);
      toast({
        title: "Analysis Error",
        description: error instanceof Error ? error.message : 'Failed to analyze trade',
        variant: "destructive",
      });
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 7.5) return 'text-purple-600 bg-purple-100';
    if (score >= 6.5) return 'text-blue-600 bg-blue-100';
    if (score >= 5.5) return 'text-green-600 bg-green-100';
    if (score >= 4.5) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getTierColor = (tier: string = 'Unknown') => {
    switch (tier) {
      case 'Elite': return 'bg-purple-500';
      case 'Solid': return 'bg-blue-500';
      case 'Depth': return 'bg-green-500';
      case 'Bench': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const renderPlayerCard = (player: PlayerData, isWinner?: boolean) => (
    <Card className={`relative ${isWinner ? 'ring-2 ring-green-500' : ''}`}>
      {isWinner && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
          Winner
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{player.name}</CardTitle>
            <CardDescription>{player.position} • {player.team}</CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold px-3 py-1 rounded ${getScoreColor(player.compass_scores.final_score)}`}>
              {player.compass_scores.final_score.toFixed(1)}
            </div>
            {player.tier && (
              <Badge className={`${getTierColor(player.tier)} text-white`}>
                {player.tier}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <div className="text-purple-600 font-semibold text-lg">
              {player.compass_scores.north.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">NORTH</div>
          </div>
          <div className="text-center">
            <div className="text-blue-600 font-semibold text-lg">
              {player.compass_scores.east.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">EAST</div>
          </div>
          <div className="text-center">
            <div className="text-red-600 font-semibold text-lg">
              {player.compass_scores.south.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">SOUTH</div>
          </div>
          <div className="text-center">
            <div className="text-green-600 font-semibold text-lg">
              {player.compass_scores.west.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">WEST</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Calculator className="w-8 h-8" />
          Trade Analyzer
        </h1>
        <p className="text-gray-600">Compare players using 4-directional compass scores</p>
      </div>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Player Comparison
          </CardTitle>
          <CardDescription>
            Enter two players to analyze the trade value using compass scores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label htmlFor="player1" className="text-sm font-medium">
                Player 1
              </label>
              <Input
                id="player1"
                placeholder="e.g., Ja'Marr Chase"
                value={player1Name}
                onChange={(e) => setPlayer1Name(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && analyzeTrade()}
              />
            </div>
            
            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-gray-400" />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="player2" className="text-sm font-medium">
                Player 2
              </label>
              <Input
                id="player2"
                placeholder="e.g., Cooper Kupp"
                value={player2Name}
                onChange={(e) => setPlayer2Name(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && analyzeTrade()}
              />
            </div>
          </div>

          <Button 
            onClick={analyzeTrade} 
            disabled={loading || !player1Name.trim() || !player2Name.trim()}
            className="w-full"
          >
            {loading ? 'Analyzing Trade...' : 'Analyze Trade'}
          </Button>
        </CardContent>
      </Card>

      {/* Results Section */}
      {analysis && (
        <div className="space-y-6">
          {/* Trade Verdict */}
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Trade Analysis Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <div className="text-2xl font-bold">
                  {analysis.verdict}
                </div>
                
                {analysis.analysis && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      {analysis.analysis.score_difference > 0 ? (
                        <TrendingUp className="w-5 h-5 text-green-500" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-500" />
                      )}
                      <span className="text-lg">
                        Score Difference: {Math.abs(analysis.analysis.score_difference).toFixed(2)} points
                      </span>
                    </div>
                    
                    {analysis.analysis.reasoning && analysis.analysis.reasoning.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Analysis:</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {analysis.analysis.reasoning.map((reason, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-blue-500">•</span>
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Player Comparison Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderPlayerCard(
              analysis.player1, 
              analysis.analysis?.winner === analysis.player1.name
            )}
            {renderPlayerCard(
              analysis.player2, 
              analysis.analysis?.winner === analysis.player2.name
            )}
          </div>

          <Separator />

          {/* Compass Methodology */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Compass Methodology</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-gray-600">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <strong className="text-purple-600">NORTH (Volume/Talent):</strong>
                  <p>Usage, efficiency, physical traits, breakout indicators</p>
                </div>
                <div>
                  <strong className="text-blue-600">EAST (Environment):</strong>
                  <p>Team offense, scheme fit, target competition, coaching</p>
                </div>
                <div>
                  <strong className="text-red-600">SOUTH (Risk):</strong>
                  <p>Age, injury history, games missed, decline indicators</p>
                </div>
                <div>
                  <strong className="text-green-600">WEST (Value):</strong>
                  <p>ADP vs projection, market efficiency, dynasty value</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}