import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, Filter, ChevronDown, ChevronRight, TrendingUp } from "lucide-react";

type Position = "WR" | "RB" | "TE" | "QB";

interface PersonnelBreakdown {
  count: number;
  pct: number;
}

interface PersonnelProfile {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  season: number;
  weekStart: number | null;
  weekEnd: number | null;
  totalPlaysCounted: number;
  breakdown: Record<string, PersonnelBreakdown>;
  everyDownGrade: string;
  notes: string[];
}

const POSITION_TABS: Position[] = ["WR", "RB", "TE", "QB"];

const GRADE_INFO: Record<string, { label: string; color: string; description: string }> = {
  FULL_TIME: { label: "Full-Time", color: "#059669", description: "Meaningful usage across multiple personnel groupings" },
  "11_ONLY": { label: "11-Only", color: "#0891b2", description: "Primarily used in 3-WR sets (11 personnel)" },
  HEAVY_ONLY: { label: "Heavy Only", color: "#ca8a04", description: "Primarily used in heavy personnel (12/13)" },
  ROTATIONAL: { label: "Rotational", color: "#6b7280", description: "Mixed usage without a dominant grouping" },
  LOW_SAMPLE: { label: "Low Sample", color: "#9ca3af", description: "Not enough data to classify reliably" },
};

const PERSONNEL_LABELS: Record<string, string> = {
  "10": "10 (1RB/0TE)",
  "11": "11 (1RB/1TE)",
  "12": "12 (1RB/2TE)",
  "13": "13 (1RB/3TE)",
  "21": "21 (2RB/1TE)",
  "22": "22 (2RB/2TE)",
  "other": "Other",
};

const PERSONNEL_COLORS: Record<string, string> = {
  "10": "#8b5cf6",
  "11": "#e2640d",
  "12": "#0891b2",
  "13": "#059669",
  "21": "#dc2626",
  "22": "#ca8a04",
  "other": "#9ca3af",
};

function PersonnelBar({ breakdown }: { breakdown: Record<string, PersonnelBreakdown> }) {
  const entries = Object.entries(breakdown)
    .filter(([, v]) => v.pct > 0)
    .sort((a, b) => b[1].pct - a[1].pct);

  return (
    <div style={{ display: "flex", height: 24, borderRadius: 6, overflow: "hidden", width: "100%" }}>
      {entries.map(([key, val]) => (
        <div
          key={key}
          title={`${PERSONNEL_LABELS[key] || key}: ${(val.pct * 100).toFixed(1)}% (${val.count} snaps)`}
          style={{
            width: `${val.pct * 100}%`,
            backgroundColor: PERSONNEL_COLORS[key] || "#9ca3af",
            minWidth: val.pct > 0.02 ? 4 : 0,
            transition: "width 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const info = GRADE_INFO[grade] || { label: grade, color: "#6b7280", description: "" };
  return (
    <span
      title={info.description}
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
        backgroundColor: info.color + "18",
        color: info.color,
        border: `1px solid ${info.color}40`,
        letterSpacing: "0.02em",
      }}
    >
      {info.label}
    </span>
  );
}

function PlayerCard({ profile, isExpanded, onToggle }: { profile: PersonnelProfile; isExpanded: boolean; onToggle: () => void }) {
  const topGrouping = Object.entries(profile.breakdown)
    .filter(([, v]) => v.pct > 0)
    .sort((a, b) => b[1].pct - a[1].pct)[0];

  return (
    <div className="pu-card" onClick={onToggle} style={{ cursor: "pointer" }}>
      <div className="pu-card-header">
        <div className="pu-card-player">
          <span className="pu-card-name">{profile.playerName}</span>
          <span className="pu-card-meta">{profile.position} · {profile.team}</span>
        </div>
        <div className="pu-card-stats">
          <GradeBadge grade={profile.everyDownGrade} />
          <span className="pu-card-plays">{profile.totalPlaysCounted} snaps</span>
          <ChevronDown size={14} style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", opacity: 0.4 }} />
        </div>
      </div>

      <div className="pu-card-bar-row">
        <PersonnelBar breakdown={profile.breakdown} />
        <div className="pu-card-bar-labels">
          {Object.entries(profile.breakdown)
            .filter(([, v]) => v.pct > 0.03)
            .sort((a, b) => b[1].pct - a[1].pct)
            .map(([key, val]) => (
              <span key={key} style={{ color: PERSONNEL_COLORS[key] || "#6b7280", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                {key}: {(val.pct * 100).toFixed(0)}%
              </span>
            ))}
        </div>
      </div>

      {isExpanded && (
        <div className="pu-card-detail">
          <div className="pu-detail-grid">
            {Object.entries(profile.breakdown)
              .sort((a, b) => b[1].pct - a[1].pct)
              .map(([key, val]) => (
                <div key={key} className="pu-detail-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: PERSONNEL_COLORS[key] || "#9ca3af" }} />
                    <span className="pu-detail-label">{PERSONNEL_LABELS[key] || key}</span>
                  </div>
                  <div className="pu-detail-values">
                    <span className="pu-detail-pct">{(val.pct * 100).toFixed(1)}%</span>
                    <span className="pu-detail-count">{val.count} snaps</span>
                  </div>
                  <div className="pu-detail-bar-bg">
                    <div
                      className="pu-detail-bar-fill"
                      style={{ width: `${val.pct * 100}%`, backgroundColor: PERSONNEL_COLORS[key] || "#9ca3af" }}
                    />
                  </div>
                </div>
              ))}
          </div>
          {topGrouping && (
            <div className="pu-detail-insight">
              <TrendingUp size={14} />
              <span>
                Primary grouping: <strong>{PERSONNEL_LABELS[topGrouping[0]] || topGrouping[0]}</strong> at {(topGrouping[1].pct * 100).toFixed(0)}% of snaps
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PersonnelUsage() {
  const [position, setPosition] = useState<Position>("WR");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"plays" | "11pct" | "12pct">("plays");

  const { data: profiles, isLoading, error } = useQuery<PersonnelProfile[]>({
    queryKey: ["/api/personnel/profile", position],
    queryFn: async () => {
      const res = await fetch(`/api/personnel/profile?season=2025&position=${position}&limit=200`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      return json.profiles ?? json;
    },
  });

  const filtered = useMemo(() => {
    if (!profiles) return [];
    let result = profiles;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.playerName.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      if (sortBy === "plays") return b.totalPlaysCounted - a.totalPlaysCounted;
      if (sortBy === "11pct") return (b.breakdown["11"]?.pct || 0) - (a.breakdown["11"]?.pct || 0);
      if (sortBy === "12pct") return (b.breakdown["12"]?.pct || 0) - (a.breakdown["12"]?.pct || 0);
      return 0;
    });

    return result;
  }, [profiles, search, sortBy]);

  return (
    <div className="pu-page">
      <div className="pu-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>
            <Link href="/tiber-data-lab" style={{ color: "#9ca3af", textDecoration: "none" }} className="hover:!text-[#e2640d]">Data Lab</Link>
            <ChevronRight size={12} />
            <span style={{ color: "#374151", fontWeight: 500 }}>Personnel</span>
          </div>
          <h1 className="pu-title">Personnel Groupings</h1>
          <p className="pu-subtitle">
            Player usage across NFL personnel groupings — understand who plays in 11 (3WR), 12 (2TE), and heavy sets
          </p>
        </div>
        <div className="pu-header-badge">
          <Users size={16} />
          <span>2025 Season · Participation-based</span>
        </div>
      </div>

      <div className="pu-toolbar">
        <div className="pu-position-tabs">
          {POSITION_TABS.map((pos) => (
            <button
              key={pos}
              className={`pu-tab ${position === pos ? "active" : ""}`}
              onClick={() => { setPosition(pos); setSearch(""); setExpandedId(null); }}
            >
              {pos}
            </button>
          ))}
        </div>

        <div className="pu-search-box">
          <Search size={14} style={{ opacity: 0.4 }} />
          <input
            type="text"
            placeholder="Search player or team..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pu-search-input"
          />
        </div>

        <div className="pu-sort-control">
          <Filter size={14} style={{ opacity: 0.4 }} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="pu-sort-select"
          >
            <option value="plays">Most Snaps</option>
            <option value="11pct">Highest 11%</option>
            <option value="12pct">Highest 12%</option>
          </select>
        </div>
      </div>

      <div className="pu-legend">
        {Object.entries(PERSONNEL_COLORS).filter(([k]) => k !== "other").map(([key, color]) => (
          <div key={key} className="pu-legend-item">
            <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
            <span>{PERSONNEL_LABELS[key] || key}</span>
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="pu-loading">
          <div className="pu-spinner" />
          <span>Loading personnel data...</span>
        </div>
      )}

      {error && (
        <div className="pu-error">Failed to load personnel data. Please try again.</div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="pu-empty">
          {search ? `No ${position} players matching "${search}"` : `No ${position} personnel data available`}
        </div>
      )}

      <div className="pu-list">
        {filtered.map((profile) => (
          <PlayerCard
            key={profile.playerId}
            profile={profile}
            isExpanded={expandedId === profile.playerId}
            onToggle={() => setExpandedId(expandedId === profile.playerId ? null : profile.playerId)}
          />
        ))}
      </div>
    </div>
  );
}
