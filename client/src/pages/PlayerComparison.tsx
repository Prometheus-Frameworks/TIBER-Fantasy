import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PlayerStats {
  player_name: string;
  position: string;
  team: string;
  games: number;
  targets: number;
  receptions: number;
  rec_yards: number;
  rec_tds: number;
  fpts_ppr: number;
  targets_per_game: number;
  yards_per_game: number;
  ppg_half_ppr: number;
}

export default function PlayerComparison() {
  const { data: comparisonData, isLoading } = useQuery<{ players: PlayerStats[] }>({
    queryKey: ["/api/stats/2024/comparison"],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  const worthy = comparisonData?.players.find(p => p.player_name === "Xavier Worthy");
  const allen = comparisonData?.players.find(p => p.player_name === "Keenan Allen");

  const compareMetric = (worthyVal: number, allenVal: number, higherIsBetter = true) => {
    if (!worthyVal || !allenVal) return null;
    const diff = worthyVal - allenVal;
    const pctDiff = ((diff / allenVal) * 100).toFixed(1);
    
    if (Math.abs(diff) < 0.1) {
      return <span className="flex items-center gap-1 text-gray-500"><Minus className="h-4 w-4" /> Even</span>;
    }
    
    const isWorthyBetter = higherIsBetter ? diff > 0 : diff < 0;
    
    return (
      <span className={`flex items-center gap-1 ${isWorthyBetter ? 'text-green-600' : 'text-red-600'}`}>
        {isWorthyBetter ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        {isWorthyBetter ? '+' : ''}{pctDiff}%
      </span>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Xavier Worthy vs Keenan Allen</h1>
        <p className="text-muted-foreground">Rest of Season Outlook (0.5 PPR Redraft, 12-Team)</p>
      </div>

      <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-amber-900 dark:text-amber-100">
          <strong>Data Availability Note:</strong> Advanced metrics (route participation %, slot/perimeter usage, detailed red zone targets by zone, team PROE, Vegas implied points, and playoff SOS) are currently being integrated. Analysis below uses available season stats through Week 17 of the 2024 season.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Xavier Worthy Card */}
        <Card data-testid="card-worthy">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Xavier Worthy</span>
              <Badge variant="outline">KC</Badge>
            </CardTitle>
            <CardDescription>WR • Kansas City Chiefs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Games</p>
                <p className="text-2xl font-bold">{worthy?.games || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">0.5 PPR PPG</p>
                <p className="text-2xl font-bold">{worthy?.ppg_half_ppr ? Number(worthy.ppg_half_ppr).toFixed(1) : '0.0'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Targets/Game</p>
                <p className="text-xl font-semibold">{worthy?.targets_per_game ? Number(worthy.targets_per_game).toFixed(1) : '0.0'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Yards/Game</p>
                <p className="text-xl font-semibold">{worthy?.yards_per_game ? Number(worthy.yards_per_game).toFixed(1) : '0.0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Keenan Allen Card */}
        <Card data-testid="card-allen">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Keenan Allen</span>
              <Badge variant="outline">CHI</Badge>
            </CardTitle>
            <CardDescription>WR • Chicago Bears</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Games</p>
                <p className="text-2xl font-bold">{allen?.games || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">0.5 PPR PPG</p>
                <p className="text-2xl font-bold">{allen?.ppg_half_ppr ? Number(allen.ppg_half_ppr).toFixed(1) : '0.0'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Targets/Game</p>
                <p className="text-xl font-semibold">{allen?.targets_per_game ? Number(allen.targets_per_game).toFixed(1) : '0.0'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Yards/Game</p>
                <p className="text-xl font-semibold">{allen?.yards_per_game ? Number(allen.yards_per_game).toFixed(1) : '0.0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Table */}
      <Card data-testid="table-comparison">
        <CardHeader>
          <CardTitle>Head-to-Head Stats Comparison</CardTitle>
          <CardDescription>Season totals and per-game averages</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">Xavier Worthy</TableHead>
                <TableHead className="text-right">Keenan Allen</TableHead>
                <TableHead className="text-right">Advantage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Targets (Total)</TableCell>
                <TableCell className="text-right">{worthy?.targets || 0}</TableCell>
                <TableCell className="text-right">{allen?.targets || 0}</TableCell>
                <TableCell className="text-right">{compareMetric(worthy?.targets || 0, allen?.targets || 0)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Receptions</TableCell>
                <TableCell className="text-right">{worthy?.receptions || 0}</TableCell>
                <TableCell className="text-right">{allen?.receptions || 0}</TableCell>
                <TableCell className="text-right">{compareMetric(worthy?.receptions || 0, allen?.receptions || 0)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Receiving Yards</TableCell>
                <TableCell className="text-right">{worthy?.rec_yards || 0}</TableCell>
                <TableCell className="text-right">{allen?.rec_yards || 0}</TableCell>
                <TableCell className="text-right">{compareMetric(worthy?.rec_yards || 0, allen?.rec_yards || 0)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Receiving TDs</TableCell>
                <TableCell className="text-right">{worthy?.rec_tds || 0}</TableCell>
                <TableCell className="text-right">{allen?.rec_tds || 0}</TableCell>
                <TableCell className="text-right">{compareMetric(worthy?.rec_tds || 0, allen?.rec_tds || 0)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">0.5 PPR Total</TableCell>
                <TableCell className="text-right">{worthy?.fpts_ppr ? Number(worthy.fpts_ppr).toFixed(1) : '0.0'}</TableCell>
                <TableCell className="text-right">{allen?.fpts_ppr ? Number(allen.fpts_ppr).toFixed(1) : '0.0'}</TableCell>
                <TableCell className="text-right">{compareMetric(Number(worthy?.fpts_ppr || 0), Number(allen?.fpts_ppr || 0))}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell className="font-medium">Targets/Game</TableCell>
                <TableCell className="text-right">{worthy?.targets_per_game ? Number(worthy.targets_per_game).toFixed(1) : '0.0'}</TableCell>
                <TableCell className="text-right">{allen?.targets_per_game ? Number(allen.targets_per_game).toFixed(1) : '0.0'}</TableCell>
                <TableCell className="text-right">{compareMetric(Number(worthy?.targets_per_game || 0), Number(allen?.targets_per_game || 0))}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell className="font-medium">Yards/Game</TableCell>
                <TableCell className="text-right">{worthy?.yards_per_game ? Number(worthy.yards_per_game).toFixed(1) : '0.0'}</TableCell>
                <TableCell className="text-right">{allen?.yards_per_game ? Number(allen.yards_per_game).toFixed(1) : '0.0'}</TableCell>
                <TableCell className="text-right">{compareMetric(Number(worthy?.yards_per_game || 0), Number(allen?.yards_per_game || 0))}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell className="font-medium">0.5 PPR PPG</TableCell>
                <TableCell className="text-right font-bold">{worthy?.ppg_half_ppr ? Number(worthy.ppg_half_ppr).toFixed(1) : '0.0'}</TableCell>
                <TableCell className="text-right font-bold">{allen?.ppg_half_ppr ? Number(allen.ppg_half_ppr).toFixed(1) : '0.0'}</TableCell>
                <TableCell className="text-right">{compareMetric(Number(worthy?.ppg_half_ppr || 0), Number(allen?.ppg_half_ppr || 0))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Analysis Summary */}
      <Card data-testid="card-analysis">
        <CardHeader>
          <CardTitle>ROS Analysis: Ceiling vs Floor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Higher Ceiling: Xavier Worthy
              </h3>
              <ul className="space-y-1 text-sm text-muted-foreground ml-6 list-disc">
                <li>Patrick Mahomes offense with elite TD upside</li>
                <li>Explosive play ability and deep threat role</li>
                <li>Strong playoff schedule potential</li>
                <li>TD-dependent but high spike weeks possible</li>
                <li>Similar PPG to Allen despite fewer targets</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Minus className="h-5 w-5 text-blue-600" />
                Higher Floor: Keenan Allen
              </h3>
              <ul className="space-y-1 text-sm text-muted-foreground ml-6 list-disc">
                <li>33% more targets than Worthy (8.1 vs 6.1/game)</li>
                <li>More consistent target share and usage</li>
                <li>Better yards per game (49.6 vs 39.9)</li>
                <li>Proven veteran with route-running excellence</li>
                <li>Lower variance in weekly outcomes</li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <h3 className="text-lg font-semibold">Recommendation for ROS (Weeks 5-17)</h3>
            <div className="text-muted-foreground space-y-2">
              <p className="text-sm">
                <strong>For Championship Upside:</strong> Xavier Worthy offers more ceiling with KC's explosive offense and Mahomes at QB. His speed creates home-run potential every week.
              </p>
              <p className="text-sm">
                <strong>For Consistency:</strong> Keenan Allen provides a higher floor with more targets and safer volume. Better for teams that need reliable weekly production.
              </p>
              <p className="text-sm">
                <strong>Context Matters:</strong> Worthy is the play if you need ceiling games to make playoffs. Allen is safer if you're already in good playoff position and need steady points.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coming Soon Section */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Advanced Metrics Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <h4 className="font-semibold mb-2">Usage & Routes</h4>
              <ul className="space-y-1 ml-4 list-disc">
                <li>Route participation %</li>
                <li>Slot vs perimeter usage</li>
                <li>Average depth of target (aDOT)</li>
                <li>Air yards share</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Red Zone & Efficiency</h4>
              <ul className="space-y-1 ml-4 list-disc">
                <li>RZ targets (inside 20, 10, 5)</li>
                <li>Team PROE</li>
                <li>Weekly consistency (CoV, boom/bust %)</li>
                <li>Playoff schedule SOS (Weeks 14-17)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
