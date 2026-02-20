import { useEffect } from "react";
import { Link } from "wouter";

interface ArchNode {
  id: string;
  label: string;
  sub?: string;
  link?: string;
}

interface ArchLayer {
  id: string;
  title: string;
  color: string;
  accent: string;
  nodes: ArchNode[];
}

const layers: ArchLayer[] = [
  {
    id: "frontend",
    title: "Frontend",
    color: "#eef2ff",
    accent: "#6366f1",
    nodes: [
      { id: "dashboard", label: "Dashboard", sub: "Home & Overview", link: "/" },
      { id: "tiers", label: "FORGE Tiers", sub: "Player Rankings", link: "/tiers" },
      { id: "fantasy-lab", label: "Fantasy Lab", sub: "FIRE · Delta · Watchlist", link: "/fantasy-lab" },
      { id: "datalab", label: "Data Lab", sub: "NFL Metrics Spine", link: "/tiber-data-lab" },
      { id: "forge-workbench", label: "FORGE Workbench", sub: "Interactive Weight Explorer", link: "/forge-workbench" },
      { id: "xintel", label: "X Intelligence", sub: "Grok Scanner UI", link: "/x-intel" },
      { id: "idp-lab", label: "IDP Lab", sub: "Havoc Index · Defensive Analysis", link: "/idp-lab" },
      { id: "sentinel", label: "Sentinel", sub: "System Monitoring", link: "/sentinel" },
      { id: "chat", label: "Tiber Chat", sub: "RAG Chat System", link: "/legacy-chat" },
      { id: "schedule", label: "Schedule", sub: "NFL Calendar", link: "/schedule" },
    ],
  },
  {
    id: "backend",
    title: "API Layer",
    color: "#f0fdf4",
    accent: "#16a34a",
    nodes: [
      { id: "forge-api", label: "FORGE E+G API", sub: "/api/forge/eg/*" },
      { id: "fire-api", label: "FIRE API", sub: "/api/fire/eg/* · Opportunity Scoring" },
      { id: "delta-api", label: "Delta API", sub: "/api/delta/eg/* · Buy/Sell Signals" },
      { id: "fantasy-lab-api", label: "Fantasy Lab API", sub: "/api/fantasy-lab/* · Weekly Metrics" },
      { id: "idp-api", label: "IDP / Havoc API", sub: "/api/idp/* · Defensive Analytics" },
      { id: "intel-api", label: "Intel API", sub: "/api/intel/*" },
      { id: "datalab-api", label: "Data Lab API", sub: "/api/data-lab/*" },
      { id: "rag-api", label: "RAG Chat API", sub: "/api/tiber/*" },
      { id: "strategy-api", label: "Strategy API", sub: "/api/strategy/*" },
      { id: "players-api", label: "Players API", sub: "/api/players/*" },
    ],
  },
  {
    id: "core",
    title: "Core Systems",
    color: "#fff7ed",
    accent: "#e2640d",
    nodes: [
      { id: "forge-engine", label: "FORGE Engine", sub: "Volume · Efficiency · Stability · Context" },
      { id: "forge-grading", label: "FORGE Grading", sub: "Alpha Scores · Tiers · Football Lens" },
      { id: "fire-engine", label: "FIRE Engine", sub: "Rolling 4-Week · Opportunity · Role · Conversion" },
      { id: "delta-engine", label: "Delta Engine", sub: "FORGE vs FIRE · Buy-Low / Sell-High" },
      { id: "havoc-engine", label: "Havoc Engine", sub: "IDP Scoring · Bayesian Smoothing · T1–T5" },
      { id: "qb-xfp", label: "QB xFP Model", sub: "Expected Fantasy Points · Redraft / Dynasty" },
      { id: "llm-gateway", label: "LLM Gateway", sub: "4 Providers · 9 Task Types · Fallback" },
      { id: "x-scanner", label: "X Intel Scanner", sub: "Grok · Trends · Injuries · Breakouts" },
      { id: "rag-system", label: "RAG System", sub: "Embeddings · BM25 · Gemini Chat" },
      { id: "role-banks", label: "Role Banks", sub: "WR · RB · TE · QB Classifications" },
    ],
  },
  {
    id: "data",
    title: "Data Layer",
    color: "#faf5ff",
    accent: "#7c3aed",
    nodes: [
      { id: "postgres", label: "PostgreSQL", sub: "Drizzle ORM · pgvector" },
      { id: "mat-views", label: "Materialized Views", sub: "fantasy_metrics_weekly_mv · Aggregated Spine" },
      { id: "qb-xfp-table", label: "QB xFP Weekly", sub: "Smoothed Expected Points · ETL Pipeline" },
      { id: "identity", label: "Identity Bridge", sub: "Canonical Player Pool · GSIS IDs" },
      { id: "snapshots", label: "Data Snapshots", sub: "Bronze → Silver → Gold ELT" },
      { id: "file-store", label: "File Storage", sub: "Intel JSON · Parquet Files" },
    ],
  },
  {
    id: "external",
    title: "External Services",
    color: "#fef2f2",
    accent: "#dc2626",
    nodes: [
      { id: "openrouter", label: "OpenRouter", sub: "DeepSeek · Grok · Llama" },
      { id: "gemini", label: "Google Gemini", sub: "Embeddings · Chat Generation" },
      { id: "sleeper", label: "Sleeper API", sub: "Rosters · ADP · Projections" },
      { id: "nfl-data", label: "NFL Data (nflverse)", sub: "Play-by-Play · Schedules · Stats" },
      { id: "openai", label: "OpenAI", sub: "Fallback Provider" },
      { id: "anthropic", label: "Anthropic", sub: "Fallback Provider" },
    ],
  },
];

interface FlowArrow {
  from: string;
  to: string;
  label: string;
}

const flows: FlowArrow[] = [
  { from: "Frontend", to: "API Layer", label: "REST / JSON" },
  { from: "API Layer", to: "Core Systems", label: "Service Calls" },
  { from: "Core Systems", to: "Data Layer", label: "Read / Write" },
  { from: "Core Systems", to: "External Services", label: "HTTP / API Keys" },
];

function LayerSection({ layer }: { layer: ArchLayer }) {
  return (
    <div className="arch-layer" style={{ "--layer-accent": layer.accent, "--layer-bg": layer.color } as React.CSSProperties}>
      <div className="arch-layer-header">
        <span className="arch-layer-dot" />
        <span className="arch-layer-title">{layer.title}</span>
      </div>
      <div className="arch-nodes">
        {layer.nodes.map((node) => {
          const inner = (
            <div className="arch-node" key={node.id}>
              <div className="arch-node-label">{node.label}</div>
              {node.sub && <div className="arch-node-sub">{node.sub}</div>}
            </div>
          );
          if (node.link) {
            return (
              <Link key={node.id} href={node.link} className="arch-node-link">
                {inner}
              </Link>
            );
          }
          return inner;
        })}
      </div>
    </div>
  );
}

function FlowConnector({ flow }: { flow: FlowArrow }) {
  return (
    <div className="arch-flow">
      <div className="arch-flow-line" />
      <span className="arch-flow-label">{flow.label}</span>
      <div className="arch-flow-arrow">▼</div>
    </div>
  );
}

export default function Architecture() {
  useEffect(() => {
    document.title = "System Architecture - Tiber Fantasy";
  }, []);

  return (
    <div className="arch-page">
      <div className="arch-header">
        <h1 className="arch-title">System Architecture</h1>
        <p className="arch-subtitle">
          How Tiber Fantasy connects — from the UI you see down to the data sources that power it
        </p>
      </div>

      <div className="arch-legend">
        {layers.map((l) => (
          <span key={l.id} className="arch-legend-item">
            <span className="arch-legend-dot" style={{ background: l.accent }} />
            {l.title}
          </span>
        ))}
      </div>

      <div className="arch-diagram">
        {layers.map((layer, i) => (
          <div key={layer.id}>
            <LayerSection layer={layer} />
            {i < layers.length - 1 && <FlowConnector flow={flows[i]} />}
          </div>
        ))}
      </div>

      <div className="arch-stats">
        <div className="arch-stat">
          <span className="arch-stat-value">10</span>
          <span className="arch-stat-label">Frontend Pages</span>
        </div>
        <div className="arch-stat">
          <span className="arch-stat-value">10</span>
          <span className="arch-stat-label">API Groups</span>
        </div>
        <div className="arch-stat">
          <span className="arch-stat-value">10</span>
          <span className="arch-stat-label">Core Systems</span>
        </div>
        <div className="arch-stat">
          <span className="arch-stat-value">4</span>
          <span className="arch-stat-label">LLM Providers</span>
        </div>
        <div className="arch-stat">
          <span className="arch-stat-value">3</span>
          <span className="arch-stat-label">Scoring Engines</span>
        </div>
        <div className="arch-stat">
          <span className="arch-stat-value">3</span>
          <span className="arch-stat-label">Data Tiers (ELT)</span>
        </div>
      </div>
    </div>
  );
}
