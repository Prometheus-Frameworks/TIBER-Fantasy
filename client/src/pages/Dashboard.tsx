import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { useCurrentNFLWeek } from "@/hooks/useCurrentNFLWeek";
import { DataLabCommandCenterResponse } from "@/lib/dataLabCommandCenter";
import { DataLabDiscoveryWidget } from "@/components/data-lab/DataLabDiscoveryWidget";

interface LabPlayer {
  playerName: string;
  teamId: string;
  position: string;
  gamesPlayed: number;
  totalFptsPpr: number;
  avgEpaPerTarget?: number;
  avgEpaPerDropback?: number;
  avgEpaPerPlay?: number;
  totalTargets?: number;
  totalRushAttempts?: number;
  totalDropbacks?: number;
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
    WR: [16, 10],
    RB: [15, 9],
    QB: [20, 14],
    TE: [12, 7],
  };
  const t = thresholds[pos] || thresholds.WR;
  if (ppg >= t[0]) return "rising";
  if (ppg >= t[1]) return "steady";
  return "falling";
}

function TrendBar({ trend }: { trend: "rising" | "steady" | "falling" }) {
  const bars = {
    rising: [
      { h: 6, c: "t-steady" },
      { h: 8, c: "t-steady" },
      { h: 11, c: "t-rising" },
      { h: 14, c: "t-rising" },
      { h: 16, c: "t-rising" },
      { h: 18, c: "t-rising" },
    ],
    steady: [
      { h: 10, c: "t-steady" },
      { h: 9, c: "t-steady" },
      { h: 9, c: "t-steady" },
      { h: 8, c: "t-steady" },
      { h: 9, c: "t-steady" },
      { h: 9, c: "t-steady" },
    ],
    falling: [
      { h: 14, c: "t-steady" },
      { h: 12, c: "t-steady" },
      { h: 10, c: "t-falling" },
      { h: 8, c: "t-falling" },
      { h: 7, c: "t-falling" },
      { h: 6, c: "t-falling" },
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

const entryLanes = [
  {
    title: "Rankings",
    description: "Set lineups and make trade calls with updated tiers and player context.",
    href: "/tiers",
    cta: "Open Tiers",
  },
  {
    title: "Rookie Board",
    description: "Check rookie grades, tiers, and valuation context for draft and dynasty moves.",
    href: "/rookies",
    cta: "Open Rookie Board",
  },
  {
    title: "Research",
    description: "Start in Command Center, then drill into player and team research workspaces.",
    href: "/tiber-data-lab/command-center",
    cta: "Open Command Center",
  },
  {
    title: "Agent/API",
    description: "Use TiberClaw and intelligence tools when you need assistant-style workflows.",
    href: "/tiberclaw",
    cta: "Open TiberClaw",
  },
];

export default function Dashboard() {
  const [activeFilter, setActiveFilter] = useState("WR");
  const [searchQuery, setSearchQuery] = useState("");
  const { season } = useCurrentNFLWeek();

  const { data: labData, isLoading } = useQuery<{ data: LabPlayer[]; count: number }>({
    queryKey: ["/api/data-lab/lab-agg", activeFilter, season],
    queryFn: () =>
      fetch(`/api/data-lab/lab-agg?season=${season}&position=${activeFilter}&limit=100`).then((r) => r.json()),
  });

  const { data: healthData } = useQuery<{
    status: string;
    latestSnapshot?: { season: number; week: number; rowCount: number };
    tableCounts?: { snapshotPlayerSeason: number; snapshotPlayerWeek: number };
  }>({
    queryKey: ["/api/data-lab/health"],
  });

  const { data: commandCenterData, isLoading: isCommandCenterLoading } = useQuery<DataLabCommandCenterResponse>({
    queryKey: ["/api/data-lab/command-center", "dashboard-widget-default"],
    queryFn: async () => {
      const res = await fetch("/api/data-lab/command-center");
      if (!res.ok) throw new Error("Failed to fetch Data Lab Command Center");
      return res.json();
    },
    retry: false,
  });

  const players = useMemo(() => {
    const raw = labData?.data || [];
    return raw.filter((p) => p.gamesPlayed >= 4).sort((a, b) => b.totalFptsPpr - a.totalFptsPpr);
  }, [labData]);

  const filtered = searchQuery
    ? players.filter((p) => p.playerName?.toLowerCase().includes(searchQuery.toLowerCase()))
    : players;
  const topPlayers = filtered.slice(0, 20);

  const ppgValues = players.map((p) => p.totalFptsPpr / Math.max(p.gamesPlayed, 1));
  const avgPpg =
    ppgValues.length > 0 ? Math.round((ppgValues.reduce((s, v) => s + v, 0) / ppgValues.length) * 10) / 10 : 0;
  const t1Count = players.filter((p) => {
    const ppg = p.totalFptsPpr / Math.max(p.gamesPlayed, 1);
    return getPpgTier(ppg, activeFilter).cls === "tier-1";
  }).length;
  const topScorer = players[0];

  return (
    <>
      <div className="tiber-hero">
        <div className="hero-title">TIBER</div>
        <div className="hero-sub">Fantasy decisions, research workflows, and agent tools in one place</div>
        <div className="hero-value-prop">
          TIBER helps you move from question to decision quickly. Start with rankings or rookies, open research when you
          need deeper context, and use agent tools for faster exploration.
        </div>
      </div>

      <div className="tiber-content stagger-children">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 14,
          }}
        >
          {entryLanes.map((lane) => (
            <div key={lane.title} className="insight-card" style={{ marginBottom: 0 }}>
              <div className="status-label" style={{ marginBottom: 8 }}>
                {lane.title}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 10 }}>
                {lane.description}
              </div>
              <Link href={lane.href} className="tool-btn" style={{ textDecoration: "none", minHeight: "auto", minWidth: "auto", padding: "5px 10px", fontSize: 11 }}>
                {lane.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="status-row">
          <div className="status-card">
            <div className="status-label">Season Context</div>
            <div className="status-value">{season}</div>
            <div className="status-sub">Current default season across tools</div>
          </div>
          <div className="status-card">
            <div className="status-label">Players Tracked</div>
            <div className="status-value">{players.length || "—"}</div>
            <div className="status-sub">{activeFilter} pool · 4+ games played</div>
          </div>
          <div className="status-card">
            <div className="status-label">T1 Elite</div>
            <div className="status-value">
              {t1Count}
              {t1Count > 0 && <span className="status-delta delta-up">Top tier</span>}
            </div>
            <div className="status-sub">Top PPG tier in this position view</div>
          </div>
          <div className="status-card">
            <div className="status-label">Data Pipeline</div>
            <div className="status-value" style={{ fontSize: 16, fontFamily: "var(--font-mono)" }}>
              {healthData?.status === "healthy" ? "Healthy" : "Active"}
            </div>
            <div className="status-sub">
              {healthData?.tableCounts ? `${healthData.tableCounts.snapshotPlayerSeason.toLocaleString()} season records` : "Loading latest snapshot"}
            </div>
          </div>
        </div>

        <div className="section-header">
          <div className="section-title">
            <span className="section-dot" />
            Research Snapshot
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Link href="/tiber-data-lab/command-center" className="tool-btn" style={{ fontSize: 11, padding: "4px 10px", minHeight: "auto", minWidth: "auto", textDecoration: "none" }}>
              Full Command Center
            </Link>
          </div>
        </div>
        <DataLabDiscoveryWidget
          season={String(commandCenterData?.data.season ?? season)}
          data={commandCenterData?.data ?? null}
          isLoading={isCommandCenterLoading}
          fallbackSummary={{
            playersTracked: players.length,
            avgPpg,
            t1Count,
            topScorerName: topScorer?.playerName ?? null,
            topScorerPpg: topScorer ? topScorer.totalFptsPpr / Math.max(topScorer.gamesPlayed, 1) : null,
          }}
        />

        <div className="section-header">
          <div className="section-title">
            <span className="section-dot" />
            Player Snapshot — {activeFilter}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {["WR", "RB", "QB", "TE"].map((pos) => (
              <button key={pos} className={`tool-btn ${activeFilter === pos ? "active" : ""}`} onClick={() => setActiveFilter(pos)}>
                {pos}
              </button>
            ))}
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
                    <td>
                      <div style={{ height: 14, width: 60, background: "var(--bg-tertiary)", borderRadius: 3 }} />
                    </td>
                    <td className="ar">
                      <div style={{ height: 14, width: 30, background: "var(--bg-tertiary)", borderRadius: 3, marginLeft: "auto" }} />
                    </td>
                    <td className="ar">
                      <div style={{ height: 14, width: 30, background: "var(--bg-tertiary)", borderRadius: 3, marginLeft: "auto" }} />
                    </td>
                    <td className="ar">
                      <div style={{ height: 14, width: 30, background: "var(--bg-tertiary)", borderRadius: 3, marginLeft: "auto" }} />
                    </td>
                    <td className="ar">
                      <div style={{ height: 14, width: 30, background: "var(--bg-tertiary)", borderRadius: 3, marginLeft: "auto" }} />
                    </td>
                    <td className="ar">
                      <div style={{ height: 18, width: 24, background: "var(--bg-tertiary)", borderRadius: 3, marginLeft: "auto" }} />
                    </td>
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
                          <div className="player-name-cell">{p.playerName}</div>
                          <div className="player-meta">
                            {p.position} · {p.teamId || "—"} · {p.gamesPlayed}G
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`tier-badge ${tier.cls}`}>{tier.label}</span>
                      </td>
                      <td className="ar mono">{Math.round(p.totalFptsPpr)}</td>
                      <td className="ar mono" style={{ color: "var(--ember)" }}>
                        {ppg.toFixed(1)}
                      </td>
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

        <div className="section-header">
          <div className="section-title">
            <span className="section-dot" />
            Tools & Access
          </div>
        </div>
        <div className="insight-card" style={{ marginBottom: 32 }}>
          <div className="service-row">
            <span className="service-dot on" />
            <span className="service-name">TiberClaw</span>
            <span className="service-status">
              Assistant workspace · <Link href="/tiberclaw">open</Link>
            </span>
          </div>
          <div className="service-row">
            <span className="service-dot on" />
            <span className="service-name">X Intelligence</span>
            <span className="service-status">
              Live signal feed · <Link href="/x-intel">open</Link>
            </span>
          </div>
          <div className="service-row">
            <span className="service-dot pending" />
            <span className="service-name">Legacy Chat</span>
            <span className="service-status">
              Older assistant experience · <Link href="/legacy-chat">open</Link>
            </span>
          </div>
          <div className="service-row">
            <span className="service-dot on" />
            <span className="service-name">Builder/Admin</span>
            <span className="service-status">
              Internal routes remain available under System &amp; Builder navigation
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
