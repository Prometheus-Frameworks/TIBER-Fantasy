import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchForgeBatch } from '../api/forge';
import AlphaRankingsLayout from '../components/AlphaRankingsLayout';
import RBFormulaWeightsPanel from '../components/RBFormulaWeightsPanel';
import ForgeRankingsTable, { ForgeRow } from '../components/ForgeRankingsTable';
import ForgeTransparencyPanel from '../components/ForgeTransparencyPanel';
import type { ForgeScore } from '../types/forge';

interface RBSandboxPlayer {
  playerId: string;
  canonicalId: string | null;
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
  alphaScore: number;
  forge_alpha_base: number;
  forge_alpha_env: number;
  forge_env_multiplier: number;
  forge_env_score_100: number | null;
  injuryStatus: string | null;
  injuryType: string | null;
}

interface RBSandboxResponse {
  success: boolean;
  data: RBSandboxPlayer[];
  season: number;
  count: number;
}

interface RBWeights {
  volume: number;
  efficiency: number;
  roleLeverage: number;
  stability: number;
  contextFit: number;
}

const DEFAULT_RB_WEIGHTS: RBWeights = {
  volume: 38,
  efficiency: 25,
  roleLeverage: 20,
  stability: 12,
  contextFit: 5,
};

export default function RBRankings() {
  const [season, setSeason] = useState(2025);
  const [week, setWeek] = useState<number | null>(10);
  const [weights, setWeights] = useState<RBWeights>(DEFAULT_RB_WEIGHTS);
  
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
    
    const totalWeight = weights.volume + weights.efficiency + weights.roleLeverage + weights.stability + weights.contextFit;
    const normalize = totalWeight > 0 ? 100 / totalWeight : 1;
    
    return data.data.map((player) => {
      const forgeKey = player.canonicalId ?? player.playerId;
      const forge = forgeByPlayerId[forgeKey];
      
      const gamesPlayed = Math.max(player.gamesPlayed, 1);
      const carriesPerGame = player.totalCarries / gamesPlayed;
      const yardsPerCarry = player.totalCarries > 0 ? player.totalRushingYards / player.totalCarries : 0;
      const fpPerGame = player.fantasyPoints / gamesPlayed;
      const recWorkPerGame = (player.totalTargets + player.totalReceptions) / gamesPlayed;
      
      const volumeScore = Math.min(100, carriesPerGame * 5);
      const efficiencyScore = Math.min(100, yardsPerCarry * 20);
      const roleScore = Math.min(100, (player.weightedOppPerGame || 0) * 4);
      const stabilityScore = Math.min(100, fpPerGame * 4);
      const contextScore = Math.min(100, recWorkPerGame * 8);
      
      const sandboxAlpha = (
        (volumeScore * weights.volume +
         efficiencyScore * weights.efficiency +
         roleScore * weights.roleLeverage +
         stabilityScore * weights.stability +
         contextScore * weights.contextFit) * normalize / 100
      );
      
      return {
        playerId: player.playerId,
        canonicalId: forgeKey,
        playerName: player.playerName,
        team: player.team,
        gamesPlayed: player.gamesPlayed,
        sandboxAlpha: Math.round(sandboxAlpha * 10) / 10,
        forgeAlpha: player.alphaScore ?? forge?.alpha,
        forgeRawAlpha: player.forge_alpha_base ?? forge?.rawAlpha,
        forgeConfidence: forge?.confidence,
        forgeTrajectory: forge?.trajectory,
        forgeEnvScore: player.forge_env_score_100,
        forgeEnvMultiplier: player.forge_env_multiplier,
        injuryStatus: player.injuryStatus,
        extraColumns: {
          carries: player.totalCarries,
          targets: player.totalTargets,
          fp: player.fantasyPoints,
          wOppG: player.weightedOppPerGame,
        },
      };
    });
  }, [data, forgeByPlayerId, weights]);

  if (error) {
    return (
      <AlphaRankingsLayout position="RB">
        <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">Failed to load RB rankings data</p>
        </div>
      </AlphaRankingsLayout>
    );
  }

  return (
    <AlphaRankingsLayout 
      position="RB" 
      onRefresh={() => refetch()}
      isRefreshing={isLoading}
    >
      <RBFormulaWeightsPanel
        weights={weights}
        onWeightsChange={setWeights}
        defaultCollapsed={true}
      />

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

      <ForgeTransparencyPanel position="RB" />
    </AlphaRankingsLayout>
  );
}
