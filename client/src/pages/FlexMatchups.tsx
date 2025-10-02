import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Position = 'RB' | 'WR' | 'TE';

type FlexMatchup = {
  team: string;
  position: Position;
  opponent: string;
  sos_score: number;
  tier: 'green' | 'yellow' | 'red';
};

export default function FlexMatchups() {
  const [rbMatchups, setRbMatchups] = useState<FlexMatchup[]>([]);
  const [wrMatchups, setWrMatchups] = useState<FlexMatchup[]>([]);
  const [teMatchups, setTeMatchups] = useState<FlexMatchup[]>([]);
  const [combinedMatchups, setCombinedMatchups] = useState<FlexMatchup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [season] = useState(2024);

  useEffect(() => {
    const fetchMatchups = async () => {
      setLoading(true);
      try {
        const [rbRes, wrRes, teRes] = await Promise.all([
          fetch(`/api/sos/week5?position=RB&season=${season}`),
          fetch(`/api/sos/week5?position=WR&season=${season}`),
          fetch(`/api/sos/week5?position=TE&season=${season}`)
        ]);

        const [rbData, wrData, teData] = await Promise.all([
          rbRes.json(),
          wrRes.json(),
          teRes.json()
        ]);

        const rb = (rbData.items || []).map((item: any) => ({ ...item, position: 'RB' as Position }));
        const wr = (wrData.items || []).map((item: any) => ({ ...item, position: 'WR' as Position }));
        const te = (teData.items || []).map((item: any) => ({ ...item, position: 'TE' as Position }));

        setRbMatchups(rb);
        setWrMatchups(wr);
        setTeMatchups(te);

        const combined = [...rb, ...wr, ...te].sort((a, b) => b.sos_score - a.sos_score);
        setCombinedMatchups(combined);
      } catch (error) {
        console.error('Failed to fetch matchups:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatchups();
  }, [season]);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'green': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700';
      case 'yellow': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700';
      case 'red': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300';
    }
  };

  const getPositionColor = (position: Position) => {
    switch (position) {
      case 'RB': return 'bg-blue-500 dark:bg-blue-600';
      case 'WR': return 'bg-purple-500 dark:bg-purple-600';
      case 'TE': return 'bg-orange-500 dark:bg-orange-600';
    }
  };

  const filterByTier = (matchups: FlexMatchup[]) => {
    if (selectedTier === 'all') return matchups;
    return matchups.filter(m => m.tier === selectedTier);
  };

  const MatchupCard = ({ matchup }: { matchup: FlexMatchup }) => (
    <Card className={`border-2 ${getTierColor(matchup.tier)}`} data-testid={`matchup-card-${matchup.team}-${matchup.position}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Badge className={`${getPositionColor(matchup.position)} text-white`}>
              {matchup.position}
            </Badge>
            <span className="font-bold text-lg">{matchup.team}</span>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{matchup.sos_score}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Matchup Score</div>
          </div>
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-400">
          vs <span className="font-semibold">{matchup.opponent}</span>
        </div>
        <div className="mt-2 text-xs">
          <Badge variant="outline" className={getTierColor(matchup.tier)}>
            {matchup.tier === 'green' ? 'Great Matchup' : matchup.tier === 'yellow' ? 'Average Matchup' : 'Tough Matchup'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  const MatchupList = ({ matchups, showPosition = false }: { matchups: FlexMatchup[], showPosition?: boolean }) => {
    const filtered = filterByTier(matchups);
    
    if (filtered.length === 0) {
      return (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          No matchups found for selected filter
        </div>
      );
    }

    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((matchup, idx) => (
          <MatchupCard key={`${matchup.team}-${matchup.position}-${idx}`} matchup={matchup} />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-3 sm:p-6">
        <div className="text-center py-12">
          <div className="animate-pulse text-lg text-slate-600 dark:text-slate-400">
            Loading matchup data...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-6">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
          <Target className="h-8 w-8 text-green-600 dark:text-green-400" />
          FLEX Matchup Finder
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          Find the best matchups for your FLEX spot across RB, WR, and TE positions
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
            Week 5 Predictions - Based on Week 4 EPA Rankings
          </span>
        </div>
      </div>

      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          <span className="font-semibold">Matchup Score:</span> 67+ = Great | 33-66 = Average | &lt;33 = Tough
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <Select value={selectedTier} onValueChange={(value: any) => setSelectedTier(value)}>
            <SelectTrigger className="w-40" data-testid="tier-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Matchups</SelectItem>
              <SelectItem value="green">Great Only</SelectItem>
              <SelectItem value="yellow">Average Only</SelectItem>
              <SelectItem value="red">Tough Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" data-testid="tab-all">All FLEX</TabsTrigger>
          <TabsTrigger value="rb" data-testid="tab-rb">RB</TabsTrigger>
          <TabsTrigger value="wr" data-testid="tab-wr">WR</TabsTrigger>
          <TabsTrigger value="te" data-testid="tab-te">TE</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All FLEX-Eligible Matchups</CardTitle>
              <CardDescription>
                Top matchups across RB, WR, and TE sorted by matchup score
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MatchupList matchups={combinedMatchups} showPosition />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rb" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Running Back Matchups</CardTitle>
              <CardDescription>
                Week 5 RB matchups ranked by defensive weakness
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MatchupList matchups={rbMatchups} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wr" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Wide Receiver Matchups</CardTitle>
              <CardDescription>
                Week 5 WR matchups ranked by defensive weakness
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MatchupList matchups={wrMatchups} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="te" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Tight End Matchups</CardTitle>
              <CardDescription>
                Week 5 TE matchups ranked by defensive weakness
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MatchupList matchups={teMatchups} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border">
        <h3 className="font-semibold mb-2 text-sm">How to Use This Tool:</h3>
        <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
          <li>• <strong>Green matchups (67+):</strong> Prioritize these players - defenses are vulnerable at this position</li>
          <li>• <strong>Yellow matchups (33-66):</strong> Average difficulty - trust your studs, be cautious with marginal players</li>
          <li>• <strong>Red matchups (&lt;33):</strong> Tough defenses - consider pivoting to better matchups when possible</li>
          <li>• <strong>Use filters:</strong> Narrow down by matchup quality to find streaming options or avoid bad spots</li>
        </ul>
      </div>
    </div>
  );
}
