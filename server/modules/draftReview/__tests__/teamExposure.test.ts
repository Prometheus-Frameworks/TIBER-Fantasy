import { buildExposure, createExposureDirectory } from '../teamExposure';
import { summarizeExposure } from '@shared/teamExposure';
const input = { userId: '7', leagueId: '10', season: '2026' };
const source = () => ({ getLeague: jest.fn().mockResolvedValue({ league_id: '10', season: '2026', sport: 'nfl', total_rosters: 2 }),
  getLeagueRosters: jest.fn().mockResolvedValue([{ roster_id: 1, owner_id: '7', players: ['1','2','3'], starters: ['1','0'], reserve: ['3'], taxi: ['4'] }, { roster_id: 2, owner_id: '8' }]) });
const directory = async () => ({ receivedAt: '2026-09-15T10:00:00Z', players: { '1': { player_id: '1', full_name: 'Synthetic Player', position: 'WR', team: 'BAL', injury_status: 'Questionable' } } });
test('empty starter placeholders preserve placement and the distinct-league denominator', async () => {
  const s = source();
  s.getLeagueRosters.mockResolvedValue([{ roster_id: 1, owner_id: '7', players: ['1','2','3'], starters: ['','1','0','','0'], reserve: ['3'], taxi: ['4'] }, { roster_id: 2, owner_id: '8' }]);
  const populated = await buildExposure(input, s, directory);
  expect(populated.rosters[0].available).toBe(true);
  expect(populated.rosters[0].players.map(p => [p.sleeperId, p.location])).toEqual([['1','starter'],['2','bench'],['3','reserve'],['4','taxi']]);
  s.getLeague.mockResolvedValue({ league_id: '20', season: '2026', sport: 'nfl', total_rosters: 2 });
  s.getLeagueRosters.mockResolvedValue([{ roster_id: 1, owner_id: '7', players: [], starters: ['','0',''] }, { roster_id: 2, owner_id: '8' }]);
  const empty = await buildExposure({ ...input, leagueId: '20' }, s, directory);
  expect(empty.rosters[0]).toMatchObject({ available: true, players: [] });
  const summary = summarizeExposure(['10','10','20','30'], { '10': populated, '20': empty }, {});
  expect(summary.loaded).toBe(2);
  expect(summary.rows).toHaveLength(4);
  expect(summary.rows.every(row => row.percent === 50 && row.holdings.length === 1)).toBe(true);
});
test.each([
  { players: [''] }, { players: ['1'], reserve: [''] }, { players: ['1'], taxi: [''] },
  { players: ['0'] }, { players: ['1'], reserve: ['0'] }, { players: ['1'], taxi: ['0'] },
  { players: ['1'], starters: [' '] }, { players: ['1'], starters: [null] },
  { players: ['1'], starters: ['','1','1'] }, { players: ['1'], starters: ['','9'] },
  { players: ['1'], starters: Array(257).fill('') },
])('starter placeholder exception does not admit malformed contents %#', async invalid => {
  const s = source();
  s.getLeagueRosters.mockResolvedValue([{ roster_id: 1, owner_id: '7', ...invalid }, { roster_id: 2, owner_id: '8' }]);
  const result = await buildExposure(input, s, directory);
  expect(result.rosters[0]).toMatchObject({ available: false, players: [] });
  expect(summarizeExposure(['10'], { '10': result }, {}).loaded).toBe(0);
});
test('source IDs, owner membership, union of reserve/taxi and current placement', async () => {
  const result = await buildExposure(input, source(), directory);
  expect(result.rosters[0].players.map(p => [p.sleeperId, p.location])).toEqual([['1','starter'],['2','bench'],['3','reserve'],['4','taxi']]);
  expect(result.rosters[0].players[0]).toMatchObject({ name: 'Synthetic Player', injuryStatus: 'Questionable', directoryAvailable: true });
  expect(result.rosters[0].players[1]).toMatchObject({ name: null, injuryStatus: null, directoryAvailable: false });
});
test('directory outage preserves exposure but does not invent healthy status', async () => {
  const result = await buildExposure(input, source(), async () => { throw new Error('offline'); });
  expect(result.rosters[0].available).toBe(true); expect(result.rosters[0].players[0].directoryAvailable).toBe(false);
  expect(result.observations.directoryReceivedAt).toBeNull();
});
test.each([{ players: null }, { players: ['1','1'] }, { players: ['1'], starters: ['9'] }, { players: ['1'], reserve: ['1'], taxi: ['1'] }])('malformed own contents excluded %#', async invalid => {
  const s = source(); s.getLeagueRosters.mockResolvedValue([{ roster_id: 1, owner_id: '7', ...invalid }, { roster_id: 2, owner_id: '8' }]);
  expect((await buildExposure(input,s,directory)).rosters[0].available).toBe(false);
});
test('wrong season and incomplete league roster coverage fail', async () => {
  const s=source(); s.getLeague.mockResolvedValue({ league_id:'10',season:'2025',sport:'nfl',total_rosters:2 });
  await expect(buildExposure(input,s,directory)).rejects.toThrow();
  s.getLeague.mockResolvedValue({ league_id:'10',season:'2026',sport:'nfl',total_rosters:3 });
  await expect(buildExposure(input,s,directory)).rejects.toThrow();
});
test('multiple memberships require choice; denominator excludes failures and includes valid empty roster', async () => {
  const a = await buildExposure(input, source(), directory);
  const b = { ...a, leagueId:'20',rosters:[{ ...a.rosters[0], players:[] }] };
  const multi = { ...a,leagueId:'30',rosters:[a.rosters[0],{ ...a.rosters[0],rosterId:2 }] };
  const data = {'10':a,'20':b,'30':multi};
  const summary=summarizeExposure(['10','10','20','30','40'],data,{});
  expect(summary.loaded).toBe(2); expect(summary.rows[0].percent).toBe(50);
  expect(summarizeExposure(['10','20','30','40'],data,{'30':2}).loaded).toBe(3);
});
test('directory cache coalesces concurrent reads and never falls back to expired data', async () => {
  let time=0; const read=jest.fn().mockResolvedValue({'1':{}}); const get=createExposureDirectory(read,()=>time);
  await Promise.all([get(),get()]);expect(read).toHaveBeenCalledTimes(1);
  time=299999;await get();expect(read).toHaveBeenCalledTimes(1);
  time=300001;read.mockRejectedValue(new Error('offline'));await expect(get()).rejects.toThrow('offline');
});
test('co-owner allowed; mismatched directory identity withheld', async () => {
  const s=source(); s.getLeagueRosters.mockResolvedValue([{roster_id:1,owner_id:'8',co_owners:['7'],players:['1'],starters:[]},{roster_id:2,owner_id:'9'}]);
  const result=await buildExposure(input,s,async()=>({receivedAt:'2026-09-15T10:00:00Z',players:{'1':{player_id:'2',full_name:'Wrong'}}}));
  expect(result.rosters).toHaveLength(1); expect(result.rosters[0].players[0].name).toBeNull();
});
test('HTTP validates scope before fetching and sanitizes source failure with no-store', async () => {
  const express = (await import('express')).default; const request = (await import('supertest')).default;
  const {createDraftReviewRouter} = await import('../../../routes/draftReviewRoutes');
  const original=global.fetch;global.fetch=jest.fn().mockRejectedValue(new Error('private-upstream-detail'));
  try {
    const app=express();app.use(createDraftReviewRouter());
    const invalid=await request(app).get('/api/draft-review/manager-players').query({...input,extra:'bad'});
    expect(invalid.status).toBe(400);expect(global.fetch).not.toHaveBeenCalled();
    const failed=await request(app).get('/api/draft-review/manager-players').query(input);
    expect(failed.status).toBe(502);expect(failed.headers['cache-control']).toBe('no-store');expect(JSON.stringify(failed.body)).not.toContain('private-upstream-detail');
  } finally {global.fetch=original;}
});
