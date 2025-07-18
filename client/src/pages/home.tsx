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
      {/* Main Banner/Header */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
          {/* Site Title & Navigation */}
          <header className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
              Signal
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8">
              Fantasy Data Meets Real Insight
            </p>
            
            {/* Main Navigation Menu */}
            <nav className="flex flex-wrap justify-center gap-4 mb-8">
              <Link href="/">
                <Button variant="ghost" className="text-gray-700 hover:text-blue-600">
                  Home
                </Button>
              </Link>
              <Link href="/rankings">
                <Button variant="ghost" className="text-gray-700 hover:text-blue-600">
                  Rankings
                </Button>
              </Link>
              <Link href="/analytics">
                <Button variant="ghost" className="text-gray-700 hover:text-blue-600">
                  Analytics
                </Button>
              </Link>
              <Link href="/trade-evaluator">
                <Button variant="ghost" className="text-gray-700 hover:text-blue-600">
                  Trade Evaluator
                </Button>
              </Link>
              <Link href="/oasis">
                <Button variant="ghost" className="text-gray-700 hover:text-blue-600">
                  OASIS
                </Button>
              </Link>

            </nav>
          </header>
        </div>
      </div>

      {/* Primary Feature Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200 p-4 mb-4">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
              <Trophy className="h-6 w-6 text-blue-600" />
              Redraft Rankings
            </h2>
            <p className="text-gray-600 text-base">
              Current season insights with live NFL data and redraft valuations
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <div className="text-xl font-bold text-blue-600">1000+</div>
              <div className="text-xs text-gray-600">Players Analyzed</div>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <div className="text-xl font-bold text-green-600">Live</div>
              <div className="text-xs text-gray-600">NFL Data</div>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <div className="text-xl font-bold text-purple-600">4</div>
              <div className="text-xs text-gray-600">Positions</div>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <div className="text-xl font-bold text-orange-600">2024</div>
              <div className="text-xs text-gray-600">Season Data</div>
            </div>
          </div>
          
          <div className="text-center">
            <Link href="/rankings">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                <Trophy className="mr-2 h-5 w-5" />
                View Redraft Rankings
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Secondary Section - Advanced Analytics */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200 p-4 mb-4">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
              <BarChart3 className="h-6 w-6 text-green-600" />
              Advanced Analytics
            </h2>
            <p className="text-gray-600 text-base">
              Comprehensive NFL player analytics with dropdown tabs for all positions
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <div className="text-xl font-bold text-green-600">164</div>
              <div className="text-xs text-gray-600">Wide Receivers</div>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <div className="text-xl font-bold text-blue-600">114</div>
              <div className="text-xs text-gray-600">Running Backs</div>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <div className="text-xl font-bold text-purple-600">68</div>
              <div className="text-xs text-gray-600">Quarterbacks</div>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <div className="text-xl font-bold text-orange-600">95</div>
              <div className="text-xs text-gray-600">Tight Ends</div>
            </div>
          </div>
          
          <div className="text-center">
            <Link href="/analytics">
              <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white px-8">
                <BarChart3 className="mr-2 h-5 w-5" />
                Access Analytics Tables
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Third Section - Trade Evaluator */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200 p-4 mb-4">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
              <Activity className="h-6 w-6 text-purple-600" />
              Trade Evaluator
            </h2>
            <p className="text-gray-600 text-base">
              Evaluate dynasty trades with advanced player valuation models
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <div className="text-base font-bold text-purple-600">Dynasty Values</div>
              <div className="text-xs text-gray-600">Age-adjusted scoring</div>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <div className="text-base font-bold text-blue-600">Market ADP</div>
              <div className="text-xs text-gray-600">Real draft data</div>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <div className="text-base font-bold text-green-600">Value Analysis</div>
              <div className="text-xs text-gray-600">Win/lose assessment</div>
            </div>
          </div>
          
          <div className="text-center">
            <Link href="/trade-evaluator">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white px-8">
                <Activity className="mr-2 h-5 w-5" />
                Launch Trade Evaluator
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Additional Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Additional Tools
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Dynasty Rankings - Combined */}
          <Card className="hover:shadow-lg transition-shadow border-0 bg-gradient-to-br from-purple-50 to-blue-50 backdrop-blur-sm ring-2 ring-purple-200">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Dynasty Rankings</CardTitle>
                  <CardDescription className="text-sm">Long-term player valuations for dynasty leagues</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-gray-600 mb-3 text-sm">
                Simplified long-term player valuation engine blending production, opportunity, age, and stability. Designed for dynasty fantasy football players seeking consistent process-driven rankings.
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Link href="/rankings" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      View Dynasty Rankings <Trophy className="ml-2 h-3 w-3" />
                    </Button>
                  </Link>
                  <Link href="/enhanced-dynasty" className="flex-1">
                    <Button className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-xs" size="sm">
                      Enhanced View <Zap className="ml-2 h-3 w-3" />
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

          {/* Signal Benchmark Cluster */}
          <Card className="hover:shadow-lg transition-shadow border-0 bg-gradient-to-br from-amber-50 to-orange-50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Trophy className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Elite Benchmarks</CardTitle>
                  <CardDescription>Signal analytics cluster</CardDescription>
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
                  <CardTitle className="text-lg">WR Analytics</CardTitle>
                  <CardDescription>Wide Receiver Usage & Efficiency</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Comprehensive wide receiver advanced statistics including YPRR, target share, 
                air yards share, and efficiency metrics from 2024 NFL data.
              </p>
              <div className="flex gap-2 mb-4">
                <Badge variant="outline" className="text-xs">YPRR</Badge>
                <Badge variant="outline" className="text-xs">Target Share</Badge>
                <Badge variant="outline" className="text-xs">Air Yards</Badge>
              </div>
              <Link href="/analytics/wide-receivers">
                <Button variant="outline" size="sm" className="w-full">
                  <Zap className="mr-2 h-4 w-4" />
                  View WR Analytics
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

      {/* Footer Section */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Philosophy/About */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Philosophy</h3>
              <p className="text-gray-300 mb-4">
                Fantasy Data Meets Real Insight. Built for community creativity and data accessibility.
              </p>
              <Link href="/about">
                <Button variant="link" className="text-blue-400 hover:text-blue-300 p-0">
                  Read Our Mission <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
            
            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <div className="space-y-2">
                <div>
                  <Link href="/rankings">
                    <Button variant="link" className="text-gray-300 hover:text-white p-0">
                      Player Rankings
                    </Button>
                  </Link>
                </div>
                <div>
                  <Link href="/analytics">
                    <Button variant="link" className="text-gray-300 hover:text-white p-0">
                      Advanced Analytics
                    </Button>
                  </Link>
                </div>
                <div>
                  <Link href="/trade-evaluator">
                    <Button variant="link" className="text-gray-300 hover:text-white p-0">
                      Trade Evaluator
                    </Button>
                  </Link>
                </div>
                <div>
                  <Link href="/oasis">
                    <Button variant="link" className="text-gray-300 hover:text-white p-0">
                      OASIS Team Context
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
            
            {/* Contact/Info */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Information</h3>
              <div className="space-y-2">
                <div>
                  <Link href="/data-sources">
                    <Button variant="link" className="text-gray-300 hover:text-white p-0">
                      Data Sources
                    </Button>
                  </Link>
                </div>
                <div>
                  <Link href="/community-posts">
                    <Button variant="link" className="text-gray-300 hover:text-white p-0">
                      Community Posts
                    </Button>
                  </Link>
                </div>
                <div className="text-gray-400 text-sm mt-4">
                  Built for the community, designed as a resource.
                </div>
              </div>
            </div>
            
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center">
            <p className="text-gray-400 text-sm">
              © 2025 Signal Fantasy Football. Dynasty and redraft.
            </p>
          </div>
        </div>
      </footer>

      {/* Data Attribution Footer */}
      <DataAttributionFooter />
    </div>
  );
}