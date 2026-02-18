import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  Download,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { IdpPlayerSeason, IdpPlayerWeek } from "@shared/schema";

const POSITION_GROUPS = ["ALL", "EDGE", "DI", "LB", "CB", "S"] as const;

const TIER_COLORS: Record<string, string> = {
  T1: "#16a34a",
  T2: "#65a30d",
  T3: "#ca8a04",
  T4: "#ea580c",
  T5: "#dc2626",
};

const TIER_BG: Record<string, string> = {
  T1: "rgba(22,163,74,0.1)",
  T2: "rgba(101,163,13,0.1)",
  T3: "rgba(202,138,4,0.1)",
  T4: "rgba(234,88,12,0.1)",
  T5: "rgba(220,38,38,0.1)",
};

type RankedPlayer = IdpPlayerSeason & {
  rank: number;
  lowConfidence: boolean;
  meetsSnapThreshold: boolean;
};

interface RankingsResponse {
  season: number;
  positionGroup: string;
  minSnaps: number;
  total: number;
  results: RankedPlayer[];
}

interface PlayerDetail {
  season: IdpPlayerSeason;
  weekly: IdpPlayerWeek[];
  lowConfidence: boolean;
}

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;
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

function LowConfBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 6px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        color: "#b45309",
        backgroundColor: "rgba(245,158,11,0.1)",
        border: "1px solid rgba(245,158,11,0.3)",
      }}
    >
      <AlertTriangle size={10} /> LOW CONF
    </span>
  );
}

function PlayerDetailModal({
  gsisId,
  onClose,
}: {
  gsisId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery<PlayerDetail>({
    queryKey: [`/api/idp/player/${gsisId}?season=2024`],
  });

  if (isLoading)
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.4)",
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: "white",
            borderRadius: 12,
            padding: 32,
            minWidth: 300,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          Loading...
        </div>
      </div>
    );

  if (!data?.season) return null;

  const p = data.season;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.4)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: 24,
          maxWidth: 700,
          width: "90vw",
          maxHeight: "85vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                fontFamily: "'Instrument Sans', sans-serif",
                margin: 0,
              }}
            >
              {p.playerName}
            </h2>
            <span style={{ color: "#666", fontSize: 13 }}>
              {p.team} · {p.nflPosition} · {p.positionGroup}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <TierBadge tier={p.havocTier} />
            {data.lowConfidence && <LowConfBadge />}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <StatCard
            label="Havoc Index"
            value={p.havocIndex?.toFixed(1) ?? "—"}
            accent
          />
          <StatCard label="Games" value={p.games} />
          <StatCard label="Snaps" value={p.totalSnaps} />
          <StatCard label="Havoc Events" value={p.totalHavocEvents} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <MiniStat label="Solo Tackles" value={p.tacklesSolo} />
          <MiniStat label="Assists" value={p.tacklesAssist} />
          <MiniStat label="Total Tackles" value={p.tacklesTotal} />
          <MiniStat label="Sacks" value={p.sacks} />
          <MiniStat label="TFL" value={p.tacklesForLoss} />
          <MiniStat label="INT" value={p.interceptions} />
          <MiniStat label="PD" value={p.passesDefended} />
          <MiniStat label="FF" value={p.forcedFumbles} />
          <MiniStat
            label="QB Hits"
            value={p.qbHits ?? "—"}
            optional
          />
        </div>

        {data.weekly.length > 0 && (
          <>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 8,
                color: "#333",
              }}
            >
              Weekly Log
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "2px solid #e5e5e5",
                      textAlign: "left",
                    }}
                  >
                    <th style={{ padding: "6px 8px" }}>Wk</th>
                    <th style={{ padding: "6px 8px" }}>Snaps</th>
                    <th style={{ padding: "6px 8px" }}>Tkl</th>
                    <th style={{ padding: "6px 8px" }}>Sacks</th>
                    <th style={{ padding: "6px 8px" }}>TFL</th>
                    <th style={{ padding: "6px 8px" }}>INT</th>
                    <th style={{ padding: "6px 8px" }}>PD</th>
                    <th style={{ padding: "6px 8px" }}>FF</th>
                    <th style={{ padding: "6px 8px" }}>Havoc</th>
                  </tr>
                </thead>
                <tbody>
                  {data.weekly.map((w) => (
                    <tr
                      key={w.week}
                      style={{ borderBottom: "1px solid #f0f0f0" }}
                    >
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>
                        {w.week}
                      </td>
                      <td style={{ padding: "6px 8px" }}>{w.defenseSnaps}</td>
                      <td style={{ padding: "6px 8px" }}>{w.tacklesTotal}</td>
                      <td style={{ padding: "6px 8px" }}>{w.sacks}</td>
                      <td style={{ padding: "6px 8px" }}>{w.tacklesForLoss}</td>
                      <td style={{ padding: "6px 8px" }}>{w.interceptions}</td>
                      <td style={{ padding: "6px 8px" }}>
                        {w.passesDefended}
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        {w.forcedFumbles}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          fontWeight: 600,
                          color: "#e2640d",
                        }}
                      >
                        {w.havocEvents}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            padding: "8px 20px",
            border: "1px solid #e5e5e5",
            borderRadius: 6,
            background: "white",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: accent ? "rgba(226,100,13,0.06)" : "#fafafa",
        border: accent ? "1px solid rgba(226,100,13,0.2)" : "1px solid #e5e5e5",
        borderRadius: 8,
        padding: "12px 14px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: accent ? 24 : 20,
          fontWeight: 700,
          color: accent ? "#e2640d" : "#111",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  optional,
}: {
  label: string;
  value: string | number;
  optional?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 10px",
        background: "#fafafa",
        borderRadius: 4,
        fontSize: 12,
      }}
    >
      <span style={{ color: "#666" }}>
        {label}
        {optional && (
          <span style={{ fontSize: 9, color: "#aaa", marginLeft: 3 }}>
            opt
          </span>
        )}
      </span>
      <span
        style={{
          fontWeight: 600,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function IdpLab() {
  const [posFilter, setPosFilter] = useState("ALL");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<string>("havocIndex");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const posParam = posFilter === "ALL" ? "" : `&position=${posFilter}`;
  const rankingsUrl = `/api/idp/rankings?season=2024&limit=200${posParam}`;
  const { data, isLoading } = useQuery<RankingsResponse>({
    queryKey: [rankingsUrl],
  });

  const results = data?.results || [];

  const sorted = [...results].sort((a, b) => {
    const aVal = (a as any)[sortCol] ?? -999;
    const bVal = (b as any)[sortCol] ?? -999;
    return sortDir === "desc" ? bVal - aVal : aVal - bVal;
  });

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const handleExport = () => {
    const posParam = posFilter === "ALL" ? "" : `&position=${posFilter}`;
    window.open(`/api/idp/export/csv?season=2024${posParam}`, "_blank");
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 4,
            }}
          >
            <Shield size={22} color="#e2640d" />
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                fontFamily: "'Instrument Sans', sans-serif",
                margin: 0,
              }}
            >
              IDP Lab
            </h1>
            <Badge
              variant="outline"
              style={{ fontSize: 10, borderColor: "#e2640d", color: "#e2640d" }}
            >
              MVP
            </Badge>
          </div>
          <p style={{ color: "#666", fontSize: 13, margin: 0 }}>
            Defensive player analytics powered by the Havoc Index — a
            Bayesian-smoothed, position-normalized disruption metric (0–100).
          </p>
        </div>
        <button
          onClick={handleExport}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            border: "1px solid #e5e5e5",
            borderRadius: 6,
            background: "white",
            cursor: "pointer",
            fontSize: 12,
            color: "#555",
          }}
        >
          <Download size={14} /> CSV
        </button>
      </div>

      <Card style={{ marginBottom: 16, border: "1px solid #e5e5e5" }}>
        <CardContent style={{ padding: 12 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              fontSize: 12,
              color: "#888",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <span style={{ fontWeight: 600, color: "#555" }}>FORMULA:</span>
            <span>
              smoothed_rate = (havoc_events + 200 × pos_mean) / (snaps + 200)
            </span>
            <span style={{ color: "#ccc" }}>|</span>
            <span>z = clamp((smoothed - mean) / std, -3, +3)</span>
            <span style={{ color: "#ccc" }}>|</span>
            <span>
              index = (z + 3) / 6 × 100
            </span>
          </div>
        </CardContent>
      </Card>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {POSITION_GROUPS.map((pg) => (
          <button
            key={pg}
            onClick={() => setPosFilter(pg)}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              border:
                posFilter === pg
                  ? "1px solid #e2640d"
                  : "1px solid #e5e5e5",
              background: posFilter === pg ? "rgba(226,100,13,0.08)" : "white",
              color: posFilter === pg ? "#e2640d" : "#555",
              fontWeight: posFilter === pg ? 600 : 400,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "'Instrument Sans', sans-serif",
            }}
          >
            {pg}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#888" }}>
          {data?.total ?? 0} players · Min 150 snaps for full confidence
        </span>
      </div>

      {isLoading ? (
        <div
          style={{ padding: 40, textAlign: "center", color: "#888" }}
        >
          Loading rankings...
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "2px solid #e5e5e5",
                  textAlign: "left",
                  fontSize: 11,
                  color: "#888",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <th style={{ padding: "8px 10px", width: 40 }}>#</th>
                <th style={{ padding: "8px 10px" }}>Player</th>
                <th style={{ padding: "8px 10px", width: 50 }}>Pos</th>
                <th style={{ padding: "8px 10px", width: 40 }}>Tier</th>
                <SortHeader
                  label="Havoc"
                  col="havocIndex"
                  current={sortCol}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortHeader
                  label="G"
                  col="games"
                  current={sortCol}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortHeader
                  label="Snaps"
                  col="totalSnaps"
                  current={sortCol}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortHeader
                  label="Tkl"
                  col="tacklesTotal"
                  current={sortCol}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortHeader
                  label="Sacks"
                  col="sacks"
                  current={sortCol}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortHeader
                  label="TFL"
                  col="tacklesForLoss"
                  current={sortCol}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortHeader
                  label="INT"
                  col="interceptions"
                  current={sortCol}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortHeader
                  label="PD"
                  col="passesDefended"
                  current={sortCol}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortHeader
                  label="FF"
                  col="forcedFumbles"
                  current={sortCol}
                  dir={sortDir}
                  onClick={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr
                  key={p.gsisId}
                  onClick={() => setSelectedPlayer(p.gsisId)}
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "#fafafa")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = "")
                  }
                >
                  <td
                    style={{
                      padding: "8px 10px",
                      color: "#999",
                      fontSize: 11,
                    }}
                  >
                    {i + 1}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 600, color: "#111" }}>
                        {p.playerName}
                      </span>
                      <span style={{ color: "#aaa", fontSize: 11 }}>
                        {p.team}
                      </span>
                      {p.lowConfidence && <LowConfBadge />}
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", color: "#666" }}>
                    {p.positionGroup}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <TierBadge tier={p.havocTier} />
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      fontWeight: 700,
                      color: "#e2640d",
                    }}
                  >
                    {p.havocIndex?.toFixed(1) ?? "—"}
                  </td>
                  <td style={{ padding: "8px 10px" }}>{p.games}</td>
                  <td style={{ padding: "8px 10px" }}>{p.totalSnaps}</td>
                  <td style={{ padding: "8px 10px" }}>{p.tacklesTotal}</td>
                  <td style={{ padding: "8px 10px" }}>{p.sacks}</td>
                  <td style={{ padding: "8px 10px" }}>{p.tacklesForLoss}</td>
                  <td style={{ padding: "8px 10px" }}>{p.interceptions}</td>
                  <td style={{ padding: "8px 10px" }}>{p.passesDefended}</td>
                  <td style={{ padding: "8px 10px" }}>{p.forcedFumbles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedPlayer && (
        <PlayerDetailModal
          gsisId={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}

function SortHeader({
  label,
  col,
  current,
  dir,
  onClick,
}: {
  label: string;
  col: string;
  current: string;
  dir: "asc" | "desc";
  onClick: (col: string) => void;
}) {
  const active = current === col;
  return (
    <th
      onClick={() => onClick(col)}
      style={{
        padding: "8px 10px",
        cursor: "pointer",
        userSelect: "none",
        color: active ? "#e2640d" : "#888",
        fontWeight: active ? 700 : 500,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {label}
        {active && (
          <span style={{ fontSize: 9 }}>{dir === "desc" ? "▼" : "▲"}</span>
        )}
      </div>
    </th>
  );
}
