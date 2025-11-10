import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

export default function RagStatus() {
  const { data, isLoading, error } = useQuery<RagStatusData>({
    queryKey: ['/api/admin/rag-status'],
    refetchInterval: 30000,
  });

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

        <p className="text-xs text-gray-500 text-center">
          Last updated: {new Date(data.timestamp).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
