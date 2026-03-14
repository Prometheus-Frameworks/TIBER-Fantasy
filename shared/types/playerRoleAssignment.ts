import type { NormalizedUsageInput, TiberMatrixRoleId } from './roleOntology';

export type RoleConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type RoleStability = 'STABLE' | 'MODERATE' | 'VOLATILE';

export interface PlayerRoleAssignment {
  player_id?: string;
  player_name?: string;
  team?: string;
  season?: number;
  position: NormalizedUsageInput['position'];
  primary_role: TiberMatrixRoleId;
  secondary_role?: TiberMatrixRoleId;
  role_confidence: RoleConfidence;
  role_stability: RoleStability;
  assignment_reasoning: string[];
}

export interface TeamSeasonRoleMap {
  team: string;
  season: number;
  assignments: PlayerRoleAssignment[];
}
