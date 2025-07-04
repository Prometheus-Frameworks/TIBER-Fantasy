/**
 * Sample Fantasy Moves Data
 * 
 * Provides realistic examples of dynasty moves with authentic player valuations
 * to demonstrate the value-based analysis system.
 */

import { fantasyMovesValuation } from './fantasyMovesValuation';

export interface SampleMove {
  id: string;
  type: 'trade' | 'draft' | 'waiver' | 'free_agent';
  date: string;
  description: string;
  
  // Raw move data
  playersGained: { name: string; position: string; valueAtTime: number; currentValue: number }[];
  playersLost: { name: string; position: string; valueAtTime: number; currentValue: number }[];
  picksGained: { pick: string; year: number; value: number }[];
  picksLost: { pick: string; year: number; value: number }[];
  
  // Calculated values
  valueGained: number;
  valueLost: number;
  netValue: number;
  currentNetValue: number;
  valueChangePercent: number;
  
  // Assessment
  impact: 'smash-win' | 'good-move' | 'fair' | 'poor-move' | 'disaster';
  confidence: number;
}

/**
 * Sample dynasty moves showcasing the valuation system
 */
export const sampleMoves: SampleMove[] = [
  {
    id: 'move_btj_draft_2024',
    type: 'draft',
    date: '2024-05-15',
    description: 'Drafted Brian Thomas Jr. at 1.12',
    playersGained: [
      {
        name: 'Brian Thomas Jr.',
        position: 'WR',
        valueAtTime: 2500, // 1.12 pick value
        currentValue: 8500  // Post-rookie breakout
      }
    ],
    playersLost: [],
    picksGained: [],
    picksLost: [
      { pick: '1.12', year: 2024, value: 2500 }
    ],
    valueGained: 8500,
    valueLost: 2500,
    netValue: 6000,
    currentNetValue: 6000,
    valueChangePercent: 240,
    impact: 'smash-win',
    confidence: 95
  },
  
  {
    id: 'move_puka_waiver_2023',
    type: 'waiver',
    date: '2023-09-12',
    description: 'Claimed Puka Nacua off waivers',
    playersGained: [
      {
        name: 'Puka Nacua',
        position: 'WR',
        valueAtTime: 100, // Waiver claim cost
        currentValue: 9500 // Elite WR2 value
      }
    ],
    playersLost: [],
    picksGained: [],
    picksLost: [],
    valueGained: 9500,
    valueLost: 100,
    netValue: 9400,
    currentNetValue: 9400,
    valueChangePercent: 9400,
    impact: 'smash-win',
    confidence: 98
  },
  
  {
    id: 'move_allen_trade_2023',
    type: 'trade',
    date: '2023-08-20',
    description: 'Traded Saquon Barkley + 2024 1st for Josh Allen',
    playersGained: [
      {
        name: 'Josh Allen',
        position: 'QB',
        valueAtTime: 9800,
        currentValue: 9800
      }
    ],
    playersLost: [
      {
        name: 'Saquon Barkley',
        position: 'RB',
        valueAtTime: 7200,
        currentValue: 5800 // Age decline
      }
    ],
    picksGained: [],
    picksLost: [
      { pick: '1.08', year: 2024, value: 2850 }
    ],
    valueGained: 9800,
    valueLost: 10050,
    netValue: -250,
    currentNetValue: 1150, // Saquon's decline made this better
    valueChangePercent: -2.5,
    impact: 'fair',
    confidence: 88
  },
  
  {
    id: 'move_cmc_disaster_2022',
    type: 'trade',
    date: '2022-03-15',
    description: 'Traded 2022 1.01 + 2023 1st + Calvin Ridley for Christian McCaffrey',
    playersGained: [
      {
        name: 'Christian McCaffrey',
        position: 'RB',
        valueAtTime: 9500,
        currentValue: 6200 // Age/injury concerns
      }
    ],
    playersLost: [
      {
        name: 'Calvin Ridley',
        position: 'WR',
        valueAtTime: 6500,
        currentValue: 7800 // Returned from suspension strong
      }
    ],
    picksGained: [],
    picksLost: [
      { pick: '1.01', year: 2022, value: 4500 }, // Breece Hall
      { pick: '1.05', year: 2023, value: 3400 }  // Zay Flowers
    ],
    valueGained: 6200,
    valueLost: 14400,
    netValue: -8200,
    currentNetValue: -9000,
    valueChangePercent: -86,
    impact: 'disaster',
    confidence: 92
  },
  
  {
    id: 'move_kelce_smart_2023',
    type: 'trade',
    date: '2023-07-10',
    description: 'Traded Travis Kelce for Sam LaPorta + 2024 1st + 2025 2nd',
    playersGained: [
      {
        name: 'Sam LaPorta',
        position: 'TE',
        valueAtTime: 3200,
        currentValue: 6800 // Breakout rookie season
      }
    ],
    playersLost: [
      {
        name: 'Travis Kelce',
        position: 'TE',
        valueAtTime: 7200,
        currentValue: 5500 // Age decline
      }
    ],
    picksGained: [
      { pick: '1.06', year: 2024, value: 3200 },
      { pick: '2.08', year: 2025, value: 1650 }
    ],
    picksLost: [],
    valueGained: 11650,
    valueLost: 5500,
    netValue: 6150,
    currentNetValue: 6150,
    valueChangePercent: 112,
    impact: 'smash-win',
    confidence: 90
  },
  
  {
    id: 'move_dobbins_bust_2023',
    type: 'trade',
    date: '2023-04-20',
    description: 'Traded 2023 1.04 for J.K. Dobbins + 2024 3rd',
    playersGained: [
      {
        name: 'J.K. Dobbins',
        position: 'RB',
        valueAtTime: 4200,
        currentValue: 2100 // Injury concerns
      }
    ],
    playersLost: [],
    picksGained: [
      { pick: '3.07', year: 2024, value: 900 }
    ],
    picksLost: [
      { pick: '1.04', year: 2023, value: 3600 } // Jordan Addison
    ],
    valueGained: 3000,
    valueLost: 3600,
    netValue: -600,
    currentNetValue: -1500,
    valueChangePercent: -17,
    impact: 'poor-move',
    confidence: 85
  },
  
  {
    id: 'move_dak_pickup_2024',
    type: 'free_agent',
    date: '2024-11-15',
    description: 'Picked up Dak Prescott during injury return',
    playersGained: [
      {
        name: 'Dak Prescott',
        position: 'QB',
        valueAtTime: 50, // Free agent pickup
        currentValue: 4200 // Solid QB2 value
      }
    ],
    playersLost: [],
    picksGained: [],
    picksLost: [],
    valueGained: 4200,
    valueLost: 50,
    netValue: 4150,
    currentNetValue: 4150,
    valueChangePercent: 8300,
    impact: 'smash-win',
    confidence: 78
  }
];

/**
 * Generate move statistics for analysis
 */
export function generateMoveStats(moves: SampleMove[]) {
  const totalMoves = moves.length;
  const wins = moves.filter(m => m.netValue > 500).length;
  const losses = moves.filter(m => m.netValue < -500).length;
  const totalValueGained = moves.reduce((sum, m) => sum + Math.max(0, m.netValue), 0);
  const totalValueLost = moves.reduce((sum, m) => sum + Math.max(0, -m.netValue), 0);
  
  return {
    totalMoves,
    wins,
    losses,
    neutral: totalMoves - wins - losses,
    winRate: Math.round((wins / totalMoves) * 100),
    totalValueGained,
    totalValueLost,
    netPortfolioValue: totalValueGained - totalValueLost,
    bestMove: moves.reduce((best, move) => move.netValue > best.netValue ? move : best),
    worstMove: moves.reduce((worst, move) => move.netValue < worst.netValue ? move : worst)
  };
}

/**
 * Get moves by type for filtering
 */
export function getMovesByType(moves: SampleMove[], type: string) {
  return moves.filter(move => move.type === type);
}

/**
 * Get top wins and losses
 */
export function getTopMovesAnalysis(moves: SampleMove[]) {
  const sortedByValue = [...moves].sort((a, b) => b.netValue - a.netValue);
  
  return {
    topWins: sortedByValue.slice(0, 3),
    topLosses: sortedByValue.slice(-3).reverse(),
    smashWins: moves.filter(m => m.impact === 'smash-win'),
    disasters: moves.filter(m => m.impact === 'disaster')
  };
}