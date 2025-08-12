import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function RankingsHub() {
  // Fetch health data for last updated timestamps
  const { data: healthData } = useQuery({
    queryKey: ["/api/health"],
    staleTime: 30_000,
  });

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return null;
    try {
      return new Date(timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return null;
    }
  };

  const lastSync = formatTimestamp((healthData as any)?.timestamp);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <header className="py-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white">
          Player Rankings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Choose a format to view rankings and tools.
        </p>
      </header>

      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
        <Link 
          href="/rankings/redraft" 
          className="group rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 hover:shadow-md transition-all hover:-translate-y-0.5 bg-white dark:bg-gray-800"
        >
          <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            Redraft
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Seasonal ranks, waivers, trade analyzer (redraft logic), weekly projections.
          </p>
          {lastSync && (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Synced: {lastSync}
            </p>
          )}
        </Link>

        <Link 
          href="/rankings/dynasty" 
          className="group rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 hover:shadow-md transition-all hover:-translate-y-0.5 bg-white dark:bg-gray-800"
        >
          <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            Dynasty
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Long‑term value tiers, age curves, market efficiency, rookie integration.
          </p>
          {lastSync && (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Synced: {lastSync}
            </p>
          )}
        </Link>
      </div>
    </div>
  );
}