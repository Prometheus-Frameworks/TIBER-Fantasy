import { Link, useLocation } from "wouter";

interface NavItem {
  label: string;
  path: string;
  badge?: string;
  comingSoon?: boolean;
}

const evaluateNav: NavItem[] = [
  { label: "FORGE Tiers", path: "/tiers" },
  { label: "IDP Lab", path: "/idp-lab" },
  { label: "Fantasy Lab", path: "/fantasy-lab" },
  { label: "CATALYST Lab", path: "/catalyst-lab", badge: "NEW" },
  { label: "FORGE Workbench", path: "/forge-workbench" },
];

const researchNav: NavItem[] = [
  { label: "Data Lab", path: "/tiber-data-lab" },
  { label: "Schedule", path: "/schedule" },
];

const intelligenceNav: NavItem[] = [
  { label: "Tiber Chat", path: "/legacy-chat", badge: "\u03B2" },
  { label: "X Intelligence", path: "/x-intel", badge: "GROK" },
];

const adminNav: NavItem[] = [
  { label: "FORGE Hub", path: "/admin/forge-hub" },
  { label: "FORGE Engine", path: "/forge" },
  { label: "Quality Sentinel", path: "/sentinel" },
  { label: "Metrics Dictionary", path: "/metrics-dictionary" },
  { label: "Architecture", path: "/architecture" },
  { label: "API Lexicon", path: "/admin/api-lexicon" },
];

function NavSection({ label, items }: { label: string; items: NavItem[] }) {
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
          <Link key={item.label} href={item.path} className={`nav-item ${isActive ? "active" : ""}`}>
            {item.label}
            {item.badge && <span className="nav-badge">{item.badge}</span>}
          </Link>
        );
      })}
    </>
  );
}

export default function TiberLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <>
      <nav className="tiber-sidebar">
        <div className="sidebar-header">
          <Link href="/" style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "baseline", gap: 8, minHeight: "auto", minWidth: "auto" }}>
            <span className="logo-text">TIBER</span>
            <span className="logo-dot" />
          </Link>
        </div>

        <div className="sidebar-nav">
          <Link href="/" className={`nav-item ${location === "/" ? "active" : ""}`}>
            Dashboard
          </Link>
          <NavSection label="Evaluate" items={evaluateNav} />
          <NavSection label="Research" items={researchNav} />
          <NavSection label="Intelligence" items={intelligenceNav} />
          <NavSection label="Admin" items={adminNav} />
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
