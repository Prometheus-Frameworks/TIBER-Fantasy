import { Express, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { players, playerInjuries } from "../../shared/schema";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import { PlayerCompassService } from "../playerCompass";

// --- cache ---
const compassCache = new LRUCache<string, any>({ max: 5000, ttl: 10 * 60 * 1000 });
const cKey = (id: string, mode: "dynasty" | "redraft") => `${id}:${mode}`;

const Query = z.object({
  format: z.enum(["dynasty", "redraft"]).default("dynasty"),
  algorithm: z.enum(["default", "enhanced", "prometheus"]).default("default"),
  search: z.string().max(64).optional(),
  team: z.string().max(3).optional(),
  limit: z.coerce.number().int().min(10).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(10).max(100).optional(),
});

const compassService = new PlayerCompassService();

export function registerWRCompassRoute(app: Express) {
  app.get("/api/compass/WR", async (req: Request, res: Response) => {
    try {
      const q = Query.parse(req.query);
      const mode = q.format; // 'dynasty' | 'redraft'
      const page = q.page ?? 1;
      const pageSize = q.pageSize ?? (q.limit ?? 50);
      const offset = (page - 1) * pageSize;

      // Build filters: WR only, optional team/search
      const conds = [eq(players.position, "WR" as const)];
      if (q.team) conds.push(eq(players.team, q.team));
      if (q.search) {
        const s = `%${q.search}%`;
        conds.push(or(ilike(players.name, s), ilike(players.firstName, s), ilike(players.lastName, s)));
      }
      const whereClause = conds.length > 0 ? and(...conds) : undefined;

      // total
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(players)
        .where(whereClause);

      // base WR slice
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

      // injuries (batch)
      const ids = base.map(b => b.sleeperId).filter(Boolean) as string[];
      const injuries = ids.length
        ? await db
            .select({ playerId: playerInjuries.playerId, status: playerInjuries.status })
            .from(playerInjuries)
            .where(sql`${playerInjuries.playerId} = ANY(${ids})`)
        : [];
      // const injuryMap = new Map(injuries.map(i => [i.playerId, i.status])); // Future use

      // compute compass (cached)
      const rows = [];
      for (const p of base) {
        if (!p.sleeperId) continue;
        const key = cKey(p.sleeperId, mode);
        let comp = compassCache.get(key);
        if (!comp) {
          try {
            comp = compassService.generateCompassProfile({
              playerId: p.sleeperId,
              playerName: p.name ?? "Unknown",
              position: "WR",
              team: p.team,
              age: p.age ?? 0,
              rawStats: {},       // keep lean; enrichment belongs in cron/materialized view
              contextTags: [],
            });
            compassCache.set(key, comp);
          } catch (e) {
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
          tier: tierFromScore(score, mode, p.age ?? null),
          insights: quickInsights({ age: p.age, adp: p.adp, team: p.team }, comp),
        });
      }

      // sort by compass score desc, stable by ADP
      rows.sort((a, b) => (b.compass.score ?? -1) - (a.compass.score ?? -1) || (a.adp ?? 9999) - (b.adp ?? 9999));

      res.json({
        ok: true,
        position: "WR",
        format: mode,
        algorithm: q.algorithm,
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
      console.error("❌ /api/compass/WR", err);
      res.status(400).json({ ok: false, error: err?.message ?? "Bad request" });
    }
  });
}

// --- helpers ---
function tierFromScore(score: number | null, format: "dynasty" | "redraft", age: number | null) {
  if (score == null) return "Unrated";
  if (format === "dynasty") {
    if (score >= 8.5) return "Elite Dynasty Asset";
    if (score >= 7.5) return "High-End Dynasty";
    if (score >= 6.5) return "Solid Dynasty Hold";
    return "Dynasty Depth";
  } else {
    if (score >= 8.5) return "Must-Start";
    if (score >= 7.5) return "Strong Start";
    if (score >= 6.5) return "Solid Starter";
    return "Flex Option";
  }
}

function quickInsights(player: { age?: number | null; adp?: number | null; team?: string | null }, comp: any) {
  const out: string[] = [];
  if ((player.age ?? 99) <= 24) out.push("Prime dynasty age");
  if ((player.adp ?? 999) <= 24) out.push("Market: top-2 rounds");
  if (comp?.environment != null && comp.environment < 6) out.push("Weak environment");
  if (comp?.risk != null && comp.risk < 5) out.push("Durability risk");
  return out;
}