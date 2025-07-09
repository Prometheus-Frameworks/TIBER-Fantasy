import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Player {
  name: string;
  tier: 'Bench' | 'Depth' | 'Solid' | 'Strong' | 'Premium' | 'Elite';
  value: number;
  positionRank: number;
  isStarter: boolean;
  position?: string;
  age?: number;
}

interface TradeVerdict {
  winner: 'Team A' | 'Team B' | 'Fair Trade';
  confidence: number;
  valueDifference: number;
  teamATotal: number;
  teamBTotal: number;
  analysis: {
    teamA: TradeAnalysis;
    teamB: TradeAnalysis;
  };
  recommendations: string[];
}

interface TradeAnalysis {
  totalValue: number;
  starterValue: number;
  benchValue: number;
  averageAge: number;
  tierBreakdown: Record<string, number>;
  strengthAreas: string[];
  concerns: string[];
}

const TIER_COLORS = {
  'Elite': 'bg-purple-100 text-purple-800 border-purple-300',
  'Premium': 'bg-blue-100 text-blue-800 border-blue-300',
  'Strong': 'bg-green-100 text-green-800 border-green-300',
  'Solid': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Depth': 'bg-orange-100 text-orange-800 border-orange-300',
  'Bench': 'bg-gray-100 text-gray-800 border-gray-300'
};

export default function TradeEvaluator() {
  const [teamA, setTeamA] = useState<Player[]>([]);
  const [teamB, setTeamB] = useState<Player[]>([]);
  const [verdict, setVerdict] = useState<TradeVerdict | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const addPlayer = (team: 'A' | 'B') => {
    const newPlayer: Player = {
      name: '',
      tier: 'Solid',
      value: 50,
      positionRank: 20,
      isStarter: false,
      position: 'RB',
      age: 25
    };

    if (team === 'A') {
      setTeamA([...teamA, newPlayer]);
    } else {
      setTeamB([...teamB, newPlayer]);
    }
  };

  const removePlayer = (team: 'A' | 'B', index: number) => {
    if (team === 'A') {
      setTeamA(teamA.filter((_, i) => i !== index));
    } else {
      setTeamB(teamB.filter((_, i) => i !== index));
    }
  };

  const updatePlayer = (team: 'A' | 'B', index: number, field: keyof Player, value: any) => {
    const updateTeam = team === 'A' ? teamA : teamB;
    const setTeam = team === 'A' ? setTeamA : setTeamB;
    
    const updated = [...updateTeam];
    updated[index] = { ...updated[index], [field]: value };
    setTeam(updated);
  };

  const evaluateTrade = async () => {
    if (teamA.length === 0 || teamB.length === 0) {
      toast({
        title: "Invalid Trade",
        description: "Both teams must have at least one player",
        variant: "destructive"
      });
      return;
    }

    // Validate all players have names
    const allPlayers = [...teamA, ...teamB];
    if (allPlayers.some(p => !p.name.trim())) {
      toast({
        title: "Missing Player Names",
        description: "All players must have names",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/evaluate-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamA, teamB })
      });

      if (!response.ok) {
        throw new Error('Failed to evaluate trade');
      }

      const result = await response.json();
      setVerdict(result);
      
      toast({
        title: "Trade Evaluated",
        description: `Winner: ${result.winner} (${result.confidence}% confidence)`,
        variant: result.winner === 'Fair Trade' ? 'default' : 'default'
      });
    } catch (error) {
      console.error('Trade evaluation error:', error);
      toast({
        title: "Evaluation Failed",
        description: "Could not evaluate trade. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const PlayerForm = ({ player, team, index }: { player: Player; team: 'A' | 'B'; index: number }) => (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`name-${team}-${index}`}>Player Name</Label>
            <Input
              id={`name-${team}-${index}`}
              value={player.name}
              onChange={(e) => updatePlayer(team, index, 'name', e.target.value)}
              placeholder="Player name"
            />
          </div>
          <div>
            <Label htmlFor={`tier-${team}-${index}`}>Tier</Label>
            <Select value={player.tier} onValueChange={(value) => updatePlayer(team, index, 'tier', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Elite">Elite</SelectItem>
                <SelectItem value="Premium">Premium</SelectItem>
                <SelectItem value="Strong">Strong</SelectItem>
                <SelectItem value="Solid">Solid</SelectItem>
                <SelectItem value="Depth">Depth</SelectItem>
                <SelectItem value="Bench">Bench</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={`value-${team}-${index}`}>Value</Label>
            <Input
              id={`value-${team}-${index}`}
              type="number"
              value={player.value}
              onChange={(e) => updatePlayer(team, index, 'value', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor={`rank-${team}-${index}`}>Position Rank</Label>
            <Input
              id={`rank-${team}-${index}`}
              type="number"
              value={player.positionRank}
              onChange={(e) => updatePlayer(team, index, 'positionRank', Number(e.target.value))}
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={`starter-${team}-${index}`}
              checked={player.isStarter}
              onChange={(e) => updatePlayer(team, index, 'isStarter', e.target.checked)}
            />
            <Label htmlFor={`starter-${team}-${index}`}>Starter</Label>
          </div>
          <div className="flex items-center justify-between">
            <Badge className={TIER_COLORS[player.tier]}>{player.tier}</Badge>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => removePlayer(team, index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Trade Evaluator</h1>
          <p className="text-gray-600">Compare dynasty trade packages with intelligent analysis</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Team A */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Team A
                <Button onClick={() => addPlayer('A')} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Player
                </Button>
              </CardTitle>
              <CardDescription>Players you're trading away</CardDescription>
            </CardHeader>
            <CardContent>
              {teamA.map((player, index) => (
                <PlayerForm key={index} player={player} team="A" index={index} />
              ))}
              {teamA.length === 0 && (
                <p className="text-gray-500 text-center py-8">No players added</p>
              )}
            </CardContent>
          </Card>

          {/* Team B */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Team B
                <Button onClick={() => addPlayer('B')} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Player
                </Button>
              </CardTitle>
              <CardDescription>Players you're receiving</CardDescription>
            </CardHeader>
            <CardContent>
              {teamB.map((player, index) => (
                <PlayerForm key={index} player={player} team="B" index={index} />
              ))}
              {teamB.length === 0 && (
                <p className="text-gray-500 text-center py-8">No players added</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Evaluate Button */}
        <div className="text-center mb-8">
          <Button 
            onClick={evaluateTrade} 
            disabled={isLoading || teamA.length === 0 || teamB.length === 0}
            size="lg"
          >
            {isLoading ? 'Evaluating...' : 'Evaluate Trade'}
          </Button>
        </div>

        {/* Results */}
        {verdict && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Trade Analysis
                {verdict.winner === 'Team A' && <TrendingUp className="h-5 w-5 text-green-600" />}
                {verdict.winner === 'Team B' && <TrendingDown className="h-5 w-5 text-red-600" />}
                {verdict.winner === 'Fair Trade' && <Minus className="h-5 w-5 text-gray-600" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <h3 className="font-semibold text-lg">Winner</h3>
                  <Badge className={
                    verdict.winner === 'Team A' ? 'bg-green-100 text-green-800' :
                    verdict.winner === 'Team B' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }>
                    {verdict.winner}
                  </Badge>
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-lg">Confidence</h3>
                  <p className="text-2xl font-bold">{verdict.confidence}%</p>
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-lg">Value Difference</h3>
                  <p className="text-2xl font-bold">{Math.abs(verdict.valueDifference).toFixed(1)}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="font-semibold mb-2">Team A Analysis</h3>
                  <p><strong>Total Value:</strong> {verdict.analysis.teamA.totalValue}</p>
                  <p><strong>Average Age:</strong> {verdict.analysis.teamA.averageAge}</p>
                  <p><strong>Strengths:</strong> {verdict.analysis.teamA.strengthAreas.join(', ') || 'None'}</p>
                  <p><strong>Concerns:</strong> {verdict.analysis.teamA.concerns.join(', ') || 'None'}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Team B Analysis</h3>
                  <p><strong>Total Value:</strong> {verdict.analysis.teamB.totalValue}</p>
                  <p><strong>Average Age:</strong> {verdict.analysis.teamB.averageAge}</p>
                  <p><strong>Strengths:</strong> {verdict.analysis.teamB.strengthAreas.join(', ') || 'None'}</p>
                  <p><strong>Concerns:</strong> {verdict.analysis.teamB.concerns.join(', ') || 'None'}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Recommendations</h3>
                <ul className="list-disc list-inside space-y-1">
                  {verdict.recommendations.map((rec, index) => (
                    <li key={index} className="text-gray-700">{rec}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}