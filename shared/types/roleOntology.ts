export const TIBER_MATRIX_ROLE_ONTOLOGY_VERSION = 'v2' as const;

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
  // Explicit insufficient-data roles per position
  'QB_UNKNOWN',
  'RB_UNKNOWN',
  'WR_UNKNOWN',
  'TE_UNKNOWN',
] as const;

export type TiberMatrixRoleId = (typeof TIBER_MATRIX_ROLE_IDS)[number];

/** The set of canonical roles that represent real football archetypes (not unknown/fallback). */
export const CANONICAL_ROLE_IDS = TIBER_MATRIX_ROLE_IDS.filter(
  (id) => !id.endsWith('_UNKNOWN')
) as unknown as readonly CanonicalRoleId[];

export type CanonicalRoleId = Exclude<TiberMatrixRoleId, `${OffensivePosition}_UNKNOWN`>;

export type UnknownRoleId = `${OffensivePosition}_UNKNOWN`;

export type OffensivePosition = 'QB' | 'RB' | 'WR' | 'TE';

// --- Rich ontology metadata types ---

export type StabilityBand = 'HIGH' | 'MEDIUM' | 'LOW';
export type OpportunityBand = 'FULL' | 'PARTIAL' | 'SPECIALIST';

export interface UsageSignature {
  /** Metrics that are expected to be elevated for this role. */
  elevated: string[];
  /** Metrics that are expected to be suppressed for this role. */
  suppressed: string[];
}

export interface OpportunityProfile {
  /** Typical snap share band for this role. */
  snap_share: OpportunityBand;
  /** Whether the role typically commands passing-game involvement. */
  pass_game_involved: boolean;
  /** Whether the role typically commands rushing-game involvement. */
  rush_game_involved: boolean;
  /** Whether the role is typically deployed in the red zone. */
  red_zone_relevant: boolean;
}

export interface StabilityProfile {
  /** How stable this role assignment tends to be week-to-week. */
  week_to_week: StabilityBand;
  /** How stable this role is across seasons / career arcs. */
  season_to_season: StabilityBand;
  /** Whether the role is vulnerable to scheme changes. */
  scheme_sensitive: boolean;
}

export interface FantasyTranslation {
  /** Primary fantasy scoring upside mechanism. */
  upside_driver: string;
  /** Typical fantasy floor behavior. */
  floor_profile: string;
  /** Most relevant fantasy formats for this role (dynasty, redraft, bestball). */
  best_formats: string[];
}

export interface RoleOntologyEntry {
  role_id: TiberMatrixRoleId;
  position: OffensivePosition;
  family: string;
  label: string;
  description: string;
  key_metrics: string[];
  /** One-sentence definition of the football role. */
  short_definition: string;
  /** Signature usage-metric pattern expected for this role. */
  usage_signature: UsageSignature;
  /** Core football traits that define this archetype. */
  core_traits: string[];
  /** Typical opportunity share profile. */
  opportunity_profile: OpportunityProfile;
  /** Stability expectations for the role. */
  stability_profile: StabilityProfile;
  /** How this role translates to fantasy scoring. */
  fantasy_translation: FantasyTranslation;
  /** Common ways this role underperforms its archetype. */
  common_failure_modes: string[];
  /** Common catalysts that unlock additional upside. */
  common_upside_triggers: string[];
  /** Adjacent roles this player might also classify as. */
  fallback_adjacent_roles: TiberMatrixRoleId[];
}

export interface RoleOntology {
  version: string;
  roles: Record<TiberMatrixRoleId, RoleOntologyEntry>;
}

/** Required rich fields that must be present on every canonical ontology entry. */
export const REQUIRED_RICH_FIELDS: (keyof RoleOntologyEntry)[] = [
  'short_definition',
  'usage_signature',
  'core_traits',
  'opportunity_profile',
  'stability_profile',
  'fantasy_translation',
  'common_failure_modes',
  'common_upside_triggers',
  'fallback_adjacent_roles',
];

export interface NormalizedUsageInput {
  player_id?: string;
  player_name?: string;
  team?: string;
  season?: number;
  position: OffensivePosition;
  // Alignment / deployment rates
  slot_rate?: number | null;
  boundary_rate?: number | null;
  inline_rate?: number | null;
  motion_rate?: number | null;
  // Target profile
  adot?: number | null;
  deep_target_rate?: number | null;
  target_share?: number | null;
  targets_per_route?: number | null;
  screen_target_rate?: number | null;
  first_read_share?: number | null;
  red_zone_target_share?: number | null;
  // Rushing profile
  carry_share?: number | null;
  red_zone_carry_share?: number | null;
  goal_line_carry_share?: number | null;
  // Route / snap involvement
  route_rate?: number | null;
  route_participation?: number | null;
  third_down_snap_rate?: number | null;
  two_minute_snap_rate?: number | null;
  // QB-specific
  scramble_rate?: number | null;
  designed_rush_rate?: number | null;
  // Efficiency markers (extension points)
  pressure_to_sack_rate?: number | null;
  explosive_pass_rate?: number | null;
}
