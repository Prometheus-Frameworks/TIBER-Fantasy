import { useState, useEffect, useRef } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Users, TrendingUp, TrendingDown, AlertCircle, UserCheck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import MetricMatrixCard from '@/components/metricMatrix/MetricMatrixCard';
import TiberScoreCard from '@/components/tiber/TiberScoreCard';
import { addRecentPlayer } from '@/lib/recentPlayers';

interface PlayerIdentity {
  success: boolean;
  data: {
    canonicalId: string;
    fullName: string;
    position: string;
    nflTeam: string | null;
    confidence: number;
    externalIds: {
      sleeper?: string;
      nfl_data_py?: string;
    };
    isActive: boolean;
    lastVerified: string;
  };
}

interface CurrentWeekResponse {
  success: boolean;
  currentWeek: number;
  season: number;
}

interface AvailableWeeksResponse {
  success: boolean;
  data: {
    playerId: string;
    season: number;
    availableWeeks: number[];
    latestWeek: number | null;
    totalWeeks: number;
  };
}

interface TierNeighbor {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  alpha: number;
  tier: string;
}

interface TiersNeighborsResponse {
  success: boolean;
  data?: {
    currentPlayer: TierNeighbor | null;
    rank: number | null;
    above: TierNeighbor[];
    below: TierNeighbor[];
    totalRanked: number;
    mode: 'dynasty' | 'redraft' | 'bestball';
    position: string;
  };
  reason?: string;
}

interface SimilarPlayer {
  playerId: string;
  playerName: string | null;
  team: string | null;
  position: string | null;
  distance: number;
  axesSummary: Record<string, number>;
  reason: string;
  watch: string;
}

interface SimilarPlayersResponse {
  success: boolean;
  data?: {
    basePlayer: {
      playerId: string;
      playerName: string | null;
      position: string | null;
      confidence: number;
    };
    similarPlayers: SimilarPlayer[];
    confidenceWarning?: string;
  };
  reason?: string;
}

interface LeagueOwnershipResponse {
  success: boolean;
  enabled: boolean;
  data?: {
    status: 'on_my_roster' | 'owned_by_other' | 'free_agent' | 'unknown';
    ownerTeamName?: string;
    ownerDisplayName?: string;
    isOnMyTeam: boolean;
  };
  reason?: string;
}

export default function PlayerPage() {
  const [, params] = useRoute('/player/:playerId');
  const playerId = params?.playerId || '';
  
  const [mode, setMode] = useState<'weekly' | 'season'>('weekly');
  const [week, setWeek] = useState<number | null>(null);
  const [season, setSeason] = useState(2025);

  // Fetch current week from system endpoint (fallback only)
  const { data: currentWeekData } = useQuery<CurrentWeekResponse>({
    queryKey: ['/api/system/current-week'],
  });

  // Fetch available weeks for this player
  const { data: weeksData } = useQuery<AvailableWeeksResponse>({
    queryKey: ['/api/player-identity/player', playerId, 'weeks', season],
    queryFn: async () => {
      const res = await fetch(`/api/player-identity/player/${playerId}/weeks?season=${season}`);
      if (!res.ok) throw new Error('Failed to fetch weeks');
      return res.json();
    },
    enabled: !!playerId,
  });

  const availableWeeks = weeksData?.data?.availableWeeks || [];
  const latestAvailableWeek = weeksData?.data?.latestWeek;

  // Set defaults: prefer latest available week, fallback to system current week
  useEffect(() => {
    if (week === null) {
      if (latestAvailableWeek) {
        setWeek(latestAvailableWeek);
      } else if (currentWeekData?.success) {
        const clampedWeek = Math.max(1, Math.min(currentWeekData.currentWeek, 18));
        setWeek(clampedWeek);
      }
    }
    if (currentWeekData?.season && season !== currentWeekData.season) {
      setSeason(currentWeekData.season);
    }
  }, [latestAvailableWeek, currentWeekData, week, season]);

  // Fallback default if both endpoints fail
  const effectiveWeek = week ?? 3;
  const hasDataForWeek = availableWeeks.includes(effectiveWeek);

  const { data: playerData, isLoading: identityLoading, isError: identityError } = useQuery<PlayerIdentity>({
    queryKey: ['/api/player-identity/player', playerId],
    queryFn: async () => {
      const res = await fetch(`/api/player-identity/player/${playerId}`);
      if (!res.ok) throw new Error('Player not found');
      return res.json();
    },
    enabled: !!playerId,
  });

  const player = playerData?.data;
  const nflfastrId = player?.externalIds?.nfl_data_py || playerId;
  const [, navigate] = useLocation();

  // Fetch similar players
  const { data: similarData, isLoading: similarLoading } = useQuery<SimilarPlayersResponse>({
    queryKey: ['/api/players/similar', nflfastrId, season, effectiveWeek],
    queryFn: async () => {
      const res = await fetch(`/api/players/similar?playerId=${nflfastrId}&season=${season}&week=${effectiveWeek}&limit=6`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, reason: errorData.reason || `HTTP ${res.status}` };
      }
      return res.json();
    },
    enabled: !!nflfastrId && !!effectiveWeek,
    staleTime: 4 * 60 * 60 * 1000, // Cache for 4 hours
  });

  // Fetch tiers neighbors
  const { data: neighborsData, isLoading: neighborsLoading } = useQuery<TiersNeighborsResponse>({
    queryKey: ['/api/tiers/neighbors', nflfastrId, player?.position],
    queryFn: async () => {
      const res = await fetch(`/api/tiers/neighbors?playerId=${nflfastrId}&position=${player?.position}&limit=3`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, reason: errorData.reason || `HTTP ${res.status}` };
      }
      return res.json();
    },
    enabled: !!nflfastrId && !!player?.position,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch league ownership (currently no league context)
  const { data: ownershipData } = useQuery<LeagueOwnershipResponse>({
    queryKey: ['/api/league/ownership', playerId],
    queryFn: async () => {
      const res = await fetch(`/api/league/ownership?playerId=${playerId}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, enabled: false, reason: errorData.reason || `HTTP ${res.status}` };
      }
      return res.json();
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
  });

  // Track recently viewed players
  const hasTrackedRef = useRef(false);
  useEffect(() => {
    if (player && !hasTrackedRef.current) {
      addRecentPlayer({
        playerId: player.canonicalId,
        name: player.fullName,
        team: player.nflTeam || 'FA',
        position: player.position,
      });
      hasTrackedRef.current = true;
    }
  }, [player]);

  if (identityLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48 bg-gray-800/50" />
          <Skeleton className="h-12 w-64 bg-gray-800/50" />
          <Skeleton className="h-64 w-full bg-gray-800/50" />
          <Skeleton className="h-48 w-full bg-gray-800/50" />
        </div>
      </div>
    );
  }

  if (identityError || !player) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Player Not Found</h1>
          <p className="text-gray-400">Could not find player with ID: {playerId}</p>
          <Link href="/tiers">
            <Button variant="outline" className="gap-2" data-testid="button-back-tiers">
              <ArrowLeft size={16} />
              Back to Tiers
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Back Link */}
        <Link href="/tiers" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors" data-testid="link-back-tiers">
          <ArrowLeft size={16} />
          <span>Back to Tiers</span>
        </Link>

        {/* Player Header */}
        <div className="bg-[#141824] border border-gray-800/50 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-white tracking-wide" data-testid="text-player-name">
                  {player.fullName}
                </h1>
                {/* League Context Badge */}
                {ownershipData?.enabled && ownershipData.data ? (
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      ownershipData.data.status === 'on_my_roster' 
                        ? 'border-green-500/50 text-green-400 bg-green-500/10' 
                        : ownershipData.data.status === 'owned_by_other'
                        ? 'border-orange-500/50 text-orange-400 bg-orange-500/10'
                        : 'border-gray-500/50 text-gray-400 bg-gray-500/10'
                    }`}
                    data-testid="badge-ownership"
                  >
                    {ownershipData.data.status === 'on_my_roster' && (
                      <>
                        <UserCheck size={12} className="mr-1" />
                        On Your Roster
                      </>
                    )}
                    {ownershipData.data.status === 'owned_by_other' && (
                      <>
                        <User size={12} className="mr-1" />
                        {ownershipData.data.ownerTeamName || 'Owned'}
                      </>
                    )}
                    {ownershipData.data.status === 'free_agent' && 'Free Agent'}
                  </Badge>
                ) : ownershipData && !ownershipData.enabled ? (
                  <span className="text-xs text-gray-500 italic" data-testid="text-ownership-hint">
                    Connect a league for ownership
                  </span>
                ) : null}
              </div>
              <p className="text-lg text-gray-400 mt-1" data-testid="text-player-info">
                {player.nflTeam || 'FA'} • {player.position}
                {neighborsData?.success && neighborsData.data?.rank && (
                  <span className="ml-2 text-purple-400">
                    • #{neighborsData.data.rank} {player.position}
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Player ID</p>
              <p className="text-sm font-mono text-gray-400">{playerId}</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Mode Toggle */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'weekly' | 'season')} className="w-auto">
            <TabsList className="bg-gray-800/50 border border-gray-700/50">
              <TabsTrigger 
                value="weekly" 
                data-testid="tab-mode-weekly"
                className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"
              >
                Weekly
              </TabsTrigger>
              <TabsTrigger 
                value="season" 
                data-testid="tab-mode-season"
                className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400"
              >
                Season
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Week Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Week:</span>
            <select
              value={effectiveWeek}
              onChange={(e) => setWeek(Math.max(1, Math.min(Number(e.target.value), 18)))}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
              data-testid="select-week"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((w) => {
                const hasData = availableWeeks.includes(w);
                return (
                  <option key={w} value={w} className={hasData ? '' : 'text-gray-500'}>
                    Week {w}{!hasData ? ' —' : ''}
                  </option>
                );
              })}
            </select>
            {!hasDataForWeek && (
              <span className="text-xs text-yellow-500/80">No data</span>
            )}
          </div>

          {/* Season Display */}
          <div className="text-sm text-gray-400">
            Season: <span className="text-white font-medium">{season}</span>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* TIBER Score Card */}
          <div className="lg:col-span-2">
            <TiberScoreCard
              nflfastrId={nflfastrId}
              week={effectiveWeek}
              season={season}
              mode={mode}
              position={player.position}
              hasDataForWeek={hasDataForWeek}
            />
          </div>

          {/* Metric Matrix Card */}
          <div className="lg:col-span-2">
            <MetricMatrixCard
              playerId={nflfastrId}
              season={season}
              week={effectiveWeek}
              hasDataForWeek={hasDataForWeek}
            />
          </div>
        </div>

        {/* Research Hub */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Similar Players */}
          <div className="bg-[#141824] border border-gray-800/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users size={18} className="text-purple-400" />
              <h3 className="text-lg font-semibold text-white">Similar Players</h3>
            </div>
            
            {similarLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full bg-gray-800/50" />
                ))}
              </div>
            ) : !similarData?.success ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
                <AlertCircle size={14} />
                <span>{similarData?.reason || 'Unable to find similar players'}</span>
              </div>
            ) : !similarData.data?.similarPlayers || similarData.data.similarPlayers.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">No similar players found</p>
            ) : (
              <div className="space-y-2">
                {similarData.data?.confidenceWarning && (
                  <div className="flex items-center gap-2 text-amber-400 text-xs p-2 bg-amber-500/10 rounded-lg mb-3">
                    <AlertCircle size={12} />
                    <span>{similarData.data.confidenceWarning}</span>
                  </div>
                )}
                {similarData.data?.similarPlayers.map((p) => (
                  <button
                    key={p.playerId}
                    onClick={() => navigate(`/player/${p.playerId}?season=${season}&week=${effectiveWeek}`)}
                    className="w-full p-2.5 rounded-lg bg-gray-800/30 hover:bg-gray-800/60 transition-colors text-left group"
                    data-testid={`similar-player-${p.playerId}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="text-white group-hover:text-purple-300 transition-colors">
                          {p.playerName || 'Unknown'}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          {p.team} • {p.position}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {(100 - p.distance).toFixed(0)}% match
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      <span className="text-green-400/80">{p.reason}</span>
                      <span className="mx-1.5">•</span>
                      <span className="text-amber-400/70">{p.watch}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tier Neighbors */}
          <div className="bg-[#141824] border border-gray-800/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={18} className="text-cyan-400" />
              <h3 className="text-lg font-semibold text-white">Neighbors in Tiers</h3>
            </div>

            {neighborsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full bg-gray-800/50" />
                ))}
              </div>
            ) : !neighborsData?.success ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
                <AlertCircle size={14} />
                <span>{neighborsData?.reason || 'Unable to load tier rankings'}</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Rank context */}
                {neighborsData.data?.rank && (
                  <div className="text-xs text-gray-500 mb-2">
                    Rank #{neighborsData.data.rank} of {neighborsData.data.totalRanked || '?'} {neighborsData.data.position}s ({neighborsData.data.mode})
                  </div>
                )}

                {/* Players Above */}
                {neighborsData.data?.above.map((p) => (
                  <button
                    key={p.playerId}
                    onClick={() => navigate(`/player/${p.playerId}?season=${season}&week=${effectiveWeek}&mode=${mode}`)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg bg-gray-800/30 hover:bg-gray-800/60 transition-colors text-left group"
                    data-testid={`neighbor-above-${p.playerId}`}
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-green-400" />
                      <span className="text-white group-hover:text-purple-300 transition-colors">
                        {p.playerName}
                      </span>
                      <span className="text-xs text-gray-500">{p.team}</span>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                        {p.tier}
                      </Badge>
                      <span className="ml-2 text-xs text-cyan-400">{p.alpha.toFixed(0)}</span>
                    </div>
                  </button>
                ))}

                {/* Current Player Marker */}
                {neighborsData.data?.currentPlayer && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-300 font-medium">
                        {neighborsData.data.currentPlayer.playerName}
                      </span>
                      <span className="text-xs text-gray-400">← You are here</span>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-300">
                        {neighborsData.data.currentPlayer.tier}
                      </Badge>
                      <span className="ml-2 text-xs text-purple-400 font-medium">
                        {neighborsData.data.currentPlayer.alpha.toFixed(0)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Players Below */}
                {neighborsData.data?.below.map((p) => (
                  <button
                    key={p.playerId}
                    onClick={() => navigate(`/player/${p.playerId}?season=${season}&week=${effectiveWeek}&mode=${mode}`)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg bg-gray-800/30 hover:bg-gray-800/60 transition-colors text-left group"
                    data-testid={`neighbor-below-${p.playerId}`}
                  >
                    <div className="flex items-center gap-2">
                      <TrendingDown size={14} className="text-orange-400" />
                      <span className="text-white group-hover:text-purple-300 transition-colors">
                        {p.playerName}
                      </span>
                      <span className="text-xs text-gray-500">{p.team}</span>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                        {p.tier}
                      </Badge>
                      <span className="ml-2 text-xs text-cyan-400">{p.alpha.toFixed(0)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-6 border-t border-gray-800/50">
          <p className="text-xs text-gray-600 tracking-wide">
            TIBER v1.0 — Tactical Index for Breakout Efficiency & Regression
          </p>
        </div>
      </div>
    </div>
  );
}
