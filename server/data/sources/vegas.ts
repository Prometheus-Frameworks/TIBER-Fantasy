// Vegas odds data source - stub implementation with sane fallbacks
export async function fetchGameOdds(season: number, week: number): Promise<Array<{team: string, opp: string, spread: number, total: number}>> {
  // TODO: Wire to real sportsbook API later
  // For now, return reasonable defaults for common teams
  return [
    { team: 'CLE', opp: 'CIN', spread: 3.5, total: 44.0 },
    { team: 'CIN', opp: 'CLE', spread: -3.5, total: 44.0 },
    { team: 'PHI', opp: 'DAL', spread: -2.5, total: 47.5 },
    { team: 'DAL', opp: 'PHI', spread: 2.5, total: 47.5 },
    // Add more teams as needed
  ];
}