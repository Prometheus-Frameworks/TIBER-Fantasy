import { useEffect, useMemo, useState, startTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

const API_BASE = ""; // same-origin fallback
const POSITIONS = ["ALL", "QB", "RB", "WR", "TE"] as const;

type Position = typeof POSITIONS[number];
type Mode = "redraft" | "dynasty";

type RatingRow = {
  player_id: string;
  player_name: string;
  team?: string;
  position: "QB" | "RB" | "WR" | "TE";
  tier?: string | number;
  overall_rating?: number;
  vorp?: number;
  bye?: number | string;
};

type RatingsResponse =
  | { ok: boolean; data: RatingRow[]; count?: number }
  | { items: RatingRow[]; updated_at?: string }
  | { players: RatingRow[]; updated_at?: string }
  | RatingRow[]; // tolerate raw array too

function normalize(resp: RatingsResponse | undefined): { rows: RatingRow[]; updatedAt?: string } {
  if (!resp) return { rows: [], updatedAt: undefined };
  if (Array.isArray(resp)) return { rows: resp, updatedAt: undefined };
  const any = resp as any;
  if (any?.ok && Array.isArray(any.data)) return { rows: any.data, updatedAt: any.updated_at };
  if (Array.isArray(any?.items)) return { rows: any.items, updatedAt: any.updated_at };
  if (Array.isArray(any?.players)) return { rows: any.players, updatedAt: any.updated_at };
  return { rows: [], updatedAt: any?.updated_at };
}

type Props = { 
  mode: Mode;
};

export default function RankingsTable({ mode }: Props) {
  const [pos, setPos] = useState<Position>("ALL");
  const [q, setQ] = useState("");
  
  // Use the new consensus hook
  const format = mode as ConsensusFormat;
  const season = format === 'redraft' ? 2025 : undefined;
  const { data: consensusData, isLoading: consensusLoading, error: consensusError } = useConsensus(format, season);

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (pos !== "ALL") p.set("pos", pos);
    p.set("format", mode);
    p.set("limit", "200");
    return `${API_BASE}/api/ratings?${p.toString()}`;
  }, [pos, mode]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ratings", pos, mode],
    queryFn: async () => {
      try {
        const res = await fetch(url, { headers: { "accept": "application/json" } });
        if (!res.ok) {
          throw new Error(`API returned ${res.status}: ${res.statusText}`);
        }
        const json = await res.json();
        console.debug("Rankings fetch", { url, status: res.status, keys: Object.keys(json || {}) });
        return json as RatingsResponse;
      } catch (err) {
        console.error("Rankings fetch failed:", err);
        throw err;
      }
    },
    staleTime: 60_000,
    retry: 2,
  });

  // Prioritize consensus data if available, otherwise use legacy
  const { rows, updatedAt } = useMemo(() => {
    if (consensusData?.rows && consensusData.rows.length > 0) {
      // Transform consensus data to match RatingRow format
      const consensusRows: RatingRow[] = consensusData.rows.map(row => ({
        player_id: row.playerId,
        player_name: `Player ${row.playerId}`, // TODO: Join with player pool for names
        team: "", // TODO: Join with player pool for teams
        position: "WR" as const, // TODO: Get from player pool
        tier: row.tier,
        overall_rating: row.score,
        vorp: row.score, // Use consensus score as VORP for now
      }));
      return { rows: consensusRows, updatedAt: consensusData.rows[0]?.updatedAt };
    }
    return normalize(data);
  }, [consensusData, data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = pos === "ALL" ? rows : rows.filter(r => r.position === pos);
    if (!needle) return base;
    return base.filter(r =>
      r.player_name?.toLowerCase().includes(needle) ||
      r.team?.toLowerCase().includes(needle)
    );
  }, [rows, pos, q]);

  useEffect(() => {
    // handle SSR/Preview transitions without React warning
    startTransition(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {mode.toUpperCase()} • {pos} • {updatedAt ? `Updated ${new Date(updatedAt).toLocaleString()}` : "Live"}
        </p>
        <Link 
          href="/consensus"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to OTC Consensus Hub
        </Link>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1">
          {POSITIONS.map(p => (
            <button
              key={p}
              onClick={() => setPos(p)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                pos === p 
                  ? "bg-yellow-600 text-white" 
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          className="ml-auto border border-gray-300 dark:border-gray-600 rounded px-3 py-1 w-full max-w-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          placeholder="Search name or team…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* States */}
      {isLoading && (
        <div className="p-6 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="text-gray-900 dark:text-white">Loading rankings…</div>
        </div>
      )}
      
      {isError && (
        <div className="p-6 rounded border border-red-300 dark:border-red-600 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
          Failed to load rankings. {(error as any)?.message || ""}
          <div className="mt-2">
            <button 
              className="text-sm underline hover:no-underline" 
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && (
        filtered.length ? (
          <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-900 dark:text-white font-medium">#</th>
                  <th className="text-left px-3 py-2 text-gray-900 dark:text-white font-medium">Player</th>
                  <th className="text-left px-3 py-2 text-gray-900 dark:text-white font-medium">Team</th>
                  <th className="text-left px-3 py-2 text-gray-900 dark:text-white font-medium">Pos</th>
                  <th className="text-right px-3 py-2 text-gray-900 dark:text-white font-medium">Tier</th>
                  <th className="text-right px-3 py-2 text-gray-900 dark:text-white font-medium">Rating</th>
                  <th className="text-right px-3 py-2 text-gray-900 dark:text-white font-medium">VORP</th>
                  <th className="text-right px-3 py-2 text-gray-900 dark:text-white font-medium">Bye</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.player_id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-3 py-2 text-gray-900 dark:text-white">{i + 1}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-white font-medium">{r.player_name}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{r.team || "-"}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{r.position}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{r.tier ?? "-"}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{r.overall_rating ?? "-"}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{r.vorp ?? "-"}</td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{r.bye ?? "-"}</td>
                    <td className="px-3 py-2">
                      <Link href={`/player/${r.player_id}`}>
                        <span className="text-blue-600 dark:text-blue-400 hover:underline text-sm">View</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="text-gray-900 dark:text-white">
              No consensus data available — check your source.
            </div>
          </div>
        )
      )}

      {/* Debug strip (remove later) */}
      <div className="text-xs text-gray-500 dark:text-gray-500">
        API: {API_BASE || "same-origin"} &middot; URL: {url}
      </div>
    </div>
  );
}