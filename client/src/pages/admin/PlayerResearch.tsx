import { useState } from 'react';
import { Link } from 'wouter';
import { Search, Target, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { searchPlayers, fetchPlayerContext, type PlayerSearchResult, type PlayerContextResponse } from '@/api/forge';

function StatBlock({ title, data, color }: { title: string; data: Record<string, any>; color: string }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <Card className="bg-[#0a0e1a] border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className={`text-sm ${color}`}>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-xs">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const formatValue = (key: string, val: any): string => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'number') {
      if (key.toLowerCase().includes('rate') || key.toLowerCase().includes('share')) {
        return `${(val * 100).toFixed(1)}%`;
      }
      if (key.toLowerCase().includes('epa') || key.toLowerCase().includes('yprr')) {
        return val.toFixed(3);
      }
      return val.toFixed(val % 1 === 0 ? 0 : 2);
    }
    return String(val);
  };

  const formatLabel = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  return (
    <Card className="bg-[#0a0e1a] border-gray-800">
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm ${color}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(data).map(([key, val]) => (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-gray-500">{formatLabel(key)}</span>
              <span className="text-white font-mono">{formatValue(key, val)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlayerResearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerContextResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || query.trim().length < 2) return;
    
    setLoading(true);
    try {
      const data = await searchPlayers(query);
      setResults(data);
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
          <Target className="h-8 w-8 text-cyan-400" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Player Research</h1>
          <Badge className="bg-cyan-600 text-white text-xs">v1.0</Badge>
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
            className="bg-cyan-600 hover:bg-cyan-700"
            data-testid="button-search"
          >
            <Search className="h-4 w-4 mr-2" />
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {results.map((player) => (
              <button
                key={player.playerId}
                onClick={() => handleSelectPlayer(player.playerId)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  selectedPlayer?.meta.playerId === player.playerId
                    ? 'bg-cyan-600 text-white'
                    : 'bg-[#141824] text-gray-300 hover:bg-gray-700'
                }`}
                data-testid={`chip-player-${player.playerId}`}
              >
                {player.displayName}
                <span className="ml-1.5 text-xs opacity-70">{player.position}</span>
              </button>
            ))}
          </div>
        )}

        {detailLoading && (
          <div className="text-center py-8 text-gray-400">Loading player data...</div>
        )}

        {selectedPlayer && !detailLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="bg-[#141824] border-gray-800 lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-gray-300">Identity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Badge className={`${positionColors[selectedPlayer.identity.position] || 'bg-gray-600'} text-white`}>
                      {selectedPlayer.identity.position}
                    </Badge>
                    <h2 className="text-xl font-bold text-white">{selectedPlayer.identity.displayName}</h2>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Team:</span>
                      <span className="ml-2 text-white font-bold">{selectedPlayer.team.currentTeam || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Season:</span>
                      <span className="ml-2 text-white">{selectedPlayer.meta.season}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Games:</span>
                      <span className="ml-2 text-white">{selectedPlayer.metaStats?.gamesPlayed ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Sleeper:</span>
                      <span className="ml-2 text-white font-mono text-xs">
                        {selectedPlayer.identity.sleeperId || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-700">
                    <div className="text-xs text-gray-500">
                      <div>Canonical: <span className="font-mono text-gray-400">{selectedPlayer.meta.playerId}</span></div>
                      <div>GSIS: <span className="font-mono text-gray-400">{selectedPlayer.identity.nflfastrGsisId || '—'}</span></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatBlock 
                  title="Usage" 
                  data={selectedPlayer.usage || {}} 
                  color="text-blue-400" 
                />
                <StatBlock 
                  title="Efficiency" 
                  data={selectedPlayer.efficiency || {}} 
                  color="text-emerald-400" 
                />
                <StatBlock 
                  title="Finishing" 
                  data={selectedPlayer.finishing || {}} 
                  color="text-purple-400" 
                />
              </div>
            </div>

            <div>
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                data-testid="button-toggle-json"
              >
                {showRawJson ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Raw JSON
              </button>
              
              {showRawJson && (
                <pre className="mt-2 p-4 bg-[#141824] border border-gray-800 rounded-lg overflow-x-auto text-xs text-gray-300 font-mono">
                  {JSON.stringify(selectedPlayer, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}

        {!selectedPlayer && !detailLoading && results.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Search for a player to view their detailed stats
          </div>
        )}
      </div>
    </div>
  );
}
