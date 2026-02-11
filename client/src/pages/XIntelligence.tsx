import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Radio,
  Zap,
  AlertTriangle,
  TrendingUp,
  Users,
  Scan,
  Trash2,
  Loader2,
  Signal,
  Clock,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface IntelEntry {
  id: string;
  player: string;
  position: string;
  team: string;
  category: string;
  signal: string;
  headline: string;
  detail: string;
  source_context: string;
  fantasy_impact: string;
  dynasty_relevance: string;
  timestamp: string;
  scanned_by: string;
}

const SCAN_TYPES = [
  { value: "trending", label: "Trending", icon: TrendingUp, desc: "Hot topics & usage shifts" },
  { value: "injuries", label: "Injuries", icon: AlertTriangle, desc: "Injury reports & impact" },
  { value: "breakouts", label: "Breakouts", icon: Zap, desc: "Emerging players" },
  { value: "consensus", label: "Consensus", icon: Users, desc: "Expert agreement" },
  { value: "full", label: "Full Scan", icon: Radio, desc: "Comprehensive sweep" },
] as const;

const POSITIONS = ["QB", "RB", "WR", "TE"] as const;

function SignalBadge({ signal }: { signal: string }) {
  const config: Record<string, { className: string; bars: number }> = {
    strong: { className: "signal-strong", bars: 3 },
    moderate: { className: "signal-moderate", bars: 2 },
    speculative: { className: "signal-speculative", bars: 1 },
  };
  const s = config[signal] || config.moderate;
  return (
    <span className={`signal-badge ${s.className}`}>
      <Signal size={12} />
      <span className="signal-bars">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`signal-bar ${i <= s.bars ? "active" : ""}`} />
        ))}
      </span>
      {signal}
    </span>
  );
}

function CategoryTag({ category }: { category: string }) {
  const colors: Record<string, string> = {
    injury: "cat-injury",
    breakout: "cat-breakout",
    trend: "cat-trend",
    consensus: "cat-consensus",
    usage: "cat-usage",
    depth_chart: "cat-depth",
    trade: "cat-trade",
  };
  return (
    <span className={`intel-category-tag ${colors[category] || "cat-default"}`}>
      {category.replace("_", " ")}
    </span>
  );
}

function IntelCard({ entry }: { entry: IntelEntry }) {
  const time = new Date(entry.timestamp);
  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <Card className="intel-card">
      <CardContent className="intel-card-body">
        <div className="intel-card-header">
          <div className="intel-player-info">
            <span className="intel-player-name">{entry.player}</span>
            <Badge variant="outline" className="intel-pos-badge">
              {entry.position} · {entry.team}
            </Badge>
          </div>
          <div className="intel-meta">
            <SignalBadge signal={entry.signal} />
            <CategoryTag category={entry.category} />
          </div>
        </div>

        <h3 className="intel-headline">{entry.headline}</h3>
        <p className="intel-detail">{entry.detail}</p>

        <div className="intel-impacts">
          <div className="intel-impact-box">
            <span className="intel-impact-label">Fantasy Impact</span>
            <span className="intel-impact-text">{entry.fantasy_impact}</span>
          </div>
          {entry.dynasty_relevance && entry.dynasty_relevance !== "N/A" && (
            <div className="intel-impact-box dynasty">
              <span className="intel-impact-label">Dynasty</span>
              <span className="intel-impact-text">{entry.dynasty_relevance}</span>
            </div>
          )}
        </div>

        <div className="intel-footer">
          <span className="intel-time">
            <Clock size={12} /> {timeStr}
          </span>
          <span className="intel-source">{entry.source_context}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function XIntelligence() {
  useEffect(() => {
    document.title = "X Intelligence - Tiber Fantasy";
  }, []);

  const [scanType, setScanType] = useState<string>("trending");
  const [selectedPositions, setSelectedPositions] = useState<string[]>(["WR", "RB"]);
  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [filterSignal, setFilterSignal] = useState<string>("all");

  const feedQuery = useQuery<{ success: boolean; data: IntelEntry[] }>({
    queryKey: ["/api/intel/x-feed"],
    refetchInterval: false,
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/intel/x-scan", {
        scanType,
        positions: selectedPositions,
        priority: "speed",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/intel/x-feed"] });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/intel/x-feed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/intel/x-feed"] });
    },
  });

  const togglePosition = (pos: string) => {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const entries = feedQuery.data?.data || [];
  const filtered = entries.filter((e) => {
    if (filterPosition !== "all" && e.position !== filterPosition) return false;
    if (filterSignal !== "all" && e.signal !== filterSignal) return false;
    return true;
  });

  return (
    <div className="x-intel-page">
      <div className="x-intel-header">
        <div className="x-intel-title-row">
          <div>
            <h1 className="x-intel-title">X Intelligence</h1>
            <p className="x-intel-subtitle">
              Grok-powered scanning of X/Twitter for fantasy football signals
            </p>
          </div>
          <div className="x-intel-count">
            {entries.length > 0 && (
              <span className="intel-total-badge">{entries.length} entries</span>
            )}
          </div>
        </div>
      </div>

      <div className="x-intel-controls">
        <div className="x-intel-scan-section">
          <div className="x-intel-scan-label">Scan Type</div>
          <div className="x-intel-scan-types">
            {SCAN_TYPES.map((st) => {
              const Icon = st.icon;
              return (
                <button
                  key={st.value}
                  className={`scan-type-btn ${scanType === st.value ? "active" : ""}`}
                  onClick={() => setScanType(st.value)}
                >
                  <Icon size={16} />
                  <span className="scan-type-label">{st.label}</span>
                  <span className="scan-type-desc">{st.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="x-intel-positions-section">
          <div className="x-intel-scan-label">Positions</div>
          <div className="x-intel-positions">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                className={`pos-toggle-btn ${selectedPositions.includes(pos) ? "active" : ""}`}
                onClick={() => togglePosition(pos)}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        <div className="x-intel-actions">
          <Button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending || selectedPositions.length === 0}
            className="scan-trigger-btn"
          >
            {scanMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Scan size={16} />
                Run Scan
              </>
            )}
          </Button>
          {entries.length > 0 && (
            <Button
              variant="outline"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              className="clear-btn"
            >
              <Trash2 size={14} />
              Clear
            </Button>
          )}
        </div>
      </div>

      {scanMutation.isPending && (
        <div className="x-intel-scanning-indicator">
          <Loader2 size={20} className="animate-spin" />
          <span>Grok is scanning X for {scanType} intel on {selectedPositions.join(", ")}...</span>
        </div>
      )}

      {scanMutation.isError && (
        <div className="x-intel-error">
          <AlertTriangle size={16} />
          <span>Scan failed. Try again or check the server logs.</span>
        </div>
      )}

      {entries.length > 0 && (
        <div className="x-intel-filters">
          <Filter size={14} />
          <div className="filter-group">
            <button
              className={`filter-btn ${filterPosition === "all" ? "active" : ""}`}
              onClick={() => setFilterPosition("all")}
            >
              All
            </button>
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                className={`filter-btn ${filterPosition === pos ? "active" : ""}`}
                onClick={() => setFilterPosition(pos)}
              >
                {pos}
              </button>
            ))}
          </div>
          <div className="filter-group">
            <button
              className={`filter-btn ${filterSignal === "all" ? "active" : ""}`}
              onClick={() => setFilterSignal("all")}
            >
              All Signals
            </button>
            {["strong", "moderate", "speculative"].map((s) => (
              <button
                key={s}
                className={`filter-btn ${filterSignal === s ? "active" : ""}`}
                onClick={() => setFilterSignal(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="x-intel-feed">
        {feedQuery.isLoading ? (
          <div className="x-intel-loading">
            <Loader2 size={24} className="animate-spin" />
            <span>Loading intel feed...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="x-intel-empty">
            <Radio size={32} />
            <h3>No intel yet</h3>
            <p>Choose a scan type and positions above, then hit "Run Scan" to pull signals from X.</p>
          </div>
        ) : (
          filtered.map((entry) => <IntelCard key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
