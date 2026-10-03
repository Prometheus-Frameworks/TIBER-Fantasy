import { useEffect, useRef, useState } from 'react';
import { matchupSchema, type TeamMatchup } from '@shared/draftReviewMatchup';
import { createManagerRequester } from '@/lib/teamManagerRequests';
const request = createManagerRequester();
const flags = new Set(['Out', 'IR', 'PUP', 'Doubtful', 'Questionable']);

/** Explicit, scoped lineup read. Current directory labels are separate from weekly scores. */
export default function MyWeekMatchup({ url, leagueId, rosterId, opponentRosterId, season, week }: {
  url: string; leagueId: string; rosterId: number; opponentRosterId: number; season: string; week: number;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<TeamMatchup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const controller = useRef<AbortController>();
  useEffect(() => () => { ++sequence.current; controller.current?.abort(); }, []);
  async function load() {
    controller.current?.abort(); controller.current = new AbortController();
    const current = ++sequence.current;
    setOpen(true); setLoading(true); setResult(null); setError('');
    try {
      const data = matchupSchema.parse(await request(`/api/draft-review/matchup?${new URLSearchParams({ sleeper_url: url, season, week: String(week) })}`, { signal: controller.current.signal }));
      if (data.input.canonicalUrl !== url || data.input.leagueId !== leagueId || data.input.rosterId !== rosterId || data.observed.you.roster_id !== rosterId || data.observed.opponent.roster_id !== opponentRosterId || data.season !== season || data.week !== week) throw new Error('Scope mismatch');
      if (current === sequence.current) setResult(data);
    } catch { if (current === sequence.current) setError('Lineups and attention check unavailable. Scores above remain a separate observation. Retry to check again.'); }
    finally { if (current === sequence.current) setLoading(false); }
  }
  function close() { ++sequence.current; controller.current?.abort(); setLoading(false); setOpen(false); setResult(null); setError(''); }
  const attention = result?.observed.you.starters.filter(p => p.player_id === null || flags.has(p.injury_status ?? '')) ?? [];
  return <div className="mw-matchup">
    <button type="button" className="drp-action" aria-expanded={open} onClick={() => open ? close() : void load()}>{open ? 'Close lineups' : 'Open lineups and attention check'}</button>
    {!open && <p className="drp-muted">Lineups and attention not loaded.</p>}
    {open && <>
      {loading && <p role="status">Reading both weekly lineups…</p>}
      {error && <><p role="alert">{error}</p><button type="button" className="drp-action" onClick={() => void load()}>Retry lineups</button></>}
      {result && <>
        <p className="mw-attention">{attention.length ? `${attention.length} starting slot${attention.length === 1 ? '' : 's'} to review` : 'No empty slots or listed injury flags found in this check.'}</p>
        {attention.length > 0 && <ul>{attention.map((p, i) => <li key={i}>{p.slot} · {p.player_id === null ? 'Empty slot' : `${p.name} · Sleeper: ${p.injury_status}`}</li>)}</ul>}
        <p className="drp-muted">Injury labels describe the current directory, even for an earlier week. Missing flags do not establish health or playing eligibility.</p>
        <div className="mw-lineups">{[result.observed.you, result.observed.opponent].map((side, i) => <section key={side.roster_id} aria-label={i === 0 ? 'Your weekly lineup' : 'Opponent weekly lineup'}>
          <h4>{i === 0 ? 'You' : 'Opponent'} · {side.name}</h4>
          <ul>{side.starters.map((p, index) => <li key={index}><div><small>{p.slot} · {p.team ?? 'Team unknown'}</small><strong>{p.name}</strong>{p.injury_status && <small>Sleeper: {p.injury_status}</small>}</div><span>{p.points === null ? '—' : p.points.toFixed(2)}</span></li>)}</ul>
        </section>)}</div>
        <p className="tm-clock">Lineups checked {new Date(result.provenance.received_at).toLocaleString()} · Directory fetched {new Date(result.provenance.directory_fetched_at).toLocaleString()}</p>
        <p className="drp-muted">Zero points do not establish game status. Scores above and these lineups were checked separately.</p>
        <details><summary>Sources and limits</summary>{result.provenance.disclosures.map(d => <p key={d}>{d}</p>)}<p>Unavailable: {result.unavailable.join('; ')}.</p><ul>{result.provenance.source_urls.map(source => <li key={source}><a href={source} target="_blank" rel="noreferrer">{source}</a></li>)}</ul></details>
        <button type="button" className="drp-action" onClick={() => void load()}>Refresh lineups</button>
      </>}
    </>}
  </div>;
}
