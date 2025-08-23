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
  
  const parts = weightsStr.split(',').map(Number);
  
  if (format === 'redraft') {
    return {
      opp: Number.isFinite(parts[0]) ? parts[0] : DEFAULT_WEIGHTS.redraft[position].opp,
      eff: Number.isFinite(parts[1]) ? parts[1] : DEFAULT_WEIGHTS.redraft[position].eff,
      role: Number.isFinite(parts[2]) ? parts[2] : DEFAULT_WEIGHTS.redraft[position].role,
      team: Number.isFinite(parts[3]) ? parts[3] : DEFAULT_WEIGHTS.redraft[position].team,
      health: Number.isFinite(parts[4]) ? parts[4] : DEFAULT_WEIGHTS.redraft[position].health,
      sos: Number.isFinite(parts[5]) ? parts[5] : DEFAULT_WEIGHTS.redraft[position].sos,
    };
  } else {
    return {
      proj3: Number.isFinite(parts[0]) ? parts[0] : DEFAULT_WEIGHTS.dynasty[position].proj3,
      age: Number.isFinite(parts[1]) ? parts[1] : DEFAULT_WEIGHTS.dynasty[position].age,
      role: Number.isFinite(parts[2]) ? parts[2] : DEFAULT_WEIGHTS.dynasty[position].role,
      eff: Number.isFinite(parts[3]) ? parts[3] : DEFAULT_WEIGHTS.dynasty[position].eff,
      team: Number.isFinite(parts[4]) ? parts[4] : DEFAULT_WEIGHTS.dynasty[position].team,
      ped: Number.isFinite(parts[5]) ? parts[5] : DEFAULT_WEIGHTS.dynasty[position].ped,
    };
  }
}