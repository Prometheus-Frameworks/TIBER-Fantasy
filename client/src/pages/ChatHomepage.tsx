import { useState, useEffect, useRef } from 'react';
import { Menu, X, User, Bell, Search, Send, Loader2, ChevronDown, ChevronUp, Plus, Users, MoreVertical, Trash2 } from 'lucide-react';
import { Link } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  timestamp: Date;
}

interface ChatSource {
  chunk_id: number;
  relevance_score: number;
  content_preview: string;
  metadata: any;
}

interface ChatResponse {
  success: boolean;
  session_id: string;
  response: string;
  sources: ChatSource[];
  message_id: number;
}

interface League {
  id: string;
  userId: string;
  leagueName: string;
  platform: string | null;
  leagueIdExternal: string | null;
  settings: {
    scoring?: string;
    teams?: number;
    rosterSpots?: Record<string, number>;
  };
  createdAt: string;
  updatedAt: string;
}

export default function ChatHomepage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [createLeagueOpen, setCreateLeagueOpen] = useState(false);
  const [leaguesExpanded, setLeaguesExpanded] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leagueToDelete, setLeagueToDelete] = useState<League | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch user's leagues
  const { data: leaguesData } = useQuery({
    queryKey: ['/api/leagues'],
    queryFn: async () => {
      const response = await fetch('/api/leagues?user_id=default_user');
      return response.json();
    },
  });

  const leagues = leaguesData?.leagues || [];

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('tiber_chat_session');
    const savedMessages = localStorage.getItem('tiber_chat_messages');
    
    if (savedSession) {
      setSessionId(savedSession);
    }
    
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    } else {
      // Show welcome message
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Hey, welcome to TIBER. I'm here to help with player analysis, start/sit decisions, and trade evaluations. What can I help you with?",
        timestamp: new Date(),
      }]);
    }
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 1) { // Don't save just welcome message
      localStorage.setItem('tiber_chat_messages', JSON.stringify(messages));
    }
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/rag/chat', {
        message,
        user_level: 2,
        session_id: sessionId,
        league_id: selectedLeagueId,
      });
      return response.json() as Promise<ChatResponse>;
    },
    onSuccess: (data) => {
      // Save session ID
      if (!sessionId) {
        setSessionId(data.session_id);
        localStorage.setItem('tiber_chat_session', data.session_id);
      }

      // Add assistant message
      setMessages(prev => [...prev, {
        id: `assistant-${data.message_id}`,
        role: 'assistant',
        content: data.response,
        sources: data.sources,
        timestamp: new Date(),
      }]);
    },
    onError: (error) => {
      // Add error message
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ Error: ${error.message || 'Failed to get response'}. Please try again.`,
        timestamp: new Date(),
      }]);
    },
  });

  const handleSend = () => {
    if (!inputMessage.trim() || chatMutation.isPending) return;

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(inputMessage);
    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Delete league mutation
  const deleteLeagueMutation = useMutation({
    mutationFn: async (leagueId: string) => {
      const response = await apiRequest('DELETE', `/api/leagues/${leagueId}`, {});
      return response.json();
    },
    onSuccess: (data, deletedLeagueId) => {
      // Check if deletion was successful
      if (!data.success) {
        toast({
          title: "Delete failed",
          description: data.error || "Failed to delete league",
          variant: "destructive",
        });
        return;
      }

      // Invalidate leagues cache
      queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
      
      // If deleted league was selected, reset to null
      if (selectedLeagueId === deletedLeagueId) {
        setSelectedLeagueId(null);
      }
      
      // Close dialog and reset state
      setDeleteDialogOpen(false);
      const leagueName = leagueToDelete?.leagueName;
      setLeagueToDelete(null);
      
      // Show success toast
      toast({
        title: "League deleted",
        description: `${leagueName || 'League'} has been permanently removed.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete league. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex h-screen bg-gradient-to-br from-purple-900/20 via-[#0a0e1a] to-black text-white overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:relative z-40 w-64 md:w-1/5 h-screen bg-[#141824] border-r border-gray-800 transition-transform duration-300 flex flex-col`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold">
              T
            </div>
            <span className="font-bold text-sm">TIBER</span>
          </Link>
          <button
            data-testid="button-close-sidebar"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            <li>
              <button
                data-testid="nav-home"
                onClick={() => {
                  setSelectedLeagueId(null);
                  setSidebarOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded ${
                  !selectedLeagueId
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30 font-medium'
                    : 'hover:bg-gray-700/50 text-gray-300'
                } transition-colors`}
              >
                Generic Chat
              </button>
            </li>

            {/* League Selector Section */}
            <li className="mt-4">
              <button
                data-testid="button-toggle-leagues"
                onClick={() => setLeaguesExpanded(!leaguesExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-700/30 text-gray-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-medium">My Leagues</span>
                </div>
                {leaguesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {leaguesExpanded && (
                <div className="mt-2 ml-2 space-y-1">
                  {leagues.length === 0 ? (
                    <p className="text-xs text-gray-500 px-3 py-2">No leagues yet</p>
                  ) : (
                    leagues.map((league: League) => (
                      <div
                        key={league.id}
                        data-testid={`league-${league.id}`}
                        className={`w-full flex items-center gap-1 px-3 py-2 rounded text-sm ${
                          selectedLeagueId === league.id
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : 'hover:bg-gray-700/30 text-gray-400'
                        } transition-colors`}
                      >
                        <button
                          onClick={() => {
                            setSelectedLeagueId(league.id);
                            setSidebarOpen(false);
                          }}
                          className="flex-1 text-left"
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{league.leagueName}</span>
                            {league.settings.teams && (
                              <Badge variant="secondary" className="text-xs ml-2">
                                {league.settings.teams}T
                              </Badge>
                            )}
                          </div>
                          {league.platform && (
                            <span className="text-xs text-gray-500 capitalize">{league.platform}</span>
                          )}
                        </button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              data-testid={`league-menu-${league.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-[#141824] border-gray-700 text-white">
                            <DropdownMenuItem
                              data-testid={`delete-league-${league.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setLeagueToDelete(league);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete League
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))
                  )}
                  
                  <button
                    data-testid="button-create-league"
                    onClick={() => setCreateLeagueOpen(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-green-500/10 text-green-400 transition-colors text-sm border border-dashed border-green-500/30"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create New League</span>
                  </button>
                </div>
              )}
            </li>

            <li className="mt-4 pt-4 border-t border-gray-700">
              <Link href="/?tab=rankings">
                <button
                  data-testid="nav-rankings"
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-700/50 text-gray-300 transition-colors"
                  onClick={() => setSidebarOpen(false)}
                >
                  Rankings
                </button>
              </Link>
            </li>
            <li>
              <Link href="/?tab=matchups">
                <button
                  data-testid="nav-matchups"
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-700/50 text-gray-300 transition-colors"
                  onClick={() => setSidebarOpen(false)}
                >
                  Matchups
                </button>
              </Link>
            </li>
            <li>
              <Link href="/?tab=strategy">
                <button
                  data-testid="nav-strategy"
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-700/50 text-gray-300 transition-colors"
                  onClick={() => setSidebarOpen(false)}
                >
                  Strategy
                </button>
              </Link>
            </li>
            <li>
              <Link href="/?tab=leagues">
                <button
                  data-testid="nav-leagues"
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-700/50 text-gray-300 transition-colors"
                  onClick={() => setSidebarOpen(false)}
                >
                  Leagues
                </button>
              </Link>
            </li>
          </ul>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-800">
          <p className="text-xs text-gray-500 text-center">
            Rigged in your favor—serve the W.
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-[#141824] border-b border-gray-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              data-testid="button-hamburger"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-gray-400 hover:text-white"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold hidden sm:block">TIBER: Your Assistant GM</h1>
              {selectedLeagueId && (
                <p data-testid="league-context-indicator" className="text-xs text-blue-400 hidden sm:block">
                  📊 {leagues.find((l: League) => l.id === selectedLeagueId)?.leagueName || 'League'}
                  {leagues.find((l: League) => l.id === selectedLeagueId)?.settings.teams && 
                    ` (${leagues.find((l: League) => l.id === selectedLeagueId)?.settings.teams}T ${leagues.find((l: League) => l.id === selectedLeagueId)?.settings.scoring?.toUpperCase() || 'PPR'})`}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-[#0a0e1a] border border-gray-700 rounded-lg px-3 py-1.5">
              <Search className="h-4 w-4 text-gray-500" />
              <input
                data-testid="input-search"
                type="text"
                placeholder="Search players..."
                className="bg-transparent border-none outline-none text-sm text-white placeholder:text-gray-500 w-32 lg:w-48"
              />
            </div>
            <button data-testid="button-notifications" className="text-gray-400 hover:text-white">
              <Bell className="h-5 w-5" />
            </button>
            <button data-testid="button-profile" className="text-gray-400 hover:text-white">
              <User className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="chat-messages">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          
          {chatMutation.isPending && (
            <div data-testid="loading-indicator" className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                T
              </div>
              <div className="flex-1 bg-[#141824] rounded-lg px-4 py-3 border border-gray-800">
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span data-testid="loading-text" className="text-sm">TIBER is thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="border-t border-gray-800 bg-[#141824] p-4">
          <div className="max-w-4xl mx-auto flex gap-2">
            <Input
              data-testid="input-chat"
              type="text"
              placeholder="Ask about trades, start/sit, player analysis..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={chatMutation.isPending}
              className="flex-1 bg-[#0a0e1a] border-gray-700 text-white placeholder:text-gray-500"
            />
            <Button
              data-testid="button-send"
              onClick={handleSend}
              disabled={!inputMessage.trim() || chatMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6"
            >
              {chatMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-black/50 border-t border-gray-800 px-4 py-2 text-center">
          <p className="text-xs text-gray-500">
            Players: 11,490+ | Teams: 28 | <span className="text-green-400">Serve not take</span>
          </p>
        </footer>
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Create League Modal */}
      <CreateLeagueModal 
        open={createLeagueOpen}
        onClose={() => setCreateLeagueOpen(false)}
        onSuccess={(newLeague) => {
          setSelectedLeagueId(newLeague.id);
          setCreateLeagueOpen(false);
          queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
        }}
      />

      {/* Delete League Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setLeagueToDelete(null); // Clear on external dismiss
      }}>
        <AlertDialogContent className="bg-[#141824] text-white border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete League?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will permanently delete "<strong>{leagueToDelete?.leagueName}</strong>" and all its associated context (roster, trades, waivers). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setDeleteDialogOpen(false);
                setLeagueToDelete(null);
              }}
              className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-league"
              onClick={() => {
                if (leagueToDelete) {
                  deleteLeagueMutation.mutate(leagueToDelete.id);
                }
              }}
              disabled={deleteLeagueMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteLeagueMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete League'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Create League Modal Component
function CreateLeagueModal({ open, onClose, onSuccess }: {
  open: boolean;
  onClose: () => void;
  onSuccess: (league: any) => void;
}) {
  const [leagueName, setLeagueName] = useState('');
  const [platform, setPlatform] = useState('manual');
  const [scoring, setScoring] = useState('ppr');
  const [teams, setTeams] = useState('12');
  const [sleeperLeagueId, setSleeperLeagueId] = useState('');
  const [sleeperRosterId, setSleeperRosterId] = useState('');
  const [fetchedLeagueData, setFetchedLeagueData] = useState<any>(null);
  const [fetchedRosters, setFetchedRosters] = useState<any[]>([]);

  // Fetch Sleeper league data
  const fetchSleeperMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/sleeper/validate/${sleeperLeagueId}`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.valid && data.league) {
        setFetchedLeagueData(data.league);
        setFetchedRosters(data.rosters || []);
        setLeagueName(data.league.name);
        setTeams(data.league.total_rosters?.toString() || data.league.teams?.toString() || '12');
        // Map Sleeper scoring to our format
        const scoringType = data.league.scoring_settings?.rec || 0;
        if (scoringType === 1) setScoring('ppr');
        else if (scoringType === 0.5) setScoring('half-ppr');
        else setScoring('standard');
      }
    },
  });

  const createLeagueMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/leagues', {
        league_name: leagueName,
        platform,
        league_id_external: platform === 'sleeper' ? sleeperLeagueId : null,
        settings: {
          scoring,
          teams: parseInt(teams),
        },
      });
      return response.json();
    },
    onSuccess: async (data) => {
      if (data.success) {
        // If Sleeper league, trigger sync
        if (platform === 'sleeper' && sleeperLeagueId && sleeperRosterId) {
          try {
            await apiRequest('POST', `/api/leagues/${data.league.id}/sync-sleeper`, {
              sleeper_league_id: sleeperLeagueId,
              sleeper_roster_id: sleeperRosterId,
            });
          } catch (error) {
            console.error('Failed to sync Sleeper league:', error);
          }
        }
        
        onSuccess(data.league);
        // Reset form
        setLeagueName('');
        setPlatform('manual');
        setScoring('ppr');
        setTeams('12');
        setSleeperLeagueId('');
        setSleeperRosterId('');
        setFetchedLeagueData(null);
        setFetchedRosters([]);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (leagueName.trim()) {
      createLeagueMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-[#141824] text-white border-gray-700 max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New League</DialogTitle>
          <DialogDescription className="text-gray-400">
            Set up a league context for TIBER to remember your roster and trades
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 overflow-y-auto pr-2">
          <div>
            <label htmlFor="league-name" className="text-sm font-medium text-gray-300 block mb-2">
              League Name
            </label>
            <Input
              id="league-name"
              data-testid="input-league-name"
              type="text"
              placeholder="My Dynasty League"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              className="bg-[#0a0e1a] border-gray-700 text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="platform" className="text-sm font-medium text-gray-300 block mb-2">
              Platform
            </label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger data-testid="select-platform" className="bg-[#0a0e1a] border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141824] border-gray-700 text-white">
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="sleeper">Sleeper</SelectItem>
                <SelectItem value="espn">ESPN</SelectItem>
                <SelectItem value="yahoo">Yahoo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sleeper League ID Input */}
          {platform === 'sleeper' && (
            <div>
              <label htmlFor="sleeper-id" className="text-sm font-medium text-gray-300 block mb-2">
                Sleeper League ID
              </label>
              <div className="flex gap-2">
                <Input
                  id="sleeper-id"
                  data-testid="input-sleeper-league-id"
                  type="text"
                  placeholder="Enter your Sleeper league ID"
                  value={sleeperLeagueId}
                  onChange={(e) => setSleeperLeagueId(e.target.value)}
                  className="bg-[#0a0e1a] border-gray-700 text-white flex-1"
                />
                <Button
                  type="button"
                  data-testid="button-fetch-sleeper"
                  onClick={() => fetchSleeperMutation.mutate()}
                  disabled={!sleeperLeagueId.trim() || fetchSleeperMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {fetchSleeperMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Fetch'
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Find your league ID in the Sleeper app URL
              </p>
            </div>
          )}

          {/* Fetched League Data Preview */}
          {fetchedLeagueData && (
            <div data-testid="sleeper-preview" className="bg-[#0a0e1a] border border-green-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium text-green-400">League Found</span>
              </div>
              <p className="text-sm text-gray-300 mb-1">
                <strong>{fetchedLeagueData.name}</strong>
              </p>
              <p className="text-xs text-gray-500">
                {fetchedLeagueData.total_rosters || fetchedLeagueData.teams} teams • {fetchedLeagueData.scoring_settings?.rec === 1 ? 'PPR' : fetchedLeagueData.scoring_settings?.rec === 0.5 ? '0.5 PPR' : 'Standard'}
              </p>
            </div>
          )}

          {/* Roster Selection */}
          {fetchedRosters.length > 0 && (
            <div>
              <label htmlFor="roster-select" className="text-sm font-medium text-gray-300 block mb-2">
                Select Your Team
              </label>
              <Select value={sleeperRosterId} onValueChange={setSleeperRosterId}>
                <SelectTrigger data-testid="select-roster" className="bg-[#0a0e1a] border-gray-700 text-white">
                  <SelectValue placeholder="Choose your roster..." />
                </SelectTrigger>
                <SelectContent className="bg-[#141824] border-gray-700 text-white max-h-[300px]">
                  {fetchedRosters.map((roster) => (
                    <SelectItem key={roster.rosterId} value={roster.rosterId.toString()}>
                      {roster.ownerDisplayName} ({roster.wins}-{roster.losses})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Select which team is yours so TIBER can sync your roster
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="scoring" className="text-sm font-medium text-gray-300 block mb-2">
                Scoring
              </label>
              <Select value={scoring} onValueChange={setScoring}>
                <SelectTrigger data-testid="select-scoring" className="bg-[#0a0e1a] border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141824] border-gray-700 text-white">
                  <SelectItem value="ppr">PPR</SelectItem>
                  <SelectItem value="half-ppr">0.5 PPR</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="teams" className="text-sm font-medium text-gray-300 block mb-2">
                Teams
              </label>
              <Select value={teams} onValueChange={setTeams}>
                <SelectTrigger data-testid="select-teams" className="bg-[#0a0e1a] border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141824] border-gray-700 text-white">
                  {[8, 10, 12, 14].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              data-testid="button-cancel-create"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-700/50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="button-submit-create"
              disabled={
                !leagueName.trim() || 
                createLeagueMutation.isPending ||
                (platform === 'sleeper' && !sleeperRosterId)
              }
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createLeagueMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create League'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div
      data-testid={`message-${message.role}-${message.id}`}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'items-start'}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          data-testid="avatar-tiber"
          className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 font-bold text-sm"
        >
          T
        </div>
      )}

      <div className={`flex-1 ${isUser ? 'flex justify-end' : ''}`}>
        {/* Message Bubble */}
        <div
          data-testid={`bubble-${message.role}`}
          className={`inline-block max-w-[85%] rounded-lg px-4 py-3 ${
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-[#141824] text-gray-100 border border-gray-800'
          }`}
        >
          <p data-testid="message-content" className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 ml-0">
            <button
              data-testid={`button-toggle-sources-${message.id}`}
              onClick={() => setSourcesExpanded(!sourcesExpanded)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {sourcesExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span>{message.sources.length} source{message.sources.length > 1 ? 's' : ''}</span>
            </button>

            {sourcesExpanded && (
              <div className="mt-2 space-y-2">
                {message.sources.map((source, idx) => (
                  <div
                    key={source.chunk_id}
                    data-testid={`source-${message.id}-${idx}`}
                    className="bg-[#0a0e1a] border border-gray-700 rounded p-3 text-xs"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
                        {(source.relevance_score * 100).toFixed(1)}% match
                      </Badge>
                      <span className="text-gray-500">Source {idx + 1}</span>
                    </div>
                    <p className="text-gray-400">{source.content_preview}...</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div
          data-testid="avatar-user"
          className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0"
        >
          <User className="h-4 w-4 text-gray-300" />
        </div>
      )}
    </div>
  );
}
