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
    label: "Platform",
    items: [
      { label: "TiberClaw", path: "/tiberclaw", badge: "↗" },
    ],
  },
  {
    label: "Core Decisions",
    description: "Your main paths for rankings, scouting, and day-to-day calls.",
    items: [
      { label: "FORGE Tiers", path: "/tiers" },
      { label: "Rookie Board", path: "/rookies", badge: "2026" },
      { label: "Fantasy Lab", path: "/fantasy-lab" },
    ],
  },
  {
    label: "Player & Prospect Evaluation",
    description: "Deep FORGE breakdowns and experimental labs.",
    items: [
      { label: "FORGE Workbench", path: "/forge-workbench" },
      { label: "CATALYST Lab", path: "/catalyst-lab", badge: "NEW" },
      { label: "IDP Lab", path: "/idp-lab" },
    ],
  },
  {
    label: "Analytics & Research",
    description: "Schedules, raw views, and advanced data tools.",
    items: [
      { label: "Schedule & Matchups", path: "/schedule" },
      { label: "Data Lab", path: "/tiber-data-lab" },
    ],
  },
  {
    label: "AI & Intelligence",
    description: "Assistants and signal scanners that think with you.",
    items: [
      { label: "Tiber Chat", path: "/legacy-chat", badge: "β" },
      { label: "X Intelligence", path: "/x-intel", badge: "GROK" },
    ],
  },
  {
    label: "FORGE & System",
    description: "Engine internals and builder tools. Most users can ignore this.",
    items: [
      { label: "FORGE Hub", path: "/admin/forge-hub" },
      { label: "FORGE Engine", path: "/forge" },
      { label: "FORGE Inspector", path: "/forge/inspect" },
      { label: "Quality Sentinel", path: "/sentinel" },
      { label: "Metrics Dictionary", path: "/metrics-dictionary" },
      { label: "Architecture", path: "/architecture" },
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
          Dashboard
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
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <nav className="tiber-sidebar tiber-sidebar-desktop">
        <SidebarContents />
      </nav>

      {/* ── Mobile topbar ── */}
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

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div
          className="tiber-drawer-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
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

      <main className="tiber-main">
        {children}
      </main>
    </>
  );
}
