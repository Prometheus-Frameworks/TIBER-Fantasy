import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getPersonnelProfile, getPersonnelProfiles } from '../modules/personnel/personnelService';

const router = Router();

const querySchema = z.object({
  season: z.coerce.number().int().min(1999),
  weekStart: z.coerce.number().int().min(1).max(18).optional(),
  weekEnd: z.coerce.number().int().min(1).max(18).optional(),
  playerId: z.string().regex(/^\d{2}-\d{7}$/).optional(),
  team: z.string().min(2).max(3).optional(),
  position: z.enum(['WR', 'RB', 'TE', 'QB']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

router.get('/profile', async (req: Request, res: Response) => {
  try {
    const parsed = querySchema.parse(req.query);

    const baseQuery = {
      season: parsed.season,
      weekStart: parsed.weekStart,
      weekEnd: parsed.weekEnd,
      team: parsed.team,
      position: parsed.position,
      limit: parsed.limit,
    };

    if (parsed.playerId) {
      const profile = await getPersonnelProfile({
        ...baseQuery,
        playerIds: [parsed.playerId],
      });

      if (!profile) {
        return res.status(404).json({ error: 'Player profile not found for query scope' });
      }

      return res.json(profile);
    }

    const profiles = await getPersonnelProfiles(baseQuery);
    return res.json(profiles);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }

    console.error('[PersonnelRoutes] Failed to generate personnel profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
