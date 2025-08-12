import { Link, useLocation } from "wouter";

function Tile({
  to, title, desc, emoji
}: { to: string; title: string; desc: string; emoji: string }) {
  return (
    <Link href={to} className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 hover:shadow-md transition bg-white dark:bg-gray-800 group">
      <div className="text-2xl mb-2">{emoji}</div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{desc}</p>
    </Link>
  );
}

export default function SeasonHQ() {
  const [, navigate] = useLocation();
  
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <header className="py-6">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Season HQ</h1>

        {/* format dropdown under title */}
        <div className="mt-2">
          <label className="text-xs text-gray-600 dark:text-gray-400 mr-2">Format</label>
          <select
            className="border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            value="redraft"
            onChange={(e) => {
              if (e.target.value === "dynasty") navigate("/dynasty");
            }}
          >
            <option value="redraft">Redraft</option>
            <option value="dynasty">Dynasty</option>
          </select>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mt-3">
          Complete tools & analysis for your 2025 redraft season.
        </p>
      </header>

      {/* tiles */}
      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Tile to="/articles?tag=redraft" title="Articles" emoji="📰"
          desc="Strategy, matchup notes, start/sit calls." />
        <Tile to="/usage/weekly" title="Weekly Usage" emoji="📈"
          desc="Snaps, target share, carry splits, routes." />
        <Tile to="/waivers" title="Waivers" emoji="🛒"
          desc="Priority pickups, FAAB guidance, drops." />
        <Tile to="/trades/buy-sell" title="Buy / Sell" emoji="♻️"
          desc="Trade targets and sell‑high candidates." />
        <Tile to="/consensus?format=redraft" title="OTC Consensus" emoji="🏷️"
          desc="Our live, community‑tunable board." />
        <Tile to="/projections" title="Projections" emoji="🔮"
          desc="Weekly & ROS projections, tiers." />
        <Tile to="/injuries" title="Injury Report" emoji="🩹"
          desc="Statuses, timelines, next‑man‑up." />
        <Tile to="/trade-analyzer?mode=redraft" title="Trade Analyzer" emoji="⚖️"
          desc="Redraft‑specific verdicts using OTC math." />
      </div>
    </div>
  );
}