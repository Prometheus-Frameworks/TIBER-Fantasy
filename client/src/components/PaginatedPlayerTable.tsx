import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";

const TEAMS = [
  "ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB",
  "HOU","IND","JAX","KC","LV","LAC","LAR","MIA","MIN","NE","NO","NYG",
  "NYJ","PHI","PIT","SF","SEA","TB","TEN","WAS"
];

async function fetchPlayers(filters: any) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, String(v)));
  const res = await fetch(`/api/players?${params}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error);
  return data;
}

export default function PaginatedPlayerTable() {
  const [filters, setFilters] = useState({ 
    pos: "", 
    team: "", 
    search: "", 
    page: 1, 
    pageSize: 50 
  });
  
  const debouncedSearch = useDebounce(filters.search, 250);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["players", { ...filters, search: debouncedSearch }],
    queryFn: () => fetchPlayers({ ...filters, search: debouncedSearch }),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const players = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const hasNext = data?.meta.hasNext ?? false;
  const currentPage = data?.meta.page ?? 1;

  // URL state synchronization
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, String(v)));
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, "", `?${params}`);
    }
  }, [filters]);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Fantasy Player Database</h1>
        <p className="text-muted-foreground">
          Unified player rankings with Player Compass scores, TIBER Consensus, and Qwen analysis
        </p>
      </div>
      
      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <Input 
          placeholder="Search players..." 
          value={filters.search} 
          onChange={(e) => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))} 
          className="max-w-xs" 
        />
        
        <Select 
          value={filters.pos || "all"} 
          onValueChange={(v) => setFilters(f => ({ ...f, pos: v === "all" ? "" : v, page: 1 }))}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Positions</SelectItem>
            {["QB","RB","WR","TE"].map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select 
          value={filters.team || "all"} 
          onValueChange={(v) => setFilters(f => ({ ...f, team: v === "all" ? "" : v, page: 1 }))}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {TEAMS.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select 
          value={filters.pageSize.toString()} 
          onValueChange={(v) => setFilters(f => ({ ...f, pageSize: parseInt(v), page: 1 }))}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground">Loading players...</p>
          </div>
        </div>
      )}
      
      {isError && (
        <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
          <p className="text-destructive font-medium">Error loading players</p>
          <p className="text-sm text-muted-foreground mt-1">
            {(error as Error).message}
          </p>
        </div>
      )}

      {/* Data Table */}
      {!isLoading && !isError && (
        <>
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 text-left font-medium">Player</th>
                    <th className="p-3 text-left font-medium">Pos</th>
                    <th className="p-3 text-left font-medium">Team</th>
                    <th className="p-3 text-right font-medium">ADP</th>
                    <th className="p-3 text-right font-medium">Proj</th>
                    <th className="p-3 text-center font-medium">Qwen Rank</th>
                    <th className="p-3 text-center font-medium">Compass</th>
                    <th className="p-3 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player: any, index: number) => (
                    <tr 
                      key={player.id} 
                      className="border-b hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3">
                        <div className="font-medium">{player.name}</div>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-secondary">
                          {player.pos}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-sm">{player.team || "—"}</td>
                      <td className="p-3 text-right font-mono">
                        {player.adp ? Math.round(player.adp) : "—"}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {player.projectedPoints ? Math.round(player.projectedPoints) : "—"}
                      </td>
                      <td className="p-3 text-center">
                        <div className="space-y-1">
                          <div className="font-mono text-sm">
                            {player.qwen?.rank || "—"}
                          </div>
                          {player.qwen?.tier && (
                            <div className="text-xs text-muted-foreground">
                              {player.qwen.tier}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="space-y-1">
                          <div className="font-mono text-sm">
                            {player.compass?.score ? Number(player.compass.score).toFixed(1) : "—"}
                          </div>
                          {player.compass?.tier && (
                            <div className="text-xs text-muted-foreground">
                              {player.compass.tier}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span 
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            player.injuryStatus === 'Healthy' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}
                        >
                          {player.injuryStatus || "Healthy"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * filters.pageSize) + 1}-{Math.min(currentPage * filters.pageSize, total)} of {total} players
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                disabled={currentPage <= 1} 
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-muted-foreground">Page</span>
                <span className="font-medium">{currentPage}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                disabled={!hasNext} 
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}