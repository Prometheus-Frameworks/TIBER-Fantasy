import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLeagueTools } from '../server/modules/leagueMcp/tools';
import { discoverTeamLeagues, findTeamLeagueRosters } from '../server/modules/draftReview/teamLeagues';
import { getRosterContext } from '../server/modules/leagueMcp/rosterContext';
import { buildManagerResult } from '../server/modules/draftReview/teamManager';
export const input={userId:'123',leagueId:'10',season:'2026'};
const league={league_id:'10',season:'2026',name:'Synthetic',sport:'nfl',status:'in_season',total_rosters:2,settings:{type:2,best_ball:0,playoff_week_start:15},scoring_settings:{rec:0},roster_positions:['QB','WR','BN']};
const rosters=[{roster_id:1,owner_id:'123',players:['100'],starters:['100','0'],reserve:null,taxi:null},{roster_id:2,owner_id:'456',players:['200'],starters:['200']}];
export function sources():any{return {getUser:async()=>({user_id:'123',display_name:'<untrusted>'}),getUserLeagues:async()=>[league],getLeague:async()=>structuredClone(league),getLeagueRosters:async()=>structuredClone(rosters),getDirectory:async()=>({fetchedAt:Date.parse('2026-10-01'),players:{'100':{player_id:'100',full_name:'Synthetic QB',position:'QB'}}}),getManagerMatchups:async()=>[{roster_id:1,matchup_id:1,points:0,custom_points:null},{roster_id:2,matchup_id:1,points:-1,custom_points:null}],getManagerNflState:async()=>({season:'2026',season_type:'regular',leg:5})};}
export function readers(){const s=sources();return {leagues:(i:any)=>discoverTeamLeagues(i.account,i.season,s),memberships:(i:any)=>findTeamLeagueRosters(i.userId,i.leagueId,i.season,s),roster:(i:any)=>getRosterContext(i,s),matchups:(i:any)=>buildManagerResult(i,s)};}
test('historical season and non-regular phase retain scores but cannot establish outcomes',async()=>{
 for(const scenario of [
  {season:'2025',state:{season:'2026',season_type:'regular',leg:5}},
  {season:'2026',state:{season:'2026',season_type:'pre',leg:5}},
  {season:'2026',state:{season:'2026',season_type:'post',leg:5}},
 ]){
  const s=sources();s.getLeague=async()=>({...league,season:scenario.season,status:'complete'});
  s.getManagerNflState=async()=>scenario.state;
  const r=await buildManagerResult({...input,season:scenario.season,week:'4'},s);
  assert.equal(r.status,'available');assert.equal(r.rosters[0].outcome,'unavailable');
  assert.equal(r.rosters[0].points,0);assert.equal(r.rosters[0].opponentPoints,-1);
  assert.equal(r.finality,'not_verified');assert.match(r.reason!,/season or phase/);
  assert.ok(r.observations.nflStateReceivedAt);
 }
});
test('disabled source refuses retrieval',async()=>{assert.equal((await createLeagueTools()('tiber_list_leagues',{account:'synthetic',season:'2026'})).reason,'source_disabled');});
test('complete discovery and roster flow preserves zero, null and exact identity',async()=>{const call=createLeagueTools(readers());const l:any=await call('tiber_list_leagues',{account:'synthetic',season:'2026'});assert.equal(l.leagues[0].receptionPoints,0);assert.equal(l.account.userId,'123');const m:any=await call('tiber_list_league_rosters',input);assert.equal(m.rosters[0].rosterId,1);const r:any=await call('tiber_get_roster_context',{...input,rosterId:1});assert.deepEqual(r.roster.starters,['100','0']);assert.equal(r.roster.reserve,null);assert.equal(r.roster.directory[0].active,null);assert.equal(r.accountControlVerified,false);assert.equal(JSON.stringify(r).includes('owner_id'),false);});
test('strict and oversized inputs refuse before reads',async()=>{for(const raw of [{...input,week:5},{...input,week:'19'},{...input,week:'5',url:'evil'},{...input,week:'5',note:'x'.repeat(3000)}])assert.equal((await createLeagueTools(readers())('tiber_get_weekly_matchups',raw)).reason,'invalid_input');});
test('current scores pending, prior outcome provisional, zero override preserved',async()=>{const s=sources();let r=await buildManagerResult({...input,week:'5'},s);assert.equal(r.rosters[0].outcome,'pending');assert.equal(r.rosters[0].points,0);r=await buildManagerResult({...input,week:'4'},s);assert.equal(r.rosters[0].outcome,'win');assert.equal(r.finality,'not_verified');s.getManagerMatchups=async()=>[{roster_id:1,matchup_id:1,points:99,custom_points:0},{roster_id:2,matchup_id:1,points:-1,custom_points:null}];r=await buildManagerResult({...input,week:'4'},s);assert.equal(r.rosters[0].scoreBasis,'commissioner_override');assert.equal(r.rosters[0].points,0);const out:any=await createLeagueTools(readers())('tiber_get_weekly_matchups',{...input,week:'5'});assert.equal(out.status,'available');});
test('incomplete or conflicting roster/season/membership refuses',async()=>{for(const edit of [(s:any)=>s.getLeagueRosters=async()=>[rosters[0]],(s:any)=>s.getLeague=async()=>({...league,season:'2025'}),(s:any)=>s.getLeagueRosters=async()=>[rosters[0],rosters[0]],(s:any)=>s.getLeagueRosters=async()=>[{...rosters[0],league_id:'20'},rosters[1]],(s:any)=>s.getLeagueRosters=async()=>[{...rosters[0],players:null},rosters[1]]]){const s=sources();edit(s);await assert.rejects(getRosterContext({...input,rosterId:1},s));}await assert.rejects(getRosterContext({...input,rosterId:2},sources()));});
test('directory outage and wrong player identity remain null',async()=>{const s=sources();s.getDirectory=async()=>{throw Error('secret')};let r=await getRosterContext({...input,rosterId:1},s);assert.equal(r.roster.directory[0].name,null);assert.equal(r.observations.directoryReceivedAt,null);s.getDirectory=async()=>({fetchedAt:Date.now(),players:{'100':{player_id:'200',full_name:'Wrong'}}});r=await getRosterContext({...input,rosterId:1},s);assert.equal(r.roster.directory[0].name,null);});
test('unsupported shape and state/score gaps do not invent results',async()=>{const s=sources();s.getLeague=async()=>({...league,settings:{...league.settings,best_ball:1}});assert.equal((await buildManagerResult({...input,week:'5'},s)).status,'unavailable');s.getLeague=async()=>league;s.getManagerMatchups=async()=>[{roster_id:1,matchup_id:1,points:null,custom_points:null},{roster_id:2,matchup_id:1,points:-1,custom_points:null}];assert.equal((await buildManagerResult({...input,week:'5'},s)).rosters[0].points,null);s.getManagerNflState=async()=>{throw Error('outage')};assert.equal((await buildManagerResult({...input,week:'5'},s)).rosters[0].outcome,'unavailable');});
test('busy slot survives deadline until read settles, then recovers; oversize/errors sanitize',async()=>{const rs:any=readers();let finish!:(v:unknown)=>void;rs.leagues=()=>new Promise(r=>finish=r);const call=createLeagueTools(rs,10);const raw={account:'synthetic',season:'2026'};assert.equal((await call('tiber_list_leagues',raw)).reason,'deadline');assert.equal((await call('tiber_list_leagues',raw)).reason,'busy');finish({status:'available'});await new Promise(r=>setTimeout(r,0));rs.leagues=async()=>({payload:'x'.repeat(1000001)});assert.equal((await call('tiber_list_leagues',raw)).reason,'response_too_large');rs.leagues=async()=>{throw Error('secret')};assert.deepEqual(await call('tiber_list_leagues',raw),{status:'unavailable',reason:'source_unavailable'});});

test('foreign starter/reserve/taxi IDs refuse before directory read; only starter zero sentinel is allowed',async()=>{
 for(const field of ['starters','reserve','taxi']){const s=sources();let called=false;s.getDirectory=async()=>{called=true;throw Error('not reached')};s.getLeagueRosters=async()=>[{...rosters[0],[field]:['200']},rosters[1]];await assert.rejects(getRosterContext({...input,rosterId:1},s));assert.equal(called,false);}
 for(const field of ['players','reserve','taxi']){const s=sources();s.getLeagueRosters=async()=>[{...rosters[0],[field]:['0']},rosters[1]];await assert.rejects(getRosterContext({...input,rosterId:1},s));}
 const s=sources();assert.deepEqual((await getRosterContext({...input,rosterId:1},s)).roster.starters,['100','0']);
});

test('real roster, membership and matchup compilers retain busy slot after a sibling read fails',async()=>{
 for(const kind of ['roster','memberships','matchups'] as const){
 const s=sources();let finish!:(v:unknown)=>void;let outstanding=0;s.getLeague=async()=>{throw Error('early failure')};s.getLeagueRosters=()=>{outstanding++;return new Promise(resolve=>{finish=(v)=>{outstanding--;resolve(v)}})};
 const rs:any=readers();rs.roster=(i:any)=>getRosterContext(i,s);rs.memberships=(i:any)=>findTeamLeagueRosters(i.userId,i.leagueId,i.season,s);rs.matchups=(i:any)=>buildManagerResult(i,s);
 const call=createLeagueTools(rs);const name=kind==='roster'?'tiber_get_roster_context':kind==='memberships'?'tiber_list_league_rosters':'tiber_get_weekly_matchups';const args=kind==='roster'?{...input,rosterId:1}:kind==='matchups'?{...input,week:'5'}:input;
 const first=call(name,args);await new Promise(r=>setTimeout(r,0));assert.equal((await call(name,args)).reason,'busy');assert.equal(outstanding,1);finish(rosters);assert.equal((await first).reason,'source_unavailable');assert.equal(outstanding,0);
 }
});
