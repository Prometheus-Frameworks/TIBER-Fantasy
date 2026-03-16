import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Brain, Zap, Shield, FlaskConical, BarChart3, Cpu,
  ArrowRight, Globe, Lock, Activity, ChevronRight
} from "lucide-react";

const POSITIONS = ["WR", "RB", "QB", "TE"] as const;
const IDP_GROUPS = ["EDGE", "LB", "CB"] as const;
type OffPos = typeof POSITIONS[number];
type IdpGroup = typeof IDP_GROUPS[number];

interface ForgePlayer {
  playerId: string;
  playerName: string;
  position: string;
  nflTeam: string;
  alpha: number;
  rawAlpha: number;
  trajectory: string;
  confidence: number;
  gamesPlayed: number;
  subScores: { volume: number; efficiency: number; stability: number; contextFit: number };
}

interface IdpPlayer {
  gsis_id: string;
  player_name: string;
  team: string;
  position_group: string;
  alpha: number;
  tier: string;
  games_played: number;
  pillars: { volume: number; efficiency: number; teamContext: number; stability: number };
}

function tierColor(alpha: number): string {
  if (alpha >= 85) return "var(--ember)";
  if (alpha >= 70) return "var(--text-primary)";
  if (alpha >= 55) return "var(--text-secondary)";
  return "var(--text-tertiary)";
}

function tierLabel(alpha: number): string {
  if (alpha >= 85) return "T1";
  if (alpha >= 70) return "T2";
  if (alpha >= 55) return "T3";
  if (alpha >= 40) return "T4";
  return "T5";
}

function TrajIcon({ traj }: { traj: string }) {
  if (traj === "rising") return <span style={{ color: "var(--green)", fontSize: 10 }}>▲</span>;
  if (traj === "falling") return <span style={{ color: "var(--red)", fontSize: 10 }}>▼</span>;
  return <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>—</span>;
}

function ScoreBars({ scores }: { scores: Record<string, number> }) {
  const entries = Object.entries(scores).slice(0, 4);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, color: "var(--text-tertiary)", width: 28, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
            {k.slice(0, 3)}
          </span>
          <div style={{ flex: 1, height: 3, background: "var(--bg-tertiary)", borderRadius: 2 }}>
            <div style={{ width: `${Math.min(v, 100)}%`, height: "100%", background: "var(--ember)", borderRadius: 2, opacity: 0.7 }} />
          </div>
          <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", width: 22, textAlign: "right" }}>
            {Math.round(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

function OffensivePanel({ position }: { position: OffPos }) {
  const { data, isLoading } = useQuery<{ success: boolean; scores: ForgePlayer[] }>({
    queryKey: ["/api/forge/batch", position],
    queryFn: () => fetch(`/api/forge/batch?season=2025&position=${position}&mode=redraft&limit=6`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const players = data?.scores ?? [];

  return (
    <div>
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: 28, background: "var(--bg-tertiary)", borderRadius: 6, opacity: 0.5 }} />
          ))}
        </div>
      ) : players.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No data available</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {players.map((p, i) => (
            <Link key={p.playerId} href={`/player/${p.playerId}`} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                borderRadius: 6, background: i === 0 ? "var(--ember-dim)" : "transparent",
                border: `1px solid ${i === 0 ? "rgba(226,100,13,0.12)" : "transparent"}`,
                cursor: "pointer", transition: "background 0.12s",
              }}
                onMouseEnter={e => { if (i !== 0) (e.currentTarget as HTMLElement).style.background = "var(--bg-tertiary)"; }}
                onMouseLeave={e => { if (i !== 0) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", width: 14 }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.playerName}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                  {p.nflTeam}
                </span>
                <TrajIcon traj={p.trajectory} />
                <span style={{
                  fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
                  color: tierColor(p.alpha), minWidth: 34, textAlign: "right",
                }}>
                  {p.alpha.toFixed(1)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function IdpPanel({ group }: { group: IdpGroup }) {
  const { data, isLoading } = useQuery<{ players: IdpPlayer[] }>({
    queryKey: ["/api/forge/idp/batch", group],
    queryFn: () => fetch(`/api/forge/idp/batch?season=2025&position_group=${group}&limit=6`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const players = data?.players ?? [];

  return (
    <div>
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: 28, background: "var(--bg-tertiary)", borderRadius: 6, opacity: 0.5 }} />
          ))}
        </div>
      ) : players.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No data available</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {players.map((p, i) => (
            <div key={p.gsis_id} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
              borderRadius: 6, background: i === 0 ? "var(--ember-dim)" : "transparent",
              border: `1px solid ${i === 0 ? "rgba(226,100,13,0.12)" : "transparent"}`,
            }}>
              <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", width: 14 }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.player_name}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                {p.team}
              </span>
              <span style={{
                fontSize: 9, fontFamily: "var(--font-mono)", padding: "1px 4px",
                borderRadius: 3, background: p.tier === "T1" ? "var(--ember-dim)" : "var(--bg-tertiary)",
                color: p.tier === "T1" ? "var(--ember)" : "var(--text-tertiary)",
              }}>
                {p.tier}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
                color: tierColor(p.alpha), minWidth: 34, textAlign: "right",
              }}>
                {p.alpha.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FEATURES = [
  {
    icon: <Cpu size={16} />,
    name: "FORGE Engine",
    tag: "v2",
    desc: "Recursive grading engine. Alpha scores 0–100 across 9 positions, 3 modes (redraft, dynasty, bestball), pillar decomposition.",
    href: "/forge",
    endpoints: ["/api/forge/batch", "/api/forge/score/:id"],
  },
  {
    icon: <Zap size={16} />,
    name: "CATALYST",
    tag: "EPA",
    desc: "Clutch performance scoring weighted by win probability, game script, opponent quality and recency.",
    href: "/catalyst-lab",
    endpoints: ["/api/catalyst/scores", "/api/catalyst/player/:id"],
  },
  {
    icon: <Shield size={16} />,
    name: "IDP FORGE",
    tag: "NEW",
    desc: "Full defensive grading — EDGE, DI, LB, CB, S — powered by havoc rate, pressure, and coverage data.",
    href: "/idp-lab",
    endpoints: ["/api/forge/idp/batch", "/api/forge/idp/player/:id"],
  },
  {
    icon: <FlaskConical size={16} />,
    name: "Data Lab",
    tag: "ELT",
    desc: "Bronze → Silver → Gold data pipeline. Snapshots, role banks, personnel groupings, receiving/rushing efficiency.",
    href: "/tiber-data-lab",
    endpoints: ["/api/data-lab/lab-agg", "/api/role-bank/:pos/:season"],
  },
  {
    icon: <BarChart3 size={16} />,
    name: "Trade & Matchup",
    tag: "ALPHA",
    desc: "Schedule-aware SoS grading, DvP matchup scoring, and trade value delta analysis.",
    href: "/forge-workbench",
    endpoints: ["/api/forge/sos/rankings", "/api/dvp/position"],
  },
  {
    icon: <Brain size={16} />,
    name: "Tiber Chat",
    tag: "RAG",
    desc: "Gemini-powered assistant with full access to FORGE data, player context, and the Tiber knowledge graph.",
    href: "/legacy-chat",
    endpoints: ["/api/chat", "/api/tiber-memory/recall"],
  },
];

const API_EXAMPLES = [
  { method: "GET", path: "/api/forge/batch", params: "?season=2025&position=WR&mode=dynasty&limit=20", desc: "FORGE alpha grades" },
  { method: "GET", path: "/api/forge/idp/batch", params: "?season=2025&position_group=EDGE&limit=10", desc: "IDP grades" },
  { method: "GET", path: "/api/catalyst/scores", params: "?season=2025&position=QB", desc: "CATALYST clutch scores" },
  { method: "GET", path: "/api/role-bank/:pos/:season", params: "", desc: "Role bank tier data" },
  { method: "GET", path: "/api/forge/sos/rankings", params: "?season=2025&position=WR", desc: "Schedule strength" },
  { method: "GET", path: "/api/dvp/position", params: "?position=RB&week=18&season=2025", desc: "Defense vs. position" },
];

const SYSTEM_STATUS = [
  { label: "FORGE Offensive Grades", detail: "QB 77 · RB 190 · WR 292 · TE 156", status: "on" },
  { label: "FORGE IDP Grades", detail: "EDGE 147 · DI 130 · LB 200 · CB 180 · S 22", status: "on" },
  { label: "Data Pipeline (ELT)", detail: "Bronze → Silver → Gold · Weeks 1–18", status: "on" },
  { label: "CATALYST Engine", detail: "2024 + 2025 · EPA-weighted", status: "on" },
  { label: "Role Banks", detail: "9 positions · 708 defensive players scored", status: "on" },
  { label: "Tiber Chat (RAG)", detail: "Gemini-powered · BM25 + vector search", status: "pending" },
  { label: "Player Identity Bridge", detail: "GSIS ↔ Sleeper ↔ Slug mapping", status: "on" },
  { label: "REST API", detail: "Open endpoints · No auth required", status: "on" },
];

export default function TiberClawPage() {
  const [activeOffPos, setActiveOffPos] = useState<OffPos>("WR");
  const [activeIdpGroup, setActiveIdpGroup] = useState<IdpGroup>("EDGE");

  return (
    <div className="tiber-main">
      <div style={{ maxWidth: 1060, padding: "0 32px 80px" }}>

        {/* ── HERO ── */}
        <div style={{
          padding: "64px 0 48px",
          borderBottom: "1px solid var(--border)",
          marginBottom: 48,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <span style={{
              fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
              letterSpacing: "2px", textTransform: "uppercase",
              color: "var(--ember)", background: "var(--ember-dim)",
              padding: "3px 8px", borderRadius: 4,
            }}>
              Open Platform
            </span>
            <span style={{
              fontSize: 10, fontFamily: "var(--font-mono)",
              color: "var(--text-tertiary)",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <Globe size={10} /> Free · Paywall-free · REST API
            </span>
          </div>

          <h1 style={{
            fontSize: 52, fontWeight: 800, letterSpacing: "-1.5px",
            lineHeight: 1.05, color: "var(--text-primary)", marginBottom: 8,
          }}>
            Tiber<span style={{ color: "var(--ember)" }}>Claw</span>
          </h1>

          <p style={{
            fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)",
            letterSpacing: "1px", textTransform: "uppercase", marginBottom: 20,
          }}>
            NFL Intelligence Platform · Powered by TIBER
          </p>

          <p style={{
            fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.7,
            maxWidth: 600, marginBottom: 32,
          }}>
            A structured football intelligence layer — player evaluation, trade analysis,
            IDP grading, and matchup context — served via clean REST endpoints consumable
            by AI agents, personal assistants, or any client.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/tiers">
              <button style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 18px", borderRadius: 7,
                background: "var(--ember)", color: "#fff",
                border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}>
                View FORGE Tiers <ArrowRight size={13} />
              </button>
            </Link>
            <Link href="/admin/api-lexicon">
              <button style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 18px", borderRadius: 7,
                background: "transparent", color: "var(--text-primary)",
                border: "1px solid var(--border)", cursor: "pointer", fontSize: 13, fontWeight: 500,
              }}>
                API Reference
              </button>
            </Link>
            <Link href="/forge-workbench">
              <button style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 18px", borderRadius: 7,
                background: "transparent", color: "var(--text-primary)",
                border: "1px solid var(--border)", cursor: "pointer", fontSize: 13, fontWeight: 500,
              }}>
                FORGE Workbench
              </button>
            </Link>
          </div>
        </div>

        {/* ── FEATURE GRID ── */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Intelligence Modules</h2>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>6 engines</span>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12,
          }}>
            {FEATURES.map(f => (
              <Link key={f.name} href={f.href} style={{ textDecoration: "none" }}>
                <div style={{
                  padding: "18px 20px", borderRadius: 10,
                  border: "1px solid var(--border)", background: "var(--bg-primary)",
                  cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
                  height: "100%",
                }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ color: "var(--ember)" }}>{f.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{f.name}</span>
                    <span style={{
                      fontSize: 9, fontFamily: "var(--font-mono)", padding: "1px 5px",
                      background: "var(--bg-tertiary)", borderRadius: 3, color: "var(--text-tertiary)",
                      marginLeft: "auto",
                    }}>
                      {f.tag}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
                    {f.desc}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {f.endpoints.map(ep => (
                      <span key={ep} style={{
                        fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)",
                        background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: 3, width: "fit-content",
                      }}>
                        {ep}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── API SHOWCASE ── */}
        <div style={{
          marginBottom: 56, padding: "24px 28px",
          border: "1px solid var(--border)", borderRadius: 10,
          background: "var(--bg-secondary)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <Lock size={13} style={{ color: "var(--ember)" }} />
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>REST API</h2>
            <span style={{
              fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--green)",
              background: "var(--green-dim)", padding: "1px 6px", borderRadius: 3,
            }}>
              NO AUTH REQUIRED
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {API_EXAMPLES.map(ex => (
              <div key={ex.path} style={{
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                padding: "8px 12px", borderRadius: 6, background: "var(--bg-primary)",
                border: "1px solid var(--border)",
              }}>
                <span style={{
                  fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
                  color: "var(--green)", minWidth: 32,
                }}>
                  {ex.method}
                </span>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                  {ex.path}
                </span>
                {ex.params && (
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>
                    {ex.params}
                  </span>
                )}
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-tertiary)" }}>
                  {ex.desc}
                </span>
                <ChevronRight size={11} style={{ color: "var(--text-tertiary)" }} />
              </div>
            ))}
          </div>

          <p style={{ marginTop: 14, fontSize: 11, color: "var(--text-tertiary)" }}>
            All endpoints return structured JSON. No API key required. Base URL: <span style={{ fontFamily: "var(--font-mono)" }}>https://tiberclaw.replit.app</span>
          </p>
        </div>

        {/* ── LIVE FORGE DASHBOARD ── */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Live FORGE Grades</h2>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
              Season 2025 · Redraft
            </span>
            <span style={{
              fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--green)",
              background: "var(--green-dim)", padding: "1px 6px", borderRadius: 3,
            }}>
              LIVE
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

            {/* Offensive Panel */}
            <div style={{ padding: "20px", border: "1px solid var(--border)", borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Skill Positions</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  {POSITIONS.map(p => (
                    <button key={p} onClick={() => setActiveOffPos(p)} style={{
                      fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 7px",
                      borderRadius: 4, border: "1px solid var(--border)", cursor: "pointer",
                      background: activeOffPos === p ? "var(--ember)" : "transparent",
                      color: activeOffPos === p ? "#fff" : "var(--text-tertiary)",
                      fontWeight: activeOffPos === p ? 700 : 400,
                      transition: "all 0.12s",
                    }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <OffensivePanel position={activeOffPos} />
              <Link href="/tiers">
                <div style={{
                  display: "flex", alignItems: "center", gap: 4, marginTop: 12,
                  fontSize: 11, color: "var(--ember)", cursor: "pointer",
                }}>
                  Full {activeOffPos} rankings <ArrowRight size={11} />
                </div>
              </Link>
            </div>

            {/* IDP Panel */}
            <div style={{ padding: "20px", border: "1px solid var(--border)", borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>IDP</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  {IDP_GROUPS.map(g => (
                    <button key={g} onClick={() => setActiveIdpGroup(g)} style={{
                      fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 7px",
                      borderRadius: 4, border: "1px solid var(--border)", cursor: "pointer",
                      background: activeIdpGroup === g ? "var(--ember)" : "transparent",
                      color: activeIdpGroup === g ? "#fff" : "var(--text-tertiary)",
                      fontWeight: activeIdpGroup === g ? 700 : 400,
                      transition: "all 0.12s",
                    }}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <IdpPanel group={activeIdpGroup} />
              <Link href="/idp-lab">
                <div style={{
                  display: "flex", alignItems: "center", gap: 4, marginTop: 12,
                  fontSize: 11, color: "var(--ember)", cursor: "pointer",
                }}>
                  Full IDP Lab <ArrowRight size={11} />
                </div>
              </Link>
            </div>

          </div>
        </div>

        {/* ── SYSTEM STATUS ── */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Platform Status</h2>
            <Activity size={13} style={{ color: "var(--green)" }} />
          </div>

          <div style={{
            border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden",
          }}>
            {SYSTEM_STATUS.map((s, i) => (
              <div key={s.label} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 20px",
                borderBottom: i < SYSTEM_STATUS.length - 1 ? "1px solid var(--border)" : "none",
                background: "var(--bg-primary)",
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  background: s.status === "on" ? "var(--green)" : "var(--yellow)",
                  boxShadow: s.status === "on" ? "0 0 4px var(--green)" : "none",
                }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", minWidth: 220 }}>
                  {s.label}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                  {s.detail}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER CTA ── */}
        <div style={{
          padding: "32px", borderRadius: 12, textAlign: "center",
          background: "var(--ember-dim)", border: "1px solid rgba(226,100,13,0.15)",
        }}>
          <p style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--ember)", marginBottom: 8, letterSpacing: "1px", textTransform: "uppercase" }}>
            Open · Free · Paywall-free
          </p>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 10 }}>
            Intelligence for every agent and analyst
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24, maxWidth: 480, margin: "0 auto 24px" }}>
            TiberClaw is TIBER's open layer. Point your AI agent, assistant, or dashboard
            at any endpoint — no keys, no paywalls, no friction.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/tiers">
              <button style={{
                padding: "10px 20px", borderRadius: 7, background: "var(--ember)",
                color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}>
                Explore Rankings
              </button>
            </Link>
            <Link href="/forge-workbench">
              <button style={{
                padding: "10px 20px", borderRadius: 7, background: "transparent",
                color: "var(--text-primary)", border: "1px solid var(--border)",
                cursor: "pointer", fontSize: 13, fontWeight: 500,
              }}>
                FORGE Workbench
              </button>
            </Link>
            <Link href="/catalyst-lab">
              <button style={{
                padding: "10px 20px", borderRadius: 7, background: "transparent",
                color: "var(--text-primary)", border: "1px solid var(--border)",
                cursor: "pointer", fontSize: 13, fontWeight: 500,
              }}>
                CATALYST Lab
              </button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
