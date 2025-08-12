import { useEffect, useMemo, useState, startTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

const API_BASE = ""; // same-origin fallback
const DEFAULT_FORMAT: "redraft" | "dynasty" = "redraft";
const POSITIONS = ["ALL", "QB", "RB", "WR", "TE"] as const;

type Position = typeof POSITIONS[number];

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

export default function Rankings() {
  const [pos, setPos] = useState<Position>("ALL");
  const [format, setFormat] = useState<"redraft" | "dynasty">(DEFAULT_FORMAT);
  const [q, setQ] = useState("");

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (pos !== "ALL") p.set("pos", pos);
    p.set("format", format);
    p.set("limit", "200");
    return `${API_BASE}/api/ratings?${p.toString()}`;
  }, [pos, format]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ratings", pos, format],
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

  const { rows, updatedAt } = useMemo(() => normalize(data), [data]);

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
    <div className="container mx-auto px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Player Rankings</h1>
        <p className="text-sm text-neutral-600">
          {format.toUpperCase()} • {pos} • {updatedAt ? `Updated ${new Date(updatedAt).toLocaleString()}` : "Live"}
        </p>
      </header>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="flex gap-1">
          {POSITIONS.map(p => (
            <button
              key={p}
              onClick={() => setPos(p)}
              className={`px-3 py-1 rounded ${pos === p ? "bg-black text-white" : "bg-neutral-200"}`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-2">
          {(["redraft","dynasty"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-3 py-1 rounded ${format === f ? "bg-black text-white" : "bg-neutral-200"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          className="ml-auto border rounded px-3 py-1 w-full max-w-xs"
          placeholder="Search name or team…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* States */}
      {isLoading && <div className="p-6 rounded border">Loading rankings…</div>}
      {isError && (
        <div className="p-6 rounded border border-red-300 text-red-700">
          Failed to load rankings. {(error as any)?.message || ""}
          <div className="mt-2">
            <button className="text-sm underline" onClick={() => refetch()}>Retry</button>
          </div>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && (
        filtered.length ? (
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-100 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Player</th>
                  <th className="text-left px-3 py-2">Team</th>
                  <th className="text-left px-3 py-2">Pos</th>
                  <th className="text-right px-3 py-2">Tier</th>
                  <th className="text-right px-3 py-2">Rating</th>
                  <th className="text-right px-3 py-2">VORP</th>
                  <th className="text-right px-3 py-2">Bye</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.player_id} className="border-t">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2">{r.player_name}</td>
                    <td className="px-3 py-2">{r.team || "-"}</td>
                    <td className="px-3 py-2">{r.position}</td>
                    <td className="px-3 py-2 text-right">{r.tier ?? "-"}</td>
                    <td className="px-3 py-2 text-right">{r.overall_rating ?? "-"}</td>
                    <td className="px-3 py-2 text-right">{r.vorp ?? "-"}</td>
                    <td className="px-3 py-2 text-right">{r.bye ?? "-"}</td>
                    <td className="px-3 py-2">
                      <Link href={`/player/${r.player_id}`}>
                        <span className="underline">View</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 rounded border">No rankings available for this filter.</div>
        )
      )}

      {/* Debug strip (remove later) */}
      <div className="mt-3 text-xs text-neutral-500">
        API: {API_BASE || "same-origin"} &middot; URL: {url}
      </div>
    </div>
  );
}