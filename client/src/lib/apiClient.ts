// client/src/lib/apiClient.ts

// ---------- Shared primitives ----------
export type Pos = "QB" | "RB" | "WR" | "TE";
export type HealthStatus = "ok" | "stale" | "down";

export interface EnvelopeMeta {
  rows?: number;
  season?: number;
  ts?: number; // epoch seconds
}

export interface RowsEnvelope<T> {
  ok: boolean;
  data: T[];
  meta?: EnvelopeMeta;
}
export interface RowEnvelope<T> {
  ok: boolean;
  data: T;
  meta?: EnvelopeMeta;
}

// ---------- Shared objects ----------
export interface PlayerLite {
  id: string;
  name: string;
  team: string; // 3-letter
  pos: Pos;
}

export interface Compass {
  north: number; east: number; south: number; west: number;
}

export interface RedraftRow extends PlayerLite {
  rank?: number;
  proj_pts?: number;
  tier?: string;
  adp?: number;
}

export interface DynastyRow extends PlayerLite {
  age?: number;
  tier?: string;
  vorp: number;
  season: number;
  market_adp?: number;
  risk?: "Low" | "Medium" | "High" | string;
}

export interface OasisTeamRow {
  team: string;
  off_env?: number;
  pass_block?: number;
  pace?: number;
  target_dist?: Record<string, number>;
}

export interface TrendPoint { week: number; value: number; }
export interface TrendSeries {
  id: string;
  metric: string;
  points: TrendPoint[];
}

export interface CompassRow extends PlayerLite {
  compass: Compass;
}

export interface RookieRow {
  player_id: string;
  name?: string;
  team: string;
  pos: Pos;
  depth?: number;
  targets?: number;
  receptions?: number;
}

export interface UsageRow {
  id: string;
  season: number;
  snap_share?: number;
  route_share?: number;
  tgt_share?: number;
  yprr?: number;
  slot_rate?: number;
}

export interface VersionResponse { build: string; commit?: string; pid?: number; }
export type HealthResponse = Record<"redraft"|"dynasty"|"oasis"|"trends"|"compass"|"rookies"|"usage2024"|string, HealthStatus>;

// ---------- Client core ----------
export interface ApiClientOptions {
  baseUrl?: string;        // default: same-origin
  timeoutMs?: number;      // default: 10000
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  status: number;
  url: string;
  body?: unknown;
  constructor(msg: string, status: number, url: string, body?: unknown) {
    super(msg); this.status = status; this.url = url; this.body = body;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, url: string): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  // @ts-ignore attach signal if fetch
  if ((p as any).signal === undefined) (p as any).signal = ctrl.signal;
  return new Promise((resolve, reject) => {
    p.then(v => { clearTimeout(t); resolve(v); })
     .catch(e => { clearTimeout(t); reject(e.name === "AbortError" ? new ApiError(`Timeout ${ms}ms`, 408, url) : e); });
  });
}

export class API {
  private base: string;
  private timeout: number;
  private headers: Record<string, string>;

  constructor(opts: ApiClientOptions = {}) {
    this.base = opts.baseUrl ?? "";
    this.timeout = opts.timeoutMs ?? 10000;
    this.headers = { "Accept": "application/json", ...opts.headers };
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.base}${path}`;
    const req = fetch(url, { headers: this.headers, credentials: "same-origin" })
      .then(async (r) => {
        const ct = r.headers.get("content-type") || "";
        const body = ct.includes("json") ? await r.json() : await r.text();
        if (!r.ok) throw new ApiError(`GET ${path} failed`, r.status, url, body);
        return body as T;
      });
    return withTimeout(req, this.timeout, url);
  }

  // ---------- Version / Health ----------
  version() { return this.get<VersionResponse>("/api/version"); }
  health()  { return this.get<HealthResponse>("/api/health"); }

  // ---------- Redraft ----------
  redraftRankings(params: { pos: Pos; season?: number; format?: "PPR"|"HalfPPR"|"Standard"; limit?: number; }) {
    const q = new URLSearchParams({
      pos: params.pos,
      season: String(params.season ?? 2025),
      format: String(params.format ?? "PPR"),
      limit: String(params.limit ?? 200),
    });
    return this.get<RowsEnvelope<RedraftRow>>(`/api/redraft/rankings?${q.toString()}`);
  }
  redraftWeekly(params: { season?: number; week?: number; pos?: Pos }) {
    const q = new URLSearchParams();
    if (params.season) q.set("season", String(params.season));
    if (params.week) q.set("week", String(params.week));
    if (params.pos) q.set("pos", params.pos);
    return this.get<RowsEnvelope<Record<string, number|String>>>(
      `/api/redraft/weekly?${q.toString()}`
    );
  }
  redraftPlayers(params: { search?: string; pos?: Pos; limit?: number }) {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.pos) q.set("pos", params.pos);
    q.set("limit", String(params.limit ?? 20));
    return this.get<RowsEnvelope<PlayerLite>>(`/api/redraft/players?${q.toString()}`);
  }
  redraftAdp(source: "sleeper"|"espn"|"yahoo" = "sleeper") {
    return this.get<RowsEnvelope<{ id:string; name:string; team:string; pos:Pos; adp:number }>>(`/api/redraft/adp?source=${source}`);
  }

  // ---------- Dynasty ----------
  dynastyRankings(params: { pos: Pos; season?: number; limit?: number }) {
    const q = new URLSearchParams({
      pos: params.pos,
      season: String(params.season ?? 2025),
      limit: String(params.limit ?? 200),
    });
    return this.get<RowsEnvelope<DynastyRow>>(`/api/dynasty/rankings?${q.toString()}`);
  }
  dynastyValue(params: { pos: Pos; season?: number; limit?: number }) {
    const q = new URLSearchParams({
      pos: params.pos,
      season: String(params.season ?? 2025),
      limit: String(params.limit ?? 200),
    });
    return this.get<RowsEnvelope<DynastyRow>>(`/api/dynasty/value?${q.toString()}`);
  }

  // ---------- OASIS ----------
  oasisTeams(season = 2025) {
    return this.get<RowsEnvelope<OasisTeamRow>>(`/api/oasis/teams?season=${season}`);
  }
  oasisTeam(teamId: string, season = 2025) {
    return this.get<RowEnvelope<OasisTeamRow>>(`/api/oasis/team/${encodeURIComponent(teamId)}?season=${season}`);
  }

  // ---------- Trends ----------
  trendPlayer(id: string, params: { metric: string; window?: number; season?: number }) {
    const q = new URLSearchParams({
      metric: params.metric,
      window: String(params.window ?? 5),
      season: String(params.season ?? 2025),
    });
    return this.get<RowEnvelope<TrendSeries>>(`/api/trends/player/${encodeURIComponent(id)}?${q.toString()}`);
  }
  trendLeaders(params: { metric: string; pos?: Pos; season?: number; limit?: number }) {
    const q = new URLSearchParams({
      metric: params.metric,
      season: String(params.season ?? 2025),
      limit: String(params.limit ?? 50),
    });
    if (params.pos) q.set("pos", params.pos);
    return this.get<RowsEnvelope<TrendSeries>>(`/api/trends/leaders?${q.toString()}`);
  }

  // ---------- Compass ----------
  compassPos(pos: Pos, params?: { search?: string; limit?: number }) {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    q.set("limit", String(params?.limit ?? 50));
    return this.get<RowsEnvelope<CompassRow>>(`/api/compass/${pos}?${q.toString()}`);
  }
  compassPlayer(id: string) {
    return this.get<RowEnvelope<CompassRow>>(`/api/compass/player/${encodeURIComponent(id)}`);
  }

  // ---------- Rookies ----------
  rookies(params?: { classYear?: number; pos?: Pos }) {
    const q = new URLSearchParams();
    q.set("class", String(params?.classYear ?? 2025));
    if (params?.pos) q.set("pos", params.pos);
    return this.get<RowsEnvelope<RookieRow>>(`/api/rookies?${q.toString()}`);
  }
  rookiePlayer(id: string) {
    return this.get<RowEnvelope<RookieRow>>(`/api/rookies/player/${encodeURIComponent(id)}`);
  }

  // ---------- Usage (2024 default) ----------
  usageSummary(params?: { season?: number; pos?: Pos }) {
    const q = new URLSearchParams();
    q.set("season", String(params?.season ?? 2024));
    if (params?.pos) q.set("pos", params.pos);
    return this.get<RowsEnvelope<UsageRow>>(`/api/usage/summary?${q.toString()}`);
  }
  usagePlayer(id: string, season = 2024) {
    return this.get<RowEnvelope<UsageRow>>(`/api/usage/player/${encodeURIComponent(id)}?season=${season}`);
  }
}

// Singleton (same-origin). Override baseUrl if you deploy API separately.
export const api = new API();

// Small helpers for UI layers
export const fmt = {
  title: (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase()),
  one:   (n: number) => Number.isFinite(n) ? n.toFixed(1) : "0.0",
  two:   (n: number) => Number.isFinite(n) ? n.toFixed(2) : "0.00",
};

// @ts-ignore
export const BUILD: string = (typeof __BUILD__ !== "undefined" ? __BUILD__ : "");