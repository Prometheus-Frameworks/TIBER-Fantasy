import RookieClass2025 from "@/components/RookieClass2025";

// Feature flag for production readiness
const READY = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_REDRAFT_READY === "1";

export default function RedraftPage() {
  if (!READY) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Redraft 2025</h1>
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <h2 className="text-lg font-medium text-gray-600 mb-2">Coming Soon</h2>
          <p className="text-sm text-gray-500">
            Redraft tools are being prepared for the 2025 season. Check back soon!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Redraft 2025</h1>
      <section>
        <h2 className="text-lg font-medium mb-2">Rookie Spotlight (Class of 2025)</h2>
        <RookieClass2025 season={2024} week={1} />
      </section>
      {/* Add more redraft widgets here: weekly usage, ADP, etc. */}
    </div>
  );
}