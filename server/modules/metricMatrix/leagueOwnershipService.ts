import { storage } from "../../storage";
import { sleeperClient, type SleeperRoster, type SleeperUser } from "../../integrations/sleeperClient";
import { db } from "../../infra/db";
import { playerIdentityMap } from "@shared/schema";
import { eq } from "drizzle-orm";

type OwnershipStatus = "on_my_roster" | "owned_by_other" | "free_agent" | "unknown";

type LeagueOwnershipRequest = {
  playerId: string;
  userId?: string;
  leagueId?: string;
};

type LeagueOwnershipResponse = {
  success: boolean;
  enabled: boolean;
  data?: {
    status: OwnershipStatus;
    ownerTeamName?: string;
    ownerDisplayName?: string;
    isOnMyTeam: boolean;
  };
  reason?: string;
};

const ownershipCache = new Map<string, { data: LeagueOwnershipResponse; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getSleeperId(canonicalId: string): Promise<string | null> {
  try {
    const result = await db
      .select({ sleeperId: playerIdentityMap.sleeperId })
      .from(playerIdentityMap)
      .where(eq(playerIdentityMap.canonicalId, canonicalId))
      .limit(1);

    return result[0]?.sleeperId || null;
  } catch {
    return null;
  }
}

export async function getLeagueOwnership(
  params: LeagueOwnershipRequest
): Promise<LeagueOwnershipResponse> {
  const { playerId, userId, leagueId } = params;

  if (!playerId) {
    return { success: false, enabled: false, reason: "playerId is required" };
  }

  if (!userId || !leagueId) {
    return { 
      success: true, 
      enabled: false, 
      reason: "No active league selected. Connect a Sleeper league to see ownership." 
    };
  }

  const cacheKey = `${playerId}:${leagueId}:${userId}`;
  const cached = ownershipCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const sleeperId = await getSleeperId(playerId);
    if (!sleeperId) {
      const response: LeagueOwnershipResponse = {
        success: true,
        enabled: true,
        data: {
          status: "unknown",
          isOnMyTeam: false,
        },
        reason: "Player not mapped to Sleeper ID",
      };
      ownershipCache.set(cacheKey, { data: response, timestamp: Date.now() });
      return response;
    }

    const [rosters, users] = await Promise.all([
      sleeperClient.getLeagueRosters(leagueId),
      sleeperClient.getLeagueUsers(leagueId),
    ]);

    const userMap = new Map<string, SleeperUser>();
    for (const user of users) {
      userMap.set(user.user_id, user);
    }

    let ownerRoster: SleeperRoster | null = null;
    for (const roster of rosters) {
      if (roster.players?.includes(sleeperId)) {
        ownerRoster = roster;
        break;
      }
    }

    if (!ownerRoster) {
      const response: LeagueOwnershipResponse = {
        success: true,
        enabled: true,
        data: {
          status: "free_agent",
          isOnMyTeam: false,
        },
      };
      ownershipCache.set(cacheKey, { data: response, timestamp: Date.now() });
      return response;
    }

    const isMyTeam = ownerRoster.owner_id === userId;
    const ownerUser = userMap.get(ownerRoster.owner_id);

    const response: LeagueOwnershipResponse = {
      success: true,
      enabled: true,
      data: {
        status: isMyTeam ? "on_my_roster" : "owned_by_other",
        ownerTeamName: ownerUser?.team_name || ownerUser?.display_name,
        ownerDisplayName: ownerUser?.display_name,
        isOnMyTeam: isMyTeam,
      },
    };

    ownershipCache.set(cacheKey, { data: response, timestamp: Date.now() });
    return response;
  } catch (error: any) {
    console.error("[LeagueOwnership] Error:", error);
    return { 
      success: false, 
      enabled: true, 
      reason: error.message || "Failed to check ownership" 
    };
  }
}
