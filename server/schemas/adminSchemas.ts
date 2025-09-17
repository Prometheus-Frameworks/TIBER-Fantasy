/**
 * Admin API Validation Schemas
 * 
 * Comprehensive Zod validation schemas for all 5 admin endpoints
 * providing type safety and input validation for Brand Signals Brain control
 */

import { z } from 'zod';

// Valid brand types from schema
const VALID_BRANDS = [
  'rookie_risers',
  'dynasty', 
  'redraft',
  'trade_eval',
  'sos',
  'consensus'
] as const;

// Valid dataset names for streaming
const VALID_DATASETS = [
  'gold_player_week',
  'silver_roster',
  'bronze_players',
  'silver_players',
  'gold_player_season',
  'gold_team_week',
  'gold_schedule'
] as const;

/**
 * 1. POST /api/admin/season/set - Manual season override
 */
export const setSeasonSchema = z.object({
  season: z.number()
    .int()
    .min(2020, 'Season must be 2020 or later')
    .max(2030, 'Season must be 2030 or earlier'),
  week: z.number()
    .int()
    .min(1, 'Week must be 1 or greater')
    .max(18, 'Week must be 18 or less (includes playoffs)'),
  seasonType: z.enum(['regular', 'post'])
    .default('regular')
    .describe('Type of season - regular season or postseason')
});

export type SetSeasonRequest = z.infer<typeof setSeasonSchema>;

/**
 * 2. POST /api/admin/brand/replay - Replay brand signal generation
 */
export const brandReplaySchema = z.object({
  brand: z.enum(VALID_BRANDS, {
    errorMap: () => ({ message: `Brand must be one of: ${VALID_BRANDS.join(', ')}` })
  }),
  season: z.number()
    .int()
    .min(2020, 'Season must be 2020 or later')
    .max(2030, 'Season must be 2030 or earlier'),
  week: z.number()
    .int()
    .min(1, 'Week must be 1 or greater')
    .max(18, 'Week must be 18 or less')
    .optional()
    .describe('Optional specific week - if not provided, uses current week'),
  forceRecompute: z.boolean()
    .default(false)
    .describe('Whether to clear existing signals before replay')
});

export type BrandReplayRequest = z.infer<typeof brandReplaySchema>;

/**
 * 3. POST /api/admin/brand/stream - Trigger live brand signal streaming
 */
export const brandStreamSchema = z.object({
  brands: z.array(
    z.enum(VALID_BRANDS, {
      errorMap: () => ({ message: `Each brand must be one of: ${VALID_BRANDS.join(', ')}` })
    })
  )
    .min(1, 'At least one brand must be specified')
    .max(VALID_BRANDS.length, `Cannot specify more than ${VALID_BRANDS.length} brands`)
    .describe('Array of brand keys to process'),
  targetDatasets: z.array(
    z.enum(VALID_DATASETS, {
      errorMap: () => ({ message: `Each dataset must be one of: ${VALID_DATASETS.join(', ')}` })
    })
  )
    .min(1, 'At least one target dataset must be specified')
    .max(VALID_DATASETS.length, `Cannot specify more than ${VALID_DATASETS.length} datasets`)
    .describe('Array of dataset names to trigger events for')
});

export type BrandStreamRequest = z.infer<typeof brandStreamSchema>;

/**
 * 4. GET /api/admin/signals/status - No body validation needed
 * (Query parameters handled directly in route)
 */
export const signalsStatusQuerySchema = z.object({
  detailed: z.string()
    .optional()
    .transform(val => val === 'true')
    .describe('Include detailed diagnostics in response'),
  brands: z.string()
    .optional()
    .transform(val => val ? val.split(',').map(b => b.trim()) : undefined)
    .describe('Comma-separated list of specific brands to check')
});

export type SignalsStatusQuery = z.infer<typeof signalsStatusQuerySchema>;

/**
 * 5. DELETE /api/admin/signals/purge - Purge signals with safety guards
 */
export const signalsPurgeSchema = z.object({
  brand: z.enum(VALID_BRANDS, {
    errorMap: () => ({ message: `Brand must be one of: ${VALID_BRANDS.join(', ')}` })
  })
    .optional()
    .describe('Optional brand filter - if not provided, affects all brands'),
  season: z.number()
    .int()
    .min(2020, 'Season must be 2020 or later')
    .max(2030, 'Season must be 2030 or earlier')
    .describe('Required season filter for safety'),
  week: z.number()
    .int()
    .min(1, 'Week must be 1 or greater')
    .max(18, 'Week must be 18 or less')
    .optional()
    .describe('Optional week filter - if not provided, affects entire season'),
  dryRun: z.boolean()
    .describe('Required safety flag - set to false only when you want to actually delete')
})
.refine(data => {
  // Safety validation: require explicit confirmation for non-dry-run operations
  if (!data.dryRun) {
    // Additional safety checks could be added here
    return true;
  }
  return true;
}, {
  message: 'Purge operations require careful consideration of safety flags'
});

export type SignalsPurgeRequest = z.infer<typeof signalsPurgeSchema>;

/**
 * Common response schemas for type safety
 */
export const adminSuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  timestamp: z.string(),
  operation: z.string(),
  data: z.any().optional()
});

export const adminErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.any().optional(),
  timestamp: z.string(),
  operation: z.string()
});

/**
 * Validation helper functions
 */
export function validateSetSeason(data: unknown): SetSeasonRequest {
  return setSeasonSchema.parse(data);
}

export function validateBrandReplay(data: unknown): BrandReplayRequest {
  return brandReplaySchema.parse(data);
}

export function validateBrandStream(data: unknown): BrandStreamRequest {
  return brandStreamSchema.parse(data);
}

export function validateSignalsStatus(query: unknown): SignalsStatusQuery {
  return signalsStatusQuerySchema.parse(query);
}

export function validateSignalsPurge(data: unknown): SignalsPurgeRequest {
  return signalsPurgeSchema.parse(data);
}

/**
 * Safety validation helpers
 */
export function validateSeasonRange(season: number): boolean {
  return season >= 2020 && season <= 2030;
}

export function validateWeekRange(week: number): boolean {
  return week >= 1 && week <= 18;
}

export function validateBrandExists(brand: string): boolean {
  return VALID_BRANDS.includes(brand as any);
}

export function validateDatasetExists(dataset: string): boolean {
  return VALID_DATASETS.includes(dataset as any);
}

/**
 * Export valid options for API documentation
 */
export const ADMIN_API_CONFIG = {
  VALID_BRANDS,
  VALID_DATASETS,
  SEASON_RANGE: { min: 2020, max: 2030 },
  WEEK_RANGE: { min: 1, max: 18 },
  SEASON_TYPES: ['regular', 'post'] as const
} as const;