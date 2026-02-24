import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  TrendingUp,
  TrendingDown,
  ChevronUp,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const POSITION_GROUPS = ["EDGE", "DI", "LB", "CB", "S"] as const;

const TIER_COLORS: Record<string, string> = {
  T1: "#16a34a",
  T2: "#65a30d",
  T3: "#ca8a04",
  T4: "#ea580c",
  T5: "#dc2626",
};

const TIER_BG: Record<string, string> = {
  T1: "rgba(22,163,74,0.08)",
  T2: "rgba(101,163,13,0.08)",
  T3: "rgba(202,138,4,0.08)",
  T4: "rgba(234,88,12,0.08)",
  T5: "rgba(220,38,38,0.08)",
};

type BatchPlayer = {
  gsis_id: string;
  player_name: string;
  team: string | null;
  position_group: string;
  alpha: number;
  tier: string;
  pillars: { volume: number; efficiency: number; teamContext: number; stability: number };
  games_played: number;
  total_snaps: number;
  havoc_index: number;
};

type ReplayPlayer = {
  gsis_id: string;
  player_name: string;
  team: string | null;
  position_group: string;
  current_alpha: number;
  current_tier: string;
  week_delta: number;
  trend: Array<{ week: number; alpha: number; tier: string; games: number }>;
};

type BatchResponse = {
  season: number;
  position_group: string;
  count: number;
  players: BatchPlayer[];
};

type ReplayResponse = {
  season: number;
  position_group: string;
  max_week: number;
  count: number;
  players: ReplayPlayer[];
  movers: { risers: ReplayPlayer[]; fallers: ReplayPlayer[] };
};

function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
        color: TIER_COLORS[tier] || "#666",
        backgroundColor: TIER_BG[tier] || "#f4f4f4",
        border: `1px solid ${TIER_COLORS[tier] || "#ccc"}`,
      }}
    >
      {tier}
    </span>
  );
}

function Sparkline({ trend, width = 120, height = 28 }: { trend: Array<{ week: number; alpha: number }>; width?: number; height?: number }) {
  if (trend.length < 2) return <span style={{ color: "#ccc", fontSize: 11 }}>—</span>;
  const alphas = trend.map(t => t.alpha);
  const min = Math.min(...alphas) - 2;
  const max = Math.max(...alphas) + 2;
  const range = max - min || 1;
  const points = alphas.map((a, i) => {
    const x = (i / (alphas.length - 1)) * width;
    const y = height - ((a - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  const lastAlpha = alphas[alphas.length - 1];
  const firstAlpha = alphas[0];
  const color = lastAlpha >= firstAlpha ? "#16a34a" : "#dc2626";

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span style={{ color: "#999", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>—</span>;
  const positive = delta > 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "'JetBrains Mono', monospace",
        color: positive ? "#16a34a" : "#dc2626",
      }}
    >
      {positive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      {positive ? "+" : ""}{delta.toFixed(1)}
    </span>
  );
}

function PillarBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ fontSize: 10, marginBottom: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 1 }}>
        <span style={{ color: "#888" }}>{label}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{value.toFixed(0)}</span>
      </div>
      <div style={{ height: 4, background: "#f0f0f0", borderRadius: 2 }}>
        <div style={{ height: 4, borderRadius: 2, background: "#e2640d", width: `${pct}%`, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function MoversPanel({ risers, fallers }: { risers: ReplayPlayer[]; fallers: ReplayPlayer[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
      <Card style={{ border: "1px solid rgba(22,163,74,0.2)" }}>
        <CardContent style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <TrendingUp size={16} color="#16a34a" />
            <span style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Instrument Sans', sans-serif", color: "#16a34a" }}>
              Risers
            </span>
          </div>
          {risers.length === 0 ? (
            <div style={{ color: "#999", fontSize: 12 }}>No risers this week</div>
          ) : (
            risers.slice(0, 5).map((p) => (
              <div key={p.gsis_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f5f5f5" }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.player_name}</span>
                  <span style={{ color: "#aaa", fontSize: 11, marginLeft: 6 }}>{p.team}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600 }}>{p.current_alpha}</span>
                  <DeltaBadge delta={p.week_delta} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card style={{ border: "1px solid rgba(220,38,38,0.2)" }}>
        <CardContent style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <TrendingDown size={16} color="#dc2626" />
            <span style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Instrument Sans', sans-serif", color: "#dc2626" }}>
              Fallers
            </span>
          </div>
          {fallers.length === 0 ? (
            <div style={{ color: "#999", fontSize: 12 }}>No fallers this week</div>
          ) : (
            fallers.slice(0, 5).map((p) => (
              <div key={p.gsis_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f5f5f5" }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.player_name}</span>
                  <span style={{ color: "#aaa", fontSize: 11, marginLeft: 6 }}>{p.team}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600 }}>{p.current_alpha}</span>
                  <DeltaBadge delta={p.week_delta} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlayerRow({ player, rank, replayData, onClick }: { player: BatchPlayer; rank: number; replayData?: ReplayPlayer; onClick: () => void }) {
  return (
    <tr
      onClick={onClick}
      style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer", transition: "background 0.1s" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#fafafa")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "")}
    >
      <td style={{ padding: "8px 10px", color: "#999", fontSize: 11 }}>{rank}</td>
      <td style={{ padding: "8px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 600, color: "#111" }}>{player.player_name}</span>
          <span style={{ color: "#aaa", fontSize: 11 }}>{player.team}</span>
        </div>
      </td>
      <td style={{ padding: "8px 10px" }}><TierBadge tier={player.tier} /></td>
      <td style={{ padding: "8px 10px", fontWeight: 700, color: "#e2640d", fontFamily: "'JetBrains Mono', monospace" }}>
        {player.alpha}
      </td>
      <td style={{ padding: "8px 10px" }}>
        {replayData ? <DeltaBadge delta={replayData.week_delta} /> : "—"}
      </td>
      <td style={{ padding: "8px 10px" }}>
        {replayData ? <Sparkline trend={replayData.trend} /> : "—"}
      </td>
      <td style={{ padding: "8px 10px", fontSize: 12 }}>{player.games_played}</td>
      <td style={{ padding: "8px 10px", fontSize: 12 }}>{player.total_snaps}</td>
      <td style={{ padding: "8px 10px", fontSize: 12 }}>{player.havoc_index.toFixed(0)}</td>
    </tr>
  );
}

function PlayerDetailPanel({ player, replayData, onClose }: { player: BatchPlayer; replayData?: ReplayPlayer; onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        style={{ background: "white", borderRadius: 12, padding: 24, maxWidth: 600, width: "90vw", maxHeight: "85vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Instrument Sans', sans-serif", margin: 0 }}>
              {player.player_name}
            </h2>
            <span style={{ color: "#666", fontSize: 13 }}>{player.team} · {player.position_group}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <TierBadge tier={player.tier} />
            <span style={{ fontWeight: 700, fontSize: 20, color: "#e2640d", fontFamily: "'JetBrains Mono', monospace" }}>
              {player.alpha}
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          <PillarBar label="Volume" value={player.pillars.volume} />
          <PillarBar label="Efficiency" value={player.pillars.efficiency} />
          <PillarBar label="Team Context" value={player.pillars.teamContext} />
          <PillarBar label="Stability" value={player.pillars.stability} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
          <MiniStat label="Games" value={player.games_played} />
          <MiniStat label="Snaps" value={player.total_snaps} />
          <MiniStat label="Havoc Index" value={player.havoc_index.toFixed(1)} accent />
        </div>

        {replayData && replayData.trend.length > 1 && (
          <>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#333" }}>
              Weekly Alpha Trend
            </h3>
            <div style={{ marginBottom: 16 }}>
              <Sparkline trend={replayData.trend} width={500} height={60} />
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e5e5", textAlign: "left" }}>
                    <th style={{ padding: "6px 8px" }}>Wk</th>
                    <th style={{ padding: "6px 8px" }}>Alpha</th>
                    <th style={{ padding: "6px 8px" }}>Tier</th>
                    <th style={{ padding: "6px 8px" }}>Games</th>
                    <th style={{ padding: "6px 8px" }}>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {replayData.trend.map((t, i) => {
                    const prev = i > 0 ? replayData.trend[i - 1].alpha : null;
                    const delta = prev !== null ? t.alpha - prev : 0;
                    return (
                      <tr key={t.week} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "6px 8px", fontWeight: 600 }}>{t.week}</td>
                        <td style={{ padding: "6px 8px", fontWeight: 600, color: "#e2640d" }}>{t.alpha}</td>
                        <td style={{ padding: "6px 8px" }}><TierBadge tier={t.tier} /></td>
                        <td style={{ padding: "6px 8px" }}>{t.games}</td>
                        <td style={{ padding: "6px 8px" }}>
                          {i === 0 ? "—" : <DeltaBadge delta={Math.round(delta * 10) / 10} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <button
          onClick={onClose}
          style={{ marginTop: 16, padding: "8px 20px", border: "1px solid #e5e5e5", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 13 }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: accent ? "rgba(226,100,13,0.06)" : "#fafafa", borderRadius: 6, fontSize: 12 }}>
      <span style={{ color: "#666" }}>{label}</span>
      <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: accent ? "#e2640d" : "#111" }}>{value}</span>
    </div>
  );
}

export default function IdpLab() {
  const [posFilter, setPosFilter] = useState<typeof POSITION_GROUPS[number]>("EDGE");
  const [season, setSeason] = useState(2025);
  const [selectedPlayer, setSelectedPlayer] = useState<BatchPlayer | null>(null);
  const [sortCol, setSortCol] = useState<string>("alpha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: batchData, isLoading: batchLoading } = useQuery<BatchResponse>({
    queryKey: [`/api/forge/idp/batch?position_group=${posFilter}&season=${season}&limit=100`],
  });

  const { data: replayData, isLoading: replayLoading } = useQuery<ReplayResponse>({
    queryKey: [`/api/forge/idp/replay?position_group=${posFilter}&season=${season}&limit=50`],
    staleTime: 5 * 60 * 1000,
  });

  const players = batchData?.players || [];
  const replayMap = new Map<string, ReplayPlayer>();
  if (replayData?.players) {
    for (const p of replayData.players) {
      replayMap.set(p.gsis_id, p);
    }
  }

  const sorted = [...players].sort((a, b) => {
    const aVal = sortCol === "week_delta" ? (replayMap.get(a.gsis_id)?.week_delta ?? -999) : (a as any)[sortCol] ?? -999;
    const bVal = sortCol === "week_delta" ? (replayMap.get(b.gsis_id)?.week_delta ?? -999) : (b as any)[sortCol] ?? -999;
    return sortDir === "desc" ? bVal - aVal : aVal - bVal;
  });

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const selectedReplay = selectedPlayer ? replayMap.get(selectedPlayer.gsis_id) : undefined;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1300 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Shield size={22} color="#e2640d" />
            <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Instrument Sans', sans-serif", margin: 0 }}>
              IDP FORGE Lab
            </h1>
            <Badge variant="outline" style={{ fontSize: 10, borderColor: "#e2640d", color: "#e2640d" }}>
              FORGE
            </Badge>
          </div>
          <p style={{ color: "#666", fontSize: 13, margin: 0, maxWidth: 600 }}>
            Defensive player evaluation powered by FORGE 4-pillar architecture: Volume, Efficiency (Havoc Index anchor), Team Context, and Stability.
            Alpha scores 0-100 with week-by-week replay.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[2024, 2025].map(s => (
            <button
              key={s}
              onClick={() => setSeason(s)}
              style={{
                padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer",
                border: season === s ? "1px solid #e2640d" : "1px solid #e5e5e5",
                background: season === s ? "rgba(226,100,13,0.08)" : "white",
                color: season === s ? "#e2640d" : "#555",
                fontWeight: season === s ? 600 : 400,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {POSITION_GROUPS.map((pg) => (
          <button
            key={pg}
            onClick={() => setPosFilter(pg)}
            style={{
              padding: "8px 20px", borderRadius: 6, fontSize: 13, cursor: "pointer",
              fontFamily: "'Instrument Sans', sans-serif",
              border: posFilter === pg ? "1px solid #e2640d" : "1px solid #e5e5e5",
              background: posFilter === pg ? "rgba(226,100,13,0.08)" : "white",
              color: posFilter === pg ? "#e2640d" : "#555",
              fontWeight: posFilter === pg ? 600 : 400,
            }}
          >
            {pg}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#888", alignSelf: "center" }}>
          {batchData?.count ?? 0} players
          {replayData?.max_week ? ` · Through Week ${replayData.max_week}` : ""}
        </span>
      </div>

      {replayData?.movers && !replayLoading && (
        <MoversPanel risers={replayData.movers.risers} fallers={replayData.movers.fallers} />
      )}

      {batchLoading ? (
        <div style={{ padding: 60, textAlign: "center", color: "#888", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Loader2 size={18} className="animate-spin" />
          Computing FORGE Alpha scores...
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e5e5", textAlign: "left", fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={{ padding: "8px 10px", width: 40 }}>#</th>
                <th style={{ padding: "8px 10px" }}>Player</th>
                <th style={{ padding: "8px 10px", width: 50 }}>Tier</th>
                <SortHeader label="Alpha" col="alpha" current={sortCol} dir={sortDir} onClick={toggleSort} />
                <SortHeader label="Delta" col="week_delta" current={sortCol} dir={sortDir} onClick={toggleSort} />
                <th style={{ padding: "8px 10px" }}>Trend</th>
                <SortHeader label="G" col="games_played" current={sortCol} dir={sortDir} onClick={toggleSort} />
                <SortHeader label="Snaps" col="total_snaps" current={sortCol} dir={sortDir} onClick={toggleSort} />
                <SortHeader label="Havoc" col="havoc_index" current={sortCol} dir={sortDir} onClick={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <PlayerRow
                  key={p.gsis_id}
                  player={p}
                  rank={i + 1}
                  replayData={replayMap.get(p.gsis_id)}
                  onClick={() => setSelectedPlayer(p)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {replayLoading && !batchLoading && (
        <div style={{ padding: 16, textAlign: "center", color: "#888", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Loader2 size={14} className="animate-spin" />
          Loading weekly replay data...
        </div>
      )}

      {selectedPlayer && (
        <PlayerDetailPanel
          player={selectedPlayer}
          replayData={selectedReplay}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}

function SortHeader({ label, col, current, dir, onClick }: { label: string; col: string; current: string; dir: "asc" | "desc"; onClick: (col: string) => void }) {
  const active = current === col;
  return (
    <th
      onClick={() => onClick(col)}
      style={{ padding: "8px 10px", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <span style={{ color: active ? "#e2640d" : "#888" }}>{label}</span>
        {active && <span style={{ fontSize: 9, color: "#e2640d" }}>{dir === "desc" ? "▼" : "▲"}</span>}
      </div>
    </th>
  );
}
