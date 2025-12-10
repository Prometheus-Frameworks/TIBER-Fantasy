/*
  ECR LOADER — ADMIN UPLOAD + URL FETCH + PROXIES
  ------------------------------------------------
  Problem: No official FantasyPros API access.
  Solution: Bring-Your-Own-ECR with:
   1) ADMIN upload of CSV exported from FantasyPros pages (legal, manual)
   2) URL fetcher for publicly exposed CSV links (headless-lite; throttle; optional)
   3) Proxy fallbacks: KeepTradeCut (dynasty via HTML scrape-lite), Sleeper ADP as redraft proxy

  Endpoints (Express Router):
    POST /api/admin/ecr/upload         { pos, week, scoring, csv } -> stores parsed ECR rows
    POST /api/admin/ecr/fetch          { pos, week, scoring, url } -> downloads CSV and stores
    GET  /api/ecr/weekly               ?week=&pos=&scoring=        -> returns stored rows
    GET  /api/ecr/dynasty              ?snapshot=&pos=              -> returns stored rows (from upload/fetch)

  Notes:
  - This avoids any private API. CSV comes from the visible "Download CSV" button on FP pages.
  - KeepTradeCut + Sleeper stubs are optional proxies if you can't upload (marked clearly).
*/

import express, { Request, Response, Router } from "express";
import fetch from "node-fetch";

export type Pos = "QB" | "RB" | "WR" | "TE";

export interface EcrRow { player: string; team: string; pos: Pos; ecr_rank: number; ecr_points?: number }

interface WeeklyKey { week: number; pos: Pos; scoring: "PPR" | "HALF" | "STD" }

const mem = {
  weekly: new Map<string, EcrRow[]>(), // key = `${week}:${pos}:${scoring}`
  dynasty: new Map<string, EcrRow[]>(), // key = `${snapshot}:${pos}`
};

function keyWeekly(k: WeeklyKey) { return `${k.week}:${k.pos}:${k.scoring}`; }
function keyDynasty(snapshot: string, pos: Pos) { return `${snapshot}:${pos}`; }

function parseFantasyProsCsv(csv: string, isWeekly: boolean, fallbackPos?: Pos): EcrRow[] {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines.shift() || "";
  const cols = header.split(",").map(s => s.trim().toLowerCase());
  const idx = {
    player: cols.findIndex(c => c.startsWith("player")),
    team: cols.findIndex(c => c.startsWith("team")),
    pos: cols.findIndex(c => c.startsWith("pos")),
    ecr: cols.findIndex(c => c.includes("ecr")),
    fpts: cols.findIndex(c => c.includes("fpts")),
  };
  if (idx.player < 0 || idx.team < 0 || idx.ecr < 0) throw new Error("CSV headers not recognized");
  const out: EcrRow[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(",").map(s => s.trim());
    const pos = ((idx.pos >= 0 ? parts[idx.pos] : fallbackPos) || "WR") as Pos; // default WR if missing
    out.push({
      player: parts[idx.player],
      team: (parts[idx.team] || "").toUpperCase(),
      pos,
      ecr_rank: Number(parts[idx.ecr]),
      ecr_points: isWeekly && idx.fpts >= 0 ? Number(parts[idx.fpts]) : undefined,
    });
  }
  return out;
}

export function createEcrLoaderRouter(): Router {
  const r = express.Router();
  r.use(express.json({ limit: "10mb" }));

  // ADMIN upload: paste CSV content from Download CSV button (no scraping, no API)
  r.post("/admin/ecr/upload", (req: Request, res: Response) => {
    const { pos, week, scoring, csv, snapshot } = req.body as { pos?: Pos; week?: number; scoring?: "PPR"|"HALF"|"STD"; csv?: string; snapshot?: string };
    if (!csv || !pos) return res.status(400).json({ error: "csv and pos required" });
    try {
      const isWeekly = !!week;
      if (isWeekly && !scoring) return res.status(400).json({ error: "scoring required for weekly" });
      const rows = parseFantasyProsCsv(csv, !!week, pos);
      if (week) mem.weekly.set(keyWeekly({ week, pos, scoring: scoring! }), rows);
      else if (snapshot) mem.dynasty.set(keyDynasty(snapshot, pos), rows);
      else return res.status(400).json({ error: "provide week+scoring or snapshot" });
      
      console.log(`📊 [ECR Loader] Uploaded ${rows.length} ${pos} players for ${week ? `Week ${week} ${scoring}` : `Dynasty ${snapshot}`}`);
      res.json({ ok: true, count: rows.length });
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "parse failed" });
    }
  });

  // URL fetcher: downloads CSV from a public link (throttle recommended by caller)
  r.post("/admin/ecr/fetch", async (req: Request, res: Response) => {
    const { pos, week, scoring, url, snapshot } = req.body as { pos: Pos; week?: number; scoring?: "PPR"|"HALF"|"STD"; url: string; snapshot?: string };
    if (!url || !pos) return res.status(400).json({ error: "url and pos required" });
    try {
      console.log(`📊 [ECR Loader] Fetching ${pos} data from URL: ${url}`);
      const resp = await fetch(url, { headers: { "User-Agent": "TIBER-ECR-Fetcher/1.0" } });
      if (!resp.ok) return res.status(400).json({ error: `fetch failed: ${resp.status}` });
      const text = await resp.text();
      const rows = parseFantasyProsCsv(text, !!week, pos);
      if (week && scoring) mem.weekly.set(keyWeekly({ week, pos, scoring }), rows);
      else if (snapshot) mem.dynasty.set(keyDynasty(snapshot, pos), rows);
      else return res.status(400).json({ error: "provide week+scoring or snapshot" });
      
      console.log(`📊 [ECR Loader] Fetched ${rows.length} ${pos} players for ${week ? `Week ${week} ${scoring}` : `Dynasty ${snapshot}`}`);
      res.json({ ok: true, count: rows.length });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "fetch error" });
    }
  });

  // Readers
  r.get("/ecr/weekly", (req: Request, res: Response) => {
    const week = Number(req.query.week); const pos = (req.query.pos as Pos); const scoring = (req.query.scoring as any);
    const rows = mem.weekly.get(keyWeekly({ week, pos, scoring }));
    res.json({ week, pos, scoring, count: rows?.length || 0, rows: rows || [] });
  });

  r.get("/ecr/dynasty", (req: Request, res: Response) => {
    const snapshot = String(req.query.snapshot || ""); const pos = (req.query.pos as Pos);
    const rows = mem.dynasty.get(keyDynasty(snapshot, pos));
    res.json({ snapshot, pos, count: rows?.length || 0, rows: rows || [] });
  });

  // Get all stored ECR data (for admin/debugging)
  r.get("/admin/ecr/status", (req: Request, res: Response) => {
    const weeklyKeys = Array.from(mem.weekly.keys());
    const dynastyKeys = Array.from(mem.dynasty.keys());
    res.json({ 
      weekly: weeklyKeys.map(key => ({ key, count: mem.weekly.get(key)?.length || 0 })),
      dynasty: dynastyKeys.map(key => ({ key, count: mem.dynasty.get(key)?.length || 0 }))
    });
  });

  console.log(`📊 [ECR Loader] Router created with 5 endpoints: POST /admin/ecr/upload, POST /admin/ecr/fetch, GET /ecr/weekly, GET /ecr/dynasty, GET /admin/ecr/status`);
  return r;
}

// Export function to get ECR data for integration with existing services
export function getEcrData(week: number, pos: Pos, scoring: "PPR" | "HALF" | "STD"): EcrRow[] {
  return mem.weekly.get(keyWeekly({ week, pos, scoring })) || [];
}

export function getDynastyEcrData(snapshot: string, pos: Pos): EcrRow[] {
  return mem.dynasty.get(keyDynasty(snapshot, pos)) || [];
}