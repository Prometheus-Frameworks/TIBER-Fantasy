import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Target, 
  Users, 
  TrendingUp,
  Settings,
  Upload,
  ThumbsUp,
  Bug,
  Share2,
  Clock
} from "lucide-react";

export default function HowYouCanContribute() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              How You Can Contribute
            </h1>
          </div>
        </div>

        {/* Welcome Message */}
        <Card className="mb-12 border-0 bg-white/60 backdrop-blur-sm shadow-xl">
          <CardContent className="p-8">
            <p className="text-xl text-gray-700 leading-relaxed text-center mb-4">
              Welcome to On The Clock.
            </p>
            <p className="text-xl text-gray-700 leading-relaxed text-center font-medium">
              If you're reading this, you're not just a visitor — you're part of the build.
            </p>
          </CardContent>
        </Card>

        {/* Current Goals */}
        <Card className="mb-12 border-0 bg-gradient-to-r from-orange-50 to-red-50 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-orange-500" />
              <CardTitle className="text-2xl">🚧 Current Goals (Updated Live):</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-white/80 rounded-lg border border-orange-200">
                <span className="text-lg font-medium text-gray-800">1.</span>
                <span className="text-lg text-gray-700">Community Rankings System – Testing & Feedback</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white/80 rounded-lg border border-orange-200">
                <span className="text-lg font-medium text-gray-800">2.</span>
                <span className="text-lg text-gray-700">Trade Evaluator Improvements – Real User Feedback</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white/80 rounded-lg border border-orange-200">
                <span className="text-lg font-medium text-gray-800">3.</span>
                <span className="text-lg text-gray-700">Custom Player Pages Launch</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-gray-600 italic">*This list updates as goals are completed.*</p>
            </div>
          </CardContent>
        </Card>

        {/* Ways to Contribute */}
        <Card className="mb-12 border-0 bg-gradient-to-r from-blue-50 to-purple-50 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6 text-blue-500" />
              <CardTitle className="text-2xl">🛠️ Ways to Contribute:</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-white/80 rounded-lg border border-blue-200">
                <Upload className="h-5 w-5 text-blue-500" />
                <span className="text-gray-700">Upload your personal rankings (Dynasty & Redraft)</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/80 rounded-lg border border-blue-200">
                <ThumbsUp className="h-5 w-5 text-green-500" />
                <span className="text-gray-700">Upvote rankings you trust</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/80 rounded-lg border border-blue-200">
                <Bug className="h-5 w-5 text-red-500" />
                <span className="text-gray-700">Report bugs or suggest features</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/80 rounded-lg border border-blue-200">
                <Share2 className="h-5 w-5 text-purple-500" />
                <span className="text-gray-700">Share the site — or keep it your secret. Your call.</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Why It Matters */}
        <Card className="mb-12 border-0 bg-gradient-to-r from-slate-50 to-gray-50 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-indigo-500" />
              <CardTitle className="text-2xl">📈 Why It Matters:</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-lg text-gray-700 leading-relaxed text-center">
              Every ranking, every upvote, every idea transforms and shapes. It's important to know: you might be on the clock... but we are only the community
            </p>
            
            <div className="text-center space-y-2">
              <p className="text-xl text-gray-800 font-medium">This isn't just a site.</p>
              <p className="text-xl text-gray-800 font-medium">It's a system.</p>
              <p className="text-xl text-gray-800 font-bold">And you're helping build it.</p>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}