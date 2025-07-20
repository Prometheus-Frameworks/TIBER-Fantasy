import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Trophy, 
  TrendingUp, 
  Users, 
  BarChart3, 
  Target, 
  Crown,
  Brain,
  ArrowRight
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      
      {/* 1️⃣ HERO SECTION */}
      <section className="py-16 px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-6xl md:text-7xl font-bold text-slate-800 mb-4">
            ON THE CLOCK
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 mb-8">
            Fantasy football tools. Community driven.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/rankings">
              <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg">
                <Trophy className="mr-2 h-5 w-5" />
                View Rankings
              </Button>
            </Link>
            <Link href="/about">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg">
                Learn More
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50 px-8 py-3 text-lg">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2️⃣ FEATURES PREVIEW */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-12">
            Fantasy Football Tools
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-white/70 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl text-slate-700">Player Analysis</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600">
                  Comprehensive player evaluation and analytics
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/70 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-xl text-slate-700">Team Management</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600">
                  Sync and analyze your fantasy teams
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/70 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                  <Trophy className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle className="text-xl text-slate-700">Draft Tools</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-slate-600">
                  Draft preparation and analysis tools
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 3️⃣ COMMUNITY FOCUS */}
      <section className="py-12 px-4 bg-white/30">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-800 mb-6">
            Built for Community
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Open source tools designed to help fantasy football enthusiasts make better decisions together.
          </p>
          
          <Link href="/community-posts">
            <Button size="lg" variant="outline" className="border-slate-400 text-slate-700 hover:bg-slate-50">
              Join the Community
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}