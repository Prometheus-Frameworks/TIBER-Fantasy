import { Express, Request, Response } from "express";
import { z } from "zod";
import { LRUCache } from "lru-cache";
import { PlayerCompassService } from "../playerCompass";

const Query = z.object({
  format: z.enum(["dynasty", "redraft"]).default("dynasty"),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(10).max(200).optional(),
  team: z.string().max(3).optional(),
  search: z.string().max(64).optional(),
});

// cache whole response by key (fast path)
const respCache = new LRUCache<string, any>({ max: 200, ttl: 5 * 60 * 1000 });

export const registerCompassRoutes = (app: Express) => {
  const compassService = new PlayerCompassService();

  app.get("/api/compass/:position", async (req: Request, res: Response) => {
    try {
      // position is a PATH PARAM, not a query param
      const position = String(req.params.position || "").toUpperCase();
      if (!["WR", "RB", "TE", "QB"].includes(position)) {
        return res.status(400).json({ ok: false, error: "Invalid position. Use WR, RB, TE, or QB" });
      }

      console.log(`🔄 Live Compass: ${position} with Sleeper-synced data`);

      const q = Query.parse(req.query);
      const mode = q.format;
      // support either page/pageSize OR legacy limit
      const page = q.page ?? 1;
      const pageSize = q.pageSize ?? (q.limit ?? 50);
      const offset = (page - 1) * pageSize;

      // cache key includes filters
      const cacheKey = `compass:${position}:${mode}:${page}:${pageSize}:${q.team ?? ""}:${q.search ?? ""}`;
      const cached = respCache.get(cacheKey);
      if (cached) return res.json(cached);

      // 1) pull from Sleeper service (live data)
      const { sleeperSyncService } = await import('../services/sleeperSyncService');
      const allPlayers = await sleeperSyncService.getPlayers();

      // 2) filter by position + optional team/search
      let pool = allPlayers.filter((p: any) => p.position === position);
      if (q.team) pool = pool.filter((p: any) => p.team === q.team);
      if (q.search) {
        const s = q.search.toLowerCase();
        pool = pool.filter((p: any) =>
          String(p.name || "").toLowerCase().includes(s)
          || String(p.first_name || "").toLowerCase().includes(s)
          || String(p.last_name || "").toLowerCase().includes(s)
        );
      }

      const total = pool.length;

      // 3) paginate slice
      const slice = pool.slice(offset, offset + pageSize);

      // 4) map -> compass DTO using live stats/tags/draft info
      const results = await Promise.all(
        slice.map(async (p: any) => {
          const compassInput = {
            playerId: p.player_id,
            playerName: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.search_full_name,
            position: p.position,        // WR/RB/TE/QB
            team: p.team ?? null,
            age: p.age ?? null,
            rawStats: {
              ...(p.stats ?? {}),
              adp: p.adp ?? null,
              projectedPoints: p.projected_points ?? null,
              ownership: p.ownership_percent ?? null,
            },
            contextTags: p.tags ?? [],
            draftCapital: p.draft_pick ?? p.draftCapital ?? null,
            experience: p.years_exp ?? null,
          };

          const comp = compassService.generateCompassProfile(compassInput);
          
          // Convert CompassProfile to 4-directional scoring format
          const compassScore = (
            comp.scenarios.dynastyCeiling + 
            comp.scenarios.contendingTeam + 
            comp.scenarios.redraftAppeal + 
            comp.opportunityMetrics.usageSecurity
          ) / 4;

          return {
            id: p.player_id,
            player_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.search_full_name || p.name,
            name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.search_full_name || p.name,
            team: p.team ?? null,
            age: p.age ?? null,
            adp: p.adp ?? null,
            projected_points: p.projected_points ?? null,
            stats: p.stats ?? null,
            compass: {
              north: comp.scenarios.dynastyCeiling,
              east: comp.scenarios.contendingTeam,
              south: comp.scenarios.redraftAppeal,
              west: comp.opportunityMetrics.usageSecurity,
              score: compassScore,
            },
            dynastyScore: compassScore,
            tier: comp.tier,
            insights: comp.keyInsights,
          };
        })
      );

      // 5) stable sort: score desc, then ADP asc
      results.sort(
        (a: any, b: any) =>
          (b.dynastyScore ?? -1) - (a.dynastyScore ?? -1) ||
          (a.adp ?? 9999) - (b.adp ?? 9999)
      );

      const payload = {
        ok: true,
        position,
        format: mode,
        data: results,
        meta: {
          total,
          page,
          pageSize,
          hasNext: page * pageSize < total,
          ts: new Date().toISOString(),
          source: "Sleeper sync → Compass v2.0",
          filters: { team: q.team ?? null, search: q.search ?? null },
        },
      };

      respCache.set(cacheKey, payload);
      return res.json(payload);
    } catch (err: any) {
      console.error("❌ /api/compass/:position", err);
      return res.status(400).json({ ok: false, error: err?.message ?? "Bad request" });
    }
  });
};

// helpers
function tierFromScore(score: number | null, format: "dynasty" | "redraft", position: string) {
  if (score == null) return "Unrated";
  
  const prefix = position === "QB" ? "QB" : position === "TE" ? "TE" : position === "RB" ? "RB" : "WR";
  
  if (format === "dynasty") {
    if (score >= 8.5) return `Elite Dynasty ${prefix}`;
    if (score >= 7.5) return `${prefix}1 Dynasty Asset`;
    if (score >= 6.5) return `Solid Dynasty Hold`;
    return `Dynasty Depth`;
  } else {
    if (score >= 8.5) return `Must-Start ${prefix}`;
    if (score >= 7.5) return `Strong ${prefix}1`;
    if (score >= 6.5) return `Solid ${prefix} Option`;
    return position === "QB" ? "Streaming Option" : "Streaming/Flex";
  }
}

function quickInsightsForPosition(
  position: string,
  player: { age?: number | null; adp?: number | null; team?: string | null },
  comp: any
) {
  const out: string[] = [];
  const age = player.age ?? 99;
  const adp = player.adp ?? 999;
  
  // Age insights by position
  if (position === "QB" && age <= 26) out.push("Prime dynasty age");
  else if (position !== "QB" && age <= 25) out.push("Prime dynasty age");
  
  // ADP insights by position
  if (position === "QB" && adp <= 24) out.push("Market: top-2 rounds");
  else if (position === "TE" && adp <= 48) out.push("Market: top-4 rounds");
  else if (adp <= 36) out.push("Market: early rounds");
  
  // Compass-specific insights
  if (comp?.volume != null && comp.volume >= 8) {
    if (position === "QB") out.push("Passing volume");
    else if (position === "TE") out.push("Target volume");
    else out.push("High volume role");
  }
  
  if (comp?.talent != null && comp.talent >= 8) {
    if (position === "QB") out.push("Dual-threat ability");
    else if (position === "TE") out.push("Red zone threat");
    else out.push("Elite talent profile");
  }
  
  if (comp?.environment != null && comp.environment < 5) {
    if (position === "QB") out.push("O-line/system risk");
    else out.push("Usage concern");
  }
  
  return out;
}