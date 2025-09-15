import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Star, Calendar } from "lucide-react";
import { resolvePlayer } from '../lib/nameResolver';

interface RookieClass2025Props {
  season: number;
  week: number;
  limit?: number;
}

type Rookie = {
  full?: string; first?: string; last?: string; team?: string;
  ppr?: number; targets?: number; rec?: number; college?: string; depth_chart?: string;
  player_id?: string; position?: string;
};

export default function RookieClass2025({ season, week, limit = 8 }: RookieClass2025Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rookies, setRookies] = useState<Rookie[]>([]);
  const [pool, setPool] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [r1, r2] = await Promise.allSettled([
          fetch('/api/rookies').then(r => r.ok ? r.json() : []),
          fetch('/api/player-pool').then(r => r.ok ? r.json() : []),
        ]);
        const ok1 = r1.status === 'fulfilled' ? (r1.value ?? []) : [];
        const ok2 = r2.status === 'fulfilled' ? (r2.value ?? []) : [];
        setRookies(Array.isArray(ok1) ? ok1.slice(0, limit) : []);
        setPool(Array.isArray(ok2) ? ok2 : []);
        setLoading(false);
      } catch (e:any) {
        setErr(e?.message ?? 'Unknown error');
        setLoading(false);
      }
    })();
  }, [limit]);

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'RB': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'WR': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'TE': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    if (index === 1) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    if (index === 2) return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200';
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Rookie Class 2025
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (err) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Rookie Class 2025
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-red-600">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Rookie load error: {err}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          Rookie Class 2025
          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ml-2">
            <Calendar className="h-3 w-3 mr-1" />
            Week {week}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rookies.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No rookie performance data found for Week {week}</p>
            <p className="text-xs mt-1">Check back during the 2025 season</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rookies.map((rk: Rookie, idx: number) => {
              const resolved = resolvePlayer(
                { full: rk.full, first: rk.first, last: rk.last, team: rk.team },
                pool
              );

              const displayName = resolved?.full_name ?? rk.full ?? `${rk.first ?? ''} ${rk.last ?? ''}`.trim();
              const displayTeam = resolved?.team ?? rk.team ?? '–';

              return (
                <div
                  key={resolved?.player_id ?? idx}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${getRankBadge(idx)}`}>
                      {idx + 1}
                    </div>
                    
                    <div>
                      <div className="font-semibold text-sm">
                        {displayName}
                        {!resolved && <span className="text-xs text-orange-600 ml-1">(unresolved)</span>}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs">
                        {rk.position && (
                          <Badge className={getPositionColor(rk.position)}>
                            {rk.position}
                          </Badge>
                        )}
                        <span>•</span>
                        <span>{displayTeam}</span>
                        {rk.college && (
                          <>
                            <span>•</span>
                            <span>{rk.college}</span>
                          </>
                        )}
                        {rk.depth_chart && (
                          <>
                            <span>•</span>
                            <span>{rk.depth_chart}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-lg">
                      {rk.ppr?.toFixed(1) ?? "0.0"}
                    </div>
                    <div className="text-xs text-muted-foreground">PPR pts</div>
                    
                    {(rk.position === 'WR' || rk.position === 'TE') && rk.targets && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {rk.targets} tgt • {rk.rec || 0} rec
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 pt-3 border-t text-center">
          <p className="text-xs text-muted-foreground">
            Showing top {Math.min(limit, rookies.length)} performers • {season} Season Week {week}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Data from OTC Weekly Pipeline
          </p>
        </div>
      </CardContent>
    </Card>
  );
}