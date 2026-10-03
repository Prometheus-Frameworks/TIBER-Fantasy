import { useEffect, useRef, useState } from 'react';
import type { DraftReview } from '@/pages/TiberDraftReview';
import { matchupPacket, matchupSchema, type TeamMatchup } from '@shared/draftReviewMatchup';
function MatchupContent({ review }: { review: DraftReview }) {
  const [week, setWeek] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<TeamMatchup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settled, setSettled] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const sequence = useRef(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    ++sequence.current; setResult(null); setLoading(true); setError(''); setCopyStatus('');
    void (async () => {
      try {
        const response = await fetch(`/api/draft-review/matchup?sleeper_url=${encodeURIComponent(review.input.canonicalUrl)}&season=${review.observed.league.season}&week=${week}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Unavailable');
        const data = matchupSchema.parse(await response.json());
        if (data.input.leagueId !== review.input.leagueId || data.input.rosterId !== review.input.rosterId || data.input.canonicalUrl !== review.input.canonicalUrl || data.season !== review.observed.league.season || data.week !== week || data.observed.you.roster_id !== review.input.rosterId || data.observed.opponent.roster_id === review.input.rosterId) throw new Error('Scope mismatch');
        if (active) setResult(data);
      } catch { if (active) setError('A complete head-to-head matchup could not be loaded. Try another week or refresh.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); ++sequence.current; };
  }, [review, week, refresh]);
  function invalidate() { ++sequence.current; setResult(null); setCopyStatus(''); setLoading(true); }
  async function copy() {
    if (!result) return;
    const current = ++sequence.current;
    try { await navigator.clipboard.writeText(JSON.stringify(matchupPacket(result, settled), null, 2)); if (sequence.current === current) setCopyStatus('Matchup context copied — paste into Codex or Claude.'); }
    catch { if (sequence.current === current) setCopyStatus('Could not copy. Check clipboard access and retry.'); }
  }
  const money = (n: number | null) => n === null ? '—' : n.toFixed(2);
  return <div className="drp-matchup">
    <div className="drp-matchup-toolbar"><label>Week <select value={week} onChange={e => { invalidate(); setSettled(false); setWeek(Number(e.target.value)); }}>{Array.from({ length: 18 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label><button type="button" className="drp-action" onClick={() => { invalidate(); setRefresh(r => r + 1); }} disabled={loading}>Refresh matchup</button></div>
    <div aria-live="polite" aria-busy={loading}>{loading && <p>Reading this week’s matchup…</p>}{error && <p role="alert">{error}</p>}</div>
    {result && <>
      <div className="drp-matchup-scoreboard">{[result.observed.you, result.observed.opponent].map((side, i) => <div key={side.roster_id}><span className="drp-label observed">{i === 0 ? 'Your team' : 'Opponent'}</span><h3>{side.name}</h3><strong>{money(side.points)}</strong><small>Observed points{side.custom_points !== null ? ' · commissioner override' : ''}</small></div>)}</div>
      <p className="drp-matchup-gap">{result.derived.score_margin === 0 ? 'Currently tied.' : `Your team is ${result.derived.score_margin > 0 ? 'ahead' : 'behind'} by ${money(Math.abs(result.derived.score_margin))} points.`} This is the score gap, not a forecast.</p>
      <p className="drp-muted">Checked {new Date(result.provenance.received_at).toLocaleString()} · {result.season}, week {result.week}</p>
      <h4>Weekly starting lineups</h4><p className="drp-muted">Points shown are observations. Zero does not mean “yet to play”; — means unavailable.</p>
      <div className="drp-matchup-lineups">{result.observed.you.starters.map((player, i) => <div className="drp-matchup-row" key={i}>{[player, result.observed.opponent.starters[i]].map((p, side) => <div key={side}>{p ? <><span className="drp-matchup-slot">{p.slot} · {side === 0 ? 'You' : 'Opponent'}</span><b>{p.name}</b><small>{p.team ?? 'Team unknown'}{p.injury_status ? ` · Status: ${p.injury_status}` : ''}</small><strong>{money(p.points)}</strong></> : <span>Unavailable</span>}</div>)}</div>)}</div>
      <h4>Assistant coach context</h4>
      {result.derived.shared_offense.length ? result.derived.shared_offense.map((r, i) => <p key={i}><b>{r.your_player} ↔ {r.opponent_player}</b> share {r.team}’s passing offense in the current directory. A completed pass can score for both sides; the effect depends on the play and league scoring.</p>) : <p>No shared QB/receiver relationship established for this selected week.</p>}
      <label className="drp-matchup-settled"><input type="checkbox" checked={settled} onChange={e => { ++sequence.current; setSettled(e.target.checked); setCopyStatus(''); }} /> My lineup is settled; flag material new information.</label>
      <p>Copy a dated matchup packet for your assistant to explain the score, relationships and unanswered questions. This does not start monitoring or change your lineup.</p>
      <button type="button" className="drp-action" onClick={() => void copy()}>Discuss matchup</button><p role="status">{copyStatus}</p>
      <details><summary>Sources and what is unavailable</summary><p>Unavailable: {result.unavailable.join('; ')}.</p>{result.provenance.disclosures.map(d => <p key={d}>{d}</p>)}<p>Player directory fetched: {result.provenance.directory_fetched_at}</p><ul>{result.provenance.source_urls.map(url => <li key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul></details>
    </>}
  </div>;
}
export default function DraftReviewMatchup({ review, initiallyOpen = false }: { review: DraftReview; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return <section className="drp-panel"><div className="drp-panel-heading"><div><span className="drp-label observed">Weekly preview</span><h3>Matchup room</h3></div><button type="button" className="drp-action" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? 'Close matchup' : 'Open matchup'}</button></div><p>Both lineups, the score gap and context for your assistant coach.</p>{open && <MatchupContent review={review} />}</section>;
}
