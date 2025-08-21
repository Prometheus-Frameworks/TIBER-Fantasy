// ragRoutes.ts — RAG-for-OTC (Node inline) | v0.3
// Plug this router into your existing Express app.
// Env (optional):
//   RAG_DB=rag_news.db
//   NEWS_MAX_AGE_DAYS=21
//   RAG_TOPK=5
//   RAG_MIN_SOURCES=2

import express from "express";
import Database from "better-sqlite3";
// @ts-ignore
import RSSParser from "rss-parser";
import * as cheerio from "cheerio";
// @ts-ignore
import bm25Factory from "wink-bm25-text-search";
import { createHash } from "crypto";
// @ts-ignore
import { loadLexicon, enrichText } from "./rag_lexicon.js";

const ESPN_RSS = process.env.ESPN_RSS || "https://www.espn.com/espn/rss/nfl/news";
const NFL_RSS = process.env.NFL_RSS || "https://www.nfl.com/rss/rsslanding?searchString=news";
const NFL_NEWS_FALLBACK = process.env.NFL_NEWS_FALLBACK || "https://www.nfl.com/news/";
const DB_PATH = process.env.RAG_DB || "rag_news.db";

const NEWS_MAX_AGE_DAYS = Number(process.env.NEWS_MAX_AGE_DAYS || 21);
const RAG_TOPK = Number(process.env.RAG_TOPK || 5);
const RAG_MIN_SOURCES = Number(process.env.RAG_MIN_SOURCES || 2);

// ----- tiny utils
const norm = (s = "") => s.toLowerCase().replace(/[^a-z]/g, "");
const sha = (s: string) => cryptoHash(s).slice(0, 32);
const cryptoHash = (s: string) => createHash("sha256").update(s).digest("hex");
function parseIsoOrNow(iso?: string) {
  const d = new Date(iso || Date.now());
  return isNaN(d.getTime()) ? new Date() : d;
}
function withinAge(iso?: string, maxDays = NEWS_MAX_AGE_DAYS) {
  const d = parseIsoOrNow(iso);
  const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  return days <= maxDays;
}
function recencyBoost(iso?: string) {
  const d = parseIsoOrNow(iso);
  const days = Math.max(0, (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  return 1 / (1 + (days / 7)); // ~1 fresh, ~0.5 @ 7d, ~0.25 @ 21d
}

// ----- DB
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    source TEXT,
    title TEXT,
    url TEXT,
    published_at TEXT,
    text TEXT,
    team_tags TEXT,
    player_ids TEXT
  );
  CREATE TABLE IF NOT EXISTS rag_players (
    player_id TEXT PRIMARY KEY,
    name TEXT,
    team TEXT,
    position TEXT,
    name_key TEXT
  );
`);

// ----- BM25 index (in-memory; rebuilt on ingest)
let bm25 = bm25Factory();
let _docs = new Map(); // id -> {title,text,published_at,source}

function buildIndex() {
  // Create new BM25 instance (wink-bm25 doesn't have clear method)
  bm25 = bm25Factory();
  bm25.defineConfig({
    fldWeights: { body: 1 },
    bm25Params: { k1: 1.2, b: 0.75, k: 1 }
  });
  _docs.clear();

  // Pull distinct rows in a stable order
  const rows = db
    .prepare("SELECT DISTINCT id, title, text, published_at, source FROM articles ORDER BY published_at DESC")
    .all() as any[];

  for (const r of rows) {
    const text = `${r.title ?? ""} ${r.text ?? ""}`.trim();
    if (!text) continue;

    // wink-bm25-text-search wants (docObject, docId) and docId must be unique
    // We're already using a SHA256 for r.id, so just stringify it.
    bm25.addDoc({ body: text, id: String(r.id) }, String(r.id));
    _docs.set(r.id, r);
  }

  bm25.consolidate();
  console.log(`BM25 index rebuilt: ${_docs.size} docs`);
}

// ----- Sleeper dictionary sync (from your existing players table/service)
async function loadPlayersFromSleeper() {
  const url = "https://api.sleeper.app/v1/players/nfl";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sleeper ${res.status}`);
  const data = await res.json();

  const up = db.prepare(`
    INSERT INTO rag_players (player_id, name, team, position, name_key)
    VALUES (@player_id, @name, @team, @position, @name_key)
    ON CONFLICT(player_id) DO UPDATE SET
      name=excluded.name, team=excluded.team, position=excluded.position, name_key=excluded.name_key
  `);

  const tx = db.transaction((arr: any[]) => arr.forEach((p: any) => up.run(p)));
  const rows = [];
  for (const [pid, p] of Object.entries(data as any)) {
    if (!p || typeof p !== "object") continue;
    const playerData = p as any;
    const name = playerData.full_name || `${playerData.first_name || ""} ${playerData.last_name || ""}`.trim();
    if (!name || !playerData.position) continue;
    rows.push({
      player_id: pid,
      name,
      team: playerData.team || null,
      position: playerData.position,
      name_key: norm(name),
    });
  }
  tx(rows);
}

function nameToPlayerIds(text: string) {
  const keys = db.prepare("SELECT player_id, name_key FROM rag_players").all();
  const nt = norm(text || "");
  const hits = [];
  for (const entry of keys as any[]) {
    const { player_id, name_key } = entry;
    if (!name_key) continue;
    if (nt.includes(name_key)) hits.push(player_id);
  }
  return Array.from(new Set(hits));
}

// ----- Ingest
const parser = new RSSParser();

async function fetchEspn() {
  try {
    const feed = await parser.parseURL(ESPN_RSS);
    return (feed.items || []).map((e: any) => ({
      source: "ESPN",
      title: (e.title || "").trim(),
      url: (e.link || "").trim(),
      published_at: e.isoDate || e.pubDate || new Date().toISOString(),
      text: (e.contentSnippet || e.content || "").toString().trim(),
    })).filter((x: any) => x.title && x.url);
  } catch (e) {
    console.warn("ESPN RSS failed:", e);
    return [];
  }
}

async function fetchNflRss() {
  try {
    const feed = await parser.parseURL(NFL_RSS);
    return (feed.items || []).map((e: any) => ({
      source: "NFL",
      title: (e.title || "").trim(),
      url: (e.link || "").trim(),
      published_at: e.isoDate || e.pubDate || new Date().toISOString(),
      text: (e.contentSnippet || e.content || "").toString().trim(),
    })).filter((x: any) => x.title && x.url);
  } catch (e) {
    console.warn("NFL RSS failed:", e);
    return [];
  }
}

async function fetchNflFallback() {
  try {
    const response = await fetch(NFL_NEWS_FALLBACK, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OTC-RAG/1.0)' }
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    const items: any[] = [];
    $("a[href*='/news/']").each((_, a) => {
      const title = $(a).text().trim();
      let url = $(a).attr("href");
      if (!title || !url) return;
      if (!/^https?:\/\//i.test(url)) url = `https://www.nfl.com${url}`;
      items.push({
        source: "NFL",
        title,
        url,
        published_at: new Date().toISOString(),
        text: title,
      });
    });
    return (items as any[]).slice(0, 20); // limit fallback results
  } catch (e) {
    console.warn("NFL fallback failed:", e);
    return [];
  }
}

async function fetchArticleBody(url: string) {
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OTC-RAG/1.0)' }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const paras = $("p").map((_, p) => $(p).text().trim()).get();
    return paras.slice(0, 12).join(" ");
  } catch {
    return "";
  }
}

async function upsertArticles(items: any[]) {
  const ins = db.prepare(`
    INSERT INTO articles (id, source, title, url, published_at, text, team_tags, player_ids)
    VALUES (@id, @source, @title, @url, @published_at, @text, @team_tags, @player_ids)
    ON CONFLICT(id) DO UPDATE SET text=excluded.text, team_tags=excluded.team_tags, player_ids=excluded.player_ids
  `);
  const tx = db.transaction((rows: any[]) => rows.forEach((r: any) => ins.run(r)));

  const rows = [];
  for (const it of items) {
    if (!withinAge(it.published_at)) continue;
    let body = it.text || "";
    if (body.length < 280) body = await fetchArticleBody(it.url);
    const pids = nameToPlayerIds(`${it.title} ${body}`);
    const id = cryptoHash(`${it.source}|${it.title}|${it.url}|${it.published_at}`);
    rows.push({
      id,
      source: it.source,
      title: it.title,
      url: it.url,
      published_at: it.published_at,
      text: body,
      team_tags: JSON.stringify([]),
      player_ids: JSON.stringify(pids),
    });
  }
  tx(rows);
}

async function ingestAll() {
  try { 
    await loadPlayersFromSleeper(); 
    console.log("✅ RAG: Loaded Sleeper players");
  } catch (e: any) { 
    console.warn("RAG: Sleeper load failed:", e.message); 
  }
  
  const espn = await fetchEspn();
  console.log(`✅ RAG: Fetched ${espn.length} ESPN articles`);
  
  let nfl = await fetchNflRss();
  if (!nfl?.length) {
    nfl = await fetchNflFallback();
    console.log(`✅ RAG: Used NFL fallback, got ${nfl.length} articles`);
  } else {
    console.log(`✅ RAG: Fetched ${nfl.length} NFL RSS articles`);
  }
  
  await upsertArticles([...(espn || []), ...(nfl || [])]);
  console.log("✅ RAG: Articles stored");
  
  buildIndex();
  console.log("✅ RAG: Search index built");
}

// ----- Retrieval + generation
function retrieveArticles({ playerId, topic }: { playerId?: string, topic?: string }) {
  // candidate set: any article that mentions playerId, plus bm25 on topic
  const candMap = new Map();

  if (playerId) {
    const rows = db.prepare("SELECT * FROM articles").all();
    for (const r of rows as any[]) {
      try {
        const ids = JSON.parse(r.player_ids || "[]");
        if (ids.includes(playerId)) candMap.set(r.id, r);
      } catch {}
    }
  }

  if (topic && topic.trim()) {
    try {
      const scored = bm25.search(topic);
      for (const s of scored.slice(0, 50)) {
        const r = _docs.get(s[0]); // id
        if (r) candMap.set(r.id, db.prepare("SELECT * FROM articles WHERE id=?").get(r.id));
      }
    } catch (e) {
      console.warn("BM25 search failed:", e);
    }
  }

  // score with (bm25 if topic) + recency
  const out = [];
  let topicVec = [];
  try {
    topicVec = topic && topic.trim() ? bm25.search(topic) : [];
  } catch (e) {
    console.warn("BM25 topic search failed:", e);
    topicVec = [];
  }
  const tScore = new Map(topicVec); // id -> score

  for (const r of Array.from(candMap.values())) {
    const base = topic ? (tScore.get(r.id) || 0) : 0;
    const fresh = recencyBoost(r.published_at || "");
    const score = 0.6 * (base as number) + 0.4 * fresh;
    out.push({ score, r });
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, RAG_TOPK).map(x => x.r);
}

function synthTake(player: any, topic: string, rows: any[]) {
  const name = player?.name || "Unknown";
  const team = player?.team || "";
  const pos = player?.position || "";
  
  if (!rows?.length) {
    const txt = `${name} (${team}, ${pos}) has no credible updates in the last ${NEWS_MAX_AGE_DAYS} days. Default to price vs role.`;
    return {
      headline: `${name}: no fresh news; stay rational`,
      take: `• ${txt}\n• Why fade: if the market chases camp fluff.\n• Confidence: 55/100`,
      verdict: "HOLD",
      confidence: 55,
      facts: { team, position: pos, topic, articles_considered: 0 },
      citations: []
    };
  }
  
  const latest = rows[0];
  const dt = (latest.published_at || "").slice(0, 10);
  const sources = Array.from(new Set(rows.map(x => x.source).filter(Boolean))).join(", ");
  let verdict = "HOLD";
  const blob = `${latest.title || ""} ${latest.text || ""}`.toLowerCase();

  if (/\b(starting|starter|elevated|increased snaps|role expands|returns from|activated)\b/.test(blob)) verdict = "BUY";
  if (/\b(injury|torn|out for|placed on ir|suspended|arrest|demoted)\b/.test(blob)) verdict = "SELL";

  const conf = verdict === "HOLD" ? 58 : 65;

  // Generate base body text
  const body = `• Pulling ${rows.length} recent items (${sources}). Topic='${topic || 'general'}'.\n• Why fade: if the date/source are weak or hype outruns role.\n• Confidence: ${conf}/100`;

  // Enrich with lexicon
  const enriched = enrichText(body, blob);
  const confAdj = Math.max(-5, Math.min(5, enriched.delta));
  const finalConf = Math.max(0, Math.min(100, conf + confAdj));
  const takeText = enriched.text;

  return {
    headline: `${name}: actionable update (${dt})`,
    take: takeText,
    verdict,
    confidence: finalConf,
    facts: { team, position: pos, topic, articles_considered: rows.length },
    citations: rows.map(r => ({ title: r.title, url: r.url, published_at: r.published_at, source: r.source }))
  };
}

// ----- Router factory
export function createRagRouter() {
  const router = express.Router();

  // health check
  router.get("/health", (req, res) => {
    try {
      const articleCount = db.prepare("SELECT COUNT(*) as count FROM articles").get() as any;
      const playerCount = db.prepare("SELECT COUNT(*) as count FROM rag_players").get() as any;
      res.json({ 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        articles: articleCount.count || 0,
        players: playerCount.count || 0
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // admin: ingest
  router.post("/admin/ingest", async (req, res) => {
    try {
      await ingestAll();
      const articleCount = db.prepare("SELECT COUNT(*) as count FROM articles").get() as any;
      res.json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        articles_stored: articleCount.count || 0 
      });
    } catch (e: any) {
      console.error("RAG ingest error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // players search by name (against our local table)
  router.get("/api/players/search", (req, res) => {
    const name = String(req.query.name || "").trim();
    if (!name) return res.status(400).json({ error: "name required" });
    const key = `%${norm(name)}%`;
    const rows = db.prepare("SELECT player_id, name, team, position FROM rag_players WHERE name_key LIKE ? LIMIT 10").all(key);
    res.json({ results: rows });
  });

  // get recent articles for news summary
  router.get("/api/recent", (req, res) => {
    try {
      const days = Number(req.query.days || 7);
      const limit = Number(req.query.limit || 20);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffISO = cutoffDate.toISOString();
      
      const rows = db.prepare(`
        SELECT title, source, published_at, text, url 
        FROM articles 
        WHERE published_at >= ? 
        ORDER BY published_at DESC 
        LIMIT ?
      `).all(cutoffISO, limit);
      
      res.json({ articles: rows, count: rows.length, days_back: days });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // generate take
  router.get("/api/take", (req, res) => {
    const playerId = String(req.query.player_id || "").trim();
    const topic = String(req.query.topic || "").trim();

    if (!playerId) return res.status(400).json({ error: "player_id required" });
    const p = db.prepare("SELECT player_id, name, team, position FROM rag_players WHERE player_id=?").get(playerId);
    if (!p) return res.status(404).json({ error: "unknown player_id" });

    const rows = retrieveArticles({ playerId, topic });
    const payload = synthTake(p, topic, rows);

    // guardrail: ensure at least RAG_MIN_SOURCES citations if topic provided
    if ((payload.citations?.length || 0) < RAG_MIN_SOURCES && topic) {
      payload.take += `\n• Warning: only ${payload.citations?.length || 0} sources found for '${topic}'`;
      payload.confidence = Math.max(45, payload.confidence - 10);
    }

    res.json(payload);
  });

  // admin endpoints for maintenance
  router.post("/admin/rag/reindex", (req, res) => {
    try { 
      buildIndex(); 
      res.json({ status: "ok", indexed: _docs.size }); 
    } catch (e: any) { 
      res.status(500).json({ error: e.message }); 
    }
  });

  router.get("/admin/rag/status", (req, res) => {
    const total = db.prepare("SELECT COUNT(*) AS n FROM articles").get() as any;
    res.json({ articles: total.n, indexed: _docs.size });
  });

  return router;
}

// Initialize RAG on boot
export async function initRagOnBoot() {
  try {
    // Load lexicon on boot
    if (process.env.FF_LEXICON_ENABLED !== "0") {
      const ok = loadLexicon(process.env.FF_LEXICON_PATH || "./fantasy_lexicon.v1.json");
      console.log(`🤖 RAG: Lexicon ${ok ? "loaded" : "not loaded"}`);
    }
    buildIndex();
    console.log("🤖 RAG: Search index rebuilt on boot");
  } catch (e) {
    console.warn("🤖 RAG: Index initialization skipped (no data yet)");
  }
}