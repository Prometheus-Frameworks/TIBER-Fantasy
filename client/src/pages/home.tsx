import { Link } from "wouter";
import { QUICK_ACTIONS } from "../config/nav";
import { Compass, Users, Trophy } from "lucide-react";

function SystemCard({ icon, title, desc, href }: {
  icon: string; title: string; desc: string; href: string;
}) {
  return (
    <Link
      href={href}
      className="block system-card rounded-lg p-5 hover:shadow-md transition-all"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{title}</h3>
      </div>
      <p className="text-sm" style={{ color: 'var(--body)' }}>{desc}</p>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* HERO */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight" style={{ color: 'var(--ink)' }}>
            On The Clock
          </h1>
          <p className="mt-4 text-lg max-w-2xl" style={{ color: 'var(--body)' }}>
            Fantasy football tools. Community-driven. No paywalls, just signal.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/compass"
              className="inline-flex items-center rounded-md px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition"
              style={{ backgroundColor: 'var(--ink)' }}
            >
              Explore Player Compass
            </Link>
            <Link
              href="/consensus"
              className="inline-flex items-center rounded-md border px-5 py-2.5 text-sm font-medium hover:border-opacity-80 transition"
              style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
            >
              View OTC Consensus
            </Link>
          </div>
        </div>
      </section>

      {/* CORE SYSTEMS */}
      <section className="py-10 border-t" style={{ backgroundColor: 'var(--haze)', borderColor: 'var(--line)' }}>
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Core Systems</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SystemCard 
              title="Player Compass" 
              desc="Context-aware dynasty guidance" 
              href="/compass" 
              icon="🧭"
            />
            <SystemCard 
              title="OTC Consensus" 
              desc="Community-driven boards" 
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
          <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--ink)' }}>Additional Tools</h2>
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