import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';
import { fetchForgeBatch } from '../api/forge';
import ForgeRankingsTable, { ForgeRow } from '../components/ForgeRankingsTable';
import type { ForgeScore } from '../types/forge';

interface RBSandboxPlayer {
  playerId: string;
  playerName: string;
  team: string;
  gamesPlayed: number;
  totalCarries: number;
  totalRushingYards: number;
  fantasyPoints: number;
  fantasyPointsPerRushAttempt: number;
  totalTargets: number;
  totalReceptions: number;
  totalReceivingYards: number;
  receivingFantasyPerGame: number;
  weightedOppPerGame: number;
  fpPerOpp: number;
  injuryStatus: string | null;
  injuryType: string | null;
}

interface RBSandboxResponse {
  success: boolean;
  data: RBSandboxPlayer[];
  season: number;
  count: number;
}

export default function RBRankings() {
  const [season, setSeason] = useState(2025);
  const [week, setWeek] = useState<number | null>(10);
  
  const [forgeByPlayerId, setForgeByPlayerId] = useState<Record<string, ForgeScore>>({});
  const [forgeLoading, setForgeLoading] = useState(false);
  const [forgeError, setForgeError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<RBSandboxResponse>({
    queryKey: ['/api/admin/rb-rankings-sandbox', { season }],
    queryFn: () => fetch(`/api/admin/rb-rankings-sandbox?season=${season}`).then(res => res.json()),
  });

  useEffect(() => {
    const loadForge = async () => {
      try {
        setForgeLoading(true);
        setForgeError(null);
        const res = await fetchForgeBatch({ 
          position: 'RB', 
          limit: 500, 
          season, 
          week: week ?? 17 
        });
        const map: Record<string, ForgeScore> = {};
        for (const s of res.scores) {
          map[s.playerId] = s;
        }
        setForgeByPlayerId(map);
      } catch (err: any) {
        setForgeError(err.message ?? 'Failed to load FORGE RB scores');
      } finally {
        setForgeLoading(false);
      }
    };

    loadForge();
  }, [season, week]);

  const rows: ForgeRow[] = useMemo(() => {
    if (!data?.data) return [];
    
    return data.data.map((player) => {
      const forge = forgeByPlayerId[player.playerId];
      const sandboxAlpha = Math.min(100, Math.round((player.fantasyPoints / Math.max(player.gamesPlayed, 1)) * 5));
      
      return {
        playerId: player.playerId,
        canonicalId: player.playerId,
        playerName: player.playerName,
        team: player.team,
        gamesPlayed: player.gamesPlayed,
        sandboxAlpha,
        forgeAlpha: forge?.alpha,
        forgeRawAlpha: forge?.rawAlpha,
        forgeConfidence: forge?.confidence,
        forgeTrajectory: forge?.trajectory,
        injuryStatus: player.injuryStatus,
        extraColumns: {
          carries: player.totalCarries,
          rushYds: player.totalRushingYards,
          targets: player.totalTargets,
          fp: player.fantasyPoints,
          wOppG: player.weightedOppPerGame,
        },
      };
    });
  }, [data, forgeByPlayerId]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
            <p className="text-red-400">Failed to load RB rankings data</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors" data-testid="back-link">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white" data-testid="page-title">RB Rankings</h1>
              <p className="text-sm text-slate-400">Sandbox Alpha vs FORGE Alpha comparison</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
              data-testid="refresh-button"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <ForgeRankingsTable
          position="RB"
          rows={rows}
          isLoading={isLoading}
          forgeLoading={forgeLoading}
          forgeError={forgeError}
          season={season}
          week={week}
          onSeasonChange={setSeason}
          onWeekChange={setWeek}
          extraColumnDefs={[
            { key: 'carries', label: 'Car' },
            { key: 'targets', label: 'Tgt' },
            { key: 'fp', label: 'FP', format: (v) => v?.toFixed(1) ?? '—' },
            { key: 'wOppG', label: 'wOpp/G', format: (v) => v?.toFixed(1) ?? '—' },
          ]}
        />
      </div>
    </div>
  );
}
