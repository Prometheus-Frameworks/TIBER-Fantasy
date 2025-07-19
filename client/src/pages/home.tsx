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
import { useQuery } from "@tanstack/react-query";
import DataAttributionFooter from "@/components/data-attribution-footer";

interface ConsensusPlayer {
  playerId: number;
  playerName: string;
  position: string;
  team: string;
  consensusRank: number;
}

export default function Home() {
  // Fetch top 5 consensus rankings for preview
  const { data: consensusData, isLoading: consensusLoading } = useQuery({
    queryKey: ['/api/rankings/consensus?format=dynasty&dynastyType=contender&limit=5']
  });

  const topPlayers = consensusData?.data?.rankings?.slice(0, 5) || [];

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
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg">
                View Rankings
              </Button>
            </Link>
            <Link href="/about">
              <Button size="lg" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50 px-8 py-3 text-lg">
                Learn About Us
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2️⃣ RANKINGS SNAPSHOT */}
      <section className="py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-white/70 backdrop-blur border-0 shadow-lg">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl text-slate-700 flex items-center justify-center gap-2">
                <Crown className="h-6 w-6 text-yellow-500" />
                Consensus Top 5
              </CardTitle>
            </CardHeader>
            <CardContent>
              {consensusLoading ? (
                <div className="text-center py-8">
                  <div className="text-slate-500">Loading rankings...</div>
                </div>
              ) : topPlayers.length > 0 ? (
                <div className="space-y-3 mb-6">
                  {topPlayers.map((player: ConsensusPlayer, index: number) => (
                    <div key={player.playerId} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{player.playerName}</div>
                          <div className="text-sm text-slate-600">{player.position} - {player.team}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-slate-500">No rankings available yet</div>
                </div>
              )}
              
              <div className="text-center">
                <Link href="/rankings">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                    View Full Rankings
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 3️⃣ MICRO-MISSION BLURB */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-700 mb-6">Why We Exist</h2>
          <div className="bg-white/70 backdrop-blur rounded-2xl p-8 shadow-lg">
            <p className="text-lg text-slate-600 leading-relaxed mb-6">
              "We built On The Clock for players who wanted a better way. No fees. No gatekeeping. Just tools anyone can use."
            </p>
            <Link href="/about">
              <Button variant="outline" className="border-slate-600 text-slate-600 hover:bg-slate-50">
                Read Our Mission
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 4️⃣ CORE TOOLS SECTION */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Redraft Rankings */}
            <Link href="/rankings?format=redraft">
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group">
                <CardContent className="p-6 text-center">
                  <Trophy className="h-12 w-12 text-green-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-bold text-slate-700">Redraft Rankings</h3>
                </CardContent>
              </Card>
            </Link>

            {/* Dynasty Rankings */}
            <Link href="/rankings?format=dynasty">
              <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group">
                <CardContent className="p-6 text-center">
                  <Crown className="h-12 w-12 text-purple-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-bold text-slate-700">Dynasty Rankings</h3>
                </CardContent>
              </Card>
            </Link>

            {/* Trade Evaluator */}
            <Link href="/trade-evaluator">
              <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group">
                <CardContent className="p-6 text-center">
                  <TrendingUp className="h-12 w-12 text-orange-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-bold text-slate-700">Trade Evaluator</h3>
                </CardContent>
              </Card>
            </Link>

            {/* OASIS Team Context */}
            <Link href="/oasis">
              <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group">
                <CardContent className="p-6 text-center">
                  <Brain className="h-12 w-12 text-blue-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-bold text-slate-700">OASIS Team Context</h3>
                </CardContent>
              </Card>
            </Link>

          </div>
        </div>
      </section>

      {/* 5️⃣ FOOTER TAGLINE */}
      <section className="py-16 px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <p className="text-xl md:text-2xl text-slate-600 mb-6">
            Live NFL Data. Always Free. Built By The Community.
          </p>
          <Link href="/about">
            <Button size="lg" className="bg-slate-700 hover:bg-slate-800 text-white px-8 py-3 text-lg">
              Join Us
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Data Attribution Footer */}
      <DataAttributionFooter />
    </div>
  );
}