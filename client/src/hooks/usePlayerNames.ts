import { useQuery } from "@tanstack/react-query";

interface ResolvedPlayer {
  id: string;
  name: string;
  team?: string;
  position?: string;
  found: boolean;
}

interface BulkResolveResponse {
  ok: boolean;
  data: ResolvedPlayer[];
}

// Hook to resolve multiple player IDs to names in bulk
export function usePlayerNames(playerIds: string[]) {
  return useQuery<BulkResolveResponse>({
    queryKey: ['/api/players/resolve', playerIds],
    queryFn: async () => {
      if (playerIds.length === 0) {
        return { ok: true, data: [] };
      }

      const response = await fetch('/api/players/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerIds }),
      });

      if (!response.ok) {
        throw new Error(`Failed to resolve player names: ${response.status}`);
      }

      return response.json();
    },
    enabled: playerIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - player names don't change often
  });
}

// Hook to resolve a single player ID to name
export function usePlayerName(playerId: string) {
  return useQuery<{ ok: boolean; data: ResolvedPlayer }>({
    queryKey: ['/api/players/resolve', playerId],
    queryFn: async () => {
      const response = await fetch(`/api/players/resolve/${playerId}`);
      
      if (!response.ok) {
        // If player not found, return fallback data
        if (response.status === 404) {
          return {
            ok: true,
            data: {
              id: playerId,
              name: playerId, // Fallback to showing ID
              found: false
            }
          };
        }
        throw new Error(`Failed to resolve player name: ${response.status}`);
      }

      return response.json();
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}