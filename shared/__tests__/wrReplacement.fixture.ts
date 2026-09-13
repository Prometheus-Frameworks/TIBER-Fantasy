import type { WrReplacement } from '../wrReplacement';
export function fixture() {
 const player=(id:string)=>({player_id:id,name:`Receiver ${id}`,position:'WR' as const,team:'SEA',status:'Active',injury_status:id==='11'?'Questionable':null,active:true});
 const input={canonicalUrl:'https://sleeper.com/roster/123/1',leagueId:'123',rosterId:1};
 const review={input,generated_at:'2026-09-12T12:00:00Z',observed:{league:{season:'2026',lineup_slots:{WR:1,BN:1}},current_roster:[{...player('11'),roster_state:'starter'},{...player('22'),roster_state:'bench'}]}};
 const pool:WrReplacement={schema_version:'tiber_wr_replacement_v1',input:{...input,target_player_id:'11'},season:'2026',target:player('11'),roster_player_ids:['11','22'],bench:[player('22')],unrostered:[player('33'),player('44')],observations:{received_at:'2026-09-12T13:00:00Z',directory_fetched_at:'2026-09-12T11:00:00Z',directory_cache_max_age_hours:24,source_urls:['https://api.sleeper.app/v1/league/123','https://api.sleeper.app/v1/league/123/rosters','https://api.sleeper.app/v1/players/nfl']},forecast:{status:'unavailable',fabricated_values:false},claim_eligibility:'unknown',lineup_locks:'unknown'};
 const history={schema_version:'tiber_draft_review_historical_v1',status:'unavailable',reason:'No admitted history',window:{season:2025},players:[]};
 return {review,pool,history};
}
