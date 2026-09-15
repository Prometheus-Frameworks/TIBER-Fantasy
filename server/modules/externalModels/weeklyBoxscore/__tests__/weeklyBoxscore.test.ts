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
function syntheticSchedule(){return {schema_version:'weekly_schedule_source_candidate_v0',status:'unadmitted_schedule_snapshot',
 source_family:'nflverse/nflverse-data/schedules',source_url:'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv',
 source_support_commit:'d'.repeat(40),asset_id:1,sha256:'e'.repeat(64),byte_count:1,
 release_asset_updated_at:'2026-09-14T00:00:00Z',retrieval_started_at:'2026-09-14T00:00:00Z',retrieval_completed_at:'2026-09-14T00:00:00Z',
 release_digest_matched:true,attribution:{name:'nflverse contributors',license:'CC BY 4.0',license_url:'https://creativecommons.org/licenses/by/4.0/',
 license_source_url:'https://example.test/license',license_sha256:'f'.repeat(64)},limitations:['Test schedule only']};}
function scheduledSample(){const e:any=sample();e.schedule_receipt=syntheticSchedule();
 e.coverage={...e.coverage,schedule_coverage:'matched',scheduled_game_ids:['SYNTHETIC'],missing_game_ids:[],unexpected_game_ids:[]};return e;}
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
 e.schedule_receipt=syntheticSchedule();
 const p=inspect(e);expect(p.schedule_receipt).toEqual(e.schedule_receipt);expect(p.source_receipt_sha256).toBe(e.source_receipt_sha256);
 });
 test.each([
 ['null scheduled',{scheduled_game_ids:null}],['null missing',{missing_game_ids:null}],
 ['null unexpected',{unexpected_game_ids:null}],['empty schedule',{scheduled_game_ids:[]}],
 ['duplicate observed',{observed_game_ids:['SYNTHETIC','SYNTHETIC']}],
 ['duplicate scheduled',{scheduled_game_ids:['SYNTHETIC','SYNTHETIC']}],
 ['false match',{scheduled_game_ids:['SYNTHETIC','MISSING'],missing_game_ids:['MISSING']}],
 ['omitted missing',{schedule_coverage:'partial_or_conflicting',scheduled_game_ids:['SYNTHETIC','MISSING']}],
 ['invented unexpected',{unexpected_game_ids:['OTHER']}],
 ['false partial',{schedule_coverage:'partial_or_conflicting'}],
 ['duplicate missing',{schedule_coverage:'partial_or_conflicting',scheduled_game_ids:['SYNTHETIC','MISSING'],missing_game_ids:['MISSING','MISSING']}],
 ['empty id',{scheduled_game_ids:['']}],
 ])('rejects unsupported coverage: %s',(_label,change)=>{
  const e=scheduledSample();Object.assign(e.coverage,change);expect(()=>inspect(e)).toThrow('Schedule coverage conflict');
 });
 test('accepts supported partial coverage and preserves unknown finality',()=>{
  const e=scheduledSample();Object.assign(e.coverage,{schedule_coverage:'partial_or_conflicting',
   scheduled_game_ids:['MISSING'],missing_game_ids:['MISSING'],unexpected_game_ids:['SYNTHETIC']});
  const p=inspect(e);expect(p.coverage).toEqual(e.coverage);expect(p.coverage.full_week_final).toBe(false);
 });
 test('unavailable schedule cannot carry asserted game lists',()=>{
  const e:any=sample();e.coverage.missing_game_ids=[];expect(()=>inspect(e)).toThrow('Schedule coverage conflict');
 });
 test('rejects same player/game under conflicting teams; permits different games',()=>{
  const e=sample();const other=JSON.parse(JSON.stringify(e.candidate.players[0]));other.source_csv_row=3;
  other.identity.team='BBB';other.identity.opponent_team='AAA';e.candidate.players.push(other);
  expect(()=>inspect(e)).toThrow('Weekly identity conflict');
  other.identity.game_id='OTHER';e.coverage.observed_game_ids.push('OTHER');
  expect(inspect(e).players).toHaveLength(2);
 });
 test.each(['matched','partial_or_conflicting','unavailable'])('rejects unsupported observed games for %s',status=>{
  const e=scheduledSample();e.coverage.observed_game_ids.push('PHANTOM');
  if(status==='matched')e.coverage.scheduled_game_ids.push('PHANTOM');
  if(status==='partial_or_conflicting'){e.coverage.schedule_coverage=status;e.coverage.unexpected_game_ids=['PHANTOM'];}
  if(status==='unavailable'){e.schedule_receipt=null;Object.assign(e.coverage,{schedule_coverage:status,scheduled_game_ids:null,missing_game_ids:null,unexpected_game_ids:null});}
  expect(()=>inspect(e)).toThrow('Observed game coverage conflict');
 });
 test('rejects an empty row set behind claimed matched coverage',()=>{
  const e=scheduledSample();e.candidate.players=[];expect(()=>inspect(e)).toThrow('Observed game coverage conflict');
 });
 test('uses all source positions for coverage before filtering displayed players',()=>{
  const e=scheduledSample();const other=JSON.parse(JSON.stringify(e.candidate.players[0]));other.source_csv_row=3;
  other.identity.game_id='DEFENSE';other.identity.position='DB';e.candidate.players.push(other);
  e.coverage.observed_game_ids.push('DEFENSE');e.coverage.scheduled_game_ids.push('DEFENSE');
  expect(inspect(e).players).toHaveLength(1);
 });
 test('rejects self-opponents',()=>{
  const e=sample();e.candidate.players[0].identity.opponent_team='AAA';
  expect(()=>inspect(e)).toThrow('Weekly matchup conflict');
 });
 test('rejects conflicting matchups across distinct players, including hidden positions',()=>{
  const e=sample();const other=JSON.parse(JSON.stringify(e.candidate.players[0]));other.source_csv_row=3;
  other.identity.player_id='00-9990002';other.identity.position='DB';other.identity.opponent_team='CCC';
  e.candidate.players.push(other);expect(()=>inspect(e)).toThrow('Weekly matchup conflict');
 });
 test('accepts reciprocal matchups and independent pairs in other games',()=>{
  const e=sample();const other=JSON.parse(JSON.stringify(e.candidate.players[0]));other.source_csv_row=3;
  other.identity.player_id='00-9990002';other.identity.team='BBB';other.identity.opponent_team='AAA';
  e.candidate.players.push(other);expect(inspect(e).players).toHaveLength(2);
  const next=JSON.parse(JSON.stringify(other));next.source_csv_row=4;next.identity.game_id='OTHER';next.identity.opponent_team='CCC';
  e.candidate.players.push(next);e.coverage.observed_game_ids.push('OTHER');
  expect(inspect(e).players).toHaveLength(3);
 });
 test.each(['target_share_credited_team_targets','carry_share_all_team_carries'] as const)('rejects conflicting team denominators: %s',field=>{
  const e=sample();const other=JSON.parse(JSON.stringify(e.candidate.players[0]));other.source_csv_row=3;
  other.identity.player_id='00-9990002';other.identity.position='DB';
  other.derived[field].denominator=40;other.derived[field].value=other.derived[field].numerator/40;
  e.candidate.players.push(other);expect(()=>inspect(e)).toThrow('Team denominator conflict');
 });
 test('permits independent denominators for opponents and different games',()=>{
  const e=sample();const other=JSON.parse(JSON.stringify(e.candidate.players[0]));other.source_csv_row=3;
  other.identity.player_id='00-9990002';other.identity.team='BBB';other.identity.opponent_team='AAA';
  other.derived.target_share_credited_team_targets.denominator=40;other.derived.target_share_credited_team_targets.value=.1;
  e.candidate.players.push(other);expect(inspect(e).players).toHaveLength(2);
  other.identity.game_id='OTHER';other.identity.team='AAA';other.identity.opponent_team='BBB';e.coverage.observed_game_ids.push('OTHER');
  expect(inspect(e).players).toHaveLength(2);
 });
 test('rejects receptions exceeding known targets; preserves nullable inputs',()=>{
  const e=sample();e.candidate.players[0].observed.receptions=5;
  expect(()=>inspect(e)).toThrow('Receptions exceed targets');
  e.candidate.players[0].observed.receptions=4;expect(inspect(e).players).toHaveLength(1);
  e.candidate.players[0].observed.receptions=null as any;expect(inspect(e).players[0].derived.generic_full_ppr).toBeNull();
  const unknown=sample('WR',null);unknown.candidate.players[0].observed.receptions=5;
  expect(inspect(unknown).players[0].classification.bucket).toBe('insufficient_evidence');
 });
 test.each(['targets','carries'] as const)('rejects summed %s above team total',field=>{
  const e=sample('RB',4,5,4);const a=e.candidate.players[0];
  const shareField=field==='targets'?'target_share_credited_team_targets':'carry_share_all_team_carries';
  a.derived[shareField].denominator=5;a.derived[shareField].value=.8;
  const b=JSON.parse(JSON.stringify(a));b.identity.player_id='00-9990002';b.source_csv_row=3;
  e.candidate.players.push(b);expect(()=>inspect(e)).toThrow('Team opportunities exceed denominator');
 });
 test('sum checks include known numerators with unknown denominators, independent of order',()=>{
  const e=sample('WR',4,5);const b=JSON.parse(JSON.stringify(e.candidate.players[0]));
  b.source_csv_row=3;b.identity.player_id='00-9990002';b.identity.position='DB';
  Object.assign(b.derived.target_share_credited_team_targets,{denominator:null,value:null,status:'unavailable',reason:'unknown'});
  e.candidate.players.push(b);expect(()=>inspect(e)).toThrow('Team opportunities exceed denominator');
  e.candidate.players.reverse();expect(()=>inspect(e)).toThrow('Team opportunities exceed denominator');
  const a=e.candidate.players[1];a.derived.target_share_credited_team_targets.denominator=8;a.derived.target_share_credited_team_targets.value=.5;
  expect(inspect(e).players).toHaveLength(1);
 });
 test('rejects completions above attempts, but retains unknowns',()=>{
  const e=sample('QB');const o=e.candidate.players[0].observed;o.completions=2;o.attempts=1;
  expect(()=>inspect(e)).toThrow('Completions exceed attempts');
  o.attempts=2;expect(inspect(e).players).toHaveLength(1);
  o.attempts=null as any;expect(inspect(e).players[0].observed.attempts).toBeNull();
 });
 test.each([
  {completions:5,attempts:5,passing_interceptions:5},
  {completions:1,attempts:5,passing_tds:2},
 ])('rejects impossible passing totals %j',change=>{
  const e=sample('QB');Object.assign(e.candidate.players[0].observed,change);
  expect(()=>inspect(e)).toThrow(/Passing/);
 });
 test.each([
  {completions:5,attempts:6,passing_interceptions:1,passing_tds:5},
  {completions:null,attempts:6,passing_interceptions:1,passing_tds:2},
  {completions:5,attempts:null,passing_interceptions:1,passing_tds:2},
  {completions:5,attempts:6,passing_interceptions:null,passing_tds:2},
  {completions:5,attempts:6,passing_interceptions:1,passing_tds:null},
 ])('preserves passing equality and nullable counters %j',change=>{
  const e=sample('QB');Object.assign(e.candidate.players[0].observed,change);
  expect(inspect(e).players[0].observed).toMatchObject(change);
 });
 test.each(['target_share_credited_team_targets','carry_share_all_team_carries'] as const)('rejects falsely unavailable %s',field=>{
  const e=sample('RB',4,20,4);const share=e.candidate.players[0].derived[field];
  Object.assign(share,{status:'unavailable',value:null,reason:'unknown'});
  expect(()=>inspect(e)).toThrow('Share mismatch');
  share.numerator=0;
  if(field==='target_share_credited_team_targets')e.candidate.players[0].observed.targets=0;
  else e.candidate.players[0].observed.carries=0;
  e.candidate.players[0].derived.carries_plus_targets=4;
  expect(()=>inspect(e)).toThrow('Share mismatch');
  Object.assign(share,{status:'available',value:0,reason:null});
  expect(inspect(e).players[0].derived[field].value).toBe(0);
 });
 test.each(['receiving','rushing'] as const)('preserves a lateral %s TD without a credited touch',kind=>{
  // NFL Guide for Statisticians (2025), Rushing p12 and Laterals p17.
  const e=sample('RB',0,20,0,0);const o=e.candidate.players[0].observed;
  o[`${kind}_tds`]=1;o[`${kind}_yards`]=5;
  const row=inspect(e).players[0];
  expect(row.observed.receptions).toBe(0);expect(row.observed.carries).toBe(0);
  expect(row.derived.generic_full_ppr).toBe(6.5);expect(row.derived.td_points).toBe(6);
 });
 test('rejects reused source rows across distinct identities',()=>{
  const e=sample();const b=JSON.parse(JSON.stringify(e.candidate.players[0]));b.identity.player_id='00-9990002';
  e.candidate.players.push(b);expect(()=>inspect(e)).toThrow('Source row conflict');
 });
 test('QB passing policy is separate and explicit',()=>{const e=sample('QB',0,20,0,0);const o=e.candidate.players[0].observed;
 o.completions=20;o.attempts=30;o.passing_yards=300;o.passing_tds=2;o.passing_interceptions=1;o.rushing_yards=20;o.rushing_tds=1;
 const p=inspect(e).players[0];expect(p.derived.generic_full_ppr).toBe(26);expect(p.derived.td_points).toBe(14);
 expect(p.classification.bucket).toBe('qb_separate');});
 test('missing usage stays unknown',()=>expect(inspect(sample('WR',null)).players[0].classification.bucket).toBe('insufficient_evidence'));
 test('missing score input stays unknown',()=>{const e=sample();e.candidate.players[0].observed.fumbles_lost_total=null as any;
 expect(inspect(e).players[0].derived.generic_full_ppr).toBeNull();});
 test('TD contribution and lost fumbles explicit',()=>{const e=sample('WR',5);const o=e.candidate.players[0].observed;
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
