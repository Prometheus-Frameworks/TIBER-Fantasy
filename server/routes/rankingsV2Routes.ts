import { Router, Request, Response } from 'express';
import {
  RANKINGS_V2_CONTRACT_VERSION,
  rankingsV2ResponseSchema,
  RankingsV2Item,
  RankingsV2PillarNote,
} from '../contracts/rankingsV2';
import { CACHE_VERSION, getGradesFromCache } from '../modules/forge/forgeGradeCache';

type SupportedPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'ALL';
const CACHE_EMPTY_STATUS = 'forge_cache_empty_uncomputed';

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function buildPillarNotes(row: any): RankingsV2PillarNote[] {
  const pillars: Array<{ pillar: string; value: unknown }> = [
    { pillar: 'volume', value: row.volumeScore },
    { pillar: 'efficiency', value: row.efficiencyScore },
    { pillar: 'team_context', value: row.teamContextScore },
    { pillar: 'stability', value: row.stabilityScore },
  ];

  return pillars
    .map(({ pillar, value }) => {
      const numericValue = toNumberOrNull(value);
      if (numericValue === null) return null;
      return { pillar, note: numericValue.toFixed(1), impact: 'neutral' as const };
    })
    .filter((note): note is RankingsV2PillarNote => note !== null);
}

export function mapForgeCacheRowToRankingsV2Item(row: any, rank: number, asOfIso: string): RankingsV2Item {
  const confidence = toNumberOrNull(row.confidence);
  const gamesPlayed = toNumberOrNull(row.gamesPlayed);
  const trajectory =
    row.trajectory === 'rising' || row.trajectory === 'flat' || row.trajectory === 'declining' ? row.trajectory : null;
  const footballLensIssues = Array.isArray(row.footballLensIssues)
    ? row.footballLensIssues.filter((issue: unknown): issue is string => typeof issue === 'string')
    : null;
  const lensAdjustment = toNumberOrNull(row.lensAdjustment);

  return {
    rank,
    playerId: String(row.playerId ?? ''),
    playerName: String(row.playerName ?? 'Unknown Player'),
    position: typeof row.position === 'string' ? row.position : null,
    team: typeof row.nflTeam === 'string' ? row.nflTeam : null,
    tier: typeof row.tier === 'string' ? row.tier : null,
    score: toNumberOrNull(row.alpha),
    value: toNumberOrNull(row.rawAlpha),
    explanation: {
      placementSummary:
        typeof row.tier === 'string' && typeof row.alpha === 'number'
          ? `Tier ${row.tier} based on current FORGE alpha (${row.alpha.toFixed(1)}).`
          : null,
      pillarNotes: buildPillarNotes(row),
      contextAdjustments: [],
      fragilityNotes: [],
      sustainabilityNotes: [],
    },
    trust: {
      confidence,
      asOf: asOfIso,
      freshnessNote: 'Backed by FORGE grade cache.',
      sampleNote: gamesPlayed === null ? null : `Games played: ${gamesPlayed}.`,
      stabilityNote: trajectory ? `Trajectory: ${trajectory}.` : null,
    },
    // Transitional /tiers consumer support (phase-1): explicit typed fields while v2 explanation surface matures.
    uiMeta: {
      subscores: {
        volume: toNumberOrNull(row.volumeScore),
        efficiency: toNumberOrNull(row.efficiencyScore),
        teamContext: toNumberOrNull(row.teamContextScore),
        stability: toNumberOrNull(row.stabilityScore),
      },
      confidence,
      gamesPlayed,
      trajectory,
      footballLensIssues,
      lensAdjustment,
    },
  };
}

export function createRankingsV2Router(): Router {
  const router = Router();

  // CANONICAL public weekly Rankings v2 surface for /tiers and future public consumers.
  router.get('/weekly', async (req: Request, res: Response) => {
    try {
      const season = parseInt(req.query.season as string, 10) || 2025;
      const asOfWeekParam = req.query.asOfWeek as string | undefined;
      const asOfWeek = asOfWeekParam ? parseInt(asOfWeekParam, 10) : undefined;
      const position = ((req.query.position as string) || 'ALL').toUpperCase() as SupportedPosition;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 300);

      if (!['QB', 'RB', 'WR', 'TE', 'ALL'].includes(position)) {
        return res.status(400).json({ error: 'Invalid position. Use QB, RB, WR, TE, or ALL.' });
      }

      const cache = await getGradesFromCache(season, asOfWeek, position, limit, CACHE_VERSION);
      const derivedAsOf = toIso(cache.computedAt) ?? new Date().toISOString();
      const isCacheEmpty = cache.players.length === 0;

      const items = cache.players.map((row: any, idx: number) => mapForgeCacheRowToRankingsV2Item(row, idx + 1, derivedAsOf));

      const payload = {
        contractVersion: RANKINGS_V2_CONTRACT_VERSION,
        mode: 'weekly' as const,
        lens: 'lineup_decision' as const,
        horizon: 'week' as const,
        asOf: derivedAsOf,
        sourceStack: [
          {
            layer: 'forge' as const,
            source: 'api/forge/tiers cache (forge_grade_cache)',
            asOf: toIso(cache.computedAt),
            notes: isCacheEmpty
              ? `status=${CACHE_EMPTY_STATUS}; season=${season}, asOfWeek=${cache.asOfWeek ?? asOfWeek ?? 'unknown'}, position=${position}`
              : `season=${season}, asOfWeek=${cache.asOfWeek ?? asOfWeek ?? 'unknown'}, position=${position}`,
          },
          {
            layer: 'confidence_stability' as const,
            source: 'forge cache confidence + trajectory metadata',
            asOf: toIso(cache.computedAt),
            notes: isCacheEmpty
              ? 'FORGE grades not yet computed for this filter; operator action available.'
              : cache.computedAt
                ? 'Freshness derived from cache computedAt.'
                : 'No cache timestamp; using current server time as asOf fallback.',
          },
        ],
        items,
        trust: {
          confidence: null,
          asOf: toIso(cache.computedAt),
          freshnessNote: isCacheEmpty
            ? 'FORGE grades are not computed yet for this week/filter.'
            : cache.computedAt
              ? 'Freshness based on forge cache computedAt.'
              : 'Cache computedAt unavailable; top-level asOf reflects server fallback time.',
          sampleNote: isCacheEmpty
            ? 'Run POST /api/forge/compute-grades to generate cache rows, then refresh /tiers.'
            : null,
          stabilityNote: isCacheEmpty ? CACHE_EMPTY_STATUS : null,
        },
      };

      const parsed = rankingsV2ResponseSchema.safeParse(payload);
      if (!parsed.success) {
        return res.status(500).json({
          error: 'Failed to build Rankings v2 weekly payload',
          details: parsed.error.flatten(),
        });
      }

      return res.json(parsed.data);
    } catch (error) {
      console.error('[RankingsV2/Routes] weekly endpoint error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}

export default createRankingsV2Router;
