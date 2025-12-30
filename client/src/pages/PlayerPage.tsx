import { useState } from 'react';
import { useRoute, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import MetricMatrixCard from '@/components/metricMatrix/MetricMatrixCard';
import TiberScoreCard from '@/components/tiber/TiberScoreCard';

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

export default function PlayerPage() {
  const [, params] = useRoute('/player/:playerId');
  const playerId = params?.playerId || '';
  
  const [mode, setMode] = useState<'weekly' | 'season'>('weekly');
  const [week, setWeek] = useState(3);
  const [season] = useState(2025);

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

        {/* Player Header */}
        <div className="bg-[#141824] border border-gray-800/50 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-wide" data-testid="text-player-name">
                {player.fullName}
              </h1>
              <p className="text-lg text-gray-400 mt-1" data-testid="text-player-info">
                {player.nflTeam || 'FA'} • {player.position}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Player ID</p>
              <p className="text-sm font-mono text-gray-400">{playerId}</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Mode Toggle */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'weekly' | 'season')} className="w-auto">
            <TabsList className="bg-gray-800/50 border border-gray-700/50">
              <TabsTrigger 
                value="weekly" 
                data-testid="tab-mode-weekly"
                className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"
              >
                Weekly
              </TabsTrigger>
              <TabsTrigger 
                value="season" 
                data-testid="tab-mode-season"
                className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400"
              >
                Season
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Week Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Week:</span>
            <select
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
              data-testid="select-week"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((w) => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
          </div>

          {/* Season Display */}
          <div className="text-sm text-gray-400">
            Season: <span className="text-white font-medium">{season}</span>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* TIBER Score Card */}
          <div className="lg:col-span-2">
            <TiberScoreCard
              nflfastrId={nflfastrId}
              week={week}
              season={season}
              mode={mode}
              position={player.position}
            />
          </div>

          {/* Metric Matrix Card */}
          <div className="lg:col-span-2">
            <MetricMatrixCard
              playerId={nflfastrId}
              season={season}
              week={week}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-6 border-t border-gray-800/50">
          <p className="text-xs text-gray-600 tracking-wide">
            TIBER v1.0 — Tactical Index for Breakout Efficiency & Regression
          </p>
        </div>
      </div>
    </div>
  );
}
