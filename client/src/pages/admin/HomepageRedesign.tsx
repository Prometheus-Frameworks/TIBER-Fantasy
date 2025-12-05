import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  ChevronLeft, Search, LayoutDashboard, BarChart3, Calendar, FlaskConical, 
  FileText, ArrowLeftRight, BookOpen, Plus, Send, User, Loader2, Lightbulb, 
  GraduationCap, MessageSquarePlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

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

type Insight = {
  type: string;
  title: string;
  content: string;
  urgency: 'high' | 'medium' | 'low';
};

type TrendingPlayer = {
  name: string;
  team: string;
  position: string;
  change: string;
  direction: 'up' | 'down';
};

export default function HomepageRedesign() {
  const [, navigate] = useLocation();
  const [activeFeature, setActiveFeature] = useState('dashboard');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMode, setChatMode] = useState<'insight' | 'analyst'>('insight');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const features: Feature[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'rankings', label: 'Rankings', icon: BarChart3, href: '/rankings' },
    { id: 'schedule', label: 'Schedule', icon: Calendar, href: '/schedule' },
    { id: 'datalab', label: 'Data Lab', icon: FlaskConical, href: '/tiber-data-lab' },
    { id: 'waiver', label: 'Waiver Wire', icon: FileText },
    { id: 'trades', label: 'Trade Hub', icon: ArrowLeftRight },
    { id: 'journal', label: 'Command Centre', icon: BookOpen },
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
        showWelcomeMessage();
      }
    } else {
      showWelcomeMessage();
    }
  }, []);

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
    setSelectedLeagueId(leagueId);
    localStorage.setItem('tiber_chat_league', leagueId);
    localStorage.removeItem('tiber_chat_session');
    localStorage.removeItem('tiber_chat_messages');
    setSessionId(null);
    const league = leagues.find(l => l.id === leagueId);
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

  // Static mock data for dashboard widgets (can be replaced with real APIs later)
  const quickInsights: Insight[] = [
    { type: 'alert', title: 'Injury Alert', content: "Ja'Marr Chase questionable - monitor practice reports", urgency: 'high' },
    { type: 'trend', title: 'Rising', content: 'Bucky Irving +12% rostership', urgency: 'medium' },
    { type: 'matchup', title: 'Week 14', content: 'Morts FF vs Dynasty Kings - projected 112.4', urgency: 'low' },
  ];

  const trendingPlayers: TrendingPlayer[] = [
    { name: 'Bucky Irving', team: 'TB', position: 'RB', change: '+18.2', direction: 'up' },
    { name: 'Jameson Williams', team: 'DET', position: 'WR', change: '+12.7', direction: 'up' },
    { name: 'Keenan Allen', team: 'CHI', position: 'WR', change: '-8.4', direction: 'down' },
  ];

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
      
      {/* Admin Notice Banner - Remove this when migrating to production */}
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

      {/* ===== TOP HEADER BAR ===== */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-purple-500/15 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center font-bold text-white text-base">
            T
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-purple-500 to-cyan-500 bg-clip-text text-transparent">
            TIBER
          </span>
        </div>

        {/* League Selector - Real Data */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 rounded-lg border border-purple-500/20 cursor-pointer">
          <span className="text-xs text-zinc-400">Active:</span>
          <select 
            value={selectedLeagueId || ''}
            onChange={(e) => handleLeagueChange(e.target.value)}
            className="bg-transparent border-none text-zinc-200 text-sm font-semibold cursor-pointer outline-none"
            data-testid="select-league"
          >
            <option value="" className="bg-[#1a1a24]">Select League...</option>
            {leagues.map(league => (
              <option key={league.id} value={league.id} className="bg-[#1a1a24]">
                {league.leagueName} ({league.settings.teams || 12}T)
              </option>
            ))}
          </select>
        </div>

        {/* Search & Profile */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] rounded-lg border border-white/[0.08]">
            <Search className="h-4 w-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search players..." 
              className="bg-transparent border-none text-zinc-200 text-sm outline-none w-40"
              data-testid="input-search"
            />
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center cursor-pointer">
            <User className="h-4 w-4 text-white" />
          </div>
        </div>
      </header>

      {/* ===== HORIZONTAL FEATURE NAVIGATION ===== */}
      <nav className="flex items-center gap-1 px-6 py-3 border-b border-purple-500/10 bg-[#0a0a0f]/50 overflow-x-auto">
        {features.map(feature => {
          const Icon = feature.icon;
          const isActive = activeFeature === feature.id;
          return (
            <button
              key={feature.id}
              onClick={() => handleFeatureClick(feature)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 border ${
                isActive 
                  ? 'bg-gradient-to-r from-purple-500/25 to-cyan-500/15 text-zinc-200 border-purple-500/30' 
                  : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-400 hover:bg-white/[0.02]'
              }`}
              data-testid={`nav-${feature.id}`}
            >
              <Icon className="h-4 w-4" />
              <span>{feature.label}</span>
            </button>
          );
        })}
        
        {/* Add Feature Button */}
        <button className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-dashed border-purple-500/30 bg-transparent text-purple-500 text-sm cursor-pointer ml-2">
          <Plus className="h-4 w-4" />
        </button>
      </nav>

      {/* ===== MAIN CONTENT AREA ===== */}
      <main className="grid grid-cols-[1fr_380px] flex-1 overflow-hidden">
        
        {/* LEFT: Dashboard / Feature Content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5">
          
          {/* Quick Insights Row */}
          <section>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
              Quick Insights
            </h3>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
              {quickInsights.map((insight, idx) => (
                <div 
                  key={idx} 
                  className="p-4 rounded-xl bg-white/[0.02] border border-purple-500/15 flex flex-col gap-2"
                  data-testid={`insight-${idx}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${getUrgencyColor(insight.urgency)}`} />
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase">
                      {insight.title}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-200 leading-relaxed">
                    {insight.content}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Trending Players / FORGE Movers */}
          <section>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
              FORGE Movers
            </h3>
            <div className="bg-white/[0.02] rounded-xl border border-purple-500/15 overflow-hidden">
              {trendingPlayers.map((player, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-center justify-between px-4 py-3.5 ${
                    idx < trendingPlayers.length - 1 ? 'border-b border-purple-500/10' : ''
                  }`}
                  data-testid={`mover-${idx}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/10 flex items-center justify-center text-xs font-semibold text-purple-500">
                      {player.position}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-200">{player.name}</div>
                      <div className="text-[11px] text-zinc-500">{player.team}</div>
                    </div>
                  </div>
                  <div className={`text-sm font-semibold ${
                    player.direction === 'up' ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {player.direction === 'up' ? '↑' : '↓'} {player.change}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Start/Sit Suggestions */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                Start/Sit Suggestions
              </h3>
              <span className="text-[11px] text-purple-500 cursor-pointer hover:text-purple-400">
                View Full Roster →
              </span>
            </div>
            <div className="p-5 rounded-xl bg-gradient-to-br from-purple-500/[0.08] to-cyan-500/[0.04] border border-purple-500/20 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="px-2.5 py-1.5 rounded-md bg-green-500/15 border border-green-500/30 text-green-500 text-[11px] font-semibold">
                  START
                </div>
                <span className="text-sm text-zinc-200">
                  <strong>Nico Collins</strong> vs JAX — elite matchup, 94% confidence
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="px-2.5 py-1.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-500 text-[11px] font-semibold">
                  SIT
                </div>
                <span className="text-sm text-zinc-200">
                  <strong>Courtland Sutton</strong> @ BUF — tough secondary, 71% confidence
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT: Chat Panel - Live Tiber Chat */}
        <aside className="border-l border-purple-500/15 flex flex-col bg-[#0a0a0f]/50">
          {/* Chat Header */}
          <div className="px-5 py-4 border-b border-purple-500/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center font-bold text-white text-sm">
                T
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-200">TIBER Chat</div>
                <div className="text-[11px] text-zinc-500">
                  {selectedLeague ? selectedLeague.leagueName : 'Your Assistant GM'}
                </div>
              </div>
            </div>
            <button 
              onClick={handleNewChat}
              className="px-3 py-1.5 rounded-md border border-purple-500/30 bg-transparent text-purple-500 text-xs cursor-pointer flex items-center gap-1.5 hover:bg-purple-500/10"
              data-testid="button-new-chat"
            >
              <MessageSquarePlus className="h-3 w-3" />
              New
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4" data-testid="chat-messages">
            {messages.map((message) => (
              <div key={message.id} className="flex gap-3">
                {message.role === 'assistant' ? (
                  <>
                    <div className="w-7 h-7 rounded-md bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center font-bold text-white text-xs shrink-0">
                      T
                    </div>
                    <div className="px-4 py-3 rounded-xl rounded-tl-sm bg-purple-500/10 border border-purple-500/20 text-sm leading-relaxed text-zinc-300">
                      {message.content}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-7 h-7 rounded-md bg-zinc-700 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-zinc-400" />
                    </div>
                    <div className="px-4 py-3 rounded-xl rounded-tl-sm bg-zinc-800 border border-zinc-700 text-sm leading-relaxed text-zinc-200">
                      {message.content}
                    </div>
                  </>
                )}
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center font-bold text-white text-xs shrink-0">
                  T
                </div>
                <div className="px-4 py-3 rounded-xl rounded-tl-sm bg-purple-500/10 border border-purple-500/20 text-sm text-zinc-400 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />

            {/* Quick Actions - only show at start */}
            {messages.length === 1 && messages[0].id === 'welcome' && (
              <div className="flex flex-wrap gap-2 pl-10">
                {quickActions.map((action, idx) => (
                  <button 
                    key={idx}
                    onClick={() => handleQuickAction(action)}
                    className="px-3.5 py-2 rounded-full border border-purple-500/25 bg-purple-500/5 text-zinc-400 text-xs cursor-pointer transition-all hover:bg-purple-500/10 hover:text-zinc-300 hover:border-purple-500/40"
                    data-testid={`action-${idx}`}
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="px-5 py-4 border-t border-purple-500/10">
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
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-purple-500/20">
              <input
                type="text"
                placeholder="Ask about trades, start/sit, player analysis..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                className="flex-1 bg-transparent border-none text-zinc-200 text-sm outline-none placeholder:text-zinc-600"
                data-testid="input-chat"
              />
              <button 
                onClick={handleSend}
                disabled={chatMutation.isPending || !chatMessage.trim()}
                className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 text-white cursor-pointer flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
