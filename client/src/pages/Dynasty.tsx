import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, TrendingUp, Users, Award } from "lucide-react";

const titleCase = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());
const two = (n: number) => Number.isFinite(n) ? n.toFixed(2) : '0.00';

interface VORPPlayer {
  name: string;
  team: string;
  age: number;
  vorp: number;
  tier: string;
  adp?: number;
  risk?: string;
}

export default function DynastyPage() {
  const { data: vorpData, isLoading } = useQuery({
    queryKey: ['/api/analytics/vorp'],
    queryFn: () => fetch('/api/analytics/vorp?season=2025&pos=WR').then(r => r.json()),
  });

  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 's': case 'elite': return 'bg-purple-500 text-white';
      case 'a': case 'tier-1': return 'bg-blue-500 text-white';
      case 'b': case 'tier-2': return 'bg-green-500 text-white';
      case 'c': case 'tier-3': return 'bg-yellow-500 text-white';
      case 'd': case 'tier-4': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getRiskColor = (age: number) => {
    if (age >= 30) return 'bg-red-100 text-red-800';
    if (age >= 28) return 'bg-yellow-100 text-yellow-800';
    if (age >= 26) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  };

  const getRiskLabel = (age: number) => {
    if (age >= 30) return 'High';
    if (age >= 28) return 'Medium';
    if (age >= 26) return 'Moderate';
    return 'Low';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Crown className="h-8 w-8 text-purple-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dynasty Central
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Long-term value analysis and market efficiency insights
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Dynasty Rankings</span>
          </CardTitle>
          <CardDescription>
            VORP-based dynasty values with age-adjusted risk assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center space-x-3 py-3">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-4 bg-gray-200 rounded w-8" />
                  <div className="h-4 bg-gray-200 rounded w-12" />
                  <div className="h-4 bg-gray-200 rounded w-16" />
                  <div className="h-4 bg-gray-200 rounded w-12" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Name</th>
                    <th className="text-left py-2 px-3">Age</th>
                    <th className="text-left py-2 px-3">Tier</th>
                    <th className="text-left py-2 px-3">Market (ADP)</th>
                    <th className="text-left py-2 px-3">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(vorpData) ? vorpData.slice(0, 20).map((player: any, idx: number) => (
                    <tr key={player.id || idx} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3">
                        <div className="font-medium">{titleCase(player.name)}</div>
                        <div className="text-sm text-gray-500">{player.team}</div>
                      </td>
                      <td className="py-2 px-3 text-sm">{player.age}</td>
                      <td className="py-2 px-3">
                        <Badge className={getTierColor(player.tier)}>
                          {player.tier}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-sm">
                        {player.adp ? `${player.adp.toFixed(0)}` : 'N/A'}
                      </td>
                      <td className="py-2 px-3">
                        <Badge className={getRiskColor(player.age)}>
                          {getRiskLabel(player.age)}
                        </Badge>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-500">
                        No dynasty data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}