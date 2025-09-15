export interface NavLink {
  href?: string;
  label: string;
  description?: string;
  dropdown?: NavLink[];
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home", description: "Fantasy football tools overview" },
  { href: "/news", label: "News + Updates", description: "Recent NFL news with fantasy impact" },
  { href: "/redraft", label: "Redraft", description: "Seasonal league tools" },
  { href: "/dynasty", label: "Dynasty", description: "Long-term strategy" },
  { href: "/player-evaluation", label: "Player Evaluation", description: "Fusion rankings with 4-directional compass insights" },
  { href: "/power-rankings", label: "Power Rankings", description: "Tiber's comprehensive weekly rankings" },
  { href: "/risers-and-fallers", label: "Risers & Fallers", description: "Week 1 fantasy stock movers and performance analysis" },
  { href: "/start-sit", label: "Start/Sit Calculator", description: "AI-powered lineup decisions with detailed reasoning" },
  { href: "/sleeper-connect", label: "Sync", description: "Connect your leagues" },
  { 
    label: "Research & Analysis", 
    description: "Advanced analytical tools",
    dropdown: [
      { href: "/research", label: "Depth Charts & Intel", description: "Roster analysis and intelligence feeds" },
      { href: "/leaders", label: "Leaders", description: "2024 NFL player stats and leaderboards" },
      { href: "/snap-counts", label: "Snap Counts", description: "Evidence-based snap count analysis" },
      { href: "/sos", label: "SOS", description: "Strength of Schedule matchup analysis" }
    ]
  },
  { href: "/about", label: "About", description: "Learn about On The Clock and Tiber" },
  { href: "/articles", label: "Articles", description: "Strategy and insights" },
];

// Extended navigation for secondary features
export const EXTENDED_NAV_LINKS: NavLink[] = [
  { href: "/consensus-transparency", label: "Consensus Transparency", description: "How consensus works" },
  { href: "/experts/architect-j", label: "Architect J", description: "Founder rankings" },
  // Demo routes hidden in production via SHOW_INTERNAL_DEMOS flag
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