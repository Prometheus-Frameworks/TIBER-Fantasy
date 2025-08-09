import RookieClass2025 from "@/components/RookieClass2025";

export default function RedraftPage() {
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