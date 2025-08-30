import { Router } from "express";
import { buildDeepseekV3 } from "../services/deepseekV3Service";
import { buildDeepseekV3_1, getModelInfo } from "../services/deepseekV3.1Service";
import { rankingsFusionService } from "../services/rankingsFusionService";

const router = Router();

router.get("/rankings/deepseek/v3", async (req, res) => {
  try {
    const mode = (req.query.mode as "dynasty"|"redraft") ?? "dynasty";
    
    // Force refresh if requested
    if (req.query.force === '1') {
      const { sleeperDataNormalizationService } = await import("../services/sleeperDataNormalizationService");
      await sleeperDataNormalizationService.forceRefresh();
    }
    
    const data = await buildDeepseekV3(mode);
    res.json({ mode, count: data.length, ts: Date.now(), data });
  } catch (e: any) {
    console.error('DeepSeek v3 API error:', e);
    res.status(503).json({ error: e?.message ?? "v3_failed" });
  }
});

// New v3.1 endpoint with xFP anchoring
router.get("/rankings/deepseek/v3.1", async (req, res) => {
  try {
    const mode = (req.query.mode as "dynasty"|"redraft") ?? "dynasty";
    const position = req.query.position as string; // QB, RB, WR, TE, or undefined for all
    
    // Force refresh if requested
    if (req.query.force === '1') {
      const { sleeperDataNormalizationService } = await import("../services/sleeperDataNormalizationService");
      await sleeperDataNormalizationService.forceRefresh();
    }
    
    const debug = req.query.debug === '1';
    let data = await buildDeepseekV3_1(mode, debug);
    
    // Filter by position if specified
    if (position && ["QB", "RB", "WR", "TE"].includes(position)) {
      data = data.filter(player => player.pos === position);
      
      // Re-rank within position (no FPTS override - fixed scoring bug)
      data.forEach((player, index) => {
        player.rank = index + 1;
      });
    }
    
    const modelInfo = await getModelInfo();
    
    res.json({ 
      mode, 
      position: position || "ALL",
      count: data.length, 
      ts: Date.now(), 
      model_info: modelInfo,
      data 
    });
  } catch (e: any) {
    console.error('DeepSeek v3.1 API error:', e);
    res.status(503).json({ error: e?.message ?? "v3_1_failed" });
  }
});

// Audit endpoint to track player coverage and missing data issues  
router.get("/rankings/deepseek/v3.1/audit", async (req, res) => {
  try {
    const { sleeperDataNormalizationService } = await import("../services/sleeperDataNormalizationService");
    const allPlayers = await sleeperDataNormalizationService.getNormalizedPlayers();
    
    const byPos = (pos: string) => allPlayers.filter(p => p.pos === pos);
    const metrics = (pos: string) => {
      const players = byPos(pos);
      return {
        total: players.length,
        withTalent: players.filter(p => (p.talentScore ?? 0) > 0).length,
        withTeam: players.filter(p => p.team && p.team !== 'FA').length,
        withAge: players.filter(p => p.age && p.age > 0).length,
        avgTalent: players.length > 0 ? 
          Math.round(players.reduce((sum, p) => sum + (p.talentScore ?? 0), 0) / players.length * 10) / 10 : 0,
        topTalent: players
          .filter(p => (p.talentScore ?? 0) > 70)
          .sort((a, b) => (b.talentScore ?? 0) - (a.talentScore ?? 0))
          .slice(0, 5)
          .map(p => `${p.name} (${p.talentScore})`)
      };
    };
    
    res.json({ 
      WR: metrics("WR"), 
      RB: metrics("RB"), 
      TE: metrics("TE"), 
      QB: metrics("QB"),
      timestamp: Date.now()
    });
  } catch (e: any) {
    console.error('Audit endpoint error:', e);
    res.status(503).json({ error: e?.message ?? "audit_failed" });
  }
});

// New v3.2 Fusion endpoint - DeepSeek + Compass integration
router.get("/rankings/deepseek/v3.2", async (req, res) => {
  try {
    const mode = (req.query.mode as "dynasty"|"redraft") ?? "dynasty";
    const position = req.query.position as "QB"|"RB"|"WR"|"TE"|undefined;
    const debug = req.query.debug === '1';
    
    // Force refresh if requested
    if (req.query.force === '1') {
      const { sleeperDataNormalizationService } = await import("../services/sleeperDataNormalizationService");
      await sleeperDataNormalizationService.forceRefresh();
    }
    
    const data = await rankingsFusionService.generateFusionRankings(mode, position, debug);
    
    res.json({
      mode,
      position: position || "ALL",
      count: data.length,
      ts: Date.now(),
      version: "v3.2-fusion",
      fusion_info: {
        description: "DeepSeek v3.2 + Player Compass 4-directional fusion",
        quadrants: ["North: Volume/Talent", "East: Environment/Scheme", "South: Risk/Durability", "West: Value/Market"],
        eliminated: ["FPTS override", "magic constants", "dual normalizers"],
        debug_available: debug
      },
      data
    });
  } catch (e: any) {
    console.error('DeepSeek v3.2 Fusion API error:', e);
    res.status(503).json({ error: e?.message ?? "v3_2_fusion_failed" });
  }
});

// Fusion system health check
router.get("/rankings/deepseek/v3.2/health", async (req, res) => {
  try {
    // Quick health check - get a small sample
    const sampleData = await rankingsFusionService.generateFusionRankings("dynasty", "WR", false);
    const limited = sampleData.slice(0, 3);
    
    const health = {
      status: "healthy",
      version: "v3.2-fusion",
      sample_count: limited.length,
      quadrant_samples: limited.map(p => ({
        name: p.name,
        pos: p.pos,
        score: p.score,
        tier: p.tier,
        quadrants: { north: p.north, east: p.east, south: p.south, west: p.west }
      })),
      timestamp: Date.now()
    };
    
    res.json(health);
  } catch (e: any) {
    console.error('Fusion health check failed:', e);
    res.status(503).json({ 
      status: "unhealthy", 
      error: e?.message ?? "health_check_failed",
      timestamp: Date.now()
    });
  }
});

// Fusion debug endpoint for deep analysis
router.get("/rankings/deepseek/v3.2/debug/:player_name", async (req, res) => {
  try {
    const playerName = req.params.player_name;
    const mode = (req.query.mode as "dynasty"|"redraft") ?? "dynasty";
    
    // Get full debug data
    const debugData = await rankingsFusionService.generateFusionRankings(mode, undefined, true);
    
    // Find the specific player
    const player = debugData.find(p => 
      p.name.toLowerCase().includes(playerName.toLowerCase()) ||
      p.player_id.toLowerCase().includes(playerName.toLowerCase())
    );
    
    if (!player) {
      return res.status(404).json({ 
        error: "Player not found", 
        available_players: debugData.slice(0, 10).map(p => p.name)
      });
    }
    
    res.json({
      player: player.name,
      mode,
      debug_breakdown: player.debug,
      quadrant_scores: { 
        north: player.north, 
        east: player.east, 
        south: player.south, 
        west: player.west 
      },
      final_score: player.score,
      tier: player.tier,
      rank: player.rank,
      badges: player.badges,
      timestamp: Date.now()
    });
  } catch (e: any) {
    console.error('Player debug API error:', e);
    res.status(503).json({ error: e?.message ?? "debug_failed" });
  }
});

export default router;