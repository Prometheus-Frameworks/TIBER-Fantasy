import { Compass } from "lucide-react";
import { Link } from "wouter";
import SystemCard from "@/components/SystemCard";

export default function CompassHub() {
  const compassFeatures = [
    {
      href: "/compass/wr",
      title: "WR Player Compass",
      description: "Context-aware guidance for wide receiver decisions",
      icon: "🎯"
    },
    {
      href: "/compass/rb", 
      title: "RB Player Compass",
      description: "Running back evaluation with situation analysis",
      icon: "📈"
    },
    {
      href: "/compass/qb",
      title: "QB Player Compass", 
      description: "Quarterback guidance across different formats",
      icon: "👥"
    },
    {
      href: "/compass/te",
      title: "TE Player Compass",
      description: "Tight end context and opportunity evaluation",
      icon: "➡️"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-100 rounded-xl">
          <Compass className="h-8 w-8 text-blue-600" />
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

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {compassFeatures.map((feature) => (
          <SystemCard
            key={feature.href}
            href={feature.href}
            title={feature.title}
            desc={feature.description}
            icon={feature.icon}
          />
        ))}
      </div>

      {/* Link to Consensus */}
      <div className="pt-4 border-t border-line">
        <Link href="/consensus" className="text-sm text-body hover:text-plum hover:border-b hover:border-plum transition-colors">
          View OTC Consensus →
        </Link>
      </div>
    </div>
  );
}