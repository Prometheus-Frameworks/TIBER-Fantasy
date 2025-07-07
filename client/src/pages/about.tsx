import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Heart, 
  Shield, 
  Users, 
  Database, 
  BarChart3,
  Coffee,
  DollarSign,
  Star,
  Target,
  Eye
} from "lucide-react";
import DataAttributionFooter from "@/components/data-attribution-footer";
import { ViewSourcesModal } from "@/components/view-sources-modal";

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              Prometheus
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Bringing the fire of knowledge to fantasy football managers everywhere
          </p>
        </div>

        {/* Mission Statement */}
        <Card className="mb-12 border-0 bg-white/60 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-orange-500" />
              <CardTitle className="text-2xl">Our Mission</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-lg border border-orange-200">
              <p className="text-xl font-semibold text-gray-800 leading-relaxed mb-4">
                <strong>"This is the best you can get for free. Trust me."</strong>
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                We refuse to compromise on our core belief: elite fantasy analytics should not be locked behind paywalls. 
                While others charge premium subscriptions for advanced data, Prometheus delivers the highest quality dynasty rankings, 
                player analytics, and market insights available—completely free.
              </p>
            </div>
            <p className="text-gray-600">
              We've built our platform using authentic NFL data, proprietary statistical algorithms, and comprehensive multi-year analysis 
              to ensure you're getting professional-grade insights without paying a cent. No hidden tiers, no premium upgrades, 
              no "upgrade to see more" buttons—just the best free fantasy data available anywhere.
            </p>
            <p className="text-gray-600">
              Like Prometheus stealing fire from the gods, we believe transformative knowledge belongs in the hands of the people, 
              not locked away by those who can afford it. Every insight shared freely makes our entire community stronger.
            </p>
            <div className="flex flex-wrap gap-2 pt-4">
              <Badge variant="secondary" className="bg-orange-100 text-orange-700">Democratized Knowledge</Badge>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">Community Strengthening</Badge>
              <Badge variant="secondary" className="bg-green-100 text-green-700">Data as Human Right</Badge>
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">Forever Open</Badge>
            </div>
          </CardContent>
        </Card>

        {/* What We Provide */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card className="border-0 bg-white/60 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-lg">Authentic Data</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Real NFL statistics, player analytics, and dynasty valuations sourced from authentic APIs. 
                No mock data, no placeholders - just the real insights you need.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white/60 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-green-500" />
                <CardTitle className="text-lg">Advanced Analytics</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Research-backed dynasty rankings, market inefficiency detection, and proprietary 
                algorithms that help you find undervalued players and build championship teams.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white/60 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-purple-500" />
                <CardTitle className="text-lg">Legal & Ethical</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                All rankings and insights are derived from publicly available NFL data and our own 
                statistical analysis. No copyrighted expert opinions or unauthorized content.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white/60 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-lg">Community First</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Built by fantasy managers, for fantasy managers. Every feature is designed to solve 
                real problems faced by dynasty league participants and competitive players.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Support Section */}
        <Card className="border-0 bg-gradient-to-r from-orange-50 to-red-50 shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Heart className="h-6 w-6 text-red-500" />
              <CardTitle className="text-2xl">Support Our Mission</CardTitle>
              <CardDescription className="text-base mt-2">
                Help us keep advanced fantasy data free for everyone
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-white/80 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                The Reality: Data Costs Add Up
              </h3>
              <div className="text-gray-600 space-y-2">
                <p>• <strong>NFL-Data-Py API:</strong> Advanced Next Gen Stats, target share analytics, and efficiency metrics</p>
                <p>• <strong>SportsDataIO:</strong> Real-time player data, injury reports, and projections ($200+/month)</p>
                <p>• <strong>Sleeper API:</strong> League synchronization and roster management integration</p>
                <p>• <strong>PostgreSQL hosting:</strong> Reliable database infrastructure for historical trends</p>
                <p>• <strong>Server costs:</strong> Fast, scalable hosting to keep the platform responsive</p>
              </div>
              <p className="text-sm text-gray-500 mt-4 italic">
                Professional fantasy data subscriptions elsewhere cost $100-300+ annually. We're committed to keeping this free.
              </p>
            </div>

            <div className="bg-white/80 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Coffee className="h-5 w-5 text-orange-500" />
                How You Can Help
              </h3>
              <p className="text-gray-600 mb-4">
                Every contribution helps us maintain free access to advanced fantasy analytics. 
                Whether it's the cost of a coffee or a premium subscription elsewhere, your support 
                directly funds data access and server costs.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Button variant="outline" className="h-20 flex flex-col gap-2 hover:bg-orange-50">
                  <Coffee className="h-5 w-5" />
                  <span className="font-medium">$5</span>
                  <span className="text-xs text-gray-500">Coffee Fund</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col gap-2 hover:bg-blue-50 ring-2 ring-blue-200">
                  <Star className="h-5 w-5" />
                  <span className="font-medium">$25</span>
                  <span className="text-xs text-gray-500">Data Supporter</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col gap-2 hover:bg-purple-50">
                  <Zap className="h-5 w-5" />
                  <span className="font-medium">$50</span>
                  <span className="text-xs text-gray-500">MVP Patron</span>
                </Button>
              </div>
              
              <p className="text-sm text-gray-500 mt-4 text-center">
                Secure payments via PayPal or Venmo • No recurring charges • 100% optional
              </p>
            </div>

            <div className="text-center space-y-4">
              <p className="text-gray-600 mb-4">
                <strong>Remember:</strong> Prometheus will always be free. Donations simply help us expand data sources 
                and add more advanced features for the entire community.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                >
                  <Heart className="mr-2 h-5 w-5" />
                  Support the Mission
                </Button>
                
                <ViewSourcesModal>
                  <Button variant="outline" size="lg" className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    View Data Sources
                  </Button>
                </ViewSourcesModal>
              </div>

              <p className="text-xs text-gray-500 italic">
                Full transparency: See exactly where our data comes from and how we ensure compliance
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <div className="text-center mt-12 space-y-4">
          <h3 className="text-xl font-semibold text-gray-800">Questions or Feedback?</h3>
          <p className="text-gray-600">
            We're always looking to improve and add features that matter to fantasy managers.
          </p>
          <Button variant="outline">
            Get in Touch
          </Button>
        </div>
      </div>

      <DataAttributionFooter />
    </div>
  );
}