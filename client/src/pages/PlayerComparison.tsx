import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PlayerSearchResult {
  id: string;
  name: string;
  team: string;
  position: string;
}

interface PlayerUsage {
  playerName: string;
  position: string;
  team: string;
  week: number;
  dataWeek: number;
  dataContext: string;
  targets?: number;
  targetSharePct?: number;
  alignmentOutsidePct?: number;
  alignmentSlotPct?: number;
  carriesTotal?: number;
  snapSharePct?: number;
}

interface OpponentDefense {
  opponent: string;
  week: number;
  outsideWrFpgAllowed?: number;
  slotWrFpgAllowed?: number;
  passEpaAllowed?: number;
  rushEpaAllowed?: number;
}

interface Comparison {
  player1: {
    usage: PlayerUsage;
    opponent: OpponentDefense;
  };
  player2: {
    usage: PlayerUsage;
    opponent: OpponentDefense;
  };
  verdict: {
    recommendation: string;
    confidence: string;
    keyFactors: string[];
  };
}

export default function PlayerComparison() {
  const [player1Search, setPlayer1Search] = useState('');
  const [player2Search, setPlayer2Search] = useState('');
  const [player1Selected, setPlayer1Selected] = useState<PlayerSearchResult | null>(null);
  const [player2Selected, setPlayer2Selected] = useState<PlayerSearchResult | null>(null);
  const [targetWeek, setTargetWeek] = useState(6);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // Player 1 search
  const { data: player1Results = [] } = useQuery<PlayerSearchResult[]>({
    queryKey: ['/api/player-comparison/search', player1Search],
    enabled: player1Search.length >= 2 && !player1Selected,
  });

  // Player 2 search
  const { data: player2Results = [] } = useQuery<PlayerSearchResult[]>({
    queryKey: ['/api/player-comparison/search', player2Search],
    enabled: player2Search.length >= 2 && !player2Selected,
  });

  const handleCompare = async () => {
    if (!player1Selected || !player2Selected) return;

    setIsComparing(true);
    try {
      const response = await fetch('/api/player-comparison/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player1: player1Selected.id,
          player2: player2Selected.id,
          week: targetWeek,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setComparison(data);
      }
    } catch (error) {
      console.error('Comparison error:', error);
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Player Comparison Tool</h1>
        <p className="text-muted-foreground">
          Compare two players side-by-side for Week {targetWeek}
        </p>
      </div>

      {/* Search Boxes */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Player 1 Search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Player 1</CardTitle>
          </CardHeader>
          <CardContent>
            {!player1Selected ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search player name..."
                    value={player1Search}
                    onChange={(e) => setPlayer1Search(e.target.value)}
                    className="pl-10"
                    data-testid="input-player1-search"
                  />
                </div>
                {player1Results.length > 0 && (
                  <div className="border rounded-md divide-y">
                    {player1Results.map((player) => (
                      <button
                        key={player.id}
                        onClick={() => {
                          setPlayer1Selected(player);
                          setPlayer1Search('');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-accent transition-colors"
                        data-testid={`button-select-player1-${player.name}`}
                      >
                        <div className="font-medium">{player.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {player.position} • {player.team}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-lg">{player1Selected.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {player1Selected.position} • {player1Selected.team}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPlayer1Selected(null)}
                  data-testid="button-clear-player1"
                >
                  Change
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Player 2 Search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Player 2</CardTitle>
          </CardHeader>
          <CardContent>
            {!player2Selected ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search player name..."
                    value={player2Search}
                    onChange={(e) => setPlayer2Search(e.target.value)}
                    className="pl-10"
                    data-testid="input-player2-search"
                  />
                </div>
                {player2Results.length > 0 && (
                  <div className="border rounded-md divide-y">
                    {player2Results.map((player) => (
                      <button
                        key={player.id}
                        onClick={() => {
                          setPlayer2Selected(player);
                          setPlayer2Search('');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-accent transition-colors"
                        data-testid={`button-select-player2-${player.name}`}
                      >
                        <div className="font-medium">{player.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {player.position} • {player.team}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-lg">{player2Selected.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {player2Selected.position} • {player2Selected.team}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPlayer2Selected(null)}
                  data-testid="button-clear-player2"
                >
                  Change
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compare Button */}
      {player1Selected && player2Selected && (
        <div className="text-center mb-8">
          <Button
            size="lg"
            onClick={handleCompare}
            disabled={isComparing}
            data-testid="button-compare"
          >
            {isComparing ? 'Comparing...' : `Compare for Week ${targetWeek}`}
          </Button>
        </div>
      )}

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-6">
          {/* Verdict */}
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {comparison.verdict.recommendation.includes('Coin flip') ? (
                  <Minus className="h-5 w-5" />
                ) : comparison.verdict.recommendation.includes(comparison.player1.usage.playerName) ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
                {comparison.verdict.recommendation}
                <Badge variant={
                  comparison.verdict.confidence === 'High' ? 'default' :
                  comparison.verdict.confidence === 'Medium' ? 'secondary' : 'outline'
                }>
                  {comparison.verdict.confidence} Confidence
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {comparison.verdict.keyFactors.map((factor, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Side-by-side comparison */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Player 1 Stats */}
            <Card>
              <CardHeader>
                <CardTitle>{comparison.player1.usage.playerName}</CardTitle>
                {comparison.player1.usage.dataContext && (
                  <Badge variant="outline">
                    Week {comparison.player1.usage.dataWeek} data ({comparison.player1.usage.dataContext})
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Usage</h4>
                  <div className="space-y-1 text-sm">
                    {comparison.player1.usage.targetSharePct && (
                      <div>Target Share: {comparison.player1.usage.targetSharePct.toFixed(1)}%</div>
                    )}
                    {comparison.player1.usage.alignmentOutsidePct && (
                      <div>Outside Alignment: {comparison.player1.usage.alignmentOutsidePct.toFixed(0)}%</div>
                    )}
                    {comparison.player1.usage.alignmentSlotPct && (
                      <div>Slot Alignment: {comparison.player1.usage.alignmentSlotPct.toFixed(0)}%</div>
                    )}
                    {comparison.player1.usage.carriesTotal && (
                      <div>Carries: {comparison.player1.usage.carriesTotal}</div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Week {targetWeek} Opponent</h4>
                  <div className="space-y-1 text-sm">
                    <div className="font-medium">vs {comparison.player1.opponent.opponent}</div>
                    {comparison.player1.opponent.outsideWrFpgAllowed && (
                      <div>Outside WR FPG Allowed: {comparison.player1.opponent.outsideWrFpgAllowed.toFixed(1)}</div>
                    )}
                    {comparison.player1.opponent.rushEpaAllowed && (
                      <div>Rush EPA Allowed: {comparison.player1.opponent.rushEpaAllowed.toFixed(3)}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Player 2 Stats */}
            <Card>
              <CardHeader>
                <CardTitle>{comparison.player2.usage.playerName}</CardTitle>
                {comparison.player2.usage.dataContext && (
                  <Badge variant="outline">
                    Week {comparison.player2.usage.dataWeek} data ({comparison.player2.usage.dataContext})
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Usage</h4>
                  <div className="space-y-1 text-sm">
                    {comparison.player2.usage.targetSharePct && (
                      <div>Target Share: {comparison.player2.usage.targetSharePct.toFixed(1)}%</div>
                    )}
                    {comparison.player2.usage.alignmentOutsidePct && (
                      <div>Outside Alignment: {comparison.player2.usage.alignmentOutsidePct.toFixed(0)}%</div>
                    )}
                    {comparison.player2.usage.alignmentSlotPct && (
                      <div>Slot Alignment: {comparison.player2.usage.alignmentSlotPct.toFixed(0)}%</div>
                    )}
                    {comparison.player2.usage.carriesTotal && (
                      <div>Carries: {comparison.player2.usage.carriesTotal}</div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Week {targetWeek} Opponent</h4>
                  <div className="space-y-1 text-sm">
                    <div className="font-medium">vs {comparison.player2.opponent.opponent}</div>
                    {comparison.player2.opponent.outsideWrFpgAllowed && (
                      <div>Outside WR FPG Allowed: {comparison.player2.opponent.outsideWrFpgAllowed.toFixed(1)}</div>
                    )}
                    {comparison.player2.opponent.rushEpaAllowed && (
                      <div>Rush EPA Allowed: {comparison.player2.opponent.rushEpaAllowed.toFixed(3)}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
