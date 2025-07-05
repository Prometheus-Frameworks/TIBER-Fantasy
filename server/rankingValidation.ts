/**
 * Ranking Validation System
 * Compares our enhanced dynasty algorithm against Jake Maraia's expert consensus
 * to ensure we're producing realistic and defensible dynasty valuations
 */

export interface JakeMaraiaRanking {
  name: string;
  position: string;
  rank: number;
  dynastyScore: number;
  tier: string;
}

export interface RankingComparison {
  player: string;
  position: string;
  ourRank: number;
  jakeRank: number;
  ourScore: number;
  jakeScore: number;
  difference: number;
  status: 'Close' | 'Higher' | 'Lower' | 'Major Difference';
  reasoning: string;
}

// Jake Maraia's top WR dynasty rankings (approximate based on his methodology)
const jakeMaraiaWRRankings: JakeMaraiaRanking[] = [
  { name: "Ja'Marr Chase", position: "WR", rank: 1, dynastyScore: 98, tier: "Elite" },
  { name: "Justin Jefferson", position: "WR", rank: 2, dynastyScore: 96, tier: "Elite" },
  { name: "CeeDee Lamb", position: "WR", rank: 3, dynastyScore: 94, tier: "Elite" },
  { name: "Amon-Ra St. Brown", position: "WR", rank: 4, dynastyScore: 92, tier: "Elite" },
  { name: "Puka Nacua", position: "WR", rank: 5, dynastyScore: 90, tier: "Elite" },
  { name: "A.J. Brown", position: "WR", rank: 6, dynastyScore: 88, tier: "Premium" },
  { name: "Malik Nabers", position: "WR", rank: 7, dynastyScore: 86, tier: "Premium" },
  { name: "Drake London", position: "WR", rank: 8, dynastyScore: 84, tier: "Premium" },
  { name: "Cooper Kupp", position: "WR", rank: 9, dynastyScore: 82, tier: "Premium" },
  { name: "Tyreek Hill", position: "WR", rank: 10, dynastyScore: 80, tier: "Premium" },
  { name: "Nico Collins", position: "WR", rank: 11, dynastyScore: 78, tier: "Premium" },
  { name: "Tee Higgins", position: "WR", rank: 12, dynastyScore: 76, tier: "Premium" },
  { name: "Brian Thomas Jr.", position: "WR", rank: 13, dynastyScore: 74, tier: "Strong" },
  { name: "Marvin Harrison Jr.", position: "WR", rank: 14, dynastyScore: 72, tier: "Strong" },
  { name: "DK Metcalf", position: "WR", rank: 15, dynastyScore: 70, tier: "Strong" },
];

class RankingValidator {
  /**
   * Compare our algorithm's WR rankings against Jake Maraia's methodology
   */
  async validateWRRankings(): Promise<{
    comparisons: RankingComparison[];
    summary: {
      averageDifference: number;
      closeMatches: number;
      majorDifferences: number;
      overallAccuracy: string;
    };
  }> {
    // Get our current WR rankings from proprietary rankings
    const { ALL_PROPRIETARY_PLAYERS } = await import('./proprietaryRankings');
    const ourRankings = ALL_PROPRIETARY_PLAYERS.filter(p => p.position === 'WR');
    
    const comparisons: RankingComparison[] = [];
    let totalDifference = 0;
    let closeMatches = 0;
    let majorDifferences = 0;

    // Compare top 15 players
    for (const jakePlayer of jakeMaraiaWRRankings) {
      const ourPlayer = ourRankings.find((p: any) => 
        p.name.toLowerCase().includes(jakePlayer.name.toLowerCase()) ||
        jakePlayer.name.toLowerCase().includes(p.name.toLowerCase())
      );

      if (ourPlayer) {
        const difference = Math.abs(ourPlayer.rank - jakePlayer.rank);
        totalDifference += difference;

        let status: 'Close' | 'Higher' | 'Lower' | 'Major Difference';
        let reasoning = '';

        if (difference <= 2) {
          status = 'Close';
          closeMatches++;
          reasoning = 'Excellent agreement with expert consensus';
        } else if (difference <= 5) {
          if (ourPlayer.rank < jakePlayer.rank) {
            status = 'Higher';
            reasoning = 'We rank higher - possibly overvaluing youth/potential';
          } else {
            status = 'Lower';
            reasoning = 'We rank lower - possibly undervaluing or age penalty';
          }
        } else {
          status = 'Major Difference';
          majorDifferences++;
          if (ourPlayer.rank < jakePlayer.rank) {
            reasoning = 'SIGNIFICANTLY higher - algorithm may be overweighting certain factors';
          } else {
            reasoning = 'SIGNIFICANTLY lower - algorithm may need adjustment';
          }
        }

        comparisons.push({
          player: jakePlayer.name,
          position: jakePlayer.position,
          ourRank: ourPlayer.rank,
          jakeRank: jakePlayer.rank,
          ourScore: ourPlayer.dynastyValue,
          jakeScore: jakePlayer.dynastyScore,
          difference,
          status,
          reasoning
        });
      }
    }

    const averageDifference = totalDifference / comparisons.length;
    let overallAccuracy = '';

    if (averageDifference <= 2) {
      overallAccuracy = 'Excellent - Very close to expert consensus';
    } else if (averageDifference <= 4) {
      overallAccuracy = 'Good - Minor differences, generally aligned';
    } else if (averageDifference <= 6) {
      overallAccuracy = 'Fair - Some systematic differences need investigation';
    } else {
      overallAccuracy = 'Poor - Major algorithmic adjustments needed';
    }

    return {
      comparisons,
      summary: {
        averageDifference: Math.round(averageDifference * 10) / 10,
        closeMatches,
        majorDifferences,
        overallAccuracy
      }
    };
  }

  /**
   * Generate detailed analysis of algorithm performance
   */
  async generateValidationReport(): Promise<string> {
    const validation = await this.validateWRRankings();
    
    let report = "=== DYNASTY ALGORITHM VALIDATION vs JAKE MARAIA ===\n\n";
    report += `Overall Accuracy: ${validation.summary.overallAccuracy}\n`;
    report += `Average Rank Difference: ${validation.summary.averageDifference} positions\n`;
    report += `Close Matches (±2 ranks): ${validation.summary.closeMatches}/${validation.comparisons.length}\n`;
    report += `Major Differences (6+ ranks): ${validation.summary.majorDifferences}/${validation.comparisons.length}\n\n`;

    report += "=== DETAILED COMPARISONS ===\n";
    validation.comparisons.forEach(comp => {
      report += `${comp.player}:\n`;
      report += `  Our Rank: #${comp.ourRank} (${comp.ourScore}) vs Jake: #${comp.jakeRank} (${comp.jakeScore})\n`;
      report += `  Status: ${comp.status} (${comp.difference} rank difference)\n`;
      report += `  Analysis: ${comp.reasoning}\n\n`;
    });

    return report;
  }
}

export const rankingValidator = new RankingValidator();