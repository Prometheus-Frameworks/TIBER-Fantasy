import { useEffect, useMemo, useState } from 'react';
import { HISTORICAL_METRICS, type HistoricalEvidence, type HistoricalMetric } from '@shared/draftReviewEvidence';
import { deriveRosterScenario } from '@shared/draftReviewScenario';
import { reviewScope, type StudyAttachment } from '@shared/draftReviewStudy';
import type { DraftReview } from '@/pages/TiberDraftReview';

function displayMetric(metric: HistoricalMetric | undefined, share: boolean) {
  if (!metric || !metric.nonnull_weeks) return 'Unavailable';
  const format = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: share ? 1 : 2 }).format(share ? value * 100 : value) + (share ? '%' : '');
  if (share) return `${format(metric.mean!)} · ${metric.nonnull_weeks}/${metric.recorded_weeks} recorded weeks`;
  return `${metric.total === null ? 'Total unavailable' : `${format(metric.total)} total`} · ${format(metric.mean!)} mean over ${metric.nonnull_weeks}/${metric.recorded_weeks} recorded weeks`;
}

export default function DraftReviewEvidenceStudy({ review, onChange }: { review: DraftReview; onChange: (study: StudyAttachment) => void }) {
  const scope = reviewScope(review);
  const roster = review.observed.current_roster;
  const options = useMemo(() => Array.from(new Map([...roster, ...(review.observed.draft.full_board ?? [])].map(player => [player.player_id, player])).values()), [roster, review.observed.draft.full_board]);
  const [pair, setPair] = useState<string[]>(() => {
    const candidates = [...roster.filter(p => p.position === 'WR'), ...roster.filter(p => p.position !== 'WR')];
    return [candidates[0]?.player_id ?? '', candidates[1]?.player_id ?? ''];
  });
  const [result, setResult] = useState<{ key: string; evidence: HistoricalEvidence | null; status: 'available' | 'unavailable'; reason: string | null } | null>(null);
  const [preferred, setPreferred] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [outgoing, setOutgoing] = useState<string[]>([]);
  const [incomingId, setIncomingId] = useState('');
  const pairKey = JSON.stringify(pair);
  const selectionValid = pair.every(Boolean) && pair[0] !== pair[1];
  // Key checking hides stale evidence immediately, even before the next effect runs.
  const comparison = useMemo<StudyAttachment['comparison']>(() => !selectionValid
    ? { selected_player_ids: pair, evidence: null, status: 'unavailable', reason: 'Choose two different players.' }
    : result?.key === pairKey
      ? { selected_player_ids: pair, evidence: result.evidence, status: result.status, reason: result.reason }
      : { selected_player_ids: pair, evidence: null, status: 'loading', reason: null }, [pair, pairKey, result, selectionValid]);

  useEffect(() => {
    if (!selectionValid) return;
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/draft-review/evidence?player_ids=${encodeURIComponent(pair.join(','))}`, { signal: controller.signal });
        const evidence = await response.json() as HistoricalEvidence;
        if (!response.ok || evidence.schema_version !== 'tiber_draft_review_historical_v1' || !['available', 'unavailable'].includes(evidence.status)) throw new Error('Historical evidence could not be loaded.');
        if (active) setResult({ key: pairKey, evidence, status: evidence.status, reason: evidence.reason });
      } catch {
        if (active) setResult({ key: pairKey, evidence: null, status: 'unavailable', reason: 'Historical evidence could not be loaded.' });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [pairKey, selectionValid]);

  const scenario = useMemo(() => outgoing.length || incomingId
    ? deriveRosterScenario(roster, review.observed.league.lineup_slots, outgoing.filter(Boolean), options.find(p => p.player_id === incomingId) ?? null)
    : null, [outgoing, incomingId, options, roster, review.observed.league.lineup_slots]);
  useEffect(() => {
    onChange({ scope, comparison, operator_context: { kind: 'manager_judgment', preferred_player_id: preferred, note, applies_to_player_ids: pair }, hypothetical_roster: scenario });
  }, [scope, comparison, preferred, note, pair, scenario, onChange]);

  function choose(index: number, id: string) {
    setPair(previous => previous.map((value, i) => i === index ? id : value));
    setPreferred(null); setNote(''); setResult(null);
  }
  const attribution = comparison.evidence?.provenance?.attribution ?? review.historical_evidence?.provenance?.attribution;
  return <section className="drp-panel drp-evidence" aria-label="Historical evidence study">
    <div className="drp-panel-heading"><div><span className="drp-label">2025 historical evidence</span><h3>Compare the evidence behind your preference</h3></div></div>
    <p>2025 weeks 1–18 · recorded observations only. Current roles, injuries, forecasts and regression probabilities are unavailable.</p>
    <div className="drp-study-controls">{pair.map((id, index) => <label key={index}>Player {index + 1}
      <select aria-label={`Comparison player ${index + 1}`} value={id} onChange={e => choose(index, e.target.value)}>
        <option value="">Choose a player</option>{options.map(p => <option key={p.player_id} value={p.player_id}>{p.name} · {p.position ?? '?'} · current {p.team ?? '?'}</option>)}
      </select>
    </label>)}</div>
    <div aria-live="polite" aria-busy={comparison.status === 'loading'}>
      {comparison.status === 'loading' ? <p>Loading historical evidence…</p> : null}
      {comparison.status === 'unavailable' ? <p>{comparison.reason ?? 'Historical evidence unavailable.'}</p> : null}
    </div>
    {comparison.evidence?.status === 'available' ? <>
      <div className="drp-study-controls">{pair.map(id => {
        const player = comparison.evidence!.players.find(p => p.player_id === id);
        return <div key={id}><strong>{options.find(p => p.player_id === id)?.name}</strong>
          <p>{player?.status !== 'available' ? player?.reason ?? 'Historical evidence unavailable.' : `${player.observed?.weeks.length} recorded weeks · 2025 team: ${player.observed?.historical_teams.join(', ') || 'unknown'}`}</p>
          {player?.identity ? <small>Identity: {player.identity.confidence} confidence · {player.identity.match_method}</small> : null}
          {player?.observed?.usage_conflict_weeks.length ? <p>Usage context conflicts in weeks {player.observed.usage_conflict_weeks.join(', ')}; joined usage excluded.</p> : null}
          {player?.observed?.usage_missing_weeks.length ? <p>Usage missing in weeks {player.observed.usage_missing_weeks.join(', ')}.</p> : null}
        </div>;
      })}</div>
      <div className="drp-evidence-table" tabIndex={0} aria-label="Historical comparison, scroll horizontally on narrow screens"><table>
        <thead><tr><th>Derived from recorded weeks</th>{pair.map(id => <th key={id}>{options.find(p => p.player_id === id)?.name}</th>)}</tr></thead>
        <tbody>{HISTORICAL_METRICS.map(([key, label]) => <tr key={key}><th scope="row">{label}</th>{pair.map(id => <td key={id}>{displayMetric(comparison.evidence!.players.find(p => p.player_id === id)?.derived[key], key.endsWith('_share'))}</td>)}</tr>)}</tbody>
      </table></div>
      <p className="drp-boundary">Means show their nonnull-week denominators; average weekly share is not season share. Missing weeks are unknown, not zero or games missed. Air-yards totals, routes, snaps, red-zone usage and league fantasy points are unavailable.</p>
    </> : null}
    <p className="drp-boundary">Source acquisition and update times are unknown. TIBER filters and aggregates admitted nflverse observations; historical evidence does not establish a current-season edge.</p>
    {attribution ? <p className="drp-attribution"><a href={attribution.source_url} target="_blank" rel="noreferrer">{attribution.name}</a> · <a href={attribution.license_url} target="_blank" rel="noreferrer">{attribution.license}</a>. {attribution.notice}</p> : null}
    <div className="drp-study-controls">
      <label>My preference <select aria-label="My preference" value={preferred ?? ''} onChange={e => setPreferred(e.target.value || null)}><option value="">Undecided</option>{selectionValid ? pair.map(id => <option key={id} value={id}>{options.find(p => p.player_id === id)?.name}</option>) : null}</select></label>
      <label>My reasoning <textarea aria-label="My reasoning" maxLength={500} value={note} onChange={e => setNote(e.target.value.slice(0, 500))} placeholder="Optional manager judgment, separate from evidence" /></label>
    </div>
    <p className="drp-boundary">Your preference and note stay in this page’s memory and are included when you copy the agent packet. Changing the pair clears them; loading another review clears the study.</p>
    <h3>Hypothetical roster change</h3>
    <p>Explore one or two outgoing players for one incoming player. Draft-board names are candidates to examine; their current ownership is unknown.</p>
    <div className="drp-study-controls">{[0, 1].map(index => <label key={index}>Outgoing {index + 1}{index === 1 ? ' (optional)' : ''}<select aria-label={`Outgoing player ${index + 1}`} value={outgoing[index] ?? ''} onChange={e => setOutgoing(previous => { const next = [...previous]; next[index] = e.target.value; return next; })}><option value="">Choose a player</option>{roster.filter(p => p.roster_state === 'starter' || p.roster_state === 'bench').map(p => <option key={p.player_id} value={p.player_id}>{p.name} · {p.roster_state}</option>)}</select></label>)}</div>
    <label>Incoming candidate <select aria-label="Incoming candidate" value={incomingId} onChange={e => setIncomingId(e.target.value)}><option value="">Choose a player from the observed board</option>{options.filter(p => !roster.some(r => r.player_id === p.player_id)).map(p => <option key={p.player_id} value={p.player_id}>{p.name} · {p.position ?? '?'}</option>)}</select></label>
    {scenario?.status === 'invalid_input' ? <p>{scenario.reason}</p> : null}
    {scenario?.status === 'available' ? <div aria-live="polite">
      <p>Roster: {scenario.before.total_roster_count} → {scenario.after.total_roster_count}. Ordinary open slots: {scenario.before.ordinary_open_slots ?? 'unknown'} → {scenario.after.ordinary_open_slots ?? 'unknown'}.</p>
      <p>Ordinary positions: {Array.from(new Set([...Object.keys(scenario.before.ordinary_position_counts), ...Object.keys(scenario.after.ordinary_position_counts)])).map(pos => `${pos} ${scenario.before.ordinary_position_counts[pos] ?? 0} → ${scenario.after.ordinary_position_counts[pos] ?? 0}`).join(' · ')}.</p>
      <p>Position-only starter slots after change: {scenario.after.position_only_lineup.status === 'available' ? `${scenario.after.position_only_lineup.fillable_slots}/${scenario.after.position_only_lineup.required_slots} fillable` : 'unavailable'}.</p>
      {scenario.removed_observed_starter_ids.length ? <p>Removes observed starters: {scenario.removed_observed_starter_ids.map(id => roster.find(p => p.player_id === id)?.name).join(', ')}. Replacement production is not estimated.</p> : null}
    </div> : null}
    <p className="drp-boundary">Position-only feasibility ignores health, schedule and performance. No trade is executed; no point gain, trade value or manager acceptance is inferred.</p>
  </section>;
}
