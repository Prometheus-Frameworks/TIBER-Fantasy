export interface NavLink {
  href: string;
  label: string;
  description?: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home", description: "Fantasy football tools overview" },
  { href: "/news", label: "News + Updates", description: "Recent NFL news with fantasy impact" },
  { href: "/redraft", label: "Redraft", description: "Seasonal league tools" },
  { href: "/dynasty", label: "Dynasty", description: "Long-term strategy" },
  { href: "/compass", label: "Compass", description: "Context-aware player guidance" },
  { href: "/consensus", label: "Consensus", description: "Community-driven rankings" },
  { href: "/sleeper-connect", label: "Sleeper", description: "Connect your leagues" },
  { href: "/snap-counts", label: "Snap Counts", description: "Evidence-based snap count analysis" },
  { href: "/research", label: "Research & Analysis", description: "Depth charts and team analysis" },
  { href: "/competence", label: "Competence Mode", description: "Truth-first AI guidance" },
  { href: "/articles", label: "Articles", description: "Strategy and insights" },
];

// Extended navigation for secondary features
export const EXTENDED_NAV_LINKS: NavLink[] = [
  { href: "/consensus-transparency", label: "Consensus Transparency", description: "How consensus works" },
  { href: "/experts/architect-j", label: "Architect J", description: "Founder rankings" },
  { href: "/adaptive-consensus-demo", label: "Adaptive Consensus", description: "Test surge detection & injury system" },
  { href: "/curves-demo", label: "Dynasty Curves", description: "Smooth injury adjustment system" },
  { href: "/injury-profiles-demo", label: "Injury Profiles v2", description: "Grok's injury data integration" },
  { href: "/analytics", label: "Analytics", description: "Advanced player analysis" },
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