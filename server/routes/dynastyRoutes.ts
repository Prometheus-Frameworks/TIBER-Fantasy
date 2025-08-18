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

const pageCache = new LRUCache<string, any>({ max: 200, ttl: 5 * 60 * 1000 });
const perPlayerCache = new LRUCache<string, any>({ max: 5000, ttl: 10 * 60 * 1000 });

export function registerDynastyRoutes(app: Express) {
  app.get("/api/dynasty", async (req: Request, res: Response) => {
    try {
      const q = Query.parse(req.query);
      const key = `dynasty:${q.pos ?? "ALL"}:${q.team ?? ""}:${q.search ?? ""}:${q.page}:${q.pageSize}`;
      const cached = pageCache.get(key);
      if (cached) {
        console.log(`💨 Dynasty cache hit: ${key}`);
        return res.json(cached);
      }

      console.log(`🔄 Dynasty Engine: ${q.pos ?? "ALL"} positions with Compass scoring`);

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

      // Seed order: ADP asc then age asc (younger first), then name — cheap pre-sort
      pool.sort((a: any, b: any) =>
        (a.adp ?? Infinity) - (b.adp ?? Infinity) ||
        (a.age ?? 99) - (b.age ?? 99) ||
        String(a.full_name ?? "").localeCompare(String(b.full_name ?? ""))
      );

      const total = pool.length;
      const start = (q.page - 1) * q.pageSize;
      const slice = pool.slice(start, start + q.pageSize);

      // Import compass service
      const { PlayerCompassService } = await import('../playerCompass');
      const playerCompassService = new PlayerCompassService();

      const rows = await Promise.all(
        slice.map(async (p: any) => {
          const pid = p.player_id;
          const ck = `comp:${pid}:dynasty`;
          let comp = perPlayerCache.get(ck);
          
          if (!comp) {
            const input = {
              playerId: pid,
              playerName: p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
              position: p.position,
              team: p.team ?? null,
              age: p.age ?? null,
              rawStats: {
                ...(p.stats ?? {}),
                adp: p.adp ?? null,
                projectedPoints: p.projected_points ?? null,
                ownership: p.ownership_percent ?? null,
              },
              contextTags: p.tags ?? [],
              draftCapital: p.draft_pick ?? null,
              experience: p.years_exp ?? null,
            };

            // Generate compass profile using existing service
            const compassProfile = playerCompassService.generateCompassProfile(input);
            
            // Calculate dynasty score from compass components
            const dynastyScore = (
              compassProfile.scenarios.dynastyCeiling + 
              compassProfile.scenarios.contendingTeam + 
              compassProfile.scenarios.redraftAppeal + 
              compassProfile.opportunityMetrics.usageSecurity
            ) / 4;

            comp = {
              score: dynastyScore,
              tier: compassProfile.tier,
              insights: compassProfile.keyInsights,
              north: compassProfile.scenarios.dynastyCeiling,
              east: compassProfile.scenarios.contendingTeam,
              south: compassProfile.scenarios.redraftAppeal,
              west: compassProfile.opportunityMetrics.usageSecurity,
            };

            perPlayerCache.set(ck, comp);
          }
          
          return {
            id: pid,
            name: p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
            team: p.team ?? null,
            position: p.position,
            age: p.age ?? null,
            draftPick: p.draft_pick ?? null,
            yearsExp: p.years_exp ?? null,
            adp: p.adp ?? null,
            projectedPoints: p.projected_points ?? null,
            dynastyScore: comp.score,
            tier: comp.tier,
            insights: comp.insights ?? [],
            compass: { north: comp.north, east: comp.east, south: comp.south, west: comp.west },
          };
        })
      );

      // Sort *within the page* by dynastyScore desc, then ADP asc
      rows.sort(
        (a: any, b: any) =>
          (b.dynastyScore ?? -1) - (a.dynastyScore ?? -1) ||
          (a.adp ?? 9999) - (b.adp ?? 9999)
      );

      const payload = {
        ok: true,
        format: "dynasty",
        data: rows,
        meta: {
          total,
          page: q.page,
          pageSize: q.pageSize,
          hasNext: q.page * q.pageSize < total,
          ts: new Date().toISOString(),
          source: "Sleeper API → Dynasty Engine (Compass-powered)",
          filters: { pos: q.pos ?? null, team: q.team ?? null, search: q.search ?? null },
        },
      };

      pageCache.set(key, payload);
      console.log(`✅ Dynasty page generated: ${rows.length} players with Compass scores (total: ${total})`);
      res.json(payload);
    } catch (err: any) {
      console.error("❌ /api/dynasty", err);
      res.status(400).json({ ok: false, error: err?.message ?? "Bad request" });
    }
  });
}