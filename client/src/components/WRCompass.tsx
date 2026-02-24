import { useState, useTransition, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Search, Navigation } from 'lucide-react';

const norm = (s: string = '') => s.normalize().toLowerCase().trim();
const titleCase = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());

const matches = (p: any, q: string) => {
  const nq = norm(q);
  return [p.name, p.displayName, p.player_name, p.team, p.alias].some((v: string) => norm(v || '').includes(nq));
};

interface WRPlayer {
  player_name: string;
  name?: string;
  team: string;
  pos?: string;
  compass: {
    north: number;
    east: number;
    south: number;
    west: number;
    score?: number;
  };
  alias?: string;
  age?: number;
  adp?: number;
  fpg?: number;
  rating?: number;
  adjusted_rating?: number;
}

interface WRSearchResponse {
  data: WRPlayer[];
  metadata?: any;
}

export default function WRCompass() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isPending, startTransition] = useTransition();

  // Debounce search input to avoid excessive API calls
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);
  
  const { data: wrResponse, isLoading } = useQuery<WRPlayer[] | WRSearchResponse>({
    queryKey: ['/api/compass/wr', debouncedSearch],
    queryFn: async () => {
      // Primary call to new bridge endpoint
      let url = `/api/compass/WR?search=${encodeURIComponent(debouncedSearch)}&limit=50`;
      if (import.meta.env.DEV) console.log('WRCompass: Fetching WR data from', url);
      let response = await fetch(url);
      let data = await response.json();

      // Fallback to legacy if new route is empty
      if (!data?.data?.length) {
        if (import.meta.env.DEV) console.log('WRCompass: Bridge empty, trying legacy endpoint');
        url = `/api/compass/wr?search=${encodeURIComponent(debouncedSearch)}&limit=50`;
        response = await fetch(url);
        const legacy = await response.json();
        if (legacy?.data?.length) data = legacy;
      }

      if (import.meta.env.DEV) {
        console.log('WRCompass: Successfully loaded', data?.data?.length || 0, 'WRs');
        console.log('WRCompass: Sample player:', data?.data?.[0]);
      }
      return data;
    },
  });

  // Handle response format - expect envelope with data array
  const wrData = (wrResponse as WRSearchResponse)?.data || [];
  if (import.meta.env.DEV) console.log('WRCompass: Processing', wrData.length, 'players');

  // Ensure proper naming for display
  const mappedData = wrData.map((player: any) => ({
    ...player,
    name: player.name || player.player_name || 'Unknown Player',
    displayName: player.player_name || player.name || 'Unknown Player'
  }));
  if (import.meta.env.DEV) console.log('WRCompass: Mapped', mappedData.length, 'players, sample:', mappedData[0]);

  const filteredData = mappedData.filter((player) => {
    if (!debouncedSearch) return true;
    return matches(player, debouncedSearch);
  });
  if (import.meta.env.DEV) console.log('WRCompass: Filtered', filteredData.length, 'players for search:', debouncedSearch);

  const getCompassColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500'; 
    if (score >= 40) return 'bg-yellow-500';
    if (score >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };



  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          WR Player Compass v1.0.3 ⚡
        </CardTitle>
        <CardDescription>
          4-directional player evaluation: Volume/Talent (N), Scheme/Environment (E), Age/Risk (S), Market Value (W)
        </CardDescription>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, team, or alias..."
            value={search}
            onChange={(e) => {
              const value = e.target.value;
              startTransition(() => {
                setSearch(value);
              });
            }}
            className="pl-10"
          />
          {(isPending || (search !== debouncedSearch)) && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
              Searching...
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-2 bg-gray-200 rounded w-full mb-1" />
                <div className="h-2 bg-gray-200 rounded w-full mb-1" />
                <div className="h-2 bg-gray-200 rounded w-full mb-1" />
                <div className="h-2 bg-gray-200 rounded w-full" />
              </div>
            ))}
          </div>
        ) : !wrResponse || filteredData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {!wrResponse ? (
              <>Loading WR compass data...</>
            ) : debouncedSearch ? (
              <>No WRs match "{debouncedSearch}". Try a team code like "MIA".</>
            ) : (
              <>No WR data available. Check API connection.</>
            )}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-4 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded">
                wrResponse: {JSON.stringify(!!wrResponse)}<br/>
                wrData length: {wrData?.length ?? 0}<br/>
                mappedData length: {mappedData?.length ?? 0}<br/>
                filteredData length: {filteredData?.length ?? 0}<br/>
                first player: {JSON.stringify(mappedData?.[0]?.displayName)}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredData.slice(0, 12).map((player) => (
              <div key={player.displayName + player.team} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{titleCase(player.displayName)}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Badge variant="outline">{player.team}</Badge>
                      {player.fpg && <span>{player.fpg.toFixed(1)} FPG</span>}
                      {player.adjusted_rating && <span>Rating: {player.adjusted_rating}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Volume/Talent (N)</span>
                      <span className="font-medium">{player.compass.north.toFixed(1)}</span>
                    </div>
                    <Progress 
                      value={player.compass.north} 
                      className="h-2"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Scheme/Environment (E)</span>
                      <span className="font-medium">{player.compass.east.toFixed(1)}</span>
                    </div>
                    <Progress 
                      value={player.compass.east} 
                      className="h-2"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Age/Risk (S)</span>
                      <span className="font-medium">{player.compass.south.toFixed(1)}</span>
                    </div>
                    <Progress 
                      value={player.compass.south} 
                      className="h-2"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Market Value (W)</span>
                      <span className="font-medium">{player.compass.west.toFixed(1)}</span>
                    </div>
                    <Progress 
                      value={player.compass.west} 
                      className="h-2"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      
      {/* Dev Footer */}
      {process.env.NODE_ENV === 'development' && (
        <pre style={{fontSize:12,opacity:.7,whiteSpace:'pre-wrap'}} className="px-6 py-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400 border-t">
          {`GET /api/compass/WR?search=${encodeURIComponent(debouncedSearch)}&limit=50
rows: ${filteredData?.length ?? 0}
first: ${filteredData?.[0]?.displayName ?? '—'}
data length: ${wrData?.length ?? 0}
mapped length: ${mappedData?.length ?? 0}`}
        </pre>
      )}
    </Card>
  );
}