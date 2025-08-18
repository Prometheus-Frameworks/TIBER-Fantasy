import { useQuery } from "@tanstack/react-query";

interface PositionCompassTableProps {
  position: "WR" | "RB" | "TE" | "QB";
  format?: "dynasty" | "redraft";
}

export default function PositionCompassTable({ 
  position, 
  format = "dynasty" 
}: PositionCompassTableProps) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["compass", position, format, 1, 50],
    queryFn: async () => {
      const r = await fetch(`/api/compass/${position}?format=${format}&page=1&pageSize=50`);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      return j;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  if (isLoading) return <div className="p-4">Loading {position} Compass…</div>;
  if (isError) return <div className="p-4 text-red-600">Error: {(error as Error).message}</div>;

  const rows = data.data as any[];
  const meta = data.meta;

  // Position-specific styling
  const getPositionColor = (pos: string) => {
    switch (pos) {
      case "WR": return "bg-blue-100 text-blue-800";
      case "RB": return "bg-green-100 text-green-800";
      case "TE": return "bg-orange-100 text-orange-800";
      case "QB": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="overflow-x-auto border rounded-lg">
      <div className="p-4 border-b">
        <h2 className="font-bold text-lg">{position} Compass - {format.charAt(0).toUpperCase() + format.slice(1)}</h2>
      </div>
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
              <td className="p-3 font-bold">
                {typeof r.compass?.score === "number" ? r.compass.score.toFixed(1) : "-"}
              </td>
              <td className="p-3">
                <span className={`px-2 py-1 rounded text-xs ${getPositionColor(position)}`}>
                  {r.tier}
                </span>
              </td>
              <td className="p-3 text-xs text-muted-foreground">
                {(r.insights ?? []).join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between items-center p-3">
        <span>Showing {rows.length} of {meta.total}</span>
        <span className="text-xs text-muted-foreground">Format: {format}</span>
      </div>
    </div>
  );
}