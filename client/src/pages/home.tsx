import GlowCard from "@/components/GlowCard";
import GlowCTA from "@/components/GlowCTA";
import TiberChat from "@/components/TiberChat";
import { Section } from "@/components/Section";
import { Trophy, Compass, Users, Sparkles, Link2, Zap } from "lucide-react";
import { Link } from "wouter";

export default function Home(){
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      {/* Hero */}
      <div className="pt-8 md:pt-12">
        <p className="text-sm uppercase tracking-widest text-gold flex items-center gap-2">
          <Trophy className="h-4 w-4" /> On The Clock
        </p>
        <h1 className="mt-2 text-4xl md:text-5xl font-semibold tracking-tight text-ink">
          Fantasy football tools. Community‑driven.
        </h1>
        <p className="mt-3 max-w-2xl text-body">
          No paywalls, just signal. Draft smarter with consensus boards and context‑aware guidance.
        </p>
        <div className="mt-6 flex gap-3">
          <GlowCTA href="/consensus">View OTC Consensus</GlowCTA>
          <Link 
            href="/sleeper-connect" 
            className="inline-flex items-center gap-2 px-6 py-2 border border-purple-300 text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition-colors"
          >
            <Link2 className="h-4 w-4" />
            Connect Sleeper
          </Link>
        </div>
      </div>

      {/* Featured Integration - Sleeper Sync */}
      <Section 
        title="🚀 NEW: Sleeper Integration" 
        action={<span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Live</span>} 
      />
      <div className="mb-8">
        <div className="relative bg-gradient-to-br from-purple-50 to-gold-50 border border-purple-200 rounded-lg p-6 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100/50 to-gold-100/50 rounded-full blur-2xl -z-10"></div>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Sync Your Sleeper Leagues</h3>
              <p className="text-gray-600 mb-4">
                Connect your Sleeper account to access league rosters, make informed trades, and get personalized insights for your actual teams.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">League Analysis</span>
                <span className="text-xs bg-gold-100 text-gold-800 px-2 py-1 rounded-full">Roster Sync</span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Trade Insights</span>
              </div>
              <Link 
                href="/sleeper-connect" 
                className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors group-hover:scale-105 transform"
              >
                <Link2 className="h-4 w-4" />
                Connect Your League
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Core Systems */}
      <Section 
        title="Core Systems" 
        action={<a href="/systems" className="text-sm text-body hover:text-plum transition-colors">See all</a>} 
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GlowCard title="Player Evaluation" subtitle="Fusion rankings with 4‑directional insights" icon={<Compass/>} href="/player-evaluation" />
        <GlowCard title="OTC Consensus" subtitle="Community boards & tiers" icon={<Users/>} href="/consensus" />
        <GlowCard title="Draft Command" subtitle="Real‑time draft aids" icon={<Sparkles/>} href="/draft" />
      </div>

      {/* Tiber Chat */}
      <Section title="🤖 Chat with Tiber" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TiberChat compact />
        </div>
        <div className="space-y-3">
          <GlowCard title="About Tiber" subtitle="Learn about our truth-first advisor" href="/about" />
          <GlowCard title="Full Chat" subtitle="Extended conversation mode" href="/tiber" />
        </div>
      </div>

      {/* Quick Links */}
      <Section title="Quick Links" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <GlowCard title="Player Showcase" subtitle="Top performers with live OVR" href="/showcase" />
        <GlowCard title="Hot List" subtitle="OVR risers & usage surges" href="/hot-list" />
        <GlowCard title="2025 Rookies" subtitle="Class preview & comps" href="/rookies" />
        <GlowCard title="Dashboard" subtitle="Sync Sleeper leagues" href="/dashboard" />
      </div>
    </main>
  );
}