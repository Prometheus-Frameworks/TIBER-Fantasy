import { z } from 'zod';

// Paper transport only, distinct from #355 durable records; no schema freeze.
const fixtureId = z.string().regex(/^fixture:[a-z0-9_-]+$/).max(96);
const count = z.number().int().min(0).max(128);
export const PaperPlayerSchema = z.object({
  player_id: fixtureId,
  position: z.enum(['QB', 'RB', 'WR', 'TE']).nullable(),
  container: z.enum(['starter', 'bench', 'reserve', 'taxi']),
}).strict();

const lineup = z.object({
  QB: count.optional(), RB: count.optional(), WR: count.optional(), TE: count.optional(),
  FLEX: count.optional(), WRRB_FLEX: count.optional(), REC_FLEX: count.optional(), SUPER_FLEX: count.optional(),
}).strict().refine(slots => Object.values(slots).some(n => (n ?? 0) > 0));
const rules = z.object({
  ordinary_capacity: count,
  reserve_capacity: count,
  taxi_capacity: count,
  lineup,
}).strict();
const roster = z.object({
  roster_id: fixtureId,
  players: z.array(PaperPlayerSchema).max(128),
}).strict();
export const PaperTradeGeometryInputSchema = z.object({
  schema_id: z.literal('tiber.trade-study.paper-geometry-input.v0'),
  mode: z.literal('isolated_paper'),
  league_id: fixtureId,
  rules,
  operator_roster: roster,
  counterparty_roster: roster,
  package: z.object({
    operator_gives: z.array(fixtureId).min(1).max(16),
    operator_receives: z.array(fixtureId).min(1).max(16),
  }).strict(),
}).strict();
export type PaperPlayer = z.infer<typeof PaperPlayerSchema>;
export type PaperTradeGeometryInput = z.infer<typeof PaperTradeGeometryInputSchema>;

export const PaperLeagueScreenInputSchema = z.object({
  schema_id: z.literal('tiber.trade-study.paper-league-screen-input.v0'),
  mode: z.literal('isolated_paper'),
  league_id: fixtureId,
  operator_roster_id: fixtureId,
  rosters: z.array(roster).min(2).max(32),
  // Explicit operator filter, not a learned surplus or willingness threshold.
  filter: z.object({ position: z.enum(['QB', 'RB', 'WR', 'TE']), minimum_ordinary_players: z.number().int().min(1).max(16) }).strict(),
}).strict();
export type PaperLeagueScreenInput = z.infer<typeof PaperLeagueScreenInputSchema>;
