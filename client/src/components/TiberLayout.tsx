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
    label: "Primary",
    description: "Inspectable systems only.",
    items: [
      { label: "Management", path: "/management", badge: "NEW" },
      { label: "Rankings", path: "/tiers", badge: "LIVE" },
      { label: "Rookie Board", path: "/rookies", badge: "2026" },
    ],
  },
  {
    label: "Reference",
    description: "Architecture and capability docs.",
    items: [
      { label: "Metrics Dictionary", path: "/metrics-dictionary" },
      { label: "Architecture", path: "/architecture" },
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
          <span className="logo-text">TIBER Observatory</span>
          <span className="logo-dot" />
        </Link>
      </div>

      <div className="sidebar-nav">
        <Link
          href="/"
          className={`nav-item ${location === "/" ? "active" : ""}`}
          onClick={onNavigate}
        >
          Observatory
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
            <div className="user-name">Operator surface</div>
            <div className="user-league">Read-only inspection</div>
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
          <span className="logo-text">TIBER Observatory</span>
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
