import type { CardModel } from './playerStateCardViewModel';
import { displayCount, displayDelta, displayPercent, displayPoints, TEAM_FIELD_LABELS } from './playerStateCardViewModel';
import './PlayerStateCard.css';

export function PlayerStateCard({ model }: { model: CardModel }) {
  const { identity, roleOpportunity: role, teamActivity: team, evidenceHealth: health, attribution } = model;
  const share = role.targetShareCreditedTeamTargets;
  const work = ['targets', 'receptions', 'carries'] as const;
  const workLabels = { targets: 'Targets', receptions: 'Receptions', carries: 'Carries' };
  return <article className="wpc" aria-labelledby="wpc-title">
    <header className="wpc-header">
      <p className="wpc-kicker">Private source-native pilot · 2026 REG · W1 → W2</p>
      <h1 id="wpc-title">{identity.name}</h1>
      <p>{identity.position} · observed event team {identity.observedEventTeam} · GSIS {identity.sourceNativePlayerId}</p>
      <p className="wpc-status">Provisional · finality unknown · corrections open</p>
      <p className="wpc-boundary">Source-native player evidence. Sleeper roster identity unresolved; no roster association.</p>
    </header>

    <section aria-labelledby="wpc-role-title" className="wpc-section">
      <h2 id="wpc-role-title">Role &amp; Opportunity</h2>
      <dl className="wpc-metrics">
        {work.map(field => <div key={field}>
          <dt>{workLabels[field]}</dt>
          <dd>{displayCount(role.recordedWork[field].week1.value)} → {displayCount(role.recordedWork[field].week2.value)} <small>({displayDelta(role.recordedWork[field].delta)})</small></dd>
        </div>)}
      </dl>
      <p className="wpc-share"><strong>Credited target share</strong><br />
        {share.week1.numerator}/{share.week1.denominator} ({displayPercent(share.week1.value)}) → {share.week2.numerator}/{share.week2.denominator} ({displayPercent(share.week2.value)}) · {displayPoints(share.percentagePointDelta)}
      </p>
      <p className="wpc-caption">The denominator is credited team targets, distinct from team pass attempts. Exact operands and unrounded producer values remain in the machine record.</p>
    </section>

    <section aria-labelledby="wpc-team-title" className="wpc-section">
      <h2 id="wpc-team-title">Team Environment · observed activity</h2>
      <dl className="wpc-metrics">
        {(['attempts', 'carries'] as const).map(field => <div key={field}>
          <dt>{field === 'attempts' ? 'GB pass attempts' : 'GB team carries'}</dt>
          <dd>{team.fields[field].week1} → {team.fields[field].week2} <small>({displayDelta(team.fields[field].delta)})</small></dd>
        </div>)}
      </dl>
      <details><summary>All ten reviewed team fields</summary>
        <div className="wpc-scroll" role="region" aria-label="Green Bay weekly team activity" tabIndex={0}>
          <table><caption>GB activity · W1 at MIN → W2 at NYJ; Δ = reviewed W2 minus W1</caption>
            <thead><tr><th scope="col">Field</th><th scope="col">W1</th><th scope="col">W2</th><th scope="col">Δ</th></tr></thead>
            <tbody>{TEAM_FIELD_LABELS.map(([key, label]) => <tr key={key}>
              <th scope="row">{label}</th><td>{team.fields[key].week1}</td><td>{team.fields[key].week2}</td><td>{displayDelta(team.fields[key].delta)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>
    </section>

    <section aria-labelledby="wpc-joint-title" className="wpc-section">
      <h2 id="wpc-joint-title">Joint observation</h2>
      <ul>{model.jointObservations.map(item => <li key={item.metricPair}>{item.text}</li>)}</ul>
      <p className="wpc-caption">These reviewed statements describe the same windows. Co-occurrence does not establish a cause.</p>
    </section>

    <section aria-labelledby="wpc-missing-title" className="wpc-section">
      <h2 id="wpc-missing-title">Missing evidence</h2>
      <p>Unavailable player evidence: {health.missingPlayerEvidence.join(', ')}.</p>
      <p>Unavailable team evidence: {health.missingTeamEvidence.join(', ')}.</p>
    </section>

    <details className="wpc-provenance"><summary>Evidence health, claim states &amp; provenance</summary>
      <p>W1 GB at MIN · game {model.scope.join.week1.gameId}; W2 GB at NYJ · game {model.scope.join.week2.gameId}.</p>
      <p>Evidence cutoffs unestablished for both weeks; game finality unknown; corrections open/provisional. Two observations do not establish persistence.</p>
      <p>ROP companion and retained support evidence are mandatory. Receiving air yards have 22 conflicts in each source path and are excluded here. W1 retains an unattributed SEA observation; W2 retains an unresolved BUF observation.</p>
      <p>ROP and Teamstate share Data lineage. Same-source reconciliation is internal consistency, not independent corroboration. Complete source coverage is not a participation census.</p>
      <dl>{role.claimStates.map(claim => <div key={claim.id}><dt>{claim.id.replaceAll('_', ' ')}</dt><dd>W1 {claim.week1.status}; W2 {claim.week2.status}</dd></div>)}</dl>
      <ul>{health.teamstate.map(note => <li key={note}>{note}</li>)}{health.composition.map(note => <li key={note}>{note}</li>)}</ul>
      <p>Composition: <code>{model.binding.compositionPacketSha256}</code><br />Machine: <code>{model.binding.compositionMachineSha256}</code><br />Receipt: <code>{model.binding.compositionReceiptSha256}</code><br />Review: <code>{model.binding.compositionReviewSha256}</code> · {model.binding.compositionReviewDisposition}</p>
      <p>Reviewed player/team comparison references: <code>{model.binding.ropComparisonPacketSha256}</code> / <code>{model.binding.teamstateComparisonPacketSha256}</code>.</p>
      <p>Source: <a href={attribution.sourceUrl} target="_blank" rel="noreferrer">{attribution.name}</a> · <a href={attribution.licenseUrl} target="_blank" rel="noreferrer">{attribution.license}</a>. {attribution.derivedNotice} Source licensing does not grant TIBER consumer admission.</p>
    </details>
  </article>;
}
