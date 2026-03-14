import { assignRoleFromUsage } from '../assignRoleFromUsage';

describe('assignRoleFromUsage', () => {
  it('assigns QB structured distributor', () => {
    const assignment = assignRoleFromUsage({
      position: 'QB',
      designed_rush_rate: 0.03,
      scramble_rate: 0.04,
      deep_target_rate: 0.08,
      adot: 6.9,
    });

    expect(assignment.primary_role).toBe('QB_STRUCTURED_DISTRIBUTOR');
    expect(assignment.role_confidence).toBe('MEDIUM');
  });

  it('assigns QB dual threat engine', () => {
    const assignment = assignRoleFromUsage({
      position: 'QB',
      designed_rush_rate: 0.14,
      scramble_rate: 0.11,
      deep_target_rate: 0.19,
      adot: 9.2,
    });

    expect(assignment.primary_role).toBe('QB_DUAL_THREAT_ENGINE');
    expect(assignment.assignment_reasoning.join(' ')).toContain('designed rush');
  });

  it('assigns RB hybrid bell cow', () => {
    const assignment = assignRoleFromUsage({
      position: 'RB',
      carry_share: 0.56,
      route_rate: 0.63,
      third_down_snap_rate: 0.67,
      two_minute_snap_rate: 0.61,
      goal_line_carry_share: 0.34,
    });

    expect(assignment.primary_role).toBe('RB_HYBRID_BELL_COW');
  });

  it('assigns RB goal line hammer', () => {
    const assignment = assignRoleFromUsage({
      position: 'RB',
      carry_share: 0.28,
      route_rate: 0.22,
      goal_line_carry_share: 0.7,
      red_zone_carry_share: 0.56,
    });

    expect(assignment.primary_role).toBe('RB_GOAL_LINE_HAMMER');
  });

  it('assigns WR alpha boundary X', () => {
    const assignment = assignRoleFromUsage({
      position: 'WR',
      boundary_rate: 0.82,
      route_participation: 0.91,
      red_zone_target_share: 0.31,
      adot: 12.5,
    });

    expect(assignment.primary_role).toBe('WR_ALPHA_BOUNDARY_X');
  });

  it('assigns WR slot gadget', () => {
    const assignment = assignRoleFromUsage({
      position: 'WR',
      slot_rate: 0.78,
      motion_rate: 0.49,
      route_participation: 0.57,
      adot: 6.8,
      deep_target_rate: 0.09,
    });

    expect(assignment.primary_role).toBe('WR_SLOT_GADGET');
  });

  it('assigns TE inline anchor', () => {
    const assignment = assignRoleFromUsage({
      position: 'TE',
      inline_rate: 0.75,
      route_participation: 0.58,
      adot: 7.4,
      red_zone_target_share: 0.12,
    });

    expect(assignment.primary_role).toBe('TE_INLINE_ANCHOR');
  });

  it('assigns TE red zone power', () => {
    const assignment = assignRoleFromUsage({
      position: 'TE',
      inline_rate: 0.62,
      route_participation: 0.68,
      red_zone_target_share: 0.36,
      adot: 8.8,
    });

    expect(assignment.primary_role).toBe('TE_RED_ZONE_POWER');
  });

  it('returns fallback role when usage metrics are missing', () => {
    const assignment = assignRoleFromUsage({
      position: 'RB',
      player_id: '00-TEST',
    });

    expect(assignment.primary_role).toBe('RB_CHANGE_OF_PACE');
    expect(assignment.role_confidence).toBe('LOW');
    expect(assignment.role_stability).toBe('VOLATILE');
  });

  it('is deterministic for same input', () => {
    const usage = {
      position: 'WR' as const,
      boundary_rate: 0.7,
      deep_target_rate: 0.27,
      route_participation: 0.82,
      adot: 14.2,
    };

    const first = assignRoleFromUsage(usage);
    const second = assignRoleFromUsage(usage);

    expect(second).toEqual(first);
  });
});
