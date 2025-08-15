import GlowCard from "@/components/GlowCard";
import GlowCTA from "@/components/GlowCTA";
import { Section } from "@/components/Section";
import { Trophy, Compass, Users, Sparkles } from "lucide-react";

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
        <div className="mt-6">
          <GlowCTA href="/consensus">View OTC Consensus</GlowCTA>
        </div>
      </div>

      {/* Core Systems */}
      <Section 
        title="Core Systems" 
        action={<a href="/systems" className="text-sm text-body hover:text-plum transition-colors">See all</a>} 
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GlowCard title="Player Compass" subtitle="Context‑aware dynasty guidance" icon={<Compass/>} href="/compass" />
        <GlowCard title="OTC Consensus" subtitle="Community boards & tiers" icon={<Users/>} href="/consensus" />
        <GlowCard title="Draft Command" subtitle="Real‑time draft aids" icon={<Sparkles/>} href="/draft" />
      </div>

      {/* Quick Links */}
      <Section title="Quick Links" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <GlowCard title="2025 Rookies" subtitle="Class preview & comps" href="/rookies" />
        <GlowCard title="Articles & Analysis" subtitle="Buy/Sell, Waivers, Usage" href="/articles" />
        <GlowCard title="Consensus Transparency" subtitle="Methodology & audit trail" href="/consensus/transparency" />
        <GlowCard title="Dashboard" subtitle="Sync Sleeper leagues" href="/dashboard" />
      </div>
    </main>
  );
}