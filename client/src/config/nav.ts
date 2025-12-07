export interface NavLink {
  href?: string;
  label: string;
  description?: string;
  dropdown?: NavLink[];
  icon?: string;
}

// Main navigation - Forge v1 minimal structure
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "TIBER", description: "AI-powered fantasy football assistant" },
  { href: "/rankings", label: "Tiber Tiers", description: "FORGE-powered player tiers by position" },
  { href: "/schedule", label: "Schedule", description: "Strength of Schedule analysis" },
  { href: "/leagues", label: "Leagues", description: "Your connected leagues" },
];

// Admin navigation - dev tools
export const ADMIN_NAV_LINKS: NavLink[] = [
  { href: "/admin/forge-hub", label: "FORGE Hub", description: "Central control room" },
  { href: "/admin/api-lexicon", label: "API Lexicon", description: "Endpoint reference" },
  { href: "/admin/wr-rankings-sandbox", label: "WR Sandbox", description: "WR ranking experiments" },
  { href: "/admin/qb-rankings-sandbox", label: "QB Sandbox", description: "QB ranking experiments" },
  { href: "/admin/player-mapping", label: "Player Mapping", description: "Identity resolution tools" },
  { href: "/admin/player-research", label: "Player Research", description: "Deep player analysis" },
];

// Legacy - kept for reference but not exposed in nav
export const LEGACY_NAV_LINKS: NavLink[] = [
  { href: "/matchups", label: "Matchups", description: "FORGE Matchups (legacy)" },
  { href: "/leaders", label: "Leaders", description: "2024 stats leaderboards" },
  { href: "/analytics", label: "Analytics", description: "Advanced analysis" },
  { href: "/compare", label: "Compare", description: "Player comparison" },
];
