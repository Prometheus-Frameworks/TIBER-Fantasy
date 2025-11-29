import { useState, useCallback, useMemo } from 'react';
import { Link } from 'wouter';
import { 
  ArrowLeft, 
  Search, 
  Users, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  Database
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';

type PlayerMappingResult = {
  playerId: string;
  displayName: string;
  sleeperId: string | null;
  nflfastrGsisId: string | null;
  position: string;
  team: string;
  season: number;
  usage: Record<string, unknown>;
  efficiency: Record<string, unknown>;
  finishing: Record<string, unknown>;
  meta: Record<string, unknown>;
};

type SearchResponse = {
  meta: {
    query: string;
    position: string;
    limit: number;
    count: number;
  };
  data: PlayerMappingResult[];
  error?: string;
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    if (value % 1 === 0) return value.toString();
    return value.toFixed(3);
  }
  return String(value);
}

function StatBlock({ title, stats }: { title: string; stats: Record<string, unknown> }) {
  const entries = Object.entries(stats);
  if (entries.length === 0) {
    return (
      <div className="bg-[#0a0e1a] rounded-lg p-3 border border-gray-800">
        <div className="text-xs text-gray-500 mb-2">{title}</div>
        <div className="text-gray-500 text-sm">No data</div>
      </div>
    );
  }
  
  return (
    <div className="bg-[#0a0e1a] rounded-lg p-3 border border-gray-800">
      <div className="text-xs text-gray-500 mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {entries.map(([key, val]) => (
          <div key={key} className="flex justify-between text-sm">
            <span className="text-gray-400">{key}:</span>
            <span className="text-white font-mono">{formatValue(val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerResultRow({ player, onCopy }: { player: PlayerMappingResult; onCopy: (json: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  const hasStats = Object.keys(player.usage).length > 0 || 
                   Object.keys(player.efficiency).length > 0 ||
                   Object.keys(player.finishing).length > 0;

  const jsonData = useMemo(() => JSON.stringify(player, null, 2), [player]);

  const keyStats = useMemo(() => {
    const stats: { label: string; value: string }[] = [];
    
    if (player.position === 'WR') {
      if (player.usage.targetShare !== undefined) {
        stats.push({ label: 'TS', value: ((player.usage.targetShare as number) * 100).toFixed(1) + '%' });
      }
      if (player.efficiency.yprrEst !== undefined) {
        stats.push({ label: 'YPRR', value: (player.efficiency.yprrEst as number).toFixed(2) });
      }
      if (player.efficiency.epaPerTarget !== undefined) {
        stats.push({ label: 'EPA/T', value: (player.efficiency.epaPerTarget as number).toFixed(2) });
      }
      if (player.finishing.tds !== undefined) {
        stats.push({ label: 'TDs', value: String(player.finishing.tds) });
      }
    } else if (player.position === 'RB') {
      if (player.usage.carryShare !== undefined) {
        stats.push({ label: 'CS', value: ((player.usage.carryShare as number) * 100).toFixed(1) + '%' });
      }
      if (player.efficiency.yardsPerCarry !== undefined) {
        stats.push({ label: 'YPC', value: (player.efficiency.yardsPerCarry as number).toFixed(2) });
      }
      if (player.efficiency.rushSuccessRate !== undefined) {
        stats.push({ label: 'SR', value: ((player.efficiency.rushSuccessRate as number) * 100).toFixed(1) + '%' });
      }
      if (player.finishing.totalTds !== undefined) {
        stats.push({ label: 'TDs', value: String(player.finishing.totalTds) });
      }
    }
    
    return stats;
  }, [player]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div 
        className={`border-b border-gray-800 ${isOpen ? 'bg-[#0a0e1a]/30' : 'hover:bg-[#0a0e1a]/30'}`}
        data-testid={`row-player-${player.playerId}`}
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-center px-4 py-3 cursor-pointer">
            <div className="flex-1 min-w-0 grid grid-cols-12 gap-4 items-center">
              <div className="col-span-3 flex items-center gap-2">
                <span className="text-white font-medium truncate" data-testid={`text-name-${player.playerId}`}>
                  {player.displayName}
                </span>
              </div>
              
              <div className="col-span-1 text-center">
                <Badge 
                  className={`text-xs ${
                    player.position === 'WR' ? 'bg-blue-600' :
                    player.position === 'RB' ? 'bg-green-600' :
                    player.position === 'TE' ? 'bg-orange-600' :
                    player.position === 'QB' ? 'bg-purple-600' :
                    'bg-gray-600'
                  } text-white`}
                  data-testid={`badge-position-${player.playerId}`}
                >
                  {player.position}
                </Badge>
              </div>
              
              <div className="col-span-1 text-center">
                <span className="text-gray-400 font-mono text-sm" data-testid={`text-team-${player.playerId}`}>
                  {player.team}
                </span>
              </div>
              
              <div className="col-span-1 text-center">
                <span className="text-gray-500 font-mono text-xs" data-testid={`text-season-${player.playerId}`}>
                  {player.season}
                </span>
              </div>
              
              <div className="col-span-2 text-center">
                <span className="text-cyan-400 font-mono text-xs" data-testid={`text-sleeper-${player.playerId}`}>
                  {player.sleeperId || '—'}
                </span>
              </div>
              
              <div className="col-span-2 text-center">
                <span className="text-yellow-400 font-mono text-xs truncate" data-testid={`text-canonical-${player.playerId}`}>
                  {player.playerId}
                </span>
              </div>
              
              <div className="col-span-2 flex justify-end gap-2">
                {keyStats.slice(0, 3).map((stat, i) => (
                  <span key={i} className="text-xs text-gray-400" data-testid={`stat-${stat.label.toLowerCase()}-${player.playerId}`}>
                    <span className="text-gray-500">{stat.label}:</span>
                    <span className="text-white ml-1 font-mono">{stat.value}</span>
                  </span>
                ))}
              </div>
            </div>
            
            <div className="ml-2 flex-shrink-0">
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            {hasStats ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatBlock title="Usage" stats={player.usage} />
                <StatBlock title="Efficiency" stats={player.efficiency} />
                <StatBlock title="Finishing" stats={player.finishing} />
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                No advanced stats available for this player
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Games: {formatValue(player.meta.gamesPlayed)} | 
                Last Updated: {player.meta.lastUpdated ? new Date(player.meta.lastUpdated as string).toLocaleString() : '—'}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(jsonData);
                }}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
                data-testid={`button-copy-${player.playerId}`}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy JSON
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function PlayerMappingTest() {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('ALL');
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<PlayerMappingResult[]>([]);
  const [searchMeta, setSearchMeta] = useState<SearchResponse['meta'] | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || query.trim().length < 2) {
      toast({
        title: 'Query too short',
        description: 'Please enter at least 2 characters to search',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({
        query: query.trim(),
        limit: String(limit),
      });
      if (position !== 'ALL') {
        params.append('position', position);
      }

      const res = await fetch(`/api/admin/player-mapping/search?${params}`);
      const data: SearchResponse = await res.json();

      if (data.error) {
        toast({
          title: 'Search failed',
          description: data.error,
          variant: 'destructive',
        });
        setResults([]);
        setSearchMeta(null);
      } else {
        setResults(data.data);
        setSearchMeta(data.meta);
        
        if (data.data.length === 0) {
          toast({
            title: 'No results',
            description: `No players found matching "${query}"`,
          });
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      toast({
        title: 'Search error',
        description: 'Failed to fetch player mappings',
        variant: 'destructive',
      });
      setResults([]);
      setSearchMeta(null);
    } finally {
      setLoading(false);
    }
  }, [query, position, limit, toast]);

  const handleCopyPlayer = useCallback(async (json: string) => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      toast({ title: 'Copied', description: 'Player JSON copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard', variant: 'destructive' });
    }
  }, [toast]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/forge-hub">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-gray-400 hover:text-white"
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Hub
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Database className="h-6 w-6 text-emerald-400" />
              <h1 className="text-2xl font-bold text-white" data-testid="text-page-title">
                Player Mapping Test
              </h1>
              <Badge className="bg-emerald-600 text-white text-xs">Admin</Badge>
            </div>
          </div>
        </div>

        <Card className="bg-[#141824] border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-400" />
              Search Player Mappings
            </CardTitle>
            <CardDescription className="text-gray-400">
              Debug player identity resolution, IDs, and advanced stats mapping
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px] space-y-2">
                <Label className="text-gray-300">Player Name</Label>
                <Input
                  type="text"
                  placeholder="e.g., George Pickens, Chase, Williams"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-[#0a0e1a] border-gray-700 text-white"
                  data-testid="input-search"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-gray-300">Position</Label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger 
                    className="w-28 bg-[#0a0e1a] border-gray-700 text-white"
                    data-testid="select-position"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141824] border-gray-700">
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="WR">WR</SelectItem>
                    <SelectItem value="RB">RB</SelectItem>
                    <SelectItem value="TE">TE</SelectItem>
                    <SelectItem value="QB">QB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2 w-32">
                <Label className="text-gray-300">Limit: {limit}</Label>
                <Slider
                  min={5}
                  max={50}
                  step={5}
                  value={[limit]}
                  onValueChange={(vals) => setLimit(vals[0])}
                  className="w-full"
                  data-testid="slider-limit"
                />
              </div>
              
              <Button
                onClick={handleSearch}
                disabled={loading || query.trim().length < 2}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="button-search"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {hasSearched && (
          <Card className="bg-[#141824] border-gray-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-lg">
                  {searchMeta ? (
                    <>
                      Found {searchMeta.count} player{searchMeta.count !== 1 ? 's' : ''} for "{searchMeta.query}"
                      {searchMeta.position !== 'ALL' && (
                        <Badge className="ml-2 bg-gray-600 text-white text-xs">{searchMeta.position}</Badge>
                      )}
                    </>
                  ) : (
                    'Results'
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                </div>
              ) : results.length > 0 ? (
                <>
                  <div className="px-4 py-2 bg-[#0a0e1a] border-b border-gray-800">
                    <div className="grid grid-cols-12 gap-4 text-xs text-gray-500 font-medium">
                      <div className="col-span-3">Name</div>
                      <div className="col-span-1 text-center">Pos</div>
                      <div className="col-span-1 text-center">Team</div>
                      <div className="col-span-1 text-center">Season</div>
                      <div className="col-span-2 text-center">Sleeper ID</div>
                      <div className="col-span-2 text-center">Canonical ID</div>
                      <div className="col-span-2 text-right">Key Stats</div>
                    </div>
                  </div>
                  <div data-testid="results-list">
                    {results.map((player) => (
                      <PlayerResultRow 
                        key={player.playerId} 
                        player={player} 
                        onCopy={handleCopyPlayer}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No players found matching your search
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-8 pt-6 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Player Mapping Sanity Test | FORGE v0.2
            </p>
            <Link href="/admin/forge-hub">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-gray-400 hover:text-white"
                data-testid="button-back-hub"
              >
                Back to Admin Hub
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
