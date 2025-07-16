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
import { useEffect } from "react";

export default function Home() {
  // Function to randomize button colors for organic feel
  useEffect(() => {
    const randomizeButtonColors = () => {
      const baseColors = {
        blue: '#3399ff',
        green: '#2e8b57',
        teal: '#20b2aa',
        purple: '#8a4fff',
        white: '#e0e0e0'
      };

      const buttons = document.querySelectorAll('.button');
      buttons.forEach((button) => {
        const colorClass = Array.from(button.classList).find(cls => 
          Object.keys(baseColors).includes(cls)
        );
        
        if (colorClass && baseColors[colorClass]) {
          const baseColor = baseColors[colorClass];
          const randomizedColor = randomizeHexColor(baseColor, 0.03); // ±3%
          button.style.backgroundColor = randomizedColor;
        }
      });
    };

    const randomizeHexColor = (hexColor, variance) => {
      const hex = hexColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      const randomizeChannel = (channel) => {
        const variation = Math.random() * variance * 2 - variance; // ±variance
        const newValue = Math.round(channel * (1 + variation));
        return Math.max(0, Math.min(255, newValue));
      };
      
      const newR = randomizeChannel(r);
      const newG = randomizeChannel(g);
      const newB = randomizeChannel(b);
      
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    };

    // Apply randomization after component mounts
    setTimeout(randomizeButtonColors, 100);
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <header className="homepage-header text-center mb-8">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
              Prometheus Fantasy
            </h1>
            <p className="text-xl md:text-2xl text-gray-600">
              Built for Community. Designed as a Resource.
            </p>
          </header>
          
          <div className="button-row">
            <a href="/rankings" className="button blue">Explore Rankings</a>
            <a href="/oasis" className="button teal">OASIS</a>
            <a href="/draft-room" className="button purple">Draft Helper (Beta)</a>
            <a href="/community-posts" className="button white">Community Posts</a>
          </div>

          <div className="sync-block">
            <a href="/sync-leagues" className="button sync-button">Sync Your Leagues</a>
          </div>
          
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto text-center">
            <Link href="/rankings">
              <div className="text-center p-4 bg-white/50 rounded-lg backdrop-blur-sm hover:bg-white/70 transition-colors cursor-pointer">
                <div className="text-2xl font-bold text-blue-600">1000+</div>
                <div className="text-sm text-gray-600">Players Analyzed</div>
              </div>
            </Link>
            <Link href="/adp">
              <div className="text-center p-4 bg-white/50 rounded-lg backdrop-blur-sm hover:bg-white/70 transition-colors cursor-pointer">
                <div className="text-2xl font-bold text-green-600">12,847+</div>
                <div className="text-sm text-gray-600">Live ADP Drafts</div>
              </div>
            </Link>
            <Link href="/compare-league">
              <div className="text-center p-4 bg-white/50 rounded-lg backdrop-blur-sm hover:bg-white/70 transition-colors cursor-pointer">
                <div className="text-2xl font-bold text-purple-600">3</div>
                <div className="text-sm text-gray-600">Platforms Synced</div>
              </div>
            </Link>
            <Link href="/data-sources">
              <div className="text-center p-4 bg-white/50 rounded-lg backdrop-blur-sm hover:bg-white/70 transition-colors cursor-pointer">
                <div className="text-2xl font-bold text-orange-600">Live</div>
                <div className="text-sm text-gray-600">NFL Data</div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Dynasty Analytics Suite
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Market value analysis, player profiling, and statistical modeling for dynasty league management.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Dynasty Rankings - Combined */}
          <Card className="hover:shadow-lg transition-shadow border-0 bg-gradient-to-br from-purple-50 to-blue-50 backdrop-blur-sm ring-2 ring-purple-200">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">Dynasty Rankings</CardTitle>
                  <CardDescription>Enhanced v2.0 with research-based exponential scaling</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Next-generation analytical framework with proprietary scoring models, 
                sophisticated tier classification system, and comprehensive player evaluation algorithms 
                to identify elite prospects and undervalued assets.
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Link href="/rankings" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      View Rankings <Trophy className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/enhanced-dynasty" className="flex-1">
                    <Button className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600" size="sm">
                      Enhanced Algorithm <Zap className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>

              </div>
            </CardContent>
          </Card>

          {/* Live ADP Data - Separate Section */}
          <Card className="hover:shadow-lg transition-shadow border-0 bg-gradient-to-br from-green-50 to-emerald-50 backdrop-blur-sm ring-2 ring-green-200">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    Live ADP Data
                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                      NEW
                    </Badge>
                  </CardTitle>
                  <CardDescription>Real draft data from dynasty leagues</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                See where players are being drafted in real dynasty leagues. Josh Allen goes #1, 
                Lamar Jackson #2, and top rookies in the first round.
              </p>
              <Link href="/adp" className="w-full">
                <Button size="sm" className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  View Live ADP Rankings
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
                Look up any player to see their stats and dynasty ranking.
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
                Find players worth more than their draft position suggests.
              </p>
              <div className="flex gap-2 mb-4">
                <Badge variant="outline" className="text-green-600 border-green-200">STEAL</Badge>
                <Badge variant="outline" className="text-blue-600 border-blue-200">VALUE</Badge>
                <Badge variant="outline" className="text-red-600 border-red-200">AVOID</Badge>
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
                  <CardDescription>Currently supports Sleeper leagues</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Connect your Sleeper league to see how your team stacks up.
              </p>
              <Link href="/compare-league">
                <Button variant="outline" size="sm" className="w-full">
                  Compare Leagues <BarChart3 className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Prometheus Benchmark Cluster */}
          <Card className="hover:shadow-lg transition-shadow border-0 bg-gradient-to-br from-amber-50 to-orange-50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Trophy className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Elite Benchmarks</CardTitle>
                  <CardDescription>Prometheus analytics cluster</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Advanced analytics from Chase, Barkley, Lamar, and Allen. Elite thresholds for target share, spike weeks, and performance correlations.
              </p>
              <div className="flex gap-2 mb-4">
                <Badge variant="outline" className="text-xs">27.2% Target</Badge>
                <Badge variant="outline" className="text-xs">0.85 Correlation</Badge>
                <Badge variant="outline" className="text-xs">Elite Thresholds</Badge>
              </div>
              <Link href="/prometheus-benchmarks">
                <Button variant="outline" size="sm" className="w-full bg-amber-500 text-white hover:bg-amber-600 border-amber-500">
                  <Trophy className="mr-2 h-4 w-4" />
                  View Benchmarks
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
                Professional-grade analytics utilizing authentic NFL performance data, 
                advanced efficiency metrics, and proprietary statistical models for competitive insights.
              </p>
              <div className="flex gap-2 mb-4">
                <Badge variant="outline" className="text-xs">Target Share</Badge>
                <Badge variant="outline" className="text-xs">YPRR</Badge>
                <Badge variant="outline" className="text-xs">Snap %</Badge>
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
                Enterprise-grade data foundation utilizing proprietary analytical models, 
                real market transactions, and authentic NFL performance metrics for reliable insights.
              </p>
              <div className="flex gap-2 mb-4">
                <Badge variant="outline" className="text-xs">Proprietary Analysis</Badge>
                <Badge variant="outline" className="text-xs">NFL Data</Badge>
              </div>
              <Link href="/data-sources">
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
              Get the same insights the top dynasty players use to build winning teams.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/enhanced-rankings">
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