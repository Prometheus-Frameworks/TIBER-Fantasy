/**
 * QB Batch Input v1.3 - Enhanced with Promethean multiplier fields
 * 25 QBs with 2024 projections including rushTDRate, fantasyPointsPerGame, tdRate, explosivePlayCount
 */

export const qbBatchInputV13 = [
  {
    playerName: "Josh Allen",
    season: 2024,
    position: "QB",
    scrambleRate: 0.18,
    rushYPG: 32.5,
    yardsPerCarry: 4.2,
    rushTDRate: 0.085, // 15 rush TDs / 176 rush attempts
    explosiveRushRate: 0.22,
    explosivePlayCount: 18, // 20+ yard plays
    cpoe: 0.025,
    adjustedCompletionPct: 0.645,
    deepAccuracyRate: 0.48,
    pressureToSackRate: 0.15,
    tdRate: 0.062, // (28 pass + 15 rush) / 693 total plays
    fantasyPointsPerGame: 25.3,
    team: {
      passBlockGrade: 78,
      passBlockWinRate: 0.62,
      pressureRateAllowed: 0.31,
      pressureRateOverExpected: -0.05,
      wrYPRR: 1.85,
      wr1DRR: 0.095,
      yardsPerTarget: 7.2,
      yacPerReception: 5.8,
      contestedCatchRate: 0.58,
      routeWinRateRanks: [75, 82, 68, 55],
      offseasonWRUpgrades: ["Amari Cooper trade", "Keon Coleman draft"]
    }
  },
  {
    playerName: "Lamar Jackson",
    season: 2024,
    position: "QB",
    scrambleRate: 0.25,
    rushYPG: 53.8,
    yardsPerCarry: 5.6,
    rushTDRate: 0.018, // 3 rush TDs / 163 rush attempts
    explosiveRushRate: 0.31,
    explosivePlayCount: 22,
    cpoe: 0.045,
    adjustedCompletionPct: 0.678,
    deepAccuracyRate: 0.52,
    pressureToSackRate: 0.12,
    tdRate: 0.067, // (40 pass + 3 rush) / 643 total plays
    fantasyPointsPerGame: 26.8,
    team: {
      passBlockGrade: 72,
      passBlockWinRate: 0.58,
      pressureRateAllowed: 0.35,
      pressureRateOverExpected: 0.02,
      wrYPRR: 1.92,
      wr1DRR: 0.088,
      yardsPerTarget: 7.8,
      yacPerReception: 6.2,
      contestedCatchRate: 0.62,
      routeWinRateRanks: [68, 75, 72, 58],
      offseasonWRUpgrades: ["Zay Flowers development", "Tight end upgrade"]
    }
  },
  {
    playerName: "Jayden Daniels",
    season: 2024,
    position: "QB",
    scrambleRate: 0.22,
    rushYPG: 52.4,
    yardsPerCarry: 5.3,
    rushTDRate: 0.036, // 6 rush TDs / 168 rush attempts
    explosiveRushRate: 0.28,
    explosivePlayCount: 17,
    cpoe: 0.038,
    adjustedCompletionPct: 0.695,
    deepAccuracyRate: 0.45,
    pressureToSackRate: 0.11,
    tdRate: 0.048, // (25 pass + 6 rush) / 646 total plays
    fantasyPointsPerGame: 23.1,
    team: {
      passBlockGrade: 68,
      passBlockWinRate: 0.55,
      pressureRateAllowed: 0.38,
      pressureRateOverExpected: 0.05,
      wrYPRR: 1.78,
      wr1DRR: 0.082,
      yardsPerTarget: 6.9,
      yacPerReception: 5.4,
      contestedCatchRate: 0.55,
      routeWinRateRanks: [62, 68, 65, 52],
      offseasonWRUpgrades: ["Rookie development", "Terry McLaurin security"]
    }
  },
  {
    playerName: "Patrick Mahomes",
    season: 2024,
    position: "QB",
    scrambleRate: 0.14,
    rushYPG: 24.5,
    yardsPerCarry: 4.8,
    rushTDRate: 0.023, // 2 rush TDs / 87 rush attempts
    explosiveRushRate: 0.18,
    explosivePlayCount: 16,
    cpoe: 0.032,
    adjustedCompletionPct: 0.685,
    deepAccuracyRate: 0.50,
    pressureToSackRate: 0.13,
    tdRate: 0.041, // (26 pass + 2 rush) / 686 total plays
    fantasyPointsPerGame: 22.8,
    team: {
      passBlockGrade: 75,
      passBlockWinRate: 0.61,
      pressureRateAllowed: 0.29,
      pressureRateOverExpected: -0.08,
      wrYPRR: 1.95,
      wr1DRR: 0.105,
      yardsPerTarget: 8.1,
      yacPerReception: 6.5,
      contestedCatchRate: 0.65,
      routeWinRateRanks: [88, 92, 85, 78],
      offseasonWRUpgrades: ["Xavier Worthy draft", "Hollywood Brown health"]
    }
  },
  {
    playerName: "Joe Burrow",
    season: 2024,
    position: "QB",
    scrambleRate: 0.08,
    rushYPG: 6.9,
    yardsPerCarry: 3.2,
    rushTDRate: 0.081, // 3 rush TDs / 37 rush attempts
    explosiveRushRate: 0.08,
    explosivePlayCount: 12,
    cpoe: 0.058,
    adjustedCompletionPct: 0.715,
    deepAccuracyRate: 0.56,
    pressureToSackRate: 0.16,
    tdRate: 0.065, // (43 pass + 3 rush) / 707 total plays
    fantasyPointsPerGame: 24.7,
    team: {
      passBlockGrade: 65,
      passBlockWinRate: 0.52,
      pressureRateAllowed: 0.42,
      pressureRateOverExpected: 0.08,
      wrYPRR: 2.15,
      wr1DRR: 0.125,
      yardsPerTarget: 8.8,
      yacPerReception: 6.8,
      contestedCatchRate: 0.68,
      routeWinRateRanks: [95, 88, 92, 85],
      offseasonWRUpgrades: ["Ja'Marr Chase extension", "Tee Higgins security"]
    }
  },
  {
    playerName: "Caleb Williams",
    season: 2024,
    position: "QB",
    scrambleRate: 0.16,
    rushYPG: 28.8,
    yardsPerCarry: 4.7,
    rushTDRate: 0.038, // 4 rush TDs / 104 rush attempts
    explosiveRushRate: 0.19,
    explosivePlayCount: 14,
    cpoe: 0.018,
    adjustedCompletionPct: 0.635,
    deepAccuracyRate: 0.41,
    pressureToSackRate: 0.19,
    tdRate: 0.037, // (20 pass + 4 rush) / 648 total plays
    fantasyPointsPerGame: 18.9,
    team: {
      passBlockGrade: 62,
      passBlockWinRate: 0.48,
      pressureRateAllowed: 0.45,
      pressureRateOverExpected: 0.12,
      wrYPRR: 1.65,
      wr1DRR: 0.075,
      yardsPerTarget: 6.8,
      yacPerReception: 5.2,
      contestedCatchRate: 0.52,
      routeWinRateRanks: [58, 62, 55, 48],
      offseasonWRUpgrades: ["Rookie weapons", "Rome Odunze draft"]
    }
  },
  {
    playerName: "Dak Prescott",
    season: 2024,
    position: "QB",
    scrambleRate: 0.09,
    rushYPG: 6.2,
    yardsPerCarry: 3.8,
    rushTDRate: 0.074, // 2 rush TDs / 27 rush attempts
    explosiveRushRate: 0.11,
    explosivePlayCount: 11,
    cpoe: 0.025,
    adjustedCompletionPct: 0.658,
    deepAccuracyRate: 0.47,
    pressureToSackRate: 0.17,
    tdRate: 0.048, // (29 pass + 2 rush) / 645 total plays
    fantasyPointsPerGame: 21.5,
    team: {
      passBlockGrade: 73,
      passBlockWinRate: 0.59,
      pressureRateAllowed: 0.32,
      pressureRateOverExpected: -0.02,
      wrYPRR: 1.82,
      wr1DRR: 0.089,
      yardsPerTarget: 7.3,
      yacPerReception: 5.7,
      contestedCatchRate: 0.57,
      routeWinRateRanks: [72, 75, 68, 62],
      offseasonWRUpgrades: ["CeeDee Lamb extension", "Weapon development"]
    }
  },
  {
    playerName: "Tua Tagovailoa",
    season: 2024,
    position: "QB",
    scrambleRate: 0.04,
    rushYPG: 2.5,
    yardsPerCarry: 2.8,
    rushTDRate: 0.063, // 1 rush TD / 16 rush attempts
    explosiveRushRate: 0.06,
    explosivePlayCount: 8,
    cpoe: 0.048,
    adjustedCompletionPct: 0.705,
    deepAccuracyRate: 0.44,
    pressureToSackRate: 0.22,
    tdRate: 0.042, // (19 pass + 1 rush) / 478 total plays
    fantasyPointsPerGame: 19.8,
    team: {
      passBlockGrade: 66,
      passBlockWinRate: 0.51,
      pressureRateAllowed: 0.41,
      pressureRateOverExpected: 0.06,
      wrYPRR: 2.05,
      wr1DRR: 0.098,
      yardsPerTarget: 8.2,
      yacPerReception: 6.9,
      contestedCatchRate: 0.61,
      routeWinRateRanks: [85, 88, 82, 75],
      offseasonWRUpgrades: ["Tyreek Hill prime", "Jaylen Waddle development"]
    }
  },
  {
    playerName: "Sam Darnold",
    season: 2024,
    position: "QB",
    scrambleRate: 0.08,
    rushYPG: 8.7,
    yardsPerCarry: 3.9,
    rushTDRate: 0.132, // 5 rush TDs / 38 rush attempts
    explosiveRushRate: 0.12,
    explosivePlayCount: 13,
    cpoe: 0.032,
    adjustedCompletionPct: 0.672,
    deepAccuracyRate: 0.49,
    pressureToSackRate: 0.16,
    tdRate: 0.058, // (35 pass + 5 rush) / 688 total plays
    fantasyPointsPerGame: 23.4,
    team: {
      passBlockGrade: 69,
      passBlockWinRate: 0.54,
      pressureRateAllowed: 0.37,
      pressureRateOverExpected: 0.04,
      wrYPRR: 1.88,
      wr1DRR: 0.095,
      yardsPerTarget: 7.6,
      yacPerReception: 6.1,
      contestedCatchRate: 0.59,
      routeWinRateRanks: [75, 78, 72, 65],
      offseasonWRUpgrades: ["Justin Jefferson elite", "Jordan Addison development"]
    }
  },
  {
    playerName: "Bo Nix",
    season: 2024,
    position: "QB",
    scrambleRate: 0.14,
    rushYPG: 25.3,
    yardsPerCarry: 4.6,
    rushTDRate: 0.043, // 4 rush TDs / 93 rush attempts
    explosiveRushRate: 0.17,
    explosivePlayCount: 15,
    cpoe: 0.025,
    adjustedCompletionPct: 0.675,
    deepAccuracyRate: 0.42,
    pressureToSackRate: 0.17,
    tdRate: 0.048, // (29 pass + 4 rush) / 688 total plays
    fantasyPointsPerGame: 19.2,
    team: {
      passBlockGrade: 63,
      passBlockWinRate: 0.50,
      pressureRateAllowed: 0.43,
      pressureRateOverExpected: 0.10,
      wrYPRR: 1.62,
      wr1DRR: 0.072,
      yardsPerTarget: 6.5,
      yacPerReception: 5.1,
      contestedCatchRate: 0.51,
      routeWinRateRanks: [48, 52, 45, 38],
      offseasonWRUpgrades: ["Courtland Sutton veteran", "Rookie development"]
    }
  },
  {
    playerName: "Brock Purdy",
    season: 2024,
    position: "QB",
    scrambleRate: 0.06,
    rushYPG: 4.2,
    yardsPerCarry: 3.1,
    rushTDRate: 0.029, // 1 rush TD / 34 rush attempts
    explosiveRushRate: 0.09,
    explosivePlayCount: 9,
    cpoe: 0.062,
    adjustedCompletionPct: 0.698,
    deepAccuracyRate: 0.51,
    pressureToSackRate: 0.14,
    tdRate: 0.055, // (20 pass + 1 rush) / 382 total plays
    fantasyPointsPerGame: 18.5,
    team: {
      passBlockGrade: 74,
      passBlockWinRate: 0.58,
      pressureRateAllowed: 0.33,
      pressureRateOverExpected: -0.03,
      wrYPRR: 2.12,
      wr1DRR: 0.108,
      yardsPerTarget: 8.5,
      yacPerReception: 7.2,
      contestedCatchRate: 0.64,
      routeWinRateRanks: [82, 88, 85, 72],
      offseasonWRUpgrades: ["Brandon Aiyuk extension", "Weapons security"]
    }
  },
  {
    playerName: "Jalen Hurts",
    season: 2024,
    position: "QB",
    scrambleRate: 0.15,
    rushYPG: 38.2,
    yardsPerCarry: 4.9,
    rushTDRate: 0.088, // 13 rush TDs / 148 rush attempts
    explosiveRushRate: 0.20,
    explosivePlayCount: 19,
    cpoe: 0.018,
    adjustedCompletionPct: 0.685,
    deepAccuracyRate: 0.43,
    pressureToSackRate: 0.16,
    tdRate: 0.045, // (15 pass + 13 rush) / 622 total plays
    fantasyPointsPerGame: 21.8,
    team: {
      passBlockGrade: 71,
      passBlockWinRate: 0.56,
      pressureRateAllowed: 0.36,
      pressureRateOverExpected: 0.01,
      wrYPRR: 1.75,
      wr1DRR: 0.085,
      yardsPerTarget: 7.1,
      yacPerReception: 5.5,
      contestedCatchRate: 0.56,
      routeWinRateRanks: [65, 68, 62, 58],
      offseasonWRUpgrades: ["AJ Brown health", "DeVonta Smith consistency"]
    }
  },
  {
    playerName: "Anthony Richardson",
    season: 2024,
    position: "QB",
    scrambleRate: 0.20,
    rushYPG: 35.8,
    yardsPerCarry: 5.2,
    rushTDRate: 0.055, // 4 rush TDs / 73 rush attempts
    explosiveRushRate: 0.25,
    explosivePlayCount: 16,
    cpoe: 0.012,
    adjustedCompletionPct: 0.598,
    deepAccuracyRate: 0.46,
    pressureToSackRate: 0.18,
    tdRate: 0.038, // (4 pass + 4 rush) / 212 total plays
    fantasyPointsPerGame: 17.2,
    team: {
      passBlockGrade: 67,
      passBlockWinRate: 0.53,
      pressureRateAllowed: 0.39,
      pressureRateOverExpected: 0.07,
      wrYPRR: 1.72,
      wr1DRR: 0.078,
      yardsPerTarget: 6.8,
      yacPerReception: 5.3,
      contestedCatchRate: 0.53,
      routeWinRateRanks: [58, 62, 55, 48],
      offseasonWRUpgrades: ["Rookie growth", "Jonathan Taylor support"]
    }
  },
  {
    playerName: "CJ Stroud",
    season: 2024,
    position: "QB",
    scrambleRate: 0.09,
    rushYPG: 12.5,
    yardsPerCarry: 3.8,
    rushTDRate: 0.030, // 1 rush TD / 33 rush attempts
    explosiveRushRate: 0.12,
    explosivePlayCount: 11,
    cpoe: 0.035,
    adjustedCompletionPct: 0.663,
    deepAccuracyRate: 0.48,
    pressureToSackRate: 0.15,
    tdRate: 0.037, // (20 pass + 1 rush) / 568 total plays
    fantasyPointsPerGame: 18.8,
    team: {
      passBlockGrade: 64,
      passBlockWinRate: 0.49,
      pressureRateAllowed: 0.44,
      pressureRateOverExpected: 0.09,
      wrYPRR: 1.68,
      wr1DRR: 0.076,
      yardsPerTarget: 6.9,
      yacPerReception: 5.1,
      contestedCatchRate: 0.54,
      routeWinRateRanks: [55, 58, 52, 45],
      offseasonWRUpgrades: ["Stefon Diggs trade", "Tank Dell health"]
    }
  },
  {
    playerName: "Jared Goff",
    season: 2024,
    position: "QB",
    scrambleRate: 0.05,
    rushYPG: 3.8,
    yardsPerCarry: 2.9,
    rushTDRate: 0.048, // 1 rush TD / 21 rush attempts
    explosiveRushRate: 0.07,
    explosivePlayCount: 10,
    cpoe: 0.052,
    adjustedCompletionPct: 0.722,
    deepAccuracyRate: 0.49,
    pressureToSackRate: 0.13,
    tdRate: 0.045, // (31 pass + 1 rush) / 712 total plays
    fantasyPointsPerGame: 21.2,
    team: {
      passBlockGrade: 76,
      passBlockWinRate: 0.63,
      pressureRateAllowed: 0.28,
      pressureRateOverExpected: -0.09,
      wrYPRR: 1.95,
      wr1DRR: 0.098,
      yardsPerTarget: 7.8,
      yacPerReception: 6.4,
      contestedCatchRate: 0.61,
      routeWinRateRanks: [78, 82, 75, 68],
      offseasonWRUpgrades: ["Amon-Ra elite", "Jameson Williams growth"]
    }
  },
  {
    playerName: "Drake Maye",
    season: 2024,
    position: "QB",
    scrambleRate: 0.17,
    rushYPG: 22.8,
    yardsPerCarry: 4.4,
    rushTDRate: 0.025, // 1 rush TD / 40 rush attempts
    explosiveRushRate: 0.15,
    explosivePlayCount: 12,
    cpoe: 0.028,
    adjustedCompletionPct: 0.665,
    deepAccuracyRate: 0.44,
    pressureToSackRate: 0.20,
    tdRate: 0.033, // (15 pass + 1 rush) / 485 total plays
    fantasyPointsPerGame: 16.8,
    team: {
      passBlockGrade: 58,
      passBlockWinRate: 0.45,
      pressureRateAllowed: 0.47,
      pressureRateOverExpected: 0.14,
      wrYPRR: 1.58,
      wr1DRR: 0.068,
      yardsPerTarget: 6.2,
      yacPerReception: 4.8,
      contestedCatchRate: 0.49,
      routeWinRateRanks: [42, 48, 38, 35],
      offseasonWRUpgrades: ["Rookie adjustments", "Kendrick Bourne return"]
    }
  },
  {
    playerName: "Kyler Murray",
    season: 2024,
    position: "QB",
    scrambleRate: 0.13,
    rushYPG: 28.5,
    yardsPerCarry: 4.8,
    rushTDRate: 0.034, // 2 rush TDs / 59 rush attempts
    explosiveRushRate: 0.17,
    explosivePlayCount: 14,
    cpoe: 0.022,
    adjustedCompletionPct: 0.692,
    deepAccuracyRate: 0.41,
    pressureToSackRate: 0.16,
    tdRate: 0.035, // (17 pass + 2 rush) / 542 total plays
    fantasyPointsPerGame: 18.5,
    team: {
      passBlockGrade: 61,
      passBlockWinRate: 0.47,
      pressureRateAllowed: 0.42,
      pressureRateOverExpected: 0.08,
      wrYPRR: 1.68,
      wr1DRR: 0.074,
      yardsPerTarget: 6.7,
      yacPerReception: 5.2,
      contestedCatchRate: 0.52,
      routeWinRateRanks: [52, 55, 48, 42],
      offseasonWRUpgrades: ["Marvin Harrison Jr. draft", "Young receivers"]
    }
  },
  {
    playerName: "Jordan Love",
    season: 2024,
    position: "QB",
    scrambleRate: 0.11,
    rushYPG: 15.2,
    yardsPerCarry: 4.1,
    rushTDRate: 0.036, // 1 rush TD / 28 rush attempts
    explosiveRushRate: 0.14,
    explosivePlayCount: 12,
    cpoe: 0.015,
    adjustedCompletionPct: 0.625,
    deepAccuracyRate: 0.46,
    pressureToSackRate: 0.18,
    tdRate: 0.042, // (25 pass + 1 rush) / 619 total plays
    fantasyPointsPerGame: 19.8,
    team: {
      passBlockGrade: 69,
      passBlockWinRate: 0.54,
      pressureRateAllowed: 0.38,
      pressureRateOverExpected: 0.03,
      wrYPRR: 1.82,
      wr1DRR: 0.088,
      yardsPerTarget: 7.2,
      yacPerReception: 5.9,
      contestedCatchRate: 0.58,
      routeWinRateRanks: [68, 72, 65, 58],
      offseasonWRUpgrades: ["Christian Watson health", "Romeo Doubs growth"]
    }
  },
  {
    playerName: "Justin Herbert",
    season: 2024,
    position: "QB",
    scrambleRate: 0.07,
    rushYPG: 8.5,
    yardsPerCarry: 3.6,
    rushTDRate: 0.025, // 1 rush TD / 40 rush attempts
    explosiveRushRate: 0.10,
    explosivePlayCount: 11,
    cpoe: 0.038,
    adjustedCompletionPct: 0.675,
    deepAccuracyRate: 0.52,
    pressureToSackRate: 0.14,
    tdRate: 0.038, // (18 pass + 1 rush) / 500 total plays
    fantasyPointsPerGame: 17.2,
    team: {
      passBlockGrade: 68,
      passBlockWinRate: 0.52,
      pressureRateAllowed: 0.39,
      pressureRateOverExpected: 0.05,
      wrYPRR: 1.75,
      wr1DRR: 0.082,
      yardsPerTarget: 7.1,
      yacPerReception: 5.6,
      contestedCatchRate: 0.56,
      routeWinRateRanks: [62, 68, 58, 52],
      offseasonWRUpgrades: ["Ladd McConkey draft", "DJ Chark depth"]
    }
  },
  {
    playerName: "Daniel Jones",
    season: 2024,
    position: "QB",
    scrambleRate: 0.12,
    rushYPG: 18.5,
    yardsPerCarry: 4.3,
    rushTDRate: 0.024, // 1 rush TD / 42 rush attempts
    explosiveRushRate: 0.14,
    explosivePlayCount: 10,
    cpoe: 0.008,
    adjustedCompletionPct: 0.638,
    deepAccuracyRate: 0.38,
    pressureToSackRate: 0.21,
    tdRate: 0.025, // (8 pass + 1 rush) / 360 total plays
    fantasyPointsPerGame: 14.2,
    team: {
      passBlockGrade: 59,
      passBlockWinRate: 0.46,
      pressureRateAllowed: 0.46,
      pressureRateOverExpected: 0.11,
      wrYPRR: 1.55,
      wr1DRR: 0.065,
      yardsPerTarget: 6.1,
      yacPerReception: 4.9,
      contestedCatchRate: 0.48,
      routeWinRateRanks: [45, 48, 42, 38],
      offseasonWRUpgrades: ["Malik Nabers draft", "Young weapons"]
    }
  },
  {
    playerName: "Trevor Lawrence",
    season: 2024,
    position: "QB",
    scrambleRate: 0.10,
    rushYPG: 12.8,
    yardsPerCarry: 3.9,
    rushTDRate: 0.031, // 1 rush TD / 32 rush attempts
    explosiveRushRate: 0.12,
    explosivePlayCount: 9,
    cpoe: 0.012,
    adjustedCompletionPct: 0.655,
    deepAccuracyRate: 0.42,
    pressureToSackRate: 0.17,
    tdRate: 0.031, // (14 pass + 1 rush) / 484 total plays
    fantasyPointsPerGame: 16.5,
    team: {
      passBlockGrade: 63,
      passBlockWinRate: 0.49,
      pressureRateAllowed: 0.41,
      pressureRateOverExpected: 0.07,
      wrYPRR: 1.68,
      wr1DRR: 0.075,
      yardsPerTarget: 6.8,
      yacPerReception: 5.2,
      contestedCatchRate: 0.52,
      routeWinRateRanks: [55, 58, 52, 45],
      offseasonWRUpgrades: ["Calvin Ridley addition", "Brian Thomas Jr. draft"]
    }
  },
  {
    playerName: "Russell Wilson",
    season: 2024,
    position: "QB",
    scrambleRate: 0.08,
    rushYPG: 11.2,
    yardsPerCarry: 3.7,
    rushTDRate: 0.034, // 1 rush TD / 29 rush attempts
    explosiveRushRate: 0.10,
    explosivePlayCount: 10,
    cpoe: 0.028,
    adjustedCompletionPct: 0.645,
    deepAccuracyRate: 0.49,
    pressureToSackRate: 0.15,
    tdRate: 0.042, // (16 pass + 1 rush) / 405 total plays
    fantasyPointsPerGame: 18.1,
    team: {
      passBlockGrade: 70,
      passBlockWinRate: 0.55,
      pressureRateAllowed: 0.36,
      pressureRateOverExpected: 0.01,
      wrYPRR: 1.88,
      wr1DRR: 0.092,
      yardsPerTarget: 7.5,
      yacPerReception: 6.0,
      contestedCatchRate: 0.59,
      routeWinRateRanks: [72, 75, 68, 62],
      offseasonWRUpgrades: ["George Pickens growth", "Van Jefferson addition"]
    }
  },
  {
    playerName: "Aaron Rodgers",
    season: 2024,
    position: "QB",
    scrambleRate: 0.05,
    rushYPG: 4.5,
    yardsPerCarry: 3.2,
    rushTDRate: 0.000, // 0 rush TDs / 22 rush attempts
    explosiveRushRate: 0.05,
    explosivePlayCount: 8,
    cpoe: 0.045,
    adjustedCompletionPct: 0.638,
    deepAccuracyRate: 0.44,
    pressureToSackRate: 0.16,
    tdRate: 0.038, // (28 pass + 0 rush) / 738 total plays
    fantasyPointsPerGame: 17.8,
    team: {
      passBlockGrade: 65,
      passBlockWinRate: 0.51,
      pressureRateAllowed: 0.40,
      pressureRateOverExpected: 0.06,
      wrYPRR: 1.85,
      wr1DRR: 0.089,
      yardsPerTarget: 7.3,
      yacPerReception: 5.8,
      contestedCatchRate: 0.57,
      routeWinRateRanks: [68, 72, 65, 58],
      offseasonWRUpgrades: ["Garrett Wilson elite", "Mike Williams addition"]
    }
  },
  {
    playerName: "Kirk Cousins",
    season: 2024,
    position: "QB",
    scrambleRate: 0.04,
    rushYPG: 2.8,
    yardsPerCarry: 2.5,
    rushTDRate: 0.000, // 0 rush TDs / 18 rush attempts
    explosiveRushRate: 0.06,
    explosivePlayCount: 7,
    cpoe: 0.032,
    adjustedCompletionPct: 0.688,
    deepAccuracyRate: 0.46,
    pressureToSackRate: 0.18,
    tdRate: 0.042, // (18 pass + 0 rush) / 428 total plays
    fantasyPointsPerGame: 16.8,
    team: {
      passBlockGrade: 67,
      passBlockWinRate: 0.53,
      pressureRateAllowed: 0.38,
      pressureRateOverExpected: 0.04,
      wrYPRR: 1.78,
      wr1DRR: 0.085,
      yardsPerTarget: 7.0,
      yacPerReception: 5.5,
      contestedCatchRate: 0.55,
      routeWinRateRanks: [62, 68, 58, 52],
      offseasonWRUpgrades: ["Drake London development", "Bijan Robinson support"]
    }
  },
  {
    playerName: "Geno Smith",
    season: 2024,
    position: "QB",
    scrambleRate: 0.06,
    rushYPG: 7.8,
    yardsPerCarry: 3.4,
    rushTDRate: 0.043, // 1 rush TD / 23 rush attempts
    explosiveRushRate: 0.09,
    explosivePlayCount: 9,
    cpoe: 0.025,
    adjustedCompletionPct: 0.695,
    deepAccuracyRate: 0.41,
    pressureToSackRate: 0.17,
    tdRate: 0.035, // (20 pass + 1 rush) / 600 total plays
    fantasyPointsPerGame: 17.5,
    team: {
      passBlockGrade: 64,
      passBlockWinRate: 0.50,
      pressureRateAllowed: 0.41,
      pressureRateOverExpected: 0.07,
      wrYPRR: 1.72,
      wr1DRR: 0.078,
      yardsPerTarget: 6.9,
      yacPerReception: 5.3,
      contestedCatchRate: 0.53,
      routeWinRateRanks: [58, 62, 55, 48],
      offseasonWRUpgrades: ["DK Metcalf consistency", "Tyler Lockett veteran"]
    }
  }
];