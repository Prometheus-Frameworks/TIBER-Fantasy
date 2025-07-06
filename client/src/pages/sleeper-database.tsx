import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, TrendingUp, TrendingDown, Database, Camera, BarChart3, RefreshCw, AlertCircle, Clock, User } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import MobileNav from "@/components/mobile-nav";

interface TrendingPlayer {
  player_id: string;
  count: number;
}

interface PlayerPhoto {
  success: boolean;
  playerId: string;
  photoUrl: string;
  size: string;
}

export default function SleeperDatabase() {
  const [syncType, setSyncType] = useState<'players' | 'gamelogs'>('players');
  const [trendingType, setTrendingType] = useState<'add' | 'drop'>('add');
  const [trendingHours, setTrendingHours] = useState('24');
  const [gameLogSeason, setGameLogSeason] = useState('2024');
  const [gameLogWeek, setGameLogWeek] = useState('18');
  const [testPlayerId, setTestPlayerId] = useState('4017'); // Josh Allen's Sleeper ID
  const [photoSize, setPhotoSize] = useState<'small' | 'medium' | 'large'>('medium');

  // Trending players query
  const { data: trendingData, isLoading: trendingLoading, refetch: refetchTrending } = useQuery({
    queryKey: ['/api/sleeper/trending', trendingType, trendingHours],
    queryFn: async () => {
      const response = await fetch(`/api/sleeper/trending/${trendingType}?hours=${trendingHours}&limit=10`);
      if (!response.ok) throw new Error('Failed to fetch trending players');
      return await response.json();
    },
  });

  // Player photo query
  const { data: photoData, isLoading: photoLoading, refetch: refetchPhoto } = useQuery({
    queryKey: ['/api/sleeper/player/photo', testPlayerId, photoSize],
    queryFn: async () => {
      const response = await fetch(`/api/sleeper/player/${testPlayerId}/photo?size=${photoSize}`);
      if (!response.ok) throw new Error('Failed to fetch player photo');
      return await response.json();
    },
    enabled: !!testPlayerId,
  });

  // Sync status polling
  const { data: syncStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/sleeper/sync/status'],
    queryFn: async () => {
      const response = await fetch('/api/sleeper/sync/status');
      if (!response.ok) throw new Error('Failed to fetch sync status');
      return await response.json();
    },
    refetchInterval: syncType === 'players' ? 2000 : false, // Poll every 2 seconds during player sync
  });

  // Player sync mutation
  const playerSyncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/sleeper/sync/players', 'POST', {});
    },
    onSuccess: () => {
      // Start polling for status updates
      refetchStatus();
    }
  });

  // Game logs sync mutation
  const gameLogsSyncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/sleeper/sync/gamelogs', 'POST', {
        season: parseInt(gameLogSeason),
        week: parseInt(gameLogWeek),
        seasonType: 'regular'
      });
    },
  });

  const handleSync = () => {
    if (syncType === 'players') {
      playerSyncMutation.mutate();
    } else {
      gameLogsSyncMutation.mutate();
    }
  };

  const handleTrendingRefresh = () => {
    refetchTrending();
  };

  const handlePhotoTest = () => {
    refetchPhoto();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 md:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Sleeper Player Database</h1>
            <p className="text-sm text-gray-600">
              Comprehensive NFL player data sync with game logs, photos, and physical stats
            </p>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Database className="w-3 h-3 mr-1" />
            Sleeper API
          </Badge>
        </div>
      </div>

      <div className="container mx-auto p-4 md:p-6 space-y-6 pb-20">
        
        {/* Data Sync Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Data Synchronization
            </CardTitle>
            <CardDescription>
              Sync player profiles and game logs from Sleeper's API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-sm font-medium">Sync Type</label>
                <Select value={syncType} onValueChange={(value: 'players' | 'gamelogs') => setSyncType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="players">All Players (Physical Stats, Photos)</SelectItem>
                    <SelectItem value="gamelogs">Game Logs (Weekly Stats)</SelectItem>
                  </SelectContent>
                </Select>
                
                {syncType === 'gamelogs' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Season</label>
                      <Input
                        value={gameLogSeason}
                        onChange={(e) => setGameLogSeason(e.target.value)}
                        placeholder="2024"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Week</label>
                      <Input
                        value={gameLogWeek}
                        onChange={(e) => setGameLogWeek(e.target.value)}
                        placeholder="18"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <Button 
                  onClick={handleSync}
                  disabled={
                    playerSyncMutation.isPending || 
                    gameLogsSyncMutation.isPending || 
                    (syncStatus?.success && syncStatus.status?.isRunning)
                  }
                  className="w-full"
                >
                  {(playerSyncMutation.isPending || gameLogsSyncMutation.isPending || (syncStatus?.success && syncStatus.status?.isRunning)) ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      {syncStatus?.success && syncStatus.status?.isRunning 
                        ? `Syncing... ${syncStatus.status.progress}%` 
                        : 'Starting Sync...'}
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      Start {syncType === 'players' ? 'Full Player' : 'Game Logs'} Sync
                    </>
                  )}
                </Button>
                
                {syncType === 'players' && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Note:</strong> Full player sync processes ~3,000+ NFL players. Use sparingly (once per day recommended).
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            {/* Real-time Sync Status */}
            {syncStatus?.success && syncStatus.status && (
              <div className="space-y-3">
                {syncStatus.status.isRunning && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span><strong>Phase:</strong> {syncStatus.status.currentPhase}</span>
                          <span><strong>Progress:</strong> {syncStatus.status.progress}%</span>
                        </div>
                        
                        {syncStatus.status.total > 0 && (
                          <div className="w-full bg-blue-100 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${syncStatus.status.progress}%` }}
                            />
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <strong>Players:</strong> {syncStatus.status.processed}/{syncStatus.status.total}
                          </div>
                          <div>
                            <strong>Errors:</strong> {syncStatus.status.errors}
                          </div>
                          {syncStatus.status.estimatedTimeRemaining > 0 && (
                            <div className="col-span-2">
                              <strong>ETA:</strong> ~{Math.round(syncStatus.status.estimatedTimeRemaining / 60)} minutes
                            </div>
                          )}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                
                {syncStatus.status.currentPhase === 'complete' && !syncStatus.status.isRunning && (
                  <Alert className="border-green-200 bg-green-50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      ✅ Sync completed! Processed {syncStatus.status.processed} players with {syncStatus.status.errors} errors.
                    </AlertDescription>
                  </Alert>
                )}
                
                {syncStatus.status.currentPhase === 'error' && !syncStatus.status.isRunning && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      ❌ Sync failed: {syncStatus.status.lastError}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Sync Results */}
            {(playerSyncMutation.data || playerSyncMutation.error) && (
              <Alert className={playerSyncMutation.error ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {playerSyncMutation.error 
                    ? `Player sync failed: ${playerSyncMutation.error.message}`
                    : `✅ ${playerSyncMutation.data?.message}`
                  }
                </AlertDescription>
              </Alert>
            )}

            {(gameLogsSyncMutation.data || gameLogsSyncMutation.error) && (
              <Alert className={gameLogsSyncMutation.error ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {gameLogsSyncMutation.error 
                    ? `Game logs sync failed: ${gameLogsSyncMutation.error.message}`
                    : `✅ ${gameLogsSyncMutation.data?.message}`
                  }
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Trending Players Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {trendingType === 'add' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              Trending Players
            </CardTitle>
            <CardDescription>
              Most added/dropped players in fantasy leagues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Select value={trendingType} onValueChange={(value: 'add' | 'drop') => setTrendingType(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Most Added</SelectItem>
                  <SelectItem value="drop">Most Dropped</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={trendingHours} onValueChange={setTrendingHours}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last Hour</SelectItem>
                  <SelectItem value="24">Last 24h</SelectItem>
                  <SelectItem value="168">Last Week</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                onClick={handleTrendingRefresh}
                disabled={trendingLoading}
              >
                <RefreshCw className={`w-4 h-4 ${trendingLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {trendingLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading trending players...</span>
              </div>
            ) : trendingData?.success ? (
              <div className="space-y-2">
                {trendingData.players?.slice(0, 8).map((playerId: string, index: number) => (
                  <div key={playerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <div className="font-mono text-sm text-gray-600">ID: {playerId}</div>
                        <div className="text-xs text-gray-500">
                          {trendingType === 'add' ? 'Being added to rosters' : 'Being dropped from rosters'}
                        </div>
                      </div>
                    </div>
                    <Badge variant={trendingType === 'add' ? 'default' : 'secondary'}>
                      {trendingType === 'add' ? 'HOT' : 'COLD'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load trending players. Please try again.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Player Photos Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Player Photos
            </CardTitle>
            <CardDescription>
              Test player photo URL generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Player ID</label>
                  <Input
                    value={testPlayerId}
                    onChange={(e) => setTestPlayerId(e.target.value)}
                    placeholder="4017 (Josh Allen)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Try: 4017 (Josh Allen), 4046 (Lamar Jackson), 6794 (Justin Jefferson)
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Photo Size</label>
                  <Select value={photoSize} onValueChange={(value: 'small' | 'medium' | 'large') => setPhotoSize(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small (64px)</SelectItem>
                      <SelectItem value="medium">Medium (128px)</SelectItem>
                      <SelectItem value="large">Large (256px)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button onClick={handlePhotoTest} disabled={photoLoading} className="w-full">
                  {photoLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 mr-2" />
                      Get Photo URL
                    </>
                  )}
                </Button>
              </div>
              
              <div className="space-y-3">
                {photoData?.success && (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center gap-3 mb-3">
                      <User className="w-5 h-5 text-gray-500" />
                      <span className="font-medium">Player {photoData.playerId}</span>
                      <Badge variant="outline">{photoData.size}</Badge>
                    </div>
                    
                    <div className="bg-white p-3 rounded border">
                      <img 
                        src={photoData.photoUrl} 
                        alt={`Player ${photoData.playerId}`}
                        className="w-16 h-16 rounded-lg object-cover mx-auto"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/api/placeholder/64/64?text=No+Photo';
                        }}
                      />
                      <p className="text-xs text-gray-500 mt-2 break-all">
                        {photoData.photoUrl}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Features Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Database Features
            </CardTitle>
            <CardDescription>
              Comprehensive player data now available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-green-700 mb-2">✅ Player Profiles</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Name, position, team</li>
                  <li>• Age, height, weight</li>
                  <li>• College, experience</li>
                  <li>• Jersey number</li>
                </ul>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-green-700 mb-2">✅ Game Logs</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Weekly fantasy points</li>
                  <li>• Passing/rushing/receiving</li>
                  <li>• Season and playoff stats</li>
                  <li>• Historical performance</li>
                </ul>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-green-700 mb-2">✅ Player Photos</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• High-quality headshots</li>
                  <li>• Multiple size options</li>
                  <li>• Direct Sleeper CDN URLs</li>
                  <li>• Real-time access</li>
                </ul>
              </div>
            </div>
            
            <Alert className="mt-4">
              <Database className="h-4 w-4" />
              <AlertDescription>
                <strong>Database Integration:</strong> All data is synced to your PostgreSQL database with proper relations, 
                unique constraints, and automatic deduplication. Game logs are stored with week-by-week granularity 
                for advanced analytics and trend analysis.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      <MobileNav />
    </div>
  );
}