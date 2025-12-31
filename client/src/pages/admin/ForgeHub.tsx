import { Link } from 'wouter';
import { 
  FlaskConical, 
  Users, 
  Target, 
  BarChart3, 
  ExternalLink,
  Zap,
  TrendingUp,
  Shield,
  Settings,
  Database,
  BookOpen,
  LayoutDashboard
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SystemIntegrityCard from '@/components/admin/SystemIntegrityCard';

type AdminTool = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: typeof FlaskConical;
  iconColor: string;
  badge?: string;
  badgeColor?: string;
  external?: boolean;
};

const ADMIN_TOOLS: { section: string; tools: AdminTool[] }[] = [
  {
    section: 'FORGE Lab',
    tools: [
      {
        id: 'forge-lab',
        title: 'FORGE Lab Equation Sandbox',
        description: 'Test and tune alpha scoring equations with real-time calculations',
        href: '/admin/forge-lab',
        icon: FlaskConical,
        iconColor: 'text-purple-400',
        badge: 'Active',
        badgeColor: 'bg-purple-600',
      },
      {
        id: 'forge-dev',
        title: 'FORGE Dev Lab',
        description: 'Read-only alpha score viewer with batch inspection',
        href: '/dev/forge',
        icon: Zap,
        iconColor: 'text-cyan-400',
      },
    ],
  },
  {
    section: 'Player Mapping Tools',
    tools: [
      {
        id: 'player-mapping',
        title: 'Player Mapping',
        description: 'Search players and debug identity + team mapping with GSIS IDs',
        href: '/admin/player-mapping',
        icon: Users,
        iconColor: 'text-emerald-400',
        badge: 'New',
        badgeColor: 'bg-emerald-600',
      },
      {
        id: 'player-research',
        title: 'Player Research',
        description: 'Deep-dive player stats: usage, efficiency, finishing metrics',
        href: '/admin/player-research',
        icon: Target,
        iconColor: 'text-cyan-400',
        badge: 'New',
        badgeColor: 'bg-cyan-600',
      },
      {
        id: 'player-mapping-test',
        title: 'Player Mapping Sanity Test',
        description: 'Legacy debug tool for player identity resolution and stats',
        href: '/admin/player-mapping-test',
        icon: Database,
        iconColor: 'text-gray-400',
      },
    ],
  },
  {
    section: 'Context Debug',
    tools: [
      {
        id: 'env-debug',
        title: 'Environment Debug (KC)',
        description: 'Inspect environmental context for Kansas City',
        href: '/api/forge/env-debug?team=KC',
        icon: Settings,
        iconColor: 'text-orange-400',
        external: true,
      },
      {
        id: 'matchup-debug',
        title: 'Matchup Debug (NYJ vs WR)',
        description: 'Inspect matchup context for Jets defense vs WRs',
        href: '/api/forge/matchup-debug?defense=NYJ&position=WR',
        icon: Target,
        iconColor: 'text-red-400',
        external: true,
      },
    ],
  },
  {
    section: 'Rankings (FORGE Alpha)',
    tools: [
      {
        id: 'rankings-wr',
        title: 'WR Rankings',
        description: 'Wide Receiver alpha rankings with FORGE scores',
        href: '/rankings/wr',
        icon: TrendingUp,
        iconColor: 'text-blue-400',
      },
      {
        id: 'rankings-rb',
        title: 'RB Rankings',
        description: 'Running Back alpha rankings with FORGE scores',
        href: '/rankings/rb',
        icon: TrendingUp,
        iconColor: 'text-green-400',
      },
      {
        id: 'rankings-te',
        title: 'TE Rankings',
        description: 'Tight End alpha rankings',
        href: '/rankings/te',
        icon: TrendingUp,
        iconColor: 'text-yellow-400',
        badge: 'WIP',
        badgeColor: 'bg-yellow-600',
      },
      {
        id: 'rankings-qb',
        title: 'QB Rankings',
        description: 'Quarterback alpha rankings',
        href: '/rankings/qb',
        icon: TrendingUp,
        iconColor: 'text-pink-400',
        badge: 'WIP',
        badgeColor: 'bg-yellow-600',
      },
    ],
  },
  {
    section: 'Data Lab',
    tools: [
      {
        id: 'tiber-data-lab',
        title: 'Tiber Data Lab',
        description: 'Snapshot-based NFL data spine with TPRR, YPRR, EPA metrics',
        href: '/tiber-data-lab',
        icon: Database,
        iconColor: 'text-cyan-400',
        badge: 'New',
        badgeColor: 'bg-cyan-600',
      },
    ],
  },
  {
    section: 'Admin Sandboxes',
    tools: [
      {
        id: 'wr-sandbox',
        title: 'WR Rankings Sandbox',
        description: 'Experimental WR ranking formulas and scoring',
        href: '/admin/wr-rankings-sandbox',
        icon: BarChart3,
        iconColor: 'text-blue-400',
      },
      {
        id: 'qb-sandbox',
        title: 'QB Rankings Sandbox',
        description: 'Experimental QB alpha scoring with lens system',
        href: '/admin/qb-rankings-sandbox',
        icon: BarChart3,
        iconColor: 'text-pink-400',
      },
    ],
  },
  {
    section: 'System Status',
    tools: [
      {
        id: 'rag-status',
        title: 'RAG Status',
        description: 'Check embedding pipeline and vector search health',
        href: '/admin/rag-status',
        icon: Database,
        iconColor: 'text-gray-400',
      },
    ],
  },
  {
    section: 'Developer Tools',
    tools: [
      {
        id: 'api-lexicon',
        title: 'API Lexicon',
        description: 'Browse and test Forge/Tiber API endpoints with live examples',
        href: '/admin/api-lexicon',
        icon: BookOpen,
        iconColor: 'text-amber-400',
        badge: 'New',
        badgeColor: 'bg-amber-600',
      },
    ],
  },
  {
    section: 'Design Previews',
    tools: [
      {
        id: 'homepage-redesign',
        title: 'Homepage Redesign Preview',
        description: 'Preview the new dashboard layout with horizontal nav and chat panel',
        href: '/admin/homepage-redesign',
        icon: LayoutDashboard,
        iconColor: 'text-purple-400',
        badge: 'Preview',
        badgeColor: 'bg-purple-600',
      },
    ],
  },
];

function ToolCard({ tool }: { tool: AdminTool }) {
  const Icon = tool.icon;
  
  const cardContent = (
    <Card 
      className="bg-[#141824] border-gray-800 hover:border-gray-600 transition-colors cursor-pointer h-full"
      data-testid={`card-tool-${tool.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-[#0a0e1a] ${tool.iconColor}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-white truncate">{tool.title}</h3>
              {tool.badge && (
                <Badge className={`${tool.badgeColor} text-white text-xs`}>
                  {tool.badge}
                </Badge>
              )}
              {tool.external && (
                <ExternalLink className="h-3 w-3 text-gray-500 flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-gray-400 line-clamp-2">{tool.description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (tool.external) {
    return (
      <a 
        href={tool.href} 
        target="_blank" 
        rel="noopener noreferrer"
        data-testid={`link-tool-${tool.id}`}
      >
        {cardContent}
      </a>
    );
  }

  return (
    <Link href={tool.href} data-testid={`link-tool-${tool.id}`}>
      {cardContent}
    </Link>
  );
}

export default function ForgeHub() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-white" data-testid="text-page-title">
              FORGE Admin Hub
            </h1>
            <Badge className="bg-yellow-600 text-white text-xs">Internal</Badge>
          </div>
          <p className="text-gray-400 max-w-2xl">
            Central control room for all FORGE admin tools, debugging utilities, and ranking sandboxes.
          </p>
        </div>

        <div className="space-y-8">
          {ADMIN_TOOLS.map((section) => (
            <div key={section.section}>
              <h2 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
                {section.section}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.section === 'System Status' && (
                  <SystemIntegrityCard />
                )}
                {section.tools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              FORGE v0.2 | Tiber Fantasy Admin
            </p>
            <Link href="/">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-gray-400 hover:text-white"
                data-testid="button-back-home"
              >
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
