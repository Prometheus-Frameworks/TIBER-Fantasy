import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Search } from "lucide-react";
import { useCurrentNFLWeek } from "@/hooks/useCurrentNFLWeek";

interface LabPlayer {
  playerName: string;
  teamId: string;
  position: string;
  gamesPlayed: number;
  totalFptsPpr: number;
  totalFptsHalf: number;
  totalFptsStd: number;
  avgEpaPerTarget?: number;
  avgEpaPerCarry?: number;
  avgEpaPerDropback?: number;
  yprr?: number;
  avgCatchRate?: number;
  avgSnapShare: number;
  avgTargetShare?: number;
  avgAdot?: number;
  avgWopr?: number;
  totalTargets?: number;
  totalReceptions?: number;
  totalRecYards?: number;
  totalRecTds?: number;
  totalRushAttempts?: number;
  totalRushYards?: number;
  totalRushTds?: number;
  totalDropbacks?: number;
  totalPassYards?: number;
  totalPassTds?: number;
  avgEpaPerPlay?: number;
}

function getPpgTier(ppg: number, pos: string): { label: string; cls: string } {
  const thresholds: Record<string, number[]> = {
    WR: [18, 14, 10, 6],
    RB: [17, 13, 9, 5],
    QB: [22, 18, 14, 10],
    TE: [14, 10, 7, 4],
  };
  const t = thresholds[pos] || thresholds.WR;
  if (ppg >= t[0]) return { label: "T1 Elite", cls: "tier-1" };
  if (ppg >= t[1]) return { label: "T2 Core", cls: "tier-2" };
  if (ppg >= t[2]) return { label: "T3 Flex", cls: "tier-3" };
  if (ppg >= t[3]) return { label: "T4 Hold", cls: "tier-4" };
  return { label: "T5 Depth", cls: "tier-5" };
}

function getTrend(ppg: number, pos: string): "rising" | "steady" | "falling" {
  const thresholds: Record<string, number[]> = {
    WR: [16, 10], RB: [15, 9], QB: [20, 14], TE: [12, 7],
  };
  const t = thresholds[pos] || thresholds.WR;
  if (ppg >= t[0]) return "rising";
  if (ppg >= t[1]) return "steady";
  return "falling";
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

function getEfficiencyLabel(pos: string): string {
  if (pos === "WR" || pos === "TE") return "EPA/Tgt";
  if (pos === "RB") return "EPA/Play";
  return "EPA/Drop";
}

function getEfficiency(p: LabPlayer): number | null {
  if (p.position === "WR" || p.position === "TE") return p.avgEpaPerTarget ?? null;
  if (p.position === "RB") return p.avgEpaPerPlay ?? null;
  return p.avgEpaPerDropback ?? p.avgEpaPerPlay ?? null;
}

function getVolumeLabel(pos: string): string {
  if (pos === "WR" || pos === "TE") return "Targets";
  if (pos === "RB") return "Carries";
  return "Att";
}

function getVolume(p: LabPlayer): number | null {
  if (p.position === "WR" || p.position === "TE") return p.totalTargets ?? null;
  if (p.position === "RB") return p.totalRushAttempts ?? null;
  return p.totalDropbacks ?? null;
}

export default function Dashboard() {
  const [activeFilter, setActiveFilter] = useState("WR");
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();
  const { season } = useCurrentNFLWeek();

  const { data: labData, isLoading } = useQuery<{ data: LabPlayer[]; count: number }>({
    queryKey: ["/api/data-lab/lab-agg", activeFilter, season],
    queryFn: () =>
      fetch(`/api/data-lab/lab-agg?season=${season}&position=${activeFilter}&limit=100`)
        .then(r => r.json()),
  });

  const { data: healthData } = useQuery<{
    status: string;
    latestSnapshot?: { season: number; week: number; rowCount: number };
    tableCounts?: { snapshotPlayerSeason: number; snapshotPlayerWeek: number };
  }>({
    queryKey: ["/api/data-lab/health"],
  });

  const players = useMemo(() => {
    const raw = labData?.data || [];
    return raw
      .filter(p => p.gamesPlayed >= 4)
      .sort((a, b) => b.totalFptsPpr - a.totalFptsPpr);
  }, [labData]);

  const filtered = searchQuery
    ? players.filter(p => p.playerName?.toLowerCase().includes(searchQuery.toLowerCase()))
    : players;
  const topPlayers = filtered.slice(0, 20);

  const ppgValues = players.map(p => p.totalFptsPpr / Math.max(p.gamesPlayed, 1));
  const avgPpg = ppgValues.length > 0
    ? Math.round(ppgValues.reduce((s, v) => s + v, 0) / ppgValues.length * 10) / 10
    : 0;
  const t1Count = players.filter(p => {
    const ppg = p.totalFptsPpr / Math.max(p.gamesPlayed, 1);
    return getPpgTier(ppg, activeFilter).cls === "tier-1";
  }).length;
  const topScorer = players[0];

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
            <div className="status-sub">{activeFilter} pool · 4+ games played</div>
          </div>
          <div className="status-card">
            <div className="status-label">T1 Elite</div>
            <div className="status-value">
              {t1Count}
              {t1Count > 0 && <span className="status-delta delta-up">Top tier</span>}
            </div>
            <div className="status-sub">PPG-tiered elite players</div>
          </div>
          <div className="status-card">
            <div className="status-label">Avg PPG</div>
            <div className="status-value">
              {avgPpg || "—"}
            </div>
            <div className="status-sub">PPR points per game</div>
          </div>
          <div className="status-card">
            <div className="status-label">Data Pipeline</div>
            <div className="status-value" style={{ fontSize: 16, fontFamily: "var(--font-mono)" }}>
              {healthData?.status === "healthy" ? "Healthy" : "Active"}
            </div>
            <div className="status-sub">
              {healthData?.tableCounts
                ? `${healthData.tableCounts.snapshotPlayerSeason.toLocaleString()} season records`
                : "Processing"}
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
                <th className="ar">FPTS</th>
                <th className="ar">PPG</th>
                <th className="ar">{getVolumeLabel(activeFilter)}</th>
                <th className="ar">{getEfficiencyLabel(activeFilter)}</th>
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
                    <td className="ar"><div style={{ height: 14, width: 30, background: "var(--bg-tertiary)", borderRadius: 3, marginLeft: "auto" }} /></td>
                    <td className="ar"><div style={{ height: 18, width: 24, background: "var(--bg-tertiary)", borderRadius: 3, marginLeft: "auto" }} /></td>
                  </tr>
                ))
              ) : topPlayers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
                    No players found
                  </td>
                </tr>
              ) : (
                topPlayers.map((p, i) => {
                  const ppg = p.totalFptsPpr / Math.max(p.gamesPlayed, 1);
                  const tier = getPpgTier(ppg, activeFilter);
                  const eff = getEfficiency(p);
                  const vol = getVolume(p);
                  return (
                    <tr key={p.playerName + p.teamId}>
                      <td className="mono dim">{i + 1}</td>
                      <td>
                        <div className="player-cell">
                          <div className="player-name-cell">
                            {p.playerName}
                          </div>
                          <div className="player-meta">{p.position} · {p.teamId || "—"} · {p.gamesPlayed}G</div>
                        </div>
                      </td>
                      <td>
                        <span className={`tier-badge ${tier.cls}`}>
                          {tier.label}
                        </span>
                      </td>
                      <td className="ar mono">{Math.round(p.totalFptsPpr)}</td>
                      <td className="ar mono" style={{ color: "var(--ember)" }}>{ppg.toFixed(1)}</td>
                      <td className="ar mono dim">{vol ?? "—"}</td>
                      <td className="ar mono dim">{eff != null ? eff.toFixed(2) : "—"}</td>
                      <td className="ar">
                        <TrendBar trend={getTrend(ppg, activeFilter)} />
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
                <span className="insight-tag breakout">Data Lab</span>
                <span className="insight-time">Live</span>
              </div>
              <div className="insight-title">
                {t1Count > 0
                  ? `${t1Count} elite ${activeFilter}s identified across ${players.length} qualifying players`
                  : `Evaluating ${players.length} ${activeFilter}s with 4+ games played`}
              </div>
              <div className="insight-body">
                {topScorer
                  ? `${topScorer.playerName} leads all ${activeFilter}s with ${Math.round(topScorer.totalFptsPpr)} PPR points (${(topScorer.totalFptsPpr / Math.max(topScorer.gamesPlayed, 1)).toFixed(1)} PPG). The position group averages ${avgPpg} PPG across ${players.length} qualifiers.`
                  : `The Data Lab aggregation pipeline processes snap-level metrics across all ${activeFilter} players to surface fantasy-relevant efficiency and volume signals.`}
              </div>
              <div className="insight-source">Source: Data Lab Aggregation Pipeline</div>
              <div className="insight-metrics">
                <div>
                  <div className="insight-metric-label">Pool Size</div>
                  <div className="insight-metric-value">{players.length}</div>
                </div>
                <div>
                  <div className="insight-metric-label">Avg PPG</div>
                  <div className="insight-metric-value" style={{ color: "var(--ember)" }}>{avgPpg}</div>
                </div>
                <div>
                  <div className="insight-metric-label">Scoring</div>
                  <div className="insight-metric-value" style={{ fontSize: 12 }}>PPR</div>
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
            <span className="service-status">
              {healthData?.latestSnapshot
                ? `Active · Week ${healthData.latestSnapshot.week} loaded`
                : "Active · Snapshots available"}
            </span>
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
