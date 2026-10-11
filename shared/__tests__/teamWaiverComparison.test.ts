import { deriveWaiverSettings, type WaiverCandidates } from '../teamWaiverContext';
import { parseWaiverComparisonHistory, waiverComparisonPacket } from '../teamWaiverComparison';
const review = { input: { leagueId: '123', rosterId: 1, canonicalUrl: 'https://sleeper.com/roster/123/1' }, generated_at: '2026-09-19T00:00:00Z', observed: { league: { season: '2026' } } };
const result: WaiverCandidates = {
  schema_version: 'tiber_team_waiver_candidates_v1', status: 'available', input: review.input, season: '2026',
  observations: { league_received_at: review.generated_at, rosters_received_at: review.generated_at, directory_fetched_at: review.generated_at, directory_source_updated_at: null, directory_cache_max_age_hours: 24, expected_rosters: 2, received_rosters: 2, source_urls: ['https://example.com/league', 'https://example.com/rosters', 'https://example.com/players'] },
  derivation: 'active_current_nfl_team_skill_players_minus_all_league_membership', claim_eligibility: 'unknown', waiver_settings: deriveWaiverSettings({waiver_type:2,waiver_budget:100},{waiver_budget_used:100}),
  candidates: ['11', '22', '33'].map(player_id => ({player_id,name: `Candidate ${player_id}`,position:'WR',team:'NO',status:'Active',active:true})),
};
test('pair handoff excludes other pool members and retains actual zero budget', () => {
  const packet = waiverComparisonPacket(review, result, ['11','22'], null);
  expect(packet.waiver_exploration).toMatchObject({ selected_candidates: [{player_id:'11'},{player_id:'22'}], waiver_settings:{derived:{faab_remaining:0}} });
  expect(JSON.stringify(packet)).not.toContain('Candidate 33');
  expect(packet.waiver_comparison.historical.status).toBe('unavailable');
});
test.each([['11','11'],['11'],['11','99'],['11','22','33']])('invalid pair rejected: %j', (...ids) => {
  expect(() => waiverComparisonPacket(review,result,ids,null)).toThrow();
});
test('wrong season, roster and incomplete league checks cannot be exported', () => {
  for (const next of [{...result,season:'2025'}, {...result,input:{...result.input,rosterId:2}}, {...result,observations:{...result.observations,received_rosters:1}}]) {
    expect(() => waiverComparisonPacket(review,next,['11','22'],null)).toThrow();
  }
});
test('wrong historical scope, duplicate identities and current-season masquerading rejected', () => {
  const raw = { schema_version:'tiber_draft_review_historical_v1',status:'unavailable',reason:'missing',window:{season:2025,week_start:1,week_end:18,period_basis:'weeks'},provenance:null,players:[],limitations:[],unavailable_metrics:{},forecast:{status:'unavailable',fabricated_values:false} };
  expect(parseWaiverComparisonHistory(raw,['11','22']).status).toBe('unavailable');
  expect(() => parseWaiverComparisonHistory({...raw,window:{...raw.window,season:2026}},['11','22'])).toThrow();
  const p = {player_id:'11',status:'unavailable',reason:'missing',identity:null,observed:null,derived:{}};
  expect(() => parseWaiverComparisonHistory({...raw,players:[p,p]},['11','22'])).toThrow();
  expect(() => parseWaiverComparisonHistory({...raw,players:[{...p,player_id:'99'}]},['11','22'])).toThrow();
});
