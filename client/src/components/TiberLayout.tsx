import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  badge?: string;
  comingSoon?: boolean;
}

type NavSectionConfig = {
  label: string;
  description?: string;
  items: NavItem[];
};

const navSections: NavSectionConfig[] = [
  {
    label: "Core Product",
    description: "Daily decision surfaces for most users.",
    items: [
      { label: "Tiers", path: "/tiers" },
      { label: "Rookie Board", path: "/rookies", badge: "2026" },
      { label: "Schedule & Matchups", path: "/schedule" },
    ],
  },
  {
    label: "Research",
    description: "Cross-model orchestration and promoted research workflows.",
    items: [
      { label: "Research Command Center", path: "/tiber-data-lab/command-center", badge: "PRIMARY" },
      { label: "Player Research", path: "/tiber-data-lab/player-research" },
      { label: "Team Research", path: "/tiber-data-lab/team-research" },
      { label: "Data Lab Hub", path: "/tiber-data-lab" },
    ],
  },
  {
    label: "Model Labs",
    description: "Specialist model and lab surfaces.",
    items: [
      { label: "Breakout Signals", path: "/tiber-data-lab/breakout-signals" },
      { label: "Role & Opportunity", path: "/tiber-data-lab/role-opportunity" },
      { label: "Age Curves / ARC", path: "/tiber-data-lab/age-curves" },
      { label: "Point Scenarios", path: "/tiber-data-lab/point-scenarios" },
      { label: "FORGE Workbench", path: "/forge-workbench" },
      { label: "Fantasy Lab", path: "/fantasy-lab" },
      { label: "IDP Lab", path: "/idp-lab" },
      { label: "CATALYST Lab", path: "/catalyst-lab" },
    ],
  },
  {
    label: "Agent & Intelligence",
    description: "Agent-facing and intelligence ingestion surfaces.",
    items: [
      { label: "TiberClaw", path: "/tiberclaw", badge: "AGENT" },
      { label: "X Intelligence", path: "/x-intel", badge: "GROK" },
      { label: "Legacy Chat", path: "/legacy-chat", badge: "LEGACY" },
    ],
  },
  {
    label: "System & Builder",
    description: "Admin, diagnostics, and internal tooling.",
    items: [
      { label: "FORGE Hub", path: "/admin/forge-hub" },
      { label: "FORGE Engine", path: "/forge" },
      { label: "FORGE Inspector", path: "/forge/inspect" },
      { label: "Quality Sentinel", path: "/sentinel" },
      { label: "Architecture", path: "/architecture" },
      { label: "Metrics Dictionary", path: "/metrics-dictionary" },
      { label: "API Lexicon", path: "/admin/api-lexicon" },
    ],
  },
];

function NavSection({
  label,
  description,
  items,
  onNavigate,
}: NavSectionConfig & { onNavigate?: () => void }) {
  const [location] = useLocation();

  return (
    <>
      <div className="nav-section-label">
        <div>{label}</div>
        {description && (
          <div style={{ marginTop: 4, fontSize: 10, opacity: 0.85 }}>
            {description}
          </div>
        )}
      </div>
      {items.map((item) => {
        const isActive =
          item.path === "/"
            ? location === "/"
            : location.startsWith(item.path) && item.path !== "#";

        if (item.comingSoon) {
          return (
            <div
              key={item.label}
              className="nav-item"
              style={{ opacity: 0.4, cursor: "default" }}
            >
              {item.label}
              <span className="nav-badge">Soon</span>
            </div>
          );
        }

        return (
          <Link
            key={item.label}
            href={item.path}
            className={`nav-item ${isActive ? "active" : ""}`}
            onClick={onNavigate}
          >
            {item.label}
            {item.badge && <span className="nav-badge">{item.badge}</span>}
          </Link>
        );
      })}
    </>
  );
}

function SidebarContents({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();

  return (
    <>
      <div className="sidebar-header">
        <Link
          href="/"
          onClick={onNavigate}
          style={{
            textDecoration: "none",
            color: "inherit",
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            minHeight: "auto",
            minWidth: "auto",
          }}
        >
          <span className="logo-text">TIBER</span>
          <span className="logo-dot" />
        </Link>
      </div>

      <div className="sidebar-nav">
        <Link
          href="/"
          className={`nav-item ${location === "/" ? "active" : ""}`}
          onClick={onNavigate}
        >
          Home
        </Link>
        {navSections.map((section) => (
          <NavSection
            key={section.label}
            label={section.label}
            description={section.description}
            items={section.items}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="user-pill">
          <div>
            <div className="user-name">Tiber User</div>
            <div className="user-league">Dynasty · Analytics</div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function TiberLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <nav className="tiber-sidebar tiber-sidebar-desktop">
        <SidebarContents />
      </nav>

      <div className="tiber-mobile-topbar">
        <button
          className="tiber-hamburger"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <Link href="/" style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className="logo-text">TIBER</span>
          <span className="logo-dot" />
        </Link>
      </div>

      {mobileOpen && (
        <div
          className="tiber-drawer-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <nav className={`tiber-sidebar tiber-sidebar-mobile ${mobileOpen ? "open" : ""}`}>
        <button
          className="tiber-drawer-close"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
        <SidebarContents onNavigate={() => setMobileOpen(false)} />
      </nav>

      <main className="tiber-main">{children}</main>
    </>
  );
}
