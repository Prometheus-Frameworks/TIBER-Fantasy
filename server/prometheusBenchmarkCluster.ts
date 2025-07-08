/**
 * Prometheus Benchmark Cluster
 * Elite player analytics thresholds based on 2024 season analysis
 * Source: Ja'Marr Chase, Saquon Barkley, Lamar Jackson, Josh Allen
 */

export interface PrometheusBenchmarks {
  // Wide Receiver Elite Thresholds
  WR: {
    yardsPerRouteRun: number;
    targetShare: number;
    airYardsShare: number;
    wopr: number;
    spikeGameThreshold: number; // Fantasy points for spike week
    spikeWeekFrequency: number; // Percentage of weeks with spike games
  };
  
  // Running Back Elite Thresholds  
  RB: {
    yardsAfterContact: number;
    rushingYardsOverExpected: number;
    targetShare: number;
    fantasyPointsPerGame: number;
    spikeGameThreshold: number;
    spikeWeekFrequency: number;
  };
  
  // Quarterback Elite Thresholds
  QB: {
    epaPerPlay: number;
    completionPercentageOverExpected: number;
    rushingYardsPerGame: number;
    fantasyPointsPerGame: number;
    spikeGameThreshold: number;
    spikeWeekFrequency: number;
  };
  
  // Cross-Position Spike Analytics
  spikeCorrelations: {
    metric: string;
    correlation: number;
    description: string;
  }[];
}

/**
 * Prometheus Benchmark Cluster - Elite Thresholds
 * Based on 2024 analysis: Ja'Marr Chase, Saquon Barkley, Lamar Jackson, Josh Allen
 */
export const prometheusBenchmarks: PrometheusBenchmarks = {
  WR: {
    yardsPerRouteRun: 2.2, // Estimated from Chase's elite efficiency
    targetShare: 27.2, // Ja'Marr Chase 2024 baseline
    airYardsShare: 32.7, // Deep target involvement
    wopr: 0.637, // Weighted Opportunity Rating
    spikeGameThreshold: 35.6, // 1.5x average fantasy points
    spikeWeekFrequency: 17.6 // Percentage of spike weeks
  },
  
  RB: {
    yardsAfterContact: 3.2, // Estimated elite threshold
    rushingYardsOverExpected: 200, // Season-long estimated
    targetShare: 13.0, // Saquon Barkley 2024 baseline
    fantasyPointsPerGame: 22.8, // Elite RB performance
    spikeGameThreshold: 34.2, // Spike week threshold
    spikeWeekFrequency: 10.0 // Conservative spike frequency
  },
  
  QB: {
    epaPerPlay: 0.25, // Elite efficiency threshold
    completionPercentageOverExpected: 2.5, // Above expected completion rate
    rushingYardsPerGame: 44.0, // Average of Lamar (54.5) + Allen (33.5)
    fantasyPointsPerGame: 23.9, // Average of elite QBs
    spikeGameThreshold: 35.9, // Average spike threshold
    spikeWeekFrequency: 5.3 // Conservative QB spike rate
  },
  
  spikeCorrelations: [
    {
      metric: "Target Share",
      correlation: 0.85,
      description: "High target share (>25%) strongly correlates with spike week potential"
    },
    {
      metric: "WOPR", 
      correlation: 0.78,
      description: "Weighted Opportunity Rating >0.6 indicates elite weekly ceiling"
    },
    {
      metric: "Rushing Yards (QB)",
      correlation: 0.72, 
      description: "Dual-threat QBs show more consistent scoring floors"
    },
    {
      metric: "Air Yards Share",
      correlation: 0.69,
      description: "Deep target involvement (>30%) creates spike potential"
    }
  ]
};

/**
 * Analyze if a player meets elite thresholds
 */
export function meetsPrometheusBenchmark(
  position: 'QB' | 'RB' | 'WR' | 'TE',
  metrics: any
): {
  isElite: boolean;
  benchmarksExceeded: string[];
  benchmarksMissed: string[];
  overallScore: number;
} {
  const benchmarks = prometheusBenchmarks[position];
  if (!benchmarks) {
    return {
      isElite: false,
      benchmarksExceeded: [],
      benchmarksMissed: ['Position not supported'],
      overallScore: 0
    };
  }
  
  const exceeded: string[] = [];
  const missed: string[] = [];
  let totalBenchmarks = 0;
  let metBenchmarks = 0;
  
  Object.entries(benchmarks).forEach(([key, threshold]) => {
    if (typeof threshold === 'number' && threshold > 0) {
      totalBenchmarks++;
      const playerValue = metrics[key];
      
      if (playerValue && playerValue >= threshold) {
        exceeded.push(`${key}: ${playerValue} (≥${threshold})`);
        metBenchmarks++;
      } else {
        missed.push(`${key}: ${playerValue || 'N/A'} (<${threshold})`);
      }
    }
  });
  
  const overallScore = totalBenchmarks > 0 ? (metBenchmarks / totalBenchmarks) * 100 : 0;
  const isElite = overallScore >= 70; // 70%+ benchmark achievement = elite
  
  return {
    isElite,
    benchmarksExceeded: exceeded,
    benchmarksMissed: missed,
    overallScore: Math.round(overallScore)
  };
}

/**
 * Calculate spike week frequency and thresholds
 */
export function calculateSpikeMetrics(weeklyFantasyPoints: number[]): {
  spikeThreshold: number;
  spikeFrequency: number;
  averagePoints: number;
  spikeWeeks: number[];
} {
  const validWeeks = weeklyFantasyPoints.filter(points => points > 0);
  const averagePoints = validWeeks.reduce((sum, points) => sum + points, 0) / validWeeks.length;
  
  // Spike threshold: 1.5x average or 25+ points, whichever is higher
  const spikeThreshold = Math.max(averagePoints * 1.5, 25);
  
  const spikeWeeks = validWeeks.filter(points => points >= spikeThreshold);
  const spikeFrequency = (spikeWeeks.length / validWeeks.length) * 100;
  
  return {
    spikeThreshold: Math.round(spikeThreshold * 10) / 10,
    spikeFrequency: Math.round(spikeFrequency * 10) / 10,
    averagePoints: Math.round(averagePoints * 10) / 10,
    spikeWeeks: spikeWeeks.map(points => Math.round(points * 10) / 10)
  };
}