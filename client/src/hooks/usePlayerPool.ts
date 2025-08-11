import { useQuery } from "@tanstack/react-query";

export interface PlayerPoolEntry {
  id: string;
  name: string;
  team: string;
  pos: string;
  aliases: string[];
}

export function usePlayerPool() {
  return useQuery({
    queryKey: ['/api/players/pool'],
    queryFn: async () => {
      const response = await fetch('/api/players/pool');
      const result = await response.json();
      return result.data as PlayerPoolEntry[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in memory for 10 minutes
  });
}

export function usePlayerSearch(query: string, position?: string) {
  return useQuery({
    queryKey: ['/api/players/search', query, position],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      
      const params = new URLSearchParams({ search: query });
      if (position) params.append('pos', position);
      
      const response = await fetch(`/api/players/search?${params}`);
      const result = await response.json();
      return result.data as PlayerPoolEntry[];
    },
    enabled: query.length >= 2,
    staleTime: 2 * 60 * 1000, // Cache search results for 2 minutes
  });
}

export function usePlayer(id: string) {
  return useQuery({
    queryKey: ['/api/players', id],
    queryFn: async () => {
      const response = await fetch(`/api/players/${id}`);
      const result = await response.json();
      return result.data as PlayerPoolEntry;
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // Cache individual players for 10 minutes
  });
}