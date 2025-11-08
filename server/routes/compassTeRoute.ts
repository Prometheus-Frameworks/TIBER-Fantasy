import { Express, Request, Response } from "express";
import { z } from "zod";
import { db } from "../infra/db";
import { players } from "../../shared/schema";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import { PlayerCompassService } from "../playerCompass";

const Query = z.object({
  format: z.enum(["dynasty", "redraft"]).default("dynasty"),
  team: z.string().max(3).optional(),
  search: z.string().max(64).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(10).max(200).optional(),
});

const compassCache = new LRUCache<string, any>({ max: 5000, ttl: 10 * 60 * 1000 });
const cacheKey = (id: string, mode: "dynasty" | "redraft") => `${id}:${mode}`;

export function registerTECompassRoute(app: Express) {
  const compassService = new PlayerCompassService();

  app.get("/api/compass/TE", async (req: Request, res: Response) => {
    try {
      console.log(`🏈 Generating TE compass rankings with ${req.query.format || 'dynasty'} format`);
      
      const q = Query.parse(req.query);
      const mode = q.format;
      const page = q.page ?? 1;
      const pageSize = q.pageSize ?? 50;
      const offset = (page - 1) * pageSize;

      const conds = [eq(players.position, "TE" as const)];
      if (q.team) conds.push(eq(players.team, q.team));
      if (q.search) {
        const s = `%${q.search}%`;
        conds.push(or(ilike(players.name, s), ilike(players.firstName, s), ilike(players.lastName, s)));
      }
      const whereClause = conds.length > 1 ? and(...conds) : (conds.length === 1 ? conds[0] : undefined);

      // total
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(players)
        .where(whereClause);

      // base page (lean select; ADP for tiebreak, name for stability)
      const base = await db
        .select({
          sleeperId: players.sleeperId,
          name: players.name,
          team: players.team,
          age: players.age,
          adp: players.adp,
          projectedPoints: players.projectedPoints,
        })
        .from(players)
        .where(whereClause)
        .orderBy(sql`${players.adp} NULLS LAST`, players.name)
        .limit(pageSize)
        .offset(offset);

      const rows = [];
      for (const p of base) {
        if (!p.sleeperId) continue;
        const k = cacheKey(p.sleeperId, mode);
        let comp = compassCache.get(k);
        if (!comp) {
          try {
            comp = compassService.generateCompassProfile({
              playerId: p.sleeperId,
              playerName: p.name ?? "Unknown",
              position: "TE",
              team: p.team,
              age: p.age ?? 0,
              rawStats: {},      // heavy enrichment belongs in cron/materialized view
              contextTags: [],
            });
            compassCache.set(k, comp);
          } catch {
            comp = null;
          }
        }

        const score = comp?.compassScore ?? null;
        rows.push({
          player_name: p.name ?? "Unknown",
          team: p.team,
          age: p.age,
          adp: p.adp,
          projected_points: p.projectedPoints,
          compass: comp
            ? { north: comp.volume, east: comp.talent, south: comp.environment, west: comp.risk, score }
            : { north: null, east: null, south: null, west: null, score: null },
          tier: tierFromScore(score, mode),
          insights: quickInsightsTE({ age: p.age, adp: p.adp }, comp),
        });
      }

      // sort by score desc, ADP as tiebreaker
      rows.sort(
        (a, b) =>
          (b.compass.score ?? -1) - (a.compass.score ?? -1) ||
          (a.adp ?? 9999) - (b.adp ?? 9999)
      );

      res.json({
        ok: true,
        position: "TE",
        format: mode,
        data: rows,
        meta: {
          total: Number(count),
          page,
          pageSize,
          hasNext: page * pageSize < Number(count),
          ts: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error("❌ /api/compass/TE", err);
      res.status(400).json({ ok: false, error: err?.message ?? "Bad request" });
    }
  });
}

// helpers
function tierFromScore(score: number | null, format: "dynasty" | "redraft") {
  if (score == null) return "Unrated";
  if (format === "dynasty") {
    if (score >= 8.5) return "Elite Dynasty TE";
    if (score >= 7.5) return "TE1 Dynasty Asset";
    if (score >= 6.5) return "Solid Dynasty Hold";
    return "Dynasty Depth";
  } else {
    if (score >= 8.5) return "Must-Start TE";
    if (score >= 7.5) return "Strong TE1";
    if (score >= 6.5) return "Solid TE Option";
    return "Streaming/Flex";
  }
}

function quickInsightsTE(
  player: { age?: number | null; adp?: number | null },
  comp: any
) {
  const out: string[] = [];
  if ((player.age ?? 99) <= 25) out.push("Prime dynasty age");
  if ((player.adp ?? 999) <= 48) out.push("Market: top-4 rounds");
  if (comp?.volume != null && comp.volume >= 8) out.push("Target volume");
  if (comp?.talent != null && comp.talent >= 8) out.push("Red zone threat");
  if (comp?.environment != null && comp.environment < 5) out.push("Usage concern");
  return out;
}