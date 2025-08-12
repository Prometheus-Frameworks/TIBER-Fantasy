import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Compass, Users, TrendingUp, Target, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function CompassHub() {
  const compassFeatures = [
    {
      href: "/compass/wr",
      title: "WR Player Compass",
      description: "Context-aware guidance for wide receiver decisions",
      icon: Target,
      color: "bg-blue-500"
    },
    {
      href: "/compass/rb", 
      title: "RB Player Compass",
      description: "Running back evaluation with situation analysis",
      icon: TrendingUp,
      color: "bg-green-500"
    },
    {
      href: "/compass/qb",
      title: "QB Player Compass", 
      description: "Quarterback guidance across different formats",
      icon: Users,
      color: "bg-purple-500"
    },
    {
      href: "/compass/te",
      title: "TE Player Compass",
      description: "Tight end context and opportunity evaluation",
      icon: ArrowRight,
      color: "bg-orange-500"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl">
          <Compass className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Player Compass
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Context-aware guidance: scenarios, risk, and roles. No rigid ranks.
          </p>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {compassFeatures.map((feature) => {
          const IconComponent = feature.icon;
          return (
            <Link key={feature.href} href={feature.href}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 ${feature.color} rounded-lg`}>
                      <IconComponent className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {feature.description}
                  </p>
                  <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium">
                    Explore <ArrowRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Utility Row */}
      <Card className="bg-gray-50 dark:bg-gray-800/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                Need rankings instead?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Switch to community-driven boards and consensus tiers
              </p>
            </div>
            <Link href="/consensus">
              <Badge variant="outline" className="cursor-pointer hover:bg-yellow-50 dark:hover:bg-yellow-900/20">
                OTC Consensus →
              </Badge>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}