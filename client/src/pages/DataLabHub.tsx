import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Database,
  Users,
  Layers,
  Camera,
  Target,
  ArrowRight,
  Activity,
  ChevronRight,
  Cpu,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

const modules = [
  {
    id: "snapshots",
    title: "Snapshots",
    subtitle: "Raw Data Spine",
    description:
      "Snapshot-based NFL data explorer with per-week and season aggregation. Search players, explore efficiency metrics, red zone data, and situational splits.",
    icon: Camera,
    path: "/tiber-data-lab/snapshots",
    color: "#e2640d",
    badge: null as string | null,
  },
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
    id: "red-zone",
    title: "Red Zone Lab",
    subtitle: "Scoring Opportunity Analysis",
    description:
      "Red zone snap rates, target shares, catch rates, rush TD rates, and scoring efficiency across QB, RB, WR, and TE inside the opponent 20-yard line.",
    icon: Target,
    path: "/tiber-data-lab/red-zone",
    color: "#dc2626",
    badge: "NEW" as string | null,
  },
  {
    id: "situational",
    title: "Situational Lab",
    subtitle: "Context-Dependent Performance",
    description:
      "Third-down conversions, two-minute drill efficiency, hurry-up success rates, short yardage conversions, and situational target data across all positions.",
    icon: Activity,
    path: "/tiber-data-lab/situational",
    color: "#ca8a04",
    badge: "NEW" as string | null,
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

  return (
    <Link href={module.path}>
      <Card className="group cursor-pointer border border-gray-200 hover:border-[#e2640d]/40 hover:shadow-md transition-all duration-200 bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div
              className="p-2.5 rounded-lg"
              style={{ backgroundColor: `${module.color}14` }}
            >
              <Icon
                className="h-5 w-5"
                style={{ color: module.color }}
              />
            </div>
            <div className="flex items-center gap-2">
              {module.badge && (
                <Badge
                  variant="secondary"
                  className="text-xs font-medium bg-[#e2640d]/10 text-[#e2640d] border-0"
                >
                  {module.badge}
                </Badge>
              )}
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
        <CardContent className="pt-0">
          <p className="text-sm text-gray-500 leading-relaxed">
            {module.description}
          </p>
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

  const snapshotStat = health?.latestSnapshot
    ? `${health.latestSnapshot.rowCount.toLocaleString()} players · Week ${health.latestSnapshot.week} · ${health.latestSnapshot.season}`
    : undefined;

  const weekCount = health?.tableCounts?.snapshotPlayerWeek;
  const metaCount = health?.tableCounts?.snapshotMeta;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
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
        <p className="text-gray-500 text-sm max-w-2xl">
          Snapshot-based NFL data spine for reproducible analytics. Browse raw
          metrics, personnel intelligence, and role classifications across the
          three research modules below.
        </p>
      </div>

      {health && (
        <div className="grid grid-cols-3 gap-4 mb-8">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {modules.map((mod) => (
          <ModuleCard
            key={mod.id}
            module={mod}
            stat={mod.id === "snapshots" ? snapshotStat : undefined}
          />
        ))}
      </div>
    </div>
  );
}
