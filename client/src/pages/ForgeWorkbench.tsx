import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Search, Settings2, Activity, TrendingUp, Shield, Users, Zap, ChevronDown, AlertTriangle, Info } from "lucide-react";

type ViewMode = "redraft" | "dynasty" | "bestball";

interface PlayerSearchResult {
  playerId: string;
  displayName: string;
  position: string;
  currentTeam: string | null;
}

interface PillarMetricInfo {
  key: string;
  source: string;
  weight: number;
  invert?: boolean;
}

interface ForgeWeights {
  volume: number;
  efficiency: number;
  teamContext: number;
  stability: number;
}

interface ForgeGradeData {
  alpha: number;
  tier: string;
  tierPosition: number;
  pillars: { volume: number; efficiency: number; teamContext: number; stability: number; dynastyContext?: number };
  issues?: Array<{ pillar: string; adjustment: number; severity: string; reason: string }>;
  debug?: { baseAlpha: number; recursionAdjustment: number; footballLensAdjusted: boolean };
  weights: ForgeWeights;
}

interface WorkbenchData {
  player: { id: string; name: string; position: string; team: string; gamesPlayed: number; season: number };
  pillars: { volume: number; efficiency: number; teamContext: number; stability: number; dynastyContext?: number };
  pillarConfig: Record<string, PillarMetricInfo[]>;
  grades: { redraft: ForgeGradeData; dynasty: ForgeGradeData; bestball: ForgeGradeData };
  recursion: { priorAlpha?: number; alphaMomentum?: number };
  qbContext: { qbId: string; qbName: string; qbRedraftScore: number; qbDynastyScore: number; qbSkillScore: number; qbStabilityScore: number; qbDurabilityScore: number } | null;
  rawMetrics: Record<string, number | null>;
}

const PILLAR_ICONS: Record<string, typeof Activity> = {
  volume: Activity,
  efficiency: Zap,
  teamContext: Users,
  stability: Shield,
};

const PILLAR_LABELS: Record<string, string> = {
  volume: "Volume",
  efficiency: "Efficiency",
  teamContext: "Team Context",
  stability: "Stability",
};

const MODE_LABELS: Record<ViewMode, string> = {
  redraft: "Redraft",
  dynasty: "Dynasty",
  bestball: "Best Ball",
};

function tierColor(tier: string): string {
  switch (tier) {
    case "T1": return "#059669";
    case "T2": return "#0891b2";
    case "T3": return "#ca8a04";
    case "T4": return "#dc2626";
    case "T5": return "#6b7280";
    default: return "#6b7280";
  }
}

function PillarBar({ label, score, weight, icon: Icon }: { label: string; score: number; weight: number; icon: typeof Activity }) {
  return (
    <div className="wb-pillar-bar">
      <div className="wb-pillar-bar-header">
        <span className="wb-pillar-bar-label"><Icon size={12} /> {label}</span>
        <span className="wb-pillar-bar-vals">
          <span className="wb-pillar-score">{score.toFixed(1)}</span>
          <span className="wb-pillar-weight">x{(weight * 100).toFixed(0)}%</span>
        </span>
      </div>
      <div className="wb-pillar-track">
        <div className="wb-pillar-fill" style={{ width: `${Math.min(100, score)}%` }} />
      </div>
    </div>
  );
}

export default function ForgeWorkbench() {
  useEffect(() => {
    document.title = "FORGE Workbench - Tiber Fantasy";
  }, []);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WorkbenchData | null>(null);
  const [mode, setMode] = useState<ViewMode>("redraft");
  const [customWeights, setCustomWeights] = useState<ForgeWeights | null>(null);
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const doSearch = useCallback((q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    fetch(`/api/forge/workbench/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setSearchResults(res.data);
          setShowDropdown(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(val), 250);
  };

  const selectPlayer = async (player: PlayerSearchResult) => {
    setSearch(player.displayName);
    setShowDropdown(false);
    setLoading(true);
    setCustomWeights(null);
    setExpandedPillar(null);

    try {
      const res = await fetch(`/api/forge/workbench/player/${player.playerId}?position=${player.position}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to load player:", err);
    } finally {
      setLoading(false);
    }
  };

  const activeGrade = data ? data.grades[mode] : null;
  const activeWeights = customWeights || (activeGrade ? activeGrade.weights : null);

  const computedAlpha = useMemo(() => {
    if (!data || !activeWeights) return null;
    const p = data.pillars;
    const w = activeWeights;
    const total = w.volume + w.efficiency + w.teamContext + w.stability || 1;
    let alpha = (p.volume * w.volume + p.efficiency * w.efficiency + p.teamContext * w.teamContext + p.stability * w.stability) / total;
    if (data.recursion.priorAlpha != null && data.recursion.priorAlpha > 0) {
      alpha = 0.8 * alpha + 0.2 * data.recursion.priorAlpha;
    }
    if (data.recursion.alphaMomentum != null) {
      alpha += Math.max(-3, Math.min(3, data.recursion.alphaMomentum));
    }
    return Math.max(0, Math.min(100, alpha));
  }, [data, activeWeights]);

  const computedTier = useMemo(() => {
    if (computedAlpha == null || !data) return "T5";
    const pos = data.player.position;
    const thresholds: Record<string, number[]> = {
      WR: [82, 72, 58, 45],
      RB: [78, 68, 55, 42],
      TE: [82, 70, 55, 42],
      QB: [70, 55, 42, 32],
    };
    const t = thresholds[pos] || [82, 72, 58, 45];
    if (computedAlpha >= t[0]) return "T1";
    if (computedAlpha >= t[1]) return "T2";
    if (computedAlpha >= t[2]) return "T3";
    if (computedAlpha >= t[3]) return "T4";
    return "T5";
  }, [computedAlpha, data]);

  const isCustom = customWeights !== null;

  const updateWeight = (pillar: keyof ForgeWeights, value: number) => {
    const base = customWeights || (activeGrade ? { ...activeGrade.weights } : { volume: 0.25, efficiency: 0.25, teamContext: 0.25, stability: 0.25 });
    setCustomWeights({ ...base, [pillar]: value });
  };

  const resetWeights = () => setCustomWeights(null);

  return (
    <div className="wb-page">
      <div className="wb-header">
        <div>
          <h1 className="wb-title">FORGE Workbench</h1>
          <p className="wb-subtitle">Query any player, explore their FORGE breakdown, and adjust pillar weights live</p>
        </div>
        <Settings2 size={20} className="wb-header-icon" />
      </div>

      <div className="wb-search-section" ref={dropdownRef}>
        <div className="wb-search-box">
          <Search size={14} />
          <input
            className="wb-search-input"
            placeholder="Search player by name..."
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
          />
        </div>
        {showDropdown && searchResults.length > 0 && (
          <div className="wb-dropdown">
            {searchResults.map(p => (
              <button key={p.playerId} className="wb-dropdown-item" onClick={() => selectPlayer(p)}>
                <span className="wb-dropdown-name">{p.displayName}</span>
                <span className="wb-dropdown-meta">
                  <span className={`wb-pos-tag wb-pos-${p.position.toLowerCase()}`}>{p.position}</span>
                  {p.currentTeam && <span className="wb-team-tag">{p.currentTeam}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="wb-loading">
          <div className="wb-spinner" />
          <span>Running FORGE Engine...</span>
        </div>
      )}

      {data && !loading && (
        <div className="wb-content">
          <div className="wb-player-banner">
            <div className="wb-player-info">
              <h2 className="wb-player-name">{data.player.name}</h2>
              <div className="wb-player-meta">
                <span className={`wb-pos-tag wb-pos-${data.player.position.toLowerCase()}`}>{data.player.position}</span>
                {data.player.team && <span className="wb-team-tag">{data.player.team}</span>}
                <span className="wb-gp-tag">{data.player.gamesPlayed} GP</span>
              </div>
            </div>
            <div className="wb-alpha-display">
              <span className="wb-alpha-label">{isCustom ? "Custom" : MODE_LABELS[mode]} Alpha</span>
              <span className="wb-alpha-value">{computedAlpha !== null ? computedAlpha.toFixed(1) : "—"}</span>
              <span className="wb-tier-badge" style={{ background: tierColor(computedTier) }}>{computedTier}</span>
            </div>
          </div>

          <div className="wb-mode-bar">
            <div className="wb-mode-tabs">
              {(["redraft", "dynasty", "bestball"] as ViewMode[]).map(m => (
                <button
                  key={m}
                  className={`wb-mode-tab ${mode === m ? "active" : ""}`}
                  onClick={() => { setMode(m); setCustomWeights(null); }}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
            {isCustom && (
              <button className="wb-reset-btn" onClick={resetWeights}>Reset Weights</button>
            )}
          </div>

          {activeGrade && activeGrade.debug && (
            <div className="wb-debug-row">
              <span>Base: <strong>{activeGrade.debug.baseAlpha.toFixed(1)}</strong></span>
              <span>Recursion: <strong>{activeGrade.debug.recursionAdjustment > 0 ? "+" : ""}{activeGrade.debug.recursionAdjustment.toFixed(1)}</strong></span>
              {activeGrade.debug.footballLensAdjusted && <span className="wb-lens-flag"><AlertTriangle size={10} /> Lens Adjusted</span>}
              {data.qbContext && <span className="wb-qb-flag">QB: {data.qbContext.qbName}</span>}
            </div>
          )}

          <div className="wb-grid">
            <div className="wb-pillars-section">
              <h3 className="wb-section-title">Pillar Scores</h3>
              {(["volume", "efficiency", "teamContext", "stability"] as const).map(pillar => {
                const Icon = PILLAR_ICONS[pillar];
                const score = data.pillars[pillar];
                const weight = activeWeights ? activeWeights[pillar] : 0.25;
                const isExpanded = expandedPillar === pillar;
                const metricsConfig = data.pillarConfig[pillar] || [];

                return (
                  <div key={pillar} className="wb-pillar-section">
                    <PillarBar label={PILLAR_LABELS[pillar]} score={score} weight={weight} icon={Icon} />

                    <div className="wb-weight-slider">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={weight}
                        onChange={e => updateWeight(pillar, parseFloat(e.target.value))}
                        className="wb-slider"
                      />
                    </div>

                    <button
                      className="wb-expand-btn"
                      onClick={() => setExpandedPillar(isExpanded ? null : pillar)}
                    >
                      <ChevronDown size={12} className={isExpanded ? "wb-chevron-open" : ""} />
                      {metricsConfig.length} metrics
                    </button>

                    {isExpanded && (
                      <div className="wb-metrics-detail">
                        {metricsConfig.map((m) => {
                          const rawVal = data.rawMetrics[m.key];
                          return (
                            <div key={m.key} className="wb-metric-row">
                              <span className="wb-metric-key">
                                <code>{m.key}</code>
                                {m.invert && <span className="wb-invert-tag">INV</span>}
                              </span>
                              <span className="wb-metric-source">{m.source}</span>
                              <span className="wb-metric-weight">{(m.weight * 100).toFixed(0)}%</span>
                              <span className="wb-metric-val">
                                {rawVal !== null && rawVal !== undefined ? (typeof rawVal === 'number' && !Number.isInteger(rawVal) ? rawVal.toFixed(2) : rawVal) : "—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="wb-sidebar">
              <div className="wb-grades-card">
                <h3 className="wb-section-title">All Mode Grades</h3>
                {(["redraft", "dynasty", "bestball"] as ViewMode[]).map(m => {
                  const g = data.grades[m];
                  return (
                    <div key={m} className="wb-grade-row">
                      <span className="wb-grade-mode">{MODE_LABELS[m]}</span>
                      <span className="wb-grade-alpha">{g.alpha.toFixed(1)}</span>
                      <span className="wb-grade-tier" style={{ color: tierColor(g.tier) }}>{g.tier}</span>
                    </div>
                  );
                })}
              </div>

              {data.qbContext && (
                <div className="wb-qb-card">
                  <h3 className="wb-section-title">QB Context</h3>
                  <div className="wb-qb-name">{data.qbContext.qbName}</div>
                  <div className="wb-qb-scores">
                    <div className="wb-qb-score-row"><span>Skill</span><span>{data.qbContext.qbSkillScore.toFixed(1)}</span></div>
                    <div className="wb-qb-score-row"><span>Redraft</span><span>{data.qbContext.qbRedraftScore.toFixed(1)}</span></div>
                    <div className="wb-qb-score-row"><span>Dynasty</span><span>{data.qbContext.qbDynastyScore.toFixed(1)}</span></div>
                    <div className="wb-qb-score-row"><span>Stability</span><span>{data.qbContext.qbStabilityScore.toFixed(1)}</span></div>
                    <div className="wb-qb-score-row"><span>Durability</span><span>{data.qbContext.qbDurabilityScore.toFixed(1)}</span></div>
                  </div>
                </div>
              )}

              {activeGrade && activeGrade.issues && activeGrade.issues.length > 0 && (
                <div className="wb-issues-card">
                  <h3 className="wb-section-title"><AlertTriangle size={12} /> Football Lens Issues</h3>
                  {activeGrade.issues.map((issue, i) => (
                    <div key={i} className={`wb-issue wb-issue-${issue.severity}`}>
                      <span className="wb-issue-pillar">{issue.pillar}</span>
                      <span className="wb-issue-reason">{issue.reason}</span>
                      <span className="wb-issue-adj">{issue.adjustment > 0 ? "+" : ""}{issue.adjustment.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="wb-weights-card">
                <h3 className="wb-section-title">Weight Summary</h3>
                {activeWeights && (["volume", "efficiency", "teamContext", "stability"] as const).map(p => (
                  <div key={p} className="wb-weight-row">
                    <span>{PILLAR_LABELS[p]}</span>
                    <span className="wb-weight-val">{(activeWeights[p] * 100).toFixed(0)}%</span>
                  </div>
                ))}
                {activeWeights && (
                  <div className="wb-weight-total">
                    <span>Total</span>
                    <span>{((activeWeights.volume + activeWeights.efficiency + activeWeights.teamContext + activeWeights.stability) * 100).toFixed(0)}%</span>
                  </div>
                )}
              </div>

              <div className="wb-raw-card">
                <h3 className="wb-section-title">Raw Metrics ({Object.keys(data.rawMetrics).length})</h3>
                <div className="wb-raw-grid">
                  {Object.entries(data.rawMetrics)
                    .filter(([, v]) => v !== null)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .slice(0, 20)
                    .map(([key, val]) => (
                      <div key={key} className="wb-raw-row">
                        <code className="wb-raw-key">{key}</code>
                        <span className="wb-raw-val">{typeof val === "number" && !Number.isInteger(val) ? val.toFixed(3) : val}</span>
                      </div>
                    ))}
                  {Object.keys(data.rawMetrics).filter(k => data.rawMetrics[k] !== null).length > 20 && (
                    <div className="wb-raw-more">+ {Object.keys(data.rawMetrics).filter(k => data.rawMetrics[k] !== null).length - 20} more</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!data && !loading && (
        <div className="wb-empty">
          <Settings2 size={32} />
          <p>Search for a player to explore their FORGE engine breakdown</p>
          <div className="wb-empty-hints">
            <span><Info size={12} /> Adjust pillar weights with sliders to see Alpha change in real-time</span>
            <span><Info size={12} /> Toggle between Redraft, Dynasty, and Best Ball modes</span>
            <span><Info size={12} /> Expand pillars to see individual metric contributions</span>
          </div>
        </div>
      )}
    </div>
  );
}
