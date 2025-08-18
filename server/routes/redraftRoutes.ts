import { Express, Request, Response } from "express";
import { z } from "zod";
import { LRUCache } from "lru-cache";

const Query = z.object({
  pos: z.enum(["QB","RB","WR","TE"]).optional(),
  team: z.string().max(3).optional(),
  search: z.string().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
});

const respCache = new LRUCache<string, any>({ max: 200, ttl: 5 * 60 * 1000 });

export function registerRedraftRoutes(app: Express) {
  app.get("/api/redraft", async (req: Request, res: Response) => {
    try {
      const q = Query.parse(req.query);
      const key = `redraft:${q.pos ?? "ALL"}:${q.team ?? ""}:${q.search ?? ""}:${q.page}:${q.pageSize}`;
      const cached = respCache.get(key);
      if (cached) {
        console.log(`💨 Redraft cache hit: ${key}`);
        return res.json(cached);
      }

      console.log(`🔄 Redraft Engine: ${q.pos ?? "ALL"} positions with Sleeper data`);

      // Import here to avoid circular dependency
      const { sleeperSyncService } = await import('../services/sleeperSyncService');
      const all = await sleeperSyncService.getPlayers();
      
      let pool = all.filter((p: any) => ["QB","RB","WR","TE"].includes(p.position));
      if (q.pos) pool = pool.filter((p: any) => p.position === q.pos);
      if (q.team) pool = pool.filter((p: any) => p.team === q.team);
      if (q.search) {
        const s = q.search.toLowerCase();
        pool = pool.filter((p: any) =>
          String(p.full_name || "").toLowerCase().includes(s) ||
          String(p.first_name || "").toLowerCase().includes(s) ||
          String(p.last_name || "").toLowerCase().includes(s)
        );
      }

      // rank by ADP (asc), fallback to projected points (desc)
      pool.sort((a: any, b: any) => {
        const aAdp = a.adp ?? Infinity;
        const bAdp = b.adp ?? Infinity;
        if (aAdp !== bAdp) return aAdp - bAdp;
        return (b.projected_points ?? 0) - (a.projected_points ?? 0);
      });

      const total = pool.length;
      const start = (q.page - 1) * q.pageSize;
      const pageSlice = pool.slice(start, start + q.pageSize);

      const rows = pageSlice.map((p: any) => ({
        id: p.player_id,
        name: p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        team: p.team ?? null,
        position: p.position,
        age: p.age ?? null,
        adp: p.adp ?? null,
        projectedPoints: p.projected_points ?? null,
        value: p.adp ? (p.projected_points ?? 0) / p.adp : null,
        status: p.status ?? "Active",
        injuryStatus: p.injury_status ?? "Healthy",
      }));

      const payload = {
        ok: true,
        format: "redraft",
        data: rows,
        meta: {
          total,
          page: q.page,
          pageSize: q.pageSize,
          hasNext: q.page * q.pageSize < total,
          ts: new Date().toISOString(),
          source: "Sleeper API → Redraft Engine",
          filters: { pos: q.pos ?? null, team: q.team ?? null, search: q.search ?? null },
        },
      };

      respCache.set(key, payload);
      console.log(`✅ Redraft page generated: ${rows.length} players (total: ${total})`);
      res.json(payload);
    } catch (err: any) {
      console.error("❌ /api/redraft", err);
      res.status(400).json({ ok: false, error: err?.message ?? "Bad request" });
    }
  });
}