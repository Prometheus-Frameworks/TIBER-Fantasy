import { useState } from 'react';
import { api, fmt, BUILD } from '@/lib/apiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import AnalyticsTable from '@/components/AnalyticsTable';

export default function ApiTest() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [results, setResults] = useState<any>(null);

  const runTests = async () => {
    setStatus('loading');
    try {
      const [version, health, wrRankings] = await Promise.all([
        api.version(),
        api.health(), 
        api.redraftRankings({ pos: 'WR', limit: 5 })
      ]);
      
      setResults({ version, health, wrRankings });
      setStatus('success');
    } catch (error) {
      setResults({ error: error.message });
      setStatus('error');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'loading': return <Clock className="h-4 w-4 animate-spin" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            API Client Test
            {BUILD && <Badge variant="outline">Build: {BUILD}</Badge>}
          </CardTitle>
          <CardDescription>
            Test the new type-safe API client integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runTests} disabled={status === 'loading'}>
            {status === 'loading' ? 'Testing...' : 'Run API Tests'}
          </Button>
          
          {results && (
            <div className="space-y-4">
              {results.error ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded">
                  <strong>Error:</strong> {results.error}
                </div>
              ) : (
                <>
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <strong>Version:</strong> {results.version?.build || 'N/A'}
                  </div>
                  
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <strong>Health Status:</strong> {results.health?.status || 'N/A'}
                  </div>
                  
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <strong>WR Rankings Sample:</strong>
                    <div className="mt-2 text-sm">
                      {results.wrRankings?.data?.slice(0, 3).map((wr: any) => (
                        <div key={wr.id}>
                          #{wr.rank} {fmt.title(wr.name)} ({wr.team}) - {fmt.two(wr.proj_pts || 0)} pts
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live Analytics Table</CardTitle>
          <CardDescription>
            Demonstrating the new API client with real WR rankings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnalyticsTable />
        </CardContent>
      </Card>
    </div>
  );
}