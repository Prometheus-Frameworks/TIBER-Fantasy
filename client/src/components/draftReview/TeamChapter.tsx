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
    <section className={`drp-panel drp-pressure ${pressure.card ? 'drp-pressure-active' : ''}`} aria-label="Roster pressure">
      <span className={`drp-label ${pressure.status === 'unavailable' ? 'unavailable' : 'derived'}`}>Roster check</span>
      <h3>{pressure.status === 'unavailable' ? 'Pressure check unavailable' : pressure.card?.title ?? 'No pressure detected in available observations'}</h3>
      <p>{pressure.card?.reason ?? (pressure.status === 'unavailable' ? 'The snapshot does not provide enough consistent roster geometry for this check.' : 'No supported trigger was found. Missing flags do not establish health, game availability or adequate future depth.')}</p>
      {pressure.designation_coverage === 'partial' && <p className="drp-muted">Roster designation coverage is incomplete. No health or availability clearance is implied.</p>}
      {pressure.card && <>
        <details><summary>Why this card and its limits</summary>
        <p>One card shown: unfilled starting slots, starter designations, limited RB cover, then other rostered designations. This order is a display rule, not a player ranking.</p>
        {pressure.card.trigger.roster_coverage && <><p>RB cover: {pressure.card.trigger.roster_coverage.starter_count} in the starting group · {pressure.card.trigger.roster_coverage.bench_count} on the bench · {pressure.card.trigger.roster_coverage.flagged_count} recorded flags · {pressure.card.trigger.roster_coverage.required_slots} required RB slots.</p><p>At most one RB beyond the required RB-slot count has no recorded flag. No recorded flag does not mean available. Reserve and taxi are excluded; flex slots do not increase the mandatory RB count.</p><ul>{pressure.card.trigger.roster_coverage.players.map(p => <li key={p.player_id}>{p.name} · {p.team ?? "Team unknown"} · RB · {p.roster_state} · status {p.status ?? "unknown"} · designation {p.injury_status ?? "not reported"}</li>)}</ul></>}
        {pressure.card.trigger.designation && <p>League rule for {pressure.card.trigger.designation}: {pressure.card.league_rule_context.designation_rule === null ? 'not reported' : pressure.card.league_rule_context.designation_rule ? 'allowed by this configured reserve rule' : 'not allowed by this configured reserve rule'}. Current per-player eligibility remains unavailable.</p>}
        <p>{pressure.card.league_rule_context.reserve_state === "not_configured" ? "No reserve slots configured." : pressure.card.league_rule_context.reserve_state === "full" ? "Reserve is full. This does not establish player eligibility." : pressure.card.league_rule_context.reserve_state === "open" ? `${reserve?.open_slots} reserve slots open; per-player eligibility unavailable.` : "Reserve capacity unavailable."}</p>
        </details>
        <details><summary>Options and what would change this question</summary><p>Unranked paths to consider:</p><ul>{pressure.card.options.map(o => <li key={o}>{o}</li>)}</ul><p>Recheck when:</p><ul>{pressure.card.watch_conditions.map(w => <li key={w}>{w}</li>)}</ul></details>
        <button type="button" className="drp-action" onClick={() => void copy()}>Discuss this pressure card</button><p role="status">{copied}</p>
      </>}
      {pressure.card?.kind === 'starter_designation' && target?.position === 'WR' && <><button type="button" className="drp-action" aria-expanded={showWr} onClick={()=>setShowWr(v=>!v)}>{showWr?'Close WR alternatives':'Compare WR alternatives'}</button>{showWr && <WrReplacement review={review} targetId={target.player_id} />}</>}
      {pressure.rb_coverage?.status === "unavailable" && <p className="drp-muted">RB coverage arithmetic is unavailable because roster positions are incomplete.</p>}
      <details><summary>Reserve rules and evidence limits</summary>
        <p>{review.derived.starter_count} starters · {review.derived.bench_count} bench · {review.derived.reserve_count} reserve</p>
        <p>Roster refreshed {new Date(review.generated_at).toLocaleString()}. Player directory details may be cached for 24 hours.</p>
        <p>Changes since your last visit are not available yet.</p>
        {reserve ? <><p>{reserve.open_slots} open · {reserve.occupied_slots} occupied · {reserve.configured_slots} configured reserve slots.</p><dl className="drp-reserve-rules">{Object.entries(reserve.configured_eligibility).map(([rule, value]) => <div key={rule}><dt>{rule.replace(/_/g, ' ')}</dt><dd>{value === null ? 'Unknown' : value ? 'Allowed' : 'Not allowed'}</dd></div>)}</dl></> : <p>Reserve configuration unavailable.</p>}
        <p>These checks use roster membership, required RB slots, directory status and the separate injury designation. Inactive is a directory flag, not an injury diagnosis; the active boolean does not clear it. Game timing, locks, acquisition rules and current reserve eligibility are unavailable.</p>
        <p>Watching, dismissal and receipts are not saved in this build. Copy the card to carry the question into your agent conversation.</p>
      </details>
    </section>
    <DraftReviewMatchup review={review} initiallyOpen />
  </>;
}
