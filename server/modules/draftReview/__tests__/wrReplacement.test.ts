import { sleeperClient } from '../../../integrations/sleeperClient';
import { __resetDraftReviewCacheForTests } from '../draftReviewService';
import { buildWrReplacement } from '../wrReplacement';
const url='https://sleeper.com/roster/123/1';
function sources() { return { league:{league_id:'123',season:'2026',total_rosters:2}, rosters:[{roster_id:1,players:['11','22','33'],starters:['11'],reserve:['33'],taxi:[]},{roster_id:2,players:[],starters:['44'],reserve:[],taxi:['55']}], players:Object.fromEntries(['11','22','33','44','55','66'].map(id=>[id,{player_id:id,full_name:`WR ${id}`,position:'WR',team:'SEA',active:true,injury_status:id==='11'?'Questionable':null}])) }; }
function serve(d:ReturnType<typeof sources>) { jest.spyOn(sleeperClient,'getLeague').mockResolvedValue(d.league as any);jest.spyOn(sleeperClient,'getLeagueRosters').mockResolvedValue(d.rosters as any);jest.spyOn(sleeperClient,'getNflPlayers').mockResolvedValue(d.players); }
afterEach(()=>{jest.restoreAllMocks();__resetDraftReviewCacheForTests();});
test('uses all ownership groups, separates bench from reserve, preserves designation and no forecast',async()=>{
 serve(sources());const p=await buildWrReplacement(url,'11');
 expect(p.bench.map(p=>p.player_id)).toEqual(['22']);expect(p.unrostered.map(p=>p.player_id)).toEqual(['66']);expect(p.target.injury_status).toBe('Questionable');expect(p.forecast.status).toBe('unavailable');expect(p.lineup_locks).toBe('unknown');expect(JSON.stringify(p)).not.toContain('owner_id');
});
test.each(['missing','duplicate','target','identity','conflict'])('rejects %s source inconsistency',async kind=>{
 const d=sources();if(kind==='missing')d.rosters.pop();if(kind==='duplicate')d.rosters[1].roster_id=1;if(kind==='target')d.rosters[0].starters=[];if(kind==='identity')d.players['66'].player_id='67';if(kind==='conflict')d.rosters[1].players=['22'];serve(d);await expect(buildWrReplacement(url,'11')).rejects.toThrow();
});
