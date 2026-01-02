import { useState, useEffect, useRef, useCallback } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Users, TrendingUp, TrendingDown, AlertCircle, UserCheck, User, Activity, ChevronDown, ChevronUp, Copy, Check, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import MetricMatrixCard from '@/components/metricMatrix/MetricMatrixCard';
import TiberScoreCard from '@/components/tiber/TiberScoreCard';
import { addRecentPlayer } from '@/lib/recentPlayers';

const SECTION_NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'usage', label: 'Usage' },
  { id: 'comps', label: 'Comps' },
  { id: 'league', label: 'League' },
  { id: 'notes', label: 'Notes' },
] as const;

type SectionId = typeof SECTION_NAV_ITEMS[number]['id'];

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
    status: 'owned_by_me' | 'owned_by_other' | 'free_agent' | 'disabled' | 'fallback';
    teamId?: string;
    teamName?: string;
    leagueId?: string;
    hint?: string;
    source: 'db' | 'sleeper_api' | 'disabled';
  };
  reason?: string;
}

interface LeaguesResponse {
  success: boolean;
  data: {
    leagues: Array<{
      leagueId: string;
      status: string;
      lastSyncedAt: string;
      changeSeq: number;
    }>;
    count: number;
  };
}

interface OwnershipHistoryEvent {
  id: number;
  leagueId: string;
  playerKey: string;
  fromTeamId: string | null;
  toTeamId: string | null;
  eventType: string;
  eventAt: string;
  week: number | null;
  season: number | null;
  source: string | null;
}

interface OwnershipHistoryResponse {
  success: boolean;
  data?: {
    leagueId: string;
    playerKey: string;
    events: OwnershipHistoryEvent[];
    count: number;
  };
  error?: string;
}

interface ChurnEntry {
  playerKey: string;
  count: number;
}

interface OwnershipChurnResponse {
  success: boolean;
  data?: {
    leagueId: string;
    since: string;
    mostAdded: ChurnEntry[];
    mostDropped: ChurnEntry[];
    mostTraded: ChurnEntry[];
  };
  error?: string;
}

export default function PlayerPage() {
  const [, params] = useRoute('/player/:playerId');
  const playerId = params?.playerId || '';
  
  const [mode, setMode] = useState<'weekly' | 'season'>('weekly');
  const [week, setWeek] = useState<number | null>(null);
  const [season, setSeason] = useState(2025);
  
  // Research Terminal: Section collapse state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    usage: false,
    comps: false,
    league: false,
    notes: true, // Notes collapsed by default
  });
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [copiedKey, setCopiedKey] = useState(false);
  const [playerNotes, setPlayerNotes] = useState('');
  
  // Section refs for IntersectionObserver
  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({
    overview: null,
    usage: null,
    comps: null,
    league: null,
    notes: null,
  });
  
  const toggleSection = useCallback((section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);
  
  // Load notes from localStorage
  useEffect(() => {
    if (playerId) {
      const saved = localStorage.getItem(`tiber-notes-${playerId}`);
      if (saved) setPlayerNotes(saved);
    }
  }, [playerId]);
  
  // Save notes to localStorage
  const handleNotesChange = useCallback((value: string) => {
    setPlayerNotes(value);
    localStorage.setItem(`tiber-notes-${playerId}`, value);
  }, [playerId]);
  
  const scrollToSection = useCallback((sectionId: SectionId) => {
    const el = sectionRefs.current[sectionId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Expand section if collapsed
      if (collapsedSections[sectionId]) {
        setCollapsedSections(prev => ({ ...prev, [sectionId]: false }));
      }
    }
  }, [collapsedSections]);

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

  // Copy player key (GSIS ID)
  const copyPlayerKey = useCallback(async () => {
    const gsisId = player?.externalIds?.nfl_data_py;
    if (gsisId) {
      await navigator.clipboard.writeText(gsisId);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  }, [player]);

  // IntersectionObserver for sticky nav highlighting
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    
    SECTION_NAV_ITEMS.forEach(({ id }) => {
      const el = sectionRefs.current[id];
      if (!el) return;
      
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
              setActiveSection(id);
            }
          });
        },
        { threshold: [0.3, 0.5], rootMargin: '-80px 0px -50% 0px' }
      );
      
      observer.observe(el);
      observers.push(observer);
    });
    
    return () => observers.forEach(o => o.disconnect());
  }, [player]);

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

  // Fetch synced leagues for ownership activity
  const { data: leaguesData } = useQuery<LeaguesResponse>({
    queryKey: ['/api/sleeper/leagues'],
    queryFn: async () => {
      const res = await fetch('/api/sleeper/leagues');
      if (!res.ok) return { success: false, data: { leagues: [], count: 0 } };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Use first synced league as active league context
  const activeLeagueId = leaguesData?.data?.leagues?.[0]?.leagueId;

  // Derive playerKey for ownership queries: GSIS ID first, then sleeper:<id>, else undefined
  const gsisId = player?.externalIds?.nfl_data_py; // GSIS ID stored as nfl_data_py
  const sleeperPlayerId = player?.externalIds?.sleeper;
  const ownershipPlayerKey = gsisId || (sleeperPlayerId ? `sleeper:${sleeperPlayerId}` : undefined);

  // Fetch ownership history for this player in the active league
  const { data: historyData, isLoading: historyLoading } = useQuery<OwnershipHistoryResponse>({
    queryKey: ['/api/ownership/history', activeLeagueId, ownershipPlayerKey ?? ''],
    queryFn: async () => {
      if (!ownershipPlayerKey) return { success: false, error: 'No player key available' };
      const res = await fetch(`/api/ownership/history?leagueId=${activeLeagueId}&playerKey=${encodeURIComponent(ownershipPlayerKey)}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, error: errorData.error || `HTTP ${res.status}` };
      }
      return res.json();
    },
    enabled: !!activeLeagueId && !!ownershipPlayerKey,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch churn data for the active league (7-day default)
  const { data: churnData } = useQuery<OwnershipChurnResponse>({
    queryKey: ['/api/ownership/churn', activeLeagueId],
    queryFn: async () => {
      const res = await fetch(`/api/ownership/churn?leagueId=${activeLeagueId}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return { success: false, error: errorData.error || `HTTP ${res.status}` };
      }
      return res.json();
    },
    enabled: !!activeLeagueId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Check if player appears in churn lists (match by sleeper key if available)
  const playerInChurn = {
    added: churnData?.data?.mostAdded?.find(e => e.playerKey === ownershipPlayerKey),
    dropped: churnData?.data?.mostDropped?.find(e => e.playerKey === ownershipPlayerKey),
    traded: churnData?.data?.mostTraded?.find(e => e.playerKey === ownershipPlayerKey),
  };
  const hasChurnActivity = playerInChurn.added || playerInChurn.dropped || playerInChurn.traded;

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

        {/* Sticky Section Nav */}
        <nav className="sticky top-0 z-20 bg-[#0a0e1a]/95 backdrop-blur-sm -mx-6 px-6 py-2 border-b border-gray-800/50">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {SECTION_NAV_ITEMS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                  activeSection === id
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
                data-testid={`nav-${id}`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* OVERVIEW SECTION */}
        <div 
          ref={(el) => { sectionRefs.current.overview = el; }}
          id="section-overview"
          className="scroll-mt-16"
        >
          {/* Player Header */}
          <div className="bg-[#141824] border border-gray-800/50 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-white tracking-wide" data-testid="text-player-name">
                    {player.fullName}
                  </h1>
                  {/* League Context Badge */}
                  {ownershipData?.enabled && ownershipData.data ? (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        ownershipData.data.status === 'owned_by_me' 
                          ? 'border-green-500/50 text-green-400 bg-green-500/10' 
                          : ownershipData.data.status === 'owned_by_other'
                          ? 'border-orange-500/50 text-orange-400 bg-orange-500/10'
                          : 'border-gray-500/50 text-gray-400 bg-gray-500/10'
                      }`}
                      data-testid="badge-ownership"
                    >
                      {ownershipData.data.status === 'owned_by_me' && (
                        <>
                          <UserCheck size={12} className="mr-1" />
                          Rostered
                        </>
                      )}
                      {ownershipData.data.status === 'owned_by_other' && (
                        <>
                          <User size={12} className="mr-1" />
                          {ownershipData.data.teamName || 'Owned'}
                        </>
                      )}
                      {ownershipData.data.status === 'free_agent' && 'FA'}
                    </Badge>
                  ) : null}
                  {neighborsData?.success && neighborsData.data?.currentPlayer?.tier && (
                    <Badge variant="outline" className="text-xs border-cyan-500/50 text-cyan-400 bg-cyan-500/10">
                      {neighborsData.data.currentPlayer.tier}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-1" data-testid="text-player-info">
                  {player.nflTeam || 'FA'} • {player.position}
                  {neighborsData?.success && neighborsData.data?.rank && (
                    <span className="ml-2 text-purple-400">
                      • #{neighborsData.data.rank} {player.position}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <button
                  onClick={copyPlayerKey}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors group"
                  title="Copy GSIS ID"
                  data-testid="button-copy-key"
                >
                  {copiedKey ? (
                    <>
                      <Check size={12} className="text-green-400" />
                      <span className="text-green-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span className="font-mono">{nflfastrId.slice(0, 12)}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'weekly' | 'season')} className="w-auto">
            <TabsList className="bg-gray-800/50 border border-gray-700/50 h-8">
              <TabsTrigger 
                value="weekly" 
                data-testid="tab-mode-weekly"
                className="text-xs data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"
              >
                Weekly
              </TabsTrigger>
              <TabsTrigger 
                value="season" 
                data-testid="tab-mode-season"
                className="text-xs data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400"
              >
                Season
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <select
              value={effectiveWeek}
              onChange={(e) => setWeek(Math.max(1, Math.min(Number(e.target.value), 18)))}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white h-8"
              data-testid="select-week"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((w) => {
                const hasData = availableWeeks.includes(w);
                return (
                  <option key={w} value={w} className={hasData ? '' : 'text-gray-500'}>
                    Wk {w}{!hasData ? ' —' : ''}
                  </option>
                );
              })}
            </select>
            {!hasDataForWeek && (
              <span className="text-xs text-yellow-500/80">No data</span>
            )}
          </div>
          <span className="text-xs text-gray-500">{season}</span>
        </div>

        {/* USAGE SECTION */}
        <div 
          ref={(el) => { sectionRefs.current.usage = el; }}
          id="section-usage"
          className="bg-[#141824] border border-gray-800/50 rounded-xl overflow-hidden scroll-mt-16"
        >
          <button
            onClick={() => toggleSection('usage')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-800/20 transition-colors"
            data-testid="button-toggle-usage"
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-cyan-400" />
              <h3 className="text-base font-semibold text-white">Usage & Scores</h3>
              <span className="text-xs text-gray-500">TIBER + Metrics</span>
            </div>
            {!collapsedSections.usage ? (
              <ChevronUp size={16} className="text-gray-400" />
            ) : (
              <ChevronDown size={16} className="text-gray-400" />
            )}
          </button>
          
          {!collapsedSections.usage && (
            <div className="px-4 pb-4 space-y-4">
              <TiberScoreCard
                nflfastrId={nflfastrId}
                week={effectiveWeek}
                season={season}
                mode={mode}
                position={player.position}
                hasDataForWeek={hasDataForWeek}
              />
              <MetricMatrixCard
                playerId={nflfastrId}
                season={season}
                week={effectiveWeek}
                hasDataForWeek={hasDataForWeek}
              />
            </div>
          )}
        </div>

        {/* COMPS SECTION */}
        <div 
          ref={(el) => { sectionRefs.current.comps = el; }}
          id="section-comps"
          className="bg-[#141824] border border-gray-800/50 rounded-xl overflow-hidden scroll-mt-16"
        >
          <button
            onClick={() => toggleSection('comps')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-800/20 transition-colors"
            data-testid="button-toggle-comps"
          >
            <div className="flex items-center gap-2">
              <Users size={16} className="text-purple-400" />
              <h3 className="text-base font-semibold text-white">Comparisons</h3>
              <span className="text-xs text-gray-500">Similar + Neighbors</span>
            </div>
            {!collapsedSections.comps ? (
              <ChevronUp size={16} className="text-gray-400" />
            ) : (
              <ChevronDown size={16} className="text-gray-400" />
            )}
          </button>
          
          {!collapsedSections.comps && (
            <div className="px-4 pb-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Similar Players */}
                <div className="bg-gray-800/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={14} className="text-purple-400" />
                    <h4 className="text-sm font-medium text-white">Similar Players</h4>
                  </div>
                  
                  {similarLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-8 w-full bg-gray-800/50" />
                      ))}
                    </div>
                  ) : !similarData?.success ? (
                    <div className="flex items-center gap-2 text-gray-500 text-xs py-2">
                      <AlertCircle size={12} />
                      <span>{similarData?.reason || 'No comps available'}</span>
                    </div>
                  ) : !similarData.data?.similarPlayers?.length ? (
                    <p className="text-gray-500 text-xs py-2">No similar players found</p>
                  ) : (
                    <div className="space-y-1.5">
                      {similarData.data?.confidenceWarning && (
                        <div className="flex items-center gap-2 text-amber-400 text-xs p-1.5 bg-amber-500/10 rounded mb-2">
                          <AlertCircle size={10} />
                          <span className="text-[10px]">{similarData.data.confidenceWarning}</span>
                        </div>
                      )}
                      {similarData.data?.similarPlayers.slice(0, 5).map((p) => (
                        <button
                          key={p.playerId}
                          onClick={() => navigate(`/player/${p.playerId}?season=${season}&week=${effectiveWeek}`)}
                          className="w-full p-2 rounded bg-gray-800/30 hover:bg-gray-800/60 transition-colors text-left group"
                          data-testid={`similar-player-${p.playerId}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm text-white group-hover:text-purple-300 transition-colors">
                                {p.playerName || 'Unknown'}
                              </span>
                              <span className="text-[10px] text-gray-500">{p.team}</span>
                            </div>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {(100 - p.distance).toFixed(0)}%
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            <span className="text-green-400/80">{p.reason}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tier Neighbors */}
                <div className="bg-gray-800/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={14} className="text-cyan-400" />
                    <h4 className="text-sm font-medium text-white">Tier Neighbors</h4>
                    {neighborsData?.data?.rank && (
                      <span className="text-[10px] text-gray-500">#{neighborsData.data.rank}</span>
                    )}
                  </div>

                  {neighborsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-8 w-full bg-gray-800/50" />
                      ))}
                    </div>
                  ) : !neighborsData?.success ? (
                    <div className="flex items-center gap-2 text-gray-500 text-xs py-2">
                      <AlertCircle size={12} />
                      <span>{neighborsData?.reason || 'Unable to load'}</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {/* Players Above */}
                      {neighborsData.data?.above.map((p) => (
                        <button
                          key={p.playerId}
                          onClick={() => navigate(`/player/${p.playerId}?season=${season}&week=${effectiveWeek}&mode=${mode}`)}
                          className="w-full flex items-center justify-between p-2 rounded bg-gray-800/30 hover:bg-gray-800/60 transition-colors text-left group"
                          data-testid={`neighbor-above-${p.playerId}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <TrendingUp size={12} className="text-green-400" />
                            <span className="text-sm text-white group-hover:text-purple-300">{p.playerName}</span>
                          </div>
                          <span className="text-[10px] text-cyan-400 font-mono">{p.alpha.toFixed(0)}</span>
                        </button>
                      ))}

                      {/* Current Player */}
                      {neighborsData.data?.currentPlayer && (
                        <div className="flex items-center justify-between p-2 rounded bg-purple-500/10 border border-purple-500/30">
                          <span className="text-sm text-purple-300 font-medium">{neighborsData.data.currentPlayer.playerName}</span>
                          <span className="text-[10px] text-purple-400 font-mono font-medium">{neighborsData.data.currentPlayer.alpha.toFixed(0)}</span>
                        </div>
                      )}

                      {/* Players Below */}
                      {neighborsData.data?.below.map((p) => (
                        <button
                          key={p.playerId}
                          onClick={() => navigate(`/player/${p.playerId}?season=${season}&week=${effectiveWeek}&mode=${mode}`)}
                          className="w-full flex items-center justify-between p-2 rounded bg-gray-800/30 hover:bg-gray-800/60 transition-colors text-left group"
                          data-testid={`neighbor-below-${p.playerId}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <TrendingDown size={12} className="text-orange-400" />
                            <span className="text-sm text-white group-hover:text-purple-300">{p.playerName}</span>
                          </div>
                          <span className="text-[10px] text-cyan-400 font-mono">{p.alpha.toFixed(0)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* League Activity Section */}
        <div 
          ref={(el) => { sectionRefs.current.league = el; }}
          id="section-league"
          className="bg-[#141824] border border-gray-800/50 rounded-xl overflow-hidden scroll-mt-20"
        >
          <button
            onClick={() => toggleSection('league')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-800/20 transition-colors"
            data-testid="button-toggle-activity"
          >
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-blue-400" />
              <h3 className="text-base font-semibold text-white">League Activity</h3>
            </div>
            {!collapsedSections.league ? (
              <ChevronUp size={18} className="text-gray-400" />
            ) : (
              <ChevronDown size={18} className="text-gray-400" />
            )}
          </button>
          
          {!collapsedSections.league && (
            <div className="px-5 pb-5 space-y-4">
              {!ownershipPlayerKey ? (
                <div className="text-sm text-gray-500 italic py-2" data-testid="text-no-player-key">
                  No player key available for activity tracking.
                </div>
              ) : !activeLeagueId ? (
                <div className="text-sm text-gray-500 italic py-2" data-testid="text-no-league-hint">
                  Set an active league to see activity.
                </div>
              ) : (
                <>
                  {/* Recent Moves */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Recent Moves</h4>
                    {historyLoading ? (
                      <div className="space-y-2">
                        {[1, 2].map((i) => (
                          <Skeleton key={i} className="h-8 w-full bg-gray-800/50" />
                        ))}
                      </div>
                    ) : !historyData?.success || !historyData.data?.events?.length ? (
                      <p className="text-sm text-gray-500 py-2" data-testid="text-no-recent-moves">
                        No recent moves tracked
                      </p>
                    ) : (
                      <div className="space-y-2" data-testid="list-recent-moves">
                        {historyData.data.events.slice(0, 5).map((event) => {
                          const eventDate = new Date(event.eventAt);
                          const dateStr = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          
                          return (
                            <div
                              key={event.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-gray-800/30 text-sm"
                              data-testid={`move-event-${event.id}`}
                            >
                              <div className="flex items-center gap-2">
                                {event.eventType === 'ADD' && (
                                  <>
                                    <Badge variant="outline" className="text-xs border-green-500/50 text-green-400 bg-green-500/10">
                                      ADD
                                    </Badge>
                                    <span className="text-gray-300">
                                      → Team {event.toTeamId?.slice(-4) || '?'}
                                    </span>
                                  </>
                                )}
                                {event.eventType === 'DROP' && (
                                  <>
                                    <Badge variant="outline" className="text-xs border-red-500/50 text-red-400 bg-red-500/10">
                                      DROP
                                    </Badge>
                                    <span className="text-gray-300">
                                      ← Team {event.fromTeamId?.slice(-4) || '?'}
                                    </span>
                                  </>
                                )}
                                {event.eventType === 'TRADE' && (
                                  <>
                                    <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-400 bg-purple-500/10">
                                      TRADE
                                    </Badge>
                                    <span className="text-gray-300">
                                      {event.fromTeamId?.slice(-4) || '?'} → {event.toTeamId?.slice(-4) || '?'}
                                    </span>
                                  </>
                                )}
                              </div>
                              <span className="text-xs text-gray-500">{dateStr}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Churn Snapshot */}
                  <div className="border-t border-gray-700/50 pt-4">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Churn Snapshot (7d)</h4>
                    {hasChurnActivity ? (
                      <div className="space-y-1.5" data-testid="churn-snapshot">
                        {playerInChurn.added && (
                          <div className="flex items-center gap-2 text-sm">
                            <TrendingUp size={14} className="text-green-400" />
                            <span className="text-gray-300">
                              Added <span className="text-green-400 font-medium">{playerInChurn.added.count}x</span> in league
                            </span>
                          </div>
                        )}
                        {playerInChurn.dropped && (
                          <div className="flex items-center gap-2 text-sm">
                            <TrendingDown size={14} className="text-red-400" />
                            <span className="text-gray-300">
                              Dropped <span className="text-red-400 font-medium">{playerInChurn.dropped.count}x</span> in league
                            </span>
                          </div>
                        )}
                        {playerInChurn.traded && (
                          <div className="flex items-center gap-2 text-sm">
                            <Activity size={14} className="text-purple-400" />
                            <span className="text-gray-300">
                              Traded <span className="text-purple-400 font-medium">{playerInChurn.traded.count}x</span> in league
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500" data-testid="text-no-churn">
                        No notable movement (7d)
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* NOTES SECTION */}
        <div 
          ref={(el) => { sectionRefs.current.notes = el; }}
          id="section-notes"
          className="bg-[#141824] border border-gray-800/50 rounded-xl overflow-hidden scroll-mt-16"
        >
          <button
            onClick={() => toggleSection('notes')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-800/20 transition-colors"
            data-testid="button-toggle-notes"
          >
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-amber-400" />
              <h3 className="text-base font-semibold text-white">Notes</h3>
              <span className="text-xs text-gray-500">Local only</span>
            </div>
            {!collapsedSections.notes ? (
              <ChevronUp size={16} className="text-gray-400" />
            ) : (
              <ChevronDown size={16} className="text-gray-400" />
            )}
          </button>
          
          {!collapsedSections.notes && (
            <div className="px-4 pb-4">
              <Textarea
                value={playerNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Add personal notes about this player..."
                className="bg-gray-800/50 border-gray-700 text-gray-300 placeholder:text-gray-600 text-sm resize-none min-h-[80px]"
                data-testid="textarea-notes"
              />
              <p className="text-[10px] text-gray-600 mt-1.5">Saved to browser storage</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center pt-4 border-t border-gray-800/50">
          <p className="text-[10px] text-gray-600 tracking-wide">
            TIBER v1.0 — Research Terminal
          </p>
        </div>
      </div>
    </div>
  );
}
