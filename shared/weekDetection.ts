/**
 * NFL Week Detection Utility
 * Determines current NFL week based on actual 2025 schedule dates
 * Handles week progression and Monday Night Football completion status
 */

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
}

// 2025 NFL Season Schedule (Thursday/Sunday/Monday structure)
// Each week starts on Thursday and ends after Monday Night Football
const NFL_2025_SCHEDULE: Array<{
  week: number;
  startDate: string; // Thursday
  endDate: string;   // Tuesday after MNF (when week is officially "completed")
  mondayNightDate: string;
}> = [
  // Week 1: September 4-9, 2025
  { 
    week: 1, 
    startDate: '2025-09-04T20:00:00Z', // Thursday Night Football
    endDate: '2025-09-10T04:00:00Z',   // Tuesday after MNF
    mondayNightDate: '2025-09-09T01:15:00Z' // MNF typically 8:15 PM ET (01:15 UTC Tuesday)
  },
  
  // Week 2: September 11-16, 2025
  { 
    week: 2, 
    startDate: '2025-09-11T20:00:00Z', 
    endDate: '2025-09-17T04:00:00Z',
    mondayNightDate: '2025-09-16T01:15:00Z'
  },
  
  // Week 3: September 18-23, 2025
  { 
    week: 3, 
    startDate: '2025-09-18T20:00:00Z', 
    endDate: '2025-09-24T04:00:00Z',
    mondayNightDate: '2025-09-23T01:15:00Z'
  },
  
  // Week 4: September 25-30, 2025
  { 
    week: 4, 
    startDate: '2025-09-25T20:00:00Z', 
    endDate: '2025-10-01T04:00:00Z',
    mondayNightDate: '2025-09-30T01:15:00Z'
  },
  
  // Week 5: October 2-7, 2025
  { 
    week: 5, 
    startDate: '2025-10-02T20:00:00Z', 
    endDate: '2025-10-08T04:00:00Z',
    mondayNightDate: '2025-10-07T01:15:00Z'
  },
  
  // Week 6: October 9-14, 2025
  { 
    week: 6, 
    startDate: '2025-10-09T20:00:00Z', 
    endDate: '2025-10-15T04:00:00Z',
    mondayNightDate: '2025-10-14T01:15:00Z'
  },
  
  // Week 7: October 16-21, 2025
  { 
    week: 7, 
    startDate: '2025-10-16T20:00:00Z', 
    endDate: '2025-10-22T04:00:00Z',
    mondayNightDate: '2025-10-21T01:15:00Z'
  },
  
  // Week 8: October 23-28, 2025
  { 
    week: 8, 
    startDate: '2025-10-23T20:00:00Z', 
    endDate: '2025-10-29T04:00:00Z',
    mondayNightDate: '2025-10-28T01:15:00Z'
  },
  
  // Week 9: October 30-November 4, 2025
  { 
    week: 9, 
    startDate: '2025-10-30T20:00:00Z', 
    endDate: '2025-11-05T04:00:00Z',
    mondayNightDate: '2025-11-04T01:15:00Z'
  },
  
  // Week 10: November 6-11, 2025
  { 
    week: 10, 
    startDate: '2025-11-06T20:00:00Z', 
    endDate: '2025-11-12T04:00:00Z',
    mondayNightDate: '2025-11-11T01:15:00Z'
  },
  
  // Week 11: November 13-18, 2025
  { 
    week: 11, 
    startDate: '2025-11-13T20:00:00Z', 
    endDate: '2025-11-19T04:00:00Z',
    mondayNightDate: '2025-11-18T01:15:00Z'
  },
  
  // Week 12: November 20-25, 2025
  { 
    week: 12, 
    startDate: '2025-11-20T20:00:00Z', 
    endDate: '2025-11-26T04:00:00Z',
    mondayNightDate: '2025-11-25T01:15:00Z'
  },
  
  // Week 13: November 27-December 2, 2025
  { 
    week: 13, 
    startDate: '2025-11-27T20:00:00Z', 
    endDate: '2025-12-03T04:00:00Z',
    mondayNightDate: '2025-12-02T01:15:00Z'
  },
  
  // Week 14: December 4-9, 2025
  { 
    week: 14, 
    startDate: '2025-12-04T20:00:00Z', 
    endDate: '2025-12-10T04:00:00Z',
    mondayNightDate: '2025-12-09T01:15:00Z'
  },
  
  // Week 15: December 11-16, 2025
  { 
    week: 15, 
    startDate: '2025-12-11T20:00:00Z', 
    endDate: '2025-12-17T04:00:00Z',
    mondayNightDate: '2025-12-16T01:15:00Z'
  },
  
  // Week 16: December 18-23, 2025
  { 
    week: 16, 
    startDate: '2025-12-18T20:00:00Z', 
    endDate: '2025-12-24T04:00:00Z',
    mondayNightDate: '2025-12-23T01:15:00Z'
  },
  
  // Week 17: December 25-30, 2025
  { 
    week: 17, 
    startDate: '2025-12-25T20:00:00Z', 
    endDate: '2025-12-31T04:00:00Z',
    mondayNightDate: '2025-12-30T01:15:00Z'
  },
  
  // Week 18: January 1-6, 2026
  { 
    week: 18, 
    startDate: '2026-01-01T20:00:00Z', 
    endDate: '2026-01-07T04:00:00Z',
    mondayNightDate: '2026-01-06T01:15:00Z'
  }
];

/**
 * Get current NFL week based on current date
 */
export function getCurrentWeek(currentDate?: Date): WeekInfo {
  const now = currentDate || new Date();
  const currentTime = now.getTime();
  
  // Find the current week based on schedule
  for (let i = 0; i < NFL_2025_SCHEDULE.length; i++) {
    const weekData = NFL_2025_SCHEDULE[i];
    const startTime = new Date(weekData.startDate).getTime();
    const endTime = new Date(weekData.endDate).getTime();
    const mondayNightTime = new Date(weekData.mondayNightDate).getTime();
    
    // If we're within this week's window
    if (currentTime >= startTime && currentTime < endTime) {
      const mondayNightCompleted = currentTime >= mondayNightTime;
      
      let weekStatus: 'not_started' | 'in_progress' | 'completed';
      if (currentTime < startTime) {
        weekStatus = 'not_started';
      } else if (currentTime < mondayNightTime) {
        weekStatus = 'in_progress';
      } else {
        weekStatus = 'completed';
      }
      
      return {
        currentWeek: weekData.week,
        season: 2025,
        weekStatus,
        mondayNightCompleted,
        weekStartDate: weekData.startDate,
        weekEndDate: weekData.endDate,
        nextWeekStartDate: NFL_2025_SCHEDULE[i + 1]?.startDate,
        gamesCompleted: mondayNightCompleted ? 16 : estimateGamesCompleted(now, weekData),
        totalGames: 16
      };
    }
  }
  
  // If we're before the season starts, return Week 1
  if (currentTime < new Date(NFL_2025_SCHEDULE[0].startDate).getTime()) {
    return {
      currentWeek: 1,
      season: 2025,
      weekStatus: 'not_started',
      mondayNightCompleted: false,
      weekStartDate: NFL_2025_SCHEDULE[0].startDate,
      weekEndDate: NFL_2025_SCHEDULE[0].endDate,
      nextWeekStartDate: NFL_2025_SCHEDULE[0].startDate,
      gamesCompleted: 0,
      totalGames: 16
    };
  }
  
  // If we're after the season ends, return Week 18 as completed
  return {
    currentWeek: 18,
    season: 2025,
    weekStatus: 'completed',
    mondayNightCompleted: true,
    weekStartDate: NFL_2025_SCHEDULE[17].startDate,
    weekEndDate: NFL_2025_SCHEDULE[17].endDate,
    gamesCompleted: 16,
    totalGames: 16
  };
}

/**
 * Estimate how many games have been completed based on the current time within a week
 */
function estimateGamesCompleted(currentDate: Date, weekData: any): number {
  const startTime = new Date(weekData.startDate).getTime();
  const mondayNightTime = new Date(weekData.mondayNightDate).getTime();
  const currentTime = currentDate.getTime();
  
  // If before Thursday night, 0 games
  if (currentTime < startTime) return 0;
  
  // If after Monday night, all 16 games
  if (currentTime >= mondayNightTime) return 16;
  
  // Estimate based on typical game schedule:
  // Thursday: 1 game
  // Sunday: ~13 games (1 PM, 4 PM, 8 PM slots)
  // Monday: 1-2 games
  
  const dayOfWeek = currentDate.getUTCDay();
  const hour = currentDate.getUTCHours();
  
  if (dayOfWeek < 4) { // Before Thursday
    return 0;
  } else if (dayOfWeek === 4) { // Thursday
    return hour >= 20 ? 1 : 0;
  } else if (dayOfWeek < 7) { // Friday-Saturday
    return 1; // TNF completed
  } else if (dayOfWeek === 7 || dayOfWeek === 0) { // Sunday
    if (hour < 17) return 1; // Only TNF
    else if (hour < 21) return 8; // 1 PM games
    else if (hour < 24) return 12; // 4 PM games
    else return 13; // SNF
  } else { // Monday
    return hour >= 1 ? 16 : 13; // MNF starts ~8:15 PM ET (1:15 UTC Tuesday)
  }
}

/**
 * Get week info for a specific week number
 */
export function getWeekInfo(week: number, season: number = 2025): WeekInfo | null {
  const weekData = NFL_2025_SCHEDULE.find(w => w.week === week);
  if (!weekData) return null;
  
  const now = new Date();
  const currentTime = now.getTime();
  const startTime = new Date(weekData.startDate).getTime();
  const endTime = new Date(weekData.endDate).getTime();
  const mondayNightTime = new Date(weekData.mondayNightDate).getTime();
  
  const mondayNightCompleted = currentTime >= mondayNightTime;
  
  let weekStatus: 'not_started' | 'in_progress' | 'completed';
  if (currentTime < startTime) {
    weekStatus = 'not_started';
  } else if (currentTime < mondayNightTime) {
    weekStatus = 'in_progress';
  } else {
    weekStatus = 'completed';
  }
  
  const weekIndex = NFL_2025_SCHEDULE.findIndex(w => w.week === week);
  
  return {
    currentWeek: week,
    season,
    weekStatus,
    mondayNightCompleted,
    weekStartDate: weekData.startDate,
    weekEndDate: weekData.endDate,
    nextWeekStartDate: NFL_2025_SCHEDULE[weekIndex + 1]?.startDate,
    gamesCompleted: mondayNightCompleted ? 16 : estimateGamesCompleted(now, weekData),
    totalGames: 16
  };
}

/**
 * Determine if risers/fallers data is available for a given week
 * Risers/fallers analysis requires the previous week to be completed
 */
export function isRisersFallersDataAvailable(week: number): boolean {
  // Need at least Week 2 to have risers/fallers (comparing to Week 1)
  if (week < 2) return false;
  
  // Check if the previous week is completed
  const previousWeekInfo = getWeekInfo(week - 1);
  return previousWeekInfo?.weekStatus === 'completed' || false;
}

/**
 * Get the best week to show for risers/fallers based on current time
 */
export function getBestRisersFallersWeek(): number {
  const current = getCurrentWeek();
  
  // If current week is completed and we have at least 2 weeks, show current week risers/fallers
  if (current.weekStatus === 'completed' && current.currentWeek >= 2) {
    return current.currentWeek;
  }
  
  // If current week is in progress but previous week is completed, show previous week
  if (current.currentWeek >= 2) {
    const previousWeekInfo = getWeekInfo(current.currentWeek - 1);
    if (previousWeekInfo?.weekStatus === 'completed') {
      return current.currentWeek - 1;
    }
  }
  
  // Default to Week 1 if no risers/fallers data is available yet
  return 1;
}

/**
 * Debug function to test week detection with different dates
 */
export function debugWeekDetection(testDate?: string): WeekInfo {
  const testDateTime = testDate ? new Date(testDate) : new Date();
  console.log(`[Week Detection Debug] Testing with date: ${testDateTime.toISOString()}`);
  
  const result = getCurrentWeek(testDateTime);
  console.log(`[Week Detection Debug] Result:`, result);
  
  return result;
}