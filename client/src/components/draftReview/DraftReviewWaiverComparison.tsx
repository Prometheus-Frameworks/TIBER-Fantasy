import { useEffect, useRef, useState } from 'react';
import type { DraftReview } from '@/pages/TiberDraftReview';
import { HISTORICAL_METRICS, type HistoricalEvidence } from '@shared/draftReviewEvidence';
import type { WaiverCandidates } from '@shared/teamWaiverContext';
import { parseWaiverComparisonHistory, waiverComparisonPacket } from '@shared/teamWaiverComparison';
import { ComparisonTable } from './DraftReviewEvidenceStudy';

type Props = { review: DraftReview; result: WaiverCandidates; firstId: string; shortlist: string[]; onClose: () => void };
export default function DraftReviewWaiverComparison(props: Props) {
  const [secondId, setSecondId] = useState('');
  return <section className="drp-evidence drp-te-candidate" aria-label="Waiver player comparison">
    <h3>Compare waiver players</h3>
    <p>Comparing {props.result.candidates.find(p => p.player_id === props.firstId)?.name}. Search above and select another candidate to add them to the choices below.</p>
    <label className="drp-te-search">Second waiver player<select value={secondId} onChange={e => setSecondId(e.target.value)}>
      <option value="">Choose another selected candidate</option>
      {props.shortlist.filter(id => id !== props.firstId).map(id => <option key={id} value={id}>{props.result.candidates.find(p => p.player_id === id)?.name}</option>)}
    </select></label>
    {secondId && props.shortlist.includes(secondId) && secondId !== props.firstId ? <PairEvidence key={secondId} {...props} secondId={secondId} /> : <p>Select two different candidates to compare.</p>}
    <button type="button" className="drp-action" onClick={props.onClose}>Close waiver comparison</button>
  </section>;
}
function PairEvidence({ review, result, firstId, secondId }: Props & { secondId: string }) {
  const [history, setHistory] = useState<HistoricalEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const copySequence = useRef(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/draft-review/evidence?player_ids=${encodeURIComponent([firstId, secondId].join(','))}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Historical evidence unavailable');
        const evidence = parseWaiverComparisonHistory(await response.json(), [firstId, secondId]);
        if (active) setHistory(evidence);
      } catch { if (active) setHistory(null); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); ++copySequence.current; };
  }, [firstId, secondId]);
  const players = [firstId, secondId].map(id => {
    const candidate = result.candidates.find(p => p.player_id === id)!;
    return { id, name: candidate.name, position: candidate.position, candidate, history: history?.players.find(p => p.player_id === id) };
  });
  async function discuss() {
    if (loading) return;
    const request = ++copySequence.current;
    setCopied(false); setCopyError('');
    try {
      await navigator.clipboard.writeText(JSON.stringify(waiverComparisonPacket(review, result, [firstId, secondId], history), null, 2));
      if (copySequence.current === request) setCopied(true);
    } catch { if (copySequence.current === request) setCopyError('Could not copy. Check clipboard access and try again.'); }
  }
  return <>
    <div className="drp-comparison-coverage">{players.map(p => <div key={p.id}><strong>{p.name}</strong><p>{p.position} · {p.candidate.team} · {p.candidate.status ?? 'Status unknown'}</p><p>{loading ? 'Loading historical evidence…' : p.history?.status === 'available' ? `${p.history.observed?.weeks.length ?? 0} recorded weeks · 2025 teams: ${p.history.observed?.historical_teams.join(', ') || 'Unknown'}` : p.history?.reason ?? history?.reason ?? 'Historical evidence unavailable.'}</p></div>)}</div>
    <p>Unrostered when checked: {result.observations.rosters_received_at}. Claim eligibility, health and playing time are not established.</p>
    {!loading && history?.status === 'available' && players.some(p => p.history?.status === 'available') ? <>
      <p className="drp-scroll-hint">Swipe to compare; metric labels stay visible →</p>
      <ComparisonTable players={players} metrics={HISTORICAL_METRICS} compact />
      <details><summary>Totals and historical source details</summary><ComparisonTable players={players} metrics={HISTORICAL_METRICS} />
        {players.filter(p => p.history?.identity).map(p => <p key={p.id}>{p.name}: {p.history?.identity?.confidence} identity confidence · {p.history?.identity?.match_method}</p>)}
        {history.limitations.map((value, i) => <p key={i}>{value}</p>)}
      </details>
    </> : null}
    <p className="drp-boundary">2025 weeks 1–18 observations, not current-season projections. Means use recorded nonmissing weeks, not certified games played. Average weekly shares are not season shares. Missing evidence is unknown, not zero.</p>
    {history?.provenance ? <p className="drp-attribution">Source: <a href={history.provenance.attribution.source_url} target="_blank" rel="noreferrer">{history.provenance.attribution.name}</a> · <a href={history.provenance.attribution.license_url} target="_blank" rel="noreferrer">{history.provenance.attribution.license}</a>. {history.provenance.attribution.notice}</p> : null}
    <p>Forecast unavailable. Current-season usage is not included. This comparison does not choose a winner.</p>
    <button type="button" className="drp-action" disabled={loading} onClick={() => void discuss()}>Discuss this waiver comparison</button>
    <p>Copies this pair, available evidence and your roster context. Add your question in your agent conversation.</p>
    <p role="status">{copied ? 'Waiver comparison context copied' : ''}</p>
    {copyError ? <p role="alert">{copyError}</p> : null}
  </>;
}
