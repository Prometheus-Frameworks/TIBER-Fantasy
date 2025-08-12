import { Link } from "wouter";
import { QUICK_ACTIONS } from "../config/nav";
import SystemCard from "../components/SystemCard";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* HERO */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-ink">
            On The Clock
          </h1>
          <p className="mt-4 text-lg max-w-2xl text-body">
            Fantasy football tools. Community-driven. No paywalls, just signal.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/compass"
              className="inline-flex items-center rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition"
            >
              Explore Player Compass
            </Link>
            <Link
              href="/consensus"
              className="inline-flex items-center rounded-md border border-line px-5 py-2.5 text-sm font-medium text-ink hover:border-ink transition"
            >
              View OTC Consensus
            </Link>
          </div>
        </div>
      </section>

      {/* CORE SYSTEMS */}
      <section className="py-10 bg-haze border-t border-line">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-ink">Core Systems</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SystemCard 
              title="Player Compass" 
              desc="Context-aware guidance for dynasty decisions" 
              href="/compass" 
              icon="🧭"
            />
            <SystemCard 
              title="OTC Consensus" 
              desc="Community-driven boards & tiers" 
              href="/consensus" 
              icon="👥"
            />
            <SystemCard 
              title="Draft Command" 
              desc="Real-time draft aids" 
              href="/draft-room" 
              icon="🏆"
            />
          </div>
        </div>
      </section>

      {/* ADDITIONAL TOOLS */}
      <section className="py-10 bg-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-xl font-bold mb-6 text-ink">Additional Tools</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_ACTIONS.map((action) => (
              <SystemCard
                key={action.href}
                title={action.label}
                desc={action.description}
                href={action.href}
                icon="⚙️"
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}