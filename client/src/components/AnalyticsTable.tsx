import { useEffect, useState } from "react";
import { api, RedraftRow, fmt } from "@/lib/apiClient";

export default function AnalyticsTable() {
  const [rows, setRows] = useState<RedraftRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.redraftRankings({ pos: "WR", season: 2025 })
      .then(res => setRows(res.data))
      .catch(e => console.error("rankings error", e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading…</div>;
  
  return (
    <table className="w-full border-collapse border border-gray-300">
      <thead>
        <tr className="bg-gray-100">
          <th className="border border-gray-300 p-2 text-left">Rank</th>
          <th className="border border-gray-300 p-2 text-left">Name</th>
          <th className="border border-gray-300 p-2 text-left">Team</th>
          <th className="border border-gray-300 p-2 text-left">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id} className="hover:bg-gray-50">
            <td className="border border-gray-300 p-2">{r.rank ?? "-"}</td>
            <td className="border border-gray-300 p-2">{fmt.title(r.name)}</td>
            <td className="border border-gray-300 p-2">{r.team}</td>
            <td className="border border-gray-300 p-2">{fmt.two(r.proj_pts ?? 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}