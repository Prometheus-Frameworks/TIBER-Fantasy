export type ForgeLabInputDef = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
};

export type ForgeLabEquation = {
  id: string;
  name: string;
  description: string;
  inputs: ForgeLabInputDef[];
  compute: (inputs: Record<string, number>) => {
    outputs: Record<string, number>;
    steps: string[];
  };
};

const TD_ENVIRONMENT_BOOST: ForgeLabEquation = {
  id: 'TD_ENVIRONMENT_BOOST',
  name: 'TD Environment Boost',
  description: 'Calculates touchdown scoring environment boost based on offensive line, QB, target share, separation, and catch probability factors.',
  inputs: [
    { key: 'p_OL', label: 'OL Success Rate (p_OL)', min: 0, max: 1, step: 0.01, defaultValue: 0.65 },
    { key: 'p_QB', label: 'QB Accuracy (p_QB)', min: 0, max: 1, step: 0.01, defaultValue: 0.72 },
    { key: 'p_Tgt', label: 'Target Share (p_Tgt)', min: 0, max: 1, step: 0.01, defaultValue: 0.25 },
    { key: 'p_Sep', label: 'Separation Rate (p_Sep)', min: 0, max: 1, step: 0.01, defaultValue: 0.58 },
    { key: 'p_Catch', label: 'Catch Probability (p_Catch)', min: 0, max: 1, step: 0.01, defaultValue: 0.90 },
    { key: 'mu_league', label: 'League Mean (μ_league)', min: 0, max: 0.2, step: 0.001, defaultValue: 0.05 },
    { key: 'sigma_league', label: 'League Std Dev (σ_league)', min: 0.001, max: 0.1, step: 0.001, defaultValue: 0.015 },
    { key: 'k', label: 'Scaling Factor (k)', min: 0.1, max: 2, step: 0.1, defaultValue: 0.8 },
    { key: 'gamma', label: 'Boost Multiplier (γ)', min: 0, max: 1, step: 0.05, defaultValue: 0.25 },
    { key: 'TD_alpha', label: 'Base TD Alpha (TD_α)', min: 0, max: 100, step: 1, defaultValue: 75 },
  ],
  compute: (inputs: Record<string, number>) => {
    const { p_OL, p_QB, p_Tgt, p_Sep, p_Catch, mu_league, sigma_league, k, gamma, TD_alpha } = inputs;

    const p_success = p_OL * p_QB * p_Tgt * p_Sep * p_Catch;

    const z = (p_success - mu_league) / sigma_league;

    const E = Math.tanh(k * z);

    const TD_alpha_star = TD_alpha * (1 + gamma * E);

    const steps = [
      `p_success = p_OL × p_QB × p_Tgt × p_Sep × p_Catch`,
      `p_success = ${p_OL.toFixed(4)} × ${p_QB.toFixed(4)} × ${p_Tgt.toFixed(4)} × ${p_Sep.toFixed(4)} × ${p_Catch.toFixed(4)} = ${p_success.toFixed(6)}`,
      ``,
      `z = (p_success - μ_league) / σ_league`,
      `z = (${p_success.toFixed(6)} - ${mu_league.toFixed(4)}) / ${sigma_league.toFixed(4)} = ${z.toFixed(4)}`,
      ``,
      `E = tanh(k × z)`,
      `E = tanh(${k.toFixed(2)} × ${z.toFixed(4)}) = ${E.toFixed(4)}`,
      ``,
      `TD_α* = TD_α × (1 + γ × E)`,
      `TD_α* = ${TD_alpha.toFixed(1)} × (1 + ${gamma.toFixed(2)} × ${E.toFixed(4)}) = ${TD_alpha_star.toFixed(2)}`,
    ];

    return {
      outputs: {
        p_success: parseFloat(p_success.toFixed(6)),
        z: parseFloat(z.toFixed(4)),
        E: parseFloat(E.toFixed(4)),
        TD_alpha_star: parseFloat(TD_alpha_star.toFixed(2)),
      },
      steps,
    };
  },
};

export const FORGE_LAB_EQUATIONS: ForgeLabEquation[] = [
  TD_ENVIRONMENT_BOOST,
];

export function getEquationById(id: string): ForgeLabEquation | undefined {
  return FORGE_LAB_EQUATIONS.find(eq => eq.id === id);
}
