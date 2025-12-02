import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Search, 
  Database, 
  RefreshCw, 
  ChevronRight,
  Target,
  Zap,
  BarChart3,
  Activity,
  X,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

interface SnapshotMeta {
  snapshotId: number;
  season: number;
  week: number;
  snapshotAt: string;
  dataVersion: string;
  rowCount: number;
  teamCount: number;
  validationPassed: boolean;
}

interface PlayerWeekData {
  id: number;
  snapshotId: number;
  season: number;
  week: number;
  playerId: string;
  playerName: string;
  teamId: string | null;
  position: string | null;
  snaps: number | null;
  snapShare: number | null;
  routes: number | null;
  routeRate: number | null;
  targets: number | null;
  targetShare: number | null;
  receptions: number | null;
  recYards: number | null;
  recTds: number | null;
  aDot: number | null;
  airYards: number | null;
  yac: number | null;
  tprr: number | null;
  yprr: number | null;
  epaPerPlay: number | null;
  epaPerTarget: number | null;
  successRate: number | null;
  rushAttempts: number | null;
  rushYards: number | null;
  rushTds: number | null;
  yardsPerCarry: number | null;
  rushEpaPerPlay: number | null;
  fptsStd: number | null;
  fptsHalf: number | null;
  fptsPpr: number | null;
}

interface SearchResponse {
  snapshotId: number;
  season: number;
  week: number;
  total: number;
  limit: number;
  offset: number;
  data: PlayerWeekData[];
}

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE'];

function formatStat(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined) return '-';
  return value.toFixed(decimals);
}

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return `${(value * 100).toFixed(1)}%`;
}

function StatCard({ label, value, format = 'number' }: { label: string; value: any; format?: 'number' | 'pct' | 'decimal' }) {
  let displayValue = '-';
  if (value != null) {
    if (format === 'pct') {
      displayValue = `${(Number(value) * 100).toFixed(1)}%`;
    } else if (format === 'decimal') {
      displayValue = Number(value).toFixed(2);
    } else {
      displayValue = String(value);
    }
  }

  return (
    <div className="bg-[#1a1f2e] p-3 rounded-lg text-center" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="text-gray-500 text-xs uppercase tracking-wide">{label}</div>
      <div className="font-mono text-white text-lg mt-1">{displayValue}</div>
    </div>
  );
}

function PositionBadge({ position }: { position: string | null }) {
  if (!position) return null;
  
  const colors: Record<string, string> = {
    QB: 'bg-purple-600',
    RB: 'bg-green-600',
    WR: 'bg-blue-600',
    TE: 'bg-orange-600',
  };

  return (
    <Badge className={`${colors[position] || 'bg-gray-600'} text-white`} data-testid="position-badge">
      {position}
    </Badge>
  );
}

function PlayerDrawer({ 
  player, 
  open, 
  onClose 
}: { 
  player: PlayerWeekData | null; 
  open: boolean; 
  onClose: () => void;
}) {
  if (!player) return null;

  const handleAskTiber = () => {
    console.log('[DataLab] Ask Tiber to explain profile:', {
      playerId: player.playerId,
      playerName: player.playerName,
      position: player.position,
      metrics: {
        routes: player.routes,
        targets: player.targets,
        tprr: player.tprr,
        yprr: player.yprr,
        epaPerPlay: player.epaPerPlay,
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px] bg-[#0a0e1a] border-gray-700 overflow-y-auto" data-testid="player-drawer">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <PositionBadge position={player.position} />
            <SheetTitle className="text-white text-xl" data-testid="drawer-player-name">{player.playerName}</SheetTitle>
          </div>
          <SheetDescription className="text-gray-400">
            {player.teamId || 'N/A'} • Week {player.week} • {player.season}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-gray-400 uppercase tracking-wide">Usage</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatCard label="Snaps" value={player.snaps} />
              <StatCard label="Snap %" value={player.snapShare} format="pct" />
              <StatCard label="Routes" value={player.routes} />
              <StatCard label="Route %" value={player.routeRate} format="pct" />
            </div>
          </div>

          <Separator className="bg-gray-700" />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-gray-400 uppercase tracking-wide">Receiving</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatCard label="Targets" value={player.targets} />
              <StatCard label="Rec" value={player.receptions} />
              <StatCard label="Yards" value={player.recYards} />
              <StatCard label="TDs" value={player.recTds} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <StatCard label="aDOT" value={player.aDot} format="decimal" />
              <StatCard label="Air Yds" value={player.airYards} />
              <StatCard label="YAC" value={player.yac} />
            </div>
          </div>

          <Separator className="bg-gray-700" />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-gray-400 uppercase tracking-wide">Efficiency</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatCard label="TPRR" value={player.tprr} format="decimal" />
              <StatCard label="YPRR" value={player.yprr} format="decimal" />
              <StatCard label="EPA/Play" value={player.epaPerPlay} format="decimal" />
              <StatCard label="Success %" value={player.successRate} format="pct" />
            </div>
          </div>

          {(player.rushAttempts || 0) > 0 && (
            <>
              <Separator className="bg-gray-700" />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-gray-400 uppercase tracking-wide">Rushing</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <StatCard label="Carries" value={player.rushAttempts} />
                  <StatCard label="Yards" value={player.rushYards} />
                  <StatCard label="TDs" value={player.rushTds} />
                  <StatCard label="YPC" value={player.yardsPerCarry} format="decimal" />
                </div>
              </div>
            </>
          )}

          <Separator className="bg-gray-700" />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              <span className="text-sm text-gray-400 uppercase tracking-wide">Fantasy Points</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="PPR" value={player.fptsPpr} format="decimal" />
              <StatCard label="Half" value={player.fptsHalf} format="decimal" />
              <StatCard label="Standard" value={player.fptsStd} format="decimal" />
            </div>
          </div>

          <div className="pt-4">
            <Button 
              variant="outline" 
              className="w-full border-blue-600 text-blue-400 hover:bg-blue-600/20"
              onClick={handleAskTiber}
              data-testid="button-ask-tiber"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Ask Tiber to explain this profile
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function TiberDataLab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [position, setPosition] = useState('ALL');
  const [season, setSeason] = useState<number>(2024);
  const [week, setWeek] = useState<number>(1);
  const [minRoutes, setMinRoutes] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWeekData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: metaData, isLoading: metaLoading } = useQuery<SnapshotMeta>({
    queryKey: ['/api/data-lab/meta/current'],
  });

  useEffect(() => {
    if (metaData) {
      setSeason(metaData.season);
      setWeek(metaData.week);
    }
  }, [metaData]);

  const searchParams = new URLSearchParams({
    season: String(season),
    week: String(week),
    ...(searchQuery && { q: searchQuery }),
    ...(position !== 'ALL' && { position }),
    ...(minRoutes && { min_routes: minRoutes }),
    limit: '50',
  });

  const { 
    data: searchData, 
    isLoading: searchLoading, 
    refetch: refetchSearch 
  } = useQuery<SearchResponse>({
    queryKey: ['/api/data-lab/search', season, week, searchQuery, position, minRoutes],
    queryFn: async () => {
      const res = await fetch(`/api/data-lab/search?${searchParams.toString()}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Search failed');
      }
      return res.json();
    },
    enabled: season > 0 && week > 0,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    refetchSearch();
  };

  const handlePlayerClick = (player: PlayerWeekData) => {
    setSelectedPlayer(player);
    setDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/forge-hub">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
              <Database className="h-6 w-6 text-blue-400" />
              Tiber Data Lab
            </h1>
            <p className="text-gray-400 text-sm">Snapshot-based NFL data spine for analytics</p>
          </div>
        </div>

        {metaLoading ? (
          <Card className="bg-[#141824] border-gray-700 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-32 bg-gray-700" />
                <Skeleton className="h-5 w-24 bg-gray-700" />
                <Skeleton className="h-5 w-20 bg-gray-700" />
              </div>
            </CardContent>
          </Card>
        ) : metaData ? (
          <Card className="bg-[#141824] border-gray-700 mb-6" data-testid="card-snapshot-meta">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="border-green-600 text-green-400">
                    Snapshot #{metaData.snapshotId}
                  </Badge>
                  <span className="text-gray-400">
                    {metaData.season} Week {metaData.week}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {metaData.rowCount} players • {metaData.teamCount} teams
                  </span>
                </div>
                <span className="text-gray-500 text-sm">
                  {new Date(metaData.snapshotAt).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-[#141824] border-gray-700 mb-6">
            <CardContent className="p-4">
              <div className="text-yellow-400 text-center">
                No snapshot available. Run a snapshot first using the admin endpoint.
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-[#141824] border-gray-700 mb-6" data-testid="card-search-filters">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-400" />
              Search Players
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-gray-400 text-sm">Player Name</Label>
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#0a0e1a] border-gray-600 text-white"
                  data-testid="input-search"
                />
              </div>

              <div className="w-32">
                <Label className="text-gray-400 text-sm">Position</Label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger className="bg-[#0a0e1a] border-gray-600 text-white" data-testid="select-position">
                    <SelectValue placeholder="Position" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141824] border-gray-600">
                    {POSITIONS.map((pos) => (
                      <SelectItem key={pos} value={pos} className="text-white hover:bg-gray-700">
                        {pos}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-24">
                <Label className="text-gray-400 text-sm">Season</Label>
                <Input
                  type="number"
                  value={season}
                  onChange={(e) => setSeason(Number(e.target.value))}
                  className="bg-[#0a0e1a] border-gray-600 text-white"
                  data-testid="input-season"
                />
              </div>

              <div className="w-24">
                <Label className="text-gray-400 text-sm">Week</Label>
                <Input
                  type="number"
                  value={week}
                  onChange={(e) => setWeek(Number(e.target.value))}
                  className="bg-[#0a0e1a] border-gray-600 text-white"
                  min={1}
                  max={18}
                  data-testid="input-week"
                />
              </div>

              <div className="w-28">
                <Label className="text-gray-400 text-sm">Min Routes</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={minRoutes}
                  onChange={(e) => setMinRoutes(e.target.value)}
                  className="bg-[#0a0e1a] border-gray-600 text-white"
                  data-testid="input-min-routes"
                />
              </div>

              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" data-testid="button-search">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-[#141824] border-gray-700" data-testid="card-results">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Results</CardTitle>
              {searchData && (
                <span className="text-gray-400 text-sm">
                  {searchData.total} players found
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {searchLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-gray-700" />
                ))}
              </div>
            ) : searchData?.data.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No players found matching your criteria
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-results">
                  <thead className="bg-[#0a0e1a] text-gray-400 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 text-left">Player</th>
                      <th className="px-4 py-3 text-center">Team</th>
                      <th className="px-4 py-3 text-center">Pos</th>
                      <th className="px-4 py-3 text-center">Routes</th>
                      <th className="px-4 py-3 text-center">Tgt</th>
                      <th className="px-4 py-3 text-center">TPRR</th>
                      <th className="px-4 py-3 text-center">Rec</th>
                      <th className="px-4 py-3 text-center">Yds</th>
                      <th className="px-4 py-3 text-center">YPRR</th>
                      <th className="px-4 py-3 text-center">aDOT</th>
                      <th className="px-4 py-3 text-center">EPA/P</th>
                      <th className="px-4 py-3 text-center">Succ%</th>
                      <th className="px-4 py-3 text-center">Snaps</th>
                      <th className="px-4 py-3 text-center">Snap%</th>
                      <th className="px-4 py-3 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {searchData?.data.map((player) => (
                      <tr 
                        key={player.id} 
                        className="hover:bg-[#1a1f2e] cursor-pointer transition-colors"
                        onClick={() => handlePlayerClick(player)}
                        data-testid={`row-player-${player.playerId}`}
                      >
                        <td className="px-4 py-3 font-medium text-white" data-testid={`text-name-${player.playerId}`}>
                          {player.playerName}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-400">
                          {player.teamId || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <PositionBadge position={player.position} />
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {player.routes ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {player.targets ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-blue-400">
                          {formatStat(player.tprr, 2)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {player.receptions ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {player.recYards ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-green-400">
                          {formatStat(player.yprr, 2)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {formatStat(player.aDot, 1)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-yellow-400">
                          {formatStat(player.epaPerPlay, 2)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {formatPct(player.successRate)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {player.snaps ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-300">
                          {formatPct(player.snapShare)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PlayerDrawer
        player={selectedPlayer}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
