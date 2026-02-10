import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Search } from "lucide-react";

interface ForgePlayer {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  alpha: number;
  tier: string;
  pillars?: {
    volume?: number;
    efficiency?: number;
    stability?: number;
    teamContext?: number;
  };
  issues?: Array<{ type: string; severity: string; message: string }>;
}

function TrendBar({ trend }: { trend: "rising" | "steady" | "falling" }) {
  const bars = {
    rising: [
      { h: 6, c: "t-steady" }, { h: 8, c: "t-steady" },
      { h: 11, c: "t-rising" }, { h: 14, c: "t-rising" },
      { h: 16, c: "t-rising" }, { h: 18, c: "t-rising" },
    ],
    steady: [
      { h: 10, c: "t-steady" }, { h: 9, c: "t-steady" },
      { h: 9, c: "t-steady" }, { h: 8, c: "t-steady" },
      { h: 9, c: "t-steady" }, { h: 9, c: "t-steady" },
    ],
    falling: [
      { h: 14, c: "t-steady" }, { h: 12, c: "t-steady" },
      { h: 10, c: "t-falling" }, { h: 8, c: "t-falling" },
      { h: 7, c: "t-falling" }, { h: 6, c: "t-falling" },
    ],
  };

  return (
    <div className="trend-bar">
      {bars[trend].map((b, i) => (
        <span key={i} className={b.c} style={{ height: b.h }} />
      ))}
    </div>
  );
}

function getTierClass(tier: string): string {
  if (tier.includes("1") || tier.toLowerCase().includes("elite")) return "tier-1";
  if (tier.includes("2") || tier.toLowerCase().includes("core")) return "tier-2";
  if (tier.includes("3")) return "tier-3";
  if (tier.includes("4")) return "tier-4";
  return "tier-5";
}

function getTierLabel(tier: string): string {
  if (tier.includes("1")) return "T1 Elite";
  if (tier.includes("2")) return "T2 Core";
  if (tier.includes("3")) return "T3 Flex";
  if (tier.includes("4")) return "T4 Hold";
  if (tier.includes("5")) return "T5 Cut";
  return tier;
}

function getTrend(alpha: number): "rising" | "steady" | "falling" {
  if (alpha >= 75) return "rising";
  if (alpha >= 45) return "steady";
  return "falling";
}

function getFlag(issues?: ForgePlayer["issues"]): { label: string; type: string } | null {
  if (!issues || issues.length === 0) return null;
  const hasBlock = issues.some(i => i.severity === "block");
  const hasWarn = issues.some(i => i.severity === "warn");
  if (hasBlock) return { label: "Regression", type: "regression" };
  if (hasWarn) return { label: "Watch", type: "breakout" };
  return { label: "Breakout", type: "breakout" };
}

export default function Dashboard() {
  const [activeFilter, setActiveFilter] = useState("WR");
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();

  const { data: forgeData, isLoading } = useQuery<{ players: ForgePlayer[] }>({
    queryKey: [`/api/forge/eg/batch?position=${activeFilter}&mode=dynasty`],
  });

  const { data: healthData } = useQuery<{ pipeline?: { lastSync?: string }; playerCount?: number }>({
    queryKey: ["/api/datalab/health"],
  });

  const players = forgeData?.players || [];
  const filtered = searchQuery
    ? players.filter(p => p.player_name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : players;
  const topPlayers = filtered.slice(0, 20);

  const t1Count = players.filter(p => p.tier?.includes("1")).length;
  const avgAlpha = players.length > 0
    ? Math.round(players.reduce((s, p) => s + (p.alpha || 0), 0) / players.length)
    : 0;

  return (
    <>
      <div className="tiber-hero">
        <div className="hero-title">TIBER</div>
        <div className="hero-sub">Tactical Index for Breakout Efficiency and Regression</div>
        <div className="hero-value-prop">
          NFL data meets dynasty intelligence. TIBER tracks <strong>breakout signals</strong> and{" "}
          <strong>regression indicators</strong> across every skill position — so you can trade on
          what's coming, not what already happened.
        </div>
      </div>

      <div className="tiber-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {["WR", "RB", "QB", "TE"].map(pos => (
            <button
              key={pos}
              className={`tool-btn ${activeFilter === pos ? "active" : ""}`}
              onClick={() => setActiveFilter(pos)}
            >
              {pos}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} />
            <input
              type="text"
              className="toolbar-search"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="tiber-content stagger-children">
        <div className="status-row">
          <div className="status-card">
            <div className="status-label">Players Tracked</div>
            <div className="status-value">
              {players.length || "—"}
            </div>
            <div className="status-sub">{activeFilter} position pool</div>
          </div>
          <div className="status-card">
            <div className="status-label">T1 Elite</div>
            <div className="status-value">
              {t1Count}
              <span className="status-delta delta-up">Top tier</span>
            </div>
            <div className="status-sub">FORGE-graded elite players</div>
          </div>
          <div className="status-card">
            <div className="status-label">Avg Alpha</div>
            <div className="status-value">
              {avgAlpha || "—"}
            </div>
            <div className="status-sub">Position average score</div>
          </div>
          <div className="status-card">
            <div className="status-label">Data Pipeline</div>
            <div className="status-value" style={{ fontSize: 16, fontFamily: "var(--font-mono)" }}>
              {healthData?.pipeline ? "All Systems" : "Active"}
            </div>
            <div className="status-sub">
              {healthData?.playerCount ? `${healthData.playerCount.toLocaleString()} records` : "Processing"}
            </div>
          </div>
        </div>

        <div className="section-header">
          <div className="section-title">
            <span className="section-dot" />
            Dynasty Asset Board — {activeFilter}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Link href="/tiers" className="tool-btn" style={{ fontSize: 11, padding: "4px 10px", minHeight: "auto", minWidth: "auto", textDecoration: "none" }}>
              Full Rankings
            </Link>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Player</th>
                <th>Tier</th>
                <th className="ar">Alpha</th>
                <th className="ar">Volume</th>
                <th className="ar">Efficiency</th>
                <th className="ar">Trend</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="mono dim">{i + 1}</td>
                    <td>
                      <div style={{ height: 14, width: 120, background: "var(--bg-tertiary)", borderRadius: 3 }} />
                    </td>
                    <td><div style={{ height: 14, width: 60, background: "var(--bg-tertiary)", borderRadius: 3 }} /></td>
                    <td className="ar"><div style={{ height: 14, width: 30, background: "var(--bg-tertiary)", borderRadius: 3, marginLeft: "auto" }} /></td>
                    <td className="ar"><div style={{ height: 14, width: 30, background: "var(--bg-tertiary)", borderRadius: 3, marginLeft: "auto" }} /></td>
                    <td className="ar"><div style={{ height: 14, width: 30, background: "var(--bg-tertiary)", borderRadius: 3, marginLeft: "auto" }} /></td>
                    <td className="ar"><div style={{ height: 18, width: 24, background: "var(--bg-tertiary)", borderRadius: 3, marginLeft: "auto" }} /></td>
                  </tr>
                ))
              ) : topPlayers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
                    No players found
                  </td>
                </tr>
              ) : (
                topPlayers.map((p, i) => {
                  const flag = getFlag(p.issues);
                  return (
                    <tr
                      key={p.player_id}
                      className={flag ? "flagged" : ""}
                      onClick={() => navigate(`/player/${p.player_id}`)}
                    >
                      <td className="mono dim">{i + 1}</td>
                      <td>
                        <div className="player-cell">
                          <div className="player-name-cell">
                            {p.player_name}
                            {flag && (
                              <span className={`flag-label ${flag.type === "regression" ? "regression" : ""}`}>
                                {flag.label}
                              </span>
                            )}
                          </div>
                          <div className="player-meta">{p.position} · {p.team || "—"}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`tier-badge ${getTierClass(p.tier)}`}>
                          {getTierLabel(p.tier)}
                        </span>
                      </td>
                      <td className="ar mono">{p.alpha?.toFixed(1) ?? "—"}</td>
                      <td className="ar mono dim">{p.pillars?.volume?.toFixed(1) ?? "—"}</td>
                      <td className="ar mono dim">{p.pillars?.efficiency?.toFixed(1) ?? "—"}</td>
                      <td className="ar">
                        <TrendBar trend={getTrend(p.alpha)} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="two-col">
          <div>
            <div className="section-header">
              <div className="section-title">
                <span className="section-dot" />
                Insights
              </div>
            </div>
            <div className="insight-card accent-left">
              <div className="insight-header">
                <span className="insight-tag breakout">FORGE Powered</span>
                <span className="insight-time">Live</span>
              </div>
              <div className="insight-title">
                {t1Count > 0
                  ? `${t1Count} elite ${activeFilter}s identified by FORGE engine`
                  : `FORGE engine evaluating ${activeFilter} position group`}
              </div>
              <div className="insight-body">
                The FORGE grading engine analyzes volume, efficiency, stability, and team context
                to produce Alpha scores. Players are ranked across tiers using position-specific
                thresholds calibrated for cumulative season data.
              </div>
              <div className="insight-source">Source: FORGE E+G v2 pipeline</div>
              <div className="insight-metrics">
                <div>
                  <div className="insight-metric-label">Pool Size</div>
                  <div className="insight-metric-value">{players.length}</div>
                </div>
                <div>
                  <div className="insight-metric-label">Avg Alpha</div>
                  <div className="insight-metric-value" style={{ color: "var(--ember)" }}>{avgAlpha}</div>
                </div>
                <div>
                  <div className="insight-metric-label">Mode</div>
                  <div className="insight-metric-value" style={{ fontSize: 12 }}>Dynasty</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="section-header">
              <div className="section-title">
                <span className="section-dot" />
                Tiber Chat
              </div>
              <div>
                <Link href="/legacy-chat" className="tool-btn" style={{ fontSize: 11, padding: "4px 10px", minHeight: "auto", minWidth: "auto", textDecoration: "none" }}>
                    Open Full
                </Link>
              </div>
            </div>
            <div className="chat-preview">
              <div className="chat-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="chat-indicator" />
                  <span className="chat-label">Active Session</span>
                </div>
                <span className="chat-model">tiber-core-v2</span>
              </div>
              <div className="chat-messages">
                <div className="chat-msg">
                  <div className="chat-msg-sender">You</div>
                  <div className="chat-msg-text">Who should I target with my 1.03 pick in the rookie draft?</div>
                </div>
                <div className="chat-msg">
                  <div className="chat-msg-sender ai">Tiber</div>
                  <div className="chat-msg-text">
                    Looking at your roster, you're <strong>strongest at WR and weakest at RB depth</strong>.
                    At 1.03, the top RB available projects as a T2 Core ceiling based on combine metrics
                    and college production. I'd target the positional need unless a T1 prospect falls —
                    want me to run the draft simulation with your league's tendencies?
                  </div>
                </div>
              </div>
              <div className="chat-input-area">
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Ask about your roster, trades, or matchups..."
                  onFocus={() => navigate("/legacy-chat")}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="section-header">
          <div className="section-title">
            <span className="section-dot" />
            Connected Services
          </div>
        </div>
        <div className="insight-card" style={{ marginBottom: 32 }}>
          <div className="service-row">
            <span className="service-dot on" />
            <span className="service-name">NFL Data Pipeline</span>
            <span className="service-status">Active · ELT operational</span>
          </div>
          <div className="service-row">
            <span className="service-dot on" />
            <span className="service-name">FORGE Tier Engine</span>
            <span className="service-status">v2 · {players.length > 0 ? "Processing" : "Idle"}</span>
          </div>
          <div className="service-row">
            <span className="service-dot on" />
            <span className="service-name">Data Lab (DataDive)</span>
            <span className="service-status">Active · Snapshots available</span>
          </div>
          <div className="service-row">
            <span className="service-dot pending" />
            <span className="service-name">Tiber Chat</span>
            <span className="service-status">Beta · Gemini-powered</span>
          </div>
          <div className="service-row">
            <span className="service-dot on" />
            <span className="service-name">Player Identity Bridge</span>
            <span className="service-status">Operational · GSIS mapping</span>
          </div>
        </div>

        <footer className="app-footer">
          <div className="footer-left">
            <span>TIBER v2.1</span>
            <span>·</span>
            <span>Dynasty intelligence, automated</span>
          </div>
          <div className="footer-right">
            <Link href="/forge" className="footer-link">FORGE</Link>
            <Link href="/admin/api-lexicon" className="footer-link">API</Link>
            <Link href="/admin/forge-hub" className="footer-link">Status</Link>
          </div>
        </footer>
      </div>
    </>
  );
}
