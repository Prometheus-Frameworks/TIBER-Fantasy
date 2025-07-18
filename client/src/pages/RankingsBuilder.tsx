import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Save, Download, RotateCcw } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface Player {
  player_id: number;
  name: string;
  position: string;
  team: string;
}

interface RankedPlayer extends Player {
  rank: number;
  notes?: string;
}

interface RankingSubmission {
  user_id: number;
  mode: 'redraft' | 'dynasty';
  dynasty_mode?: 'rebuilder' | 'contender';
  rankings: Array<{
    player_id: number;
    rank: number;
    notes?: string;
  }>;
}

export default function RankingsBuilder() {
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [mode, setMode] = useState<'redraft' | 'dynasty'>('redraft');
  const [dynastyMode, setDynastyMode] = useState<'rebuilder' | 'contender'>('rebuilder');
  const [myRankings, setMyRankings] = useState<RankedPlayer[]>([]);
  const [userId] = useState(1); // In real app, this would come from auth
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all players
  const { data: playersData, isLoading: playersLoading } = useQuery({
    queryKey: ['/api/players/list'],
    retry: 3
  });

  // Fetch user's existing rankings
  const { data: personalRankingsData, isLoading: personalLoading } = useQuery({
    queryKey: ['/api/rankings/personal', userId, mode, dynastyMode],
    queryFn: () => apiRequest(`/api/rankings/personal?user_id=${userId}&mode=${mode}${mode === 'dynasty' ? `&dynasty_mode=${dynastyMode}` : ''}`)
  });

  // Load personal rankings when data changes
  useEffect(() => {
    if (personalRankingsData?.success && personalRankingsData.data?.rankings) {
      setMyRankings(personalRankingsData.data.rankings);
    }
  }, [personalRankingsData]);

  // Save rankings mutation
  const saveRankingsMutation = useMutation({
    mutationFn: async (rankingData: RankingSubmission) => {
      return apiRequest('/api/rankings/submit', {
        method: 'POST',
        body: JSON.stringify(rankingData)
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Rankings Saved",
          description: `Successfully saved ${data.data.rankingsSubmitted} rankings`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/rankings/personal'] });
      }
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save rankings",
        variant: "destructive"
      });
    }
  });

  // Load consensus template mutation
  const loadConsensusMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/rankings/consensus?format=${mode}${mode === 'dynasty' ? `&dynastyType=${dynastyMode}` : ''}&template=true`);
    },
    onSuccess: (data) => {
      if (data.success && data.data?.rankings) {
        setMyRankings(data.data.rankings);
        toast({
          title: "Template Loaded",
          description: `Loaded ${data.data.rankings.length} consensus rankings as template`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Template Load Failed",
        description: error.message || "Failed to load consensus template",
        variant: "destructive"
      });
    }
  });

  const players = playersData?.success ? playersData.data.players : [];
  const availablePlayers = players.filter((player: Player) => {
    const isRanked = myRankings.some(ranked => ranked.player_id === player.player_id);
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = positionFilter === 'ALL' || player.position === positionFilter;
    const matchesTeam = teamFilter === 'ALL' || player.team === teamFilter;
    
    return !isRanked && matchesSearch && matchesPosition && matchesTeam;
  });

  const positions = [...new Set(players.map((p: Player) => p.position))];
  const teams = [...new Set(players.map((p: Player) => p.team))];

  const addPlayerToRankings = (player: Player) => {
    const newRank = myRankings.length + 1;
    setMyRankings([...myRankings, { ...player, rank: newRank }]);
  };

  const removePlayerFromRankings = (playerId: number) => {
    const updatedRankings = myRankings
      .filter(p => p.player_id !== playerId)
      .map((p, index) => ({ ...p, rank: index + 1 }));
    setMyRankings(updatedRankings);
  };

  const movePlayer = (fromIndex: number, toIndex: number) => {
    const updatedRankings = [...myRankings];
    const [movedPlayer] = updatedRankings.splice(fromIndex, 1);
    updatedRankings.splice(toIndex, 0, movedPlayer);
    
    // Update ranks
    const rerankedPlayers = updatedRankings.map((p, index) => ({ ...p, rank: index + 1 }));
    setMyRankings(rerankedPlayers);
  };

  const saveRankings = () => {
    const submissionData: RankingSubmission = {
      user_id: userId,
      mode,
      dynasty_mode: mode === 'dynasty' ? dynastyMode : undefined,
      rankings: myRankings.map(p => ({
        player_id: p.player_id,
        rank: p.rank,
        notes: p.notes
      }))
    };
    
    saveRankingsMutation.mutate(submissionData);
  };

  const loadConsensusTemplate = () => {
    loadConsensusMutation.mutate();
  };

  const clearRankings = () => {
    setMyRankings([]);
  };

  const exportRankings = () => {
    const exportData = myRankings.map(p => ({
      rank: p.rank,
      name: p.name,
      position: p.position,
      team: p.team,
      notes: p.notes || ''
    }));
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rankings-${mode}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Rankings Builder
          </h1>
          
          {/* Mode Selection */}
          <div className="flex flex-wrap gap-4 mb-6">
            <Select value={mode} onValueChange={(value: 'redraft' | 'dynasty') => setMode(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="redraft">Redraft</SelectItem>
                <SelectItem value="dynasty">Dynasty</SelectItem>
              </SelectContent>
            </Select>
            
            {mode === 'dynasty' && (
              <Select value={dynastyMode} onValueChange={(value: 'rebuilder' | 'contender') => setDynastyMode(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rebuilder">Rebuilder</SelectItem>
                  <SelectItem value="contender">Contender</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Player Pool */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Player Pool
                <Badge variant="secondary">{availablePlayers.length}</Badge>
              </CardTitle>
              
              {/* Search and Filters */}
              <div className="space-y-4">
                <Input
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
                
                <div className="flex gap-2">
                  <Select value={positionFilter} onValueChange={setPositionFilter}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      {positions.map(pos => (
                        <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={teamFilter} onValueChange={setTeamFilter}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      {teams.map(team => (
                        <SelectItem key={team} value={team}>{team}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {playersLoading ? (
                <div className="text-center py-8">Loading players...</div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {availablePlayers.map((player: Player) => (
                    <div key={player.player_id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{player.position}</Badge>
                        <div>
                          <div className="font-medium">{player.name}</div>
                          <div className="text-sm text-gray-500">{player.team}</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => addPlayerToRankings(player)}
                        className="flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </Button>
                    </div>
                  ))}
                  
                  {availablePlayers.length === 0 && !playersLoading && (
                    <div className="text-center py-8 text-gray-500">
                      No available players found
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Rankings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  My Rankings
                  <Badge variant="secondary">{myRankings.length}</Badge>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadConsensusTemplate}
                    disabled={loadConsensusMutation.isPending}
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Load Template
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearRankings}
                    disabled={myRankings.length === 0}
                  >
                    Clear
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              {personalLoading ? (
                <div className="text-center py-8">Loading your rankings...</div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {myRankings.map((player, index) => (
                    <div key={player.player_id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-sm font-bold">
                          {player.rank}
                        </div>
                        <Badge variant="outline">{player.position}</Badge>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{player.name}</div>
                          <div className="text-sm text-gray-500">{player.team}</div>
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => movePlayer(index, Math.max(0, index - 1))}
                          disabled={index === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => movePlayer(index, Math.min(myRankings.length - 1, index + 1))}
                          disabled={index === myRankings.length - 1}
                        >
                          ↓
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removePlayerFromRankings(player.player_id)}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {myRankings.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No players ranked yet. Add players from the pool or load a template.
                    </div>
                  )}
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex gap-2 mt-6">
                <Button
                  onClick={saveRankings}
                  disabled={myRankings.length === 0 || saveRankingsMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saveRankingsMutation.isPending ? 'Saving...' : 'Save Rankings'}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={exportRankings}
                  disabled={myRankings.length === 0}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}