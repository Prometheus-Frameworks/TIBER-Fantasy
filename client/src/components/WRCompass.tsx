import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Search, Navigation } from 'lucide-react';

interface WRPlayer {
  id: string;
  name: string;
  team: string;
  pos: string;
  compass: {
    north: number;
    east: number;
    south: number;
    west: number;
  };
  alias: string;
  age: number;
  adp: number;
}

interface WRSearchResponse {
  ok?: boolean;
  data?: WRPlayer[];
  length?: number;
}

export default function WRCompass() {
  const [search, setSearch] = useState('');
  
  const { data: wrResponse, isLoading } = useQuery<WRPlayer[] | WRSearchResponse>({
    queryKey: ['/api/wr', search],
    queryFn: () => fetch(`/api/wr?search=${encodeURIComponent(search)}&limit=20`).then(r => r.json()),
  });

  // Handle different response formats
  const wrData = Array.isArray(wrResponse) 
    ? wrResponse 
    : (wrResponse as WRSearchResponse)?.data || [];

  const filteredData = wrData.filter((player) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      player.name?.toLowerCase().includes(searchLower) ||
      player.team?.toLowerCase().includes(searchLower) ||
      player.alias?.toLowerCase().includes(searchLower)
    );
  });

  const getCompassColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500'; 
    if (score >= 40) return 'bg-yellow-500';
    if (score >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const titleCase = (str: string) => {
    return str?.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ') || '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          WR Player Compass
        </CardTitle>
        <CardDescription>
          4-directional player evaluation: Volume/Talent (N), Scheme/Environment (E), Age/Risk (S), Market Value (W)
        </CardDescription>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, team, or alias..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
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
        ) : filteredData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {search ? (
              <>No WRs match '{search}'. Try team: 'CIN' or name: 'Chase'.</>
            ) : (
              <>No WR data available.</>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredData.slice(0, 12).map((player) => (
              <div key={player.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{titleCase(player.name)}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Badge variant="outline">{player.team}</Badge>
                      <span>Age {player.age}</span>
                      <span>ADP {player.adp}</span>
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
    </Card>
  );
}