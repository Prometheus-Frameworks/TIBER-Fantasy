import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Shield, TrendingDown, Activity, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface DvPStat {
  defenseTeam: string;
  position: string;
  season: number;
  week: number | null;
  rankVsPosition: number;
  avgPtsPerGamePpr: number;
  avgPtsPerGameHalfPpr: number;
  avgPtsPerGameStandard: number;
  playsAgainst: number;
  uniquePlayers: number;
  avgEpaAllowed: number;
  dvpRating: string;
}

function getRatingColor(rating: string) {
  if (rating === 'elite-matchup') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (rating === 'good') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  if (rating === 'neutral') return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
  if (rating === 'tough') return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
}

function getRatingLabel(rating: string) {
  if (rating === 'elite-matchup') return '🎯 Elite Matchup';
  if (rating === 'good') return '✓ Good';
  if (rating === 'neutral') return '— Neutral';
  if (rating === 'tough') return '⚠ Tough';
  return '🚫 Avoid';
}

function DefenseCard({ stat, scoringFormat }: { stat: DvPStat; scoringFormat: string }) {
  const points = scoringFormat === 'ppr' 
    ? stat.avgPtsPerGamePpr 
    : scoringFormat === 'half-ppr' 
    ? stat.avgPtsPerGameHalfPpr 
    : stat.avgPtsPerGameStandard;

  return (
    <Card className="hover:shadow-lg transition-shadow" data-testid={`card-defense-${stat.defenseTeam}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full">
              <span className="text-xl font-bold text-slate-700 dark:text-slate-300">#{stat.rankVsPosition}</span>
            </div>
            <div>
              <CardTitle className="text-xl font-bold" data-testid={`text-team-${stat.defenseTeam}`}>{stat.defenseTeam}</CardTitle>
              <p className="text-sm text-slate-500">vs {stat.position}</p>
            </div>
          </div>
          <Badge className={getRatingColor(stat.dvpRating)} data-testid={`badge-rating-${stat.defenseTeam}`}>
            {getRatingLabel(stat.dvpRating)}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <TrendingDown className="w-4 h-4" />
              Fantasy Points Allowed
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid={`text-points-${stat.defenseTeam}`}>
              {points.toFixed(1)} pts
            </div>
            <div className="text-xs text-slate-500">per game ({scoringFormat.toUpperCase()})</div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Activity className="w-4 h-4" />
              EPA Allowed
            </div>
            <div className={`text-2xl font-bold ${stat.avgEpaAllowed >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {stat.avgEpaAllowed >= 0 ? '+' : ''}{(stat.avgEpaAllowed || 0).toFixed(2)}
            </div>
            <div className="text-xs text-slate-500">per play</div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4 text-slate-500" />
            <span className="text-slate-600 dark:text-slate-400">{stat.playsAgainst} plays</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-slate-500" />
            <span className="text-slate-600 dark:text-slate-400">{stat.uniquePlayers} {stat.position}s faced</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DvPMatchups() {
  const [position, setPosition] = useState<string>('QB');
  const [week, setWeek] = useState<string>('1');
  const [scoringFormat, setScoringFormat] = useState<string>('ppr');

  const { data, isLoading, error } = useQuery<{ success: boolean; data: DvPStat[] }>({
    queryKey: ['/api/dvp', { position, season: 2025, week }],
  });

  const stats = data?.data || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2" data-testid="text-page-title">
            Defense vs Position Matchups
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Analyze how defenses perform against specific positions based on real NFLfastR play-by-play data
          </p>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Position
            </label>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger data-testid="select-position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="QB">Quarterback (QB)</SelectItem>
                <SelectItem value="RB">Running Back (RB)</SelectItem>
                <SelectItem value="WR">Wide Receiver (WR)</SelectItem>
                <SelectItem value="TE">Tight End (TE)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Week
            </label>
            <Select value={week} onValueChange={setWeek}>
              <SelectTrigger data-testid="select-week">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Week 1</SelectItem>
                <SelectItem value="2">Week 2</SelectItem>
                <SelectItem value="3">Week 3</SelectItem>
                <SelectItem value="4">Week 4</SelectItem>
                <SelectItem value="5">Week 5</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Scoring Format
            </label>
            <Select value={scoringFormat} onValueChange={setScoringFormat}>
              <SelectTrigger data-testid="select-scoring">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ppr">PPR</SelectItem>
                <SelectItem value="half-ppr">Half-PPR</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">Failed to load matchup data</p>
          </div>
        )}

        {!isLoading && !error && stats.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">No matchup data available for this selection</p>
          </div>
        )}

        {!isLoading && !error && stats.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.map((stat) => (
              <DefenseCard key={`${stat.defenseTeam}-${stat.position}`} stat={stat} scoringFormat={scoringFormat} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
