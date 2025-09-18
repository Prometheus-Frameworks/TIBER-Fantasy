/*
  CONSENSUS BENCHMARK SERVICE — UNIFIED + ROBUST + LOW-MAINTENANCE
  -----------------------------------------------------------------
  Goal: Give the site a stable "awareness of consensus" (weekly + ROS),
  without depending on a single provider. ECR becomes a *benchmark*, not a blocker.

  What this provides:
  - A single API to query consensus by kind: weekly | ros | dynasty
  - Pluggable adapters (FantasyPros CSV upload/mirror, Sleeper ADP, KTC dynasty)
  - Normalization to a common shape: ConsensusRank + ConsensusPoints (optional)
  - Fallback policy + health/staleness metrics so UI can show status badges
  - Rapport helpers: quick sentences comparing *our* rank vs consensus (personality)

  Endpoints (Express router):
    GET  /api/consensus/:kind?pos=&week=&scoring=   -> { rows, source, staleness, coverage }
    GET  /api/consensus/rapport?pos=&week=          -> [{ player_id, summary_line }]

  Plug it next to your compass engine & ecr-loader.
*/

import express, { Request, Response, Router } from "express";
import fetch from "node-fetch";

export type Kind = "weekly" | "ros" | "dynasty";
export type Pos = "QB" | "RB" | "WR" | "TE";

export interface ConsensusRow {
  player_id?: string;     // optional if you map later
  player: string;         // display name
  team?: string;
  pos: Pos;
  rank: number;           // lower is better
  points?: number;        // optional — projections or ROS pts
  source: string;         // e.g. "FantasyPros:CSV" | "Sleeper:ADP" | "KTC"
}

export interface Provider {
  kind: Kind;
  name: string;
  load(opts: { pos: Pos; week?: number; scoring?: "PPR"|"HALF"|"STD"; snapshot?: string }): Promise<ConsensusRow[]>;
  freshness(): Promise<{ updated_at?: string }>; // can be a stub
}

/********************
 * PROVIDERS
 ********************/

// 1) FantasyPros via your existing admin upload/mirror
export class FantasyProsProvider implements Provider {
  kind: Kind;
  name = "FantasyPros:CSV";
  constructor(kind: Kind, private baseUrl: string) { this.kind = kind; }
  async load(opts: { pos: Pos; week?: number; scoring?: "PPR"|"HALF"|"STD"; snapshot?: string }): Promise<ConsensusRow[]> {
    try {
      const u = new URL(this.kind === "weekly" ? `${this.baseUrl}/ecr/weekly` : `${this.baseUrl}/ecr/dynasty`);
      if (this.kind === "weekly") {
        u.searchParams.set("week", String(opts.week || 1));
        u.searchParams.set("pos", opts.pos);
        u.searchParams.set("scoring", String(opts.scoring || "PPR"));
      } else {
        u.searchParams.set("snapshot", String(opts.snapshot || "latest"));
        u.searchParams.set("pos", opts.pos);
      }
      const res = await fetch(u.toString(), { 
        headers: { "User-Agent": "OTC-Consensus/1.0" },
        timeout: 5000 
      });
      if (!res.ok) {
        console.warn(`[Consensus] FantasyPros provider failed: ${res.status}`);
        return [];
      }
      const json = await res.json();
      const rows: any[] = json.rows || [];
      return rows.map(r => ({ 
        player: r.player, 
        team: r.team, 
        pos: r.pos, 
        rank: r.ecr_rank || r.rank, 
        points: r.ecr_points || r.points, 
        source: this.name 
      }));
    } catch (error) {
      console.warn(`[Consensus] FantasyPros provider error:`, error);
      return [];
    }
  }
  async freshness() { return { updated_at: new Date().toISOString() }; }
}

// 2) Sleeper ADP as a consensus proxy for weekly if no FP data
export class SleeperAdpProvider implements Provider {
  kind: Kind = "weekly";
  name = "Sleeper:ADP";
  constructor(private season: number, private type: "redraft"|"dynasty" = "redraft") {}
  async load(opts: { pos: Pos }): Promise<ConsensusRow[]> {
    try {
      const url = `https://api.sleeper.app/v1/adp/nfl/ppr?season=${this.season}&type=${this.type}`;
      const res = await fetch(url, { 
        headers: { "User-Agent": "OTC-Consensus/1.0" },
        timeout: 5000
      });
      if (!res.ok) {
        console.warn(`[Consensus] Sleeper ADP provider failed: ${res.status}`);
        return [];
      }
      const data = await res.json();
      // data is array with player_id, player_name, pos, team, adp
      // Filter by position, map ADP -> rank (1..N)
      const byPos = (data as any[]).filter(r => r.position === opts.pos);
      byPos.sort((a, b) => a.adp - b.adp);
      return byPos.map((r, i) => ({
        player_id: String(r.player_id),
        player: r.player_name,
        team: r.team,
        pos: r.position,
        rank: i + 1,
        source: this.name,
      }));
    } catch (error) {
      console.warn(`[Consensus] Sleeper ADP provider error:`, error);
      return [];
    }
  }
  async freshness() { return { updated_at: new Date().toISOString() }; }
}

// 3) Enhanced ECR Provider Integration
export class EnhancedEcrProvider implements Provider {
  kind: Kind;
  name = "EnhancedECR";
  
  constructor(kind: Kind, private enhancedEcrService: any) { 
    this.kind = kind;
  }
  
  async load(opts: { pos: Pos; week?: number; scoring?: "PPR"|"HALF"|"STD"; snapshot?: string }): Promise<ConsensusRow[]> {
    try {
      let features: any[] = [];
      
      if (this.kind === "weekly" && opts.week) {
        features = await this.enhancedEcrService.getWeeklyFeatures(opts.week, opts.pos, opts.scoring || "PPR");
      } else if (this.kind === "dynasty") {
        features = await this.enhancedEcrService.getDynastyFeatures(opts.pos, opts.snapshot || "current");
      } else if (this.kind === "ros") {
        features = await this.enhancedEcrService.getRosFeatures(opts.pos, opts.scoring || "PPR");
      }
      
      return features.map(f => ({
        player_id: f.player_id,
        player: f.name,
        team: f.team,
        pos: f.pos,
        rank: f.ecr_rank,
        points: f.ecr_points,
        source: this.name,
      }));
    } catch (error) {
      console.warn(`[Consensus] Enhanced ECR provider error:`, error);
      return [];
    }
  }
  
  async freshness() { return { updated_at: new Date().toISOString() }; }
}

// 4) KeepTradeCut (dynasty proxy) — optional stub with lightweight HTML parsing later
export class KtcDynastyStubProvider implements Provider {
  kind: Kind = "dynasty";
  name = "KTC:Stub";
  async load(opts: { pos: Pos }): Promise<ConsensusRow[]> {
    // Placeholder: return empty -> acts as a low-priority fallback
    return [];
  }
  async freshness() { return { updated_at: undefined }; }
}

/********************
 * NORMALIZER + POLICY
 ********************/

export interface ConsensusPolicy {
  order: string[]; // provider names in priority order
  min_rows: number; // require at least this many rows to accept a provider
}

export async function pickConsensus(
  providers: Provider[],
  policy: ConsensusPolicy,
  query: { kind: Kind; pos: Pos; week?: number; scoring?: "PPR"|"HALF"|"STD"; snapshot?: string }
): Promise<{ rows: ConsensusRow[]; source: string; staleness: number; coverage: number }>
{
  console.log(`[Consensus] Searching for ${query.kind} ${query.pos} data using policy:`, policy.order);
  
  for (const providerName of policy.order) {
    const p = providers.find(pp => pp.name === providerName && pp.kind === query.kind);
    if (!p) continue;
    
    console.log(`[Consensus] Trying provider: ${providerName}`);
    const rows = await p.load({ pos: query.pos, week: query.week, scoring: query.scoring, snapshot: query.snapshot });
    
    if ((rows?.length || 0) >= policy.min_rows) {
      console.log(`[Consensus] Provider ${providerName} succeeded with ${rows.length} rows`);
      const fresh = await p.freshness();
      const updatedAt = fresh.updated_at ? Date.parse(fresh.updated_at) : Date.now();
      const staleness = Math.max(0, Date.now() - updatedAt);
      // Coverage is trivial here (you can map to your roster later); expose % of rows available
      const coverage = rows.length;
      return { rows, source: p.name, staleness, coverage };
    } else {
      console.log(`[Consensus] Provider ${providerName} failed: ${rows?.length || 0} rows < ${policy.min_rows} minimum`);
    }
  }
  
  console.warn(`[Consensus] No provider succeeded for ${query.kind} ${query.pos}`);
  return { rows: [], source: "none", staleness: Infinity, coverage: 0 };
}

/********************
 * RAPPORT (personality lines)
 ********************/
export function rapportLine(
  player: string,
  ourRank: number | undefined,
  consensusRank: number | undefined
): string {
  if (ourRank == null || consensusRank == null) return `${player}: no comparison yet — gathering signal.`;
  const diff = consensusRank - ourRank; // positive = we're higher
  if (diff >= 8) return `${player}: Compass is pounding the table — up ${diff} spots vs consensus.`;
  if (diff >= 3) return `${player}: We like him more than the herd (+${diff}).`;
  if (diff <= -8) return `${player}: Compass is out — consensus is late to the fade (${diff}).`;
  if (diff <= -3) return `${player}: Cooler on him than ECR (${diff}).`;
  return `${player}: Aligned with consensus (±2).`;
}

/********************
 * EXPRESS ROUTER
 ********************/
export function createConsensusRouter(opts: {
  baseUrlForFantasyProsApi: string; // your own server where ecr-loader serves /ecr/*
  season: number;
  enhancedEcrService?: any; // optional enhanced ECR service integration
}): Router {
  const r = express.Router();

  const providers: Provider[] = [
    new FantasyProsProvider("weekly", opts.baseUrlForFantasyProsApi),
    new FantasyProsProvider("ros", opts.baseUrlForFantasyProsApi),
    new FantasyProsProvider("dynasty", opts.baseUrlForFantasyProsApi),
    new SleeperAdpProvider(opts.season, "redraft"),
    new SleeperAdpProvider(opts.season, "dynasty"),
    new KtcDynastyStubProvider(),
  ];
  
  // Add Enhanced ECR Provider if available
  if (opts.enhancedEcrService) {
    providers.push(
      new EnhancedEcrProvider("weekly", opts.enhancedEcrService),
      new EnhancedEcrProvider("ros", opts.enhancedEcrService),
      new EnhancedEcrProvider("dynasty", opts.enhancedEcrService)
    );
  }

  // Provider priority by kind - Enhanced ECR gets priority since it has rich feature data
  const policyByKind: Record<Kind, ConsensusPolicy> = {
    weekly:  { order: ["EnhancedECR", "FantasyPros:CSV", "Sleeper:ADP"], min_rows: 5 }, // Lower min for testing
    ros:     { order: ["EnhancedECR", "FantasyPros:CSV"], min_rows: 5 },
    dynasty: { order: ["EnhancedECR", "FantasyPros:CSV", "KTC:Stub"], min_rows: 5 },
  };

  r.get("/consensus/:kind", async (req: Request, res: Response) => {
    try {
      const kind = req.params.kind as Kind;
      const pos = req.query.pos as Pos;
      const week = req.query.week ? Number(req.query.week) : undefined;
      const scoring = (req.query.scoring as any) || "PPR";
      const snapshot = req.query.snapshot ? String(req.query.snapshot) : undefined;

      const policy = policyByKind[kind];
      if (!policy) return res.status(400).json({ error: "invalid kind" });

      const out = await pickConsensus(providers, policy, { kind, pos, week, scoring, snapshot });
      res.json(out);
    } catch (error) {
      console.error('[Consensus] API error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Rapport demo endpoint — expects you to pass our ranks for comparison
  r.post("/consensus/rapport", async (req: Request, res: Response) => {
    try {
      const { rows, ourRanks } = req.body as { rows: ConsensusRow[]; ourRanks: Record<string, number> };
      const msgs = rows.slice(0, 50).map(r => {
        const key = (r.player_id || `${r.team}-${r.player}`).toLowerCase();
        const our = ourRanks[key];
        return { player: r.player, line: rapportLine(r.player, our, r.rank) };
      });
      res.json({ count: msgs.length, msgs });
    } catch (error) {
      console.error('[Consensus] Rapport API error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return r;
}

/*
HOW TO WIRE
----------
import express from "express";
import { createConsensusRouter } from "./consensus-benchmark";

const app = express();
app.use(express.json());
app.use("/api", createConsensusRouter({ baseUrlForFantasyProsApi: "http://localhost:3000/api", season: 2025 }));
app.listen(3100, () => console.log("Consensus benchmark ready on :3100"));

Frontend tips:
- Hit GET /api/consensus/weekly?pos=WR&week=3&scoring=PPR → table of consensus rows with source + staleness ms.
- Add a badge: source name (FantasyPros vs Sleeper) + freshness (e.g., "Updated 2h ago").
- When rendering players, call POST /api/consensus/rapport with ourRanks to get mini one-liners for the UI.
*/