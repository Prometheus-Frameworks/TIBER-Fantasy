import { z } from 'zod';
import { leagueSeason } from '../../../shared/teamLeagues';

/** Sleeper `GET /state/nfl` as observed by the personal readers: season, phase and current leg. */
export const nflStateSchema = z.object({ season: leagueSeason, season_type: z.string(), leg: z.number().int().min(0).max(22) });
