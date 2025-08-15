import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Target, CheckCircle, XCircle, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SnapCountsResponse {
  claim: string;
  pos: string;
  snap_delta_pp: number;
}

interface ExamplesResponse {
  examples: string[];
  label: string;
  total: number;
}

interface HealthResponse {
  status: string;
  message: string;
}

export default function SnapCounts() {
  const [position, setPosition] = useState('WR');
  const [snapPP, setSnapPP] = useState('10');
  const [showAllHits, setShowAllHits] = useState(false);
  const [showAllMisses, setShowAllMisses] = useState(false);

  // Health check query
  const { data: health } = useQuery<HealthResponse>({
    queryKey: ['/api/snap-counts/health'],
    staleTime: 30 * 1000, // 30 seconds
  });

  // Claim query 
  const { data: claim, isLoading: claimLoading, error: claimError } = useQuery<SnapCountsResponse>({
    queryKey: ['/api/snap-counts/claim', position, snapPP],
    enabled: !!position && !!snapPP && !isNaN(parseInt(snapPP)),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Examples queries
  const { data: hitExamples, isLoading: hitLoading } = useQuery<ExamplesResponse>({
    queryKey: ['/api/snap-counts/examples/HIT', showAllHits],
    queryFn: () => fetch(`/api/snap-counts/examples/HIT${showAllHits ? '?all=true' : ''}`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: missExamples, isLoading: missLoading } = useQuery<ExamplesResponse>({
    queryKey: ['/api/snap-counts/examples/MISS', showAllMisses],
    queryFn: () => fetch(`/api/snap-counts/examples/MISS${showAllMisses ? '?all=true' : ''}`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const positions = ['WR', 'RB', 'TE'];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Snap Count Analysis</h1>
        <p className="text-muted-foreground mb-4">
          Evidence-based snap count predictions using historical patterns and real examples
        </p>
        
        {/* Health Status */}
        {health && (
          <div className="flex items-center gap-2 mb-6">
            <Activity className={`w-4 h-4 ${health.status === 'healthy' ? 'text-green-500' : 'text-red-500'}`} />
            <span className={`text-sm ${health.status === 'healthy' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {health.message}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Claims Analyzer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Snap Count Claims
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Position</label>
                <div className="flex gap-1">
                  {positions.map(pos => (
                    <Button
                      key={pos}
                      variant={position === pos ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPosition(pos)}
                    >
                      {pos}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Snap % Increase</label>
                <Input
                  type="number"
                  value={snapPP}
                  onChange={(e) => setSnapPP(e.target.value)}
                  placeholder="10"
                  className="w-20"
                />
              </div>
            </div>

            {/* Claim Result */}
            <div className="bg-muted/30 rounded-lg p-4">
              {claimLoading ? (
                <Skeleton className="h-6 w-3/4" />
              ) : claimError ? (
                <p className="text-red-600 dark:text-red-400">
                  Failed to load claim data
                </p>
              ) : claim ? (
                <div>
                  <p className="font-medium">{claim.claim}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Based on historical data (half-PPR scoring)
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Enter position and snap percentage to see prediction
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Examples Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Quick Examples
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="font-medium text-green-700 dark:text-green-400">
                    Hits ({hitExamples?.total || 0})
                  </span>
                </div>
                {hitLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {hitExamples?.examples.slice(0, 2).map((example, i) => (
                      <p key={i} className="mb-1">{example}</p>
                    )) || 'No hit examples available'}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="font-medium text-red-700 dark:text-red-400">
                    Misses ({missExamples?.total || 0})
                  </span>
                </div>
                {missLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {missExamples?.examples.slice(0, 2).map((example, i) => (
                      <p key={i} className="mb-1">{example}</p>
                    )) || 'No miss examples available'}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Examples */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Historical Examples</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="hits" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="hits" className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Hits
              </TabsTrigger>
              <TabsTrigger value="misses" className="flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Misses
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hits" className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                  {hitExamples?.total || 0} Total Examples
                </Badge>
                {hitExamples && hitExamples.examples.length > 4 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllHits(!showAllHits)}
                  >
                    {showAllHits ? 'Show Less' : 'Show All'}
                  </Button>
                )}
              </div>
              
              <div className="space-y-2">
                {hitExamples?.examples.map((example, i) => (
                  <div key={i} className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <p className="text-sm">{example}</p>
                  </div>
                )) || (
                  <p className="text-muted-foreground">No hit examples available</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="misses" className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                  {missExamples?.total || 0} Total Examples
                </Badge>
                {missExamples && missExamples.examples.length > 4 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllMisses(!showAllMisses)}
                  >
                    {showAllMisses ? 'Show Less' : 'Show All'}
                  </Button>
                )}
              </div>
              
              <div className="space-y-2">
                {missExamples?.examples.map((example, i) => (
                  <div key={i} className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-sm">{example}</p>
                  </div>
                )) || (
                  <p className="text-muted-foreground">No miss examples available</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}