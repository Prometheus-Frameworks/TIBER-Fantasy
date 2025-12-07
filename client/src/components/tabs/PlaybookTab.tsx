import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Plus, MessageCircle, Trash2, Edit3, Save, X, 
  TrendingUp, ArrowLeftRight, UserPlus, UserMinus, 
  PlayCircle, FileText, Lightbulb, Send, Loader2,
  ChevronDown, ChevronRight, Crown, Calendar, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Link } from 'wouter';

type EntryType = 'roster_move' | 'trade' | 'waiver_add' | 'waiver_drop' | 'start_sit' | 'note' | 'insight';

interface PlaybookEntry {
  id: number;
  user_id: string;
  league_id: string | null;
  entry_type: EntryType;
  title: string;
  content: string;
  player_ids: string[] | null;
  metadata: {
    week?: number;
    season?: number;
    forgeAlpha?: Record<string, number>;
    tier?: Record<string, string>;
    linkedFeature?: string;
    tags?: string[];
  } | null;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const ENTRY_TYPE_CONFIG: Record<EntryType, { label: string; icon: typeof TrendingUp; color: string }> = {
  roster_move: { label: 'Roster Move', icon: PlayCircle, color: 'text-blue-400' },
  trade: { label: 'Trade', icon: ArrowLeftRight, color: 'text-purple-400' },
  waiver_add: { label: 'Waiver Add', icon: UserPlus, color: 'text-green-400' },
  waiver_drop: { label: 'Waiver Drop', icon: UserMinus, color: 'text-red-400' },
  start_sit: { label: 'Start/Sit', icon: TrendingUp, color: 'text-yellow-400' },
  note: { label: 'Note', icon: FileText, color: 'text-gray-400' },
  insight: { label: 'Insight', icon: Lightbulb, color: 'text-amber-400' }
};

export default function PlaybookTab() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newEntry, setNewEntry] = useState({ title: '', content: '', entryType: 'note' as EntryType });
  const [editEntry, setEditEntry] = useState({ title: '', content: '' });
  
  const [isAskTiberOpen, setIsAskTiberOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useQuery<{ success: boolean; entries: PlaybookEntry[] }>({
    queryKey: ['/api/playbook'],
    queryFn: async () => {
      const res = await fetch('/api/playbook?user_id=default_user&limit=100');
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (entry: { title: string; content: string; entry_type: string }) => {
      return apiRequest('POST', '/api/playbook', {
        user_id: 'default_user',
        ...entry
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playbook'] });
      setIsCreating(false);
      setNewEntry({ title: '', content: '', entryType: 'note' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: { title: string; content: string } }) => {
      return apiRequest('PUT', `/api/playbook/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playbook'] });
      setEditingId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/playbook/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playbook'] });
    }
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch('/api/tiber-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sessionId,
          mode: 'insight',
          userLevel: 3
        })
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.sessionId) setSessionId(data.sessionId);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response || data.message || 'No response',
        timestamp: new Date()
      }]);
    }
  });

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: chatMessage,
      timestamp: new Date()
    }]);
    
    chatMutation.mutate(chatMessage);
    setChatMessage('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const entries = data?.entries || [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-purple-500/20 pb-4">
        <h2 className="text-2xl font-bold text-white tracking-wide">PLAYBOOK</h2>
        <p className="text-gray-400 mt-1 text-sm tracking-wide">
          Your decision journal. Track roster moves, trades, and insights alongside FORGE data.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap text-xs">
        <span className="text-gray-500 py-1">Quick Reference:</span>
        <Link href="/rankings" data-testid="link-tiber-tiers">
          <a className="flex items-center gap-1 px-2 py-1 bg-purple-600/20 border border-purple-500/30 rounded text-purple-300 hover:bg-purple-600/30 transition-colors cursor-pointer">
            <Crown size={12} />
            Tiber Tiers
          </a>
        </Link>
        <Link href="/schedule" data-testid="link-sos">
          <a className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 border border-blue-500/30 rounded text-blue-300 hover:bg-blue-600/30 transition-colors cursor-pointer">
            <Calendar size={12} />
            SoS
          </a>
        </Link>
        <Link href="/tiber-data-lab" data-testid="link-data-lab">
          <a className="flex items-center gap-1 px-2 py-1 bg-green-600/20 border border-green-500/30 rounded text-green-300 hover:bg-green-600/30 transition-colors cursor-pointer">
            <BarChart3 size={12} />
            Data Lab
          </a>
        </Link>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Button
          onClick={() => setIsCreating(true)}
          className="bg-gradient-to-r from-purple-600/30 to-blue-600/30 border border-purple-500/50 text-white hover:border-purple-400"
          data-testid="button-new-entry"
        >
          <Plus size={18} className="mr-2" />
          New Entry
        </Button>
        
        <Button
          onClick={() => setIsAskTiberOpen(!isAskTiberOpen)}
          variant="outline"
          className={`border-amber-500/50 ${isAskTiberOpen ? 'bg-amber-500/20 text-amber-300' : 'text-amber-400 hover:bg-amber-500/10'}`}
          data-testid="button-ask-tiber"
        >
          <MessageCircle size={18} className="mr-2" />
          Ask Tiber
        </Button>
      </div>

      {isAskTiberOpen && (
        <div className="bg-[#111217] border border-amber-500/30 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-500/20 flex items-center gap-2">
            <MessageCircle size={18} className="text-amber-400" />
            <span className="font-medium text-amber-300">Ask Tiber</span>
            <span className="text-xs text-gray-500 ml-2">FORGE-grounded AI companion</span>
          </div>
          
          <div className="h-64 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <Lightbulb size={24} className="mx-auto mb-2 text-amber-500/50" />
                <p className="text-sm">Ask about players, matchups, or roster decisions.</p>
                <p className="text-xs mt-1">Tiber uses FORGE data to give you grounded advice.</p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-purple-600/30 text-white'
                      : 'bg-gray-800 text-gray-200'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-gray-800 px-4 py-2 rounded-lg">
                  <Loader2 size={16} className="animate-spin text-amber-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="p-3 border-t border-amber-500/20 flex gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask about a player, trade, or decision..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              data-testid="input-ask-tiber"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!chatMessage.trim() || chatMutation.isPending}
              className="bg-amber-600 hover:bg-amber-500 text-white"
              data-testid="button-send-tiber"
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      )}

      {isCreating && (
        <div className="bg-[#111217] border border-purple-500/30 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-white">New Entry</h3>
            <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
              <X size={18} />
            </Button>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(ENTRY_TYPE_CONFIG) as EntryType[]).map((type) => {
              const config = ENTRY_TYPE_CONFIG[type];
              const Icon = config.icon;
              return (
                <button
                  key={type}
                  onClick={() => setNewEntry({ ...newEntry, entryType: type })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                    newEntry.entryType === type
                      ? 'bg-purple-600/30 border border-purple-500/50 text-white'
                      : 'bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700/50'
                  }`}
                  data-testid={`button-type-${type}`}
                >
                  <Icon size={14} className={config.color} />
                  {config.label}
                </button>
              );
            })}
          </div>
          
          <input
            type="text"
            value={newEntry.title}
            onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
            placeholder="Title (e.g., 'Started Puka over Lamb')"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
            data-testid="input-entry-title"
          />
          
          <textarea
            value={newEntry.content}
            onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
            placeholder="Details, reasoning, FORGE data at decision time..."
            rows={3}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-none"
            data-testid="input-entry-content"
          />
          
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({
                title: newEntry.title,
                content: newEntry.content,
                entry_type: newEntry.entryType
              })}
              disabled={!newEntry.title.trim() || !newEntry.content.trim() || createMutation.isPending}
              className="bg-purple-600 hover:bg-purple-500"
              data-testid="button-save-entry"
            >
              {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} className="mr-1" />}
              Save
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-800/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText size={32} className="mx-auto mb-3 opacity-50" />
            <p>No entries yet. Start logging your decisions!</p>
          </div>
        ) : (
          entries.map((entry) => {
            const config = ENTRY_TYPE_CONFIG[entry.entry_type] || ENTRY_TYPE_CONFIG.note;
            const Icon = config.icon;
            const isEditing = editingId === entry.id;
            
            return (
              <div
                key={entry.id}
                className="bg-[#111217] border border-gray-800/50 rounded-xl p-4 hover:border-gray-700/50 transition-all"
                data-testid={`entry-card-${entry.id}`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editEntry.title}
                      onChange={(e) => setEditEntry({ ...editEntry, title: e.target.value })}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500/50"
                      data-testid="input-edit-title"
                    />
                    <textarea
                      value={editEntry.content}
                      onChange={(e) => setEditEntry({ ...editEntry, content: e.target.value })}
                      rows={3}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500/50 resize-none"
                      data-testid="input-edit-content"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: entry.id, updates: editEntry })}
                        disabled={updateMutation.isPending}
                        className="bg-purple-600 hover:bg-purple-500"
                        data-testid="button-save-edit"
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon size={18} className={config.color} />
                        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                        <span className="text-xs text-gray-600">•</span>
                        <span className="text-xs text-gray-500">{formatDate(entry.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingId(entry.id);
                            setEditEntry({ title: entry.title, content: entry.content });
                          }}
                          className="h-7 w-7 p-0 text-gray-500 hover:text-white"
                          data-testid={`button-edit-${entry.id}`}
                        >
                          <Edit3 size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Delete this entry?')) {
                              deleteMutation.mutate(entry.id);
                            }
                          }}
                          className="h-7 w-7 p-0 text-gray-500 hover:text-red-400"
                          data-testid={`button-delete-${entry.id}`}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                    <h4 className="text-white font-medium mt-2">{entry.title}</h4>
                    <p className="text-gray-400 text-sm mt-1 whitespace-pre-wrap">{entry.content}</p>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-purple-500/10 text-center text-xs text-gray-600/70 tracking-wider">
        PLAYBOOK — Your Fantasy Decision Journal
      </div>
    </div>
  );
}
