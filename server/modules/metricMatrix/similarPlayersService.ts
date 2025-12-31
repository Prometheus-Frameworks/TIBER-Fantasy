import { and, eq, gte, ne } from "drizzle-orm";
import { db } from "../../infra/db";
import { 
  metricMatrixPlayerVectors, 
  similarPlayersCache,
  weeklyStats
} from "@shared/schema";
import { getPlayerVector, type PlayerVectorResponse } from "./playerVectorService";

const AXIS_WEIGHTS: Record<string, number> = {
  usage: 1.0,
  efficiency: 1.0,
  td_role: 0.9,
  stability: 1.2,
  context: 1.2,
};

const MIN_CONFIDENCE = 0.7;
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

type SimilarPlayer = {
  playerId: string;
  playerName: string | null;
  team: string | null;
  position: string | null;
  distance: number;
  axesSummary: Record<string, number>;
};

type SimilarPlayersRequest = {
  playerId: string;
  season?: number;
  week?: number;
  mode?: "forge";
  limit?: number;
};

type SimilarPlayersResponse = {
  success: boolean;
  data?: {
    basePlayer: {
      playerId: string;
      playerName: string | null;
      position: string | null;
      confidence: number;
    };
    similarPlayers: SimilarPlayer[];
  };
  reason?: string;
};

function computeWeightedEuclideanDistance(
  vectorA: Record<string, number>,
  vectorB: Record<string, number>
): number {
  let sumSquared = 0;
  let totalWeight = 0;
  
  for (const [key, weight] of Object.entries(AXIS_WEIGHTS)) {
    const valA = vectorA[key] ?? 50;
    const valB = vectorB[key] ?? 50;
    const diff = valA - valB;
    sumSquared += weight * diff * diff;
    totalWeight += weight;
  }
  
  return Math.sqrt(sumSquared / totalWeight);
}

function vectorToRecord(axes: PlayerVectorResponse["axes"]): Record<string, number> {
  const record: Record<string, number> = {};
  for (const axis of axes) {
    record[axis.key] = axis.value;
  }
  return record;
}

async function readCachedSimilarPlayers(
  playerId: string,
  season: number,
  week: number,
  mode: string
): Promise<SimilarPlayer[] | null> {
  const rows = await db
    .select()
    .from(similarPlayersCache)
    .where(
      and(
        eq(similarPlayersCache.playerId, playerId),
        eq(similarPlayersCache.season, season),
        eq(similarPlayersCache.week, week),
        eq(similarPlayersCache.mode, mode)
      )
    )
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  const age = Date.now() - (row.computedAt?.getTime() ?? 0);
  if (age > CACHE_TTL_MS) return null;

  return row.similarPlayersJson as SimilarPlayer[];
}

async function writeCachedSimilarPlayers(
  playerId: string,
  season: number,
  week: number,
  mode: string,
  similarPlayers: SimilarPlayer[],
  baseConfidence: number
): Promise<void> {
  try {
    await db
      .insert(similarPlayersCache)
      .values({
        playerId,
        season,
        week,
        mode,
        similarPlayersJson: similarPlayers,
        baseConfidence,
        computedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [similarPlayersCache.playerId, similarPlayersCache.season, similarPlayersCache.week, similarPlayersCache.mode],
        set: {
          similarPlayersJson: similarPlayers,
          baseConfidence,
          computedAt: new Date(),
        },
      });
  } catch (error) {
    console.warn("[SimilarPlayers] Cache write failed (non-fatal):", error);
  }
}

export async function getSimilarPlayers(
  params: SimilarPlayersRequest
): Promise<SimilarPlayersResponse> {
  const { playerId, mode = "forge", limit = 8 } = params;

  if (!playerId) {
    return { success: false, reason: "playerId is required" };
  }

  try {
    const baseVector = await getPlayerVector({
      playerId,
      season: params.season,
      week: params.week,
      mode,
    });

    if (baseVector.confidence < MIN_CONFIDENCE) {
      return {
        success: false,
        reason: `Insufficient data confidence (${(baseVector.confidence * 100).toFixed(0)}% < ${MIN_CONFIDENCE * 100}%)`,
      };
    }

    const missingAllowed = ["recent_usage_trend", "role_security"];
    const criticalMissing = baseVector.missingInputs.filter(
      (m) => !missingAllowed.includes(m)
    );
    if (criticalMissing.length > 2) {
      return {
        success: false,
        reason: `Too many missing inputs: ${criticalMissing.slice(0, 3).join(", ")}`,
      };
    }

    const season = baseVector.season ?? 2025;
    const week = baseVector.week ?? 1;
    const position = baseVector.position;

    if (!position) {
      return { success: false, reason: "Could not determine player position" };
    }

    const cached = await readCachedSimilarPlayers(playerId, season, week, mode);
    if (cached) {
      return {
        success: true,
        data: {
          basePlayer: {
            playerId: baseVector.playerId,
            playerName: baseVector.playerName,
            position: baseVector.position,
            confidence: baseVector.confidence,
          },
          similarPlayers: cached.slice(0, limit),
        },
      };
    }

    const candidateVectors = await db
      .select()
      .from(metricMatrixPlayerVectors)
      .where(
        and(
          eq(metricMatrixPlayerVectors.season, season),
          eq(metricMatrixPlayerVectors.week, week),
          eq(metricMatrixPlayerVectors.mode, mode),
          gte(metricMatrixPlayerVectors.confidence, MIN_CONFIDENCE),
          ne(metricMatrixPlayerVectors.playerId, playerId)
        )
      );

    const candidates = await Promise.all(
      candidateVectors.map(async (cv) => {
        const latestInfo = await db
          .select({
            playerName: weeklyStats.playerName,
            position: weeklyStats.position,
            team: weeklyStats.team,
          })
          .from(weeklyStats)
          .where(eq(weeklyStats.playerId, cv.playerId))
          .limit(1);

        return {
          playerId: cv.playerId,
          playerName: latestInfo[0]?.playerName ?? null,
          position: latestInfo[0]?.position ?? null,
          team: latestInfo[0]?.team ?? null,
          axes: cv.axesJson as PlayerVectorResponse["axes"],
          confidence: cv.confidence ?? 0,
        };
      })
    );

    const samePositionCandidates = candidates.filter(
      (c) => c.position?.toUpperCase() === position.toUpperCase()
    );

    const baseAxesRecord = vectorToRecord(baseVector.axes);

    const scoredCandidates: SimilarPlayer[] = samePositionCandidates.map((c) => {
      const candidateAxesRecord = vectorToRecord(c.axes);
      const distance = computeWeightedEuclideanDistance(baseAxesRecord, candidateAxesRecord);

      return {
        playerId: c.playerId,
        playerName: c.playerName,
        team: c.team,
        position: c.position,
        distance,
        axesSummary: candidateAxesRecord,
      };
    });

    scoredCandidates.sort((a, b) => a.distance - b.distance);
    const topN = scoredCandidates.slice(0, limit);

    await writeCachedSimilarPlayers(playerId, season, week, mode, topN, baseVector.confidence);

    return {
      success: true,
      data: {
        basePlayer: {
          playerId: baseVector.playerId,
          playerName: baseVector.playerName,
          position: baseVector.position,
          confidence: baseVector.confidence,
        },
        similarPlayers: topN,
      },
    };
  } catch (error: any) {
    console.error("[SimilarPlayers] Error:", error);
    return { success: false, reason: error.message || "Unknown error" };
  }
}
