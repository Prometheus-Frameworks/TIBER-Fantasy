import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Lightbulb, TrendingUp } from 'lucide-react';

interface WeeklyTake {
  player: string;
  insight: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
}

interface WeeklyTakesData {
  week: number;
  season: number;
  takes: {
    qb: WeeklyTake[];
    rb: WeeklyTake[];
    wr: WeeklyTake[];
    te: WeeklyTake[];
  };
  generatedAt: string;
}

function TakesList({ takes, position }: { takes: WeeklyTake[]; position: string }) {
  if (takes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No takes available for {position}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {takes.map((take, idx) => (
        <li key={idx} className="flex items-start gap-2" data-testid={`take-${position.toLowerCase()}-${idx}`}>
          <span className="text-primary mt-0.5">•</span>
          <div className="flex-1">
            <span className="font-medium text-foreground">{take.player}</span>
            <span className="text-gray-300"> - {take.insight}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function WeeklyTakesTab() {
  const { data, isLoading } = useQuery<{ success: boolean; data: WeeklyTakesData }>({
    queryKey: ['/api/weekly-takes'],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const takesData = data?.data;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Lightbulb className="h-8 w-8 text-yellow-500" />
          <h1 className="text-3xl font-bold text-foreground" data-testid="header-title">
            Weekly Takes
          </h1>
        </div>
        <p className="text-muted-foreground">
          Quick matchup insights and performance angles for Week {takesData?.week || 7}
        </p>
        {takesData && (
          <div className="flex gap-3 pt-2">
            <Badge variant="outline" className="bg-background/50">
              Week {takesData.week}
            </Badge>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              {takesData.season} Season
            </Badge>
          </div>
        )}
      </div>

      {/* Takes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* QB Takes */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <span className="text-blue-500">QB</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TakesList takes={takesData?.takes.qb || []} position="QB" />
          </CardContent>
        </Card>

        {/* RB Takes */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-green-500">RB</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TakesList takes={takesData?.takes.rb || []} position="RB" />
          </CardContent>
        </Card>

        {/* WR Takes */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              <span className="text-purple-500">WR</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TakesList takes={takesData?.takes.wr || []} position="WR" />
          </CardContent>
        </Card>

        {/* TE Takes */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <span className="text-orange-500">TE</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TakesList takes={takesData?.takes.te || []} position="TE" />
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {takesData && Object.values(takesData.takes).every(arr => arr.length === 0) && (
        <div className="text-center py-12">
          <Lightbulb className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-lg text-muted-foreground">No takes available</p>
          <p className="text-sm text-muted-foreground mt-2">
            Check back later for weekly insights
          </p>
        </div>
      )}
    </div>
  );
}
