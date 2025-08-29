import { Router } from "express";
import { buildDeepseekV3 } from "../services/deepseekV3Service";

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

export default router;