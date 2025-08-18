import { useQuery } from "@tanstack/react-query";

export default function WRCompassTable() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["compass","WR","dynasty","enhanced"],
    queryFn: async () => {
      const r = await fetch("/api/compass/WR?format=dynasty&algorithm=enhanced&page=1&pageSize=50");
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      return j;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  if (isLoading) return <div className="p-4">Loading WR Compass…</div>;
  if (isError) return <div className="p-4 text-red-600">Error: {(error as Error).message}</div>;

  const rows = data.data as any[];
  const meta = data.meta;

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-3">Player</th>
            <th className="text-left p-3">Team</th>
            <th className="text-left p-3">Age</th>
            <th className="text-left p-3">ADP</th>
            <th className="text-left p-3">Score</th>
            <th className="text-left p-3">Tier</th>
            <th className="text-left p-3">Insights</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={`${r.player_name}-${r.team}-${idx}`} className="border-t hover:bg-muted/50">
              <td className="p-3 font-medium">{r.player_name}</td>
              <td className="p-3">{r.team ?? "-"}</td>
              <td className="p-3">{r.age ?? "-"}</td>
              <td className="p-3">{typeof r.adp === "number" ? r.adp.toFixed(1) : "-"}</td>
              <td className="p-3 font-bold">{typeof r.compass?.score === "number" ? r.compass.score.toFixed(1) : "-"}</td>
              <td className="p-3">
                <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                  {r.tier}
                </span>
              </td>
              <td className="p-3 text-xs text-muted-foreground">{(r.insights ?? []).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between items-center p-3">
        <span>Showing {rows.length} of {meta.total}</span>
        {/* optional: add prev/next buttons wired to page params later */}
      </div>
    </div>
  );
}