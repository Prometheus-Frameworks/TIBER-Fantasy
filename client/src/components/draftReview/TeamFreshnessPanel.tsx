import { useEffect, useState } from 'react';
import { isTeamFreshness, type TeamFreshness } from '@shared/teamFreshness';

function snapshotTime(value?: string): string {
  // This is the roster compiler clock, never a source-update or deployment clock.
  return value && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) ? value : 'Not loaded';
}

export default function TeamFreshnessPanel({ rosterCompiledAt }: { rosterCompiledAt?: string }) {
  const [attempt, setAttempt] = useState(0);
  const [metadata, setMetadata] = useState<TeamFreshness | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true); setMetadata(null);
    const timer = setTimeout(() => { if (active) { setLoading(false); setMetadata(null); } controller.abort(); }, 8000);
    Promise.resolve().then(() => fetch('/api/draft-review/freshness', { cache: 'no-store', signal: controller.signal }))
      .then(async response => {
        if (!response.ok) throw new Error('Metadata unavailable');
        const body: unknown = await response.json();
        if (!isTeamFreshness(body)) throw new Error('Metadata unavailable');
        if (active && !controller.signal.aborted) setMetadata(body);
      })
      .catch(() => { if (active) setMetadata(null); })
      .finally(() => { clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [attempt]);
  const history = metadata?.historical_evidence;
  return <details className="drp-freshness">
    <summary>Build and evidence freshness</summary>
    <div aria-live="polite" aria-busy={loading}>
      <p>{loading ? 'Checking freshness metadata…' : metadata ? 'Code and football evidence have separate clocks.' : 'Freshness metadata unavailable. No current-build or evidence-freshness claim.'}</p>
      <dl>
        <dt>Server revision</dt><dd>{metadata?.server_build.revision ?? 'Unknown'}</dd>
        <dt>Build / deployment date</dt><dd>Unknown</dd>
        <dt>Historical evidence window</dt><dd>{history?.status === 'available' && history.window
          ? `${history.window.season} · Weeks ${history.window.week_start}–${history.window.week_end}` : 'Unavailable'}</dd>
        <dt>Historical source update / last successful refresh</dt><dd>Unknown</dd>
        <dt>Current weekly evidence</dt><dd>{metadata ? 'Unavailable · no admitted weekly evidence connected' : 'Unknown'}</dd>
        <dt>Roster snapshot compiled</dt><dd>{snapshotTime(rosterCompiledAt)}</dd>
      </dl>
      <p className="drp-boundary">Server revision is platform-reported and does not certify cached page code. Historical coverage varies by player. Roster compilation and checking this panel do not refresh football evidence.</p>
      <button className="drp-action" type="button" disabled={loading} onClick={() => setAttempt(value => value + 1)}>Check freshness again</button>
    </div>
  </details>;
}
