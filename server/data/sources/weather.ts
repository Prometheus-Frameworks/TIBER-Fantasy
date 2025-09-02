// Weather data source - stub implementation
export async function fetchGameWeather(season: number, week: number): Promise<Array<{team: string, wind_mph: number, precip: number, temp_f: number}>> {
  // TODO: Wire to real weather API later
  // For now, return reasonable defaults (most games are indoor/good weather)
  return [
    { team: 'CLE', wind_mph: 8, precip: 0, temp_f: 72 },
    { team: 'CIN', wind_mph: 6, precip: 0, temp_f: 75 },
    { team: 'PHI', wind_mph: 12, precip: 0.1, temp_f: 68 },
    { team: 'DAL', wind_mph: 5, precip: 0, temp_f: 78 },
    // Add more teams as needed
  ];
}