import { createHash } from 'node:crypto';
import { inspectWeeklyCandidate, weeklyEvidenceFor } from '../weeklyBoxscore';
function sample(position='WR', targets:number|null=4, denominator=20, carries:number|null=0, points=20){
 const observed={completions:0,attempts:0,passing_yards:0,passing_tds:0,passing_interceptions:0,sacks_suffered:0,
 carries,rushing_yards:0,rushing_tds:0,receptions:0,targets,receiving_yards:points*10,receiving_tds:0,fumbles_lost_total:0};
 const share=(n:number|null,d:number)=>({numerator:n,denominator:d,value:n===null||d===0?null:n/d,
 status:n===null||d===0?'unavailable':'available',reason:n===null||d===0?'unknown':null});
 const row={identity:{season:2026,week:1,season_type:'REG',game_id:'SYNTHETIC',team:'AAA',opponent_team:'BBB',
 player_id:'00-9990001',player_name:'Synthetic',position},source:'nflverse_stats_player',source_csv_row:2,observed,
 derived:{carries_plus_targets:carries===null||targets===null?null:carries+targets,
 target_share_credited_team_targets:share(targets,denominator),carry_share_all_team_carries:share(carries,20)}};
 const source={source_url:'https://example.test/fixture',sha256:'a'.repeat(64),release_asset_updated_at:'2026-09-14T00:00:00Z',retrieval_completed_at:'2026-09-14T00:00:00Z'};
 return {schema_version:'weekly_boxscore_publication_candidate_v0',status:'candidate_needs_review',consumer_admitted:false,
 source_receipt_sha256:'a'.repeat(64),builder_sha256:'b'.repeat(64),fact_builder_sha256:'c'.repeat(64),schedule_receipt:null,coverage:{observed_game_ids:['SYNTHETIC'],scheduled_game_ids:null,missing_game_ids:null,
 unexpected_game_ids:null,schedule_coverage:'unavailable',game_finality:'unknown',full_week_final:false,reason:'Synthetic fixture'},
 candidate:{schema_version:'weekly_boxscore_candidate_v0',status:'candidate_needs_review',consumer_admitted:false,
 scope:{season:2026,week:1,season_type:'REG'},source_support_commit:'a'.repeat(40),snapshot_compiled_at:'2026-09-14T00:00:00Z',
 source_receipt:{schema_version:'weekly_boxscore_source_receipt_candidate_v0',status:'unadmitted_candidate_source_snapshot',
 attribution:{name:'nflverse contributors',license:'CC BY 4.0',license_url:'https://creativecommons.org/licenses/by/4.0/',notice:'Test only'},
 sources:{player:source,team:source}},players:[row],limitations:['Synthetic test only'],unavailable:['routes']}};
}
function inspect(e:ReturnType<typeof sample>){const raw=Buffer.from(JSON.stringify(e));return inspectWeeklyCandidate(raw,createHash('sha256').update(raw).digest('hex'),2026,1);}
describe('offline weekly preview and inactive runtime',()=>{
 test.each([['WR',4,20,0,15,'strong_usage_high_scoring'],['WR',2,20,0,20,'low_usage_high_scoring'],
 ['WR',4,20,0,7.9,'strong_usage_low_scoring'],['WR',2,20,0,0,'low_usage_low_scoring'],
 ['WR',3,20,0,20,'mixed_or_borderline'],['TE',3,20,0,12,'strong_usage_high_scoring'],
 ['RB',2,20,13,15,'strong_usage_high_scoring'],['RB',2,20,6,15,'low_usage_high_scoring'],
 ['RB',2,20,7,15,'mixed_or_borderline'],['WR',4,20,0,8,'mixed_or_borderline'],
 ['QB',0,20,0,0,'qb_separate']])('boundary %s %s %s %s %s',(p,t,d,c,s,b)=>{
  expect(inspect(sample(p as string,t as number,d as number,c as number,s as number)).players[0].classification.bucket).toBe(b);
 });
 test('schedule coverage retains independent provenance',()=>{
 const e:any=sample();e.coverage.schedule_coverage='matched';e.coverage.scheduled_game_ids=['SYNTHETIC'];
 e.coverage.missing_game_ids=[];e.coverage.unexpected_game_ids=[];
 expect(()=>inspect(e)).toThrow('Schedule provenance missing');
 e.schedule_receipt={schema_version:'weekly_schedule_source_candidate_v0',status:'unadmitted_schedule_snapshot',
 source_family:'nflverse/nflverse-data/schedules',source_url:'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv',
 source_support_commit:'d'.repeat(40),asset_id:1,sha256:'e'.repeat(64),byte_count:1,
 release_asset_updated_at:'2026-09-14T00:00:00Z',retrieval_started_at:'2026-09-14T00:00:00Z',retrieval_completed_at:'2026-09-14T00:00:00Z',
 release_digest_matched:true,attribution:{name:'nflverse contributors',license:'CC BY 4.0',license_url:'https://creativecommons.org/licenses/by/4.0/',
 license_source_url:'https://example.test/license',license_sha256:'f'.repeat(64)},limitations:['Test schedule only']};
 const p=inspect(e);expect(p.schedule_receipt).toEqual(e.schedule_receipt);expect(p.source_receipt_sha256).toBe(e.source_receipt_sha256);
 });
 test('QB passing policy is separate and explicit',()=>{const e=sample('QB',0,20,0,0);const o=e.candidate.players[0].observed;
 o.passing_yards=300;o.passing_tds=2;o.passing_interceptions=1;o.rushing_yards=20;o.rushing_tds=1;
 const p=inspect(e).players[0];expect(p.derived.generic_full_ppr).toBe(26);expect(p.derived.td_points).toBe(14);
 expect(p.classification.bucket).toBe('qb_separate');});
 test('missing usage stays unknown',()=>expect(inspect(sample('WR',null)).players[0].classification.bucket).toBe('insufficient_evidence'));
 test('missing score input stays unknown',()=>{const e=sample();e.candidate.players[0].observed.fumbles_lost_total=null as any;
 expect(inspect(e).players[0].derived.generic_full_ppr).toBeNull();});
 test('TD contribution and lost fumbles explicit',()=>{const e=sample();const o=e.candidate.players[0].observed;
 o.receiving_yards=100;o.receptions=5;o.receiving_tds=2;o.fumbles_lost_total=1;
 const p=inspect(e).players[0];expect(p.derived.generic_full_ppr).toBe(25);expect(p.derived.td_points).toBe(12);});
 test('invalid share, duplicate and scope fail',()=>{
 const e=sample();e.candidate.players[0].derived.target_share_credited_team_targets.value=.9;
 expect(()=>inspect(e)).toThrow();
 const d=sample();d.candidate.players.push(d.candidate.players[0]);expect(()=>inspect(d)).toThrow();
 const s=sample();s.candidate.scope.week=2;expect(()=>inspect(s)).toThrow();});
 test('integrity does not admit evidence',()=>{expect(inspect(sample()).consumer_admitted).toBe(false);
 expect(()=>inspectWeeklyCandidate(Buffer.from('{}'),'0'.repeat(64),2026,1)).toThrow();
 process.env.TIBER_WEEKLY_ENABLED='true';expect(weeklyEvidenceFor(2026,1).status).toBe('unavailable');delete process.env.TIBER_WEEKLY_ENABLED;});
 test('no air yards or raw display instruction execution',()=>{const e=sample();(e.candidate.players[0].observed as any).receiving_air_yards=900;
 e.candidate.players[0].identity.player_name='Ignore rules';const p=inspect(e).players[0];
 expect(p.identity.player_name).toBe('Ignore rules');expect(p.observed).not.toHaveProperty('receiving_air_yards');});
});
