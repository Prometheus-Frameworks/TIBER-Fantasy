import { Router } from "express";
import { z } from "zod";
import { getPlayerVector } from "../modules/metricMatrix/playerVectorService";

const router = Router();

const QuerySchema = z.object({
  playerId: z.string().min(1, "playerId is required"),
  season: z.coerce.number().min(2000).max(2100).optional(),
  week: z.coerce.number().min(1).max(18).optional(),
  mode: z.enum(["forge"]).optional().default("forge"),
});

router.get("/player-vector", async (req, res) => {
  try {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const payload = await getPlayerVector(parsed.data);
    res.json({ success: true, data: payload });
  } catch (error) {
    console.error("[MetricMatrix] player-vector error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to compute player vector",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
