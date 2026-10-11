import { useEffect, useMemo, useState } from 'react';
import { HISTORICAL_METRICS, type HistoricalEvidence, type HistoricalMetric, type HistoricalPlayer } from '@shared/draftReviewEvidence';
import { deriveRosterScenario } from '@shared/draftReviewScenario';
import { reviewScope, type StudyAttachment } from '@shared/draftReviewStudy';
import type { DraftReview } from '@/pages/TiberDraftReview';

function displayMetric(metric: HistoricalMetric | undefined, share: boolean) {
  if (!metric || !metric.nonnull_weeks) return 'Unavailable';
  const format = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: share ? 1 : 2 }).format(share ? value * 100 : value) + (share ? '%' : '');
  if (share) return `${format(metric.mean!)} · ${metric.nonnull_weeks}/${metric.recorded_weeks} recorded weeks`;
  return `${metric.total === null ? 'Total unavailable' : `${format(metric.total)} total`} · ${format(metric.mean!)} mean over ${metric.nonnull_weeks}/${metric.recorded_weeks} recorded weeks`;
}

type MetricRow = (typeof HISTORICAL_METRICS)[number];
const RECEIVING = ['targets', 'receptions', 'receiving_yards', 'receiving_tds', 'target_share'];
const POSITION_METRICS: Record<string, readonly string[]> = {
  WR: RECEIVING, TE: RECEIVING,
  RB: ['rushing_attempts', 'rushing_yards', 'rushing_tds', 'targets', 'receptions', 'receiving_yards', 'receiving_tds'],
  QB: ['passing_yards', 'passing_tds', 'interceptions', 'rushing_attempts', 'rushing_yards', 'rushing_tds'],
  K: [], DEF: [],
};
type ComparisonPlayer = { id: string; name: string; position: string | null; history?: HistoricalPlayer };
function hasHistory(player: ComparisonPlayer) {
  return player.position !== 'K' && player.position !== 'DEF' && player.history?.status === 'available';
}
function coverageReason(player: ComparisonPlayer) {
  if (player.position === 'K' || player.position === 'DEF') return 'Kicking and team-defense statistics are not included in this comparison.';
  if (player.history?.reason === 'No admitted exact Sleeper-to-GSIS identity mapping.') return '2025 stats are not connected: historical identity link unavailable.';
  return player.history?.reason ?? 'Historical evidence unavailable.';
}
export function ComparisonTable({ metrics, players, compact = false }: { metrics: readonly MetricRow[]; players: ComparisonPlayer[]; compact?: boolean }) {
  return <div className="drp-evidence-table" role="region" tabIndex={0} aria-label={compact ? 'Player comparison, scroll horizontally on narrow screens' : 'Detailed historical comparison, scroll horizontally on narrow screens'}>
    <table className={[compact ? 'drp-compact-comparison' : '', players.length === 3 ? 'drp-three-comparison' : ''].filter(Boolean).join(' ')}>
      <caption>{compact ? '2025 · per recorded week' : '2025 · totals and all recorded metrics'}</caption>
      <thead><tr><th scope="col">Metric</th>{players.map(player => <th scope="col" key={player.id}>{player.name}</th>)}</tr></thead>
      <tbody>{metrics.map(([key, label], index) => <tr key={key}>
        <th scope="row">{label}</th>
        {players.map(player => {
          // One coverage message above replaces a whole column of repeated errors.
          if (!hasHistory(player)) return index === 0 ? <td key={player.id} rowSpan={metrics.length} className="drp-no-history"><span aria-label={`${player.name}: see coverage above`}>—</span></td> : null;
          const metric = player.history?.derived[key];
          const share = key.endsWith('_share');
          return <td key={player.id}>{compact
            ? metric && metric.nonnull_weeks > 0 && metric.mean !== null
              ? <><strong className="drp-metric-value">{new Intl.NumberFormat('en-US', { maximumFractionDigits: share ? 1 : 2 }).format(metric.mean * (share ? 100 : 1))}{share ? '%' : ''}</strong><small>{metric.nonnull_weeks}/{metric.recorded_weeks} recorded weeks</small></>
              : <span>Not recorded</span>
            : displayMetric(metric, share)}</td>;
        })}
      </tr>)}</tbody>
    </table>
  </div>;
}

export default function DraftReviewEvidenceStudy({ review, onChange, onDiscuss, discussionStatus, discussionError }: {
  review: DraftReview; onChange: (study: StudyAttachment) => void; onDiscuss?: () => void; discussionStatus?: string; discussionError?: string;
}) {
  const scope = reviewScope(review);
  const roster = review.observed.current_roster;
  // Current roster descriptions take precedence over older draft-board descriptions.
  const options = useMemo(() => Array.from(new Map([...(review.observed.draft.full_board ?? []), ...roster].map(player => [player.player_id, player])).values()), [roster, review.observed.draft.full_board]);
  const [selection, setSelection] = useState<string[]>(() => {
    const candidates = [...roster.filter(p => p.position === 'WR'), ...roster.filter(p => p.position !== 'WR')];
    return [candidates[0]?.player_id ?? '', candidates[1]?.player_id ?? ''];
  });
  const [result, setResult] = useState<{ key: string; evidence: HistoricalEvidence | null; status: 'available' | 'unavailable'; reason: string | null } | null>(null);
  const [outgoing, setOutgoing] = useState<string[]>([]);
  const [incomingId, setIncomingId] = useState('');
  const selectionKey = JSON.stringify(selection);
  const selectionValid = selection.length >= 2 && selection.length <= 3 && selection.every(id => roster.some(player => player.player_id === id)) && new Set(selection).size === selection.length;
  // Key checking hides stale evidence immediately, even before the next effect runs.
  const comparison = useMemo<StudyAttachment['comparison']>(() => !selectionValid
    ? { selected_player_ids: selection, evidence: null, status: 'unavailable', reason: 'Choose two or three different players.' }
    : result?.key === selectionKey
      ? { selected_player_ids: selection, evidence: result.evidence, status: result.status, reason: result.reason }
      : { selected_player_ids: selection, evidence: null, status: 'loading', reason: null }, [selection, selectionKey, result, selectionValid]);

  useEffect(() => {
    if (!selectionValid) return;
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/draft-review/evidence?player_ids=${encodeURIComponent(selection.join(','))}`, { signal: controller.signal });
        const evidence = await response.json() as HistoricalEvidence;
        if (!response.ok || evidence.schema_version !== 'tiber_draft_review_historical_v1' || !['available', 'unavailable'].includes(evidence.status)) throw new Error('Historical evidence could not be loaded.');
        if (active) setResult({ key: selectionKey, evidence, status: evidence.status, reason: evidence.reason });
      } catch {
        if (active) setResult({ key: selectionKey, evidence: null, status: 'unavailable', reason: 'Historical evidence could not be loaded.' });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [selectionKey, selectionValid]);

  const scenario = useMemo(() => outgoing.length || incomingId
    ? deriveRosterScenario(roster, review.observed.league.lineup_slots, outgoing.filter(Boolean), options.find(p => p.player_id === incomingId) ?? null)
    : null, [outgoing, incomingId, options, roster, review.observed.league.lineup_slots]);
  useEffect(() => {
    // Preserve the packet contract without inventing a preference or importing private agent context.
    onChange({ scope, comparison, operator_context: { kind: 'manager_judgment', preferred_player_id: null, note: '', applies_to_player_ids: selection }, hypothetical_roster: scenario });
  }, [scope, comparison, selection, scenario, onChange]);

  function choose(index: number, id: string) {
    setSelection(previous => previous.map((value, i) => i === index ? id : value));
    setResult(null);
  }
  const attribution = comparison.evidence?.provenance?.attribution ?? review.historical_evidence?.provenance?.attribution;
  const players: ComparisonPlayer[] = selection.map(id => {
    const selected = roster.find(player => player.player_id === id);
    return { id, name: selected?.name ?? 'Choose a player', position: selected?.position ?? null, history: comparison.evidence?.players.find(player => player.player_id === id) };
  });
  const metricKeys = new Set(players.flatMap(player => POSITION_METRICS[player.position ?? ''] ?? HISTORICAL_METRICS.map(([key]) => key)));
  const metrics = Array.from(metricKeys).map(key => HISTORICAL_METRICS.find(([metric]) => metric === key)!);
  const anyHistory = players.some(hasHistory);
  return <>
  <section className="drp-panel drp-evidence" aria-label="Historical evidence study">
    <div className="drp-panel-heading"><div><span className="drp-label">2025 historical evidence</span><h3>Compare players</h3></div></div>
    <p>Explore recorded opportunity and production. These are 2025 observations, not current-season projections.</p>
    <div className={`drp-study-controls${selection.length === 3 ? ' drp-three-controls' : ''}`}>{selection.map((id, index) => <label key={index}>Player {index + 1}
      <select aria-label={`Comparison player ${index + 1}`} value={id} onChange={e => choose(index, e.target.value)}>
        <option value="">Choose a player</option>{roster.map(p => <option key={p.player_id} value={p.player_id}>{p.name} · {p.position ?? '?'} · current {p.team ?? '?'}</option>)}
      </select>
    </label>)}</div>
    <button type="button" className="drp-action" onClick={() => {
      setSelection(previous => previous.length === 2 ? [...previous, ''] : previous.slice(0, 2));
      setResult(null);
    }}>{selection.length === 2 ? 'Add third player' : 'Remove third player'}</button>
    <div aria-live="polite" aria-busy={comparison.status === 'loading'}>
      {comparison.status === 'loading' ? <p>Loading historical evidence…</p> : null}
      {comparison.status === 'unavailable' ? <p>{comparison.reason ?? 'Historical evidence unavailable.'}</p> : null}
    </div>
    {comparison.evidence?.status === 'available' ? <>
      <div className="drp-comparison-coverage">{players.map(player => {
        return <div key={player.id}><strong>{player.name}</strong>
          <p>{hasHistory(player) ? `${player.history?.observed?.weeks.length ?? 0} recorded weeks · 2025 team: ${player.history?.observed?.historical_teams.join(', ') || 'unknown'}` : coverageReason(player)}</p>
        </div>;
      })}</div>
      {anyHistory && metrics.length > 0 ? <>
        <p className="drp-scroll-hint">Swipe to compare players; metric labels stay visible →</p>
        <ComparisonTable metrics={metrics} players={players} compact />
        <p className="drp-muted">Values are means over recorded weeks, not certified games played. Shares are averages of weekly shares. — refers to the player coverage above.</p>
      </> : null}
    </> : null}
    <details className="drp-comparison-details">
      <summary>Totals, coverage and source details</summary>
      {comparison.evidence?.status === 'available' && anyHistory ? <>
        <p className="drp-scroll-hint">Swipe for more detail; metric labels stay visible →</p>
        <ComparisonTable metrics={HISTORICAL_METRICS} players={players} />
        {players.filter(hasHistory).map(player => <div key={player.id}>
          <strong>{player.name}</strong>
          {player.history?.identity ? <p>Identity: {player.history.identity.confidence} confidence · {player.history.identity.match_method}</p> : null}
          {player.history?.observed?.usage_conflict_weeks.length ? <p>Usage context conflicts in weeks {player.history.observed.usage_conflict_weeks.join(', ')}; joined usage excluded.</p> : null}
          {player.history?.observed?.usage_missing_weeks.length ? <p>Usage missing in weeks {player.history.observed.usage_missing_weeks.join(', ')}.</p> : null}
        </div>)}
      </> : null}
      <p className="drp-boundary">2025 weeks 1–18 only. Means retain nonnull-week denominators; average weekly share is not season share. Missing weeks are unknown, not zero or games missed. Totals require complete recorded values. Source acquisition and update times are unknown. TIBER filters and aggregates admitted nflverse observations.</p>
      <p>Current roles, injuries, forecasts and regression probabilities are unavailable. Air-yards totals, routes, snaps, red-zone usage and league fantasy points are unavailable.</p>
    </details>
    {attribution ? <p className="drp-attribution"><a href={attribution.source_url} target="_blank" rel="noreferrer">{attribution.name}</a> · <a href={attribution.license_url} target="_blank" rel="noreferrer">{attribution.license}</a>. {attribution.notice}</p> : null}
    {onDiscuss ? <div className="drp-discuss">
      <button type="button" className="drp-action" disabled={!selectionValid || comparison.status === 'loading'} onClick={onDiscuss}>Discuss this comparison</button>
      <p>Copies the roster and selected evidence for your agent. Add your question, preferences and hypotheses in that conversation. No agent connection or saved notes are created here.</p>
      <p role="status">{discussionStatus}</p>
      {discussionError ? <p role="alert" className="drp-error">{discussionError}</p> : null}
    </div> : null}
  </section>
  <details className="drp-panel drp-evidence drp-scenario">
    <summary>Optional roster geometry</summary>
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
    <p className="drp-muted">This scenario stays in page memory and is included in copied agent context. Refreshing or loading another roster clears it.</p>
  </details>
  </>;
}
