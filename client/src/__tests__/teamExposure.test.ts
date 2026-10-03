/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import TeamExposure from '@/components/draftReview/TeamExposure';
import type { TeamLeagues } from '@shared/teamLeagues';
const leagues = { account:{userId:'7'},season:'2026',leagues:[{leagueId:'10',name:'Alpha',mode:'dynasty'},{leagueId:'20',name:'Beta',mode:'redraft'}] } as TeamLeagues;
const result = {schemaVersion:'tiber_exposure_v1',userId:'7',leagueId:'10',season:'2026',rosters:[{rosterId:1,available:true,canonicalUrl:'https://sleeper.com/roster/10/1',players:[{sleeperId:'1',name:'Synthetic Receiver',position:'WR',team:'BAL',injuryStatus:'Questionable',directoryAvailable:true,location:'starter'}]}],observations:{rostersReceivedAt:'2026-09-15T10:00:00Z',directoryReceivedAt:'2026-09-15T10:00:00Z'}};
const original=global.fetch; const reply=(body:unknown,status=200)=>({ok:status===200,status,json:async()=>body} as Response);
afterEach(()=>{cleanup();global.fetch=original;});
test('explicit refresh, partial denominator, expansion and exact Team link',async()=>{
 global.fetch=jest.fn(async url=>String(url).includes('leagueId=10')?reply(result):reply({},502));const open=jest.fn();
 render(React.createElement(TeamExposure, {leagues, selected:['10','20'], onOpenTeam:open}));
 expect(global.fetch).not.toHaveBeenCalled(); expect(screen.getByText(/2 not loaded/)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Refresh players'}));await screen.findByText('Synthetic Receiver');
 expect(screen.getByText('1/1 leagues · 100.0%')).toBeTruthy();expect(screen.getByText('Sleeper: Questionable')).toBeTruthy();
 fireEvent.click(screen.getByText('Synthetic Receiver'));fireEvent.click(screen.getByRole('button',{name:'Open Team — Alpha'}));expect(open).toHaveBeenCalledWith('https://sleeper.com/roster/10/1');
 fireEvent.change(screen.getByLabelText('Find a player'),{target:{value:'missing'}});expect(screen.getByText('No players match your search.')).toBeTruthy();
});
test('refresh clears prior rows; unmount cancels delayed response',async()=>{
 global.fetch=jest.fn(async()=>reply(result));const props={leagues,selected:['10'],onOpenTeam:jest.fn()};const view=render(React.createElement(TeamExposure, props));
 fireEvent.click(screen.getByRole('button',{name:'Refresh players'}));await screen.findByText('Synthetic Receiver');
 let finish!:(value:Response)=>void;(global.fetch as jest.Mock).mockImplementation(()=>new Promise(resolve=>finish=resolve));
 fireEvent.click(screen.getByRole('button',{name:'Refresh players'}));expect(screen.queryByText('Synthetic Receiver')).toBeNull();
 const signal=(global.fetch as jest.Mock).mock.calls.at(-1)[1].signal;view.unmount();expect(signal.aborted).toBe(true);await act(async()=>finish(reply(result)));
});
