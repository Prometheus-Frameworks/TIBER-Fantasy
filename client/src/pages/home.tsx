import { Link, useLocation } from "wouter";

function Nav() {
  const [location] = useLocation();
  
  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-white/70 border-b safe-top">
      <nav className="mx-auto max-w-screen-md px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-extrabold tracking-tight">ON THE CLOCK</Link>

        <div className="flex items-center gap-2">
          <Link href="/login" className="px-3 py-1.5 text-sm rounded-md border hover:bg-gray-50">Log in</Link>
          <Link href="/signup" className="px-3 py-1.5 text-sm rounded-md bg-black text-white hover:opacity-90">Sign up</Link>
        </div>
      </nav>

      {/* secondary nav */}
      <div className="mx-auto max-w-screen-md px-4 pb-3">
        <div className="flex gap-3 overflow-x-auto no-scrollbar text-sm">
          {[
            { label: "Home", href: "/#tools" },
            { label: "Compass", href: "/player-compass" },
            { label: "Ranks", href: "/rankings" },
            { label: "Rookies", href: "/rookie-evaluator" },
            { label: "Draft", href: "/draft-room" },
          ].map((link) => (
            <Link
              key={link.label}
              className={`px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
                (link.href === "/#tools" && location === "/") || link.href === location
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
              href={link.href}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

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
      <Nav />

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

          <div className="mt-8 grid grid-cols-1 gap-3" id="tools">
            <Link href="/player-compass" className="w-full rounded-md bg-blue-600 text-white px-4 py-3 font-semibold active:scale-[.99] hover:opacity-95">🧭 Player Compass</Link>
            <Link href="/rankings" className="w-full rounded-md bg-green-600 text-white px-4 py-3 font-semibold active:scale-[.99] hover:opacity-95">🏆 View Rankings</Link>
            <Link href="/rookie-evaluator" className="w-full rounded-md bg-purple-600 text-white px-4 py-3 font-semibold active:scale-[.99] hover:opacity-95">🔥 2025 Rookies</Link>
            <Link href="/dashboard" className="w-full rounded-md border px-4 py-3 font-semibold hover:bg-gray-50">Get Started</Link>
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