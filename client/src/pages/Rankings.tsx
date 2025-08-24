import { useEffect, useMemo, useState, startTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const API_BASE = ""; // same-origin fallback
const DEFAULT_FORMAT: "redraft" | "dynasty" = "redraft";
const POSITIONS = ["ALL", "QB", "RB", "WR", "TE"] as const;
const WEEKS = Array.from({ length: 17 }, (_, i) => i + 1); // W1-W17

type Position = typeof POSITIONS[number];

type RatingRow = {
  player_id: string;
  name: string;
  team?: string;
  position: "QB" | "RB" | "WR" | "TE";
  tier?: string | number;
  score?: number;
  vor?: number;
  bye?: number | string;
  age?: number;
  debug?: {
    calc_check?: number;
    final_score?: number;
    opp_weighted?: number;
    eff_weighted?: number;
    role_weighted?: number;
    team_weighted?: number;
    health_weighted?: number;
    sos_weighted?: number;
    weights?: any;
  };
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
  const [week, setWeek] = useState<number>(6); // Default to Week 6
  const [debugMode, setDebugMode] = useState(false);
  const [q, setQ] = useState("");

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (pos !== "ALL") p.set("position", pos);
    p.set("format", format);
    p.set("season", "2024");
    if (format === "redraft") p.set("week", week.toString());
    if (debugMode) p.set("debug", "1");
    p.set("limit", "200");
    return `${API_BASE}/api/ratings?${p.toString()}`;
  }, [pos, format, week, debugMode]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ratings", pos, format, week, debugMode],
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
      r.name?.toLowerCase().includes(needle) ||
      r.team?.toLowerCase().includes(needle)
    );
  }, [rows, pos, q]);

  useEffect(() => {
    // handle SSR/Preview transitions without React warning
    startTransition(() => {});
  }, []);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            🚀 DeepSeek v2 Ratings
          </h1>
          <Badge variant="outline" className="text-xs">
            W1-W17 Coverage • {rows.length} Players
          </Badge>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Advanced 6-component methodology with full season coverage, VOR calculations, and debug transparency
        </p>
      </header>

      {/* Enhanced Controls */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={format} onValueChange={(value) => setFormat(value as "redraft" | "dynasty")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="redraft">Redraft</TabsTrigger>
              <TabsTrigger value="dynasty">Dynasty</TabsTrigger>
            </TabsList>
            
            <TabsContent value={format} className="space-y-4 mt-4">
              {/* Position Filter */}
              <div className="flex flex-wrap gap-2">
                {POSITIONS.map(p => (
                  <Button
                    key={p}
                    variant={pos === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPos(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
              
              {/* Week Selector for Redraft */}
              {format === "redraft" && (
                <div className="flex items-center gap-4">
                  <Label htmlFor="week-select" className="text-sm font-medium">Week:</Label>
                  <select
                    id="week-select"
                    value={week}
                    onChange={(e) => setWeek(Number(e.target.value))}
                    className="px-3 py-1 border rounded-md bg-background"
                  >
                    {WEEKS.map(w => (
                      <option key={w} value={w}>Week {w}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Debug Mode Toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="debug-mode"
                  checked={debugMode}
                  onCheckedChange={setDebugMode}
                />
                <Label htmlFor="debug-mode" className="text-sm">
                  Debug Mode (Show DeepSeek Components)
                </Label>
              </div>
              
              {/* Search */}
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Search:</Label>
                <input
                  className="flex-1 border rounded-md px-3 py-1 bg-background"
                  placeholder="Player name or team..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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

      {/* Enhanced Results Table */}
      {!isLoading && !isError && (
        filtered.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {format.charAt(0).toUpperCase() + format.slice(1)} Rankings 
                  {format === "redraft" && ` - Week ${week}`}
                  {pos !== "ALL" && ` - ${pos}`}
                </span>
                <Badge variant="secondary">
                  {filtered.length} Players
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-medium">Rank</th>
                      <th className="text-left py-3 px-4 font-medium">Player</th>
                      <th className="text-left py-3 px-4 font-medium">Pos</th>
                      <th className="text-right py-3 px-4 font-medium">Score</th>
                      <th className="text-right py-3 px-4 font-medium">VOR</th>
                      <th className="text-right py-3 px-4 font-medium">Tier</th>
                      {debugMode && (
                        <>
                          <th className="text-right py-3 px-4 font-medium text-xs">Opp</th>
                          <th className="text-right py-3 px-4 font-medium text-xs">Eff</th>
                          <th className="text-right py-3 px-4 font-medium text-xs">Role</th>
                          <th className="text-right py-3 px-4 font-medium text-xs">Team</th>
                          <th className="text-right py-3 px-4 font-medium text-xs">Health</th>
                          <th className="text-right py-3 px-4 font-medium text-xs">SOS</th>
                        </>
                      )}
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr 
                        key={r.player_id} 
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="py-3 px-4 font-medium">{i + 1}</td>
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-gray-500">{r.team || "FA"}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs">
                            {r.position}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {r.score?.toFixed(1) ?? "-"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {r.vor?.toFixed(1) ?? "-"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {r.tier ? (
                            <Badge 
                              variant={r.tier === "S" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {r.tier}
                            </Badge>
                          ) : "-"}
                        </td>
                        {debugMode && (
                          <>
                            <td className="py-3 px-4 text-right text-xs font-mono">
                              {r.debug?.opp_weighted?.toFixed(1) ?? "-"}
                            </td>
                            <td className="py-3 px-4 text-right text-xs font-mono">
                              {r.debug?.eff_weighted?.toFixed(1) ?? "-"}
                            </td>
                            <td className="py-3 px-4 text-right text-xs font-mono">
                              {r.debug?.role_weighted?.toFixed(1) ?? "-"}
                            </td>
                            <td className="py-3 px-4 text-right text-xs font-mono">
                              {r.debug?.team_weighted?.toFixed(1) ?? "-"}
                            </td>
                            <td className="py-3 px-4 text-right text-xs font-mono">
                              {r.debug?.health_weighted?.toFixed(1) ?? "-"}
                            </td>
                            <td className="py-3 px-4 text-right text-xs font-mono">
                              {r.debug?.sos_weighted?.toFixed(1) ?? "-"}
                            </td>
                          </>
                        )}
                        <td className="py-3 px-4">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/player/${r.player_id}`}>
                              View
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No players found matching your criteria
              </div>
            </CardContent>
          </Card>
        )
      )}

      {/* v2 Footer */}
      <Card>
        <CardContent className="pt-4">
          <div className="text-center text-sm text-gray-500 space-y-2">
            <div>
              🚀 <strong>DeepSeek v2</strong> • Production-grade with W1-W17 coverage
            </div>
            <div className="text-xs">
              {debugMode && "Debug Mode: ON • "}
              6-component methodology • VOR-based • Tier clustering
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}