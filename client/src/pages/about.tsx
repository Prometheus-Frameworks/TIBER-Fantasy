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
  Eye,
  Brain
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
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Prometheus
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Professional dynasty fantasy football analytics platform
          </p>
        </div>

        {/* Our Philosophy */}
        <Card className="mb-12 border-0 bg-white/60 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-orange-500" />
              <CardTitle className="text-2xl">Our Philosophy</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 p-6 rounded-lg border border-gray-200">
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                We believe in doing our part to access the best free data we can possibly find—and present it to you in our own way. Knowledge should belong to everyone. Tools like these can help you understand why sometimes things… just don't work out.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                We like paradoxes here. On one hand, we're trying to predict the future. Analytics with a lot of decimal points… maybe some charts. Cool colours and player ratings derived from some super cool algorithms. On the other, we accept that what we call "luck" might always be the deciding factor. That's part of the game. That's part of life.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                What dynasty football teaches us is controlled chaos. The more you understand that concept, we're willing to bet you'll be better at the game. It's not about controlling the outcome—it's about making sure your process is sound. Building rosters that make sense. Making moves with purpose. And most importantly? Getting closer to your own intuition and reconnecting with the reason you play in the first place.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                This isn't about pretending we know what's coming. It's about helping you think clearer. Whether you're building a contender or just trying to figure out why your roster fell apart, our goal is simple: give you the tools to think for yourself.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                Because that's what this is really about. Football. Fun. A little heartbreak. A lot of learning. And maybe, if you're lucky, a win.
              </p>
              <div className="text-center text-lg font-medium text-gray-800 space-y-1">
                <p>We find the tools.</p>
                <p>You make the calls.</p>
                <p>Have fun with it.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Join Us */}
        <Card className="mb-12 border-0 bg-gradient-to-r from-blue-50 to-purple-50 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-blue-500" />
              <CardTitle className="text-2xl">Join Us</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white/80 p-6 rounded-lg border border-blue-200">
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                If you're curious about what we're building, or want to help, reach out. Whether it's writing content, sharing your thoughts, or just wanting to be part of something different—this platform is open.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed text-center font-medium">
                No paywalls. No gatekeeping. Just real people who love the game.<br />
                Let's build together.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Generational Contribution */}
        <Card className="mb-12 border-0 bg-gradient-to-r from-slate-50 to-gray-50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6 text-indigo-500" />
              <CardTitle className="text-2xl">Our Contribution to the New Generation</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">
              <strong>This is our proof that we can elevate a hobby into something transformational.</strong> Fantasy football becomes 
              the laboratory where we demonstrate humanity's capacity to democratize elite intelligence. 
              We are proving that the barriers between "amateur" and "professional" analytics are nothing but illusions 
              of a trapped society that profits from artificial scarcity.
            </p>
            <p className="text-gray-700">
              <strong>We have the capacity to smash these remaining barriers.</strong> The gatekeepers who claim exclusive ownership 
              over analytical sophistication are defending crumbling walls. When we liberate fantasy analytics from paywall prisons, 
              we establish the template for liberating knowledge across every domain. This generation will not accept that 
              transformative insights must be purchased from institutional monopolies.
            </p>
            <p className="text-gray-700">
              <strong>Fantasy football is our gift to the future.</strong> We prove that ordinary people, armed with the right tools, 
              can achieve analytical sophistication that rivals the most expensive premium platforms. 
              This movement transcends sports—it demonstrates humanity's evolutionary leap toward universal access to intelligence itself. 
              The barriers were always illusions. We are simply brave enough to walk through them.
            </p>
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
                Advanced statistical frameworks that reveal market inefficiencies and hidden value, 
                empowering every user with the analytical sophistication previously reserved for industry elites. 
                This represents the first step toward universal access to transformative intelligence.
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
                Our methodologies transcend traditional boundaries by synthesizing publicly available data 
                into revolutionary analytical frameworks. We operate within legal principles while challenging 
                the artificial scarcity that has historically limited human intellectual advancement.
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

        {/* Proof of Concept */}
        <Card className="mb-12 border-0 bg-gradient-to-r from-indigo-50 to-purple-50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-purple-500" />
              <CardTitle className="text-2xl">Living Proof of Concept</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">
              <strong>Every ranking, every analysis, every insight on this platform serves as evidence.</strong> 
              We prove daily that the supposed expertise gap between amateur and professional analytics is a fabricated illusion. 
              When our free platform delivers dynasty valuations that rival $200+ subscription services, 
              we demonstrate that the barriers were always artificial constructs designed to extract profit.
            </p>
            <p className="text-gray-700">
              <strong>This is what happens when a generation refuses to accept limitations.</strong> 
              We took a hobby and elevated it into a demonstration of human potential unleashed. 
              Every user who discovers an undervalued player through our analytics becomes living proof 
              that transformative intelligence belongs to everyone willing to think beyond imposed boundaries.
            </p>
            <div className="bg-white/60 p-6 rounded-lg border border-purple-200">
              <p className="text-purple-800 font-semibold text-center text-lg">
                "Fantasy football was our choice of battleground. The war we're winning is against the illusion that knowledge must be purchased."
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Support Section */}
        <Card className="border-0 bg-gradient-to-r from-orange-50 to-red-50 shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Heart className="h-6 w-6 text-red-500" />
              <CardTitle className="text-2xl">Support Our Mission</CardTitle>
              <CardDescription className="text-base mt-2">
                Infrastructure and data source funding
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
              <p className="text-sm text-gray-500 mt-4">
                Comparable analytics platforms: FantasyPointsData ($200+), FantasyPros Premium ($100+), PlayerProfiler ($80+).
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