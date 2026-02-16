import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Shield, AlertTriangle, XCircle, CheckCircle, Activity, Clock, Ban, FlaskConical, Play, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

type SeverityFilter = "all" | "info" | "warn" | "block";
type StatusFilter = "all" | "open" | "resolved" | "muted";
type ModuleFilter = "all" | "forge" | "personnel" | "datalab" | "rolebank" | "system";


interface SentinelIssue {
  fingerprint: string;
  ruleId: string;
  module: string;
  severity: string;
  lastMessage: string;
  firstSeen: string;
  lastSeen: string;
  occurrenceCount: number;
  status: "open" | "resolved" | "muted";
}

interface SentinelEventRow {
  id: number;
  ruleId: string;
  module: string;
  severity: string;
  passed: boolean;
  confidence: number;
  message: string;
  details: any;
  fingerprint: string;
  endpoint: string | null;
  createdAt: string;
}

interface HealthSummary {
  modules: Record<string, { totalChecks: number; passed: number; warnings: number; blocks: number; passRate: number }>;
  overall: { totalChecks: number; passed: number; passRate: number };
  lastCheckAt: string | null;
}

interface TestScenario {
  id: string;
  label: string;
  description: string;
  module: "forge" | "personnel" | "datalab" | "system";
  data: Record<string, any>;
  expectFail: boolean;
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    id: "forge-good",
    label: "Valid FORGE Score",
    description: "A clean WR score that should pass all checks",
    module: "forge",
    data: { alpha: 72.5, position: "WR", tier: "T2", mode: "redraft", subScores: { volume: 68, efficiency: 80, contextFit: 71, stability: 65 } },
    expectFail: false,
  },
  {
    id: "forge-oob",
    label: "Alpha Out of Bounds",
    description: "Alpha 150 is outside 0-100 range (should block)",
    module: "forge",
    data: { alpha: 150, position: "WR", tier: "T1", mode: "redraft", subScores: { volume: 90, efficiency: 85, contextFit: 88, stability: 80 } },
    expectFail: true,
  },
  {
    id: "forge-nan",
    label: "Alpha is NaN",
    description: "Null alpha score (should block)",
    module: "forge",
    data: { alpha: null, position: "RB", tier: "T3", mode: "redraft", subScores: { volume: 50, efficiency: 60, contextFit: 55, stability: 45 } },
    expectFail: true,
  },
  {
    id: "forge-tier-mismatch",
    label: "Tier Mismatch",
    description: "Alpha 30 for a WR labeled T1 (should warn)",
    module: "forge",
    data: { alpha: 30, position: "WR", tier: "T1", mode: "redraft", subScores: { volume: 25, efficiency: 30, contextFit: 28, stability: 35 } },
    expectFail: true,
  },
  {
    id: "forge-pillar-nan",
    label: "Pillar NaN Values",
    description: "Volume pillar is null (should block)",
    module: "forge",
    data: { alpha: 60, position: "TE", tier: "T3", mode: "redraft", subScores: { volume: null, efficiency: 55, contextFit: 60, stability: 50 } },
    expectFail: true,
  },
  {
    id: "forge-batch-empty",
    label: "Empty Batch",
    description: "Batch with zero players (should flag info)",
    module: "forge",
    data: { scores: [], count: 0, position: "QB" },
    expectFail: true,
  },
  {
    id: "personnel-good",
    label: "Valid Personnel Data",
    description: "Clean personnel grouping data",
    module: "personnel",
    data: { totalPlaysCounted: 500, everyDownGrade: "FULL_TIME", breakdown: { "11": { pct: 0.65 }, "12": { pct: 0.20 }, "21": { pct: 0.10 }, "other": { pct: 0.05 } } },
    expectFail: false,
  },
  {
    id: "personnel-zero-snaps",
    label: "Zero Snaps",
    description: "Total plays is 0 (should block)",
    module: "personnel",
    data: { totalPlaysCounted: 0, everyDownGrade: "FULL_TIME", breakdown: {} },
    expectFail: true,
  },
  {
    id: "personnel-bad-class",
    label: "Invalid Classification",
    description: "Classification 'UNKNOWN' is not valid (should block)",
    module: "personnel",
    data: { totalPlaysCounted: 300, everyDownGrade: "UNKNOWN", breakdown: { "11": { pct: 0.70 }, "12": { pct: 0.30 } } },
    expectFail: true,
  },
  {
    id: "datalab-no-snapshots",
    label: "No Snapshots",
    description: "Season with zero snapshots (should warn)",
    module: "datalab",
    data: { snapshotCount: 0, season: 2025 },
    expectFail: true,
  },
  {
    id: "datalab-stale-snapshot",
    label: "Stale Snapshot",
    description: "Latest snapshot is 30 days old (should flag info)",
    module: "datalab",
    data: { snapshotCount: 5, season: 2025, latestSnapshotAt: new Date(Date.now() - 30 * 86400000).toISOString() },
    expectFail: true,
  },
  {
    id: "system-missing-keys",
    label: "Missing Response Keys",
    description: "Response missing expected keys (should block)",
    module: "system",
    data: { expectedKeys: ["success", "scores", "meta"], payload: { success: true } },
    expectFail: true,
  },
];

function severityColor(severity: string) {
  switch (severity) {
    case "block": return { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" };
    case "warn": return { bg: "#fffbeb", text: "#d97706", border: "#fde68a" };
    case "info": return { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" };
    default: return { bg: "#f4f4f5", text: "#71717a", border: "#e4e4e7" };
  }
}

function statusColor(status: string) {
  switch (status) {
    case "open": return { bg: "#fef2f2", text: "#dc2626" };
    case "resolved": return { bg: "#f0fdf4", text: "#16a34a" };
    case "muted": return { bg: "#f4f4f5", text: "#71717a" };
    default: return { bg: "#f4f4f5", text: "#71717a" };
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function SeverityBadge({ severity }: { severity: string }) {
  const c = severityColor(severity);
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = statusColor(status);
  return (
    <span style={{ background: c.bg, color: c.text, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
      {status}
    </span>
  );
}

function HealthCards({ data }: { data: HealthSummary | undefined }) {
  const modules = data?.modules ?? {};
  const overall = data?.overall ?? { totalChecks: 0, passed: 0, passRate: 1 };
  const lastCheck = data?.lastCheckAt;
  const moduleNames = Object.keys(modules);
  const totalWarnings = moduleNames.reduce((s, m) => s + (modules[m]?.warnings ?? 0), 0);
  const totalBlocks = moduleNames.reduce((s, m) => s + (modules[m]?.blocks ?? 0), 0);

  const passRatePct = (overall.passRate * 100).toFixed(1);
  const passRateColor = overall.passRate >= 0.95 ? "#16a34a" : overall.passRate >= 0.8 ? "#d97706" : "#dc2626";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
      <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 8, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <CheckCircle size={16} color={passRateColor} />
          <span style={{ fontSize: 12, color: "#71717a", fontWeight: 500 }}>PASS RATE</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: passRateColor, fontFamily: "'JetBrains Mono', monospace" }}>{passRatePct}%</div>
        <div style={{ fontSize: 12, color: "#a1a1aa" }}>{overall.passed}/{overall.totalChecks} checks passed</div>
      </div>

      <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 8, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <AlertTriangle size={16} color="#d97706" />
          <span style={{ fontSize: 12, color: "#71717a", fontWeight: 500 }}>WARNINGS</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706", fontFamily: "'JetBrains Mono', monospace" }}>{totalWarnings}</div>
        <div style={{ fontSize: 12, color: "#a1a1aa" }}>last 7 days</div>
      </div>

      <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 8, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <XCircle size={16} color="#dc2626" />
          <span style={{ fontSize: 12, color: "#71717a", fontWeight: 500 }}>BLOCKS</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#dc2626", fontFamily: "'JetBrains Mono', monospace" }}>{totalBlocks}</div>
        <div style={{ fontSize: 12, color: "#a1a1aa" }}>last 7 days</div>
      </div>

      <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 8, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Clock size={16} color="#71717a" />
          <span style={{ fontSize: 12, color: "#71717a", fontWeight: 500 }}>LAST CHECK</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#27272a", fontFamily: "'JetBrains Mono', monospace" }}>
          {lastCheck ? timeAgo(lastCheck) : "No checks yet"}
        </div>
        <div style={{ fontSize: 12, color: "#a1a1aa" }}>{moduleNames.length} modules active</div>
      </div>
    </div>
  );
}

function ModuleBreakdown({ data }: { data: HealthSummary | undefined }) {
  const modules = data?.modules ?? {};
  const moduleNames = Object.keys(modules);
  if (moduleNames.length === 0) return null;

  return (
    <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 8, padding: 20, marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#27272a", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Module Breakdown</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {moduleNames.map((name) => {
          const m = modules[name];
          const rate = (m.passRate * 100).toFixed(0);
          const barColor = m.passRate >= 0.95 ? "#16a34a" : m.passRate >= 0.8 ? "#d97706" : "#dc2626";
          return (
            <div key={name} style={{ padding: 12, background: "#fafafa", borderRadius: 6, border: "1px solid #f0f0f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#27272a", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>{name}</span>
                <span style={{ fontSize: 11, color: barColor, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{rate}%</span>
              </div>
              <div style={{ height: 4, background: "#e5e5e5", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${rate}%`, background: barColor, borderRadius: 2, transition: "width 0.3s" }} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 10, color: "#a1a1aa" }}>
                <span>{m.passed} pass</span>
                <span>{m.warnings} warn</span>
                <span>{m.blocks} block</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IssuesPanel({ moduleFilter, severityFilter, statusFilter, setModuleFilter, setSeverityFilter, setStatusFilter }: {
  moduleFilter: ModuleFilter;
  severityFilter: SeverityFilter;
  statusFilter: StatusFilter;
  setModuleFilter: (v: ModuleFilter) => void;
  setSeverityFilter: (v: SeverityFilter) => void;
  setStatusFilter: (v: StatusFilter) => void;
}) {
  const params = new URLSearchParams();
  if (moduleFilter !== "all") params.set("module", moduleFilter);
  if (severityFilter !== "all") params.set("severity", severityFilter);
  if (statusFilter !== "all") params.set("status", statusFilter);
  const issuesUrl = `/api/sentinel/issues?${params}`;

  const { data, isLoading } = useQuery<{ issues: SentinelIssue[] }>({
    queryKey: [issuesUrl],
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const muteMutation = useMutation({
    mutationFn: (fingerprint: string) => apiRequest("POST", `/api/sentinel/mute/${fingerprint}`, { reason: "Muted from dashboard" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [issuesUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/sentinel/health"] });
    },
  });

  const issues = data?.issues ?? [];
  const selectStyle: React.CSSProperties = { padding: "6px 10px", borderRadius: 6, border: "1px solid #e5e5e5", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", background: "white", cursor: "pointer" };

  return (
    <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 8, padding: 20, marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} color="#e2640d" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#27272a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Issues</span>
          <span style={{ fontSize: 11, color: "#a1a1aa" }}>({issues.length})</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value as ModuleFilter)} style={selectStyle}>
            <option value="all">All Modules</option>
            <option value="forge">forge</option>
            <option value="personnel">personnel</option>
            <option value="datalab">datalab</option>
            <option value="rolebank">rolebank</option>
            <option value="system">system</option>
          </select>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)} style={selectStyle}>
            <option value="all">All Severities</option>
            <option value="block">block</option>
            <option value="warn">warn</option>
            <option value="info">info</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} style={selectStyle}>
            <option value="all">All Status</option>
            <option value="open">open</option>
            <option value="resolved">resolved</option>
            <option value="muted">muted</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 24, textAlign: "center", color: "#a1a1aa", fontSize: 13 }}>Loading issues...</div>
      ) : issues.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#a1a1aa", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <CheckCircle size={24} color="#16a34a" />
          No issues found. Data quality looks clean.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {issues.map((issue) => (
            <div key={issue.fingerprint} style={{ padding: 12, borderRadius: 6, border: "1px solid #f0f0f0", background: "#fafafa", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <SeverityBadge severity={issue.severity} />
                  <StatusBadge status={issue.status} />
                  <span style={{ fontSize: 11, color: "#a1a1aa", fontFamily: "'JetBrains Mono', monospace" }}>{issue.module}.{issue.ruleId.split(".").pop()}</span>
                </div>
                <div style={{ fontSize: 13, color: "#27272a", lineHeight: 1.4 }}>{issue.lastMessage}</div>
                <div style={{ fontSize: 11, color: "#a1a1aa", marginTop: 4 }}>
                  {issue.occurrenceCount}x seen &middot; first {timeAgo(issue.firstSeen)} &middot; last {timeAgo(issue.lastSeen)}
                </div>
              </div>
              {issue.status !== "muted" && (
                <button
                  onClick={() => muteMutation.mutate(issue.fingerprint)}
                  disabled={muteMutation.isPending}
                  style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #e5e5e5", background: "white", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#71717a", whiteSpace: "nowrap" }}
                >
                  <Ban size={12} /> Mute
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventFeed() {
  const [limit] = useState(50);
  const { data, isLoading } = useQuery<{ events: SentinelEventRow[]; total: number }>({
    queryKey: [`/api/sentinel/events?limit=${limit}`],
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const events = data?.events ?? [];
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 8, padding: 20, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Activity size={16} color="#e2640d" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#27272a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Event Feed</span>
        <span style={{ fontSize: 11, color: "#a1a1aa" }}>({data?.total ?? 0} total)</span>
      </div>

      {isLoading ? (
        <div style={{ padding: 24, textAlign: "center", color: "#a1a1aa", fontSize: 13 }}>Loading events...</div>
      ) : events.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#a1a1aa", fontSize: 13 }}>No events recorded yet. Run a test to generate some.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 400, overflowY: "auto" }}>
          {events.map((evt) => (
            <div key={evt.id} style={{ padding: 10, borderRadius: 6, border: "1px solid #f0f0f0", background: "#fafafa", cursor: "pointer" }} onClick={() => setExpandedId(expandedId === evt.id ? null : evt.id)}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <SeverityBadge severity={evt.severity} />
                  <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "#27272a" }}>{evt.ruleId}</span>
                  {evt.passed ? <CheckCircle size={12} color="#16a34a" /> : <XCircle size={12} color="#dc2626" />}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#a1a1aa" }}>{timeAgo(evt.createdAt)}</span>
                  {expandedId === evt.id ? <ChevronUp size={12} color="#a1a1aa" /> : <ChevronDown size={12} color="#a1a1aa" />}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#52525b", marginTop: 4 }}>{evt.message}</div>
              {expandedId === evt.id && evt.details && (
                <pre style={{ marginTop: 8, padding: 8, background: "#f4f4f5", borderRadius: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#3f3f46", overflow: "auto", maxHeight: 200, whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(evt.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TestPanel() {
  const [results, setResults] = useState<Record<string, { status: "idle" | "running" | "pass" | "fail"; report?: any }>>({});

  const runScenario = async (scenario: TestScenario) => {
    setResults((prev) => ({ ...prev, [scenario.id]: { status: "running" } }));
    try {
      const res = await fetch(`/api/sentinel/run/${scenario.module}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: scenario.data }),
      });
      const json = await res.json();
      const report = json.report;
      const hasFails = report.warnings > 0 || report.blocks > 0;
      setResults((prev) => ({ ...prev, [scenario.id]: { status: hasFails ? "fail" : "pass", report } }));
      queryClient.invalidateQueries({ queryKey: ["/api/sentinel/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sentinel/issues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sentinel/health"] });
    } catch {
      setResults((prev) => ({ ...prev, [scenario.id]: { status: "fail", report: { error: "Request failed" } } }));
    }
  };

  const runAll = async () => {
    for (const scenario of TEST_SCENARIOS) {
      await runScenario(scenario);
    }
  };

  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  return (
    <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 8, padding: 20, marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FlaskConical size={16} color="#e2640d" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#27272a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Test Lab</span>
          <span style={{ fontSize: 11, color: "#a1a1aa" }}>Inject data to test sentinel rules</span>
        </div>
        <button
          onClick={runAll}
          style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#e2640d", color: "white", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <Play size={12} /> Run All Tests
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {TEST_SCENARIOS.map((scenario) => {
          const r = results[scenario.id] ?? { status: "idle" };
          const isExpanded = expandedTest === scenario.id;

          let statusIcon;
          let statusLabel;
          if (r.status === "idle") { statusIcon = null; statusLabel = ""; }
          else if (r.status === "running") { statusIcon = <RefreshCw size={14} color="#e2640d" style={{ animation: "spin 1s linear infinite" }} />; statusLabel = "Running..."; }
          else if (r.status === "pass") { statusIcon = <CheckCircle size={14} color="#16a34a" />; statusLabel = "All Passed"; }
          else { statusIcon = <AlertTriangle size={14} color="#dc2626" />; statusLabel = `${r.report?.warnings ?? 0} warn, ${r.report?.blocks ?? 0} block`; }

          const matchesExpected = r.status === "idle" || r.status === "running" || (scenario.expectFail ? r.status === "fail" : r.status === "pass");

          return (
            <div key={scenario.id} style={{ borderRadius: 6, border: "1px solid #f0f0f0", background: "#fafafa", overflow: "hidden" }}>
              <div style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", cursor: "pointer" }} onClick={() => setExpandedTest(isExpanded ? null : scenario.id)}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#27272a" }}>{scenario.label}</span>
                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: scenario.expectFail ? "#fef2f2" : "#f0fdf4", color: scenario.expectFail ? "#dc2626" : "#16a34a", fontFamily: "'JetBrains Mono', monospace" }}>
                      {scenario.expectFail ? "EXPECT FAIL" : "EXPECT PASS"}
                    </span>
                    {r.status !== "idle" && r.status !== "running" && (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: matchesExpected ? "#f0fdf4" : "#fef2f2", color: matchesExpected ? "#16a34a" : "#dc2626", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                        {matchesExpected ? "CORRECT" : "UNEXPECTED"}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#71717a" }}>{scenario.description}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {statusIcon}
                  <span style={{ fontSize: 11, color: "#71717a", fontFamily: "'JetBrains Mono', monospace" }}>{statusLabel}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); runScenario(scenario); }}
                    style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #e5e5e5", background: "white", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#27272a" }}
                  >
                    <Play size={10} /> Run
                  </button>
                  {isExpanded ? <ChevronUp size={12} color="#a1a1aa" /> : <ChevronDown size={12} color="#a1a1aa" />}
                </div>
              </div>
              {isExpanded && (
                <div style={{ padding: "0 12px 12px", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 250 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#a1a1aa", marginBottom: 4, textTransform: "uppercase" }}>Input Data</div>
                    <pre style={{ padding: 8, background: "#f4f4f5", borderRadius: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#3f3f46", overflow: "auto", maxHeight: 200, whiteSpace: "pre-wrap", margin: 0 }}>
                      {JSON.stringify(scenario.data, null, 2)}
                    </pre>
                  </div>
                  {r.report && (
                    <div style={{ flex: 1, minWidth: 250 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#a1a1aa", marginBottom: 4, textTransform: "uppercase" }}>Result</div>
                      <pre style={{ padding: 8, background: "#f4f4f5", borderRadius: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#3f3f46", overflow: "auto", maxHeight: 200, whiteSpace: "pre-wrap", margin: 0 }}>
                        {JSON.stringify(r.report, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SentinelDashboard() {
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: healthData } = useQuery<HealthSummary>({
    queryKey: ["/api/sentinel/health"],
    refetchInterval: 10000,
    staleTime: 5000,
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Shield size={22} color="#e2640d" />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#18181b", margin: 0, fontFamily: "'Instrument Sans', sans-serif" }}>Quality Sentinel</h1>
        </div>
        <p style={{ fontSize: 13, color: "#71717a", margin: 0, lineHeight: 1.5 }}>
          Real-time data quality monitoring across FORGE, Personnel, Data Lab, and system endpoints.
        </p>
      </div>

      <HealthCards data={healthData} />
      <ModuleBreakdown data={healthData} />
      <TestPanel />
      <IssuesPanel
        moduleFilter={moduleFilter}
        severityFilter={severityFilter}
        statusFilter={statusFilter}
        setModuleFilter={setModuleFilter}
        setSeverityFilter={setSeverityFilter}
        setStatusFilter={setStatusFilter}
      />
      <EventFeed />
    </div>
  );
}
