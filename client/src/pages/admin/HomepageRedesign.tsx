import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  ChevronLeft, Search, LayoutDashboard, BarChart3, Calendar, FlaskConical, 
  FileText, ArrowLeftRight, BookOpen, Plus, Send, User, Loader2, Lightbulb, 
  GraduationCap, MessageSquarePlus, TrendingUp, TrendingDown, AlertTriangle, X,
  MessageCircle, ChevronDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import EnhancedPlayerCard from '@/components/EnhancedPlayerCard';
import PlaybookTab from '@/components/tabs/PlaybookTab';

type Feature = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  href?: string;
};

interface League {
  id: string;
  userId: string;
  leagueName: string;
  platform: string | null;
  leagueIdExternal: string | null;
  settings: {
    scoring?: string;
    teams?: number;
  };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ForgePlayer {
  playerId: string;
  playerName: string;
  position: string;
  nflTeam: string;
  alpha: number;
  alphaBase?: number;
  tier?: string;
}

interface StartSitPlayer {
  playerName: string;
  position: string;
  team: string;
  opponent?: string;
  confidence: number;
  reason: string;
}

interface WeeklyTake {
  player: string;
  insight: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
}

interface PlayerSearchResult {
  canonicalId: string;
  fullName: string;
  position: string;
  nflTeam: string;
  confidence: number;
  matchReason: string;
}

interface SearchResponse {
  success: boolean;
  data: {
    results: PlayerSearchResult[];
    totalFound: number;
  };
}

interface HomepageRedesignProps {
  isPreview?: boolean;
}

export default function HomepageRedesign({ isPreview = false }: HomepageRedesignProps) {
  const [, navigate] = useLocation();
  const [activeFeature, setActiveFeature] = useState('dashboard');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMode, setChatMode] = useState<'insight' | 'analyst'>('insight');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Player search and modal state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<PlayerSearchResult | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  
  // Mobile state
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isNavExpanded, setIsNavExpanded] = useState(false);

  const features: Feature[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tiers', label: 'Tiber Tiers', icon: BarChart3, href: '/tiers' },
    { id: 'schedule', label: 'Schedule', icon: Calendar, href: '/schedule' },
    { id: 'datalab', label: 'Data Lab', icon: FlaskConical, href: '/tiber-data-lab' },
    { id: 'waiver', label: 'Waiver Wire', icon: FileText },
    { id: 'trades', label: 'Trade Hub', icon: ArrowLeftRight },
    { id: 'playbook', label: 'Playbook', icon: BookOpen },
  ];

  // Fetch real leagues
  const { data: leaguesData } = useQuery({
    queryKey: ['/api/leagues'],
    queryFn: async () => {
      const response = await fetch('/api/leagues?user_id=default_user');
      return response.json();
    },
  });

  const leagues: League[] = leaguesData?.leagues || [];

  // Fetch FORGE batch scores for movers widget
  const { data: forgeData, isLoading: forgeLoading } = useQuery({
    queryKey: ['/api/forge/batch'],
    queryFn: async () => {
      const response = await fetch('/api/forge/batch?limit=20');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch opportunity shifts (Next Man Up) for injured players
  const { data: opportunityData } = useQuery({
    queryKey: ['/api/forge/opportunity-shifts'],
    queryFn: async () => {
      const response = await fetch('/api/forge/opportunity-shifts');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const opportunityShifts = opportunityData?.shifts || [];

  // Fetch Sleeper trending players
  const { data: trendingData } = useQuery({
    queryKey: ['/api/sleeper/trending/add'],
    queryFn: async () => {
      const response = await fetch('/api/sleeper/trending/add?hours=24&limit=50');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch current NFL week from system endpoint
  const { data: weekData, isLoading: weekLoading } = useQuery({
    queryKey: ['/api/system/current-week'],
    queryFn: async () => {
      const response = await fetch('/api/system/current-week');
      return response.json();
    },
    staleTime: 60 * 1000, // Refresh every minute
  });

  // Get the week to use for matchup-based features (only valid after weekData loads)
  const currentWeek = weekData?.upcomingWeek || weekData?.currentWeek || 0;
  const hasValidWeek = !!weekData && currentWeek > 0;

  // Fetch strategy start/sit recommendations using dynamic week (wait for week data)
  const { data: startSitData, isLoading: startSitLoading } = useQuery({
    queryKey: ['/api/strategy/start-sit', currentWeek],
    queryFn: async () => {
      const response = await fetch(`/api/strategy/start-sit?week=${currentWeek}&season=2025`);
      return response.json();
    },
    enabled: hasValidWeek && !weekLoading,
    staleTime: 10 * 60 * 1000,
  });

  // Fetch weekly takes for insights using dynamic week (wait for week data)
  const { data: weeklyTakesData, isLoading: takesLoading } = useQuery({
    queryKey: ['/api/weekly-takes', currentWeek],
    queryFn: async () => {
      const response = await fetch(`/api/weekly-takes?week=${currentWeek}`);
      return response.json();
    },
    enabled: hasValidWeek && !weekLoading,
    staleTime: 10 * 60 * 1000,
  });

  // Player search query with autocomplete
  const { data: searchResults, isLoading: searchLoading } = useQuery<SearchResponse>({
    queryKey: ['/api/player-identity/search', searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ name: searchQuery, limit: '5' });
      const res = await fetch(`/api/player-identity/search?${params}`);
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: searchQuery.length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  const searchPlayers = searchResults?.data?.results || [];

  // Combine FORGE scores with trending data for movers
  const forgeMovers = (() => {
    const scores = forgeData?.scores || [];
    const trending = trendingData?.data || [];
    
    // Create a map of trending player_ids to their count
    const trendingMap = new Map<string, number>();
    trending.forEach((p: { player_id: string; count: number }) => {
      trendingMap.set(p.player_id, p.count || 0);
    });

    // Mark players as risers/fallers based on alpha tier
    return scores.slice(0, 6).map((player: ForgePlayer) => ({
      ...player,
      trendCount: trendingMap.get(player.playerId) || 0,
      direction: player.alpha >= 75 ? 'up' as const : player.alpha < 50 ? 'down' as const : 'neutral' as const,
    }));
  })();

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('tiber_chat_session');
    const savedLeagueId = localStorage.getItem('tiber_chat_league');
    const savedMessages = localStorage.getItem('tiber_chat_messages');
    
    if (savedSession) setSessionId(savedSession);
    if (savedLeagueId) setSelectedLeagueId(savedLeagueId);
    
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }
  }, []);

  // Auto-select first league when leagues load and none is selected, then show contextual welcome
  useEffect(() => {
    if (leagues.length > 0 && messages.length === 0) {
      const savedLeagueId = localStorage.getItem('tiber_chat_league');
      const leagueToUse = savedLeagueId && leagues.find(l => l.id === savedLeagueId) 
        ? savedLeagueId 
        : leagues[0].id;
      
      setSelectedLeagueId(leagueToUse);
      localStorage.setItem('tiber_chat_league', leagueToUse);
      
      const league = leagues.find(l => l.id === leagueToUse);
      showWelcomeMessage(league?.leagueName);
    } else if (leagues.length === 0 && messages.length === 0) {
      // No leagues yet, show generic welcome after a brief delay
      const timer = setTimeout(() => {
        if (messages.length === 0) {
          showWelcomeMessage();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [leagues, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 1) {
      localStorage.setItem('tiber_chat_messages', JSON.stringify(messages));
    }
  }, [messages]);

  // Close search dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.length >= 2) {
      setIsSearchOpen(true);
    } else {
      setIsSearchOpen(false);
    }
  };

  const handleSelectSearchResult = (player: PlayerSearchResult) => {
    setSelectedPlayerForModal(player);
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const handleClosePlayerModal = () => {
    setSelectedPlayerForModal(null);
  };

  const showWelcomeMessage = (leagueName?: string) => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: leagueName 
        ? `Hey! I see you're managing **${leagueName}** this week. A few things on my radar: injury updates and some interesting waiver targets. What do you want to dig into?`
        : "Hey, welcome to TIBER. I'm here to help with player analysis, start/sit decisions, and trade evaluations. What can I help you with?",
      timestamp: new Date(),
    }]);
  };

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/tiber/chat', {
        message,
        chatMode,
        session_id: sessionId,
        league_id: selectedLeagueId,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      const respSessionId = data.session_id || data.conversationId;
      if (!sessionId && respSessionId) {
        setSessionId(respSessionId);
        localStorage.setItem('tiber_chat_session', respSessionId);
      }
      if (selectedLeagueId) {
        localStorage.setItem('tiber_chat_league', selectedLeagueId);
      }

      const content = data.reply || data.response || data.error || 'No response received.';
      setMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.error ? `Error: ${content}` : content,
        timestamp: new Date(),
      }]);
    },
    onError: (error) => {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to get response'}. Please try again.`,
        timestamp: new Date(),
      }]);
    },
  });

  const handleSend = () => {
    if (!chatMessage.trim() || chatMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: chatMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(chatMessage);
    setChatMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    localStorage.removeItem('tiber_chat_session');
    localStorage.removeItem('tiber_chat_messages');
    setSessionId(null);
    const leagueName = selectedLeagueId 
      ? leagues.find(l => l.id === selectedLeagueId)?.leagueName 
      : undefined;
    showWelcomeMessage(leagueName);
  };

  const handleLeagueChange = (leagueId: string) => {
    const normalizedId = leagueId || null;
    setSelectedLeagueId(normalizedId);
    if (normalizedId) {
      localStorage.setItem('tiber_chat_league', normalizedId);
    } else {
      localStorage.removeItem('tiber_chat_league');
    }
    localStorage.removeItem('tiber_chat_session');
    localStorage.removeItem('tiber_chat_messages');
    setSessionId(null);
    const league = normalizedId ? leagues.find(l => l.id === normalizedId) : undefined;
    showWelcomeMessage(league?.leagueName);
  };

  const handleFeatureClick = (feature: Feature) => {
    if (feature.href) {
      navigate(feature.href);
    } else {
      setActiveFeature(feature.id);
    }
  };

  const handleQuickAction = (action: string) => {
    setChatMessage(action);
    setTimeout(() => handleSend(), 100);
  };

  const handlePlayerClick = async (playerName: string, position?: string, team?: string) => {
    // Search for the player to get their canonical ID and open the modal
    try {
      const params = new URLSearchParams({ name: playerName, limit: '1' });
      const res = await fetch(`/api/player-identity/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.data?.results?.length > 0) {
          const player = data.data.results[0];
          setSelectedPlayerForModal({
            canonicalId: player.canonicalId,
            fullName: player.fullName,
            position: position || player.position,
            nflTeam: team || player.nflTeam,
            confidence: player.confidence,
            matchReason: player.matchReason,
          });
          return;
        }
      }
    } catch (error) {
      console.error('Failed to search for player:', error);
    }
    
    // Fallback: Create a minimal player object for the modal
    setSelectedPlayerForModal({
      canonicalId: playerName.toLowerCase().replace(/\s+/g, '_'),
      fullName: playerName,
      position: position || '??',
      nflTeam: team || '???',
      confidence: 0,
      matchReason: 'name_match',
    });
  };

  // Quick insights from weekly takes API - structure is { qb: [], rb: [], wr: [], te: [] }
  // Each take has { player: string, insight: string, position: 'QB'|'RB'|'WR'|'TE' }
  const quickInsights = (() => {
    const takesData = weeklyTakesData?.data?.takes;
    if (!takesData || takesLoading) {
      return [
        { type: 'loading', title: 'Loading', content: 'Fetching weekly insights...', urgency: 'low' as const },
      ];
    }
    
    // Flatten the position-grouped takes into a single array (already have position from API)
    const allTakes: WeeklyTake[] = [
      ...(takesData.qb || []),
      ...(takesData.rb || []),
      ...(takesData.wr || []),
      ...(takesData.te || []),
    ];
    
    if (allTakes.length === 0) {
      // Show helpful fallback content when no takes are available
      return [
        { type: 'info', title: 'Week 1 Preview', content: 'Season starting soon - check back for matchup insights', urgency: 'low' as const },
        { type: 'trend', title: 'FORGE Active', content: 'Player scoring engine is live and processing data', urgency: 'medium' as const },
      ];
    }
    
    // Map real takes to display format using correct API properties
    return allTakes.slice(0, 3).map((take: WeeklyTake) => ({
      type: 'matchup',
      title: `${take.position}: ${take.player}`,
      content: take.insight,
      urgency: take.position === 'QB' ? 'high' as const : take.position === 'RB' ? 'medium' as const : 'low' as const,
    }));
  })();

  // FORGE movers from batch API
  const trendingPlayers = forgeMovers.map((player: any) => ({
    name: player.playerName || 'Unknown',
    team: player.nflTeam || '???',
    position: player.position || '??',
    change: player.alpha >= 75 ? `+${player.alpha.toFixed(1)}` : player.alpha < 50 ? `${player.alpha.toFixed(1)}` : player.alpha.toFixed(1),
    direction: player.direction,
    alpha: player.alpha,
  }));

  const quickActions = ['Analyze my matchup', 'Waiver targets', 'Start/Sit help', 'Trade value check'];

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-amber-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const selectedLeague = leagues.find(l => l.id === selectedLeagueId);

  return (
    <div className="min-h-screen flex flex-col font-sans text-zinc-200" style={{ 
      background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0d14 50%, #0f0a14 100%)'
    }}>
      
      {/* Admin Notice Banner - Only shown in preview mode */}
      {isPreview && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2">
          <div className="flex items-center justify-between max-w-full">
            <div className="flex items-center gap-3">
              <Link href="/admin/forge-hub">
                <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10" data-testid="button-back-hub">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back to Hub
                </Button>
              </Link>
              <span className="text-amber-400 text-sm font-medium">Homepage Redesign Preview (Live Data)</span>
            </div>
            <span className="text-amber-400/60 text-xs">Admin Only - Design Preview Mode</span>
          </div>
        </div>
      )}

      {/* ===== TOP HEADER BAR ===== */}
      <header className="flex items-center justify-between px-3 md:px-6 py-3 border-b border-purple-500/15 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        {/* Logo & Brand */}
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center font-bold text-white text-sm md:text-base">
            T
          </div>
          <span className="font-bold text-base md:text-lg bg-gradient-to-r from-purple-500 to-cyan-500 bg-clip-text text-transparent hidden sm:inline">
            TIBER
          </span>
        </div>

        {/* League Selector - Real Data */}
        <div className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 bg-purple-500/10 rounded-lg border border-purple-500/20 cursor-pointer max-w-[140px] md:max-w-none">
          <span className="text-[10px] md:text-xs text-zinc-400 hidden sm:inline">Active:</span>
          <select 
            value={selectedLeagueId || ''}
            onChange={(e) => handleLeagueChange(e.target.value)}
            className="bg-transparent border-none text-zinc-200 text-xs md:text-sm font-semibold cursor-pointer outline-none truncate max-w-[100px] md:max-w-none"
            data-testid="select-league"
          >
            {leagues.length === 0 && (
              <option value="" className="bg-[#1a1a24]">Loading...</option>
            )}
            {leagues.map(league => (
              <option key={league.id} value={league.id} className="bg-[#1a1a24]">
                {league.leagueName} ({league.settings.teams || 12}T)
              </option>
            ))}
          </select>
        </div>

        {/* Search & Profile */}
        <div className="flex items-center gap-2 md:gap-4">
          <div className="relative" ref={searchWrapperRef}>
            <div className="flex items-center gap-2 px-2 md:px-4 py-2 bg-white/[0.03] rounded-lg border border-white/[0.08]">
              <Search className="h-4 w-4 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="bg-transparent border-none text-zinc-200 text-sm outline-none w-20 md:w-48"
                data-testid="input-player-search"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }}
                  className="text-zinc-500 hover:text-zinc-300"
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {/* Search Dropdown */}
            {isSearchOpen && searchQuery.length >= 2 && (
              <div className="absolute top-full mt-2 w-80 bg-[#1e2330] border border-gray-700 rounded-lg shadow-xl z-[60] max-h-80 overflow-y-auto">
                {searchLoading ? (
                  <div className="p-4 text-center text-zinc-400">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </div>
                ) : searchPlayers.length > 0 ? (
                  <div className="py-2">
                    {searchPlayers.map((player) => (
                      <button
                        key={player.canonicalId}
                        onClick={() => handleSelectSearchResult(player)}
                        className="w-full px-4 py-3 hover:bg-[#141824] transition-colors text-left flex items-center justify-between group"
                        data-testid={`search-result-${player.canonicalId}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-full flex items-center justify-center font-bold text-white text-sm">
                            {player.position}
                          </div>
                          <div>
                            <div className="text-zinc-100 font-medium group-hover:text-purple-400 transition-colors">
                              {player.fullName}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {player.nflTeam} • {player.position}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-zinc-400" data-testid="no-search-results">
                    No players found
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center cursor-pointer">
            <User className="h-4 w-4 text-white" />
          </div>
        </div>
      </header>

      {/* ===== HORIZONTAL FEATURE NAVIGATION ===== */}
      <nav className="flex items-center gap-1 px-3 md:px-6 py-2 md:py-3 border-b border-purple-500/10 bg-[#0a0a0f]/50 overflow-x-auto scrollbar-hide">
        {features.map(feature => {
          const Icon = feature.icon;
          const isActive = activeFeature === feature.id;
          return (
            <button
              key={feature.id}
              onClick={() => handleFeatureClick(feature)}
              className={`flex items-center gap-1 md:gap-2 px-2.5 md:px-4 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-200 border shrink-0 ${
                isActive 
                  ? 'bg-gradient-to-r from-purple-500/25 to-cyan-500/15 text-zinc-200 border-purple-500/30' 
                  : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-400 hover:bg-white/[0.02]'
              }`}
              data-testid={`nav-${feature.id}`}
            >
              <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">{feature.label}</span>
            </button>
          );
        })}
        
        {/* Add Feature Button */}
        <button className="flex items-center gap-1.5 px-2.5 md:px-3.5 py-2 md:py-2.5 rounded-lg border border-dashed border-purple-500/30 bg-transparent text-purple-500 text-xs md:text-sm cursor-pointer ml-2 shrink-0">
          <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
        </button>
      </nav>

      {/* ===== MAIN CONTENT AREA ===== */}
      <main className="flex flex-col lg:grid lg:grid-cols-[1fr_380px] flex-1 overflow-hidden relative">
        
        {/* LEFT: Dashboard / Feature Content */}
        <div className="p-3 md:p-6 overflow-y-auto flex flex-col gap-4 md:gap-5 flex-1">
          
          {/* Playbook Tab */}
          {activeFeature === 'playbook' && (
            <PlaybookTab />
          )}
          
          {/* Dashboard Content - only show when dashboard is active */}
          {activeFeature === 'dashboard' && (
          <>
          {/* Quick Insights Row */}
          <section>
            <h3 className="text-[11px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 md:mb-3">
              Quick Insights
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2 md:gap-3">
              {quickInsights.map((insight, idx) => (
                <div 
                  key={idx} 
                  className="p-3 md:p-4 rounded-xl bg-white/[0.02] border border-purple-500/15 flex flex-col gap-1.5 md:gap-2"
                  data-testid={`insight-${idx}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${getUrgencyColor(insight.urgency)}`} />
                    <span className="text-[10px] md:text-[11px] font-semibold text-zinc-400 uppercase">
                      {insight.title}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-zinc-200 leading-relaxed">
                    {insight.content}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Trending Players / FORGE Movers */}
          <section>
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <h3 className="text-[11px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                FORGE Movers
              </h3>
              <span className="text-[10px] md:text-[11px] text-zinc-500">
                Alpha Score (0-100)
              </span>
            </div>
            <div className="bg-white/[0.02] rounded-xl border border-purple-500/15 overflow-hidden">
              {forgeLoading ? (
                <div className="flex items-center justify-center py-8 text-zinc-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading FORGE data...
                </div>
              ) : trendingPlayers.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">
                  No FORGE data available
                </div>
              ) : (
                trendingPlayers.map((player: any, idx: number) => (
                  <div 
                    key={idx} 
                    className={`flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3.5 ${
                      idx < trendingPlayers.length - 1 ? 'border-b border-purple-500/10' : ''
                    }`}
                    data-testid={`mover-${idx}`}
                  >
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className={`w-7 h-7 md:w-9 md:h-9 rounded-lg flex items-center justify-center text-[10px] md:text-xs font-semibold ${
                        player.direction === 'up' 
                          ? 'bg-green-500/15 text-green-500' 
                          : player.direction === 'down' 
                            ? 'bg-red-500/15 text-red-500' 
                            : 'bg-purple-500/20 text-purple-500'
                      }`}>
                        {player.position}
                      </div>
                      <div>
                        <button 
                          onClick={() => handlePlayerClick(player.name, player.position, player.team)}
                          className="text-xs md:text-sm font-semibold text-zinc-200 hover:text-purple-400 transition-colors cursor-pointer text-left"
                          data-testid={`player-link-${player.name.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {player.name}
                        </button>
                        <div className="text-[10px] md:text-[11px] text-zinc-500">{player.team}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2">
                      {player.direction === 'up' && <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-500" />}
                      {player.direction === 'down' && <TrendingDown className="h-3.5 w-3.5 md:h-4 md:w-4 text-red-500" />}
                      <span className={`text-xs md:text-sm font-bold ${
                        player.direction === 'up' 
                          ? 'text-green-500' 
                          : player.direction === 'down' 
                            ? 'text-red-500' 
                            : 'text-zinc-400'
                      }`}>
                        {player.alpha?.toFixed(1) || '—'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Next Man Up - Opportunity Shifts */}
            {opportunityShifts.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-[10px] md:text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
                    Next Man Up
                  </h4>
                  <span className="text-[9px] md:text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                    Injury Impact
                  </span>
                </div>
                <div className="bg-white/[0.02] rounded-xl border border-purple-500/15 overflow-hidden">
                  {opportunityShifts.slice(0, 8).map((shift: any, idx: number) => (
                    <div 
                      key={`${shift.type}-${shift.playerId}`}
                      className={`flex items-center justify-between px-3 md:px-4 py-2 md:py-2.5 ${
                        idx < Math.min(opportunityShifts.length, 8) - 1 ? 'border-b border-purple-500/10' : ''
                      }`}
                      data-testid={`opportunity-${shift.playerId}`}
                    >
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className={`w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center ${
                          shift.type === 'gaining' 
                            ? 'bg-green-500/15' 
                            : 'bg-red-500/15'
                        }`}>
                          {shift.type === 'gaining' ? (
                            <ArrowUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-500" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 md:h-4 md:w-4 text-red-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs md:text-sm font-semibold ${
                              shift.type === 'gaining' ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {shift.playerName}
                            </span>
                            <span className="text-[10px] md:text-[11px] text-zinc-500">
                              {shift.position} • {shift.team}
                            </span>
                          </div>
                          <div className="text-[9px] md:text-[10px] text-zinc-500 truncate max-w-[180px] md:max-w-[250px]">
                            {shift.reason}
                          </div>
                        </div>
                      </div>
                      <div className={`px-2 py-0.5 rounded text-[9px] md:text-[10px] font-medium ${
                        shift.type === 'gaining' 
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {shift.type === 'gaining' ? '📈 Rising' : '🔻 Out'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Start/Sit Suggestions */}
          <section>
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <h3 className="text-[11px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                Start/Sit Suggestions
              </h3>
              <Link href="/schedule">
                <span className="text-[10px] md:text-[11px] text-purple-500 cursor-pointer hover:text-purple-400">
                  View Schedule →
                </span>
              </Link>
            </div>
            <div className="p-3 md:p-5 rounded-xl bg-gradient-to-br from-purple-500/[0.08] to-cyan-500/[0.04] border border-purple-500/20 flex flex-col gap-3 md:gap-4">
              {startSitLoading ? (
                <div className="flex items-center justify-center py-4 text-zinc-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading recommendations...
                </div>
              ) : (() => {
                const recommendations = startSitData?.recommendations || [];
                // Show up to 2 starts and 2 sits for more complete recommendations
                const starts = recommendations.filter((r: any) => r.recommendation === 'start').slice(0, 2);
                const sits = recommendations.filter((r: any) => r.recommendation === 'sit').slice(0, 2);
                
                if (recommendations.length === 0) {
                  return (
                    <div className="text-sm text-zinc-500 text-center py-2">
                      <AlertTriangle className="h-4 w-4 inline mr-1" />
                      No start/sit recommendations available for this week
                    </div>
                  );
                }
                
                return (
                  <>
                    {/* Start recommendations */}
                    {starts.map((rec: any, idx: number) => (
                      <div key={`start-${idx}`} className="flex items-center gap-2 md:gap-4">
                        <div className="px-2 md:px-2.5 py-1 md:py-1.5 rounded-md bg-green-500/15 border border-green-500/30 text-green-500 text-[10px] md:text-[11px] font-semibold shrink-0">
                          START
                        </div>
                        <span className="text-xs md:text-sm text-zinc-200 line-clamp-2">
                          <button 
                            onClick={() => handlePlayerClick(rec.player?.fullName || rec.player?.canonicalId)}
                            className="font-bold hover:text-purple-400 transition-colors cursor-pointer"
                            data-testid={`player-link-start-${idx}`}
                          >
                            {rec.player?.fullName || 'Unknown'}
                          </button>
                          {rec.matchup?.opponent && <span> vs {rec.matchup.opponent}</span>}
                          {rec.reasoning && <span className="hidden sm:inline"> — {rec.reasoning}</span>}
                        </span>
                      </div>
                    ))}
                    {/* Sit recommendations */}
                    {sits.map((rec: any, idx: number) => (
                      <div key={`sit-${idx}`} className="flex items-center gap-2 md:gap-4">
                        <div className="px-2 md:px-2.5 py-1 md:py-1.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-500 text-[10px] md:text-[11px] font-semibold shrink-0">
                          SIT
                        </div>
                        <span className="text-xs md:text-sm text-zinc-200 line-clamp-2">
                          <button 
                            onClick={() => handlePlayerClick(rec.player?.fullName || rec.player?.canonicalId)}
                            className="font-bold hover:text-purple-400 transition-colors cursor-pointer"
                            data-testid={`player-link-sit-${idx}`}
                          >
                            {rec.player?.fullName || 'Unknown'}
                          </button>
                          {rec.matchup?.opponent && <span> @ {rec.matchup.opponent}</span>}
                          {rec.reasoning && <span className="hidden sm:inline"> — {rec.reasoning}</span>}
                        </span>
                      </div>
                    ))}
                    {/* If only starts or only sits available */}
                    {starts.length === 0 && sits.length > 0 && (
                      <div className="flex items-center gap-4 opacity-60">
                        <div className="px-2.5 py-1.5 rounded-md bg-green-500/10 border border-green-500/20 text-green-500/60 text-[11px] font-semibold">
                          START
                        </div>
                        <span className="text-sm text-zinc-500 italic">No strong starts this week</span>
                      </div>
                    )}
                    {sits.length === 0 && starts.length > 0 && (
                      <div className="flex items-center gap-4 opacity-60">
                        <div className="px-2.5 py-1.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-500/60 text-[11px] font-semibold">
                          SIT
                        </div>
                        <span className="text-sm text-zinc-500 italic">No strong sits this week</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </section>
          </>
          )}
        </div>

        {/* RIGHT: Chat Panel - Live Tiber Chat */}
        {/* Desktop: shown in grid, Mobile: shown as overlay when toggled */}
        <aside className={`
          ${isMobileChatOpen 
            ? 'flex fixed inset-0 z-[80] bg-[#0a0a0f]' 
            : 'hidden lg:flex lg:border-l lg:border-purple-500/15 bg-[#0a0a0f]/50'
          } 
          flex-col
        `}>
          {/* Chat Header */}
          <div className="px-3 md:px-5 py-3 md:py-4 border-b border-purple-500/10 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-2.5">
              {/* Mobile back button */}
              <button 
                onClick={() => setIsMobileChatOpen(false)}
                className="lg:hidden w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-200 mr-1"
                data-testid="button-close-mobile-chat"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center font-bold text-white text-xs md:text-sm">
                T
              </div>
              <div>
                <div className="text-xs md:text-sm font-semibold text-zinc-200">TIBER Chat</div>
                <div className="text-[10px] md:text-[11px] text-zinc-500">
                  {selectedLeague ? selectedLeague.leagueName : 'Your Assistant GM'}
                </div>
              </div>
            </div>
            <button 
              onClick={handleNewChat}
              className="px-2 md:px-3 py-1 md:py-1.5 rounded-md border border-purple-500/30 bg-transparent text-purple-500 text-[10px] md:text-xs cursor-pointer flex items-center gap-1 md:gap-1.5 hover:bg-purple-500/10"
              data-testid="button-new-chat"
            >
              <MessageSquarePlus className="h-3 w-3" />
              <span className="hidden sm:inline">New</span>
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-3 md:p-5 overflow-y-auto flex flex-col gap-3 md:gap-4" data-testid="chat-messages">
            {messages.map((message) => (
              <div key={message.id} className="flex gap-2 md:gap-3">
                {message.role === 'assistant' ? (
                  <>
                    <div className="w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center font-bold text-white text-[10px] md:text-xs shrink-0">
                      T
                    </div>
                    <div className="px-3 md:px-4 py-2 md:py-3 rounded-xl rounded-tl-sm bg-purple-500/10 border border-purple-500/20 text-xs md:text-sm leading-relaxed text-zinc-300 max-w-[85%]">
                      {message.content}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 md:w-7 md:h-7 rounded-md bg-zinc-700 flex items-center justify-center shrink-0">
                      <User className="h-3.5 w-3.5 md:h-4 md:w-4 text-zinc-400" />
                    </div>
                    <div className="px-3 md:px-4 py-2 md:py-3 rounded-xl rounded-tl-sm bg-zinc-800 border border-zinc-700 text-xs md:text-sm leading-relaxed text-zinc-200 max-w-[85%]">
                      {message.content}
                    </div>
                  </>
                )}
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex gap-2 md:gap-3">
                <div className="w-6 h-6 md:w-7 md:h-7 rounded-md bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center font-bold text-white text-[10px] md:text-xs shrink-0">
                  T
                </div>
                <div className="px-3 md:px-4 py-2 md:py-3 rounded-xl rounded-tl-sm bg-purple-500/10 border border-purple-500/20 text-xs md:text-sm text-zinc-400 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />

            {/* Quick Actions - only show at start */}
            {messages.length === 1 && messages[0].id === 'welcome' && (
              <div className="flex flex-wrap gap-1.5 md:gap-2 pl-8 md:pl-10">
                {quickActions.map((action, idx) => (
                  <button 
                    key={idx}
                    onClick={() => handleQuickAction(action)}
                    className="px-2.5 md:px-3.5 py-1.5 md:py-2 rounded-full border border-purple-500/25 bg-purple-500/5 text-zinc-400 text-[10px] md:text-xs cursor-pointer transition-all hover:bg-purple-500/10 hover:text-zinc-300 hover:border-purple-500/40"
                    data-testid={`action-${idx}`}
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="px-3 md:px-5 py-3 md:py-4 border-t border-purple-500/10">
            {/* Mode Selector */}
            <div className="flex items-center gap-2 mb-3">
              {[
                { mode: 'insight', label: 'Insight', icon: Lightbulb },
                { mode: 'analyst', label: 'Analyst', icon: GraduationCap },
              ].map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => setChatMode(mode as 'insight' | 'analyst')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                    chatMode === mode 
                      ? 'bg-purple-500/20 text-purple-500' 
                      : 'bg-transparent text-zinc-500 hover:text-zinc-400'
                  }`}
                  data-testid={`mode-${mode}`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
            
            {/* Input Box */}
            <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl bg-white/[0.03] border border-purple-500/20">
              <input
                type="text"
                placeholder="Ask about trades, start/sit..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                className="flex-1 bg-transparent border-none text-zinc-200 text-xs md:text-sm outline-none placeholder:text-zinc-600"
                data-testid="input-chat"
              />
              <button 
                onClick={handleSend}
                disabled={chatMutation.isPending || !chatMessage.trim()}
                className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 text-white cursor-pointer flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                data-testid="button-send"
              >
                <Send className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </button>
            </div>
          </div>
        </aside>
        
        {/* Mobile Floating Chat Button - only visible on mobile when chat is closed */}
        {!isMobileChatOpen && (
          <button
            onClick={() => setIsMobileChatOpen(true)}
            className="lg:hidden fixed bottom-5 right-5 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/30 flex items-center justify-center z-[70] hover:scale-105 transition-transform active:scale-95"
            data-testid="button-open-mobile-chat"
          >
            <MessageCircle className="h-6 w-6" />
          </button>
        )}
      </main>

      {/* Player Card Modal */}
      {selectedPlayerForModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={handleClosePlayerModal}
        >
          <div 
            className="max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <EnhancedPlayerCard 
              player={selectedPlayerForModal} 
              onClose={handleClosePlayerModal}
            />
          </div>
        </div>
      )}
    </div>
  );
}
