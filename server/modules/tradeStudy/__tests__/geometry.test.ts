import { evaluatePaperTradeGeometry, evaluateProductionTradeGeometry } from '../geometry';
import type { PaperPlayer, PaperTradeGeometryInput } from '../schemas';

const player = (id: string, position: PaperPlayer['position'], container: PaperPlayer['container'] = 'bench'): PaperPlayer => ({ player_id: `fixture:${id}`, position, container });
function input(): PaperTradeGeometryInput {
  return {
    schema_id: 'tiber.trade-study.paper-geometry-input.v0', mode: 'isolated_paper', league_id: 'fixture:league',
    rules: { ordinary_capacity: 4, reserve_capacity: 1, taxi_capacity: 1, lineup: { RB: 2, FLEX: 1 } },
    operator_roster: { roster_id: 'fixture:operator', players: [player('a', 'RB', 'starter'), player('b', 'WR', 'starter'), player('c', 'WR'), player('d', 'TE', 'reserve')] },
    counterparty_roster: { roster_id: 'fixture:partner', players: [player('e', 'RB', 'starter'), player('f', 'RB'), player('g', 'RB'), player('h', 'TE')] },
    package: { operator_gives: ['fixture:a'], operator_receives: ['fixture:e', 'fixture:f'] },
  };
}
function available(value = input()) {
  const result = evaluatePaperTradeGeometry(value);
  if (result.status !== 'paper_geometry_available') throw new Error(result.reason);
  return result;
}

describe('isolated two-sided package geometry', () => {
  it('derives a one-for-two exchange with both before and after states', () => {
    const result = available();
    expect(result.geometry.operator.before.ordinary_position_counts.RB).toBe(1);
    expect(result.geometry.operator.after.ordinary_position_counts.RB).toBe(2);
    expect(result.geometry.operator.after.occupancy).toEqual({ ordinary: 4, reserve: 1, taxi: 0 });
    expect(result.geometry.counterparty.after.ordinary_position_counts.RB).toBe(2);
    expect(result.geometry.counterparty.after.ordinary_open_slots).toBe(1);
    expect(result.geometry.operator.removed_observed_starter_ids).toEqual(['fixture:a']);
    expect(result.geometry.operator.after.players.filter(p => ['fixture:e', 'fixture:f'].includes(p.player_id)).every(p => p.container === 'bench')).toBe(true);
    expect(result.geometry.operator.after.position_only_lineup).toEqual({ status: 'available', required_slots: 3, fillable_slots: 3, all_fillable: true });
    expect(result).toMatchObject({ legality: 'unknown', feasibility: 'unknown', plausibility: 'unavailable', desirability: 'not_evaluated', execution: { performed: false, authorized: false }, durable_records: 0 });
  });

  it('accepts multi-player exchange on both sides and opens ordinary slots independently', () => {
    const value = input();
    value.package.operator_gives.push('fixture:b');
    const result = available(value);
    expect(result.geometry.operator.after.occupancy.ordinary).toBe(3);
    expect(result.geometry.counterparty.after.occupancy.ordinary).toBe(4);
    expect(result.geometry.operator.after.ordinary_open_slots).toBe(1);
  });

  it('enumerates all forced-cut choices without choosing a player', () => {
    const value = input();
    value.operator_roster.players.push(player('i', 'WR'));
    const own = available(value).geometry.operator;
    expect(own.capacity_status).toBe('requires_operator_cut_choice');
    expect(own.after.ordinary_over_capacity).toBe(1);
    expect(own.cut_variants).toEqual({ status: 'enumerated', variants: [['fixture:b'], ['fixture:c'], ['fixture:e'], ['fixture:f'], ['fixture:i']] });
    expect(own).not.toHaveProperty('selected_cut_variant');
    expect(own.after.players).toHaveLength(6); // No cut was applied; reserve is still present.
  });

  it('derives forced cuts for the counterparty side too', () => {
    const value = input();
    value.package = { operator_gives: ['fixture:a', 'fixture:b'], operator_receives: ['fixture:e'] };
    const partner = available(value).geometry.counterparty;
    expect(partner.capacity_status).toBe('requires_operator_cut_choice');
    expect(partner.cut_variants).toMatchObject({ status: 'enumerated', variants: [['fixture:a'], ['fixture:b'], ['fixture:f'], ['fixture:g'], ['fixture:h']] });
  });

  it('matches flex without taking the RB needed by the dedicated slot', () => {
    const value = input();
    value.rules.lineup = { RB: 2, FLEX: 2 };
    expect(available(value).geometry.operator.after.position_only_lineup).toMatchObject({ fillable_slots: 4, all_fillable: true });
  });

  it('does not count reserve or taxi players as lineup coverage', () => {
    const value = input();
    value.operator_roster.players.find(p => p.player_id === 'fixture:d')!.position = 'RB';
    value.operator_roster.players.push(player('i', 'RB', 'taxi'));
    const own = available(value).geometry.operator;
    expect(own.before.position_only_lineup).toMatchObject({ fillable_slots: 2, all_fillable: false });
    expect(own.after.players.filter(p => p.container === 'reserve' || p.container === 'taxi')).toEqual([player('d', 'RB', 'reserve'), player('i', 'RB', 'taxi')]);
  });

  it('keeps unknown ordinary positions unavailable rather than treating them as zero coverage', () => {
    const value = input();
    value.operator_roster.players.find(p => p.player_id === 'fixture:b')!.position = null;
    expect(available(value).geometry.operator.after.position_only_lineup).toEqual({ status: 'unavailable', reason: 'unknown_ordinary_position' });
  });

  it('returns byte-stable geometry under roster, package and lineup key permutations', () => {
    const value = input();
    value.package.operator_gives.push('fixture:b');
    const expected = JSON.stringify(available(value));
    value.operator_roster.players.reverse(); value.counterparty_roster.players.reverse();
    value.package.operator_gives.reverse(); value.package.operator_receives.reverse();
    value.rules.lineup = { FLEX: 1, RB: 2 };
    expect(JSON.stringify(available(value))).toBe(expected);
  });

  it('does not mutate the supplied snapshots or package', () => {
    const value = input(); const original = JSON.stringify(value);
    available(value);
    expect(JSON.stringify(value)).toBe(original);
  });

  it('refuses to present a truncated cut enumeration as a shortlist', () => {
    const value = input(); value.rules.ordinary_capacity = 20;
    value.operator_roster.players = Array.from({ length: 20 }, (_, i) => player(`own${i}`, 'WR'));
    value.counterparty_roster.players = Array.from({ length: 4 }, (_, i) => player(`other${i}`, 'RB'));
    value.package = { operator_gives: ['fixture:own0'], operator_receives: value.counterparty_roster.players.map(p => p.player_id) };
    const own = available(value).geometry.operator;
    expect(own.after.ordinary_over_capacity).toBe(3);
    expect(own.capacity_status).toBe('requires_operator_cut_choice');
    expect(own.cut_variants).toEqual({ status: 'unavailable', reason: 'cut_variant_bound_exceeded', variants: [] });
  });
});

describe('fail-closed admission', () => {
  const mutations: [string, (value: any) => void, string][] = [
    ['real identity', v => { v.operator_roster.players[0].player_id = '00-0000001'; }, 'invalid_paper_input'],
    ['extra scoring field', v => { v.package.trade_score = 99; }, 'invalid_paper_input'],
    ['extra manager profile', v => { v.counterparty_roster.manager_tendency = 'aggressive'; }, 'invalid_paper_input'],
    ['conditional term', v => { v.package.condition = 'if activated'; }, 'invalid_paper_input'],
    ['third party', v => { v.third_roster = v.counterparty_roster; }, 'invalid_paper_input'],
    ['draft pick', v => { v.package.operator_gives = [{ pick: 1 }]; }, 'invalid_paper_input'],
    ['missing capacity', v => { delete v.rules.reserve_capacity; }, 'invalid_paper_input'],
    ['unsupported lineup', v => { v.rules.lineup.IDP = 1; }, 'invalid_paper_input'],
    ['empty lineup', v => { v.rules.lineup = {}; }, 'invalid_paper_input'],
    ['zero lineup', v => { v.rules.lineup = { RB: 0 }; }, 'invalid_paper_input'],
    ['invalid count', v => { v.rules.ordinary_capacity = -1; }, 'invalid_paper_input'],
    ['lineup exceeds capacity', v => { v.rules.lineup.RB = 5; }, 'lineup_exceeds_ordinary_capacity'],
    ['same roster', v => { v.counterparty_roster.roster_id = v.operator_roster.roster_id; }, 'same_roster'],
    ['duplicate roster player', v => { v.counterparty_roster.players.push(v.operator_roster.players[0]); }, 'duplicate_roster_identity'],
    ['duplicate package player', v => { v.package.operator_receives.push('fixture:e'); }, 'duplicate_package_identity'],
    ['wrong side', v => { v.package.operator_gives = ['fixture:g']; }, 'asset_not_on_stated_roster'],
    ['unobserved player', v => { v.package.operator_gives = ['fixture:missing']; }, 'asset_not_on_stated_roster'],
    ['reserve exchange', v => { v.package.operator_gives = ['fixture:d']; }, 'unsupported_reserve_or_taxi_exchange'],
    ['taxi exchange', v => { v.counterparty_roster.players[0].container = 'taxi'; }, 'unsupported_reserve_or_taxi_exchange'],
    ['baseline ordinary over capacity', v => { v.operator_roster.players.push(player('i', 'WR'), player('j', 'WR')); }, 'invalid_baseline_capacity'],
    ['baseline reserve over capacity', v => { v.operator_roster.players.push(player('i', 'WR', 'reserve')); }, 'invalid_baseline_capacity'],
    ['empty side', v => { v.package.operator_gives = []; }, 'invalid_paper_input'],
    ['live mode', v => { v.mode = 'production'; }, 'invalid_paper_input'],
  ];
  it.each(mutations)('refuses %s before producing geometry', (_label, mutate, reason) => {
    const value = input(); mutate(value);
    expect(evaluatePaperTradeGeometry(value)).toEqual({ status: 'refused', reason, geometry: null, execution: { performed: false, authorized: false }, durable_records: 0 });
  });
  it.each([undefined, null, {}, input()])('production always refuses with zero durable records (%#)', value => {
    expect(evaluateProductionTradeGeometry(value)).toEqual({ status: 'refused', reason: 'production_contract_unavailable', geometry: null, execution: { performed: false, authorized: false }, durable_records: 0 });
  });
});
