// src/routes/startSitLiveRoutes.ts
import { Router, Request, Response } from "express";
import { buildStartSitInputs, buildStudMetaFromContext } from "../data/aggregator/startSitAggregator";
import { startSit, defaultConfig, StartSitConfig } from "../../server/modules/startSitEngine";

const router = Router();

/**
 * GET /api/start-sit-live/test
 * Quick test endpoint to verify data sources are working
 */
router.get('/test', async (req: Request, res: Response) => {
  try {
    // Test with sample players to verify data pipeline
    const testQuery = {
      playerA: { id: "josh_allen", position: "QB" as const, team: "BUF" as const, name: "Josh Allen" },
      playerB: { id: "lamar_jackson", position: "QB" as const, team: "BAL" as const, name: "Lamar Jackson" },
      week: 1
    };

    const { a, b } = await buildStartSitInputs(testQuery);
    
    return res.json({
      status: "live data pipeline working",
      sample: {
        playerA: {
          name: a.name,
          projPoints: a.projPoints,
          snapPct: a.snapPct,
          impliedTeamTotal: a.impliedTeamTotal,
          newsHeat: a.newsHeat
        },
        playerB: {
          name: b.name,
          projPoints: b.projPoints,
          snapPct: b.snapPct,
          impliedTeamTotal: b.impliedTeamTotal,
          newsHeat: b.newsHeat
        }
      }
    });
  } catch (error: any) {
    console.error("[start-sit-live-test] Error:", error);
    return res.status(500).json({ 
      error: "Live data test failed",
      details: error.message 
    });
  }
});

/**
 * POST /api/start-sit-live/live
 * body: {
 *   playerA: { id, position, team, name? },
 *   playerB: { id, position, team, name? },
 *   week?: number,
 *   config?: Partial<StartSitConfig>
 * }
 */
router.post('/live', async (req: Request, res: Response) => {
  try {
    const { playerA, playerB, week, config } = req.body;

    if (!playerA || !playerB) {
      return res.status(400).json({ 
        error: "playerA and playerB are required",
        details: "Each player needs: { id, position, team?, name? }"
      });
    }

    if (!playerA.id || !playerA.position || !playerB.id || !playerB.position) {
      return res.status(400).json({ 
        error: "Player id and position are required for both players" 
      });
    }

    console.log(`[start-sit-live] Building live data for ${playerA.name || playerA.id} vs ${playerB.name || playerB.id}`);

    // Fetch real data from all sources and normalize
    const { a, b } = await buildStartSitInputs({
      playerA,
      playerB,
      week
    });

    // Build minimal stud metadata from available context
    const aMeta = buildStudMetaFromContext({
      ourPosRank: a.projPoints ? Math.max(1, Math.min(50, Math.ceil((40 - a.projPoints) / 0.8))) : undefined,
      seasonTgtShare: a.targetShare,
      seasonRoutePct: a.routeParticipation,
      boomRate: a.stdevLast5 ? Math.max(0, Math.min(100, 100 - (a.stdevLast5 * 8))) : undefined
    });

    const bMeta = buildStudMetaFromContext({
      ourPosRank: b.projPoints ? Math.max(1, Math.min(50, Math.ceil((40 - b.projPoints) / 0.8))) : undefined,
      seasonTgtShare: b.targetShare,
      seasonRoutePct: b.routeParticipation,
      boomRate: b.stdevLast5 ? Math.max(0, Math.min(100, 100 - (b.stdevLast5 * 8))) : undefined
    });

    // Merge any config overrides
    const mergedConfig = {
      ...defaultConfig,
      ...(config || {}),
      studEnabled: config?.studEnabled ?? true,
      weights: { ...defaultConfig.weights, ...(config?.weights || {}) },
      usageSub: { ...defaultConfig.usageSub, ...(config?.usageSub || {}) },
      matchupSub: { ...defaultConfig.matchupSub, ...(config?.matchupSub || {}) },
      volatilitySub: { ...defaultConfig.volatilitySub, ...(config?.volatilitySub || {}) },
      newsSub: { ...defaultConfig.newsSub, ...(config?.newsSub || {}) },
    };

    // Run the engine with live data and stud metadata
    const result = startSit(a, b, mergedConfig, { aStudMeta: aMeta, bStudMeta: bMeta });

    console.log(`[start-sit-live] Result: ${result.verdict} (${result.margin.toFixed(1)} margin)`);

    return res.json({
      verdict: result.verdict,
      margin: result.margin,
      summary: result.summary,
      playerA: {
        name: a.name,
        position: a.position,
        team: a.team,
        breakdown: result.a,
        liveData: {
          snapPct: a.snapPct,
          targetShare: a.targetShare,
          impliedTeamTotal: a.impliedTeamTotal,
          injuryTag: a.injuryTag,
          newsHeat: a.newsHeat,
        }
      },
      playerB: {
        name: b.name,
        position: b.position,
        team: b.team,
        breakdown: result.b,
        liveData: {
          snapPct: b.snapPct,
          targetShare: b.targetShare,
          impliedTeamTotal: b.impliedTeamTotal,
          injuryTag: b.injuryTag,
          newsHeat: b.newsHeat,
        }
      },
      week: week || "current",
      dataSource: "live"
    });

  } catch (err: any) {
    console.error("[start-sit-live] error", err);
    return res.status(400).json({
      error: "bad_input_or_internal",
      detail: String(err?.message || err),
      hint: "Check that playerA/playerB include position and team (for OASIS/vegas), and that numbers are valid."
    });
  }
});

export default router;