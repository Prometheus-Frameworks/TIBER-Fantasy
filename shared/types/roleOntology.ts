export const TIBER_MATRIX_ROLE_ONTOLOGY_VERSION = 'v1' as const;

export const TIBER_MATRIX_ROLE_IDS = [
  'QB_STRUCTURED_DISTRIBUTOR',
  'QB_BALANCED_CREATOR',
  'QB_DUAL_THREAT_ENGINE',
  'RB_WORKHORSE_GRINDER',
  'RB_HYBRID_BELL_COW',
  'RB_SATELLITE_PLUS',
  'RB_GOAL_LINE_HAMMER',
  'RB_CHANGE_OF_PACE',
  'WR_ALPHA_BOUNDARY_X',
  'WR_VERTICAL_X',
  'WR_FLANKER_CHAIN_MOVER',
  'WR_BIG_SLOT_HUB',
  'WR_FIELD_STRETCH_Z',
  'WR_SLOT_GADGET',
  'TE_INLINE_ANCHOR',
  'TE_MOVE_MISMATCH',
  'TE_RED_ZONE_POWER',
] as const;

export type TiberMatrixRoleId = (typeof TIBER_MATRIX_ROLE_IDS)[number];

export type OffensivePosition = 'QB' | 'RB' | 'WR' | 'TE';

export interface RoleOntologyEntry {
  role_id: TiberMatrixRoleId;
  position: OffensivePosition;
  family: string;
  label: string;
  description: string;
  key_metrics: string[];
}

export interface RoleOntology {
  version: typeof TIBER_MATRIX_ROLE_ONTOLOGY_VERSION;
  roles: Record<TiberMatrixRoleId, RoleOntologyEntry>;
}

export interface NormalizedUsageInput {
  player_id?: string;
  player_name?: string;
  team?: string;
  season?: number;
  position: OffensivePosition;
  slot_rate?: number | null;
  boundary_rate?: number | null;
  adot?: number | null;
  carry_share?: number | null;
  route_rate?: number | null;
  third_down_snap_rate?: number | null;
  two_minute_snap_rate?: number | null;
  red_zone_carry_share?: number | null;
  goal_line_carry_share?: number | null;
  scramble_rate?: number | null;
  designed_rush_rate?: number | null;
  deep_target_rate?: number | null;
  motion_rate?: number | null;
  inline_rate?: number | null;
  route_participation?: number | null;
  red_zone_target_share?: number | null;
}
