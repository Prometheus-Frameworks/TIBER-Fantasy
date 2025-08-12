export interface NavLink {
  href: string;
  label: string;
  description?: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home", description: "Fantasy football tools overview" },
  { href: "/redraft", label: "Redraft", description: "Seasonal league tools" },
  { href: "/dynasty", label: "Dynasty", description: "Long-term strategy" },
  { href: "/consensus", label: "OTC Consensus", description: "Player rankings and tiers" },
  { href: "/analytics", label: "Analytics", description: "Advanced player analysis" },
  { href: "/articles", label: "Articles & Analysis", description: "Strategy and insights" },
  { href: "/weekly-data", label: "Weekly Data", description: "Game logs and stats" },
  { href: "/trade-analyzer-new", label: "Trade Analyzer", description: "Evaluate trades" },
  { href: "/waivers", label: "Waivers", description: "Waiver wire targets" },
  { href: "/oasis", label: "OASIS", description: "Offensive system analysis" },
];

// Quick actions for converting hero buttons
export const QUICK_ACTIONS: NavLink[] = [
  { href: "/player-compass", label: "Player Compass", description: "Context-aware guidance for dynasty decisions" },
  { href: "/rookie-evaluator", label: "2025 Rookies", description: "Evaluate incoming rookie class" },
  { href: "/draft-room", label: "Draft Room", description: "Prep and dominate your draft" },
  { href: "/dashboard", label: "Dashboard", description: "Personal league management" },
];