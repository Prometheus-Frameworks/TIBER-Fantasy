import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Shield } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface DefenseData {
  team: string;
  rb?: number;
  wr?: number;
  te?: number;
}

interface DefenseRankingsResponse {
  week: number;
  season: number;
  data: DefenseData[];
}

type SortConfig = {
  key: 'team' | 'rb' | 'wr' | 'te';
  direction: 'asc' | 'desc';
} | null;

export default function DefenseRankings() {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'team', direction: 'asc' });
  const [positionFilter, setPositionFilter] = useState<'all' | 'rb' | 'wr' | 'te'>('all');

  const { data, isLoading } = useQuery<DefenseRankingsResponse>({
    queryKey: ['/api/defense-rankings'],
    staleTime: 5 * 60 * 1000,
  });

  // Sort and rank data
  const sortedData = useMemo(() => {
    if (!data?.data) return [];
    
    let sorted = [...data.data];
    
    if (sortConfig) {
      sorted.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? Infinity;
        const bVal = b[sortConfig.key] ?? Infinity;
        
        if (aVal === Infinity && bVal === Infinity) return 0;
        if (aVal === Infinity) return 1;
        if (bVal === Infinity) return -1;
        
        return sortConfig.direction === 'asc' 
          ? aVal < bVal ? -1 : 1
          : aVal > bVal ? -1 : 1;
      });
    }
    
    return sorted;
  }, [data, sortConfig]);

  // Get ranking for color coding (per position)
  const getRankForPosition = (team: string, position: 'rb' | 'wr' | 'te') => {
    if (!data?.data) return null;
    
    const posData = data.data
      .filter(d => d[position] !== undefined)
      .map(d => ({ team: d.team, value: d[position]! }))
      .sort((a, b) => a.value - b.value);
    
    const rank = posData.findIndex(d => d.team === team) + 1;
    return rank;
  };

  const getCellColor = (team: string, position: 'rb' | 'wr' | 'te') => {
    const rank = getRankForPosition(team, position);
    if (!rank) return '';
    
    // Top 5 worst defenses (allow most points) = green (good for offense)
    if (rank >= data!.data.filter(d => d[position] !== undefined).length - 4) {
      return 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100';
    }
    // Top 5 best defenses (allow least points) = red (bad for offense)
    if (rank <= 5) {
      return 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100';
    }
    return '';
  };

  const handleSort = (key: 'team' | 'rb' | 'wr' | 'te') => {
    setSortConfig(current => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const positions = [
    { key: 'all' as const, label: 'All Positions' },
    { key: 'rb' as const, label: 'RB' },
    { key: 'wr' as const, label: 'WR' },
    { key: 'te' as const, label: 'TE' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Defense Rankings</h1>
        </div>
        <p className="text-muted-foreground mb-4">
          Fantasy points allowed by defenses - Week {data?.week || 5}, {data?.season || 2024}
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100 rounded mr-2">
            Green
          </span>
          = Top 5 worst defenses (allow most points)
          <span className="inline-block px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100 rounded ml-4 mr-2">
            Red
          </span>
          = Top 5 best defenses (allow fewest points)
        </p>
      </div>

      {/* Position Filter */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filter by Position</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {positions.map(pos => (
              <Button
                key={pos.key}
                variant={positionFilter === pos.key ? "default" : "outline"}
                size="sm"
                onClick={() => setPositionFilter(pos.key)}
                data-testid={`filter-${pos.key}`}
              >
                {pos.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Defense Rankings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fantasy Points Allowed by Position</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">
                      <button
                        onClick={() => handleSort('team')}
                        className="flex items-center gap-1 hover:text-primary"
                        data-testid="sort-team"
                      >
                        Team
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                    </th>
                    {(positionFilter === 'all' || positionFilter === 'rb') && (
                      <th className="text-left p-3">
                        <button
                          onClick={() => handleSort('rb')}
                          className="flex items-center gap-1 hover:text-primary"
                          data-testid="sort-rb"
                        >
                          FP to RBs
                          <ArrowUpDown className="w-4 h-4" />
                        </button>
                      </th>
                    )}
                    {(positionFilter === 'all' || positionFilter === 'wr') && (
                      <th className="text-left p-3">
                        <button
                          onClick={() => handleSort('wr')}
                          className="flex items-center gap-1 hover:text-primary"
                          data-testid="sort-wr"
                        >
                          FP to WRs
                          <ArrowUpDown className="w-4 h-4" />
                        </button>
                      </th>
                    )}
                    {(positionFilter === 'all' || positionFilter === 'te') && (
                      <th className="text-left p-3">
                        <button
                          onClick={() => handleSort('te')}
                          className="flex items-center gap-1 hover:text-primary"
                          data-testid="sort-te"
                        >
                          FP to TEs
                          <ArrowUpDown className="w-4 h-4" />
                        </button>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((team) => (
                    <tr key={team.team} className="border-b hover:bg-muted/50" data-testid={`row-${team.team}`}>
                      <td className="p-3 font-medium" data-testid={`team-${team.team}`}>{team.team}</td>
                      {(positionFilter === 'all' || positionFilter === 'rb') && (
                        <td className={`p-3 ${getCellColor(team.team, 'rb')}`} data-testid={`rb-${team.team}`}>
                          {team.rb?.toFixed(1) || '-'}
                        </td>
                      )}
                      {(positionFilter === 'all' || positionFilter === 'wr') && (
                        <td className={`p-3 ${getCellColor(team.team, 'wr')}`} data-testid={`wr-${team.team}`}>
                          {team.wr?.toFixed(1) || '-'}
                        </td>
                      )}
                      {(positionFilter === 'all' || positionFilter === 'te') && (
                        <td className={`p-3 ${getCellColor(team.team, 'te')}`} data-testid={`te-${team.team}`}>
                          {team.te?.toFixed(1) || '-'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
