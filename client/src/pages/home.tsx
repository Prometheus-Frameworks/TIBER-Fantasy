import { Link } from "wouter";
import { QUICK_ACTIONS } from "../config/nav";

function Tile({ icon, title, desc, href }: {
  icon: string; title: string; desc: string; href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border bg-white/80 p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 animate-fadeIn"
    >
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 font-semibold">{title}</div>
      <p className="text-sm text-gray-600">{desc}</p>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-white text-gray-900">
      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* faint animated gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_-10%,#eaf2ff,transparent)] animate-pulse-slow" />
        {/* faint play diagram SVG overlay */}
        <svg
          className="absolute inset-0 opacity-5 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 200 200"
        >
          <circle cx="50" cy="50" r="4" fill="black" />
          <circle cx="150" cy="150" r="4" fill="black" />
          <line x1="50" y1="50" x2="150" y2="150" stroke="black" strokeWidth="1" />
          <path d="M150 150 Q170 100 130 70" stroke="black" fill="transparent" strokeWidth="1" />
        </svg>

        <div className="relative mx-auto max-w-screen-md px-4 py-14 text-center">
          <h1 className="text-5xl font-black leading-tight">ON THE CLOCK</h1>
          <p className="mt-2 text-lg text-gray-600">Fantasy football tools. Community driven.</p>

          {/* Quick Actions - matching top navigation style */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Quick Actions</h2>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-6" id="tools">
              {QUICK_ACTIONS.map((action) => (
                <Link 
                  key={action.href}
                  href={action.href} 
                  className="py-3 px-4 sm:px-0 border-b-2 border-transparent text-sm font-medium transition-colors hover:text-yellow-600 hover:border-yellow-300 text-gray-700 flex-shrink-0"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TILES */}
      <section className="mx-auto max-w-screen-md px-4 space-y-5 mt-8">
        <Tile icon="🧭" title="Player Compass" desc="Context-aware guidance for dynasty decisions" href="/player-compass" />
        <Tile icon="👥" title="Team Management" desc="Sync and analyze your leagues" href="/teams" />
        <Tile icon="🏆" title="Draft Tools" desc="Prep and dominate your draft" href="/draft-room" />
      </section>

      {/* COMMUNITY CTA */}
      <section className="mx-auto max-w-screen-md px-4 py-14">
        <div className="rounded-2xl border p-6 bg-gradient-to-br from-amber-50 to-white shadow-sm animate-fadeIn">
          <h3 className="text-2xl font-bold">Built for Community</h3>
          <p className="text-gray-600 mt-1">
            Open-source tools to help fantasy players make better decisions together.
          </p>
          <Link
            href="/community-posts"
            className="mt-4 inline-block px-4 py-2 rounded-md bg-amber-500 text-white font-semibold hover:opacity-90"
          >
            Join the Community →
          </Link>
        </div>
      </section>
    </main>
  );
}