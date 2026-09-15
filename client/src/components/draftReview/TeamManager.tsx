import { useEffect, useRef, useState } from 'react';
import { publicLeaguesInput, type TeamLeagues } from '@shared/teamLeagues';
import { summarizeManagerWeek, type ManagerOutcome, type ManagerResult } from '@shared/teamManager';
import { teamAccountRequest } from '@/lib/teamAccountApi';

type Entry = { result?: ManagerResult; error?: string };
export default function TeamManager({ onOpenTeam }: { onOpenTeam: (url: string) => void }) {
  const [account, setAccount] = useState('');
  const [season, setSeason] = useState(String(new Date().getUTCFullYear()));
  const [week, setWeek] = useState('1');
  const [leagues, setLeagues] = useState<TeamLeagues | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [selectionOpen, setSelectionOpen] = useState(true);
  const sequence = useRef(0);
  const controller = useRef<AbortController>();
  const invalidate = () => { ++sequence.current; controller.current?.abort(); setBusy(false); setError(''); };
  const clearResults = () => { invalidate(); setEntries({}); setChoices({}); };
  const clearAccount = () => { clearResults(); setLeagues(null); setSelected([]); };
  useEffect(() => () => { ++sequence.current; controller.current?.abort(); }, []);

  async function discover() {
    clearAccount(); controller.current = new AbortController(); const id = sequence.current;
    setBusy(true);
    try {
      const next: TeamLeagues = await teamAccountRequest(`/api/draft-review/leagues?${new URLSearchParams({ account: account.trim(), season })}`, { signal: controller.current.signal });
      if (id !== sequence.current) return;
      if (next.status !== 'available' || next.season !== season || !Array.isArray(next.leagues)) throw new Error();
      setLeagues(next); setFilter(''); setSelectionOpen(true);
    } catch { if (id === sequence.current) setError('Could not find leagues. Check the account and try again.'); }
    finally { if (id === sequence.current) setBusy(false); }
  }
  async function refresh() {
    if (!leagues || !selected.length) return;
    clearResults(); controller.current = new AbortController(); const signal = controller.current.signal; const id = sequence.current;
    setBusy(true); let index = 0;
    const work = async () => {
      while (index < selected.length && id === sequence.current) {
        const leagueId = selected[index++];
        try {
          const result: ManagerResult = await teamAccountRequest(`/api/draft-review/manager-week?${new URLSearchParams({
            userId: leagues.account.userId, leagueId, season: leagues.season, week,
          })}`, { signal });
          if (id !== sequence.current) return;
          if (result.schemaVersion !== 'tiber_manager_week_v1' || result.leagueId !== leagueId || result.season !== leagues.season || result.week !== Number(week)) throw new Error();
          setEntries(old => ({ ...old, [leagueId]: { result } }));
        } catch {
          if (id === sequence.current) setEntries(old => ({ ...old, [leagueId]: { error: 'Could not refresh this league. Try Refresh results again.' } }));
        }
      }
    };
    await Promise.all([work(), work()]);
    if (id === sequence.current) setBusy(false);
  }
  const chosen = (leagueId: string) => {
    const rows = entries[leagueId]?.result?.rosters ?? [];
    return rows.length === 1 ? rows[0] : rows.find(row => row.rosterId === choices[leagueId]);
  };
  const outcomes: ManagerOutcome[] = selected.map(id => chosen(id)?.outcome ?? (entries[id]?.error || entries[id]?.result ? 'unavailable' : 'pending'));
  const summary = summarizeManagerWeek(outcomes);
  const filtered = leagues?.leagues.filter(league => `${league.name} ${league.mode}`.toLowerCase().includes(filter.toLowerCase())) ?? [];
  const labels = { win: 'Win · provisional', loss: 'Loss · provisional', tie: 'Tie · provisional', pending: 'Pending', unavailable: 'Unavailable' };
  return <section className="drp-panel tm-manager" aria-label="Manager weekly results">
    <div className="drp-kicker">Your season, across leagues</div>
    <h2>Manager</h2>
    <p className="drp-muted">Choose the leagues to include, then check how your week went.</p>
    <form className="tm-controls" onSubmit={event => { event.preventDefault(); void discover(); }}>
      <label>Sleeper username or user ID<input value={account} maxLength={64} autoCapitalize="none" autoCorrect="off" spellCheck={false}
        onChange={event => { clearAccount(); setAccount(event.target.value); }} /></label>
      <label>Season<input value={season} maxLength={4} inputMode="numeric" onChange={event => { clearAccount(); setSeason(event.target.value); }} /></label>
      <button className="drp-action" disabled={busy || !publicLeaguesInput.safeParse({ account: account.trim(), season }).success}>Find leagues</button>
    </form>
    {error && <p role="alert" className="drp-error">{error}</p>}
    {leagues && <>
      <p>{leagues.account.displayName ?? leagues.account.username ?? leagues.account.userId} · {leagues.season} · {leagues.leagues.length} leagues found</p>
      <details className="tm-selection" open={selectionOpen} onToggle={event => setSelectionOpen(event.currentTarget.open)}>
        <summary>Choose leagues · {selected.length} selected</summary>
        <label>Filter manager leagues<input value={filter} onChange={event => setFilter(event.target.value)} /></label>
        <div className="tm-league-list">{filtered.map(league => <label key={league.leagueId}>
          <input type="checkbox" checked={selected.includes(league.leagueId)} onChange={event => {
            clearResults(); setSelected(old => event.target.checked ? [...old, league.leagueId] : old.filter(id => id !== league.leagueId));
          }} /><span>{league.name}<small>{league.mode} · {league.totalRosters ?? '?'} teams</small></span>
        </label>)}</div>
        {!leagues.leagues.length && <p>No NFL leagues were reported for this account and season.</p>}
        {!!leagues.leagues.length && !filtered.length && <p>No leagues match this filter.</p>}
      </details>
      <div className="tm-controls">
        <label>Week<select value={week} onChange={event => { clearResults(); setWeek(event.target.value); }}>
          {Array.from({ length: 18 }, (_, i) => <option key={i + 1} value={i + 1}>Week {i + 1}</option>)}
        </select></label>
        <button type="button" className="drp-action" disabled={busy || !selected.length} onClick={() => void refresh()}>Refresh results</button>
      </div>
      {!!selected.length && <>
        <div className="tm-summary" aria-live="polite"><strong>Week {week}: {summary.win} W · {summary.loss} L · {summary.tie} T</strong>
          <span>{summary.pending} pending · {summary.unavailable} unavailable · {selected.length} selected leagues</span></div>
        <p className="drp-muted">Provisional head-to-head record only. Median games are excluded. Scores may change after corrections; refresh to check again.</p>
        <div className="tm-cards">{selected.map(id => {
          const entry = entries[id]; const result = entry?.result; const roster = chosen(id);
          return <article className="tm-card" key={id}>
            <h3>{leagues.leagues.find(league => league.leagueId === id)?.name}</h3>
            {entry?.error && <p role="alert">{entry.error}</p>}
            {!entry && <p>{busy ? 'Checking results…' : 'Refresh results to load this league.'}</p>}
            {result && <>
              {result.rosters.length > 1 && <label>Roster to track in this league<select value={choices[id] ?? ''} onChange={event => setChoices(old => ({ ...old, [id]: Number(event.target.value) }))}>
                <option value="">Choose one roster</option>{result.rosters.map(row => <option key={row.rosterId} value={row.rosterId}>Roster {row.rosterId}</option>)}
              </select></label>}
              {roster && <>
                <strong className="tm-outcome">{labels[roster.outcome]}</strong>
                <p>Roster {roster.rosterId}{roster.opponentRosterId != null ? ` vs roster ${roster.opponentRosterId}` : ' · opponent unavailable'}</p>
                <p className="tm-score">{roster.points == null ? '—' : roster.points.toFixed(2)} <span>–</span> {roster.opponentPoints == null ? '—' : roster.opponentPoints.toFixed(2)}</p>
                {(roster.scoreBasis === 'commissioner_override' || roster.opponentScoreBasis === 'commissioner_override') && <p>Includes a commissioner score override.</p>}
                <button type="button" className="drp-action" onClick={() => onOpenTeam(roster.canonicalUrl)}>Open Team</button>
              </>}
              {result.reason && <p className="drp-muted">{result.reason}</p>}
              <p className="tm-clock">Sleeper · {result.observations.matchupsReceivedAt ? 'Scores' : 'Membership'} checked <time>{new Date(result.observations.matchupsReceivedAt ?? result.observations.rostersReceivedAt).toLocaleString()}</time></p>
            </>}
          </article>;
        })}</div>
      </>}
    </>}
    {busy && <p role="status">Reading Sleeper…</p>}
    <p className="drp-boundary">Public lookup; no account is linked. Selections stay in this page until reload. Standings, saved profiles and season totals are not included yet.</p>
  </section>;
}
