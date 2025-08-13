import { z } from 'zod';

// Core OLC team data structure
export const OlcTeamWeekSchema = z.object({
  teamId: z.string(),
  season: z.number(),
  week: z.number(),
  olc_100: z.number().min(0).max(100),
  olc_raw: z.number(),
  cohesion_score: z.number(),
  cohesion_z: z.number(),
  injury_penalty: z.number(),
  shuffle_penalty: z.number(),
  green_penalty: z.number(),
  total_penalty: z.number(),
  scale_k: z.number(),
  sigma: z.number(),
  components: z.object({
    pff_pb: z.number(),
    espn_pbwr: z.number(),
    espn_rbwr: z.number(),
    pressure_rate: z.number(),
    adjusted_sack_rate: z.number(),
    ybc_per_rush: z.number(),
  }),
  adjusters: z.object({
    qb_env: z.number(),
    rb_runways: z.number(),
    wrte_timing: z.number(),
  }),
  opponent_context: z.object({
    pass_context_w: z.number(),
    run_context_w: z.number(),
    def_pass_rush_strength: z.number(),
    def_run_stuff_rate: z.number(),
  }),
  meta: z.object({
    pos_continuity: z.number(),
    pair_continuity: z.number(),
    snap_sync: z.number(),
    injury_penalty_breakdown: z.array(z.object({
      position: z.string(),
      penalty: z.number(),
      reason: z.string(),
    })),
  }),
});

export type OlcTeamWeek = z.infer<typeof OlcTeamWeekSchema>;

// Position weights and multipliers
export const POSITION_WEIGHTS = {
  LT: 0.28,
  C: 0.22,
  RT: 0.18,
  LG: 0.16,
  RG: 0.16,
} as const;

export const INJURY_MULTIPLIERS = {
  LT: 1.5,
  C: 1.3,
  RT: 1.2,
  LG: 1.0,
  RG: 1.0,
} as const;

// Cohesion calculation schema
export const CohesionDataSchema = z.object({
  position_continuity: z.record(z.number()),
  pair_continuity: z.object({
    'LT-LG': z.number(),
    'LG-C': z.number(),
    'C-RG': z.number(),
    'RG-RT': z.number(),
  }),
  snap_sync: z.number(),
  shared_snaps: z.number(),
  league_max_snaps: z.number(),
});

export type CohesionData = z.infer<typeof CohesionDataSchema>;

// Export OlDepthChart type for other modules
export interface OlDepthChart {
  LT: { player_id: string; snaps: number; is_starter: boolean }[];
  LG: { player_id: string; snaps: number; is_starter: boolean }[];
  C: { player_id: string; snaps: number; is_starter: boolean }[];
  RG: { player_id: string; snaps: number; is_starter: boolean }[];
  RT: { player_id: string; snaps: number; is_starter: boolean }[];
}

// API request/response schemas
export const OlcTeamRequestSchema = z.object({
  teamId: z.string(),
  week: z.number().optional(),
  season: z.number().optional(),
});

export const OlcPlayerRequestSchema = z.object({
  playerId: z.string(),
  week: z.number().optional(),
  season: z.number().optional(),
});

export const OlcRebuildRequestSchema = z.object({
  season: z.number(),
  weeks: z.array(z.number()).optional(),
  force: z.boolean().optional(),
});

export type OlcTeamRequest = z.infer<typeof OlcTeamRequestSchema>;
export type OlcPlayerRequest = z.infer<typeof OlcPlayerRequestSchema>;
export type OlcRebuildRequest = z.infer<typeof OlcRebuildRequestSchema>;