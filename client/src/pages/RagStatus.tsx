import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { Search, Loader2 } from 'lucide-react';

interface RagStatusData {
  success: boolean;
  tables: {
    chunks: { count: number };
    chat_sessions: { count: number };
    chat_messages: { count: number };
  };
  pgvector_enabled: boolean;
  pgvector_version: string | null;
  sample_chunks: Array<{
    id: number;
    content_preview: string;
    metadata: any;
    created_at: string;
  }>;
  recent_sessions: Array<{
    id: string;
    user_level: number;
    message_count: number;
    updated_at: string;
  }>;
  timestamp: string;
}

interface SearchResult {
  id: number;
  content: string;
  content_preview: string;
  metadata: any;
  similarity: number;
}

interface SearchResponse {
  success: boolean;
  query: string;
  results: SearchResult[];
  count: number;
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

export default function RagStatus() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatResponse, setChatResponse] = useState<ChatResponse | null>(null);

  const { data, isLoading, error } = useQuery<RagStatusData>({
    queryKey: ['/api/admin/rag-status'],
    refetchInterval: 30000,
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest<SearchResponse>('/api/admin/rag/search', {
        method: 'POST',
        body: JSON.stringify({ query, limit: 3 }),
      });
      return response;
    },
    onSuccess: (data) => {
      setSearchResults(data.results);
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery);
    }
  };

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/rag/chat', { message, user_level: 1 });
      return response.json();
    },
    onSuccess: (data) => {
      setChatResponse(data);
    },
  });

  const handleChat = () => {
    if (chatMessage.trim()) {
      chatMutation.mutate(chatMessage);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">RAG System Status</h1>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">RAG System Status</h1>
          <p className="text-red-400">Error loading status: {error?.message || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">RAG System Status</h1>
          <Badge variant={data.pgvector_enabled ? 'default' : 'destructive'}>
            {data.pgvector_enabled ? `pgvector ${data.pgvector_version}` : 'pgvector disabled'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-[#141824] border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">Chunks</CardTitle>
              <CardDescription>Embedded narratives</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-400">{data.tables.chunks.count}</p>
            </CardContent>
          </Card>

          <Card className="bg-[#141824] border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">Sessions</CardTitle>
              <CardDescription>Chat conversations</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-400">{data.tables.chat_sessions.count}</p>
            </CardContent>
          </Card>

          <Card className="bg-[#141824] border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">Messages</CardTitle>
              <CardDescription>Total chat messages</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-400">{data.tables.chat_messages.count}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-[#141824] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Sample Chunks</CardTitle>
            <CardDescription>Most recent embedded content (limit 5)</CardDescription>
          </CardHeader>
          <CardContent>
            {data.sample_chunks.length === 0 ? (
              <p className="text-gray-400">No chunks yet</p>
            ) : (
              <div className="space-y-4">
                {data.sample_chunks.map((chunk) => (
                  <div key={chunk.id} className="border border-gray-700 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">ID: {chunk.id}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(chunk.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-3">{chunk.content_preview}...</p>
                    {chunk.metadata && (
                      <div className="flex gap-2 flex-wrap">
                        {chunk.metadata.position && (
                          <Badge variant="outline" className="text-xs">{chunk.metadata.position}</Badge>
                        )}
                        {chunk.metadata.week && (
                          <Badge variant="outline" className="text-xs">Week {chunk.metadata.week}</Badge>
                        )}
                        {chunk.metadata.season && (
                          <Badge variant="outline" className="text-xs">{chunk.metadata.season}</Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#141824] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Recent Sessions</CardTitle>
            <CardDescription>Latest chat conversations (limit 10)</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recent_sessions.length === 0 ? (
              <p className="text-gray-400">No sessions yet</p>
            ) : (
              <div className="space-y-2">
                {data.recent_sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between border border-gray-700 rounded-lg p-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm text-gray-400 font-mono">{session.id.substring(0, 8)}...</p>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          Level {session.user_level}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {session.message_count} messages
                        </Badge>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(session.updated_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#141824] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Test Semantic Search</CardTitle>
            <CardDescription>Test vector similarity search using Gemini embeddings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                data-testid="input-search-query"
                type="text"
                placeholder="Try: 'safe floor player' or 'breakout candidates'"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-[#0a0e1a] border-gray-700 text-white placeholder:text-gray-500"
              />
              <Button
                data-testid="button-search"
                onClick={handleSearch}
                disabled={searchMutation.isPending || !searchQuery.trim()}
                className="bg-blue-500 hover:bg-blue-600"
              >
                {searchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {searchMutation.isError && (
              <p className="text-sm text-red-400">
                Error: {(searchMutation.error as Error)?.message || 'Search failed'}
              </p>
            )}

            {searchResults && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  Found {searchResults.length} results for "{searchMutation.data?.query}"
                </p>
                {searchResults.map((result, idx) => (
                  <div
                    key={result.id}
                    data-testid={`search-result-${idx}`}
                    className="border border-gray-700 rounded-lg p-4 space-y-2 bg-[#0a0e1a]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                          {(result.similarity * 100).toFixed(1)}% match
                        </Badge>
                        <span className="text-xs text-gray-500">ID: {result.id}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300">{result.content_preview}...</p>
                    {result.metadata && (
                      <div className="flex gap-2 flex-wrap">
                        {result.metadata.player_id && (
                          <Badge variant="outline" className="text-xs">
                            {result.metadata.player_id}
                          </Badge>
                        )}
                        {result.metadata.position && (
                          <Badge variant="outline" className="text-xs">
                            {result.metadata.position}
                          </Badge>
                        )}
                        {result.metadata.week && (
                          <Badge variant="outline" className="text-xs">
                            Week {result.metadata.week}
                          </Badge>
                        )}
                        {result.metadata.tags && result.metadata.tags.slice(0, 3).map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs bg-purple-500/10 text-purple-400">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {searchResults === null && !searchMutation.isPending && (
              <p className="text-sm text-gray-500 text-center py-4">
                Enter a query to test semantic search
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#141824] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Test RAG Chat (with Citations)</CardTitle>
            <CardDescription>Ask TIBER a question and see source citations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                data-testid="input-chat-message"
                type="text"
                placeholder="Ask: 'Should I trade for Jaylen Warren?'"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                className="bg-[#0a0e1a] border-gray-700 text-white placeholder:text-gray-500"
              />
              <Button
                data-testid="button-chat"
                onClick={handleChat}
                disabled={chatMutation.isPending || !chatMessage.trim()}
                className="bg-purple-500 hover:bg-purple-600"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Ask'
                )}
              </Button>
            </div>

            {chatMutation.isError && (
              <p className="text-sm text-red-400">
                Error: {(chatMutation.error as Error)?.message || 'Chat failed'}
              </p>
            )}

            {chatResponse && (
              <div className="space-y-4">
                <div className="border border-blue-500/30 rounded-lg p-4 bg-blue-500/5">
                  <p className="text-sm font-semibold text-blue-400 mb-2">TIBER Response:</p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{chatResponse.response}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-400">
                    Sources ({chatResponse.sources.length} chunks):
                  </p>
                  {chatResponse.sources.map((source, idx) => (
                    <div
                      key={source.chunk_id}
                      data-testid={`chat-source-${idx}`}
                      className="border border-gray-700 rounded-lg p-3 bg-[#0a0e1a] space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
                          Source {idx + 1}: {(source.relevance_score * 100).toFixed(1)}% match
                        </Badge>
                        <span className="text-xs text-gray-500">Chunk #{source.chunk_id}</span>
                      </div>
                      <p className="text-xs text-gray-400">{source.content_preview}...</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!chatResponse && !chatMutation.isPending && (
              <p className="text-sm text-gray-500 text-center py-4">
                Ask a fantasy football question to see TIBER's response with citations
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-gray-500 text-center">
          Last updated: {new Date(data.timestamp).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
