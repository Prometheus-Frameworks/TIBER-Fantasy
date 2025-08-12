import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ConsensusFormat, ConsensusResponse, ConsensusPatchRequest } from "@shared/types/consensus";

// Query hook for fetching consensus data
export function useConsensus(format?: ConsensusFormat, season?: number) {
  return useQuery({
    queryKey: ['consensus', format, season ?? 'rolling'],
    queryFn: async (): Promise<ConsensusResponse> => {
      const params = new URLSearchParams();
      if (format) params.append('format', format);
      if (season) params.append('season', season.toString());
      
      const response = await fetch(`/api/consensus?${params}`);
      if (!response.ok) throw new Error(`${response.status}: Failed to fetch consensus`);
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Query hook for fetching consensus metadata
export function useConsensusMeta() {
  return useQuery({
    queryKey: ['consensus', 'meta'],
    queryFn: async () => {
      const response = await fetch('/api/consensus/meta');
      if (!response.ok) throw new Error(`${response.status}: Failed to fetch consensus meta`);
      return response.json();
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Mutation hook for updating consensus data
export function useUpdateConsensus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: ConsensusPatchRequest) => {
      return apiRequest('/api/consensus', {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate specific consensus cache
      queryClient.invalidateQueries({
        queryKey: ['consensus', variables.format, variables.season ?? 'rolling']
      });
      
      // Invalidate meta cache to get updated board version
      queryClient.invalidateQueries({
        queryKey: ['consensus', 'meta']
      });
    },
  });
}