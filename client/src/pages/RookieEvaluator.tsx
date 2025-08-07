import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, TrendingUp, TrendingDown, Target, Users, Star, GraduationCap } from 'lucide-react';

interface RookieData {
  // Name field variations
  name?: string;
  player_name?: string;
  // Position and team
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  // ADP and draft info  
  adp?: number;
  college?: string;
  draft_round?: number;
  draft_pick?: number;
  // Projection variations
  projected_points?: number;
  proj_points?: number;
  points?: number;
  // Compass scores
  compass_score?: number;
  tier?: string;
  north_score?: number;
  east_score?: number;
  south_score?: number;
  west_score?: number;
  draft_capital_tier?: string;
  evaluation_notes?: string[];
  dynasty_projection?: string;
  // Stats variations
  rec?: number;
  receptions?: number;
  rec_yds?: number;
  rec_yards?: number;
  rec_td?: number;
  rec_tds?: number;
  rush_yds?: number;
  rush_yards?: number;
  rush_td?: number;
  rush_tds?: number;
  // Flask authentic data structure
  receiving_yards?: number;
  receiving_touchdowns?: number;
  yards_per_reception?: number;
  yards_after_catch?: number;
  red_zone_targets?: number;
  pff_receiving_grade?: number;
  pff_pass_blocking_grade?: number;
  targets?: number;
  games_played?: number;
  age?: number;
  rookie_status?: string;
  notes?: string;
}

interface RookieEvaluationResponse {
  success: boolean;
  position?: string;
  rookies?: RookieData[];
  total_rookies?: number;
  error?: string;
}

interface PythonEvaluationResponse {
  success: boolean;
  evaluation?: {
    name: string;
    position: string;
    final_score: number;
    tier: string;
    dynasty_flags: string[];
    traits: string[];
    evaluation_summary: string;
    north_score: number;
    east_score: number;
    south_score: number;
    west_score: number;
  };
  error?: string;
}

const getTierColor = (tier: string) => {
  switch (tier?.toUpperCase()) {
    case 'ELITE': case 'S': return 'bg-purple-500';
    case 'EXCELLENT': case 'A': return 'bg-blue-500';
    case 'SOLID': case 'B': return 'bg-green-500';
    case 'UPSIDE': case 'C': return 'bg-yellow-500';
    case 'DEEP': case 'D': return 'bg-gray-500';
    default: return 'bg-gray-400';
  }
};

const getScoreColor = (score: number) => {
  if (score >= 8.0) return 'text-purple-600';
  if (score >= 7.0) return 'text-blue-600';
  if (score >= 6.0) return 'text-green-600';
  if (score >= 5.0) return 'text-yellow-600';
  return 'text-gray-600';
};

const getCompassIcon = (direction: string) => {
  switch (direction) {
    case 'north': return <TrendingUp className="w-4 h-4" />;
    case 'east': return <Target className="w-4 h-4" />;
    case 'south': return <TrendingDown className="w-4 h-4" />;
    case 'west': return <Users className="w-4 h-4" />;
    default: return <Target className="w-4 h-4" />;
  }
};

export default function RookieEvaluator() {
  const [rookies, setRookies] = useState<RookieData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL');
  const [evaluationMode, setEvaluationMode] = useState<'typescript' | 'python'>('typescript');

  // Single player evaluation state
  const [singlePlayerData, setSinglePlayerData] = useState({
    name: '',
    position: 'WR' as 'QB' | 'RB' | 'WR' | 'TE',
    team: '',
    adp: '',
    college: '',
    draft_round: '',
    projected_points: ''
  });
  const [singleEvaluation, setSingleEvaluation] = useState<any>(null);
  const [evaluating, setEvaluating] = useState(false);

  // Specialized fetch function following your pattern
  const fetchRookieTEs = async () => {
    try {
      const res = await fetch('/api/rookies/te');

      const contentType = res.headers.get('content-type');
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Expected JSON but got:\n${text.slice(0, 300)}`);
      }

      const data = await res.json();
      return data;

    } catch (err) {
      console.error("🔥 Rookie TE Fetch Failed:", err.message);
      return null;
    }
  };

  useEffect(() => {
    if (selectedPosition === 'TE') {
      fetchRookieTEs().then(data => {
        if (data) {
          setRookies(data.rookies || []);
          setLoading(false);
        } else {
          setError('Failed to load TE rookies');
          setLoading(false);
        }
      });
    } else {
      fetchRookies();
    }
  }, [selectedPosition]);

  const fetchRookies = async () => {
    try {
      setLoading(true);
      setError('');
      
      const endpoint = selectedPosition === 'ALL' 
        ? '/api/rookies' 
        : `/api/rookies/position/${selectedPosition.toLowerCase()}`;
        
      console.log(`Fetching rookies from: ${endpoint}`);
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch rookies: ${response.status}`);
      }
      
      const data: RookieEvaluationResponse = await response.json();
      console.log('Rookie data:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load rookie data');
      }
      
      setRookies(data.rookies || []);
      
    } catch (err) {
      console.error('Error fetching rookies:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const evaluateSinglePlayer = async () => {
    if (!singlePlayerData.name || !singlePlayerData.position) {
      setError('Name and position are required');
      return;
    }

    try {
      setEvaluating(true);
      setError('');
      
      const endpoint = evaluationMode === 'python' 
        ? '/api/python-rookie/evaluate'
        : '/api/rookie-evaluation/single';
      
      const payload = {
        ...singlePlayerData,
        adp: singlePlayerData.adp ? parseInt(singlePlayerData.adp) : undefined,
        draft_round: singlePlayerData.draft_round ? parseInt(singlePlayerData.draft_round) : undefined,
        projected_points: singlePlayerData.projected_points ? parseInt(singlePlayerData.projected_points) : undefined
      };
      
      console.log(`Evaluating single player via ${endpoint}:`, payload);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Evaluation failed: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Evaluation result:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'Evaluation failed');
      }
      
      setSingleEvaluation(result.evaluation || result.compass_result);
      
    } catch (err) {
      console.error('Error evaluating player:', err);
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  const filteredRookies = rookies ? rookies.filter(rookie => {
    const playerName = rookie.name || rookie.player_name;
    if (!playerName || !rookie.team) return false;
    return playerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           rookie.team.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (rookie.college && rookie.college.toLowerCase().includes(searchTerm.toLowerCase()));
  }) : [];

  // Early return with your pattern if rookies is null
  if (!rookies) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">🛠 Rookie data unavailable. Check console for details.</div>
        </div>
      </div>
    );
  }

  if (loading && rookies.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading Rookie Evaluator...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button 
          variant="outline" 
          onClick={() => window.history.back()} 
          className="flex items-center gap-2"
        >
          ← Back
        </Button>
        <div className="flex-1" />
      </div>
      
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <GraduationCap className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Rookie Evaluator</h1>
        </div>
        <p className="text-gray-600">College-to-NFL Dynasty Analysis System</p>
        <div className="text-sm text-gray-500">
          {rookies?.length || 0} prospects loaded across all positions
        </div>
      </div>

      {error && (
        <Card className="border-red-200">
          <CardContent className="p-4">
            <div className="text-red-600">{error}</div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="database" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="database">Rookie Database</TabsTrigger>
          <TabsTrigger value="evaluate">Single Player Evaluation</TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-6">
          {/* Position Filter */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Positions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Positions</SelectItem>
                      <SelectItem value="QB">Quarterbacks</SelectItem>
                      <SelectItem value="RB">Running Backs</SelectItem>
                      <SelectItem value="WR">Wide Receivers</SelectItem>
                      <SelectItem value="TE">Tight Ends</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      type="text"
                      placeholder="Search rookies by name, team, or college..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rookies Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRookies.map((rookie, index) => (
              <Card key={`${rookie.name || rookie.player_name}-${index}`} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{rookie.name || rookie.player_name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{rookie.position}</Badge>
                      {rookie.tier && (
                        <Badge className={`${getTierColor(rookie.tier)} text-white`}>
                          {rookie.tier}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription>
                    {rookie.team} {rookie.college && `• ${rookie.college}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Compass Score */}
                    {rookie.compass_score && (
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${getScoreColor(rookie.compass_score)}`}>
                          {rookie.compass_score}
                        </div>
                        <div className="text-sm text-gray-500">Compass Score</div>
                      </div>
                    )}

                    {/* Draft Info */}
                    <div className="text-xs text-gray-600 space-y-1">
                      {rookie.draft_round && (
                        <div>Draft: Round {rookie.draft_round}</div>
                      )}
                      {rookie.adp && (
                        <div>ADP: {Math.round(rookie.adp * 10) / 10}</div>
                      )}
                      {(rookie.projected_points || rookie.proj_points || rookie.points) && (
                        <div>Proj: {Math.round((rookie.projected_points || rookie.proj_points || rookie.points) * 10) / 10} pts</div>
                      )}
                      {/* Enhanced stats preview with Flask data structure */}
                      {(rookie.rec || rookie.receptions || rookie.receiving_yards) && (
                        <div>
                          {rookie.receptions && <span>Rec: {rookie.receptions}</span>}
                          {rookie.receiving_yards && <span> | {rookie.receiving_yards} yds</span>}
                          {rookie.receiving_touchdowns && <span> | {rookie.receiving_touchdowns} TD</span>}
                        </div>
                      )}
                      {rookie.pff_receiving_grade && (
                        <div>PFF Grade: {rookie.pff_receiving_grade}</div>
                      )}
                    </div>

                    {/* Compass Directions */}
                    {rookie.north_score !== undefined && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center p-2 bg-red-50 rounded">
                          <div className="flex items-center justify-center gap-1">
                            {getCompassIcon('north')}
                            <span className="text-sm font-semibold">N</span>
                          </div>
                          <div className="text-sm">{rookie.north_score}</div>
                        </div>
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <div className="flex items-center justify-center gap-1">
                            {getCompassIcon('east')}
                            <span className="text-sm font-semibold">E</span>
                          </div>
                          <div className="text-sm">{rookie.east_score}</div>
                        </div>
                        <div className="text-center p-2 bg-green-50 rounded">
                          <div className="flex items-center justify-center gap-1">
                            {getCompassIcon('south')}
                            <span className="text-sm font-semibold">S</span>
                          </div>
                          <div className="text-sm">{rookie.south_score}</div>
                        </div>
                        <div className="text-center p-2 bg-yellow-50 rounded">
                          <div className="flex items-center justify-center gap-1">
                            {getCompassIcon('west')}
                            <span className="text-sm font-semibold">W</span>
                          </div>
                          <div className="text-sm">{rookie.west_score}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredRookies.length === 0 && !loading && (
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-gray-500">No rookies found matching your criteria.</div>
                <Button onClick={fetchRookies} className="mt-4">
                  Refresh Database
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="evaluate" className="space-y-6">
          {/* Evaluation Mode Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Evaluation Engine</CardTitle>
              <CardDescription>Choose between TypeScript compass analysis or comprehensive Python evaluation</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={evaluationMode} onValueChange={(value: 'typescript' | 'python') => setEvaluationMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="typescript">TypeScript Compass (4-Directional)</SelectItem>
                  <SelectItem value="python">Python Comprehensive (Advanced Analytics)</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Player Input Form */}
          <Card>
            <CardHeader>
              <CardTitle>Player Information</CardTitle>
              <CardDescription>Enter rookie prospect data for evaluation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    value={singlePlayerData.name}
                    onChange={(e) => setSinglePlayerData(prev => ({...prev, name: e.target.value}))}
                    placeholder="Player name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Position *</label>
                  <Select value={singlePlayerData.position} onValueChange={(value: 'QB' | 'RB' | 'WR' | 'TE') => 
                    setSinglePlayerData(prev => ({...prev, position: value}))}>
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
                  <label className="text-sm font-medium">Team</label>
                  <Input
                    value={singlePlayerData.team}
                    onChange={(e) => setSinglePlayerData(prev => ({...prev, team: e.target.value}))}
                    placeholder="NFL team"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">College</label>
                  <Input
                    value={singlePlayerData.college}
                    onChange={(e) => setSinglePlayerData(prev => ({...prev, college: e.target.value}))}
                    placeholder="College/University"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">ADP</label>
                  <Input
                    type="number"
                    value={singlePlayerData.adp}
                    onChange={(e) => setSinglePlayerData(prev => ({...prev, adp: e.target.value}))}
                    placeholder="Average draft position"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Draft Round</label>
                  <Input
                    type="number"
                    value={singlePlayerData.draft_round}
                    onChange={(e) => setSinglePlayerData(prev => ({...prev, draft_round: e.target.value}))}
                    placeholder="NFL draft round"
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button 
                  onClick={evaluateSinglePlayer} 
                  disabled={evaluating || !singlePlayerData.name || !singlePlayerData.position}
                  className="w-full"
                >
                  {evaluating ? 'Evaluating...' : `Evaluate with ${evaluationMode === 'python' ? 'Python' : 'TypeScript'} Engine`}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Single Evaluation Result */}
          {singleEvaluation && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Evaluation Results: {singleEvaluation.name || singleEvaluation.player_name}
                </CardTitle>
                <CardDescription>
                  {evaluationMode === 'python' ? 'Comprehensive Python Analysis' : '4-Directional Compass Analysis'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${getScoreColor(singleEvaluation.final_score || singleEvaluation.compass_score)}`}>
                      {singleEvaluation.final_score || singleEvaluation.compass_score}
                    </div>
                    <div className="text-sm text-gray-500">
                      {evaluationMode === 'python' ? 'Overall Score' : 'Compass Score'}
                    </div>
                    <Badge className={`${getTierColor(singleEvaluation.tier)} text-white mt-2`}>
                      {singleEvaluation.tier}
                    </Badge>
                  </div>

                  {/* Compass Breakdown */}
                  {(singleEvaluation.north_score !== undefined) && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          {getCompassIcon('north')}
                          <span className="font-semibold">NORTH</span>
                        </div>
                        <div className="text-lg font-bold">{singleEvaluation.north_score}</div>
                        <div className="text-xs text-gray-600">Production/Talent</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          {getCompassIcon('east')}
                          <span className="font-semibold">EAST</span>
                        </div>
                        <div className="text-lg font-bold">{singleEvaluation.east_score}</div>
                        <div className="text-xs text-gray-600">Opportunity/Team</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          {getCompassIcon('south')}
                          <span className="font-semibold">SOUTH</span>
                        </div>
                        <div className="text-lg font-bold">{singleEvaluation.south_score}</div>
                        <div className="text-xs text-gray-600">Age/Risk</div>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 rounded-lg">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          {getCompassIcon('west')}
                          <span className="font-semibold">WEST</span>
                        </div>
                        <div className="text-lg font-bold">{singleEvaluation.west_score}</div>
                        <div className="text-xs text-gray-600">Draft Capital</div>
                      </div>
                    </div>
                  )}

                  {/* Traits and Flags */}
                  {singleEvaluation.traits && (
                    <div>
                      <h4 className="font-semibold mb-2">Player Traits</h4>
                      <div className="flex flex-wrap gap-2">
                        {singleEvaluation.traits.map((trait: string, index: number) => (
                          <Badge key={index} variant="outline">{trait}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {singleEvaluation.dynasty_flags && (
                    <div>
                      <h4 className="font-semibold mb-2">Dynasty Flags</h4>
                      <div className="flex flex-wrap gap-2">
                        {singleEvaluation.dynasty_flags.map((flag: string, index: number) => (
                          <Badge key={index} variant="secondary">{flag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evaluation Summary */}
                  {singleEvaluation.evaluation_summary && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold mb-2">Summary</h4>
                      <p className="text-sm text-gray-700">{singleEvaluation.evaluation_summary}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}