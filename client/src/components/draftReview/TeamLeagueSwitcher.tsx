import { useCallback, useEffect, useRef, useState } from 'react';
import { publicLeaguesInput, leagueSeason, type TeamLeagues, type TeamLeagueRosters, type TeamLeagueSummary } from '@shared/teamLeagues';
import { teamAccountRequest, TeamAccountRequestError, type TeamAccountState } from '@/lib/teamAccountApi';
import TeamAccount from './TeamAccount';

function description(league: TeamLeagueSummary) {
  const rec = league.receptionPoints;
  return [league.totalRosters == null ? 'Size unknown' : `${league.totalRosters} teams`,
    league.mode === 'unknown' ? 'Format unknown' : league.mode,
    rec === 1 ? 'PPR' : rec === .5 ? 'Half PPR' : rec === 0 ? 'Standard' : rec == null ? 'Scoring unknown' : `${rec} per catch`,
    league.superflex === true ? 'Superflex' : null].filter(Boolean).join(' · ');
}

function LeagueList({ access, currentLeagueId, navigationKey, onSelect, onIdentityFailure }: {
  access: TeamAccountState | null; currentLeagueId?: string; navigationKey: string;
  onSelect: (url: string) => boolean; onIdentityFailure: () => void;
}) {
  const [accountInput, setAccountInput] = useState('');
  const [season, setSeason] = useState(String(new Date().getUTCFullYear()));
  const [result, setResult] = useState<TeamLeagues | null>(null);
  const [rosters, setRosters] = useState<TeamLeagueRosters | null>(null);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editAccount, setEditAccount] = useState(true);
  const sequence = useRef(0);
  const request = useRef<AbortController>();
  const linked = access?.sleeperLink;
  const currentLeague = result?.leagues.find(league => league.leagueId === currentLeagueId);

  const invalidate = useCallback(() => {
    ++sequence.current; request.current?.abort(); request.current = new AbortController();
    setRosters(null); setOpening(null); setError('');
    return { id: sequence.current, signal: request.current.signal };
  }, []);
  const errorMessage = (caught: unknown, id: number) => {
    if (sequence.current !== id) return;
    if (access && caught instanceof TeamAccountRequestError && [401, 403, 409, 503].includes(caught.status)) {
      setResult(null); onIdentityFailure(); return;
    }
    setError(caught instanceof TeamAccountRequestError && caught.status === 429
      ? 'Too many refreshes. Try again in a minute.' : 'Sleeper league information could not be refreshed. Please try again.');
  };
  async function loadLeagues() {
    const account = linked?.sleeperUserId ?? accountInput.trim();
    if (!publicLeaguesInput.safeParse({ account, season }).success) return;
    const { id, signal } = invalidate(); setBusy(true); setResult(null); setOpen(true);
    try {
      const next: TeamLeagues = await teamAccountRequest(linked ? '/api/team-private/leagues'
        : `/api/draft-review/leagues?${new URLSearchParams({ account, season })}`, {
        ...(linked ? { body: { season }, csrf: access!.csrfToken } : {}), signal,
      });
      if (sequence.current !== id) return;
      if (next.status !== 'available' || next.season !== season || !Array.isArray(next.leagues) ||
          (linked && next.account.userId !== linked.sleeperUserId)) throw new Error('Unexpected league response');
      setResult(next); setFilter(''); setEditAccount(false);
    } catch (caught) { errorMessage(caught, id); }
    finally { if (sequence.current === id) setBusy(false); }
  }
  async function openLeague(leagueId: string) {
    if (!result || !result.leagues.some(league => league.leagueId === leagueId)) return;
    const { id, signal } = invalidate(); setOpening(leagueId);
    try {
      const next: TeamLeagueRosters = await teamAccountRequest(linked ? '/api/team-private/league-rosters'
        : `/api/draft-review/league-rosters?${new URLSearchParams({ userId: result.account.userId, leagueId, season: result.season })}`, {
        ...(linked ? { body: { leagueId, season: result.season }, csrf: access!.csrfToken } : {}), signal,
      });
      if (sequence.current !== id) return;
      if (next.status !== 'available' || next.leagueId !== leagueId || next.season !== result.season || !Array.isArray(next.rosters)) throw new Error('Unexpected roster response');
      if (next.rosters.length === 1) {
        if (onSelect(next.rosters[0].canonicalUrl)) setOpen(false);
      } else setRosters(next);
    } catch (caught) { errorMessage(caught, id); }
    finally { if (sequence.current === id) setOpening(null); }
  }

  useEffect(() => { invalidate(); setBusy(false); }, [navigationKey, invalidate]);
  useEffect(() => { if (linked) void loadLeagues(); }, []); // Identity/link revision remounts this component.
  useEffect(() => () => { ++sequence.current; request.current?.abort(); }, []);
  const matches = result?.leagues.filter(league => `${league.name} ${league.leagueId} ${description(league)}`.toLowerCase().includes(filter.toLowerCase())) ?? [];

  return <div className="tl-picker">
    <button type="button" className="tl-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span><strong>{currentLeague?.name ?? (linked ? 'My leagues' : 'Find leagues by Sleeper username')}</strong>
        {result && <small>{result.leagues.length} leagues · {result.account.displayName ?? result.account.username ?? result.account.userId} · {result.season}</small>}</span>
      <span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open && <div className="tl-picker-body">
      {(!result || editAccount || linked) && <form className="tl-form" onSubmit={event => { event.preventDefault(); void loadLeagues(); }}>
        {!linked && <><label htmlFor="team-leagues-account">Sleeper username or user ID</label>
          <input id="team-leagues-account" maxLength={64} value={accountInput} autoCapitalize="none" autoCorrect="off" spellCheck={false}
            onChange={event => { invalidate(); setBusy(false); setResult(null); setAccountInput(event.target.value); }} /></>}
        <div className="tl-season-row">
          <label htmlFor="team-leagues-season">Season</label>
          <input id="team-leagues-season" inputMode="numeric" maxLength={4} value={season}
            onChange={event => { invalidate(); setBusy(false); setResult(null); setSeason(event.target.value); }} />
          <button className="drp-action" disabled={busy || !leagueSeason.safeParse(season).success || (!linked && !/^[A-Za-z0-9_-]{1,64}$/.test(accountInput.trim()))}>
            {busy ? 'Finding leagues…' : result ? 'Refresh leagues' : 'Find leagues'}
          </button>
        </div>
      </form>}
      {busy && <p role="status">Reading Sleeper leagues…</p>}
      {error && <p className="drp-error" role="alert">{error}</p>}
      {result && <>
        <label className="sr-only" htmlFor="team-leagues-filter">Filter leagues</label>
        <input id="team-leagues-filter" className="tl-filter" placeholder="Find a league, dynasty, superflex…" value={filter}
          onChange={event => { invalidate(); setFilter(event.target.value); }} />
        <div className="tl-list" aria-label="Sleeper leagues">
          {matches.map(league => <button type="button" key={league.leagueId} className="tl-league" aria-current={league.leagueId === currentLeagueId ? 'true' : undefined}
            onClick={() => void openLeague(league.leagueId)}>
            <strong>{league.name}</strong><span>{description(league)}</span>
            <small>{opening === league.leagueId ? 'Checking roster…' : `League ${league.leagueId}`}</small>
          </button>)}
        </div>
        {result.leagues.length === 0 ? <p role="status">Sleeper reported no NFL leagues for this account in {result.season}.</p>
          : matches.length === 0 ? <p role="status">No leagues match this filter.</p> : null}
        {rosters && <div className="tl-roster-options">
          {rosters.rosters.length === 0 ? <p role="status">No roster membership was reported for this account in that league. Refresh the league list or use a public roster link.</p>
            : <><p>Multiple roster memberships were reported. Choose one:</p>{rosters.rosters.map(roster => <button type="button" className="drp-action" key={roster.rosterId}
              onClick={() => { if (onSelect(roster.canonicalUrl)) setOpen(false); }}>Roster {roster.rosterId} · {roster.relationship === 'co_owner' ? 'co-owner' : 'owner'}</button>)}</>}
        </div>}
        <p className="tl-source">Sleeper · league list checked <time dateTime={result.observations.leaguesReceivedAt}>{new Date(result.observations.leaguesReceivedAt).toLocaleString()}</time></p>
        {!linked && <div className="tl-inline-actions">
          <button type="button" className="drp-action" onClick={() => void loadLeagues()}>Refresh leagues</button>
          <button type="button" className="drp-action" onClick={() => { invalidate(); setResult(null); setEditAccount(true); }}>Change account or season</button>
        </div>}
      </>}
      <p className="tl-source">{linked ? 'Your linked account is saved. League and roster membership are refreshed from public Sleeper data.'
        : 'Public lookup · this list stays in this tab while you switch leagues. No account is linked.'} Roster membership does not verify account control.</p>
    </div>}
  </div>;
}

export default function TeamLeagueSwitcher({ authEnabled, currentLeagueId, navigationKey, onSelect }: {
  authEnabled: boolean; currentLeagueId?: string; navigationKey: string; onSelect: (url: string) => boolean;
}) {
  const [access, setAccess] = useState<TeamAccountState | null>(null);
  const [recheckKey, setRecheckKey] = useState(0);
  const identityFailure = useCallback(() => { setAccess(null); setRecheckKey(value => value + 1); }, []);
  return <section className="tl-switcher" aria-label="League navigation">
    {authEnabled && <TeamAccount onChange={setAccess} recheckKey={recheckKey} />}
    <LeagueList key={access ? `${access.user.id}:${access.linkVersion}:${access.revision}` : 'public'}
      access={access} currentLeagueId={currentLeagueId} navigationKey={navigationKey} onSelect={onSelect} onIdentityFailure={identityFailure} />
  </section>;
}
