import { useEffect, useRef, useState } from 'react';
import { summarizeExposure, type ExposureLeague } from '@shared/teamExposure';
import type { TeamLeagues } from '@shared/teamLeagues';
import { createManagerRequester } from '@/lib/teamManagerRequests';
import { TeamAccountRequestError } from '@/lib/teamAccountApi';
const request = createManagerRequester(); // Separate route budget, retained across refreshes and remounts.
export default function TeamExposure({ leagues, selected, onOpenTeam }: { leagues: TeamLeagues; selected: string[]; onOpenTeam: (url: string) => void }) {
  const [results, setResults] = useState<Record<string, ExposureLeague>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const controller = useRef<AbortController>(); const sequence = useRef(0);
  useEffect(() => () => { ++sequence.current; controller.current?.abort(); }, []);
  async function refresh() {
    controller.current?.abort(); controller.current = new AbortController(); const signal = controller.current.signal; const id = ++sequence.current;
    setResults({}); setErrors({}); setChoices({}); setBusy(true); let index = 0;
    const worker = async () => {
      while (index < selected.length && id === sequence.current) {
        const leagueId = selected[index++];
        try {
          const result: ExposureLeague = await request(`/api/draft-review/manager-players?${new URLSearchParams({ userId: leagues.account.userId, leagueId, season: leagues.season })}`, { signal });
          if (id !== sequence.current) return;
          if (result.schemaVersion !== 'tiber_exposure_v1' || result.userId !== leagues.account.userId || result.leagueId !== leagueId || result.season !== leagues.season || !Array.isArray(result.rosters)) throw new Error();
          setResults(old => ({ ...old, [leagueId]: result }));
        } catch (error) {
          if (id === sequence.current) setErrors(old => ({ ...old, [leagueId]: error instanceof TeamAccountRequestError && error.status === 429
            ? 'Request limit reached. Wait a minute and refresh players again.' : 'Roster unavailable. Try refreshing players again.' }));
        }
      }
    };
    await Promise.all([worker(), worker()]); if (id === sequence.current) setBusy(false);
  }
  const summary = summarizeExposure(selected, results, choices);
  const name = (id: string) => leagues.leagues.find(l => l.leagueId === id)?.name ?? `League ${id}`;
  const notLoaded = selected.filter(id => !results[id] && !errors[id]).length;
  const excluded = selected.length - summary.loaded - notLoaded;
  const rows = summary.rows.filter(row => `${row.player.name ?? ''} ${row.player.sleeperId} ${row.player.position ?? ''} ${row.player.team ?? ''}`.toLowerCase().includes(filter.toLowerCase()));
  return <section aria-label="Player exposure" className="tm-exposure">
    <h3>Players across your leagues</h3>
    <p className="drp-muted">Current roster exposure, independent of the week selector. Includes bench, reserve and taxi players. No roster actions.</p>
    <button type="button" className="drp-action" disabled={busy || !selected.length} onClick={() => void refresh()}>Refresh players</button>
    {busy && <p role="status">Reading rosters… Large selections may wait for request capacity.</p>}
    <div className="tm-summary" aria-live="polite"><strong>{summary.loaded} of {selected.length} leagues loaded</strong>
      <span>{notLoaded} not loaded · {excluded} unavailable or awaiting roster choice</span>
      <span>Percentages use only the {summary.loaded} loaded leagues. One roster per league; current membership is not proof of account control.</span></div>
    {selected.filter(id => !results[id] || results[id].rosters.length !== 1 || !results[id].rosters[0]?.available).map(id => <div className="tm-card" key={id}>
      <h4>{name(id)}</h4>
      {errors[id] && <p role="alert">{errors[id]}</p>}
      {!results[id] && !errors[id] && <p>{busy ? 'Waiting for roster…' : 'Refresh players to load this league.'}</p>}
      {results[id]?.rosters.length === 0 && <p>No current owner/co-owner roster found. Excluded from exposure.</p>}
      {results[id]?.rosters.length > 1 && <label>Roster for {name(id)}<select value={choices[id] ?? ''} onChange={e => setChoices(old => ({ ...old, [id]: Number(e.target.value) }))}>
        <option value="">Choose one roster</option>{results[id].rosters.map(r => <option value={r.rosterId} key={r.rosterId}>Roster {r.rosterId}{r.available ? '' : ' · unavailable'}</option>)}
      </select></label>}
      {results[id]?.rosters.some(r => !r.available) && <p>Incomplete roster contents are excluded from the percentage.</p>}
    </div>)}
    <label>Find a player<input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Name, position or NFL team" /></label>
    {!!summary.loaded && !summary.rows.length && <p>No players reported on the loaded rosters.</p>}
    {!!summary.rows.length && !rows.length && <p>No players match your search.</p>}
    <div className="tm-cards">{rows.map(({ player, holdings, percent, directoryReceivedAt }) => <details className="tm-card tm-player" key={player.sleeperId}>
      <summary><span><strong>{player.name ?? `Sleeper player ${player.sleeperId}`}</strong><small>{player.position ?? 'Position unavailable'} · {player.team ?? 'NFL team unavailable'}</small></span>
        <span className="tm-exposure-count">{holdings.length}/{summary.loaded} leagues · {percent.toFixed(1)}%</span>
        <span className={player.injuryStatus ? 'tm-injury' : 'drp-muted'}>{!player.directoryAvailable ? 'Player details unavailable' : player.injuryStatus ? `Sleeper: ${player.injuryStatus}` : 'No injury designation reported'}</span>
      </summary>
      <p className="tm-clock">Player details {directoryReceivedAt && player.directoryAvailable ? `checked ${new Date(directoryReceivedAt).toLocaleString()}` : 'unavailable'} · directory cache up to 5 minutes. Sleeper update time unavailable; no designation is not a health clearance.</p>
      {holdings.map(h => <div className="tm-holding" key={h.leagueId}><strong>{name(h.leagueId)}</strong>
        <p>{leagues.leagues.find(l => l.leagueId === h.leagueId)?.mode ?? 'unknown format'} · Roster {h.rosterId} · {h.location === 'unknown' ? 'Lineup placement unavailable' : h.location}</p>
        <p className="tm-clock">Roster checked {new Date(h.checkedAt).toLocaleString()}</p>
        <button type="button" className="drp-action" onClick={() => onOpenTeam(h.canonicalUrl)}>Open Team — {name(h.leagueId)}</button></div>)}
    </details>)}</div>
    <p className="drp-muted">Sleeper roster and player-directory observations. This view does not diagnose injuries or infer what happened in a game. Refresh for a new roster check; selections stay in this page only.</p>
  </section>;
}
