import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import DataAttributionFooter from "@/components/data-attribution-footer";
import { 
  Trophy, 
  TrendingUp, 
  Users, 
  BarChart3, 
  Target, 
  Star, 
  Crown,
  Search,
  Zap,
  Shield,
  ChevronRight,
  Activity,
  LineChart,
  Brain
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Prometheus
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Advanced dynasty fantasy football analytics platform with market inefficiency detection, 
              expert consensus rankings, and comprehensive player profiling
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/rankings">
                <Button size="lg" className="px-8 py-3 text-lg">
                  Explore Rankings
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/compare-league">
                <Button variant="outline" size="lg" className="px-8 py-3 text-lg">
                  Compare Leagues
                  <Users className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
            
            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
              <Link href="/rankings">
                <div className="text-center p-4 bg-white/50 rounded-lg backdrop-blur-sm hover:bg-white/70 transition-colors cursor-pointer">
                  <div className="text-2xl font-bold text-blue-600">1000+</div>
                  <div className="text-sm text-gray-600">Players Analyzed</div>
                </div>
              </Link>
              <Link href="/rankings">
                <div className="text-center p-4 bg-white/50 rounded-lg backdrop-blur-sm hover:bg-white/70 transition-colors cursor-pointer">
                  <div className="text-2xl font-bold text-green-600">6</div>
                  <div className="text-sm text-gray-600">Dynasty Tiers</div>
                </div>
              </Link>
              <Link href="/compare-league">
                <div className="text-center p-4 bg-white/50 rounded-lg backdrop-blur-sm hover:bg-white/70 transition-colors cursor-pointer">
                  <div className="text-2xl font-bold text-purple-600">3</div>
                  <div className="text-sm text-gray-600">Platforms Synced</div>
                </div>
              </Link>
              <Link href="/rankings">
                <div className="text-center p-4 bg-white/50 rounded-lg backdrop-blur-sm hover:bg-white/70 transition-colors cursor-pointer">
                  <div className="text-2xl font-bold text-orange-600">Live</div>
                  <div className="text-sm text-gray-600">NFL Data</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything You Need for Dynasty Domination
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            From market value analysis to individual player profiling, 
            Prometheus provides the insights you need to build championship teams
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Enhanced Dynasty Algorithm */}
          <Card className="hover:shadow-lg transition-shadow border-0 bg-gradient-to-br from-purple-50 to-blue-50 backdrop-blur-sm ring-2 ring-purple-200">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">Enhanced Dynasty v2.0</CardTitle>
                  <CardDescription>Research-based exponential scaling</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                NEW: Position-specific efficiency weights, exponential elite player scaling, 
                and research-backed dynasty valuations with 150 players.
              </p>
              <Link href="/enhanced-dynasty">
                <Button className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600">
                  Try Enhanced Algorithm <Zap className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Dynasty Rankings */}
          <Card className="hover:shadow-lg transition-shadow border-0 bg-white/60 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Crown className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Dynasty Rankings</CardTitle>
                  <CardDescription>Proprietary dynasty values</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Proprietary dynasty rankings with our own tier system based on statistical analysis. 
                Find Elite, Premium, and undervalued players across all tiers.
              </p>
              <Link href="/rankings">
                <Button variant="outline" size="sm" className="w-full">
                  View Rankings <Trophy className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Player Profiles */}
          <Card className="hover:shadow-lg transition-shadow border-0 bg-white/60 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Search className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Player Profiles</CardTitle>
                  <CardDescription>Individual player analysis</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Comprehensive player profiles with performance charts, market analysis, 
                strengths/concerns, and similar player comparisons.
              </p>
              <Link href="/rankings?tab=search">
                <Button variant="outline" size="sm" className="w-full">
                  Search Players <Search className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Market Value Analysis */}
          <Card className="hover:shadow-lg transition-shadow border-0 bg-white/60 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Value Analysis</CardTitle>
                  <CardDescription>Market inefficiency detection</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Find STEAL and VALUE opportunities by comparing our rankings 
                against ADP and market consensus. Avoid overvalued players.
              </p>
              <div className="flex gap-2 mb-4">
                <Link href="/rankings">
                  <Badge variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 cursor-pointer transition-colors">STEAL</Badge>
                </Link>
                <Link href="/rankings">
                  <Badge variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer transition-colors">VALUE</Badge>
                </Link>
                <Link href="/rankings">
                  <Badge variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 cursor-pointer transition-colors">AVOID</Badge>
                </Link>
              </div>
              <Link href="/rankings">
                <Button variant="outline" size="sm" className="w-full">
                  Find Values <Target className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* League Comparison */}
          <Card className="hover:shadow-lg transition-shadow border-0 bg-white/60 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Users className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">League Analysis</CardTitle>
                  <CardDescription>Multi-platform sync and comparison</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Sync with Sleeper, ESPN, Yahoo leagues. Compare team values, 
                identify the strongest rosters, and find trade opportunities.
              </p>
              <Link href="/compare-league">
                <Button variant="outline" size="sm" className="w-full">
                  Compare Leagues <BarChart3 className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Advanced Analytics */}
          <Card className="hover:shadow-lg transition-shadow border-0 bg-white/60 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Activity className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">NFL Analytics</CardTitle>
                  <CardDescription>Real NFL data integration</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Target share, snap share, YPRR, and advanced metrics from 
                authentic NFL data sources. Fantasy production meets real analytics.
              </p>
              <div className="flex gap-2 mb-4">
                <Link href="/rankings?tab=search">
                  <Badge variant="outline" className="text-xs hover:bg-gray-50 cursor-pointer transition-colors">Target Share</Badge>
                </Link>
                <Link href="/rankings?tab=search">
                  <Badge variant="outline" className="text-xs hover:bg-gray-50 cursor-pointer transition-colors">YPRR</Badge>
                </Link>
                <Link href="/rankings?tab=search">
                  <Badge variant="outline" className="text-xs hover:bg-gray-50 cursor-pointer transition-colors">Snap %</Badge>
                </Link>
              </div>
              <Link href="/rankings">
                <Button variant="outline" size="sm" className="w-full">
                  <Zap className="mr-2 h-4 w-4" />
                  View Analytics
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Data Integrity */}
          <Card className="hover:shadow-lg transition-shadow border-0 bg-white/60 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Shield className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Authentic Data</CardTitle>
                  <CardDescription>No mock or placeholder data</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Built on authentic sources: Proprietary statistical analysis, KTC values, 
                FantasyCalc trades, and real NFL statistics. No synthetic data.
              </p>
              <div className="flex gap-2 mb-4">
                <Badge variant="outline" className="text-xs">Proprietary Analysis</Badge>
                <Badge variant="outline" className="text-xs">KTC</Badge>
                <Badge variant="outline" className="text-xs">NFL Data</Badge>
              </div>
              <Link href="/rankings">
                <Button variant="outline" size="sm" className="w-full">
                  <Shield className="mr-2 h-4 w-4" />
                  View Sources
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Dominate Your Dynasty League?
            </h2>
            <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
              Join thousands of fantasy managers using advanced analytics 
              to build championship rosters and find market inefficiencies
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/rankings">
                <Button size="lg" variant="secondary" className="px-8 py-3 text-lg">
                  Start Analyzing
                  <LineChart className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/compare-league">
                <Button size="lg" variant="outline" className="px-8 py-3 text-lg border-white text-white hover:bg-white hover:text-blue-600">
                  Sync Your League
                  <Users className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
            <div className="mt-8">
              <Link href="/about">
                <Button variant="link" className="text-white/80 hover:text-white underline">
                  Learn About Our Mission • Support Free Fantasy Data
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Data Attribution Footer */}
      <DataAttributionFooter />
    </div>
  );
}