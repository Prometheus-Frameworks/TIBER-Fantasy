import { DraftReviewData } from '@/components/draftReview/DraftReviewData';
import DraftReviewWaivers from '@/components/draftReview/DraftReviewWaivers';
import type { WaiverSettings, WaiverAttachment } from '@shared/teamWaiverContext';
import DraftReviewEvidenceStudy from '@/components/draftReview/DraftReviewEvidenceStudy';
import DraftReviewTeExplorer from '@/components/draftReview/DraftReviewTeExplorer';
import type { HistoricalEvidence } from '@shared/draftReviewEvidence';
import { draftReviewAgentPacket, draftReviewComparisonPacket, reviewScope, type StudyAttachment } from '@shared/draftReviewStudy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearch } from 'wouter/use-browser-location';
import { ArrowRight, Check, Clipboard, Loader2 } from 'lucide-react';
import './TiberDraftReview.css';

type ReviewPlayer = {
  player_id: string;
  name: string;
  position: string | null;
  team: string | null;
  status: string | null;
  active: boolean | null;
  roster_state: 'starter' | 'bench' | 'reserve' | 'taxi';
};

type DraftPick = {
  player_id: string;
  name: string;
  position: string | null;
  team: string | null;
  round: number;
  pick_no: number;
  draft_slot: number | null;
  next_turn_distance: number | null;
};

export type DraftReview = {
  waiver_context?: WaiverSettings;
  historical_evidence?: HistoricalEvidence;
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
      scoring_summary?: {
        format: string | null;
        reception_points: number | null;
        passing: {
          touchdown_points: number | null;
          interception_points: number | null;
          yards_per_point: number | null;
        };
        rushing: { touchdown_points: number | null; yards_per_point: number | null };
        receiving: {
          touchdown_points: number | null;
          yards_per_point: number | null;
          tight_end_premium: number | null;
        };
        additional_nonzero_rule_count: number;
        additional_rules_truncated: boolean;
        additional_nonzero_rules: Array<{ rule: string; label: string; points: number }>;
      };
      reserve?: {
        configured_slots: number;
        occupied_slots: number;
        open_slots: number;
        configured_eligibility: Record<string, boolean | null>;
        current_player_eligibility: { status: 'unavailable'; reason: string };
      };
    };
    team: { display_name: string; manager_name: string | null; roster_id: number };
    current_roster: ReviewPlayer[];
    draft: {
      status: 'available' | 'unavailable';
      reason: string | null;
      draft_id: string | null;
      pick_timer_seconds?: number | null;
      team_draft_slot?: number | null;
      picks: DraftPick[];
      full_board_status?: 'available' | 'unavailable';
      full_board_reason?: string | null;
      full_board?: DraftPick[];
    };
  };
  derived: {
    roster_count: number;
    starter_count: number;
    bench_count: number;
    reserve_count: number;
    position_counts: Record<string, number>;
    roster_flags: string[];
    bye_week_geometry: { status: 'unavailable'; reason: string; fabricated_values: false };
    decision_context: {
      league_mode: 'redraft' | 'keeper' | 'dynasty' | 'unknown';
      scoring_format: string | null;
      lineup_slots: Record<string, number>;
      evaluation_horizons: string[];
    };
  };
  forecast: {
    status: 'unavailable';
    reason: string;
    requested_horizons: string[];
    fabricated_values: false;
  };
  provenance: { authority: string; disclosures: string[] };
};

type TeamChoice = {
  roster_id: number;
  display_name: string;
  manager_name: string | null;
  canonicalUrl: string;
};

type TeamSelection = {
  status: 'team_selection_required';
  league: { league_id: string; name: string; season: string; total_rosters: number };
  teams: TeamChoice[];
};

type InputResolution = TeamSelection | {
  status: 'roster_resolved';
  canonicalUrl: string;
};

const EXAMPLE = 'Sleeper roster/draft link or league ID';
const STATE_ORDER: ReviewPlayer['roster_state'][] = ['starter', 'bench', 'reserve', 'taxi'];
const STATE_LABELS = { starter: 'Starters', bench: 'Bench', reserve: 'Reserve', taxi: 'Taxi' };
const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

function formatScoring(format: string | null) {
  if (format === 'ppr') return 'Full PPR';
  if (format === 'half_ppr') return 'Half PPR';
  if (format === 'standard') return 'Standard';
  return format ?? 'Unknown';
}

function lineupSummary(slots: Record<string, number>) {
  const nonStartingSlots = new Set(['BN', 'IR', 'RESERVE', 'TAXI']);
  return Object.entries(slots)
    .filter(([slot, count]) => count > 0 && !nonStartingSlots.has(slot))
    .map(([slot, count]) => `${count} ${slot}`)
    .join(' · ');
}

function scoringSummary(review: DraftReview) {
  const summary = review.observed.league.scoring_summary;
  if (!summary) return null;
  const parts = [];
  if (summary.reception_points !== null) parts.push(`${summary.reception_points} per reception`);
  if (summary.passing.touchdown_points !== null) parts.push(`${summary.passing.touchdown_points}-pt pass TD`);
  if ((summary.receiving.tight_end_premium ?? 0) > 0) {
    parts.push(`+${summary.receiving.tight_end_premium} TE reception`);
  }
  if (summary.additional_nonzero_rule_count) {
    parts.push(`${summary.additional_nonzero_rule_count} additional scoring rule${summary.additional_nonzero_rule_count === 1 ? '' : 's'}`);
  }
  return parts.join(' · ');
}

function positionSort(a: ReviewPlayer, b: ReviewPlayer) {
  const aIndex = POSITION_ORDER.indexOf(a.position ?? '');
  const bIndex = POSITION_ORDER.indexOf(b.position ?? '');
  return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex) || a.name.localeCompare(b.name);
}

export default function TiberDraftReview() {
  const search = useSearch();
  const query = new URLSearchParams(search);
  const initialInput = query.get('sleeper_input') ?? query.get('sleeper_url') ?? '';
  const [sleeperInput, setSleeperInput] = useState(initialInput);
  const [teamSelection, setTeamSelection] = useState<TeamSelection | null>(null);
  const [review, setReview] = useState<DraftReview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<'link' | 'context' | 'comparison' | null>(null);
  const [discussionError, setDiscussionError] = useState('');
  const [study, setStudy] = useState<StudyAttachment | null>(null);
  const [copyError, setCopyError] = useState('');
  const [waivers, setWaivers] = useState<WaiverAttachment | null>(null);
  const requestSequence = useRef(0);
  const copySequence = useRef(0);
  const handledSearch = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateStudy = useCallback((next: StudyAttachment) => {
    ++copySequence.current;
    setStudy(next);
    setCopied(null);
    setDiscussionError('');
    setCopyError('');
  }, []);

  const updateWaivers = useCallback((next: WaiverAttachment | null) => {
    ++copySequence.current; setWaivers(next); setCopied(null); setCopyError(''); setDiscussionError('');
  }, []);

  function mayDiscardStudy() {
    const context = study?.operator_context;
    return !(context?.note || context?.preferred_player_id || study?.hypothetical_roster)
      || window.confirm('Your hypothetical roster is only on this page. Copy agent context to keep it. Continue and clear this study?');
  }

  function navigateInput(value: string) {
    if (!mayDiscardStudy()) return;
    const next = new URL(window.location.href);
    next.search = '';
    if (value.trim()) next.searchParams.set('sleeper_input', value.trim());
    if (next.search === window.location.search) void resolveInput(value);
    else window.history.pushState({}, '', next);
  }

  async function loadReview(url: string) {
    const value = url.trim();
    if (!value) return;
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError('');
    setReview(null);
    setStudy(null);
    setWaivers(null);
    setCopied(null);
    setDiscussionError('');
    setCopyError('');
    try {
      const response = await fetch(`/api/draft-review?sleeper_url=${encodeURIComponent(value)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `TIBER could not read this roster (HTTP ${response.status}).`);
      if (requestSequence.current !== requestId) return;
      setReview(payload as DraftReview);
      setTeamSelection(null);
      setSleeperInput((payload as DraftReview).input.canonicalUrl);
      const next = new URL(window.location.href);
      next.searchParams.delete('sleeper_input');
      next.searchParams.set('sleeper_url', (payload as DraftReview).input.canonicalUrl);
      handledSearch.current = next.search;
      window.history.replaceState({}, '', next);
    } catch (caught) {
      if (requestSequence.current === requestId) {
        setError(caught instanceof Error ? caught.message : 'TIBER could not read this roster.');
      }
    } finally {
      if (requestSequence.current === requestId) setLoading(false);
    }
  }

  async function resolveInput(input = sleeperInput) {
    const value = input.trim();
    if (!value) return;
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError('');
    setReview(null);
    setStudy(null);
    setWaivers(null);
    setCopied(null);
    setDiscussionError('');
    setCopyError('');
    setTeamSelection(null);
    try {
      const response = await fetch(`/api/draft-review/resolve?sleeper_input=${encodeURIComponent(value)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `TIBER could not read this Sleeper input (HTTP ${response.status}).`);
      if (requestSequence.current !== requestId) return;
      const resolution = payload as InputResolution;
      if (resolution.status === 'roster_resolved') {
        await loadReview(resolution.canonicalUrl);
        return;
      }
      setTeamSelection(resolution);
    } catch (caught) {
      if (requestSequence.current === requestId) {
        setError(caught instanceof Error ? caught.message : 'TIBER could not read this Sleeper input.');
      }
    } finally {
      if (requestSequence.current === requestId) setLoading(false);
    }
  }

  useEffect(() => {
    if (handledSearch.current === search) return;
    handledSearch.current = search;
    setSleeperInput(initialInput);
    if (initialInput) void resolveInput(initialInput);
    else {
      ++requestSequence.current;
      setReview(null);
      setStudy(null);
    setWaivers(null);
      setTeamSelection(null);
      setLoading(false);
      setError('');
      setCopied(null);
      setDiscussionError('');
      setCopyError('');
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => () => { ++requestSequence.current; handledSearch.current = null; }, []);

  const rosterGroups = useMemo(() => {
    if (!review) return [];
    return STATE_ORDER.map((state) => ({
      state,
      players: review.observed.current_roster.filter((player) => player.roster_state === state).sort(positionSort),
    }));
  }, [review]);
  const readableScoring = useMemo(() => review ? scoringSummary(review) : null, [review]);

  async function copyContext(kind: 'link' | 'context' | 'comparison') {
    if (!review) return;
    const requestId = requestSequence.current;
    const copyId = ++copySequence.current;
    try {
      const link = new URL('/team', window.location.origin);
      link.searchParams.set('sleeper_url', review.input.canonicalUrl);
      await navigator.clipboard.writeText(kind === 'link' ? link.href : JSON.stringify(kind === 'comparison' ? draftReviewComparisonPacket(review, study, waivers) : draftReviewAgentPacket(review, study, waivers), null, 2));
      if (requestId !== requestSequence.current || copyId !== copySequence.current) return;
      setCopyError('');
      setDiscussionError('');
      setCopied(kind);
    } catch {
      if (requestId === requestSequence.current && copyId === copySequence.current) {
        setCopied(null);
        if (kind === 'comparison') setDiscussionError('Could not copy. Check clipboard access and try again.');
        else setCopyError('Could not copy. Check clipboard access and try again.');
      }
    }
  }

  return (
    <div className="drp-page">
      <section className="drp-hero">
        <div className="drp-kicker">Your Sleeper companion</div>
        <h1>TIBER Team</h1>
        <p>
          Read your roster, compare players and bring the context to your agent.
          Start with a public Sleeper league, draft or roster link—or a league ID.
        </p>

        <form className="drp-input-row" onSubmit={(event) => { event.preventDefault(); navigateInput(sleeperInput); }}>
          <label className="sr-only" htmlFor="sleeper-roster-url">Sleeper link or league ID</label>
          <input
            id="sleeper-roster-url"
            ref={inputRef}
            value={sleeperInput}
            onChange={(event) => setSleeperInput(event.target.value)}
            placeholder={EXAMPLE}
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <button type="submit" disabled={!sleeperInput.trim() || loading}>
            {loading ? <Loader2 size={16} className="drp-spin" /> : null}
            {loading ? 'Reading…' : 'Load roster'}
          </button>
        </form>
        <div className="drp-input-note">Public Sleeper data only · choose a roster, not an authenticated owner · no roster actions</div>
        {error ? <div className="drp-error" role="alert">{error}</div> : null}
        {error ? <button className="drp-action" type="button" onClick={() => void resolveInput()}>Try again</button> : null}
        {loading ? <p role="status">Reading public Sleeper context…</p> : null}
      </section>

      {teamSelection ? (
        <section className="drp-team-select" aria-live="polite" aria-busy={loading}>
          <div>
            <div className="drp-kicker">Observed public league</div>
            <h2>Choose a roster</h2>
            <p>{teamSelection.league.name} · {teamSelection.league.total_rosters} teams · {teamSelection.league.season}</p>
          </div>
          <div className="drp-team-options">
            {teamSelection.teams.map((team) => (
              <button type="button" key={team.roster_id} disabled={loading} onClick={() => navigateInput(team.canonicalUrl)}>
                <strong>{team.display_name}</strong>
                <span>{team.manager_name ? `${team.manager_name} · Roster ${team.roster_id}` : `Roster ${team.roster_id}`}</span>
              </button>
            ))}
          </div>
          {!teamSelection.teams.length ? <p role="status">No rosters were reported for this league. Try again or enter another league.</p> : null}
          <p className="drp-boundary">Selecting a roster identifies what to review. It does not verify account ownership.</p>
        </section>
      ) : null}

      {!review && !loading && !teamSelection ? (
        <section className="drp-empty">
          <div>
            <span className="drp-step">01</span>
            <h2>Enter Sleeper context</h2>
            <p>Use a roster link, draft link or league ID. No shared account state is consulted.</p>
          </div>
          <div>
            <span className="drp-step">02</span>
            <h2>Inspect the evidence</h2>
            <p>Choose a public roster, then keep observations separate from derivations and unavailable models.</p>
          </div>
          <div>
            <span className="drp-step">03</span>
            <h2>Continue with an agent</h2>
            <p>Copy the compiled packet into ChatGPT or Claude for a conversational decision review.</p>
          </div>
        </section>
      ) : null}

      {review ? (
        <div className="drp-results">
          <section className="drp-team-heading">
            <div>
              <div className="drp-kicker">Observed Sleeper context</div>
              <h2>{review.observed.team.display_name}</h2>
              <p>{review.observed.league.name} · {review.observed.league.season} · Roster {review.observed.team.roster_id}{review.observed.team.manager_name ? ` · ${review.observed.team.manager_name}` : ''}</p>
            </div>
            <span className="drp-status"><Check size={14} /> Read successfully</span>
          </section>

          <section className="drp-team-tools" aria-label="Roster actions and sharing">
            <div className="drp-actions">
              <button type="button" onClick={() => { if (mayDiscardStudy()) void loadReview(review.input.canonicalUrl); }}>Refresh roster</button>
              <button type="button" onClick={() => navigateInput(review.input.leagueId)}>Change roster</button>
              <button type="button" onClick={() => navigateInput('')}>Change league</button>
              <button type="button" onClick={() => void copyContext('link')}>Copy roster link</button>
              <button type="button" onClick={() => void copyContext('context')}><Clipboard size={16} /> Copy agent context</button>
            </div>
            <p className="drp-muted">The link opens the latest public roster; it carries no study. Agent context copies this snapshot, selected evidence and any optional roster scenario. Keep preferences and hypotheses in your agent conversation.</p>
            <p className="drp-muted">Refresh reads Sleeper again; player details may be cached for up to 24 hours. Refreshing or changing rosters clears the study.</p>
            <p role="status">{copied === 'link' ? 'Roster link copied' : copied === 'context' ? 'Agent context copied' : ''}</p>
            {copyError ? <p role="alert" className="drp-error">{copyError}</p> : null}
          </section>

          <section className="drp-summary-grid" aria-label="League summary">
            <article>
              <span>Format</span>
              <strong>{review.observed.league.total_rosters}-team {formatScoring(review.observed.league.scoring_format)} · {review.observed.league.league_mode}</strong>
              {readableScoring ? <small>{readableScoring}</small> : null}
            </article>
            <article><span>Configured starting slots</span><strong>{lineupSummary(review.observed.league.lineup_slots) || 'Not reported'}</strong></article>
            <article><span>Roster state</span><strong>{review.derived.starter_count} starters · {review.derived.bench_count} bench{review.observed.league.reserve && (review.observed.league.reserve.configured_slots > 0 || review.observed.league.reserve.occupied_slots > 0) ? ` · ${review.observed.league.reserve.occupied_slots}/${review.observed.league.reserve.configured_slots} reserve` : ''}</strong></article>
            <article><span>Compiled at</span><strong>{new Date(review.generated_at).toLocaleString()}</strong></article>
          </section>

          <section className="drp-two-column">
            <article className="drp-panel">
              <div className="drp-panel-heading">
                <div><span className="drp-label observed">Observed</span><h3>Current roster</h3></div>
                <span>{review.derived.roster_count} players</span>
              </div>
              <p className="drp-muted">Starter membership is reported by Sleeper; individual lineup slot assignments are not available here.</p>
              {rosterGroups.map((group) => (
                <div className="drp-roster-group" key={group.state}>
                  <h4>{STATE_LABELS[group.state]} · {group.players.length}</h4>
                  {!group.players.length ? <p className="drp-muted">None reported</p> : null}
                  <div className="drp-player-list">
                    {group.players.map((player) => (
                      <div className="drp-player" key={player.player_id}>
                        <span className="drp-position">{player.position ?? '—'}</span>
                        <strong>{player.name}</strong>
                        <span>{player.team ?? 'Unknown'}</span>
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
                ) : <p className="drp-muted">No deterministic roster-shape flags are active.</p>}
                <p className="drp-boundary">Counts describe construction. They do not prove that a player should be traded, held or waived.</p>
                {review.observed.league.reserve ? (
                  <div className="drp-boundary">
                    <h4>Reserve rules reported by Sleeper</h4>
                    <p>{review.observed.league.reserve.occupied_slots} occupied · {review.observed.league.reserve.open_slots} open · {review.observed.league.reserve.configured_slots} configured</p>
                    <dl className="drp-reserve-rules">{Object.entries(review.observed.league.reserve.configured_eligibility).map(([rule, value]) => (
                      <div key={rule}><dt>{rule.replace(/_/g, ' ')}</dt><dd>{value === null ? 'Unknown' : value ? 'Allowed' : 'Not allowed'}</dd></div>
                    ))}</dl>
                    <p>Current player eligibility is unavailable. These settings do not establish that a player is eligible or approve a roster move.</p>
                  </div>
                ) : <p className="drp-boundary">Reserve configuration unavailable.</p>}
                <p className="drp-boundary">Bye-week geometry: {review.derived.bye_week_geometry.reason}</p>
              </article>

              <article className="drp-panel drp-forecast">
                <div className="drp-panel-heading">
                  <div><span className="drp-label unavailable">Unavailable</span><h3>Forecast lens</h3></div>
                </div>
                <p>{review.forecast.reason}</p>
              </article>
            </div>
          </section>

          <DraftReviewData key={`data:${reviewScope(review)}`} review={review} />

          <DraftReviewEvidenceStudy key={reviewScope(review)} review={review} onChange={updateStudy} onDiscuss={() => void copyContext('comparison')} discussionStatus={copied === 'comparison' ? 'Comparison context copied' : ''} discussionError={discussionError} />

          <DraftReviewWaivers key={`waivers:${reviewScope(review)}`} review={review} onChange={updateWaivers} />
          <DraftReviewTeExplorer key={`te:${reviewScope(review)}`} review={review} />

          {review.observed.draft.status === 'available' ? (
            <details className="drp-panel">
              <summary>Original draft · {review.observed.draft.picks.length} selections</summary>
              <div className="drp-panel-heading">
                <div><span className="drp-label observed">Observed</span><h3>Original draft</h3></div>
                <span>
                  {review.observed.draft.picks.length} selections
                  {review.observed.draft.pick_timer_seconds ? ` · ${review.observed.draft.pick_timer_seconds}s timer` : ''}
                  {review.observed.draft.team_draft_slot ? ` · slot ${review.observed.draft.team_draft_slot}` : ''}
                </span>
              </div>
              {review.observed.draft.full_board?.length ? (
                <p className="drp-boundary">The agent packet includes all {review.observed.draft.full_board.length} observed room selections for counterfactual and turn-distance review.</p>
              ) : null}
              <div className="drp-draft-grid">
                {review.observed.draft.picks.map((pick) => (
                  <div className="drp-draft-pick" key={`${pick.pick_no}-${pick.player_id}`}>
                    <span>{pick.round}.{String(pick.pick_no - ((pick.round - 1) * review.observed.league.total_rosters)).padStart(2, '0')}</span>
                    <strong>{pick.name}</strong>
                    <small>{pick.position ?? '—'} · {pick.team ?? 'Unknown'}</small>
                  </div>
                ))}
              </div>
            </details>
          ) : (
            <section className="drp-panel drp-draft-unavailable">
              <div className="drp-panel-heading">
                <div><span className="drp-label unavailable">Unavailable</span><h3>Original draft</h3></div>
              </div>
              <p>{review.observed.draft.reason ?? 'Sleeper draft evidence was unavailable at request time.'}</p>
              <p className="drp-boundary">The current roster remains observed. TIBER has not inferred missing draft selections from roster membership.</p>
            </section>
          )}

          <footer className="drp-footer">
            <span>TIBER prepares the decision. The human manager makes it.</span>
            <a href={review.input.canonicalUrl} target="_blank" rel="noreferrer">Open source roster <ArrowRight size={14} /></a>
          </footer>
        </div>
      ) : null}
    </div>
  );
}
