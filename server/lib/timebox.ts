/**
 * Utility to determine the current NFL week safely.
 * Prevents accidental "full season" fetches for 2025.
 */

export function getCurrentNFLWeek(season: number): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Safety guardrail: For future seasons, default to week 1
  if (season > currentYear) {
    return 1;
  }
  
  // For 2025 season (September - January)
  if (season === 2025) {
    const month = now.getMonth(); // 0-indexed
    const day = now.getDate();
    
    // Pre-season (before September)
    if (month < 8) {
      return 0; // No games yet
    }
    
    // Regular season: September through December
    // Week 1 starts ~September 4th, each week is 7 days
    if (month === 8) { // September
      if (day < 4) return 0;
      return Math.min(Math.floor((day - 4) / 7) + 1, 4);
    }
    
    if (month === 9) { // October
      return Math.min(Math.floor(day / 7) + 5, 8);
    }
    
    if (month === 10) { // November
      return Math.min(Math.floor(day / 7) + 9, 13);
    }
    
    if (month === 11) { // December
      return Math.min(Math.floor(day / 7) + 13, 17);
    }
    
    // January (playoffs)
    if (month === 0 && currentYear === 2026) {
      return 18; // Last regular season week
    }
  }
  
  // For past seasons, assume full 18 weeks
  if (season < currentYear) {
    return 18;
  }
  
  // Default: week 1
  return 1;
}
