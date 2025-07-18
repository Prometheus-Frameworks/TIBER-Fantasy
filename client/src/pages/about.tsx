import { useState } from "react";
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
  Brain,
  ChevronRight,
  Sparkles
} from "lucide-react";
import DataAttributionFooter from "@/components/data-attribution-footer";
import { ViewSourcesModal } from "@/components/view-sources-modal";
import SignalFooter from "@/components/signal-footer";

export default function About() {
  const [revealedSteps, setRevealedSteps] = useState<number>(0);

  const revealNextStep = () => {
    setRevealedSteps(prev => prev + 1);
  };

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

        {/* Step 1: Our Philosophy */}
        <Card className="mb-12 border-0 bg-white/60 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-orange-500" />
              <CardTitle className="text-2xl">Our Philosophy</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {revealedSteps >= 1 && (
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 p-6 rounded-lg border border-gray-200 animate-in slide-in-from-top-4 duration-500">
                <p className="text-lg text-gray-700 leading-relaxed">
                  We want to make the hard stuff simple. We build tools, apply context wherever we can, and always aim to involve as many real-life fantasy players as possible. If you're interested in learning, read more. This site is launched, but not finished. We intend to stay that way. Genius doesn't stand still.
                </p>
              </div>
            )}
            {revealedSteps === 0 && (
              <div className="text-center">
                <Button 
                  onClick={revealNextStep}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Read More
                </Button>
              </div>
            )}
            {revealedSteps === 1 && (
              <div className="text-center mt-4">
                <Button 
                  onClick={revealNextStep}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <ChevronRight className="h-4 w-4 mr-2" />
                  Next: Help Us Build
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Help Us Build */}
        {revealedSteps >= 2 && (
          <Card className="mb-12 border-0 bg-gradient-to-r from-blue-50 to-purple-50 backdrop-blur-sm shadow-xl animate-in slide-in-from-top-4 duration-500">
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
              {revealedSteps === 2 && (
                <div className="text-center mt-4">
                  <Button 
                    onClick={revealNextStep}
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <ChevronRight className="h-4 w-4 mr-2" />
                    Next: Our Contribution
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Our Contribution */}
        {revealedSteps >= 3 && (
          <Card className="mb-12 border-0 bg-gradient-to-r from-slate-50 to-gray-50 backdrop-blur-sm shadow-xl animate-in slide-in-from-top-4 duration-500">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Brain className="h-6 w-6 text-indigo-500" />
                <CardTitle className="text-2xl">Our Contribution</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg text-gray-700 leading-relaxed">
                This project is proof that ordinary people can do extraordinary things. Fantasy football is just the start. We're proving that knowledge belongs to everyone. If you're reading this, you're already part of the movement.
              </p>
              {revealedSteps === 3 && (
                <div className="text-center mt-4">
                  <Button 
                    onClick={revealNextStep}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Final Step: Haha, Here's the Genius!
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Haha, Here's the Genius! */}
        {revealedSteps >= 4 && (
          <Card className="mb-12 border-0 bg-gradient-to-r from-green-50 to-emerald-50 backdrop-blur-sm shadow-xl animate-in slide-in-from-top-4 duration-500">
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
              <div className="text-center mt-6">
                <a href="/how-you-can-contribute" className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-semibold rounded-lg hover:from-green-600 hover:to-blue-600 transition-all duration-200 shadow-lg hover:shadow-xl">
                  <Users className="h-5 w-5" />
                  Join Us
                </a>
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      <DataAttributionFooter />
      
      {/* Signal Footer */}
      <SignalFooter />
    </div>
  );
}