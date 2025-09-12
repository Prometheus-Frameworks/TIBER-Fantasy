// src/routes/leagueAssistRoutes.ts
import { Router, Request, Response } from "express";
import { fetchSleeperLeagues, fetchLeaguePlayers } from "../data/providers/sleeperLeagues";
import { loadPlayersIndex } from "../data/resolvers/playerResolver";

const router = Router();

/** GET /api/sleeper/leagues?username=H4MMER */
router.get("/sleeper/leagues", async (req: Request, res: Response) => {
  try {
    const username = String(req.query.username || "").trim();
    if (!username) {
      return res.status(400).json({ 
        error: "username_required",
        message: "Please provide a Sleeper username"
      });
    }

    console.log(`[sleeper/leagues] Fetching leagues for user: ${username}`);
    const leagues = await fetchSleeperLeagues(username);
    
    return res.json({ 
      leagues,
      count: leagues.length,
      username 
    });
  } catch (e: any) {
    console.error("[sleeper/leagues] Error:", e);
    return res.status(500).json({ 
      error: "internal_error", 
      detail: String(e?.message || e) 
    });
  }
});

/** GET /api/sleeper/league/:id/players */
router.get("/sleeper/league/:id/players", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    console.log(`[sleeper/league/players] Fetching players for league: ${id}`);
    const players = await fetchLeaguePlayers(id);
    
    // Also seed the name→id resolver index for quick start/sit resolution
    loadPlayersIndex(players);
    
    return res.json({ 
      players,
      count: players.length,
      leagueId: id
    });
  } catch (e: any) {
    console.error("[sleeper/league/players] Error:", e);
    return res.status(500).json({ 
      error: "internal_error", 
      detail: String(e?.message || e) 
    });
  }
});

/** GET /api/sleeper/league/:id/info */
router.get("/sleeper/league/:id/info", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get league settings for scoring context
    let leagueInfo = {
      leagueId: id,
      name: "League",
      scoring: { ppr: 1.0, sf: false, te_premium: 0 },
      status: "active"
    };

    try {
      const response = await fetch(`/api/sleeper/league/${id}`);
      if (response.ok) {
        const data = await response.json();
        leagueInfo = {
          leagueId: id,
          name: data.name || "League",
          scoring: {
            ppr: data.scoring_settings?.rec || 1.0,
            sf: data.roster_positions?.includes('SUPER_FLEX') || false,
            te_premium: data.scoring_settings?.rec_te || 0,
          },
          status: data.status || "active"
        };
      }
    } catch (error) {
      console.warn('[sleeper/league/info] Using fallback info:', error);
    }

    return res.json(leagueInfo);
  } catch (e: any) {
    console.error("[sleeper/league/info] Error:", e);
    return res.status(500).json({ 
      error: "internal_error", 
      detail: String(e?.message || e) 
    });
  }
});

export default router;