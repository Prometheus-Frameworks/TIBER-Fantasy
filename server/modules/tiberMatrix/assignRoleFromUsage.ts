import type { PlayerRoleAssignment, RoleConfidence, RoleStability } from '@shared/types/playerRoleAssignment';
import type { NormalizedUsageInput, OffensivePosition, TiberMatrixRoleId } from '@shared/types/roleOntology';

const THRESHOLDS = {
  SECONDARY_ROLE_GAP_MAX: 1,
  HIGH_CONFIDENCE_SCORE_MIN: 5,
  HIGH_CONFIDENCE_MARGIN_MIN: 2,
  MEDIUM_CONFIDENCE_SCORE_MIN: 3,
  STABLE_MISSING_METRICS_MAX: 3,
  VOLATILE_MISSING_METRICS_MIN: 7,
  VOLATILE_MARGIN_MAX: 0,
  QB_DESIGNED_RUSH_HIGH: 0.09,
  QB_SCRAMBLE_HIGH: 0.08,
  QB_DEEP_TARGET_HIGH: 0.14,
  QB_ADOT_LOW: 7.2,
  QB_ADOT_HIGH: 8.6,
  RB_CARRY_SHARE_WORKHORSE: 0.55,
  RB_CARRY_SHARE_BELL_COW: 0.45,
  RB_CARRY_SHARE_CHANGE: 0.3,
  RB_ROUTE_HIGH: 0.55,
  RB_ROUTE_LOW: 0.35,
  RB_THIRD_DOWN_HIGH: 0.55,
  RB_TWO_MIN_HIGH: 0.5,
  RB_GOAL_LINE_HIGH: 0.5,
  RB_RED_ZONE_HIGH: 0.45,
  WR_BOUNDARY_ALPHA: 0.7,
  WR_BOUNDARY_VERTICAL: 0.65,
  WR_SLOT_BIG: 0.55,
  WR_SLOT_GADGET: 0.6,
  WR_ROUTE_HIGH: 0.8,
  WR_ROUTE_LOW: 0.65,
  WR_ADOT_VERTICAL: 13.5,
  WR_ADOT_CHAIN_MAX: 11,
  WR_ADOT_SLOT_MAX: 9,
  WR_DEEP_TARGET_HIGH: 0.22,
  WR_MOTION_HIGH: 0.35,
  WR_RED_ZONE_SHARE_HIGH: 0.24,
  TE_INLINE_ANCHOR: 0.62,
  TE_INLINE_MOVE_MAX: 0.55,
  TE_ROUTE_MOVE: 0.72,
  TE_ROUTE_ANCHOR_MAX: 0.62,
  TE_RED_ZONE_SHARE_HIGH: 0.27,
} as const;

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
];

interface RoleScore {
  role: TiberMatrixRoleId;
  score: number;
  reasoning: string[];
}

const value = (input: NormalizedUsageInput, key: keyof NormalizedUsageInput): number | undefined => {
  const raw = input[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
};

const scoreIf = (condition: boolean, score: RoleScore, reason: string): void => {
  if (!condition) return;
  score.score += 1;
  score.reasoning.push(reason);
};

function buildQbScores(input: NormalizedUsageInput): RoleScore[] {
  const designedRushRate = value(input, 'designed_rush_rate') ?? 0;
  const scrambleRate = value(input, 'scramble_rate') ?? 0;
  const deepTargetRate = value(input, 'deep_target_rate') ?? 0;
  const adot = value(input, 'adot') ?? 0;

  const structured: RoleScore = { role: 'QB_STRUCTURED_DISTRIBUTOR', score: 0, reasoning: [] };
  scoreIf(designedRushRate < THRESHOLDS.QB_DESIGNED_RUSH_HIGH, structured, 'Low designed rush usage supports structured pocket role.');
  scoreIf(scrambleRate < THRESHOLDS.QB_SCRAMBLE_HIGH, structured, 'Low scramble rate aligns with distributor profile.');
  scoreIf(adot <= THRESHOLDS.QB_ADOT_LOW, structured, 'Lower target depth points to rhythm distribution.');
  scoreIf(deepTargetRate < THRESHOLDS.QB_DEEP_TARGET_HIGH, structured, 'Lower deep target rate suggests timing/structure emphasis.');

  const balanced: RoleScore = { role: 'QB_BALANCED_CREATOR', score: 0, reasoning: [] };
  scoreIf(designedRushRate >= 0.05 && designedRushRate < THRESHOLDS.QB_DESIGNED_RUSH_HIGH, balanced, 'Moderate designed rush usage signals balanced creation.');
  scoreIf(scrambleRate >= 0.05 && scrambleRate < THRESHOLDS.QB_SCRAMBLE_HIGH, balanced, 'Moderate scramble profile fits creator archetype.');
  scoreIf(adot > THRESHOLDS.QB_ADOT_LOW && adot < THRESHOLDS.QB_ADOT_HIGH, balanced, 'Intermediate target depth supports balanced profile.');
  scoreIf(deepTargetRate >= 0.1 && deepTargetRate < 0.2, balanced, 'Mixed deep-target rate supports balanced aggression.');

  const dualThreat: RoleScore = { role: 'QB_DUAL_THREAT_ENGINE', score: 0, reasoning: [] };
  scoreIf(designedRushRate >= THRESHOLDS.QB_DESIGNED_RUSH_HIGH, dualThreat, 'High designed rush load defines dual-threat deployment.');
  scoreIf(scrambleRate >= THRESHOLDS.QB_SCRAMBLE_HIGH, dualThreat, 'High scramble rate reinforces rushing engine role.');
  scoreIf(deepTargetRate >= THRESHOLDS.QB_DEEP_TARGET_HIGH, dualThreat, 'Aggressive deep profile pairs with explosive dual-threat style.');
  scoreIf(adot >= THRESHOLDS.QB_ADOT_HIGH, dualThreat, 'Higher aDOT supports creator/engine vertical pressure.');

  return [structured, balanced, dualThreat];
}

function buildRbScores(input: NormalizedUsageInput): RoleScore[] {
  const carryShare = value(input, 'carry_share') ?? 0;
  const routeRate = value(input, 'route_rate') ?? 0;
  const thirdDown = value(input, 'third_down_snap_rate') ?? 0;
  const twoMinute = value(input, 'two_minute_snap_rate') ?? 0;
  const goalLine = value(input, 'goal_line_carry_share') ?? 0;
  const redZone = value(input, 'red_zone_carry_share') ?? 0;
  const motionRate = value(input, 'motion_rate') ?? 0;

  const grinder: RoleScore = { role: 'RB_WORKHORSE_GRINDER', score: 0, reasoning: [] };
  scoreIf(carryShare >= THRESHOLDS.RB_CARRY_SHARE_WORKHORSE, grinder, 'Heavy carry share indicates workhorse rushing role.');
  scoreIf(routeRate <= THRESHOLDS.RB_ROUTE_LOW, grinder, 'Lower route rate favors early-down grinder profile.');
  scoreIf(goalLine >= 0.35, grinder, 'Goal-line involvement supports grinder designation.');

  const bellCow: RoleScore = { role: 'RB_HYBRID_BELL_COW', score: 0, reasoning: [] };
  scoreIf(carryShare >= THRESHOLDS.RB_CARRY_SHARE_BELL_COW, bellCow, 'Strong carry share supports bell-cow deployment.');
  scoreIf(routeRate >= THRESHOLDS.RB_ROUTE_HIGH, bellCow, 'High route rate confirms hybrid usage.');
  scoreIf(thirdDown >= THRESHOLDS.RB_THIRD_DOWN_HIGH, bellCow, 'Third-down usage strengthens all-situations profile.');
  scoreIf(twoMinute >= THRESHOLDS.RB_TWO_MIN_HIGH, bellCow, 'Two-minute role supports complete back archetype.');

  const satellite: RoleScore = { role: 'RB_SATELLITE_PLUS', score: 0, reasoning: [] };
  scoreIf(carryShare < 0.4, satellite, 'Lower carry share fits satellite usage.');
  scoreIf(routeRate >= THRESHOLDS.RB_ROUTE_HIGH, satellite, 'High route participation indicates receiving specialization.');
  scoreIf(thirdDown >= THRESHOLDS.RB_THIRD_DOWN_HIGH, satellite, 'Heavy third-down work supports satellite profile.');
  scoreIf(twoMinute >= THRESHOLDS.RB_TWO_MIN_HIGH, satellite, 'Two-minute deployment reinforces pass-game role.');

  const hammer: RoleScore = { role: 'RB_GOAL_LINE_HAMMER', score: 0, reasoning: [] };
  scoreIf(goalLine >= THRESHOLDS.RB_GOAL_LINE_HIGH, hammer, 'Dominant goal-line carry share defines hammer role.');
  scoreIf(redZone >= THRESHOLDS.RB_RED_ZONE_HIGH, hammer, 'Concentrated red-zone carries reinforce short-yardage specialization.');
  scoreIf(routeRate < THRESHOLDS.RB_ROUTE_LOW, hammer, 'Lower route involvement fits touchdown specialist usage.');

  const pace: RoleScore = { role: 'RB_CHANGE_OF_PACE', score: 0, reasoning: [] };
  scoreIf(carryShare < THRESHOLDS.RB_CARRY_SHARE_CHANGE, pace, 'Lower rushing share points to rotational role.');
  scoreIf(routeRate >= 0.35 && routeRate < THRESHOLDS.RB_ROUTE_HIGH, pace, 'Moderate route usage fits change-of-pace deployment.');
  scoreIf(motionRate >= 0.25, pace, 'Higher motion usage indicates package back role.');

  return [grinder, bellCow, satellite, hammer, pace];
}

function buildWrScores(input: NormalizedUsageInput): RoleScore[] {
  const boundaryRate = value(input, 'boundary_rate') ?? 0;
  const slotRate = value(input, 'slot_rate') ?? 0;
  const routeParticipation = value(input, 'route_participation') ?? 0;
  const adot = value(input, 'adot') ?? 0;
  const deepTargetRate = value(input, 'deep_target_rate') ?? 0;
  const motionRate = value(input, 'motion_rate') ?? 0;
  const redZoneTargetShare = value(input, 'red_zone_target_share') ?? 0;

  const alphaX: RoleScore = { role: 'WR_ALPHA_BOUNDARY_X', score: 0, reasoning: [] };
  scoreIf(boundaryRate >= THRESHOLDS.WR_BOUNDARY_ALPHA, alphaX, 'Heavy boundary alignment supports alpha X usage.');
  scoreIf(routeParticipation >= THRESHOLDS.WR_ROUTE_HIGH, alphaX, 'High route participation indicates every-down alpha role.');
  scoreIf(redZoneTargetShare >= THRESHOLDS.WR_RED_ZONE_SHARE_HIGH, alphaX, 'Strong red-zone target command supports primary-X role.');

  const verticalX: RoleScore = { role: 'WR_VERTICAL_X', score: 0, reasoning: [] };
  scoreIf(boundaryRate >= THRESHOLDS.WR_BOUNDARY_VERTICAL, verticalX, 'Boundary-heavy deployment supports vertical X role.');
  scoreIf(adot >= THRESHOLDS.WR_ADOT_VERTICAL, verticalX, 'High aDOT marks vertical receiver profile.');
  scoreIf(deepTargetRate >= THRESHOLDS.WR_DEEP_TARGET_HIGH, verticalX, 'Deep target concentration reinforces field-stretch job.');

  const flanker: RoleScore = { role: 'WR_FLANKER_CHAIN_MOVER', score: 0, reasoning: [] };
  scoreIf(boundaryRate >= 0.45 && boundaryRate < THRESHOLDS.WR_BOUNDARY_ALPHA, flanker, 'Balanced perimeter usage matches flanker deployment.');
  scoreIf(adot <= THRESHOLDS.WR_ADOT_CHAIN_MAX, flanker, 'Short/intermediate aDOT fits chain-mover profile.');
  scoreIf(routeParticipation >= THRESHOLDS.WR_ROUTE_LOW, flanker, 'Reliable route share supports move-the-chains role.');

  const bigSlot: RoleScore = { role: 'WR_BIG_SLOT_HUB', score: 0, reasoning: [] };
  scoreIf(slotRate >= THRESHOLDS.WR_SLOT_BIG, bigSlot, 'High slot alignment supports big-slot role.');
  scoreIf(routeParticipation >= THRESHOLDS.WR_ROUTE_LOW, bigSlot, 'Strong route participation indicates hub-style usage.');
  scoreIf(redZoneTargetShare >= 0.18, bigSlot, 'Meaningful red-zone share supports big-slot hub profile.');

  const fieldStretchZ: RoleScore = { role: 'WR_FIELD_STRETCH_Z', score: 0, reasoning: [] };
  scoreIf(deepTargetRate >= 0.18, fieldStretchZ, 'Elevated deep target rate supports field-stretch Z role.');
  scoreIf(motionRate >= 0.2, fieldStretchZ, 'Motion usage is common for Z deployment.');
  scoreIf(adot >= 12, fieldStretchZ, 'Higher aDOT aligns with space-stretching assignments.');

  const slotGadget: RoleScore = { role: 'WR_SLOT_GADGET', score: 0, reasoning: [] };
  scoreIf(slotRate >= THRESHOLDS.WR_SLOT_GADGET, slotGadget, 'Very high slot deployment indicates gadget archetype.');
  scoreIf(motionRate >= THRESHOLDS.WR_MOTION_HIGH, slotGadget, 'Heavy motion usage supports designed-touch role.');
  scoreIf(routeParticipation < THRESHOLDS.WR_ROUTE_LOW, slotGadget, 'Lower route participation points to package-specific usage.');
  scoreIf(adot <= THRESHOLDS.WR_ADOT_SLOT_MAX, slotGadget, 'Shallow aDOT fits gadget slot profile.');

  return [alphaX, verticalX, flanker, bigSlot, fieldStretchZ, slotGadget];
}

function buildTeScores(input: NormalizedUsageInput): RoleScore[] {
  const inlineRate = value(input, 'inline_rate') ?? 0;
  const routeParticipation = value(input, 'route_participation') ?? 0;
  const adot = value(input, 'adot') ?? 0;
  const redZoneTargetShare = value(input, 'red_zone_target_share') ?? 0;

  const anchor: RoleScore = { role: 'TE_INLINE_ANCHOR', score: 0, reasoning: [] };
  scoreIf(inlineRate >= THRESHOLDS.TE_INLINE_ANCHOR, anchor, 'High inline usage defines anchor deployment.');
  scoreIf(routeParticipation <= THRESHOLDS.TE_ROUTE_ANCHOR_MAX, anchor, 'Lower route volume indicates blocking-attached role.');
  scoreIf(adot <= 8.5, anchor, 'Lower target depth matches underneath inline profile.');

  const mismatch: RoleScore = { role: 'TE_MOVE_MISMATCH', score: 0, reasoning: [] };
  scoreIf(inlineRate < THRESHOLDS.TE_INLINE_MOVE_MAX, mismatch, 'Reduced inline rate supports move TE alignment.');
  scoreIf(routeParticipation >= THRESHOLDS.TE_ROUTE_MOVE, mismatch, 'High route participation indicates mismatch-focused role.');
  scoreIf(adot >= 8.5, mismatch, 'Higher aDOT supports seam and detached deployment.');

  const redZonePower: RoleScore = { role: 'TE_RED_ZONE_POWER', score: 0, reasoning: [] };
  scoreIf(redZoneTargetShare >= THRESHOLDS.TE_RED_ZONE_SHARE_HIGH, redZonePower, 'High red-zone target share defines scoring specialist role.');
  scoreIf(routeParticipation >= 0.6, redZonePower, 'Adequate route load supports repeatable scoring usage.');
  scoreIf(inlineRate >= 0.5, redZonePower, 'Inline presence helps red-zone mismatch and leverage usage.');

  return [anchor, mismatch, redZonePower];
}

function buildScores(input: NormalizedUsageInput): RoleScore[] {
  const builders: Record<OffensivePosition, (usage: NormalizedUsageInput) => RoleScore[]> = {
    QB: buildQbScores,
    RB: buildRbScores,
    WR: buildWrScores,
    TE: buildTeScores,
  };

  return builders[input.position](input);
}

function inferConfidence(topScore: number, margin: number): RoleConfidence {
  if (topScore >= THRESHOLDS.HIGH_CONFIDENCE_SCORE_MIN && margin >= THRESHOLDS.HIGH_CONFIDENCE_MARGIN_MIN) return 'HIGH';
  if (topScore >= THRESHOLDS.MEDIUM_CONFIDENCE_SCORE_MIN) return 'MEDIUM';
  return 'LOW';
}

function inferStability(missingMetricCount: number, margin: number): RoleStability {
  if (
    missingMetricCount >= THRESHOLDS.VOLATILE_MISSING_METRICS_MIN ||
    margin <= THRESHOLDS.VOLATILE_MARGIN_MAX
  ) {
    return 'VOLATILE';
  }
  if (missingMetricCount <= THRESHOLDS.STABLE_MISSING_METRICS_MAX && margin >= 2) return 'STABLE';
  return 'MODERATE';
}

function fallbackRole(position: OffensivePosition): TiberMatrixRoleId {
  if (position === 'QB') return 'QB_BALANCED_CREATOR';
  if (position === 'RB') return 'RB_CHANGE_OF_PACE';
  if (position === 'WR') return 'WR_FLANKER_CHAIN_MOVER';
  return 'TE_MOVE_MISMATCH';
}

export function assignRoleFromUsage(input: NormalizedUsageInput): PlayerRoleAssignment {
  const scores = buildScores(input).sort((a, b) => b.score - a.score);
  const [primaryCandidate, secondaryCandidate] = scores;

  const missingMetricCount = METRIC_KEYS.reduce((acc, key) => (value(input, key) === undefined ? acc + 1 : acc), 0);
  const isEmptyProfile = missingMetricCount === METRIC_KEYS.length;

  if (!primaryCandidate || isEmptyProfile) {
    return {
      player_id: input.player_id,
      player_name: input.player_name,
      team: input.team,
      season: input.season,
      position: input.position,
      primary_role: fallbackRole(input.position),
      role_confidence: 'LOW',
      role_stability: 'VOLATILE',
      assignment_reasoning: ['Insufficient deployment metrics; assigned position-level fallback role.'],
    };
  }

  const margin = primaryCandidate.score - (secondaryCandidate?.score ?? 0);
  const roleConfidence = inferConfidence(primaryCandidate.score, margin);
  const roleStability = inferStability(missingMetricCount, margin);
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
    assignment_reasoning: [
      ...primaryCandidate.reasoning,
      `Missing metrics counted: ${missingMetricCount}.`,
      `Top role score: ${primaryCandidate.score}; margin vs next role: ${margin}.`,
    ],
  };
}

export { THRESHOLDS as TIBER_MATRIX_ROLE_THRESHOLDS };
