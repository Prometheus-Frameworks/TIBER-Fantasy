import { Router } from "express";
import { buildDeepseekV3 } from "../services/deepseekV3Service";
import { buildDeepseekV3_1, getModelInfo } from "../services/deepseekV3.1Service";

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
      
      // Special handling for WR position - sort by FPTS
      if (position === "WR") {
        const fs = await import('fs');
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        
        // Load elite WRs FPTS data
        const csvPath = path.join(__dirname, '../data/WR_2024_Ratings_With_Tags.csv');
        const fptsMap = new Map<string, number>();
        
        if (fs.existsSync(csvPath)) {
          const csvContent = fs.readFileSync(csvPath, 'utf-8');
          const lines = csvContent.trim().split('\n');
          
          lines.slice(1).forEach(line => {
            const parts = line.split(',');
            if (parts.length >= 4) {
              const playerName = parts[0].replace(/"/g, '');
              const totalFpts = parseFloat(parts[3]) || 0;
              fptsMap.set(playerName.toLowerCase(), totalFpts);
            }
          });
        }
        
        // Assign FPTS to players and sort by FPTS descending
        data.forEach(player => {
          const fpts = fptsMap.get(player.name.toLowerCase()) || 0;
          player.season_fpts = fpts;
        });
        
        // Sort by FPTS (highest first)
        data.sort((a, b) => (b.season_fpts || 0) - (a.season_fpts || 0));
      }
      
      // Re-rank within position
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

export default router;