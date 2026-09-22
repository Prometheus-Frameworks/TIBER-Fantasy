import { useEffect, useMemo, useRef, useState } from 'react';
import { HISTORICAL_METRICS } from '@shared/draftReviewEvidence';
import { historicalCatalogSchema, historicalDataPacket, sortHistoricalRows, type HistoricalCatalog } from '@shared/teamHistoricalData';
import type { DraftReview } from '@/pages/TiberDraftReview';
import { ComparisonTable } from './DraftReviewEvidenceStudy';

function DataWorkspace({ review }: { review: DraftReview }) {
  const [catalog, setCatalog] = useState<HistoricalCatalog | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('All');
  const [selected, setSelected] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<string[]>(['rushing_attempts', 'rushing_yards', 'rushing_tds', 'targets', 'receptions']);
  const [sort, setSort] = useState('rushing_yards');
  const [mode, setMode] = useState<'mean' | 'total'>('mean');
  const [descending, setDescending] = useState(true);
  const [copyStatus, setCopyStatus] = useState('');
  const copySequence = useRef(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setError(''); setCatalog(null);
    fetch('/api/draft-review/data', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Historical data could not be loaded.');
      return historicalCatalogSchema.parse(await response.json());
    }).then(data => { if (active) setCatalog(data); }).catch(() => { if (active) setError('Historical data could not be loaded.'); });
    return () => { active = false; controller.abort(); copySequence.current++; };
  }, [attempt]);
  const rows = useMemo(() => catalog?.evidence.players.map(history => ({ history, name: catalog.labels.find(p => p.player_id === history.player_id)!.name })) ?? [], [catalog]);
  const visible = sortHistoricalRows(rows.filter(p => (position === 'All' || p.history.observed?.historical_positions.includes(position)) && `${p.name} ${p.history.player_id}`.toLowerCase().includes(query.toLowerCase())), sort, mode, descending);
  const metricRows = HISTORICAL_METRICS.filter(([key]) => metrics.includes(key));
  function changeSelection(id: string) {
    copySequence.current++; setCopyStatus('');
    setSelected(ids => ids.includes(id) ? ids.filter(v => v !== id) : ids.length < 4 ? [...ids, id] : ids);
  }
  async function copy() {
    if (!catalog) return;
    const sequence = ++copySequence.current;
    try {
      await navigator.clipboard.writeText(JSON.stringify(historicalDataPacket(review, catalog, selected, metrics), null, 2));
      if (sequence === copySequence.current) setCopyStatus('Comparison copied. Paste it into your agent conversation and add your judgment there.');
    } catch { if (sequence === copySequence.current) setCopyStatus('Could not copy. Check clipboard access and try again.'); }
  }
  if (error) return <div role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt(n => n + 1)}>Retry data</button></div>;
  if (!catalog) return <p role="status">Loading admitted 2025 evidence…</p>;
  if (catalog.evidence.status !== 'available') return <p role="status">{catalog.evidence.reason ?? 'Historical evidence unavailable.'}</p>;
  const attribution = catalog.evidence.provenance!.attribution;
  return <div className="drp-data-workspace">
    <p>2025 weeks 1–18 · admitted historical cohort only. Search results are not the full NFL player pool. Missing players have no evidence in this view.</p>
    <p>Means use nonnull recorded weeks, not certified games played. Missing weeks are unknown. Shares are average weekly shares, not season shares. Historical sorting is not a ranking or a 2026 projection.</p>
    <div className="drp-data-controls">
      <label>Find player or ID<input value={query} onChange={e => setQuery(e.target.value)} type="search" /></label>
      <label>Historical position<select value={position} onChange={e => setPosition(e.target.value)}>{['All', 'QB', 'RB', 'WR', 'TE'].map(p => <option key={p}>{p}</option>)}</select></label>
      <label>Sort metric<select value={sort} onChange={e => { setSort(e.target.value); if (e.target.value.endsWith('_share')) setMode('mean'); }}>{HISTORICAL_METRICS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Sort basis<select value={mode} onChange={e => setMode(e.target.value as 'mean' | 'total')}><option value="mean">Mean per recorded week</option><option value="total" disabled={sort.endsWith('_share')}>Recorded total</option></select></label>
      <label>Order<select value={descending ? 'desc' : 'asc'} onChange={e => setDescending(e.target.value === 'desc')}><option value="desc">High to low</option><option value="asc">Low to high</option></select></label>
    </div>
    <fieldset><legend>Displayed metrics</legend><div className="drp-data-metrics">{HISTORICAL_METRICS.map(([key, label]) => <label key={key}><input type="checkbox" checked={metrics.includes(key)} disabled={metrics.length === 1 && metrics.includes(key)} onChange={() => { copySequence.current++; setCopyStatus(''); setMetrics(m => m.includes(key) ? m.filter(k => k !== key) : [...m, key]); }} />{label}</label>)}</div></fieldset>
    <p role="status">{visible.length} players shown · {selected.length}/4 selected. Selection stays when filters change.</p>
    <div className="drp-evidence-table" role="region" tabIndex={0} aria-label="Historical data, scroll horizontally">
      <table><caption>2025 historical statistics · totals / means (nonnull / recorded weeks)</caption><thead><tr><th scope="col">Compare</th><th scope="col">Player / historical context</th>{metricRows.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}</tr></thead>
      <tbody>{visible.map(({ name, history }) => <tr key={history.player_id}>
        <td><input type="checkbox" aria-label={`Compare ${name}`} checked={selected.includes(history.player_id)} disabled={selected.length >= 4 && !selected.includes(history.player_id)} onChange={() => changeSelection(history.player_id)} /></td>
        <th scope="row">{name}<small>{history.observed?.historical_positions.join(', ')} · {history.observed?.historical_teams.join(', ')} · ID {history.player_id}</small><small>Identity: {history.identity?.confidence ?? 'unavailable'} · {history.identity?.match_method ?? 'unavailable'}</small></th>
        {metricRows.map(([key]) => { const value = history.derived[key]; const share = key.endsWith('_share'); return <td key={key}>{!value || !value.nonnull_weeks || history.status !== 'available' ? 'Unavailable' : <>{share ? (value.mean === null ? 'Unavailable' : `${(value.mean * 100).toFixed(1)}% mean`) : `${value.total ?? 'Unavailable'} total / ${value.mean?.toFixed(2) ?? 'Unavailable'} mean`}<small>{value.nonnull_weeks}/{value.recorded_weeks} recorded weeks</small></>}</td>; })}
      </tr>)}</tbody></table>
    </div>
    {!visible.length && <p>No admitted players match these filters.</p>}
    {selected.length > 0 && <div className="drp-data-comparison">
      <h3>Selected historical comparison</h3>
      <div className="drp-data-controls">{selected.map(id => <button type="button" key={id} onClick={() => changeSelection(id)}>Remove {rows.find(p => p.history.player_id === id)!.name}</button>)}</div>
      {selected.map(id => { const p = rows.find(r => r.history.player_id === id)!; return <p key={id}>{p.name}: {p.history.status === 'available' ? `${p.history.observed!.weeks.length} recorded weeks; ${p.history.identity!.confidence} identity confidence (${p.history.identity!.match_method}).` : p.history.reason}</p>; })}
      <ComparisonTable metrics={metricRows} players={selected.map(id => { const p = rows.find(r => r.history.player_id === id)!; return { id, name: p.name, position: p.history.observed?.historical_positions[0] ?? null, history: p.history }; })} />
      <button type="button" onClick={() => void copy()}>Copy data investigation</button><p role="status">{copyStatus}</p>
      <p>The handoff includes this roster snapshot, selected historical evidence and provenance. Add your preferred player and trade thesis in the conversation. Selection does not establish ownership or authorize a trade.</p>
    </div>}
    <details><summary>Sources, coverage and unavailable evidence</summary>
      <p><a href={attribution.source_url} target="_blank" rel="noreferrer">{attribution.name}</a> · <a href={attribution.license_url} target="_blank" rel="noreferrer">{attribution.license}</a>. TIBER filters and aggregates recorded observations. {attribution.notice}</p>
      <p>Name labels: Sleeper directory fetched {catalog.directory.fetched_at ?? 'unavailable'}; provider update time unknown. This clock is separate from the roster snapshot and the historical source clocks. {catalog.directory.reason}</p>
      <p>Roster snapshot generated {review.generated_at}. Historical acquisition and update clocks: {typeof catalog.evidence.provenance?.source_acquired_at === 'string' ? catalog.evidence.provenance.source_acquired_at : 'unavailable'} / {typeof catalog.evidence.provenance?.source_updated_at === 'string' ? catalog.evidence.provenance.source_updated_at : 'unavailable'}.</p>
      <ul>{catalog.evidence.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul>
      <p>2026 forecasts, regression predictions, league fantasy points, routes, snaps and red-zone usage are unavailable in this suite.</p>
    </details>
  </div>;
}
export function DraftReviewData({ review }: { review: DraftReview }) {
  const [open, setOpen] = useState(false);
  return <section className="drp-panel"><h2>Data · 2025 history</h2><p>Explore admitted evidence and compare up to four players.</p><button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? 'Close historical data' : 'Open historical data'}</button>{open && <DataWorkspace review={review} />}</section>;
}
