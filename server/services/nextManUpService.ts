/**
 * Next Man Up Service
 * 
 * Identifies opportunity shifts when starters go OUT/IR.
 * Used by FORGE Movers to show green arrows (gaining opportunity)
 * and red arrows (losing opportunity due to injury).
 */

import { db } from '../infra/db';
import { depthCharts, playerIdentityMap, playerLiveStatus } from '@shared/schema';
import { eq, and, inArray, sql, lt, gt } from 'drizzle-orm';

export interface OpportunityShift {
  type: 'gaining' | 'losing';
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  depthOrder: number;
  reason: string;
  relatedPlayer: {
    playerId: string;
    playerName: string;
    injuryStatus: string;
    depthOrder: number;
  } | null;
}

export interface NextManUpResult {
  success: boolean;
  shifts: OpportunityShift[];
  generatedAt: string;
}

export class NextManUpService {
  async getOpportunityShifts(): Promise<NextManUpResult> {
    try {
      const injuredStarters = await db
        .select({
          canonicalId: playerLiveStatus.canonicalId,
          fullName: playerIdentityMap.fullName,
          team: playerLiveStatus.currentTeam,
          position: playerIdentityMap.position,
          injuryStatus: playerLiveStatus.injuryStatus,
          depthOrder: depthCharts.depthOrder,
        })
        .from(playerLiveStatus)
        .innerJoin(playerIdentityMap, eq(playerLiveStatus.canonicalId, playerIdentityMap.canonicalId))
        .leftJoin(depthCharts, and(
          eq(playerLiveStatus.canonicalId, depthCharts.canonicalPlayerId),
          eq(playerLiveStatus.currentTeam, depthCharts.teamCode)
        ))
        .where(and(
          inArray(playerLiveStatus.injuryStatus, ['Out', 'IR']),
          inArray(playerIdentityMap.position, ['QB', 'RB', 'WR', 'TE']),
          sql`${playerLiveStatus.currentTeam} IS NOT NULL`
        ));

      const shifts: OpportunityShift[] = [];

      for (const injured of injuredStarters) {
        if (!injured.team || !injured.position) continue;

        shifts.push({
          type: 'losing',
          playerId: injured.canonicalId,
          playerName: injured.fullName || 'Unknown',
          team: injured.team,
          position: injured.position,
          depthOrder: injured.depthOrder || 1,
          reason: `${injured.injuryStatus} - missing games`,
          relatedPlayer: null,
        });

        const injuredDepthOrder = injured.depthOrder || 1;
        
        if (injuredDepthOrder <= 2) {
          const nextUp = await db
            .select({
              canonicalId: depthCharts.canonicalPlayerId,
              fullName: playerIdentityMap.fullName,
              position: depthCharts.position,
              depthOrder: depthCharts.depthOrder,
            })
            .from(depthCharts)
            .innerJoin(playerIdentityMap, eq(depthCharts.canonicalPlayerId, playerIdentityMap.canonicalId))
            .leftJoin(playerLiveStatus, eq(depthCharts.canonicalPlayerId, playerLiveStatus.canonicalId))
            .where(and(
              eq(depthCharts.teamCode, injured.team),
              eq(depthCharts.position, injured.position),
              gt(depthCharts.depthOrder, injuredDepthOrder),
              sql`(${playerLiveStatus.isEligibleForForge} = true OR ${playerLiveStatus.isEligibleForForge} IS NULL)`
            ))
            .orderBy(depthCharts.depthOrder)
            .limit(1);

          if (nextUp.length > 0) {
            const beneficiary = nextUp[0];
            shifts.push({
              type: 'gaining',
              playerId: beneficiary.canonicalId,
              playerName: beneficiary.fullName || 'Unknown',
              team: injured.team,
              position: beneficiary.position,
              depthOrder: beneficiary.depthOrder,
              reason: `Moving up - ${injured.fullName} is ${injured.injuryStatus}`,
              relatedPlayer: {
                playerId: injured.canonicalId,
                playerName: injured.fullName || 'Unknown',
                injuryStatus: injured.injuryStatus || 'Out',
                depthOrder: injuredDepthOrder,
              },
            });
          }
        }
      }

      const uniqueShifts = this.deduplicateShifts(shifts);

      return {
        success: true,
        shifts: uniqueShifts,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[NextManUp] Error getting opportunity shifts:', error);
      return {
        success: false,
        shifts: [],
        generatedAt: new Date().toISOString(),
      };
    }
  }

  private deduplicateShifts(shifts: OpportunityShift[]): OpportunityShift[] {
    const seen = new Set<string>();
    return shifts.filter(shift => {
      const key = `${shift.type}-${shift.playerId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async getShiftForPlayer(canonicalId: string): Promise<OpportunityShift | null> {
    const result = await this.getOpportunityShifts();
    return result.shifts.find(s => s.playerId === canonicalId) || null;
  }
}

export const nextManUpService = new NextManUpService();
