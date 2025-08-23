export const DEFAULT_WEIGHTS = {
  redraft: {
    RB: { opp: 0.45, eff: 0.20, role: 0.15, team: 0.10, health: 0.05, sos: 0.05 },
    WR: { opp: 0.30, eff: 0.30, role: 0.15, team: 0.15, health: 0.05, sos: 0.05 },
    TE: { opp: 0.32, eff: 0.23, role: 0.20, team: 0.15, health: 0.05, sos: 0.05 },
    QB: { opp: 0.25, eff: 0.35, role: 0.15, team: 0.20, health: 0.03, sos: 0.02 },
  },
  dynasty: {
    RB: { proj3: 0.40, age: 0.20, role: 0.15, eff: 0.10, team: 0.10, ped: 0.05 },
    WR: { proj3: 0.40, age: 0.20, role: 0.15, eff: 0.15, team: 0.07, ped: 0.03 },
    TE: { proj3: 0.40, age: 0.20, role: 0.15, eff: 0.10, team: 0.10, ped: 0.05 },
    QB: { proj3: 0.40, age: 0.20, role: 0.15, eff: 0.15, team: 0.10, ped: 0.00 },
  },
};

export const REPLACEMENT_LINES = {
  RB: 40, WR: 48, TE: 16, QB: 12
};

export type Position = 'QB' | 'RB' | 'WR' | 'TE';
export type Format = 'redraft' | 'dynasty';

export function parseWeights(weightsStr?: string, format: Format = 'redraft', position: Position = 'RB') {
  if (!weightsStr) return DEFAULT_WEIGHTS[format][position];
  
  // Handle DeepSeek format: "opp:0.50,eff:0.20,role:0.15,team:0.10,health:0.03,sos:0.02"
  const weights = { ...DEFAULT_WEIGHTS[format][position] };
  
  try {
    const pairs = weightsStr.split(',');
    let totalWeight = 0;
    
    for (const pair of pairs) {
      const [key, value] = pair.trim().split(':');
      const numValue = parseFloat(value);
      
      if (key && !isNaN(numValue)) {
        // Map component names based on format
        if (format === 'redraft') {
          if (['opp', 'eff', 'role', 'team', 'health', 'sos'].includes(key)) {
            weights[key as keyof typeof weights] = numValue;
          }
        } else {
          if (['proj3', 'age', 'role', 'eff', 'team', 'ped'].includes(key)) {
            weights[key as keyof typeof weights] = numValue;
          }
        }
        totalWeight += numValue;
      }
    }
    
    // Validate total weight is approximately 1.0 (±0.01 tolerance)
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      console.warn(`Weight sum ${totalWeight} outside tolerance ±0.01 from 1.0, using defaults`);
      return DEFAULT_WEIGHTS[format][position];
    }
    
    return weights;
  } catch (error) {
    console.warn(`Invalid weights format: ${weightsStr}, using defaults`);
    return DEFAULT_WEIGHTS[format][position];
  }
}