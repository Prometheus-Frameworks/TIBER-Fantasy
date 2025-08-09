"use client";
import { useEffect, useState } from "react";

type Row = {
  player_id: string;
  player_name: string | null;
  team: string;
  position: string;
  season: number;
  week: number;
  routes: number | null;
  targets: number | null;
  snap_pct: number | null;
  fantasy_ppr: number | null;
};

const METRICS = [
  { key: "routes", label: "Routes" },
  { key: "targets", label: "Targets" },
  { key: "snap_pct", label: "Snap %" },
  { key: "fantasy_ppr", label: "PPR" },
];

const POS = ["ALL", "QB", "RB", "WR", "TE"];

export default function UsageLeaders({
  season = 2024,
  week = 1,
  limit = 50,
}: {
  season?: number;
  week?: number;
  limit?: number;
}) {
  const [metric, setMetric] = useState<string>("routes");
  const [pos, setPos] = useState<string>("ALL");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({
      season: String(season),
      week: String(week),
      limit: String(limit),
      sort: metric,
      order: "desc",
      pos: pos === "ALL" ? "QB,RB,WR,TE" : pos,
    });
    const res = await fetch(`/api/redraft/weekly?${params.toString()}`);
    const json = await res.json();
    setRows(json.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [metric, pos, season, week]);

  return (
    <div className="space-y-3">
      <div className="flex gap-3 items-center">
        <label className="text-sm">
          Metric
          <select
            className="ml-2 border rounded px-2 py-1 text-sm"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Pos
          <select
            className="ml-2 border rounded px-2 py-1 text-sm"
            value={pos}
            onChange={(e) => setPos(e.target.value)}
          >
            {POS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="text-center py-4 text-muted-foreground">Loading leaders…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">#</th>
                <th className="p-2">Player</th>
                <th className="p-2">Team</th>
                <th className="p-2">Pos</th>
                <th className="p-2">Routes</th>
                <th className="p-2">Targets</th>
                <th className="p-2">Snap%</th>
                <th className="p-2">PPR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.player_id}-${r.week}`}
                  className="border-t hover:bg-muted/50"
                >
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
                  <td className="p-2 font-medium">
                    {r.player_name ?? r.player_id}
                  </td>
                  <td className="p-2">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                      {r.team}
                    </span>
                  </td>
                  <td className="p-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getPositionColor(r.position)}`}>
                      {r.position}
                    </span>
                  </td>
                  <td className="p-2">{r.routes ?? "-"}</td>
                  <td className="p-2">{r.targets ?? "-"}</td>
                  <td className="p-2">
                    {r.snap_pct == null ? "-" : (r.snap_pct * 100).toFixed(0)}
                  </td>
                  <td className="p-2 font-medium">
                    {r.fantasy_ppr == null ? "-" : r.fantasy_ppr.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No data found for Week {week} with the selected filters</p>
          <p className="text-xs mt-1">Try a different week or position filter</p>
        </div>
      )}
    </div>
  );
}

function getPositionColor(position: string) {
  switch (position) {
    case 'QB': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'RB': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'WR': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'TE': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}