import { z } from 'zod';
import type { HistoricalEvidence } from './draftReviewEvidence';
import { draftReviewAgentPacket } from './draftReviewStudy';

const clock = z.string().datetime();
const playerId = z.string().regex(/^\d{1,24}$/);
export const unrosteredTesSchema = z.object({
  schema_version: z.literal('tiber_team_unrostered_tes_v1'),
  status: z.literal('available'),
  input: z.object({ leagueId: z.string().regex(/^\d{1,32}$/), rosterId: z.number().int().positive(), canonicalUrl: z.string() }),
  season: z.string().regex(/^\d{4}$/),
  observations: z.object({
    league_received_at: clock, rosters_received_at: clock, directory_fetched_at: clock,
    directory_source_updated_at: z.null(), directory_cache_max_age_hours: z.literal(24),
    expected_rosters: z.number().int().min(1).max(64), received_rosters: z.number().int().min(1).max(64),
    source_urls: z.array(z.string().url()).length(3),
  }),
  derivation: z.literal('directory_primary_position_TE_minus_all_league_membership'),
  claim_eligibility: z.literal('unknown'),
  trends: z.object({ status: z.enum(['available', 'unavailable']), received_at: clock.nullable(), lookback_hours: z.literal(24), limit: z.literal(1000), source_url: z.literal('https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=1000'), counts: z.record(playerId, z.number().int().nonnegative().safe()) }).optional(),
  candidates: z.array(z.object({
    player_id: playerId, name: z.string().max(120), position: z.literal('TE'),
    team: z.string().max(120).nullable(), status: z.string().max(120).nullable(), active: z.boolean().nullable(),
  })).max(1024),
}).superRefine((value, ctx) => {
  if (value.observations.expected_rosters !== value.observations.received_rosters
      || new Set(value.candidates.map(p => p.player_id)).size !== value.candidates.length
      || value.input.canonicalUrl !== `https://sleeper.com/roster/${value.input.leagueId}/${value.input.rosterId}`) {
    ctx.addIssue({ code: 'custom', message: 'Invalid availability scope or completeness.' });
  }
});
export type UnrosteredTes = z.infer<typeof unrosteredTesSchema>;
export type TeCandidateHistory = {
  player_id: string; status: 'available' | 'unavailable'; reason: string | null; evidence: HistoricalEvidence | null;
};
type RosterContext = {
  input: { canonicalUrl: string; leagueId: string; rosterId: number }; generated_at: string;
  observed: { league: { season: string } };
};
export function matchesTeScope(review: RosterContext, result: UnrosteredTes) {
  return review.input.canonicalUrl === result.input.canonicalUrl
    && review.input.leagueId === result.input.leagueId && review.input.rosterId === result.input.rosterId
    && review.observed.league.season === result.season;
}

/** New explicit handoff only. Existing roster and comparison packet shapes are unchanged. */
export function draftReviewTeCandidatePacket<T extends RosterContext>(review: T, result: UnrosteredTes, selectedId: string, history: TeCandidateHistory) {
  const availability = unrosteredTesSchema.parse(result);
  const candidate = availability.candidates.find(p => p.player_id === selectedId);
  if (!matchesTeScope(review, availability) || !candidate || history.player_id !== selectedId
      || (history.evidence?.players.some(p => p.player_id !== selectedId))
      || (history.status === 'available' && (!history.evidence || history.evidence.status !== 'available'
        || history.evidence.players.length !== 1))) throw new Error('Candidate context no longer matches this roster.');
  const base = draftReviewAgentPacket(review, null);
  return {
    ...base,
    instruction: `${base.instruction} Discuss candidate_exploration.selected_candidate for this league. Unrostered is derived from the recorded league membership response, not proof of claim eligibility or availability now. Roster context and candidate availability have separate observation clocks and are not an atomic snapshot. Sleeper add activity is platform-wide observed activity, not a projection, recommendation or league claim eligibility; absence from the bounded trend response is unknown, not zero. Ask the manager about their decision and time horizon. Do not infer injury clearance, playing-time opportunity, a recommended add/drop, or a completed action. No saved operator context was retrieved.`,
    candidate_exploration: {
      schema_version: 'tiber_team_te_candidate_handoff_v1',
      input: availability.input, season: availability.season,
      observations: availability.observations,
      add_activity: availability.trends ? { ...availability.trends, counts: undefined, selected_player_count: availability.trends.counts[selectedId] ?? null } : null,
      derived: { method: availability.derivation, selected_player_unrostered_when_checked: true },
      selected_candidate: candidate, claim_eligibility: 'unknown', historical: history,
      forecast: { status: 'unavailable', fabricated_values: false },
    },
  };
}

const nflTeams = new Set('ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' '));
export function isCurrentTeamTe(player: UnrosteredTes['candidates'][number]) {
  return player.active === true && player.team !== null && nflTeams.has(player.team);
}
