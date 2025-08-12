import { Link } from "wouter";
import { QUICK_ACTIONS } from "../config/nav";
import { Compass, Users, Trophy } from "lucide-react";

function QuickActionCard({ icon, title, desc, href }: {
  icon: string; title: string; desc: string; href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border p-6 hover:border-purple-500 transition-all group"
      style={{ backgroundColor: 'var(--dark-card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--dark-bg)' }}>
      {/* HERO */}
      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-6xl md:text-8xl font-black text-white mb-6 leading-tight">
            ON THE<br />CLOCK.
          </h1>
          <p className="text-2xl md:text-3xl font-semibold mb-4" style={{ color: 'var(--gold)' }}>
            Fantasy Football. Evolved.
          </p>
          <p className="text-lg text-gray-400 mb-12 max-w-2xl mx-auto">
            Open-source, community-powered<br />
            tools for sharper draft decisions.
          </p>

          {/* QUICK ACTIONS */}
          <div className="mb-12">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-8">
              QUICK ACTIONS
            </h2>
            <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
              <QuickActionCard
                icon="🧭"
                title="Player Compass"
                desc="Context-aware guidance for dynasty decisions"
                href="/compass"
              />
              <QuickActionCard
                icon="🏃"
                title="2025 Rookies"
                desc="Prep and dominate your draft"
                href="/rookie-evaluator"
              />
              <QuickActionCard
                icon="🏆"
                title="Draft Room"
                desc="Prep and dominate your draft"
                href="/draft-room"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER STATUS */}
      <div className="fixed bottom-4 left-4 text-xs text-gray-500">
        build: v1.0.3-{new Date().toISOString().slice(0, 16)}
      </div>
      <div className="fixed bottom-4 right-4 text-xs text-gray-500 flex items-center gap-4">
        <span className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          Healthy
        </span>
        <span>Backend Spine: Live</span>
      </div>
    </main>
  );
}