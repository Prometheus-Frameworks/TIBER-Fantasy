export interface NavLink {
  href?: string;
  label: string;
  description?: string;
  dropdown?: NavLink[];
  icon?: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", description: "Overview and quick access" },
  { href: "/tiers", label: "FORGE Tiers", description: "FORGE-powered skill position tiers" },
  { href: "/idp-lab", label: "IDP Lab", description: "Defensive position FORGE grades" },
  { href: "/fantasy-lab", label: "Fantasy Lab", description: "FIRE scores and Delta analysis" },
  { href: "/schedule", label: "Schedule", description: "Strength of Schedule analysis" },
];

export const ADMIN_NAV_LINKS: NavLink[] = [
  { href: "/admin/forge-hub", label: "FORGE Hub", description: "Central control room" },
  { href: "/admin/api-lexicon", label: "API Lexicon", description: "Endpoint reference" },
  { href: "/admin/player-mapping", label: "Player Mapping", description: "Identity resolution tools" },
  { href: "/admin/player-research", label: "Player Research", description: "Deep player analysis" },
];

export const LEGACY_NAV_LINKS: NavLink[] = [
  { href: "/matchups", label: "Matchups", description: "FORGE Matchups (legacy)" },
  { href: "/leaders", label: "Leaders", description: "2024 stats leaderboards" },
  { href: "/analytics", label: "Analytics", description: "Advanced analysis" },
  { href: "/compare", label: "Compare", description: "Player comparison" },
];
