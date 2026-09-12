/** @jest-environment jsdom */
import React from 'react';
import { act,cleanup,fireEvent,render,screen } from '@testing-library/react';
import WrReplacement from '@/components/draftReview/WrReplacement';
import type { DraftReview } from '@/pages/TiberDraftReview';
import { fixture } from '@shared/__tests__/wrReplacement.fixture';
const originalFetch=global.fetch;
function setup() {const f=fixture();global.fetch=jest.fn(async input=>({ok:true,text:async()=>JSON.stringify(f.pool),json:async()=>f.history} as Response));render(React.createElement(WrReplacement,{review:f.review as unknown as DraftReview,targetId:'11'}));return f;}
beforeEach(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:jest.fn().mockResolvedValue(undefined)}}));
afterEach(()=>{cleanup();global.fetch=originalFetch;});
test('selects exact candidates, copies unknown history and optional constraints without creating forecasts',async()=>{
 setup();fireEvent.click(await screen.findByRole('button',{name:/Receiver 22/}));fireEvent.click(screen.getByRole('button',{name:/Receiver 33/}));await screen.findAllByText('No admitted history');fireEvent.change(screen.getByRole('textbox',{name:'My constraints (optional)'}),{target:{value:'Keep the stash'}});fireEvent.click(screen.getByRole('button',{name:'Discuss WR replacement'}));await screen.findByText('Replacement comparison copied.');const p=JSON.parse(jest.mocked(navigator.clipboard.writeText).mock.calls[0][0]);expect(p.replacement.unrostered_candidate.player_id).toBe('33');expect(p.replacement.forecast.status).toBe('unavailable');expect(p.operator_context.constraints).toEqual(['Keep the stash']);
});
test('requires complete reference attribution and clears points when pair changes',async()=>{
 setup();fireEvent.click(await screen.findByRole('button',{name:/Receiver 22/}));fireEvent.click(screen.getByRole('button',{name:/Receiver 33/}));await screen.findAllByText('No admitted history');screen.getByText('Add external reference points (optional)').closest('details')!.open=true;fireEvent.click(screen.getByRole('checkbox',{name:'Include points I read from another source'}));expect((screen.getByRole('button',{name:'Discuss WR replacement'}) as HTMLButtonElement).disabled).toBe(true);
 for(const [name,value] of [['Projection source','Sleeper'],['Scoring basis','PPR'],['Observed at (your local time)','2026-09-12T12:00'],['Receiver 22 reference points','11.14'],['Receiver 33 reference points','10.5']]) fireEvent.change(screen.getByLabelText(name),{target:{value}});
 expect(screen.getByText(/Reported point difference.*0.64/)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:/Receiver 44/}));expect(screen.queryByLabelText('Receiver 22 reference points')).toBeNull();await screen.findAllByText('No admitted history');
});
test('a failed refresh clears prior candidates and prevents exporting stale evidence',async()=>{
 setup();fireEvent.click(await screen.findByRole('button',{name:/Receiver 22/}));fireEvent.click(screen.getByRole('button',{name:/Receiver 33/}));await screen.findAllByText('No admitted history');global.fetch=jest.fn().mockResolvedValue({ok:false});fireEvent.click(screen.getByRole('button',{name:'Refresh WR pool'}));await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Discuss WR replacement'})).toBeNull();
});
