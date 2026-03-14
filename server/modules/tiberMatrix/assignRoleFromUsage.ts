import type { DataSufficiency, PlayerRoleAssignment, RoleConfidence, RoleStability } from '@shared/types/playerRoleAssignment';
import type { NormalizedUsageInput, OffensivePosition, TiberMatrixRoleId, UnknownRoleId } from '@shared/types/roleOntology';

// ── Threshold constants ───────────────────────────────────────────────────────
// Every numeric boundary is named explicitly for traceability.
export const THRESHOLDS = {
  // ── Data sufficiency ──────────────────────────────────────────────────
  /** Minimum number of non-null metrics required for a meaningful assignment. */
  INSUFFICIENT_DATA_METRIC_MIN: 3,
  /** Below this count, mark data as PARTIAL. Above = FULL. */
  PARTIAL_DATA_METRIC_MIN: 8,

  // ── Confidence / stability ────────────────────────────────────────────
  SECONDARY_ROLE_GAP_MAX: 1,
  HIGH_CONFIDENCE_SCORE_MIN: 5,
  HIGH_CONFIDENCE_MARGIN_MIN: 2,
  MEDIUM_CONFIDENCE_SCORE_MIN: 3,
  STABLE_MISSING_METRICS_MAX: 3,
  VOLATILE_MISSING_METRICS_MIN: 7,
  VOLATILE_MARGIN_MAX: 0,

  // ── QB thresholds ─────────────────────────────────────────────────────
  QB_DESIGNED_RUSH_HIGH: 0.09,
  QB_DESIGNED_RUSH_MODERATE: 0.05,
  QB_SCRAMBLE_HIGH: 0.08,
  QB_SCRAMBLE_MODERATE: 0.05,
  QB_DEEP_TARGET_HIGH: 0.14,
  QB_DEEP_TARGET_MODERATE: 0.10,
  QB_ADOT_LOW: 7.2,
  QB_ADOT_HIGH: 8.6,

  // ── RB thresholds ─────────────────────────────────────────────────────
  RB_CARRY_SHARE_WORKHORSE: 0.55,
  RB_CARRY_SHARE_BELL_COW: 0.45,
  RB_CARRY_SHARE_SATELLITE_MAX: 0.40,
  RB_CARRY_SHARE_CHANGE: 0.30,
  RB_ROUTE_HIGH: 0.55,
  RB_ROUTE_MODERATE: 0.35,
  RB_ROUTE_LOW: 0.35,
  RB_THIRD_DOWN_HIGH: 0.55,
  RB_TWO_MIN_HIGH: 0.50,
  RB_GOAL_LINE_HIGH: 0.50,
  RB_GOAL_LINE_GRINDER: 0.35,
  RB_RED_ZONE_HIGH: 0.45,
  RB_MOTION_CHANGE_OF_PACE: 0.25,

  // ── WR thresholds ─────────────────────────────────────────────────────
  WR_BOUNDARY_ALPHA: 0.70,
  WR_BOUNDARY_VERTICAL: 0.65,
  WR_BOUNDARY_FLANKER_MIN: 0.45,
  WR_SLOT_BIG: 0.55,
  WR_SLOT_GADGET: 0.60,
  WR_ROUTE_HIGH: 0.80,
  WR_ROUTE_LOW: 0.65,
  WR_ADOT_VERTICAL: 13.5,
  WR_ADOT_DEEP_Z: 12.0,
  WR_ADOT_CHAIN_MAX: 11.0,
  WR_ADOT_SLOT_MAX: 9.0,
  WR_DEEP_TARGET_HIGH: 0.22,
  WR_DEEP_TARGET_Z: 0.18,
  WR_MOTION_HIGH: 0.35,
  WR_MOTION_Z: 0.20,
  WR_RED_ZONE_SHARE_HIGH: 0.24,
  WR_RED_ZONE_SHARE_SLOT: 0.18,
  /** Target share threshold that differentiates alpha-level usage from secondary. */
  WR_TARGET_SHARE_ALPHA: 0.20,

  // ── TE thresholds ─────────────────────────────────────────────────────
  TE_INLINE_ANCHOR: 0.62,
  TE_INLINE_MOVE_MAX: 0.55,
  TE_INLINE_RED_ZONE: 0.50,
  TE_ROUTE_MOVE: 0.72,
  TE_ROUTE_ANCHOR_MAX: 0.62,
  TE_ROUTE_RED_ZONE: 0.60,
  TE_RED_ZONE_SHARE_HIGH: 0.27,
  TE_ADOT_ANCHOR_MAX: 8.5,
  TE_ADOT_MISMATCH_MIN: 8.5,
  TE_SLOT_RATE_MISMATCH: 0.30,
} as const;

// ── Metric keys used for data-sufficiency counting ────────────────────────────
const METRIC_KEYS: Array<keyof NormalizedUsageInput> = [
  'slot_rate',
  'boundary_rate',
  'adot',
  'carry_share',
  'route_rate',
  'third_down_snap_rate',
  'two_minute_snap_rate',
  'red_zone_carry_share',
  'goal_line_carry_share',
  'scramble_rate',
  'designed_rush_rate',
  'deep_target_rate',
  'motion_rate',
  'inline_rate',
  'route_participation',
  'red_zone_target_share',
  'target_share',
  'targets_per_route',
  'screen_target_rate',
  'first_read_share',
  'pressure_to_sack_rate',
  'explosive_pass_rate',
];

// ── Internal helpers ──────────────────────────────────────────────────────────

interface RoleScore {
  role: TiberMatrixRoleId;
  score: number;
  reasoning: string[];
}

/** Safely extract a numeric value from the usage input. */
const val = (input: NormalizedUsageInput, key: keyof NormalizedUsageInput): number | undefined => {
  const raw = input[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
};

/** Add a point to a score if condition holds. */
const scoreIf = (condition: boolean, score: RoleScore, reason: string): void => {
  if (!condition) return;
  score.score += 1;
  score.reasoning.push(reason);
};

/** Count how many of the listed metric keys are present (non-null, finite). */
function countPresentMetrics(input: NormalizedUsageInput): number {
  return METRIC_KEYS.reduce((n, key) => (val(input, key) !== undefined ? n + 1 : n), 0);
}

/** Return the position-specific unknown role ID. */
function unknownRole(position: OffensivePosition): UnknownRoleId {
  return `${position}_UNKNOWN` as UnknownRoleId;
}

// ── Scoring builders per position ─────────────────────────────────────────────

function buildQbScores(input: NormalizedUsageInput): RoleScore[] {
  const designedRushRate = val(input, 'designed_rush_rate') ?? 0;
  const scrambleRate = val(input, 'scramble_rate') ?? 0;
  const deepTargetRate = val(input, 'deep_target_rate') ?? 0;
  const adot = val(input, 'adot') ?? 0;
  const pressureToSack = val(input, 'pressure_to_sack_rate');
  const explosivePass = val(input, 'explosive_pass_rate');

  const structured: RoleScore = { role: 'QB_STRUCTURED_DISTRIBUTOR', score: 0, reasoning: [] };
  scoreIf(designedRushRate < THRESHOLDS.QB_DESIGNED_RUSH_MODERATE, structured, 'Very low designed rush supports structured pocket role.');
  scoreIf(scrambleRate < THRESHOLDS.QB_SCRAMBLE_MODERATE, structured, 'Low scramble rate aligns with distributor profile.');
  scoreIf(adot <= THRESHOLDS.QB_ADOT_LOW, structured, 'Lower target depth points to rhythm distribution.');
  scoreIf(deepTargetRate < THRESHOLDS.QB_DEEP_TARGET_MODERATE, structured, 'Low deep target rate suggests timing/structure emphasis.');
  // Bonus: low pressure-to-sack rate = stays in pocket effectively
  if (pressureToSack !== undefined) {
    scoreIf(pressureToSack < 0.18, structured, 'Low pressure-to-sack rate indicates composed pocket presence.');
  }

  const balanced: RoleScore = { role: 'QB_BALANCED_CREATOR', score: 0, reasoning: [] };
  scoreIf(
    designedRushRate >= THRESHOLDS.QB_DESIGNED_RUSH_MODERATE && designedRushRate < THRESHOLDS.QB_DESIGNED_RUSH_HIGH,
    balanced,
    'Moderate designed rush usage signals balanced creation.',
  );
  scoreIf(
    scrambleRate >= THRESHOLDS.QB_SCRAMBLE_MODERATE && scrambleRate < THRESHOLDS.QB_SCRAMBLE_HIGH,
    balanced,
    'Moderate scramble profile fits creator archetype.',
  );
  scoreIf(
    adot > THRESHOLDS.QB_ADOT_LOW && adot < THRESHOLDS.QB_ADOT_HIGH,
    balanced,
    'Intermediate target depth supports balanced profile.',
  );
  scoreIf(
    deepTargetRate >= THRESHOLDS.QB_DEEP_TARGET_MODERATE && deepTargetRate < THRESHOLDS.QB_DEEP_TARGET_HIGH,
    balanced,
    'Mixed deep-target rate supports balanced aggression.',
  );
  // Bonus: explosive pass rate in moderate range
  if (explosivePass !== undefined) {
    scoreIf(explosivePass >= 0.08 && explosivePass < 0.14, balanced, 'Moderate explosive pass rate fits balanced creator.');
  }

  const dualThreat: RoleScore = { role: 'QB_DUAL_THREAT_ENGINE', score: 0, reasoning: [] };
  scoreIf(designedRushRate >= THRESHOLDS.QB_DESIGNED_RUSH_HIGH, dualThreat, 'High designed rush load defines dual-threat deployment.');
  scoreIf(scrambleRate >= THRESHOLDS.QB_SCRAMBLE_HIGH, dualThreat, 'High scramble rate reinforces rushing engine role.');
  scoreIf(deepTargetRate >= THRESHOLDS.QB_DEEP_TARGET_HIGH, dualThreat, 'Aggressive deep profile pairs with explosive dual-threat style.');
  scoreIf(adot >= THRESHOLDS.QB_ADOT_HIGH, dualThreat, 'Higher aDOT supports creator/engine vertical pressure.');

  return [structured, balanced, dualThreat];
}

function buildRbScores(input: NormalizedUsageInput): RoleScore[] {
  const carryShare = val(input, 'carry_share') ?? 0;
  const routeRate = val(input, 'route_rate') ?? 0;
  const thirdDown = val(input, 'third_down_snap_rate') ?? 0;
  const twoMinute = val(input, 'two_minute_snap_rate') ?? 0;
  const goalLine = val(input, 'goal_line_carry_share') ?? 0;
  const redZone = val(input, 'red_zone_carry_share') ?? 0;
  const motionRate = val(input, 'motion_rate') ?? 0;
  const targetShare = val(input, 'target_share');

  const grinder: RoleScore = { role: 'RB_WORKHORSE_GRINDER', score: 0, reasoning: [] };
  scoreIf(carryShare >= THRESHOLDS.RB_CARRY_SHARE_WORKHORSE, grinder, 'Heavy carry share indicates workhorse rushing role.');
  scoreIf(routeRate <= THRESHOLDS.RB_ROUTE_LOW, grinder, 'Lower route rate favors early-down grinder profile.');
  scoreIf(goalLine >= THRESHOLDS.RB_GOAL_LINE_GRINDER, grinder, 'Goal-line involvement supports grinder designation.');
  // Key separator: grinder should NOT have high 3rd-down or 2-min usage
  scoreIf(thirdDown < THRESHOLDS.RB_THIRD_DOWN_HIGH, grinder, 'Limited passing-down usage fits early-down grinder.');

  const bellCow: RoleScore = { role: 'RB_HYBRID_BELL_COW', score: 0, reasoning: [] };
  scoreIf(carryShare >= THRESHOLDS.RB_CARRY_SHARE_BELL_COW, bellCow, 'Strong carry share supports bell-cow deployment.');
  scoreIf(routeRate >= THRESHOLDS.RB_ROUTE_HIGH, bellCow, 'High route rate confirms hybrid usage.');
  scoreIf(thirdDown >= THRESHOLDS.RB_THIRD_DOWN_HIGH, bellCow, 'Third-down usage strengthens all-situations profile.');
  scoreIf(twoMinute >= THRESHOLDS.RB_TWO_MIN_HIGH, bellCow, 'Two-minute role supports complete back archetype.');
  // Key separator: bell cow must show BOTH rushing and receiving presence
  if (targetShare !== undefined) {
    scoreIf(targetShare >= 0.10, bellCow, 'Meaningful target share confirms dual-phase involvement.');
  }

  const satellite: RoleScore = { role: 'RB_SATELLITE_PLUS', score: 0, reasoning: [] };
  scoreIf(carryShare < THRESHOLDS.RB_CARRY_SHARE_SATELLITE_MAX, satellite, 'Lower carry share fits satellite usage.');
  scoreIf(routeRate >= THRESHOLDS.RB_ROUTE_HIGH, satellite, 'High route participation indicates receiving specialization.');
  scoreIf(thirdDown >= THRESHOLDS.RB_THIRD_DOWN_HIGH, satellite, 'Heavy third-down work supports satellite profile.');
  scoreIf(twoMinute >= THRESHOLDS.RB_TWO_MIN_HIGH, satellite, 'Two-minute deployment reinforces pass-game role.');

  const hammer: RoleScore = { role: 'RB_GOAL_LINE_HAMMER', score: 0, reasoning: [] };
  scoreIf(goalLine >= THRESHOLDS.RB_GOAL_LINE_HIGH, hammer, 'Dominant goal-line carry share defines hammer role.');
  scoreIf(redZone >= THRESHOLDS.RB_RED_ZONE_HIGH, hammer, 'Concentrated red-zone carries reinforce short-yardage specialization.');
  scoreIf(routeRate < THRESHOLDS.RB_ROUTE_LOW, hammer, 'Lower route involvement fits touchdown specialist usage.');
  scoreIf(carryShare < THRESHOLDS.RB_CARRY_SHARE_BELL_COW, hammer, 'Sub-bell-cow carry share indicates specialist, not every-down back.');

  const pace: RoleScore = { role: 'RB_CHANGE_OF_PACE', score: 0, reasoning: [] };
  scoreIf(carryShare < THRESHOLDS.RB_CARRY_SHARE_CHANGE, pace, 'Lower rushing share points to rotational role.');
  scoreIf(
    routeRate >= THRESHOLDS.RB_ROUTE_MODERATE && routeRate < THRESHOLDS.RB_ROUTE_HIGH,
    pace,
    'Moderate route usage fits change-of-pace deployment.',
  );
  scoreIf(motionRate >= THRESHOLDS.RB_MOTION_CHANGE_OF_PACE, pace, 'Higher motion usage indicates package back role.');

  return [grinder, bellCow, satellite, hammer, pace];
}

function buildWrScores(input: NormalizedUsageInput): RoleScore[] {
  const boundaryRate = val(input, 'boundary_rate') ?? 0;
  const slotRate = val(input, 'slot_rate') ?? 0;
  const routeParticipation = val(input, 'route_participation') ?? 0;
  const adot = val(input, 'adot') ?? 0;
  const deepTargetRate = val(input, 'deep_target_rate') ?? 0;
  const motionRate = val(input, 'motion_rate') ?? 0;
  const redZoneTargetShare = val(input, 'red_zone_target_share') ?? 0;
  const targetShare = val(input, 'target_share');
  const screenTargetRate = val(input, 'screen_target_rate');

  // ── Alpha Boundary X ──
  const alphaX: RoleScore = { role: 'WR_ALPHA_BOUNDARY_X', score: 0, reasoning: [] };
  scoreIf(boundaryRate >= THRESHOLDS.WR_BOUNDARY_ALPHA, alphaX, 'Heavy boundary alignment supports alpha X usage.');
  scoreIf(routeParticipation >= THRESHOLDS.WR_ROUTE_HIGH, alphaX, 'High route participation indicates every-down alpha role.');
  scoreIf(redZoneTargetShare >= THRESHOLDS.WR_RED_ZONE_SHARE_HIGH, alphaX, 'Strong red-zone target command supports primary-X role.');
  // Key separator from Vertical X: lower aDOT + red-zone presence = alpha, not vertical
  scoreIf(adot < THRESHOLDS.WR_ADOT_VERTICAL, alphaX, 'Sub-vertical aDOT separates alpha usage from deep specialist.');
  if (targetShare !== undefined) {
    scoreIf(targetShare >= THRESHOLDS.WR_TARGET_SHARE_ALPHA, alphaX, 'High target share confirms alpha-level target command.');
  }

  // ── Vertical X ──
  const verticalX: RoleScore = { role: 'WR_VERTICAL_X', score: 0, reasoning: [] };
  scoreIf(boundaryRate >= THRESHOLDS.WR_BOUNDARY_VERTICAL, verticalX, 'Boundary-heavy deployment supports vertical X role.');
  scoreIf(adot >= THRESHOLDS.WR_ADOT_VERTICAL, verticalX, 'High aDOT marks vertical receiver profile.');
  scoreIf(deepTargetRate >= THRESHOLDS.WR_DEEP_TARGET_HIGH, verticalX, 'Deep target concentration reinforces field-stretch job.');
  // Key separator from Alpha X: vertical MUST have elevated deep target rate
  scoreIf(redZoneTargetShare < THRESHOLDS.WR_RED_ZONE_SHARE_HIGH, verticalX, 'Lower red-zone share indicates deep-ball specialist over alpha.');

  // ── Flanker Chain Mover ──
  const flanker: RoleScore = { role: 'WR_FLANKER_CHAIN_MOVER', score: 0, reasoning: [] };
  scoreIf(
    boundaryRate >= THRESHOLDS.WR_BOUNDARY_FLANKER_MIN && boundaryRate < THRESHOLDS.WR_BOUNDARY_ALPHA,
    flanker,
    'Balanced perimeter usage matches flanker deployment.',
  );
  scoreIf(adot <= THRESHOLDS.WR_ADOT_CHAIN_MAX, flanker, 'Short/intermediate aDOT fits chain-mover profile.');
  scoreIf(routeParticipation >= THRESHOLDS.WR_ROUTE_LOW, flanker, 'Reliable route share supports move-the-chains role.');
  // Blended slot/flanker: moderate slot with meaningful boundary = flanker lean
  scoreIf(
    slotRate > 0.20 && slotRate < THRESHOLDS.WR_SLOT_BIG,
    flanker,
    'Blended slot/flanker alignment fits chain-mover versatility.',
  );

  // ── Big Slot Hub ──
  const bigSlot: RoleScore = { role: 'WR_BIG_SLOT_HUB', score: 0, reasoning: [] };
  scoreIf(slotRate >= THRESHOLDS.WR_SLOT_BIG, bigSlot, 'High slot alignment supports big-slot role.');
  scoreIf(routeParticipation >= THRESHOLDS.WR_ROUTE_LOW, bigSlot, 'Strong route participation indicates hub-style usage.');
  scoreIf(redZoneTargetShare >= THRESHOLDS.WR_RED_ZONE_SHARE_SLOT, bigSlot, 'Meaningful red-zone share supports big-slot hub profile.');
  scoreIf(adot > THRESHOLDS.WR_ADOT_SLOT_MAX, bigSlot, 'aDOT above gadget-level separates hub from gadget.');

  // ── Field Stretch Z ──
  const fieldStretchZ: RoleScore = { role: 'WR_FIELD_STRETCH_Z', score: 0, reasoning: [] };
  scoreIf(deepTargetRate >= THRESHOLDS.WR_DEEP_TARGET_Z, fieldStretchZ, 'Elevated deep target rate supports field-stretch Z role.');
  scoreIf(motionRate >= THRESHOLDS.WR_MOTION_Z, fieldStretchZ, 'Motion usage is common for Z deployment.');
  scoreIf(adot >= THRESHOLDS.WR_ADOT_DEEP_Z, fieldStretchZ, 'Higher aDOT aligns with space-stretching assignments.');
  // Separator from Vertical X: Z should have less boundary alignment
  scoreIf(boundaryRate < THRESHOLDS.WR_BOUNDARY_VERTICAL, fieldStretchZ, 'Less boundary-locked deployment fits Z motion role.');

  // ── Slot Gadget ──
  const slotGadget: RoleScore = { role: 'WR_SLOT_GADGET', score: 0, reasoning: [] };
  scoreIf(slotRate >= THRESHOLDS.WR_SLOT_GADGET, slotGadget, 'Very high slot deployment indicates gadget archetype.');
  scoreIf(motionRate >= THRESHOLDS.WR_MOTION_HIGH, slotGadget, 'Heavy motion usage supports designed-touch role.');
  scoreIf(routeParticipation < THRESHOLDS.WR_ROUTE_LOW, slotGadget, 'Lower route participation points to package-specific usage.');
  scoreIf(adot <= THRESHOLDS.WR_ADOT_SLOT_MAX, slotGadget, 'Shallow aDOT fits gadget slot profile.');
  if (screenTargetRate !== undefined) {
    scoreIf(screenTargetRate >= 0.15, slotGadget, 'Elevated screen target rate reinforces manufactured-touch role.');
  }

  return [alphaX, verticalX, flanker, bigSlot, fieldStretchZ, slotGadget];
}

function buildTeScores(input: NormalizedUsageInput): RoleScore[] {
  const inlineRate = val(input, 'inline_rate') ?? 0;
  const routeParticipation = val(input, 'route_participation') ?? 0;
  const adot = val(input, 'adot') ?? 0;
  const redZoneTargetShare = val(input, 'red_zone_target_share') ?? 0;
  const slotRate = val(input, 'slot_rate') ?? 0;

  // ── Inline Anchor ──
  const anchor: RoleScore = { role: 'TE_INLINE_ANCHOR', score: 0, reasoning: [] };
  scoreIf(inlineRate >= THRESHOLDS.TE_INLINE_ANCHOR, anchor, 'High inline usage defines anchor deployment.');
  scoreIf(routeParticipation <= THRESHOLDS.TE_ROUTE_ANCHOR_MAX, anchor, 'Lower route volume indicates blocking-attached role.');
  scoreIf(adot <= THRESHOLDS.TE_ADOT_ANCHOR_MAX, anchor, 'Lower target depth matches underneath inline profile.');
  // Separator: low slot rate confirms truly inline, not inline/detached blend
  scoreIf(slotRate < 0.15, anchor, 'Minimal slot deployment confirms pure inline anchor.');

  // ── Move Mismatch ──
  const mismatch: RoleScore = { role: 'TE_MOVE_MISMATCH', score: 0, reasoning: [] };
  scoreIf(inlineRate < THRESHOLDS.TE_INLINE_MOVE_MAX, mismatch, 'Reduced inline rate supports move TE alignment.');
  scoreIf(routeParticipation >= THRESHOLDS.TE_ROUTE_MOVE, mismatch, 'High route participation indicates mismatch-focused role.');
  scoreIf(adot >= THRESHOLDS.TE_ADOT_MISMATCH_MIN, mismatch, 'Higher aDOT supports seam and detached deployment.');
  // Separator: meaningful slot rate helps distinguish from inline/detached ambiguity
  scoreIf(slotRate >= THRESHOLDS.TE_SLOT_RATE_MISMATCH, mismatch, 'Slot alignment confirms off-ball, move-TE deployment.');

  // ── Red Zone Power ──
  const redZonePower: RoleScore = { role: 'TE_RED_ZONE_POWER', score: 0, reasoning: [] };
  scoreIf(redZoneTargetShare >= THRESHOLDS.TE_RED_ZONE_SHARE_HIGH, redZonePower, 'High red-zone target share defines scoring specialist role.');
  scoreIf(routeParticipation >= THRESHOLDS.TE_ROUTE_RED_ZONE, redZonePower, 'Adequate route load supports repeatable scoring usage.');
  scoreIf(inlineRate >= THRESHOLDS.TE_INLINE_RED_ZONE, redZonePower, 'Inline presence helps red-zone mismatch and leverage usage.');

  return [anchor, mismatch, redZonePower];
}

// ── Score selection and assignment ────────────────────────────────────────────

function buildScores(input: NormalizedUsageInput): RoleScore[] {
  const builders: Record<OffensivePosition, (usage: NormalizedUsageInput) => RoleScore[]> = {
    QB: buildQbScores,
    RB: buildRbScores,
    WR: buildWrScores,
    TE: buildTeScores,
  };

  return builders[input.position](input);
}

function inferConfidence(topScore: number, margin: number, dataSufficiency: DataSufficiency): RoleConfidence {
  // Insufficient data caps confidence at LOW regardless of score
  if (dataSufficiency === 'INSUFFICIENT') return 'LOW';
  if (topScore >= THRESHOLDS.HIGH_CONFIDENCE_SCORE_MIN && margin >= THRESHOLDS.HIGH_CONFIDENCE_MARGIN_MIN) return 'HIGH';
  if (topScore >= THRESHOLDS.MEDIUM_CONFIDENCE_SCORE_MIN) return 'MEDIUM';
  return 'LOW';
}

function inferStability(missingMetricCount: number, margin: number, dataSufficiency: DataSufficiency): RoleStability {
  if (dataSufficiency === 'INSUFFICIENT') return 'VOLATILE';
  if (
    missingMetricCount >= THRESHOLDS.VOLATILE_MISSING_METRICS_MIN ||
    margin <= THRESHOLDS.VOLATILE_MARGIN_MAX
  ) {
    return 'VOLATILE';
  }
  if (missingMetricCount <= THRESHOLDS.STABLE_MISSING_METRICS_MAX && margin >= 2) return 'STABLE';
  return 'MODERATE';
}

function inferDataSufficiency(presentCount: number): DataSufficiency {
  if (presentCount < THRESHOLDS.INSUFFICIENT_DATA_METRIC_MIN) return 'INSUFFICIENT';
  if (presentCount < THRESHOLDS.PARTIAL_DATA_METRIC_MIN) return 'PARTIAL';
  return 'FULL';
}

export function assignRoleFromUsage(input: NormalizedUsageInput): PlayerRoleAssignment {
  const presentCount = countPresentMetrics(input);
  const dataSufficiency = inferDataSufficiency(presentCount);
  const missingMetricCount = METRIC_KEYS.length - presentCount;

  // ── Insufficient data path: return explicit unknown role ────────────
  if (dataSufficiency === 'INSUFFICIENT') {
    return {
      player_id: input.player_id,
      player_name: input.player_name,
      team: input.team,
      season: input.season,
      position: input.position,
      primary_role: unknownRole(input.position),
      role_confidence: 'LOW',
      role_stability: 'VOLATILE',
      data_sufficiency: 'INSUFFICIENT',
      assignment_reasoning: [
        `Only ${presentCount} of ${METRIC_KEYS.length} usage metrics present; insufficient for role classification.`,
        'Assigned position-specific unknown role to avoid false archetype labeling.',
      ],
    };
  }

  // ── Normal scoring path ────────────────────────────────────────────
  const scores = buildScores(input).sort((a, b) => b.score - a.score);
  const [primaryCandidate, secondaryCandidate] = scores;

  // Safety: if somehow all scores are zero (extremely sparse but above threshold),
  // still fall back to unknown rather than assigning a fake role
  if (!primaryCandidate || primaryCandidate.score === 0) {
    return {
      player_id: input.player_id,
      player_name: input.player_name,
      team: input.team,
      season: input.season,
      position: input.position,
      primary_role: unknownRole(input.position),
      role_confidence: 'LOW',
      role_stability: 'VOLATILE',
      data_sufficiency: dataSufficiency,
      assignment_reasoning: [
        'No role scored above zero; usage profile does not match any defined archetype.',
        'Assigned position-specific unknown role.',
      ],
    };
  }

  const margin = primaryCandidate.score - (secondaryCandidate?.score ?? 0);
  const roleConfidence = inferConfidence(primaryCandidate.score, margin, dataSufficiency);
  const roleStability = inferStability(missingMetricCount, margin, dataSufficiency);
  const hasSecondary =
    !!secondaryCandidate &&
    secondaryCandidate.score > 0 &&
    margin <= THRESHOLDS.SECONDARY_ROLE_GAP_MAX;

  return {
    player_id: input.player_id,
    player_name: input.player_name,
    team: input.team,
    season: input.season,
    position: input.position,
    primary_role: primaryCandidate.role,
    secondary_role: hasSecondary ? secondaryCandidate.role : undefined,
    role_confidence: roleConfidence,
    role_stability: roleStability,
    data_sufficiency: dataSufficiency,
    assignment_reasoning: [
      ...primaryCandidate.reasoning,
      `Present metrics: ${presentCount}/${METRIC_KEYS.length}; data sufficiency: ${dataSufficiency}.`,
      `Top role score: ${primaryCandidate.score}; margin vs next role: ${margin}.`,
    ],
  };
}

export { THRESHOLDS as TIBER_MATRIX_ROLE_THRESHOLDS };
