// src/routes/startSitQuickRoutes.ts
// One-endpoint UX: give names (and optional league context). We resolve & run live.
import { Router, Request, Response } from "express";
import { resolvePlayer } from "../data/resolvers/playerResolver";
import { buildStartSitInputs } from "../data/aggregator/startSitAggregator";
import { startSit, defaultConfig, StartSitConfig } from "../../server/modules/startSitEngine";

const router = Router();

/**
 * POST /api/start-sit/quick
 * body: {
 *   a: string,                // "Puka Nacua"
 *   b: string,                // "Romeo Doubs"
 *   week?: number,
 *   leagueId?: string,        // optional (for league-specific scoring)
 *   config?: Partial<StartSitConfig>
 * }
 */
router.post("/start-sit/quick", async (req: Request, res: Response) => {
  try {
    const { a, b, week, leagueId, config } = req.body ?? {};
    
    if (!a || !b) {
      return res.status(400).json({ 
        error: "missing_players",
        message: "Provide both player A and player B names" 
      });
    }

    console.log(`[start-sit/quick] Resolving players: "${a}" vs "${b}"`);

    const [playerAResolved, playerBResolved] = await Promise.all([
      resolvePlayer(String(a)),
      resolvePlayer(String(b))
    ]);
    
    if (!playerAResolved || !playerBResolved) {
      return res.status(404).json({
        error: "player_not_found",
        message: `Could not resolve: ${!playerAResolved ? a : ""} ${!playerBResolved ? b : ""}`,
        detail: "Try connecting to a Sleeper league first to load player data, or check spelling",
        missing: {
          playerA: !playerAResolved ? a : null,
          playerB: !playerBResolved ? b : null
        }
      });
    }

    const playerA = {
      id: playerAResolved.player_id,
      name: playerAResolved.full_name || `${playerAResolved.first_name} ${playerAResolved.last_name}`.trim(),
      team: playerAResolved.team,
      position: playerAResolved.position
    };

    const playerB = {
      id: playerBResolved.player_id,
      name: playerBResolved.full_name || `${playerBResolved.first_name} ${playerBResolved.last_name}`.trim(),
      team: playerBResolved.team,
      position: playerBResolved.position
    };

    console.log(`[start-sit/quick] Resolved: ${playerA.name} (${playerA.team}) vs ${playerB.name} (${playerB.team})`);

    // Build engine inputs from live data sources
    const { a: playerAInput, b: playerBInput } = await buildStartSitInputs({
      playerA: { 
        id: playerA.id, 
        position: playerA.position as any, 
        team: playerA.team as any, 
        name: playerA.name 
      },
      playerB: { 
        id: playerB.id, 
        position: playerB.position as any, 
        team: playerB.team as any, 
        name: playerB.name 
      },
      week,
    });

    // Apply league-specific scoring adjustments if available
    let adjustedConfig: StartSitConfig = { ...defaultConfig };
    
    if (leagueId && leagueId !== "demo_league") {
      try {
        const leagueResponse = await fetch(`/api/sleeper/league/${leagueId}/info`);
        if (leagueResponse.ok) {
          const leagueInfo = await leagueResponse.json();
          
          // Adjust weights based on league scoring
          if (leagueInfo.scoring?.te_premium > 0) {
            // TE premium league - boost TE target share weight
            adjustedConfig.usageSub.tShare = (adjustedConfig.usageSub.tShare || 0.25) + 0.05;
          }
          
          if (leagueInfo.scoring?.ppr === 0) {
            // Standard (no PPR) - reduce target share weight slightly
            adjustedConfig.usageSub.tShare = (adjustedConfig.usageSub.tShare || 0.25) - 0.05;
          }
          
          if (leagueInfo.scoring?.sf) {
            // Superflex - slightly boost QB projections
            if (playerA.position === 'QB') {
              playerAInput.projPoints = (playerAInput.projPoints || 0) * 1.02;
            }
            if (playerB.position === 'QB') {
              playerBInput.projPoints = (playerBInput.projPoints || 0) * 1.02;
            }
          }
        }
      } catch (leagueError) {
        console.warn('[start-sit/quick] Could not apply league adjustments:', leagueError);
      }
    }

    // Merge any manual config overrides
    const finalConfig: StartSitConfig = {
      ...adjustedConfig,
      ...(config as any),
      weights: { ...adjustedConfig.weights, ...(config?.weights || {}) },
      usageSub: { ...adjustedConfig.usageSub, ...(config?.usageSub || {}) },
      matchupSub: { ...adjustedConfig.matchupSub, ...(config?.matchupSub || {}) },
      volatilitySub: { ...adjustedConfig.volatilitySub, ...(config?.volatilitySub || {}) },
      newsSub: { ...adjustedConfig.newsSub, ...(config?.newsSub || {}) },
    };

    // Run the start/sit engine
    const result = startSit(playerAInput, playerBInput, finalConfig);

    console.log(`[start-sit/quick] Result: ${result.verdict} (${result.margin.toFixed(2)} margin)`);

    return res.json({
      query: { 
        a: playerA.name, 
        b: playerB.name, 
        week: week ?? "current", 
        leagueId: leagueId ?? null 
      },
      verdict: result.verdict,
      margin: result.margin,
      summary: result.summary,
      playerA: { 
        name: playerA.name, 
        team: playerA.team, 
        position: playerA.position, 
        breakdown: result.a,
        liveData: {
          projPoints: playerAInput.projPoints,
          snapPct: playerAInput.snapPct,
          impliedTeamTotal: playerAInput.impliedTeamTotal,
          injuryTag: playerAInput.injuryTag
        }
      },
      playerB: { 
        name: playerB.name, 
        team: playerB.team, 
        position: playerB.position, 
        breakdown: result.b,
        liveData: {
          projPoints: playerBInput.projPoints,
          snapPct: playerBInput.snapPct,
          impliedTeamTotal: playerBInput.impliedTeamTotal,
          injuryTag: playerBInput.injuryTag
        }
      },
      dataSource: "live_with_league_context"
    });
  } catch (err: any) {
    console.error("[start-sit] error", err);
    return res.status(400).json({
      error: "bad_input_or_internal",
      detail: String(err?.message || err),
      hint: "Check that playerA/playerB include position and team (for OASIS/vegas), and that numbers are valid."
    });
  }
});

/**
 * GET /api/start-sit/quick/test
 * Test the quick resolution system
 */
router.get("/start-sit/quick/test", async (req: Request, res: Response) => {
  try {
    const [testA, testB] = await Promise.all([
      resolvePlayer("Josh Allen"),
      resolvePlayer("Lamar Jackson")
    ]);
    
    return res.json({
      status: "quick_resolution_working",
      test: {
        playerA: testA ? { 
          name: testA.full_name || `${testA.first_name} ${testA.last_name}`.trim(), 
          team: testA.team, 
          position: testA.position 
        } : null,
        playerB: testB ? { 
          name: testB.full_name || `${testB.first_name} ${testB.last_name}`.trim(), 
          team: testB.team, 
          position: testB.position 
        } : null
      },
      message: testA && testB ? "Player resolution working" : "Load league players first"
    });
  } catch (err: any) {
    console.error("[start-sit] error", err);
    return res.status(400).json({
      error: "bad_input_or_internal",
      detail: String(err?.message || err),
      hint: "Check that playerA/playerB include position and team (for OASIS/vegas), and that numbers are valid."
    });
  }
});

export default router;