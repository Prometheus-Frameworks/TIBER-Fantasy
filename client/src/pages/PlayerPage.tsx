import { useState, useEffect, useRef, useCallback } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Users, TrendingUp, TrendingDown, AlertCircle, UserCheck, User, Activity, ChevronDown, ChevronUp, Copy, Check, FileText, X, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import MetricMatrixCard from '@/components/metricMatrix/MetricMatrixCard';
import TiberScoreCard from '@/components/tiber/TiberScoreCard';
import { addRecentPlayer } from '@/lib/recentPlayers';
import { computePulse, computeTrendDeltas, getTopDrivers, formatWeekRange, getDeltaArrow, getPulseColor, type WeekData } from '@/lib/pulseUtils';

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

interface CompareTarget {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
}

interface WeekMetric {
  week: number;
  missing: boolean;
  snapPct: number | null;
  routes: number | null;
  targets: number | null;
  carries: number | null;
  airYards: number | null;
}

interface WeekSeriesResponse {
  success: boolean;
  data?: {
    playerKey: string;
    playerName: string | null;
    position: string | null;
    teamId: string | null;
    season: number;
    maxWeek: number;
    metricSet: string;
    weeks: WeekMetric[];
    availableWeeks: number[];
  };
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
  const [compareTarget, setCompareTarget] = useState<CompareTarget | null>(null);
  
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

  // Fetch week-series data for Trend Deltas
  const { data: weekSeriesData, isLoading: weekSeriesLoading } = useQuery<WeekSeriesResponse>({
    queryKey: ['/api/player-identity/player', nflfastrId, 'week-series', season],
    queryFn: async () => {
      const res = await fetch(`/api/player-identity/player/${nflfastrId}/week-series?season=${season}&metricSet=usage`);
      if (!res.ok) throw new Error('Failed to fetch week series');
      return res.json();
    },
    enabled: !!nflfastrId,
    staleTime: 5 * 60 * 1000,
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
              
              {/* Trend Deltas Row */}
              <div className="bg-gray-800/20 rounded-lg p-4" data-testid="trend-deltas-container">
                <div className="flex items-center gap-2 mb-3">
                  <Activity size={14} className="text-cyan-400" />
                  <h4 className="text-sm font-medium text-white" data-testid="trend-deltas-title">Trend Deltas</h4>
                  <span className="text-xs text-gray-500">Week-over-Week</span>
                </div>
                
                {weekSeriesLoading ? (
                  <div className="flex gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-12 w-20 bg-gray-800/50" />
                    ))}
                  </div>
                ) : (() => {
                  const weeks = weekSeriesData?.data?.weeks || [];
                  const position = player.position;
                  
                  // Check if selected week has data
                  const selectedWeekData = weeks.find(w => w.week === effectiveWeek && !w.missing);
                  
                  // If selected week is missing, find nearest previous non-missing week
                  let currentWeekData = selectedWeekData;
                  let usingFallbackWeek = false;
                  
                  if (!selectedWeekData) {
                    const availableBeforeSelected = weeks.filter(w => w.week <= effectiveWeek && !w.missing);
                    if (availableBeforeSelected.length > 0) {
                      currentWeekData = availableBeforeSelected[availableBeforeSelected.length - 1];
                      usingFallbackWeek = true;
                    }
                  }
                  
                  // Prior week is nearest earlier non-missing week before currentWeekData
                  const currentWeek = currentWeekData?.week || effectiveWeek;
                  const priorWeeks = weeks.filter(w => w.week < currentWeek && !w.missing);
                  const priorWeekData = priorWeeks.length > 0 ? priorWeeks[priorWeeks.length - 1] : null;
                  
                  if (!currentWeekData) {
                    return (
                      <div className="flex items-center gap-2 text-gray-500 text-xs py-2">
                        <AlertCircle size={12} />
                        <span>No data available</span>
                      </div>
                    );
                  }
                  
                  if (!priorWeekData) {
                    return (
                      <div className="flex items-center gap-2 text-gray-500 text-xs py-2">
                        <AlertCircle size={12} />
                        <span>No prior week data to compare</span>
                        {usingFallbackWeek && (
                          <span className="text-yellow-500/80 ml-2">(Selected week missing; using Wk{currentWeek})</span>
                        )}
                      </div>
                    );
                  }
                  
                  const getDelta = (curr: number | null, prev: number | null): { value: number | null; display: string } => {
                    if (curr === null || prev === null) return { value: null, display: '—' };
                    const delta = curr - prev;
                    const sign = delta > 0 ? '+' : '';
                    return { value: delta, display: `${sign}${delta}` };
                  };
                  
                  const snapDelta = getDelta(currentWeekData.snapPct, priorWeekData.snapPct);
                  const routesDelta = getDelta(currentWeekData.routes, priorWeekData.routes);
                  const targetsDelta = getDelta(currentWeekData.targets, priorWeekData.targets);
                  const carriesDelta = getDelta(currentWeekData.carries, priorWeekData.carries);
                  
                  const getDeltaColor = (value: number | null): string => {
                    if (value === null) return 'text-gray-500';
                    if (value > 0) return 'text-green-400';
                    if (value < 0) return 'text-red-400';
                    return 'text-gray-400';
                  };
                  
                  const getDeltaIcon = (value: number | null) => {
                    if (value === null) return null;
                    if (value > 0) return <TrendingUp size={12} className="text-green-400" />;
                    if (value < 0) return <TrendingDown size={12} className="text-red-400" />;
                    return null;
                  };
                  
                  const showRoutes = position === 'WR' || position === 'TE';
                  const showCarries = position === 'RB' || position === 'QB';
                  
                  return (
                    <div className="space-y-2">
                      {usingFallbackWeek && (
                        <div className="text-[10px] text-yellow-500/80 flex items-center gap-1">
                          <AlertCircle size={10} />
                          <span>Selected week missing; using Wk{currentWeek}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-4">
                        {currentWeekData.snapPct !== null && (
                          <div className="flex flex-col items-center" title={`Wk${priorWeekData.week}: ${priorWeekData.snapPct ?? '—'}% → Wk${currentWeek}: ${currentWeekData.snapPct}%`}>
                            <span className="text-[10px] text-gray-500 mb-1">Δ Snap%</span>
                            <div className="flex items-center gap-1">
                              {getDeltaIcon(snapDelta.value)}
                              <span className={`text-sm font-mono font-semibold ${getDeltaColor(snapDelta.value)}`}>
                                {snapDelta.display}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {showRoutes && (
                          <div className="flex flex-col items-center" title={`Wk${priorWeekData.week}: ${priorWeekData.routes ?? '—'} → Wk${currentWeek}: ${currentWeekData.routes}`}>
                            <span className="text-[10px] text-gray-500 mb-1">Δ Routes</span>
                            <div className="flex items-center gap-1">
                              {getDeltaIcon(routesDelta.value)}
                              <span className={`text-sm font-mono font-semibold ${getDeltaColor(routesDelta.value)}`}>
                                {routesDelta.display}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex flex-col items-center" title={`Wk${priorWeekData.week}: ${priorWeekData.targets ?? '—'} → Wk${currentWeek}: ${currentWeekData.targets}`}>
                          <span className="text-[10px] text-gray-500 mb-1">Δ Targets</span>
                          <div className="flex items-center gap-1">
                            {getDeltaIcon(targetsDelta.value)}
                            <span className={`text-sm font-mono font-semibold ${getDeltaColor(targetsDelta.value)}`}>
                              {targetsDelta.display}
                            </span>
                          </div>
                        </div>
                        
                        {showCarries && (
                          <div className="flex flex-col items-center" title={`Wk${priorWeekData.week}: ${priorWeekData.carries ?? '—'} → Wk${currentWeek}: ${currentWeekData.carries}`}>
                            <span className="text-[10px] text-gray-500 mb-1">Δ Carries</span>
                            <div className="flex items-center gap-1">
                              {getDeltaIcon(carriesDelta.value)}
                              <span className={`text-sm font-mono font-semibold ${getDeltaColor(carriesDelta.value)}`}>
                                {carriesDelta.display}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex-1 flex items-end justify-end">
                          <span className="text-[10px] text-gray-600">Wk{currentWeek} vs Wk{priorWeekData.week}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              {/* 3-Week Pulse Row + Drivers */}
              <div className="bg-gray-800/20 rounded-lg p-4" data-testid="pulse-container">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={14} className="text-purple-400" />
                  <h4 className="text-sm font-medium text-white">3W Pulse</h4>
                  <span className="text-xs text-gray-500">Rolling Trend</span>
                </div>
                
                {weekSeriesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-24 bg-gray-800/50" />
                    <Skeleton className="h-4 w-32 bg-gray-800/50" />
                  </div>
                ) : (() => {
                  const weeks = weekSeriesData?.data?.weeks || [];
                  const position = player.position;
                  
                  // Get non-missing weeks up to currentWeek (use same fallback logic as Trend Deltas)
                  const selectedWeekData = weeks.find(w => w.week === effectiveWeek && !w.missing);
                  let pulseCurrentWeek = effectiveWeek;
                  let usingPulseFallback = false;
                  
                  if (!selectedWeekData) {
                    const availableBeforeSelected = weeks.filter(w => w.week <= effectiveWeek && !w.missing);
                    if (availableBeforeSelected.length > 0) {
                      pulseCurrentWeek = availableBeforeSelected[availableBeforeSelected.length - 1].week;
                      usingPulseFallback = true;
                    }
                  }
                  
                  const usableWeeks = weeks
                    .filter(w => !w.missing && w.week <= pulseCurrentWeek)
                    .sort((a, b) => b.week - a.week); // descending by week
                  
                  // WindowA = last 3 usable weeks, WindowB = 3 before that
                  const windowA = usableWeeks.slice(0, 3);
                  const windowB = usableWeeks.slice(3, 6);
                  
                  const fallbackNote = usingPulseFallback ? `(Wk${effectiveWeek} missing, using Wk${pulseCurrentWeek})` : '';
                  
                  if (windowA.length < 3 || windowB.length < 3) {
                    return (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-500 text-xs py-1" title="Need at least 6 non-missing weeks for pulse calculation">
                          <span className="text-sm font-semibold">—</span>
                          <span>Not enough weeks</span>
                        </div>
                        <div className="text-[10px] text-gray-600 font-mono" title="Need at least 6 non-missing weeks">
                          Drivers: —
                        </div>
                      </div>
                    );
                  }
                  
                  // Helper: compute mean of non-null values
                  const mean = (values: (number | null)[]): number | null => {
                    const valid = values.filter((v): v is number => v !== null);
                    if (valid.length < 2) return null; // require at least 2 values
                    return valid.reduce((a, b) => a + b, 0) / valid.length;
                  };
                  
                  // Helper: check if metric is usable (at least 4 of 6 values non-null)
                  const isMetricUsable = (valuesA: (number | null)[], valuesB: (number | null)[]): boolean => {
                    const all = [...valuesA, ...valuesB];
                    const nonNull = all.filter(v => v !== null).length;
                    return nonNull >= 4;
                  };
                  
                  // Extract metric arrays
                  const targetsA = windowA.map(w => w.targets);
                  const targetsB = windowB.map(w => w.targets);
                  const routesA = windowA.map(w => w.routes);
                  const routesB = windowB.map(w => w.routes);
                  const carriesA = windowA.map(w => w.carries);
                  const carriesB = windowB.map(w => w.carries);
                  const snapPctA = windowA.map(w => w.snapPct);
                  const snapPctB = windowB.map(w => w.snapPct);
                  const airYardsA = windowA.map(w => w.airYards);
                  const airYardsB = windowB.map(w => w.airYards);
                  
                  // Weights by metric
                  const weights = {
                    targets: 1.0,
                    routes: 0.6,
                    carries: 0.8,
                    snapPct: 0.05,
                    airYards: 0.04,
                  };
                  
                  // Build pulse components based on position (with contribution)
                  const components: { name: string; delta: number; weight: number; contribution: number }[] = [];
                  
                  // Targets (all positions)
                  if (isMetricUsable(targetsA, targetsB)) {
                    const avgA = mean(targetsA);
                    const avgB = mean(targetsB);
                    if (avgA !== null && avgB !== null) {
                      const delta = avgA - avgB;
                      components.push({ name: 'Targets', delta, weight: weights.targets, contribution: delta * weights.targets });
                    }
                  }
                  
                  // Routes (WR/TE only)
                  if ((position === 'WR' || position === 'TE') && isMetricUsable(routesA, routesB)) {
                    const avgA = mean(routesA);
                    const avgB = mean(routesB);
                    if (avgA !== null && avgB !== null) {
                      const delta = avgA - avgB;
                      components.push({ name: 'Routes', delta, weight: weights.routes, contribution: delta * weights.routes });
                    }
                  }
                  
                  // Carries (RB/QB only)
                  if ((position === 'RB' || position === 'QB') && isMetricUsable(carriesA, carriesB)) {
                    const avgA = mean(carriesA);
                    const avgB = mean(carriesB);
                    if (avgA !== null && avgB !== null) {
                      const delta = avgA - avgB;
                      components.push({ name: 'Carries', delta, weight: weights.carries, contribution: delta * weights.carries });
                    }
                  }
                  
                  // AirYards (WR/TE bonus)
                  if ((position === 'WR' || position === 'TE') && isMetricUsable(airYardsA, airYardsB)) {
                    const avgA = mean(airYardsA);
                    const avgB = mean(airYardsB);
                    if (avgA !== null && avgB !== null) {
                      const delta = avgA - avgB;
                      components.push({ name: 'AirYards', delta, weight: weights.airYards, contribution: delta * weights.airYards });
                    }
                  }
                  
                  // SnapPct (if consistently present)
                  if (isMetricUsable(snapPctA, snapPctB)) {
                    const avgA = mean(snapPctA);
                    const avgB = mean(snapPctB);
                    if (avgA !== null && avgB !== null) {
                      const delta = avgA - avgB;
                      components.push({ name: 'Snap%', delta, weight: weights.snapPct, contribution: delta * weights.snapPct });
                    }
                  }
                  
                  if (components.length === 0) {
                    return (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-500 text-xs py-1" title="Not enough metric data">
                          <span className="text-sm font-semibold">—</span>
                          <span>Insufficient data</span>
                        </div>
                        <div className="text-[10px] text-gray-600 font-mono" title="Not enough metric data">
                          Drivers: —
                        </div>
                      </div>
                    );
                  }
                  
                  // Compute composite pulse score
                  const pulseScore = components.reduce((sum, c) => sum + c.contribution, 0);
                  
                  // Classification
                  let pulseLabel: string;
                  let pulseColor: string;
                  let pulseIcon: JSX.Element;
                  
                  if (pulseScore >= 1.0) {
                    pulseLabel = 'Up';
                    pulseColor = 'text-green-400';
                    pulseIcon = <TrendingUp size={14} className="text-green-400" />;
                  } else if (pulseScore <= -1.0) {
                    pulseLabel = 'Down';
                    pulseColor = 'text-red-400';
                    pulseIcon = <TrendingDown size={14} className="text-red-400" />;
                  } else {
                    pulseLabel = 'Flat';
                    pulseColor = 'text-gray-400';
                    pulseIcon = <span className="text-gray-400 text-sm">→</span>;
                  }
                  
                  // Build pulse tooltip
                  const windowAWeeks = windowA.map(w => w.week).join(', ');
                  const windowBWeeks = windowB.map(w => w.week).join(', ');
                  const componentDetails = components.map(c => {
                    const sign = c.delta >= 0 ? '+' : '';
                    return `${c.name}: ${sign}${c.delta.toFixed(1)}`;
                  }).join(' | ');
                  const pulseTooltip = `WindowA: Wk${windowAWeeks} vs WindowB: Wk${windowBWeeks}\n${componentDetails}\nScore: ${pulseScore.toFixed(2)}${fallbackNote ? '\n' + fallbackNote : ''}`;
                  
                  // === DRIVERS SELECTION ===
                  // Sort by absolute contribution descending
                  const sortedByContrib = [...components].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
                  
                  // Take top 2, optionally top 3 if third is >= 50% of second
                  const drivers: typeof components = [];
                  if (sortedByContrib.length >= 1) drivers.push(sortedByContrib[0]);
                  if (sortedByContrib.length >= 2) drivers.push(sortedByContrib[1]);
                  if (sortedByContrib.length >= 3) {
                    const thirdAbs = Math.abs(sortedByContrib[2].contribution);
                    const secondAbs = Math.abs(sortedByContrib[1].contribution);
                    if (secondAbs > 0 && thirdAbs >= 0.5 * secondAbs) {
                      drivers.push(sortedByContrib[2]);
                    }
                  }
                  
                  // Build drivers display
                  const getDriverArrow = (delta: number) => {
                    if (delta > 0) return { arrow: '↑', color: 'text-green-400' };
                    if (delta < 0) return { arrow: '↓', color: 'text-red-400' };
                    return { arrow: '→', color: 'text-gray-400' };
                  };
                  
                  // Build drivers tooltip
                  const driversTooltipLines = drivers.map(d => {
                    const sign = d.delta >= 0 ? '+' : '';
                    const contribSign = d.contribution >= 0 ? '+' : '';
                    return `${d.name}: Δ ${sign}${d.delta.toFixed(1)} (w=${d.weight}, contrib=${contribSign}${d.contribution.toFixed(2)})`;
                  });
                  if (fallbackNote) driversTooltipLines.push(fallbackNote);
                  const driversTooltip = driversTooltipLines.join('\n');
                  
                  return (
                    <div className="space-y-2">
                      {/* Pulse Indicator Row */}
                      <div 
                        className="flex items-center gap-2" 
                        title={pulseTooltip}
                        data-testid="pulse-indicator"
                      >
                        {pulseIcon}
                        <span className={`text-sm font-semibold ${pulseColor}`}>{pulseLabel}</span>
                        <span className="text-[10px] text-gray-600 ml-2">
                          Wk{windowA[windowA.length - 1].week}-{windowA[0].week} vs Wk{windowB[windowB.length - 1].week}-{windowB[0].week}
                        </span>
                      </div>
                      
                      {/* Drivers Row */}
                      <div 
                        className="text-[10px] text-gray-500 font-mono flex items-center gap-1 flex-wrap"
                        title={driversTooltip}
                        data-testid="pulse-drivers"
                      >
                        <span className="text-gray-600">Drivers:</span>
                        {drivers.map((d, idx) => {
                          const { arrow, color } = getDriverArrow(d.delta);
                          return (
                            <span key={d.name} className="flex items-center">
                              {idx > 0 && <span className="text-gray-700 mx-0.5">,</span>}
                              <span className="text-gray-400">{d.name}</span>
                              <span className={`ml-0.5 ${color}`}>{arrow}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
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
                        <div
                          key={p.playerId}
                          className="flex items-center gap-1 p-2 rounded bg-gray-800/30 hover:bg-gray-800/60 transition-colors group"
                        >
                          <button
                            onClick={() => navigate(`/player/${p.playerId}?season=${season}&week=${effectiveWeek}`)}
                            className="flex-1 text-left"
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompareTarget({
                                playerId: p.playerId,
                                playerName: p.playerName || 'Unknown',
                                position: p.position || player.position,
                                team: p.team || 'FA',
                              });
                            }}
                            className="p-1 rounded hover:bg-purple-500/20 text-gray-500 hover:text-purple-400 transition-colors"
                            title="Compare players"
                            data-testid={`compare-similar-${p.playerId}`}
                          >
                            <Scale size={12} />
                          </button>
                        </div>
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
                        <div
                          key={p.playerId}
                          className="flex items-center gap-1 p-2 rounded bg-gray-800/30 hover:bg-gray-800/60 transition-colors group"
                        >
                          <button
                            onClick={() => navigate(`/player/${p.playerId}?season=${season}&week=${effectiveWeek}&mode=${mode}`)}
                            className="flex-1 flex items-center justify-between text-left"
                            data-testid={`neighbor-above-${p.playerId}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <TrendingUp size={12} className="text-green-400" />
                              <span className="text-sm text-white group-hover:text-purple-300">{p.playerName}</span>
                            </div>
                            <span className="text-[10px] text-cyan-400 font-mono">{p.alpha.toFixed(0)}</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompareTarget({
                                playerId: p.playerId,
                                playerName: p.playerName,
                                position: p.position,
                                team: p.team,
                              });
                            }}
                            className="p-1 rounded hover:bg-purple-500/20 text-gray-500 hover:text-purple-400 transition-colors"
                            title="Compare players"
                            data-testid={`compare-above-${p.playerId}`}
                          >
                            <Scale size={12} />
                          </button>
                        </div>
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
                        <div
                          key={p.playerId}
                          className="flex items-center gap-1 p-2 rounded bg-gray-800/30 hover:bg-gray-800/60 transition-colors group"
                        >
                          <button
                            onClick={() => navigate(`/player/${p.playerId}?season=${season}&week=${effectiveWeek}&mode=${mode}`)}
                            className="flex-1 flex items-center justify-between text-left"
                            data-testid={`neighbor-below-${p.playerId}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <TrendingDown size={12} className="text-orange-400" />
                              <span className="text-sm text-white group-hover:text-purple-300">{p.playerName}</span>
                            </div>
                            <span className="text-[10px] text-cyan-400 font-mono">{p.alpha.toFixed(0)}</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompareTarget({
                                playerId: p.playerId,
                                playerName: p.playerName,
                                position: p.position,
                                team: p.team,
                              });
                            }}
                            className="p-1 rounded hover:bg-purple-500/20 text-gray-500 hover:text-purple-400 transition-colors"
                            title="Compare players"
                            data-testid={`compare-below-${p.playerId}`}
                          >
                            <Scale size={12} />
                          </button>
                        </div>
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

      {/* COMPARE DRAWER */}
      <Sheet open={!!compareTarget} onOpenChange={(open) => !open && setCompareTarget(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg bg-[#0a0e1a] border-l border-gray-800/50 p-0">
          <div className="h-full overflow-y-auto">
            <SheetHeader className="sticky top-0 bg-[#0a0e1a]/95 backdrop-blur-sm border-b border-gray-800/50 p-4 z-10">
              <div className="flex items-center gap-3">
                <Scale size={18} className="text-purple-400" />
                <SheetTitle className="text-white text-lg font-semibold">Compare Players</SheetTitle>
              </div>
            </SheetHeader>

            {compareTarget && (
              <CompareDrawerContent
                basePlayer={{ playerId, name: player.fullName, team: player.nflTeam || 'FA', position: player.position }}
                comparePlayer={compareTarget}
                season={season}
                week={effectiveWeek}
                mode={mode}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

interface CompareDrawerContentProps {
  basePlayer: { playerId: string; name: string; team: string; position: string };
  comparePlayer: CompareTarget;
  season: number;
  week: number;
  mode: 'weekly' | 'season';
}

interface ForgeEgResponse {
  success: boolean;
  score?: {
    alpha: number;
    tier: string;
    pillars: {
      volume: number;
      efficiency: number;
      teamContext: number;
      stability: number;
    };
  };
  reason?: string;
}

interface CompareWeekSeriesResponse {
  success: boolean;
  data?: {
    weeks: Array<{
      week: number;
      missing: boolean;
      snapPct: number | null;
      routes: number | null;
      targets: number | null;
      carries: number | null;
      airYards: number | null;
    }>;
  };
}

function CompareDrawerContent({ basePlayer, comparePlayer, season, week, mode }: CompareDrawerContentProps) {
  const forgeMode = mode === 'season' ? 'dynasty' : 'redraft';
  const [showTrends, setShowTrends] = useState(true);

  const { data: baseForge, isLoading: baseLoading } = useQuery<ForgeEgResponse>({
    queryKey: ['/api/forge/eg/player', basePlayer.playerId, basePlayer.position, forgeMode],
    queryFn: async () => {
      const res = await fetch(`/api/forge/eg/player/${basePlayer.playerId}?position=${basePlayer.position}&mode=${forgeMode}`);
      if (!res.ok) return { success: false, reason: 'Failed to load' };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: compareForge, isLoading: compareLoading } = useQuery<ForgeEgResponse>({
    queryKey: ['/api/forge/eg/player', comparePlayer.playerId, comparePlayer.position, forgeMode],
    queryFn: async () => {
      const res = await fetch(`/api/forge/eg/player/${comparePlayer.playerId}?position=${comparePlayer.position}&mode=${forgeMode}`);
      if (!res.ok) return { success: false, reason: 'Failed to load' };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: baseWeekSeries, isLoading: baseWeeksLoading } = useQuery<CompareWeekSeriesResponse>({
    queryKey: ['/api/player-identity/player', basePlayer.playerId, 'week-series', season],
    queryFn: async () => {
      const res = await fetch(`/api/player-identity/player/${basePlayer.playerId}/week-series?season=${season}&metricSet=usage`);
      if (!res.ok) return { success: false };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: compareWeekSeries, isLoading: compareWeeksLoading } = useQuery<CompareWeekSeriesResponse>({
    queryKey: ['/api/player-identity/player', comparePlayer.playerId, 'week-series', season],
    queryFn: async () => {
      const res = await fetch(`/api/player-identity/player/${comparePlayer.playerId}/week-series?season=${season}&metricSet=usage`);
      if (!res.ok) return { success: false };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = baseLoading || compareLoading;

  const metrics = [
    { key: 'alpha', label: 'Alpha Score', format: (v: number) => v.toFixed(0) },
    { key: 'volume', label: 'Volume', format: (v: number) => v.toFixed(0), pillar: true },
    { key: 'efficiency', label: 'Efficiency', format: (v: number) => v.toFixed(0), pillar: true },
    { key: 'teamContext', label: 'Team Context', format: (v: number) => v.toFixed(0), pillar: true },
    { key: 'stability', label: 'Stability', format: (v: number) => v.toFixed(0), pillar: true },
  ];

  const getValue = (data: ForgeEgResponse | undefined, key: string, isPillar: boolean) => {
    if (!data?.success || !data.score) return null;
    if (isPillar) return (data.score.pillars as Record<string, number>)[key] ?? null;
    if (key === 'alpha') return data.score.alpha;
    return null;
  };

  const getDiff = (base: number | null, comp: number | null) => {
    if (base === null || comp === null) return null;
    return base - comp;
  };

  return (
    <div className="p-4 space-y-4">
      {/* Player Headers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Base Player</p>
          <p className="text-sm font-semibold text-white">{basePlayer.name}</p>
          <p className="text-[10px] text-gray-500">{basePlayer.team} · {basePlayer.position}</p>
        </div>
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Compare To</p>
          <p className="text-sm font-semibold text-white">{comparePlayer.playerName}</p>
          <p className="text-[10px] text-gray-500">{comparePlayer.team} · {comparePlayer.position}</p>
        </div>
      </div>

      {/* Tier Comparison */}
      {!isLoading && baseForge?.score && compareForge?.score && (
        <div className="flex justify-center gap-8 py-2 border-y border-gray-800/50">
          <div className="text-center">
            <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
              {baseForge.score.tier}
            </Badge>
          </div>
          <div className="text-xs text-gray-500 self-center">vs</div>
          <div className="text-center">
            <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
              {compareForge.score.tier}
            </Badge>
          </div>
        </div>
      )}

      {/* Metrics Table */}
      <div className="bg-[#141824] rounded-lg overflow-hidden border border-gray-800/50">
        <div className="grid grid-cols-4 text-xs font-medium text-gray-400 bg-gray-800/30 p-2">
          <div>Metric</div>
          <div className="text-center text-purple-400">{basePlayer.name.split(' ')[1] || 'Base'}</div>
          <div className="text-center text-cyan-400">{comparePlayer.playerName.split(' ')[1] || 'Comp'}</div>
          <div className="text-center">Diff</div>
        </div>
        
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full bg-gray-800/50" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-800/30">
            {metrics.map(({ key, label, format, pillar }) => {
              const baseVal = getValue(baseForge, key, !!pillar);
              const compVal = getValue(compareForge, key, !!pillar);
              const diff = getDiff(baseVal, compVal);

              return (
                <div key={key} className="grid grid-cols-4 text-sm p-2 items-center">
                  <div className="text-gray-400 text-xs">{label}</div>
                  <div className="text-center text-white font-mono">
                    {baseVal !== null ? format(baseVal) : '-'}
                  </div>
                  <div className="text-center text-white font-mono">
                    {compVal !== null ? format(compVal) : '-'}
                  </div>
                  <div className={`text-center font-mono text-xs ${
                    diff === null ? 'text-gray-500' : diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {diff !== null ? (diff > 0 ? '+' : '') + diff.toFixed(0) : '-'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trends Section */}
      <div className="bg-[#141824] rounded-lg overflow-hidden border border-gray-800/50">
        <button
          onClick={() => setShowTrends(!showTrends)}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-800/20 transition-colors"
          data-testid="button-toggle-trends"
        >
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-purple-400" />
            <span className="text-sm font-medium text-white">Trends</span>
            <span className="text-xs text-gray-500">3W Pulse + Deltas</span>
          </div>
          {showTrends ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>
        
        {showTrends && (
          <div className="px-3 pb-3 space-y-3">
            {(baseWeeksLoading || compareWeeksLoading) ? (
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-20 w-full bg-gray-800/50" />
                <Skeleton className="h-20 w-full bg-gray-800/50" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { player: basePlayer, weeks: baseWeekSeries?.data?.weeks || [], color: 'purple' },
                  { player: { playerId: comparePlayer.playerId, name: comparePlayer.playerName, position: comparePlayer.position, team: comparePlayer.team }, weeks: compareWeekSeries?.data?.weeks || [], color: 'cyan' }
                ].map(({ player, weeks, color }) => {
                  const weekData = weeks as WeekData[];
                  const pulse = computePulse(weekData, player.position, week);
                  const deltas = computeTrendDeltas(weekData, player.position, week);
                  const drivers = pulse.status === 'success' ? getTopDrivers(pulse.components) : [];
                  
                  const pulseTooltip = pulse.status === 'success'
                    ? `${formatWeekRange(pulse.windowAWeeks)} vs ${formatWeekRange(pulse.windowBWeeks)}\nScore: ${pulse.pulseScore.toFixed(2)}${pulse.fallbackNote ? '\n' + pulse.fallbackNote : ''}`
                    : pulse.status === 'not_enough_weeks' ? 'Need 6+ non-missing weeks' : 'Insufficient metric data';
                  
                  const driversTooltip = drivers.map(d => {
                    const sign = d.delta >= 0 ? '+' : '';
                    return `${d.name}: Δ ${sign}${d.delta.toFixed(1)} (contrib=${d.contribution >= 0 ? '+' : ''}${d.contribution.toFixed(2)})`;
                  }).join('\n') + (pulse.fallbackNote ? '\n' + pulse.fallbackNote : '');
                  
                  const borderColor = color === 'purple' ? 'border-purple-500/30' : 'border-cyan-500/30';
                  const bgColor = color === 'purple' ? 'bg-purple-500/5' : 'bg-cyan-500/5';
                  
                  return (
                    <div key={player.playerId} className={`${bgColor} ${borderColor} border rounded-lg p-2 space-y-2`}>
                      <div className="text-[10px] text-gray-400 text-center truncate">{player.name.split(' ')[1] || player.name}</div>
                      
                      {/* Pulse */}
                      <div className="text-center" title={pulseTooltip}>
                        {pulse.status === 'success' ? (
                          <div className="flex items-center justify-center gap-1">
                            {pulse.classification === 'Up' && <TrendingUp size={12} className="text-green-400" />}
                            {pulse.classification === 'Down' && <TrendingDown size={12} className="text-red-400" />}
                            {pulse.classification === 'Flat' && <span className="text-gray-400 text-xs">→</span>}
                            <span className={`text-xs font-semibold ${getPulseColor(pulse.classification)}`}>{pulse.classification}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </div>
                      
                      {/* Drivers */}
                      {drivers.length > 0 && (
                        <div className="text-[9px] text-gray-500 text-center font-mono" title={driversTooltip}>
                          {drivers.map((d, idx) => {
                            const { arrow, color: arrowColor } = getDeltaArrow(d.delta);
                            return (
                              <span key={d.name}>
                                {idx > 0 && ', '}
                                <span className="text-gray-400">{d.name}</span>
                                <span className={arrowColor}>{arrow}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Trend Deltas */}
                      {deltas.status === 'success' && deltas.priorWeek && (
                        <div className="text-[9px] text-gray-600 text-center" title={`Wk${deltas.priorWeek} → Wk${deltas.currentWeek}${deltas.fallbackNote ? '\n' + deltas.fallbackNote : ''}`}>
                          {deltas.deltas.slice(0, 3).map((d, idx) => {
                            const { color: deltaColor } = getDeltaArrow(d.value);
                            return (
                              <span key={d.metric}>
                                {idx > 0 && ' · '}
                                <span className="text-gray-500">{d.metric === 'Snap%' ? 'Sn' : d.metric.slice(0, 3)}</span>
                                <span className={deltaColor}>{d.display}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Note */}
      <p className="text-[10px] text-gray-600 text-center">
        {forgeMode.charAt(0).toUpperCase() + forgeMode.slice(1)} mode • Season {season}
      </p>
    </div>
  );
}
