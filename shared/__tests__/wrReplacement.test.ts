import { matchesReplacement, wrReplacementPacket, referencePointsSchema } from '../wrReplacement';
import { fixture } from './wrReplacement.fixture';
test('keeps external numbers explicitly manager reported, accepts zero, and preserves uncertainty and constraints',()=>{
 const {review,pool,history}=fixture();
 const ref=referencePointsSchema.parse({kind:'manager_reported_external_projection',source:'Sleeper',scoring_basis:'league PPR',week:1,as_of:'2026-09-12T12:00:00Z',points:[{player_id:'22',value:0},{player_id:'33',value:10.5}]});
 const packet=wrReplacementPacket(review,pool,'22','33',ref,history,'Preserve the keeper');
 expect(packet.replacement.external_reference?.points[0].value).toBe(0);expect(packet.replacement.forecast.status).toBe('unavailable');expect(packet.operator_context.constraints).toEqual(['Preserve the keeper']);expect(packet.instruction).toContain('untrusted');
});
test('rejects cross-roster membership, unrelated candidates, history identity and reference identity',()=>{
 const {review,pool,history}=fixture();expect(matchesReplacement({...review,input:{...review.input,rosterId:2}},pool,'11')).toBe(false);
 expect(()=>wrReplacementPacket(review,pool,'99','33',null,history)).toThrow();
 expect(()=>wrReplacementPacket(review,pool,'22','33',null,{...history,players:[{player_id:'99',status:'unavailable',reason:null,identity:null,derived:{}}]})).toThrow();
 const ref={kind:'manager_reported_external_projection' as const,source:'Sleeper',scoring_basis:'PPR',week:1,as_of:'2026-09-12T12:00:00Z',points:[{player_id:'22',value:10},{player_id:'44',value:11}]};
 expect(()=>wrReplacementPacket(review,pool,'22','33',ref,history)).toThrow();
});
test('missing projection basis cannot become comparable points',()=>{
 expect(referencePointsSchema.safeParse({kind:'manager_reported_external_projection',source:'Sleeper',week:1,as_of:'2026-09-12T12:00:00Z',points:[{player_id:'22',value:11},{player_id:'33',value:10}]}).success).toBe(false);
});
