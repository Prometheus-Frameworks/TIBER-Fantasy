import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import type { DraftReview } from '@/pages/TiberDraftReview';
import type { HistoricalEvidence } from '@shared/draftReviewEvidence';
import { isCurrentTeamTe, draftReviewTeCandidatePacket, matchesTeScope, unrosteredTesSchema, type TeCandidateHistory, type UnrosteredTes } from '@shared/draftReviewWaivers';

const metricSchema = z.object({ total: z.number().finite().nullable(), mean: z.number().finite().nullable(), nonnull_weeks: z.number().int().nonnegative(), recorded_weeks: z.number().int().nonnegative() });
const historySchema = z.object({
  schema_version: z.literal('tiber_draft_review_historical_v1'), status: z.enum(['available', 'unavailable']), reason: z.string().nullable(),
  players: z.array(z.object({
    player_id: z.string(), status: z.enum(['available', 'unavailable']), reason: z.string().nullable(),
    identity: z.object({ confidence: z.string(), match_method: z.string(), tiber_player_id: z.string() }).nullable(),
    observed: z.object({ weeks: z.array(z.number()), historical_teams: z.array(z.string()) }).passthrough().nullable(),
    derived: z.record(metricSchema),
  }).passthrough()),
  provenance: z.object({ attribution: z.object({ name: z.string(), source_url: z.string().url(), license: z.string(), license_url: z.string().url(), notice: z.string() }) }).passthrough().nullable(),
}).passthrough();
const metrics = [['targets', 'Targets'], ['receptions', 'Receptions'], ['receiving_yards', 'Receiving yards'], ['receiving_tds', 'Receiving TDs'], ['target_share', 'Average weekly target share']] as const;

function TeExplorerContent({ review }: { review: DraftReview }) {
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<UnrosteredTes | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [includeArchive, setIncludeArchive] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [history, setHistory] = useState<TeCandidateHistory | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const copySequence = useRef(0);
  useEffect(() => () => { ++copySequence.current; }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/draft-review/unrostered-tes?sleeper_url=${encodeURIComponent(review.input.canonicalUrl)}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Availability unavailable');
        const payload = unrosteredTesSchema.parse(await response.json());
        if (!matchesTeScope(review, payload)) throw new Error('Availability scope mismatch');
        if (active) setResult(payload);
      } catch {
        if (active) { setResult(null); setError('TE availability could not be established. Retry the check, or refresh your roster if the league changed.'); }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [refresh, review]);

  const candidate = result?.candidates.find(p => p.player_id === selectedId);
  useEffect(() => {
    if (!candidate) return;
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/draft-review/evidence?player_ids=${encodeURIComponent(candidate.player_id)}`, { signal: controller.signal, cache: 'no-store' });
        const raw = await response.json();
        if (!response.ok || !historySchema.safeParse(raw).success) throw new Error('Invalid historical response');
        const evidence = raw as HistoricalEvidence;
        if (evidence.players.some(p => p.player_id !== candidate.player_id)
            || (evidence.status === 'available' && evidence.players.length !== 1)) throw new Error('Mismatched historical response');
        const player = evidence.players[0];
        const available = evidence.status === 'available' && player?.status === 'available';
        if (active) setHistory({ player_id: candidate.player_id, status: available ? 'available' : 'unavailable', reason: available ? null : player?.reason ?? evidence.reason ?? 'Historical evidence unavailable.', evidence });
      } catch {
        if (active) setHistory({ player_id: candidate.player_id, status: 'unavailable', reason: 'Historical evidence could not be loaded.', evidence: null });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [candidate]);

  function clearDiscussion() { ++copySequence.current; setCopied(false); setCopyError(''); setHistory(null); }
  function refreshCandidates() {
    clearDiscussion(); setResult(null); setSelectedId(''); setError(''); setLoading(true); setRefresh(v => v + 1);
  }
  async function discuss() {
    if (!result || !candidate || !history || history.player_id !== selectedId) return;
    const copyId = ++copySequence.current;
    try {
      const packet = draftReviewTeCandidatePacket(review, result, selectedId, history);
      await navigator.clipboard.writeText(JSON.stringify(packet, null, 2));
      if (copyId === copySequence.current) { setCopied(true); setCopyError(''); }
    } catch { if (copyId === copySequence.current) { setCopied(false); setCopyError('Could not copy. Check clipboard access and try again.'); } }
  }
  const playerHistory = history?.evidence?.players.find(p => p.player_id === selectedId);
  const attribution = history?.evidence?.provenance?.attribution;
  const pool = result?.candidates.filter(p => includeArchive || isCurrentTeamTe(p)) ?? [];
  const counts = result?.trends?.status === 'available' ? result.trends.counts : {};
  const filtered = pool.filter(p => p.name.toLocaleLowerCase('en').includes(query.toLocaleLowerCase('en'))).sort((a, b) => (counts[b.player_id] ?? -1) - (counts[a.player_id] ?? -1) || a.name.localeCompare(b.name, 'en') || a.player_id.localeCompare(b.player_id));
  return <div className="drp-te-content">
    <p>Explore tight ends outside your league’s rosters. Select one to discuss alongside your team.</p>
    <p className="drp-boundary">Unrostered when checked does not mean claimable now. Waiver locks, claim timing and player eligibility are unknown. Confirm in Sleeper before acting.</p>
    <button type="button" className="drp-action" onClick={refreshCandidates} disabled={loading}>{error ? 'Retry TE check' : 'Refresh TE check'}</button>
    <div aria-live="polite" aria-busy={loading}>
      {loading ? <p>Checking all league rosters…</p> : null}
      {error ? <p role="alert" className="drp-error">{error}</p> : null}
    </div>
    {result ? <>
      <p className="drp-muted">Unrostered when checked: <time dateTime={result.observations.rosters_received_at}>{new Date(result.observations.rosters_received_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time> · {result.observations.received_rosters}/{result.observations.expected_rosters} rosters received.</p>
      <details><summary>Player directory coverage and freshness</summary>
        <p>Default: Sleeper primary-position TEs with active=true and a recognized NFL team. This is a directory filter, not injury clearance or confirmation of a playing role. Broader directory entries remain available below.</p>
        <p>League rosters received: {result.observations.rosters_received_at}.</p>
        <p>Directory fetched: {result.observations.directory_fetched_at}. May be reused for up to 24 hours; Sleeper’s source update time is unknown. Refreshing this check does not force a directory refresh.</p>
        <p>League settings received: {result.observations.league_received_at}. Your displayed roster snapshot: {review.generated_at}. These reads are not an atomic snapshot.</p>
      </details>
      <p className="drp-muted">{result.trends?.status === 'available' ? 'Sleeper adds · past 24 hours · most added first, then alphabetical' : 'Sleeper add activity unavailable · alphabetical order'}</p>
      <details><summary>About add activity</summary><p>Platform-wide Sleeper adds, not adds in this league or a player recommendation. Up to 1,000 players across all positions; absent players have unknown counts. No projections are imported.</p><p>Received: {result.trends?.received_at ?? 'Unavailable'}. May be reused for five minutes. This clock is separate from roster and directory observations.</p></details>
      <label className="drp-te-filter"><input type="checkbox" checked={includeArchive} onChange={e => { setIncludeArchive(e.target.checked); clearDiscussion(); setSelectedId(''); }} /> Include inactive and team-unknown directory entries</label>
      <label className="drp-te-search">Search TEs by name<input value={query} maxLength={120} onChange={e => setQuery(e.target.value)} type="search" /></label>
      <p>{result.candidates.length === 0 ? 'No unrostered TEs found in this directory snapshot.' : `${filtered.length} of ${pool.length} ${includeArchive ? 'directory candidates' : 'current-team candidates'}`}</p>
      {result.candidates.length > 0 && filtered.length === 0 ? <p>No candidates match these filters.</p> : null}
      <ul className="drp-te-list" aria-label="Unrostered TE candidates">{filtered.map(p => <li key={p.player_id}>
        <button type="button" aria-pressed={p.player_id === selectedId} onClick={() => { if (p.player_id === selectedId) return; clearDiscussion(); setSelectedId(p.player_id); }}>
          <strong>{p.name}</strong><span>{p.team ?? 'NFL team unknown'} · {p.status ?? 'Status unknown'}</span><span className="drp-te-trend">{counts[p.player_id] !== undefined ? `${counts[p.player_id].toLocaleString()} Sleeper adds · 24h` : 'Add activity unknown'}</span>
        </button>
      </li>)}</ul>
    </> : null}
    {candidate ? <section className="drp-te-candidate" aria-label="Selected TE candidate">
      <h3>{candidate.name}</h3><p>{candidate.team ?? 'NFL team unknown'} · TE · Unrostered when checked</p>
      <h4>2025 historical evidence</h4>
      {!history ? <p role="status">Loading candidate evidence…</p> : history.status === 'unavailable' ? <p>{history.reason}</p> : <>
        <p>{playerHistory?.observed?.weeks.length ?? 0} recorded weeks · historical teams: {playerHistory?.observed?.historical_teams.join(', ') || 'Unknown'}</p>
        <dl className="drp-te-metrics">{metrics.map(([key, label]) => {
          const metric = playerHistory?.derived[key];
          const available = metric && metric.nonnull_weeks > 0 && metric.mean !== null;
          return <div key={key}><dt>{label}</dt><dd>{available
            ? <>{new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(metric.mean! * (key.endsWith('_share') ? 100 : 1))}{key.endsWith('_share') ? '%' : ''}<small>{metric.nonnull_weeks}/{metric.recorded_weeks} recorded weeks</small></>
            : 'Not recorded'}</dd></div>;
        })}</dl>
        <p className="drp-muted">Means over recorded weeks, not certified games played or current projections. Target share is an average of weekly shares.</p>
        <p>Identity: {playerHistory?.identity?.confidence ?? 'Unknown'} confidence · {playerHistory?.identity?.match_method ?? 'Unknown method'}</p>
      </>}
      {attribution ? <p className="drp-muted">Source: {attribution.name} · {attribution.license}. {attribution.notice}</p> : null}
      <p className="drp-muted">Current Forecast evidence is unavailable. Full historical provenance travels in the copied packet.</p>
      <button type="button" className="drp-action" disabled={!history || history.player_id !== selectedId} onClick={() => void discuss()}>Discuss this TE</button>
      <p className="drp-muted">Copies this candidate’s evidence and your displayed roster snapshot. Add your preferences and decision question in the receiving conversation.</p>
      <p role="status">{copied ? 'TE candidate context copied' : ''}</p>
      {copyError ? <p role="alert" className="drp-error">{copyError}</p> : null}
    </section> : null}
  </div>;
}

export default function DraftReviewTeExplorer({ review }: { review: DraftReview }) {
  const [open, setOpen] = useState(false);
  return <details className="drp-panel drp-te-explorer" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Explore unrostered TEs</summary>
    {open ? <TeExplorerContent review={review} /> : null}
  </details>;
}
