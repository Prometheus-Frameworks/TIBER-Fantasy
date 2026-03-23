import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Database,
  Users,
  Layers,
  Target,
  ArrowRight,
  Activity,
  ChevronRight,
  Cpu,
  Clock,
  Network,
  TrendingUp,
  LineChart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROMOTED_DATA_LAB_MODULES } from "@/lib/dataLabPromotedModules";

interface SnapshotHealth {
  status: string;
  latestSnapshot: {
    id: number;
    season: number;
    week: number;
    snapshotAt: string;
    rowCount: number;
  } | null;
  tableCounts: {
    snapshotMeta: number;
    snapshotPlayerWeek: number;
    snapshotPlayerSeason: number;
    weekStaging: number;
    seasonStaging: number;
  };
}

const promotedModuleIds = new Set(PROMOTED_DATA_LAB_MODULES.map((module) => module.id));

const modules = [
  {
    id: "personnel",
    title: "Personnel Groupings",
    subtitle: "Formation Intelligence",
    description:
      "Every-down grade classifications, personnel breakdown percentages, and usage patterns across 10, 11, 12, 13, 21, and 22 personnel packages.",
    icon: Users,
    path: "/tiber-data-lab/personnel",
    color: "#0891b2",
    badge: "NEW",
  },
  {
    id: "role-banks",
    title: "Role Banks",
    subtitle: "Positional Archetypes",
    description:
      "Season-level analytical classification systems for WR, RB, TE, and QB. Defines player archetypes and role designations based on usage patterns.",
    icon: Layers,
    path: "/tiber-data-lab/role-banks",
    color: "#059669",
    badge: null,
  },
  {
    id: "receiving",
    title: "Receiving Lab",
    subtitle: "Target & Efficiency Analysis",
    description:
      "Season-aggregated receiving metrics including EPA/target, catch rate, YPRR, TPRR, WOPR, xYAC, and target depth distribution for WR, TE, and RB.",
    icon: Target,
    path: "/tiber-data-lab/receiving",
    color: "#7c3aed",
    badge: "NEW" as string | null,
  },
  {
    id: "rushing",
    title: "Rushing Lab",
    subtitle: "Ground Game Intelligence",
    description:
      "Season-aggregated rushing metrics including YPC, rush EPA, stuff rate, first down rate, run gap distribution, and run location splits for RB and QB.",
    icon: Activity,
    path: "/tiber-data-lab/rushing",
    color: "#16a34a",
    badge: "NEW" as string | null,
  },
  {
    id: "qb",
    title: "QB Lab",
    subtitle: "Passing Value & Process",
    description:
      "CPOE, ANY/A, air EPA, formation tendencies, pressure rates, scramble production, and dropback efficiency for quarterbacks.",
    icon: Cpu,
    path: "/tiber-data-lab/qb",
    color: "#9333ea",
    badge: "NEW" as string | null,
  },
  {
    id: "situational",
    title: "Situational Lab",
    subtitle: "Red Zone & Context-Dependent Performance",
    description:
      "Red zone snaps, target shares, and TD rates merged with third-down conversions, two-minute drill efficiency, hurry-up success, and short yardage data across all positions.",
    icon: Clock,
    path: "/tiber-data-lab/situational",
    color: "#e2640d",
    badge: "NEW" as string | null,
  },
  {
    id: "breakout-signals",
    title: "WR Breakout Lab",
    subtitle: "Signal Validation Promotion",
    description:
      "Promoted signal-card rankings and recipe context from Breakout Lab exports, surfaced as a read-only operator review table.",
    whatItIsFor:
      "Validate promoted breakout candidates and recipe-level signal strength without rescoring anything inside TIBER.",
    whenToUse:
      "Use when you want a fast breakout screen before checking how stable the player's role or developmental timing looks.",
    icon: Target,
    path: "/tiber-data-lab/breakout-signals",
    color: "#f97316",
    badge: "PROMOTED" as string | null,
  },
  {
    id: "role-opportunity",
    title: "Role & Opportunity Lab",
    subtitle: "Usage & Deployment Promotion",
    description:
      "Promoted role, route, target, and snap-share context from TIBER-Data compatibility views or exported artifacts.",
    whatItIsFor:
      "Inspect current deployment and opportunity so breakout or dynasty takes are grounded in how the player is actually being used.",
    whenToUse:
      "Use when you need alignment, route, target, air-yard, and snap-share context to explain the player case.",
    icon: Network,
    path: "/tiber-data-lab/role-opportunity",
    color: "#0f766e",
    badge: "PROMOTED" as string | null,
  },
  {
    id: "age-curves",
    title: "Age Curve / ARC Lab",
    subtitle: "Developmental Context Promotion",
    description:
      "Promoted age, career-stage, peer-bucket, and expected-vs-actual context from ARC outputs, surfaced read only.",
    whatItIsFor:
      "Frame where a player sits on the developmental curve without turning ARC into a local scoring engine.",
    whenToUse:
      "Use when you want developmental timing and expected-vs-actual context to support or challenge the current player thesis.",
    icon: TrendingUp,
    path: "/tiber-data-lab/age-curves",
    color: "#7c3aed",
    badge: "PROMOTED" as string | null,
  },
  {
    id: "point-scenarios",
    title: "Point Scenario Lab",
    subtitle: "Scenario-Based Point Context",
    description:
      "Promoted baseline-versus-adjusted point outcomes from Point-prediction-Model, surfaced as a read-only scenario review table.",
    whatItIsFor:
      "Inspect how specific events or assumptions move a player's point outlook without rebuilding projection logic inside TIBER.",
    whenToUse:
      "Use when you need contingency-aware point outcomes before making a final call elsewhere in the workflow.",
    icon: LineChart,
    path: "/tiber-data-lab/point-scenarios",
    color: "#2563eb",
    badge: "PROMOTED" as string | null,
  },
];

function ModuleCard({
  module,
  stat,
}: {
  module: (typeof modules)[0];
  stat?: string;
}) {
  const Icon = module.icon;
  const isPromotedModule = promotedModuleIds.has(module.id as (typeof PROMOTED_DATA_LAB_MODULES)[number]["id"]);

  return (
    <Link href={module.path}>
      <Card className="group cursor-pointer border border-gray-200 hover:border-[#e2640d]/40 hover:shadow-md transition-all duration-200 bg-white h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div
              className="p-2.5 rounded-lg"
              style={{ backgroundColor: `${module.color}14` }}
            >
              <Icon className="h-5 w-5" style={{ color: module.color }} />
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {module.badge && (
                <Badge
                  variant="secondary"
                  className={isPromotedModule
                    ? "text-xs font-medium bg-gray-900 text-white border-0"
                    : "text-xs font-medium bg-[#e2640d]/10 text-[#e2640d] border-0"
                  }
                >
                  {module.badge}
                </Badge>
              )}
              {isPromotedModule ? (
                <Badge variant="secondary" className="text-xs font-medium bg-gray-100 text-gray-600 border-0">
                  Read only
                </Badge>
              ) : null}
              <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-[#e2640d] group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
          <CardTitle className="text-base font-semibold text-gray-900 mt-3">
            {module.title}
          </CardTitle>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            {module.subtitle}
          </p>
        </CardHeader>
        <CardContent className="pt-0 flex h-full flex-col">
          <p className="text-sm text-gray-500 leading-relaxed">
            {module.description}
          </p>
          {isPromotedModule ? (
            <div className="mt-4 space-y-3 rounded-lg border border-gray-100 bg-[#fafafa] p-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                  What this module is for
                </div>
                <p className="mt-1 text-sm leading-6 text-gray-600">{module.whatItIsFor}</p>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                  When to use this
                </div>
                <p className="mt-1 text-sm leading-6 text-gray-600">{module.whenToUse}</p>
              </div>
            </div>
          ) : null}
          {stat && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs font-mono text-gray-400">{stat}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DataLabHub() {
  const { data: health } = useQuery<SnapshotHealth>({
    queryKey: ["/api/data-lab/health"],
  });

  const weekCount = health?.tableCounts?.snapshotPlayerWeek;
  const metaCount = health?.tableCounts?.snapshotMeta;
  const promotedModules = modules.filter((module) => promotedModuleIds.has(module.id as (typeof PROMOTED_DATA_LAB_MODULES)[number]["id"]));
  const coreModules = modules.filter((module) => !promotedModuleIds.has(module.id as (typeof PROMOTED_DATA_LAB_MODULES)[number]["id"]));

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
          <Link href="/" className="hover:text-[#e2640d] transition-colors">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-600 font-medium">Data Lab</span>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <Database className="h-6 w-6 text-[#e2640d]" />
          <h1
            className="text-2xl font-semibold text-gray-900"
            style={{ fontFamily: "Instrument Sans, sans-serif" }}
          >
            Tiber Data Lab
          </h1>
        </div>
        <p className="text-gray-500 text-sm max-w-3xl">
          Snapshot-based NFL data spine for reproducible analytics. The promoted module system now ties breakout validation,
          role and opportunity context, age-curve framing, and scenario-based point outcomes into one operator-friendly product surface.
        </p>
      </div>

      {health && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#fafafa] border border-gray-100 rounded-lg p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              Snapshots
            </div>
            <div className="text-xl font-mono font-semibold text-gray-900">
              {metaCount ?? "—"}
            </div>
          </div>
          <div className="bg-[#fafafa] border border-gray-100 rounded-lg p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              Player-Weeks
            </div>
            <div className="text-xl font-mono font-semibold text-gray-900">
              {weekCount?.toLocaleString() ?? "—"}
            </div>
          </div>
          <div className="bg-[#fafafa] border border-gray-100 rounded-lg p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              Status
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Activity className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-600">
                {health.status === "healthy" ? "Healthy" : health.status}
              </span>
            </div>
          </div>
        </div>
      )}

      <section className="mb-10">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Promoted module system</div>
            <h2 className="mt-1 text-xl font-semibold text-gray-900">Breakout, role, developmental, and scenario context in one lane</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              These four promoted labs are read-only by design. Use Breakout Lab for candidate validation, Role &amp; Opportunity
              for deployment context, ARC for developmental timing, and Point Scenario Lab for contingency-aware point outcomes. They are meant to be used together, not as isolated destinations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-0 bg-gray-900 text-white">Promoted</Badge>
            <Badge variant="secondary" className="border-0 bg-gray-100 text-gray-600">Read only</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {promotedModules.map((mod) => (
            <ModuleCard key={mod.id} module={mod} stat={undefined} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Core Data Lab surfaces</div>
          <h2 className="mt-1 text-xl font-semibold text-gray-900">Broader research modules</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            The rest of Data Lab remains available for deeper metric inspection, personnel context, and positional research outside the promoted module lane.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {coreModules.map((mod) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              stat={undefined}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
