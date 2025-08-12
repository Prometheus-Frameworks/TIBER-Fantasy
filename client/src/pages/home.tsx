import { Link } from "wouter";

export default function Home() {
  const coreFeatures = [
    {
      href: "/compass",
      title: "Player Compass",
      description: "Context-aware dynasty guidance",
      icon: "🧭"
    },
    {
      href: "/consensus", 
      title: "OTC Consensus",
      description: "Community boards & tiers",
      icon: "📊"
    },
    {
      href: "/rookies",
      title: "2025 Rookies", 
      description: "Rookie evaluation system",
      icon: "⭐"
    }
  ];

  const additionalTools = [
    { href:'/dashboard', title:'Dashboard', desc:'Personal league management' },
    { href:'/analytics', title:'Analytics', desc:'Statistical analysis and trends' }
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="container-tight section">
        <h1 className="h-hero text-4xl md:text-5xl font-semibold text-ink">
          On The Clock
        </h1>
        <p className="mt-2 text-base md:text-lg text-body">
          Fantasy football tools. Community-driven. No paywalls, just signal.
        </p>
        <div className="mt-4">
          <Link href="/consensus" className="inline-flex items-center px-4 py-2 rounded-md bg-gold text-white hover:bg-gold/90 transition-colors">
            View OTC Consensus
          </Link>
        </div>
      </section>

      {/* Core Systems */}
      <section className="container-tight section">
        <div className="flex items-end justify-between">
          <h2 className="h-section text-2xl font-semibold text-ink">Core Systems</h2>
          <Link href="/all-tools" className="text-sm text-body hover:text-plum">See all</Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {coreFeatures.map((feature) => (
            <Link key={feature.href} href={feature.href} className="card p-4 md:p-5 hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-medium text-ink">{feature.title}</h3>
              <p className="mt-1 text-sm text-body">{feature.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Additional Tools */}
      <section className="container-tight section-sm">
        <h2 className="h-section text-xl font-semibold text-ink">Additional Tools</h2>
        <ul className="divide-y divide-line border border-line rounded-card bg-white">
          {additionalTools.map((tool) => (
            <li key={tool.href} className="px-4 py-3 md:px-5 md:py-3.5 hover:bg-haze transition-colors">
              <Link href={tool.href} className="flex items-center justify-between">
                <div>
                  <div className="text-sm md:text-base font-medium text-ink">{tool.title}</div>
                  <div className="text-xs md:text-sm text-body">{tool.desc}</div>
                </div>
                <span className="text-body">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}