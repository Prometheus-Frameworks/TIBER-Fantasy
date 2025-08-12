import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, TrendingUp, TrendingDown, Target, Users, RefreshCw } from 'lucide-react';
import { SkeletonCard } from "@/components/Skeleton";
import Button from "@/components/Button";

interface WRCompassData {
  name: string;
  team: string;
  position: string;
  age: number;
  compass: {
    north: number;
    east: number;
    south: number;
    west: number;
    score: number;
    tier: string;
  };
  targets: number;
  receptions: number;
  receiving_yards: number;
  receiving_touchdowns: number;
  adp?: number;
}

interface WRCompassResponse {
  position: string;
  algorithm: string;
  source: string;
  rankings: WRCompassData[];
}

const getTierColor = (tier: string) => {
  switch (tier) {
    case 'Elite': return 'bg-purple-500';
    case 'High-End': return 'bg-blue-500';
    case 'Solid': return 'bg-green-500';
    case 'Upside': return 'bg-yellow-500';
    case 'Deep': return 'bg-gray-500';
    default: return 'bg-gray-500';
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

export default function WRCompass() {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: wrData, isLoading, refetch, isFetching, error } = useQuery<WRCompassResponse>({
    queryKey: ["compass", "wr"],
    queryFn: async () => {
      const response = await fetch("/api/compass/wr");
      if (!response.ok) throw new Error('Failed to fetch WR compass data');
      return response.json();
    }
  });

  const filteredWRs = (wrData?.rankings && Array.isArray(wrData.rankings)) 
    ? wrData.rankings.filter(wr => {
        if (!wr?.name || !wr?.team) return false;
        return wr.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               wr.team.toLowerCase().includes(searchTerm.toLowerCase());
      })
    : [];

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-red-600">Error: {error.message}</div>
            <Button onClick={() => refetch()} className="mt-4" loading={isFetching}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ink mb-2">WR Player Compass</h1>
          <p className="text-body">Context-aware wide receiver evaluation and guidance</p>
        </div>
        <Button onClick={() => refetch()} loading={isFetching} variant="ghost">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-body w-4 h-4" />
          <Input
            type="text"
            placeholder="Search by player name or team..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <section aria-busy className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({length: 9}).map((_, i) => <SkeletonCard key={i} />)}
        </section>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredWRs.map((wr, index) => (
            <Card key={`${wr.name}-${index}`} className="group hover:shadow-lg transition-all duration-200 active:translate-y-[1px]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-ink">
                      {wr.name}
                    </CardTitle>
                    <CardDescription className="text-sm text-body">
                      {wr.team} • Age {wr.age}
                    </CardDescription>
                  </div>
                  <Badge 
                    className={`${getTierColor(wr.compass?.tier || 'Deep')} text-white`}
                  >
                    {wr.compass?.tier || 'N/A'}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-body">Compass Score</span>
                    <span className={`text-lg font-bold ${getScoreColor(wr.compass?.score || 0)}`}>
                      {wr.compass?.score?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {wr.compass && Object.entries({
                      north: wr.compass.north,
                      east: wr.compass.east,
                      south: wr.compass.south,
                      west: wr.compass.west
                    }).map(([direction, value]) => (
                      <div key={direction} className="flex items-center gap-2">
                        {getCompassIcon(direction)}
                        <span className="text-sm font-medium text-body capitalize">
                          {direction}
                        </span>
                        <span className="text-sm font-semibold text-ink ml-auto">
                          {value?.toFixed(1) || 'N/A'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-line">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="text-body">Targets</div>
                        <div className="font-semibold text-ink">{wr.targets || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-body">Rec Yards</div>
                        <div className="font-semibold text-ink">{wr.receiving_yards || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && filteredWRs.length === 0 && (
        <div className="text-center py-12">
          <div className="text-body">No wide receivers found matching your search.</div>
        </div>
      )}
    </div>
  );
}