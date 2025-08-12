import { Compass, Activity, Users, Target } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SkeletonCard } from "@/components/Skeleton";
import Button from "@/components/Button";

export default function CompassHub() {
  const { data: stats, isLoading: statsLoading, refetch, isFetching } = useQuery({
    queryKey: ["compass", "stats"],
    queryFn: () => fetch("/api/compass/stats").then(r => r.json()),
    retry: false
  });

  const compassFeatures = [
    {
      href: "/compass/wr",
      title: "WR Player Compass",
      description: "Context-aware guidance for wide receiver decisions",
      icon: <Activity className="h-6 w-6" />
    },
    {
      href: "/compass/rb", 
      title: "RB Player Compass",
      description: "Running back evaluation with situation analysis",
      icon: <Users className="h-6 w-6" />
    },
    {
      href: "/compass/qb",
      title: "QB Player Compass", 
      description: "Quarterback guidance across different formats",
      icon: <Compass className="h-6 w-6" />
    },
    {
      href: "/compass/te",
      title: "TE Player Compass",
      description: "Tight end context and opportunity evaluation",
      icon: <Target className="h-6 w-6" />
    }
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-plum/10 rounded-xl">
            <Compass className="h-8 w-8 text-plum" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-ink">
              Player Compass
            </h1>
            <p className="text-body mt-1">
              Context-aware evaluation: scenarios, risk, roles. No rigid ranks.
            </p>
          </div>
        </div>
        <Button onClick={() => refetch()} loading={isFetching} variant="ghost">
          Refresh Data
        </Button>
      </div>

      {/* Feature Grid */}
      {statsLoading ? (
        <section aria-busy className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({length: 4}).map((_, i) => <SkeletonCard key={i} />)}
        </section>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {compassFeatures.map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              className="group p-6 border border-line rounded-2xl hover:shadow-lg transition-all duration-200 bg-white active:translate-y-[1px]"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="text-plum group-hover:text-gold transition-colors">
                  {feature.icon}
                </div>
                <h2 className="text-xl font-semibold text-ink">
                  {feature.title}
                </h2>
              </div>
              <p className="text-body">
                {feature.description}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}