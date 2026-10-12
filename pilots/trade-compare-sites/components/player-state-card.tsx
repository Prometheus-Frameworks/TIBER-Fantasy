import { formatMetric, METRICS, HISTORY_ENDPOINT, LABEL_SOURCE, LABEL_CHECKED_AT, type PlayerState } from '../lib/player-state.ts';

export function safeHttps(value: string): string | undefined {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined; }
  catch { return undefined; }
}

/** Pure, consumer-neutral presentation. Trade sides and operator notes stay outside. */
export function PlayerStateCard({ model }: { model: PlayerState }) {
  const { identity, historical, provenance } = model;
  const modules = [
    ['Actual fantasy points', model.production], ['Weekly role & opportunity', model.roleOpportunity],
    ['Team environment', model.teamActivity], ['Opportunity xFP', model.expectedPoints],
    ['Forward projection', model.forecast], ['Next opponent', model.nextOpponent],
  ] as const;
  return <article className="tc-full-card">
    <p className="tc-eyebrow">Player State · evidence view</p>
    <h2>{identity.name}</h2>
    <p>{model.scope.label}</p>
    <div className="tc-callout">
      <span className="tc-badge">{model.evidenceHealth.status} evidence</span>
      <p>Historical position: {identity.historicalPositions.join(', ') || 'unavailable'} · historical team: {identity.historicalTeams.join(', ') || 'unavailable'}</p>
      <p className="tc-caption">Canonical GSIS: <code>{identity.sourceNativePlayerId ?? 'unavailable'}</code><br />Sleeper ID: <code>{identity.providerId}</code><br />Identity confidence: {identity.confidence}{identity.matchMethod ? ` · ${identity.matchMethod}` : ''}</p>
      <p className="tc-caption">The display name is a dated intake hint. Current team, availability and league membership: unavailable.</p>
    </div>
    <section>
      <h3>Historical opportunity <span className="tc-class">derived</span></h3>
      {historical ? <>
        <dl className="tc-card-metrics">{METRICS.map(([key, label, style]) => {
          const m = historical.derived[key];
          return <div key={key}><dt>{label}</dt><dd>{formatMetric(m, style)}<small>{m ? `${m.nonnull_weeks}/${m.recorded_weeks} recorded weeks` : 'coverage unavailable'}</small></dd></div>;
        })}</dl>
        <p className="tc-caption">Recorded weeks: {historical.observed!.weeks.join(', ')}. Unrecorded weeks are unknown. These are not certified games played.</p>
        <p className="tc-caption">Usage conflicts: {historical.observed!.usage_conflict_weeks.join(', ') || 'none reported'} · usage missing weeks: {historical.observed!.usage_missing_weeks.join(', ') || 'none reported'}.</p>
      </> : <p className="tc-muted">unavailable — {model.historicalReason}</p>}
      <p className="tc-caption">Means retain each metric’s nonnull-week denominator. Mean weekly target share is not season target share; the underlying team-target operands are unavailable in this aggregate.</p>
    </section>
    <section><h3>Missing witnesses</h3><dl className="tc-module-list">{modules.map(([label, module]) => <div key={label}><dt>{label}</dt><dd><strong>unavailable</strong><small>{module.reason}</small></dd></div>)}</dl></section>
    <details open={!historical}><summary>Evidence health & source receipts</summary>
      <p>Historical evidence cutoff: unavailable<br />Original source acquisition and update clocks: unavailable<br />Game finality: unavailable<br />Retrieved: {model.scope.retrievedAt ?? 'unavailable'}</p>
      <p className="tc-caption">Retrieval time is a transport clock. It does not make 2025 evidence current.</p>
      <ul>{model.evidenceHealth.limitations.map((line, i) => <li key={i}>{line}</li>)}</ul>
      <p><a href={HISTORY_ENDPOINT + '?player_ids=' + identity.providerId} target="_blank" rel="noreferrer">Railway historical source</a></p>
      {provenance && <>
        <p>Producer: {provenance.producer_repo}<br /><code>{provenance.producer_commit}</code></p>
        <p>{provenance.transform}</p>
        <ul className="tc-receipts">{provenance.sources.map(s => <li key={s.path}><code>{s.path}</code><br /><code>{s.sha256}</code></li>)}</ul>
        <p><a href={safeHttps(provenance.attribution.source_url)} target="_blank" rel="noreferrer">{provenance.attribution.name}</a> · <a href={safeHttps(provenance.attribution.license_url)} target="_blank" rel="noreferrer">{provenance.attribution.license}</a>. {provenance.attribution.notice}</p>
      </>}
      <p className="tc-caption">Intake names: <a href={LABEL_SOURCE} target="_blank" rel="noreferrer">Sleeper public directory</a> · checked {LABEL_CHECKED_AT}. Display hints only; no name-based canonical joins.</p>
    </details>
  </article>;
}
