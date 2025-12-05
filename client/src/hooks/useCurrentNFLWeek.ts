import { useQuery } from '@tanstack/react-query';

interface WeekInfo {
  currentWeek: number;
  season: number;
  weekStatus: 'not_started' | 'in_progress' | 'completed';
  mondayNightCompleted: boolean;
  weekStartDate: string;
  weekEndDate: string;
  nextWeekStartDate?: string;
  gamesCompleted: number;
  totalGames: number;
  upcomingWeek: number;
  success: boolean;
}

export function useCurrentNFLWeek() {
  const { data, isLoading, error } = useQuery<WeekInfo>({
    queryKey: ['/api/system/current-week'],
    queryFn: async () => {
      const response = await fetch('/api/system/current-week');
      if (!response.ok) {
        throw new Error('Failed to fetch current week');
      }
      return response.json();
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    currentWeek: data?.currentWeek || 1,
    upcomingWeek: data?.upcomingWeek || data?.currentWeek || 1,
    season: data?.season || 2025,
    weekStatus: data?.weekStatus || 'not_started',
    mondayNightCompleted: data?.mondayNightCompleted || false,
    isLoading,
    error,
    weekInfo: data,
  };
}
