import WrReplacement from './WrReplacement';
import { useEffect, useRef, useState } from 'react';
import type { DraftReview } from '@/pages/TiberDraftReview';
import { chapterPacket, chapterPressure } from '@shared/teamChapter';
import DraftReviewMatchup from './DraftReviewMatchup';
export default function TeamChapter({ review }: { review: DraftReview }) {
  const pressure = chapterPressure(review);
  const [copied, setCopied] = useState('');
  const [showWr, setShowWr] = useState(false);
  const target = review.observed.current_roster.find(p => p.player_id === pressure.card?.trigger.player_id);
  const sequence = useRef(0);
  useEffect(() => () => { ++sequence.current; }, [review]);
  async function copy() {
    const current = ++sequence.current;
    try { await navigator.clipboard.writeText(JSON.stringify(chapterPacket(review), null, 2)); if (current === sequence.current) setCopied('Pressure card and roster snapshot copied.'); }
    catch { if (current === sequence.current) setCopied('Could not copy. Check clipboard access and retry.'); }
  }
  const reserve = review.observed.league.reserve;
  return <>
    <section className="drp-panel drp-chapter-glance" aria-label="Current chapter">
      <div className="drp-kicker">Your current chapter</div>
      <p>{review.derived.starter_count} starters · {review.derived.bench_count} bench · {review.derived.reserve_count} reserve</p>
      <p className="drp-muted">Roster refreshed {new Date(review.generated_at).toLocaleString()}. Player directory details may be cached for 24 hours.</p>
      <p className="drp-muted">Changes since your last visit are not available yet.</p>
    </section>
    <section className={`drp-panel drp-pressure ${pressure.card ? 'drp-pressure-active' : ''}`} aria-label="Roster pressure">
      <span className={`drp-label ${pressure.status === 'unavailable' ? 'unavailable' : 'derived'}`}>Roster check</span>
      <h3>{pressure.status === 'unavailable' ? 'Pressure check unavailable' : pressure.card?.title ?? 'No active pressure identified'}</h3>
      <p>{pressure.card?.reason ?? (pressure.status === 'unavailable' ? 'The snapshot does not provide enough consistent roster geometry for this check.' : 'No unfilled starting slot or reported Out, Doubtful or Questionable starter was found in this snapshot.')}</p>
      {pressure.designation_coverage === 'partial' && <p className="drp-muted">Starter designation coverage is incomplete. No health or availability clearance is implied.</p>}
      {pressure.card && <>
        <p className="drp-muted">One card shown: unfilled slots first, then Out, Doubtful and Questionable starters. Other questions may still exist.</p>
        {pressure.card.trigger.designation && <p>League rule for {pressure.card.trigger.designation}: {pressure.card.league_rule_context.designation_rule === null ? 'not reported' : pressure.card.league_rule_context.designation_rule ? 'allowed by this configured reserve rule' : 'not allowed by this configured reserve rule'}. Current per-player eligibility remains unavailable.</p>}
        <details><summary>Options and what would change this question</summary><p>Unranked paths to consider:</p><ul>{pressure.card.options.map(o => <li key={o}>{o}</li>)}</ul><p>Recheck when:</p><ul>{pressure.card.watch_conditions.map(w => <li key={w}>{w}</li>)}</ul></details>
        <button type="button" className="drp-action" onClick={() => void copy()}>Discuss this pressure card</button><p role="status">{copied}</p>
      </>}
      {pressure.card && target?.position === 'WR' && <><button type="button" className="drp-action" aria-expanded={showWr} onClick={()=>setShowWr(v=>!v)}>{showWr?'Close WR alternatives':'Compare WR alternatives'}</button>{showWr && <WrReplacement review={review} targetId={target.player_id} />}</>}
      <details><summary>Reserve rules and evidence limits</summary>
        {reserve ? <><p>{reserve.open_slots} open · {reserve.occupied_slots} occupied · {reserve.configured_slots} configured reserve slots.</p><dl className="drp-reserve-rules">{Object.entries(reserve.configured_eligibility).map(([rule, value]) => <div key={rule}><dt>{rule.replace(/_/g, ' ')}</dt><dd>{value === null ? 'Unknown' : value ? 'Allowed' : 'Not allowed'}</dd></div>)}</dl></> : <p>Reserve configuration unavailable.</p>}
        <p>These checks use roster membership, configured slot counts and the separate Sleeper injury designation. Bench and reserve designations do not trigger this starter check. Game timing, locks and current reserve eligibility are unavailable.</p>
        <p>Watching, dismissal and receipts are not saved in this build. Copy the card to carry the question into your agent conversation.</p>
      </details>
    </section>
    <DraftReviewMatchup review={review} initiallyOpen />
  </>;
}
