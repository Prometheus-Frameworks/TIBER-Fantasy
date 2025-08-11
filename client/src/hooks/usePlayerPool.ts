import { useQuery } from "@tanstack/react-query";
import { api, usePlayerPool as usePlayerPoolConfig, type PlayerPoolFilters } from "@/lib/playerPool";

// Re-export types and utilities
export { nameOf, playerOf, api } from "@/lib/playerPool";
export type { PlayerPoolEntry, PlayerPoolFilters } from "@/lib/playerPool";

export function usePlayerPool(filters: PlayerPoolFilters = {}) {
  return useQuery(usePlayerPoolConfig(filters));
}

export function usePlayerSearch(query: string, position?: string) {
  return usePlayerPool({ 
    search: query, 
    pos: position, 
    limit: 50 
  });
}

export function usePlayer(id: string) {
  return useQuery({
    queryKey: ['/api/players', id],
    queryFn: () => api.getPlayer(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
}