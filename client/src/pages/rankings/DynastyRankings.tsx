import RankingsTable from "@/components/RankingsTable";

export default function DynastyRankings() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="py-4">
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white">
          Dynasty Rankings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Long-term player value and dynasty strategy tools
        </p>
      </div>
      <RankingsTable mode="dynasty" />
    </div>
  );
}