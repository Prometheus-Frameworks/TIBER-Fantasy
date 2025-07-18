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
import SignalFooter from "@/components/signal-footer";

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
              Signal
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
              <p className="text-lg text-gray-700 leading-relaxed">
                We want to make the hard stuff simple. We build tools, apply context wherever we can, and always aim to involve as many real-life fantasy players as possible. If you're interested in learning, read more. This site is launched, but not finished. We intend to stay that way. Genius doesn't stand still.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Help Us Build (And Keep It Fair) */}
        <Card className="mb-12 border-0 bg-gradient-to-r from-blue-50 to-purple-50 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-blue-500" />
              <CardTitle className="text-2xl">Help Us Build (And Keep It Fair)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white/80 p-6 rounded-lg border border-blue-200 space-y-4">
              <p className="text-lg text-gray-700 leading-relaxed">
                This project isn't about paywalls or profit. It's about open tools, honest insights, and building something together. If you're curious or want to help, contribute anytime. Every tool we build is made better by the people who use it.
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
            <p className="text-lg text-gray-700 leading-relaxed">
              This project is proof that ordinary people can do extraordinary things. Fantasy football is just the start. We're proving that knowledge belongs to everyone. If you're reading this, you're already part of the movement.
            </p>
          </CardContent>
        </Card>

        {/* Haha, Here's the Genius! */}
        <Card className="mb-12 border-0 bg-gradient-to-r from-green-50 to-emerald-50 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-green-500" />
              <CardTitle className="text-2xl">Haha, Here's the Genius!</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white/80 p-6 rounded-lg border border-green-200 space-y-4">
              <p className="text-lg text-gray-700 leading-relaxed">
                Well… if you think you're so smart, why don't you come on in and make things better? In fact — I could really use the help. No, seriously: Join Us.
              </p>
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
                <strong>Remember:</strong> Signal will always be free. Donations simply help us expand data sources 
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

        {/* Join Us Section */}
        <div className="text-center mt-12 space-y-4">
          <h3 className="text-2xl font-semibold text-gray-800">Join Us</h3>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Signal is more than analytics — it's a community of fantasy managers who believe in accessible, 
            transparent data. Whether you're sharing insights, contributing ideas, or just exploring what's possible 
            when barriers come down, you belong here.
          </p>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Ready to be part of something bigger? We're building the future of fantasy football together.
          </p>
          <div className="mt-6">
            <a href="/how-you-can-contribute" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-medium rounded-lg hover:from-green-600 hover:to-blue-600 transition-all duration-200 shadow-lg hover:shadow-xl">
              <Users className="h-5 w-5" />
              How You Can Contribute
            </a>
          </div>
        </div>

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
      
      {/* Signal Footer */}
      <SignalFooter />
    </div>
  );
}