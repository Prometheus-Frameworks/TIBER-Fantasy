import { useState } from 'react';
import { Link } from 'wouter';
import { Search, Users, AlertTriangle, ChevronLeft, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { searchPlayers, fetchPlayerContext, type PlayerSearchResult, type PlayerContextResponse } from '@/api/forge';

export default function PlayerMapping() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerContextResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || query.trim().length < 2) return;
    
    setLoading(true);
    try {
      const data = await searchPlayers(query);
      setResults(data);
      setSelectedPlayer(null);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlayer = async (playerId: string) => {
    setDetailLoading(true);
    try {
      const ctx = await fetchPlayerContext(playerId);
      setSelectedPlayer(ctx);
    } catch (err) {
      console.error('Failed to load player context:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCopyJson = () => {
    if (selectedPlayer) {
      navigator.clipboard.writeText(JSON.stringify(selectedPlayer, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const positionColors: Record<string, string> = {
    QB: 'bg-pink-600',
    RB: 'bg-green-600',
    WR: 'bg-blue-600',
    TE: 'bg-yellow-600',
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/forge-hub">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" data-testid="button-back">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Hub
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <Users className="h-8 w-8 text-emerald-400" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Player Mapping</h1>
          <Badge className="bg-emerald-600 text-white text-xs">v1.0</Badge>
        </div>

        <div className="flex gap-4 mb-6">
          <Input
            placeholder="Search players (e.g. George Pickens, Gibbs)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="max-w-md bg-[#141824] border-gray-700 text-white"
            data-testid="input-search"
          />
          <Button 
            onClick={handleSearch} 
            disabled={loading || query.trim().length < 2}
            className="bg-emerald-600 hover:bg-emerald-700"
            data-testid="button-search"
          >
            <Search className="h-4 w-4 mr-2" />
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-[#141824] border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-gray-300">Search Results</CardTitle>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  {query.trim().length < 2 ? 'Enter at least 2 characters to search' : 'No results found'}
                </p>
              ) : (
                <div className="space-y-2" data-testid="results-list">
                  {results.map((player) => (
                    <div
                      key={player.playerId}
                      onClick={() => handleSelectPlayer(player.playerId)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedPlayer?.meta.playerId === player.playerId
                          ? 'bg-emerald-900/30 border border-emerald-600'
                          : 'bg-[#0a0e1a] hover:bg-gray-800 border border-transparent'
                      }`}
                      data-testid={`row-player-${player.playerId}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className={`${positionColors[player.position] || 'bg-gray-600'} text-white text-xs`}>
                            {player.position}
                          </Badge>
                          <span className="font-medium text-white">{player.displayName}</span>
                        </div>
                        <span className="text-sm text-gray-400">{player.currentTeam || '—'}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 font-mono">
                        ID: {player.playerId}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#141824] border-gray-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-gray-300">Player Detail</CardTitle>
                {selectedPlayer && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyJson}
                    className="text-gray-400 hover:text-white"
                    data-testid="button-copy"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {detailLoading ? (
                <p className="text-gray-400">Loading...</p>
              ) : !selectedPlayer ? (
                <p className="text-gray-500 text-sm">Click a player to view details</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-400 mb-2">Identity</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Name:</span>
                        <span className="ml-2 text-white">{selectedPlayer.identity.displayName}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Position:</span>
                        <Badge className={`ml-2 ${positionColors[selectedPlayer.identity.position] || 'bg-gray-600'} text-white text-xs`}>
                          {selectedPlayer.identity.position}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-gray-500">Canonical ID:</span>
                        <span className="ml-2 text-white font-mono text-xs">{selectedPlayer.meta.playerId}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Sleeper ID:</span>
                        <span className="ml-2 text-white font-mono text-xs">
                          {selectedPlayer.identity.sleeperId || <span className="text-gray-600">—</span>}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-emerald-400 mb-2">GSIS Mapping</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm">GSIS ID:</span>
                      {selectedPlayer.identity.nflfastrGsisId ? (
                        <span className="text-white font-mono text-xs">{selectedPlayer.identity.nflfastrGsisId}</span>
                      ) : (
                        <div className="flex items-center gap-1 text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          <span className="text-xs">Missing</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-emerald-400 mb-2">Current Team (Roster-Driven)</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Team:</span>
                        <span className="ml-2 text-white font-bold">
                          {selectedPlayer.team.currentTeam || <span className="text-gray-600">Unknown</span>}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Season:</span>
                        <span className="ml-2 text-white">{selectedPlayer.meta.season}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-emerald-400 mb-2">Stats Summary</h3>
                    <div className="text-sm text-gray-400">
                      <span>Games Played: </span>
                      <span className="text-white">{selectedPlayer.metaStats?.gamesPlayed ?? 0}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
