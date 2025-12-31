import { runForgeEngineBatch, type Position as EGPosition } from "../forge/forgeEngine";
import { gradeForgeWithMeta, type ViewMode } from "../forge/forgeGrading";

type TierNeighbor = {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  alpha: number;
  tier: string;
};

type TiersNeighborsRequest = {
  playerId: string;
  position?: string;
  format?: "dynasty" | "redraft" | "bestball";
  limit?: number;
};

type TiersNeighborsResponse = {
  success: boolean;
  data?: {
    currentPlayer: TierNeighbor | null;
    rank: number | null;
    above: TierNeighbor[];
    below: TierNeighbor[];
  };
  reason?: string;
};

async function computeForgeRankings(
  position: EGPosition,
  mode: ViewMode
): Promise<{ playerId: string; playerName: string; team: string; position: string; alpha: number; tier: string }[]> {
  const engineResults = await runForgeEngineBatch(position, 2025, "season", 200);

  const scores = engineResults.map((result) => {
    const graded = gradeForgeWithMeta(result, { mode });
    return {
      playerId: result.playerId,
      playerName: result.playerName,
      team: result.nflTeam || "FA",
      position: result.position,
      alpha: graded.alpha,
      tier: graded.tier,
    };
  });

  scores.sort((a, b) => b.alpha - a.alpha);
  return scores;
}

export async function getTiersNeighbors(
  params: TiersNeighborsRequest
): Promise<TiersNeighborsResponse> {
  const { playerId, position, format = "dynasty", limit = 5 } = params;

  if (!playerId) {
    return { success: false, reason: "playerId is required" };
  }

  try {
    const searchPositions: EGPosition[] = position 
      ? [position.toUpperCase() as EGPosition]
      : ["WR", "RB", "TE", "QB"];

    for (const pos of searchPositions) {
      const scores = await computeForgeRankings(pos, format);
      const playerIndex = scores.findIndex((s) => s.playerId === playerId);
      
      if (playerIndex !== -1) {
        return buildNeighborsResponse(scores, playerIndex, limit);
      }
    }

    return { success: false, reason: "Player not found in any position rankings" };
  } catch (error: any) {
    console.error("[TiersNeighbors] Error:", error);
    return { success: false, reason: error.message || "Unknown error" };
  }
}

function buildNeighborsResponse(
  scores: TierNeighbor[],
  playerIndex: number,
  limit: number
): TiersNeighborsResponse {
  const currentPlayer = scores[playerIndex];

  const aboveStart = Math.max(0, playerIndex - limit);
  const aboveEnd = playerIndex;
  const above = scores.slice(aboveStart, aboveEnd).reverse();

  const belowStart = playerIndex + 1;
  const belowEnd = Math.min(scores.length, belowStart + limit);
  const below = scores.slice(belowStart, belowEnd);

  return {
    success: true,
    data: {
      currentPlayer,
      rank: playerIndex + 1,
      above,
      below,
    },
  };
}
