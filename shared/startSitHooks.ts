import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  StartSitPlayerProfile,
  StartSitVerdict,
  StartSitQueryParams,
  StartSitCompareParams,
  StartSitQueryError,
} from "./startSit";

export function useStartSitProfile(
  playerId: string,
  week: number,
  season: number = 2024,
  enabled: boolean = true
) {
  return useQuery<StartSitPlayerProfile, StartSitQueryError>({
    queryKey: ["/api/start-sit/profile", playerId, week, season],
    queryFn: async () => {
      const res = await apiRequest(
        "POST",
        "/api/start-sit/analyze",
        {
          kind: "single",
          playerId,
          week,
          season,
        }
      );
      const data = await res.json();
      return data.data.profile;
    },
    enabled: enabled && !!playerId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStartSitVerdicts(
  params: StartSitQueryParams,
  enabled: boolean = true
) {
  return useQuery<StartSitVerdict[], StartSitQueryError>({
    queryKey: ["/api/start-sit/verdicts", params],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/start-sit/verdicts", params);
      const data = await res.json();
      return data.data.verdicts;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStartSitCompare(
  params: StartSitCompareParams,
  enabled: boolean = true
) {
  return useQuery<StartSitVerdict[], StartSitQueryError>({
    queryKey: ["/api/start-sit/compare", params],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/start-sit/compare", params);
      const data = await res.json();
      return data.data.verdicts;
    },
    enabled: enabled && params.playerIds.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStartSitAnalysis() {
  return useMutation<
    StartSitPlayerProfile,
    StartSitQueryError,
    { playerId: string; week: number; season: number }
  >({
    mutationFn: async (data) => {
      const res = await apiRequest("POST", "/api/start-sit/analyze", {
        kind: "single",
        ...data,
      });
      const json = await res.json();
      return json.data.profile;
    },
  });
}

export function useStartSitComparison() {
  return useMutation<
    StartSitVerdict[],
    StartSitQueryError,
    { playerIds: string[]; week: number; season: number }
  >({
    mutationFn: async (data) => {
      const res = await apiRequest("POST", "/api/start-sit/compare", data);
      const json = await res.json();
      return json.data.verdicts;
    },
  });
}
