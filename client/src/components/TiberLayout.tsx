import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";

interface NavItem {
  label: string;
  path: string;
  badge?: string;
  comingSoon?: boolean;
}

const coreNav: NavItem[] = [
  { label: "Dashboard", path: "/" },
  { label: "Data Lab", path: "/tiber-data-lab", badge: "4.2k" },
  { label: "FORGE Tiers", path: "/tiers" },
  { label: "Schedule", path: "/schedule" },
];

const intelligenceNav: NavItem[] = [
  { label: "Tiber Chat", path: "/legacy-chat", badge: "\u03B2" },
  { label: "X Intelligence", path: "/x-intel", badge: "GROK" },
  { label: "FORGE Engine", path: "/forge" },
  { label: "FORGE Workbench", path: "/forge-workbench" },
  { label: "Trade Analyzer", path: "#", comingSoon: true },
  { label: "Waiver Wire", path: "#", comingSoon: true },
];

const systemNav: NavItem[] = [
  { label: "Quality Sentinel", path: "/sentinel", badge: "NEW" },
  { label: "Metrics Dictionary", path: "/metrics-dictionary" },
  { label: "Architecture", path: "/architecture" },
  { label: "FORGE Hub", path: "/admin/forge-hub" },
  { label: "API Lexicon", path: "/admin/api-lexicon" },
];

function NavSection({ label, items, onNavigate }: { label: string; items: NavItem[]; onNavigate?: () => void }) {
  const [location] = useLocation();

  return (
    <>
      <div className="nav-section-label">{label}</div>
      {items.map((item) => {
        const isActive = item.path === "/"
          ? location === "/"
          : location.startsWith(item.path) && item.path !== "#";

        if (item.comingSoon) {
          return (
            <div key={item.label} className="nav-item" style={{ opacity: 0.4, cursor: "default" }}>
              {item.label}
              <span className="nav-badge">Soon</span>
            </div>
          );
        }

        return (
          <Link key={item.label} href={item.path} className={`nav-item ${isActive ? "active" : ""}`} onClick={onNavigate}>
            {item.label}
            {item.badge && <span className="nav-badge">{item.badge}</span>}
          </Link>
        );
      })}
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
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <button
        className="mobile-hamburger"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <span /><span /><span />
      </button>

      {mobileOpen && <div className="mobile-overlay" onClick={closeMobile} />}

      <nav className={`tiber-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <Link href="/" style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "baseline", gap: 8, minHeight: "auto", minWidth: "auto" }}>
            <span className="logo-text">TIBER</span>
            <span className="logo-dot" />
          </Link>
          <button className="mobile-close" onClick={closeMobile} aria-label="Close navigation">
            ✕
          </button>
        </div>

        <div className="sidebar-nav">
          <NavSection label="Core" items={coreNav} onNavigate={closeMobile} />
          <NavSection label="Intelligence" items={intelligenceNav} onNavigate={closeMobile} />
          <NavSection label="System" items={systemNav} onNavigate={closeMobile} />
        </div>

        <div className="sidebar-footer">
          <div className="user-pill">
            <div>
              <div className="user-name">Tiber User</div>
              <div className="user-league">Dynasty · Analytics</div>
            </div>
          </div>
        </div>
      </nav>

      <main className="tiber-main">
        {children}
      </main>
    </>
  );
}
