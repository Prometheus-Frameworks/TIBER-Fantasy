import { useEffect, useRef, useState } from 'react';
import type { DraftReview } from '@/pages/TiberDraftReview';
import { reviewScope } from '@shared/draftReviewStudy';
import { selectWaiverCandidates, waiverCandidatesSchema, type WaiverAttachment, type WaiverCandidates } from '@shared/teamWaiverContext';

export default function DraftReviewWaivers({ review, onChange }: { review: DraftReview; onChange: (value: WaiverAttachment | null) => void }) {
  const [result, setResult] = useState<WaiverCandidates | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { ++sequence.current; controller.current?.abort(); }, []);
  async function check() {
    const request = ++sequence.current;
    controller.current?.abort(); controller.current = new AbortController();
    setResult(null); setSelected([]); onChange(null); setLoading(true); setError('');
    try {
      const response = await fetch(`/api/draft-review/waiver-candidates?sleeper_url=${encodeURIComponent(review.input.canonicalUrl)}`, { cache: 'no-store', signal: controller.current.signal });
      if (!response.ok) throw new Error('Unavailable');
      const next = waiverCandidatesSchema.parse(await response.json());
      if (next.input.canonicalUrl !== review.input.canonicalUrl || next.season !== review.observed.league.season) throw new Error('Scope mismatch');
      if (sequence.current === request) { setResult(next); onChange(selectWaiverCandidates(reviewScope(review), next, [])); }
    } catch {
      if (sequence.current === request) setError('Could not check candidate membership. Retry to include a shortlist.');
    } finally { if (sequence.current === request) setLoading(false); }
  }
  function toggle(id: string) {
    if (!result) return;
    const next = selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
    if (next.length > 5) return;
    setSelected(next); onChange(selectWaiverCandidates(reviewScope(review), result, next));
  }
  const settings = result?.waiver_settings ?? review.waiver_context;
  const system = settings?.derived.system;
  const pool = result?.candidates.filter(p => p.name.toLocaleLowerCase('en').includes(query.toLocaleLowerCase('en'))) ?? [];
  return <section className="drp-panel drp-te-content" aria-label="Waiver context">
    <h2>Waiver context</h2>
    <p>{system === 'faab' ? `FAAB · Remaining: ${settings?.derived.faab_remaining ?? 'Unknown'} · Configured budget: ${settings?.observed.waiver_budget ?? 'Unknown'}` : system === 'rolling' ? 'Rolling waivers' : system === 'reverse_standings' ? 'Reverse-standings waivers' : 'Waiver system unknown'} · Priority: {settings?.observed.waiver_position ?? 'Unknown'}</p>
    <p className="drp-muted">FAAB is calculated from Sleeper’s configured budget and reported usage; pending bids are not deducted.</p>
    <details>
      <summary>Add waiver candidates to agent context</summary>
      <p>Select up to five QB, RB, WR or TE candidates. Your selection travels with Copy agent context.</p>
      <button type="button" className="drp-action" onClick={() => void check()} disabled={loading}>{loading ? 'Checking league rosters…' : result ? 'Refresh candidate check' : 'Check unrostered players'}</button>
      {error ? <p role="alert">{error}</p> : null}
      {result ? <>
        <p>Unrostered when checked: <time dateTime={result.observations.rosters_received_at}>{new Date(result.observations.rosters_received_at).toLocaleString()}</time>.</p>
        <p className="drp-boundary">Claim eligibility, waiver locks and processing time are unknown. Confirm in Sleeper. This check and your displayed roster have separate timestamps.</p>
        <p className="drp-muted">Active directory entries with recognized NFL teams; this does not establish health or playing time. Directory fetched {result.observations.directory_fetched_at}, reused for up to 24 hours.</p>
        <p>{selected.length}/5 selected · Alphabetical order, not a ranking.</p>
        {selected.length ? <ul aria-label="Selected waiver candidates">{selected.map(id => <li key={id}><button type="button" onClick={() => toggle(id)}>Remove {result.candidates.find(p => p.player_id === id)?.name}</button></li>)}</ul> : null}
        <label className="drp-te-search">Search waiver candidates<input type="search" maxLength={120} value={query} onChange={e => setQuery(e.target.value)} /></label>
        <p>{pool.length} matches{pool.length > 50 ? ' · Showing first 50; search to narrow' : ''}</p>
        <ul className="drp-te-list" aria-label="Unrostered skill players">{pool.slice(0, 50).map(p => <li key={p.player_id}><button type="button" aria-pressed={selected.includes(p.player_id)} disabled={selected.length === 5 && !selected.includes(p.player_id)} onClick={() => toggle(p.player_id)}><strong>{p.name}</strong><span>{p.position} · {p.team} · {p.status ?? 'Status unknown'}</span></button></li>)}</ul>
      </> : null}
    </details>
  </section>;
}
