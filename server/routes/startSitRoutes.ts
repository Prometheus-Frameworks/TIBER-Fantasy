// server/routes/startSitRoutes.ts

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  StartSitPlayerProfile,
  StartSitVerdict,
} from "../../shared/startSit"; // <-- now strongly typed

export interface StartSitAgent1 {
  analyze(
    input:
      | { kind: "single"; playerId: string; week: number; season?: number; leagueId?: string }
      | { kind: "cohort"; week: number; season?: number; leagueId?: string; teamId?: string; positions?: string[] }
  ): Promise<
    | { kind: "single"; profile: StartSitPlayerProfile; verdict: StartSitVerdict }
    | { kind: "cohort"; verdicts: StartSitVerdict[] }
  >;

  compare(input: {
    playerIds: string[];
    week: number;
    season?: number;
    leagueId?: string;
  }): Promise<StartSitVerdict[]>;
}

/* -------------------
   Zod Schemas
-------------------- */
const AnalyzeSingleSchema = z.object({
  kind: z.literal("single"),
  playerId: z.string(),
  week: z.number().int().positive(),
  season: z.number().int().positive().optional(),
  leagueId: z.string().optional(),
});

const AnalyzeCohortSchema = z.object({
  kind: z.literal("cohort"),
  week: z.number().int().positive(),
  season: z.number().int().positive().optional(),
  leagueId: z.string().optional(),
  teamId: z.string().optional(),
  positions: z.array(z.string()).optional(),
});

const AnalyzeBodySchema = z.union([AnalyzeSingleSchema, AnalyzeCohortSchema]);

const CompareBodySchema = z.object({
  playerIds: z.array(z.string()).min(2),
  week: z.number().int().positive(),
  season: z.number().int().positive().optional(),
  leagueId: z.string().optional(),
});

/* -------------------
   Router Factory
-------------------- */
export function buildStartSitRouter(agent1: StartSitAgent1) {
  const router = Router();

  // POST /api/start-sit/analyze
  router.post("/analyze", async (req: Request, res: Response) => {
    const parsed = AnalyzeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
      });
    }

    try {
      const result = await agent1.analyze(parsed.data);

      if (result.kind === "single") {
        return res.json({
          ok: true,
          data: { profile: result.profile, verdict: result.verdict } as {
            profile: StartSitPlayerProfile;
            verdict: StartSitVerdict;
          },
        });
      }

      return res.json({
        ok: true,
        data: { verdicts: result.verdicts } as { verdicts: StartSitVerdict[] },
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: { code: "INTERNAL_ERROR", message: err?.message ?? "Server error" },
      });
    }
  });

  // POST /api/start-sit/compare
  router.post("/compare", async (req: Request, res: Response) => {
    const parsed = CompareBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
      });
    }

    try {
      const { playerIds, week, season, leagueId } = parsed.data;
      const verdicts = await agent1.compare({ playerIds, week, season, leagueId });

      // Keep response order consistent
      const byId = new Map(verdicts.map((v) => [v.playerId, v]));
      const ordered = playerIds.map((id) => byId.get(id)).filter(Boolean) as StartSitVerdict[];

      return res.json({
        ok: true,
        data: { verdicts: ordered } as { verdicts: StartSitVerdict[] },
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: { code: "INTERNAL_ERROR", message: err?.message ?? "Server error" },
      });
    }
  });

  return router;
}

export default buildStartSitRouter;
