import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Clipboard, Loader2 } from 'lucide-react';
import './TiberDraftReview.css';

type ReviewPlayer = {
  player_id: string;
  name: string;
  position: string | null;
  team: string | null;
  roster_state: 'starter' | 'bench' | 'reserve' | 'taxi';
};

type DraftPick = {
  player_id: string;
  name: string;
  position: string | null;
  team: string | null;
  round: number;
  pick_no: number;
};

type DraftReview = {
  schema_version: string;
  generated_at: string;
  input: { canonicalUrl: string; leagueId: string; rosterId: number };
  observed: {
    league: {
      name: string;
      season: string;
      total_rosters: number;
      league_mode: 'redraft' | 'keeper' | 'dynasty' | 'unknown';
      scoring_format: string | null;
      lineup_slots: Record<string, number>;
    };
    team: { display_name: string; manager_name: string | null; roster_id: number };
    current_roster: ReviewPlayer[];
    draft: { status: 'available' | 'unavailable'; draft_id: string | null; picks: DraftPick[] };
  };
  derived: {
    roster_count: number;
    starter_count: number;
    bench_count: number;
    reserve_count: number;
    position_counts: Record<string, number>;
    roster_flags: string[];
  };
  forecast: {
    status: 'unavailable';
    reason: string;
    requested_horizons: string[];
    fabricated_values: false;
  };
  provenance: { authority: string; disclosures: string[] };
};

const EXAMPLE = 'https://sleeper.com/roster/1392906445938266112/7';
const STATE_ORDER: ReviewPlayer['roster_state'][] = ['starter', 'bench', 'reserve', 'taxi'];
const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

function formatScoring(format: string | null) {
  if (format === 'ppr') return 'Full PPR';
  if (format === 'half_ppr') return 'Half PPR';
  if (format === 'standard') return 'Standard';
  return format ?? 'Unknown';
}

function lineupSummary(slots: Record<string, number>) {
  return ['QB', 'RB', 'WR', 'TE', 'FLEX']
    .filter((slot) => slots[slot])
    .map((slot) => `${slots[slot]} ${slot}`)
    .join(' · ');
}

function positionSort(a: ReviewPlayer, b: ReviewPlayer) {
  const aIndex = POSITION_ORDER.indexOf(a.position ?? '');
  const bIndex = POSITION_ORDER.indexOf(b.position ?? '');
  return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex) || a.name.localeCompare(b.name);
}

export default function TiberDraftReview() {
  const initialUrl = new URLSearchParams(window.location.search).get('sleeper_url') ?? '';
  const [sleeperUrl, setSleeperUrl] = useState(initialUrl);
  const [review, setReview] = useState<DraftReview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function loadReview(url = sleeperUrl) {
    const value = url.trim();
    if (!value) return;
    setLoading(true);
    setError('');
    setReview(null);
    try {
      const response = await fetch(`/api/draft-review?sleeper_url=${encodeURIComponent(value)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `TIBER could not read this roster (HTTP ${response.status}).`);
      setReview(payload as DraftReview);
      const next = new URL(window.location.href);
      next.searchParams.set('sleeper_url', (payload as DraftReview).input.canonicalUrl);
      window.history.replaceState({}, '', next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'TIBER could not read this roster.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialUrl) void loadReview(initialUrl);
    // The deep-link input is intentionally read once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rosterGroups = useMemo(() => {
    if (!review) return [];
    return STATE_ORDER.map((state) => ({
      state,
      players: review.observed.current_roster.filter((player) => player.roster_state === state).sort(positionSort),
    })).filter((group) => group.players.length > 0);
  }, [review]);

  async function copyAgentPacket() {
    if (!review) return;
    const packet = {
      instruction: 'Use this TIBER Draft Review context as observed roster evidence. Keep observations, derivations, forecasts, and manager judgment separate. Do not invent unavailable projections.',
      context: review,
    };
    await navigator.clipboard.writeText(JSON.stringify(packet, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="drp-page">
      <section className="drp-hero">
        <div className="drp-kicker">TIBER · Draft Review pilot</div>
        <h1>Let TIBER read the team you actually drafted.</h1>
        <p>
          Paste a public Sleeper roster link. TIBER will compile the league settings, current roster,
          draft record and structural context without taking control of any fantasy decision.
        </p>

        <form className="drp-input-row" onSubmit={(event) => { event.preventDefault(); void loadReview(); }}>
          <label className="sr-only" htmlFor="sleeper-roster-url">Sleeper roster URL</label>
          <input
            id="sleeper-roster-url"
            value={sleeperUrl}
            onChange={(event) => setSleeperUrl(event.target.value)}
            placeholder={EXAMPLE}
            inputMode="url"
          />
          <button type="submit" disabled={!sleeperUrl.trim() || loading}>
            {loading ? <Loader2 size={16} className="drp-spin" /> : null}
            {loading ? 'Reading…' : 'Read my team'}
          </button>
        </form>
        <div className="drp-input-note">Public Sleeper data only · no login · no roster actions</div>
        {error ? <div className="drp-error" role="alert">{error}</div> : null}
      </section>

      {!review && !loading ? (
        <section className="drp-empty">
          <div>
            <span className="drp-step">01</span>
            <h2>Paste the roster URL</h2>
            <p>The roster ID tells TIBER which manager to inspect—no shared account state.</p>
          </div>
          <div>
            <span className="drp-step">02</span>
            <h2>Inspect the evidence</h2>
            <p>Observed Sleeper state remains separate from structural derivations and unavailable models.</p>
          </div>
          <div>
            <span className="drp-step">03</span>
            <h2>Continue with an agent</h2>
            <p>Copy the compiled packet into ChatGPT or Claude for a conversational decision review.</p>
          </div>
        </section>
      ) : null}

      {review ? (
        <main className="drp-results">
          <section className="drp-team-heading">
            <div>
              <div className="drp-kicker">Observed Sleeper context</div>
              <h2>{review.observed.team.display_name}</h2>
              <p>{review.observed.league.name} · {review.observed.team.manager_name ?? `Roster ${review.observed.team.roster_id}`}</p>
            </div>
            <span className="drp-status"><Check size={14} /> Read successfully</span>
          </section>

          <section className="drp-summary-grid" aria-label="League summary">
            <article><span>Format</span><strong>{review.observed.league.total_rosters}-team {formatScoring(review.observed.league.scoring_format)} · {review.observed.league.league_mode}</strong></article>
            <article><span>Starting shape</span><strong>{lineupSummary(review.observed.league.lineup_slots)}</strong></article>
            <article><span>Roster state</span><strong>{review.derived.starter_count} starters · {review.derived.bench_count} bench</strong></article>
            <article><span>Evidence time</span><strong>{new Date(review.generated_at).toLocaleString()}</strong></article>
          </section>

          <section className="drp-two-column">
            <article className="drp-panel">
              <div className="drp-panel-heading">
                <div><span className="drp-label observed">Observed</span><h3>Current roster</h3></div>
                <span>{review.derived.roster_count} players</span>
              </div>
              {rosterGroups.map((group) => (
                <div className="drp-roster-group" key={group.state}>
                  <h4>{group.state}</h4>
                  <div className="drp-player-list">
                    {group.players.map((player) => (
                      <div className="drp-player" key={player.player_id}>
                        <span className="drp-position">{player.position ?? '—'}</span>
                        <strong>{player.name}</strong>
                        <span>{player.team ?? 'FA'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </article>

            <div className="drp-stack">
              <article className="drp-panel">
                <div className="drp-panel-heading">
                  <div><span className="drp-label derived">Derived</span><h3>Roster geometry</h3></div>
                </div>
                <div className="drp-counts">
                  {POSITION_ORDER.filter((position) => review.derived.position_counts[position]).map((position) => (
                    <div key={position}><strong>{review.derived.position_counts[position]}</strong><span>{position}</span></div>
                  ))}
                </div>
                {review.derived.roster_flags.length ? (
                  <ul className="drp-flags">{review.derived.roster_flags.map((flag) => <li key={flag}>{flag}</li>)}</ul>
                ) : <p className="drp-muted">No basic one-slot duplication flags were produced.</p>}
                <p className="drp-boundary">Counts describe construction. They do not prove that a player should be traded, held or waived.</p>
              </article>

              <article className="drp-panel drp-forecast">
                <div className="drp-panel-heading">
                  <div><span className="drp-label unavailable">Unavailable</span><h3>Forecast lens</h3></div>
                </div>
                <p>{review.forecast.reason}</p>
                <div className="drp-horizons">
                  <span>Next 3 weeks</span><span>Next 6 weeks</span><span>Rest of season</span>
                </div>
                <p className="drp-boundary">TIBER has not filled these windows with guessed values. This is the next governed connection.</p>
              </article>
            </div>
          </section>

          {review.observed.draft.status === 'available' ? (
            <section className="drp-panel">
              <div className="drp-panel-heading">
                <div><span className="drp-label observed">Observed</span><h3>Original draft</h3></div>
                <span>{review.observed.draft.picks.length} selections</span>
              </div>
              <div className="drp-draft-grid">
                {review.observed.draft.picks.map((pick) => (
                  <div className="drp-draft-pick" key={`${pick.pick_no}-${pick.player_id}`}>
                    <span>{pick.round}.{String(pick.pick_no - ((pick.round - 1) * review.observed.league.total_rosters)).padStart(2, '0')}</span>
                    <strong>{pick.name}</strong>
                    <small>{pick.position ?? '—'} · {pick.team ?? 'FA'}</small>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="drp-agent">
            <div>
              <div className="drp-kicker">Continue with TIBER</div>
              <h2>The interface compiles the context. An agent helps you interrogate it.</h2>
              <p>
                Copy this bounded packet into ChatGPT or Claude and ask about the roster. The packet carries the
                observations, derivations, provenance and unavailable Forecast state together.
              </p>
            </div>
            <button type="button" onClick={() => void copyAgentPacket()}>
              {copied ? <Check size={16} /> : <Clipboard size={16} />}
              {copied ? 'Context copied' : 'Copy agent context'}
            </button>
          </section>

          <footer className="drp-footer">
            <span>TIBER prepares the decision. The human manager makes it.</span>
            <a href={review.input.canonicalUrl} target="_blank" rel="noreferrer">Open source roster <ArrowRight size={14} /></a>
          </footer>
        </main>
      ) : null}
    </div>
  );
}
