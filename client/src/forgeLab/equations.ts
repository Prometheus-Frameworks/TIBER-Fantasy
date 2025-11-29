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

const EPA_SUCCESS_BLEND: ForgeLabEquation = {
  id: 'EPA_SUCCESS_BLEND',
  name: 'EPA Success Blend',
  description: 'Combines EPA per play with success rate to create a balanced efficiency score. Uses NFLfastR epa and success fields.',
  inputs: [
    { key: 'epa_per_play', label: 'EPA Per Play', min: -0.5, max: 0.5, step: 0.01, defaultValue: 0.15 },
    { key: 'success_rate', label: 'Success Rate (%)', min: 0, max: 100, step: 1, defaultValue: 48 },
    { key: 'plays', label: 'Sample Size (plays)', min: 1, max: 500, step: 1, defaultValue: 100 },
    { key: 'w_epa', label: 'EPA Weight', min: 0, max: 1, step: 0.05, defaultValue: 0.6 },
    { key: 'w_success', label: 'Success Rate Weight', min: 0, max: 1, step: 0.05, defaultValue: 0.4 },
    { key: 'min_plays', label: 'Min Plays Threshold', min: 1, max: 100, step: 1, defaultValue: 25 },
  ],
  compute: (inputs: Record<string, number>) => {
    const { epa_per_play, success_rate, plays, w_epa, w_success, min_plays } = inputs;

    const epa_normalized = Math.min(100, Math.max(0, (epa_per_play + 0.3) / 0.6 * 100));
    const success_normalized = success_rate;
    const sample_penalty = plays >= min_plays ? 1.0 : plays / min_plays;
    const raw_blend = (w_epa * epa_normalized + w_success * success_normalized) / (w_epa + w_success);
    const efficiency_score = raw_blend * sample_penalty;

    const steps = [
      `Step 1: Normalize EPA to 0-100 scale`,
      `EPA_norm = ((${epa_per_play.toFixed(3)} + 0.3) / 0.6) × 100 = ${epa_normalized.toFixed(2)}`,
      ``,
      `Step 2: Success rate already on 0-100 scale`,
      `Success_norm = ${success_normalized.toFixed(2)}`,
      ``,
      `Step 3: Calculate sample size penalty`,
      `Sample_penalty = ${plays} >= ${min_plays} ? 1.0 : ${plays}/${min_plays} = ${sample_penalty.toFixed(3)}`,
      ``,
      `Step 4: Weighted blend`,
      `Raw_blend = (${w_epa.toFixed(2)} × ${epa_normalized.toFixed(2)} + ${w_success.toFixed(2)} × ${success_normalized.toFixed(2)}) / ${(w_epa + w_success).toFixed(2)}`,
      `Raw_blend = ${raw_blend.toFixed(2)}`,
      ``,
      `Step 5: Apply sample penalty`,
      `Efficiency_score = ${raw_blend.toFixed(2)} × ${sample_penalty.toFixed(3)} = ${efficiency_score.toFixed(2)}`,
    ];

    return {
      outputs: {
        epa_normalized: parseFloat(epa_normalized.toFixed(2)),
        success_normalized: parseFloat(success_normalized.toFixed(2)),
        sample_penalty: parseFloat(sample_penalty.toFixed(3)),
        raw_blend: parseFloat(raw_blend.toFixed(2)),
        efficiency_score: parseFloat(efficiency_score.toFixed(2)),
      },
      steps,
    };
  },
};

const YAC_OVER_EXPECTED: ForgeLabEquation = {
  id: 'YAC_OVER_EXPECTED',
  name: 'YAC Over Expected',
  description: 'Calculates yards after catch delta (actual vs expected) and its impact on receiver value. Uses NFLfastR yac_epa and xyac_epa fields.',
  inputs: [
    { key: 'yac_epa', label: 'Actual YAC EPA', min: -50, max: 50, step: 0.5, defaultValue: 12.5 },
    { key: 'xyac_epa', label: 'Expected YAC EPA (xYAC)', min: -50, max: 50, step: 0.5, defaultValue: 8.0 },
    { key: 'targets', label: 'Targets', min: 1, max: 200, step: 1, defaultValue: 80 },
    { key: 'yac_weight', label: 'YAC Skill Weight', min: 0, max: 1, step: 0.05, defaultValue: 0.3 },
    { key: 'base_alpha', label: 'Base Alpha Score', min: 0, max: 100, step: 1, defaultValue: 70 },
  ],
  compute: (inputs: Record<string, number>) => {
    const { yac_epa, xyac_epa, targets, yac_weight, base_alpha } = inputs;

    const yac_delta = yac_epa - xyac_epa;
    const yac_delta_per_target = yac_delta / targets;
    const yac_percentile = Math.min(100, Math.max(0, 50 + (yac_delta_per_target * 500)));
    const yac_adjustment = (yac_percentile - 50) * yac_weight;
    const adjusted_alpha = Math.min(100, Math.max(0, base_alpha + yac_adjustment));

    const steps = [
      `Step 1: Calculate YAC Delta (actual - expected)`,
      `YAC_delta = ${yac_epa.toFixed(2)} - ${xyac_epa.toFixed(2)} = ${yac_delta.toFixed(2)}`,
      ``,
      `Step 2: Normalize per target`,
      `YAC_delta_per_target = ${yac_delta.toFixed(2)} / ${targets} = ${yac_delta_per_target.toFixed(4)}`,
      ``,
      `Step 3: Convert to percentile (50 = league avg)`,
      `YAC_percentile = 50 + (${yac_delta_per_target.toFixed(4)} × 500) = ${yac_percentile.toFixed(2)}`,
      ``,
      `Step 4: Calculate alpha adjustment`,
      `YAC_adjustment = (${yac_percentile.toFixed(2)} - 50) × ${yac_weight.toFixed(2)} = ${yac_adjustment.toFixed(2)}`,
      ``,
      `Step 5: Apply to base alpha`,
      `Adjusted_α = ${base_alpha.toFixed(1)} + ${yac_adjustment.toFixed(2)} = ${adjusted_alpha.toFixed(2)}`,
    ];

    return {
      outputs: {
        yac_delta: parseFloat(yac_delta.toFixed(2)),
        yac_delta_per_target: parseFloat(yac_delta_per_target.toFixed(4)),
        yac_percentile: parseFloat(yac_percentile.toFixed(2)),
        yac_adjustment: parseFloat(yac_adjustment.toFixed(2)),
        adjusted_alpha: parseFloat(adjusted_alpha.toFixed(2)),
      },
      steps,
    };
  },
};

const TARGET_SHARE_INDEX: ForgeLabEquation = {
  id: 'TARGET_SHARE_INDEX',
  name: 'Target Share Index',
  description: 'Calculates normalized target share with team context adjustment. Higher team pass volume increases the value of target share.',
  inputs: [
    { key: 'player_targets', label: 'Player Targets', min: 0, max: 200, step: 1, defaultValue: 95 },
    { key: 'team_targets', label: 'Team Total Targets', min: 100, max: 600, step: 10, defaultValue: 380 },
    { key: 'league_avg_targets', label: 'League Avg Team Targets', min: 200, max: 500, step: 10, defaultValue: 340 },
    { key: 'games_played', label: 'Games Played', min: 1, max: 17, step: 1, defaultValue: 14 },
    { key: 'target_share_weight', label: 'Target Share Weight', min: 0, max: 1, step: 0.05, defaultValue: 0.35 },
  ],
  compute: (inputs: Record<string, number>) => {
    const { player_targets, team_targets, league_avg_targets, games_played, target_share_weight } = inputs;

    const target_share = (player_targets / team_targets) * 100;
    const targets_per_game = player_targets / games_played;
    const team_volume_factor = team_targets / league_avg_targets;
    const adjusted_target_share = target_share * team_volume_factor;
    const target_share_index = adjusted_target_share * target_share_weight;

    const steps = [
      `Step 1: Calculate raw target share`,
      `Target_share = (${player_targets} / ${team_targets}) × 100 = ${target_share.toFixed(2)}%`,
      ``,
      `Step 2: Calculate targets per game`,
      `Targets_per_game = ${player_targets} / ${games_played} = ${targets_per_game.toFixed(2)}`,
      ``,
      `Step 3: Calculate team volume factor`,
      `Volume_factor = ${team_targets} / ${league_avg_targets} = ${team_volume_factor.toFixed(3)}`,
      ``,
      `Step 4: Adjust target share by volume`,
      `Adjusted_share = ${target_share.toFixed(2)} × ${team_volume_factor.toFixed(3)} = ${adjusted_target_share.toFixed(2)}`,
      ``,
      `Step 5: Apply weight for final index`,
      `Target_share_index = ${adjusted_target_share.toFixed(2)} × ${target_share_weight.toFixed(2)} = ${target_share_index.toFixed(2)}`,
    ];

    return {
      outputs: {
        target_share: parseFloat(target_share.toFixed(2)),
        targets_per_game: parseFloat(targets_per_game.toFixed(2)),
        team_volume_factor: parseFloat(team_volume_factor.toFixed(3)),
        adjusted_target_share: parseFloat(adjusted_target_share.toFixed(2)),
        target_share_index: parseFloat(target_share_index.toFixed(2)),
      },
      steps,
    };
  },
};

const CHUNK_YARDAGE_SCORE: ForgeLabEquation = {
  id: 'CHUNK_YARDAGE_SCORE',
  name: 'Chunk Yardage Score (RB)',
  description: 'Calculates RB explosive play rating based on percentage of runs hitting yardage thresholds. Uses NFLfastR yards_gained field.',
  inputs: [
    { key: 'total_carries', label: 'Total Carries', min: 1, max: 400, step: 1, defaultValue: 180 },
    { key: 'runs_10plus', label: 'Runs 10+ Yards', min: 0, max: 100, step: 1, defaultValue: 22 },
    { key: 'runs_15plus', label: 'Runs 15+ Yards', min: 0, max: 50, step: 1, defaultValue: 10 },
    { key: 'runs_20plus', label: 'Runs 20+ Yards', min: 0, max: 30, step: 1, defaultValue: 5 },
    { key: 'w_10', label: 'Weight for 10+ yd', min: 0, max: 1, step: 0.05, defaultValue: 0.3 },
    { key: 'w_15', label: 'Weight for 15+ yd', min: 0, max: 1, step: 0.05, defaultValue: 0.35 },
    { key: 'w_20', label: 'Weight for 20+ yd', min: 0, max: 1, step: 0.05, defaultValue: 0.35 },
  ],
  compute: (inputs: Record<string, number>) => {
    const { total_carries, runs_10plus, runs_15plus, runs_20plus, w_10, w_15, w_20 } = inputs;

    const rate_10 = (runs_10plus / total_carries) * 100;
    const rate_15 = (runs_15plus / total_carries) * 100;
    const rate_20 = (runs_20plus / total_carries) * 100;
    
    const norm_10 = Math.min(100, rate_10 * 5);
    const norm_15 = Math.min(100, rate_15 * 10);
    const norm_20 = Math.min(100, rate_20 * 20);
    
    const total_weight = w_10 + w_15 + w_20;
    const chunk_score = (w_10 * norm_10 + w_15 * norm_15 + w_20 * norm_20) / total_weight;

    const steps = [
      `Step 1: Calculate chunk yardage rates`,
      `Rate_10+ = (${runs_10plus} / ${total_carries}) × 100 = ${rate_10.toFixed(2)}%`,
      `Rate_15+ = (${runs_15plus} / ${total_carries}) × 100 = ${rate_15.toFixed(2)}%`,
      `Rate_20+ = (${runs_20plus} / ${total_carries}) × 100 = ${rate_20.toFixed(2)}%`,
      ``,
      `Step 2: Normalize to 0-100 scale (league benchmarks)`,
      `Norm_10 = min(100, ${rate_10.toFixed(2)} × 5) = ${norm_10.toFixed(2)}`,
      `Norm_15 = min(100, ${rate_15.toFixed(2)} × 10) = ${norm_15.toFixed(2)}`,
      `Norm_20 = min(100, ${rate_20.toFixed(2)} × 20) = ${norm_20.toFixed(2)}`,
      ``,
      `Step 3: Apply weights`,
      `Chunk_score = (${w_10.toFixed(2)} × ${norm_10.toFixed(2)} + ${w_15.toFixed(2)} × ${norm_15.toFixed(2)} + ${w_20.toFixed(2)} × ${norm_20.toFixed(2)}) / ${total_weight.toFixed(2)}`,
      `Chunk_score = ${chunk_score.toFixed(2)}`,
    ];

    return {
      outputs: {
        rate_10_plus: parseFloat(rate_10.toFixed(2)),
        rate_15_plus: parseFloat(rate_15.toFixed(2)),
        rate_20_plus: parseFloat(rate_20.toFixed(2)),
        norm_10: parseFloat(norm_10.toFixed(2)),
        norm_15: parseFloat(norm_15.toFixed(2)),
        norm_20: parseFloat(norm_20.toFixed(2)),
        chunk_score: parseFloat(chunk_score.toFixed(2)),
      },
      steps,
    };
  },
};

const AIR_YAC_COMPOSITION: ForgeLabEquation = {
  id: 'AIR_YAC_COMPOSITION',
  name: 'Air Yards vs YAC Composition',
  description: 'Analyzes WR/TE receiving profile split between air yards (route depth) and YAC. Uses NFLfastR air_yards and yards_after_catch fields.',
  inputs: [
    { key: 'total_air_yards', label: 'Total Air Yards', min: 0, max: 1500, step: 10, defaultValue: 650 },
    { key: 'total_yac', label: 'Total YAC', min: 0, max: 800, step: 10, defaultValue: 280 },
    { key: 'targets', label: 'Targets', min: 1, max: 200, step: 1, defaultValue: 95 },
    { key: 'receptions', label: 'Receptions', min: 0, max: 180, step: 1, defaultValue: 62 },
    { key: 'league_avg_adot', label: 'League Avg aDOT', min: 5, max: 15, step: 0.5, defaultValue: 8.5 },
    { key: 'league_avg_yac_per_rec', label: 'League Avg YAC/Rec', min: 2, max: 8, step: 0.5, defaultValue: 4.5 },
  ],
  compute: (inputs: Record<string, number>) => {
    const { total_air_yards, total_yac, targets, receptions, league_avg_adot, league_avg_yac_per_rec } = inputs;

    const adot = total_air_yards / targets;
    const yac_per_rec = receptions > 0 ? total_yac / receptions : 0;
    const total_receiving_yards = total_air_yards + total_yac;
    const air_pct = (total_air_yards / total_receiving_yards) * 100;
    const yac_pct = (total_yac / total_receiving_yards) * 100;
    const adot_vs_league = ((adot - league_avg_adot) / league_avg_adot) * 100;
    const yac_vs_league = ((yac_per_rec - league_avg_yac_per_rec) / league_avg_yac_per_rec) * 100;
    
    let archetype = '';
    if (adot >= 12 && yac_per_rec < 4) archetype = 'DEEP_THREAT';
    else if (adot < 7 && yac_per_rec >= 5.5) archetype = 'YAC_MONSTER';
    else if (adot >= 9 && yac_per_rec >= 5) archetype = 'COMPLETE_RECEIVER';
    else if (adot < 8 && yac_per_rec < 4) archetype = 'POSSESSION';
    else archetype = 'BALANCED';

    const steps = [
      `Step 1: Calculate Average Depth of Target (aDOT)`,
      `aDOT = ${total_air_yards} / ${targets} = ${adot.toFixed(2)} yards`,
      ``,
      `Step 2: Calculate YAC per reception`,
      `YAC_per_rec = ${total_yac} / ${receptions} = ${yac_per_rec.toFixed(2)} yards`,
      ``,
      `Step 3: Calculate composition split`,
      `Total_yards = ${total_air_yards} + ${total_yac} = ${total_receiving_yards}`,
      `Air_% = (${total_air_yards} / ${total_receiving_yards}) × 100 = ${air_pct.toFixed(1)}%`,
      `YAC_% = (${total_yac} / ${total_receiving_yards}) × 100 = ${yac_pct.toFixed(1)}%`,
      ``,
      `Step 4: Compare to league averages`,
      `aDOT_vs_league = ((${adot.toFixed(2)} - ${league_avg_adot}) / ${league_avg_adot}) × 100 = ${adot_vs_league.toFixed(1)}%`,
      `YAC_vs_league = ((${yac_per_rec.toFixed(2)} - ${league_avg_yac_per_rec}) / ${league_avg_yac_per_rec}) × 100 = ${yac_vs_league.toFixed(1)}%`,
      ``,
      `Step 5: Determine archetype`,
      `Archetype = "${archetype}"`,
    ];

    return {
      outputs: {
        adot: parseFloat(adot.toFixed(2)),
        yac_per_rec: parseFloat(yac_per_rec.toFixed(2)),
        air_pct: parseFloat(air_pct.toFixed(1)),
        yac_pct: parseFloat(yac_pct.toFixed(1)),
        adot_vs_league: parseFloat(adot_vs_league.toFixed(1)),
        yac_vs_league: parseFloat(yac_vs_league.toFixed(1)),
      },
      steps,
    };
  },
};

const VOLUME_EFFICIENCY_BLEND: ForgeLabEquation = {
  id: 'VOLUME_EFFICIENCY_BLEND',
  name: 'Volume-Efficiency Blend',
  description: 'FORGE core scoring formula: blends volume metrics with efficiency metrics using configurable weights.',
  inputs: [
    { key: 'volume_score', label: 'Volume Score (0-100)', min: 0, max: 100, step: 1, defaultValue: 72 },
    { key: 'efficiency_score', label: 'Efficiency Score (0-100)', min: 0, max: 100, step: 1, defaultValue: 65 },
    { key: 'role_score', label: 'Role/Context Score (0-100)', min: 0, max: 100, step: 1, defaultValue: 58 },
    { key: 'stability_score', label: 'Stability Score (0-100)', min: 0, max: 100, step: 1, defaultValue: 70 },
    { key: 'w_volume', label: 'Volume Weight', min: 0, max: 1, step: 0.05, defaultValue: 0.35 },
    { key: 'w_efficiency', label: 'Efficiency Weight', min: 0, max: 1, step: 0.05, defaultValue: 0.30 },
    { key: 'w_role', label: 'Role Weight', min: 0, max: 1, step: 0.05, defaultValue: 0.20 },
    { key: 'w_stability', label: 'Stability Weight', min: 0, max: 1, step: 0.05, defaultValue: 0.15 },
  ],
  compute: (inputs: Record<string, number>) => {
    const { volume_score, efficiency_score, role_score, stability_score, w_volume, w_efficiency, w_role, w_stability } = inputs;

    const total_weight = w_volume + w_efficiency + w_role + w_stability;
    const weighted_volume = volume_score * w_volume;
    const weighted_efficiency = efficiency_score * w_efficiency;
    const weighted_role = role_score * w_role;
    const weighted_stability = stability_score * w_stability;
    const raw_alpha = (weighted_volume + weighted_efficiency + weighted_role + weighted_stability) / total_weight;
    const alpha = Math.min(100, Math.max(0, raw_alpha));

    const steps = [
      `Step 1: Apply weights to each component`,
      `Weighted_volume = ${volume_score} × ${w_volume.toFixed(2)} = ${weighted_volume.toFixed(2)}`,
      `Weighted_efficiency = ${efficiency_score} × ${w_efficiency.toFixed(2)} = ${weighted_efficiency.toFixed(2)}`,
      `Weighted_role = ${role_score} × ${w_role.toFixed(2)} = ${weighted_role.toFixed(2)}`,
      `Weighted_stability = ${stability_score} × ${w_stability.toFixed(2)} = ${weighted_stability.toFixed(2)}`,
      ``,
      `Step 2: Sum weighted components`,
      `Sum = ${weighted_volume.toFixed(2)} + ${weighted_efficiency.toFixed(2)} + ${weighted_role.toFixed(2)} + ${weighted_stability.toFixed(2)} = ${(weighted_volume + weighted_efficiency + weighted_role + weighted_stability).toFixed(2)}`,
      ``,
      `Step 3: Normalize by total weight`,
      `Total_weight = ${w_volume.toFixed(2)} + ${w_efficiency.toFixed(2)} + ${w_role.toFixed(2)} + ${w_stability.toFixed(2)} = ${total_weight.toFixed(2)}`,
      `Raw_α = ${(weighted_volume + weighted_efficiency + weighted_role + weighted_stability).toFixed(2)} / ${total_weight.toFixed(2)} = ${raw_alpha.toFixed(2)}`,
      ``,
      `Step 4: Clamp to 0-100`,
      `FORGE_α = ${alpha.toFixed(2)}`,
    ];

    return {
      outputs: {
        weighted_volume: parseFloat(weighted_volume.toFixed(2)),
        weighted_efficiency: parseFloat(weighted_efficiency.toFixed(2)),
        weighted_role: parseFloat(weighted_role.toFixed(2)),
        weighted_stability: parseFloat(weighted_stability.toFixed(2)),
        raw_alpha: parseFloat(raw_alpha.toFixed(2)),
        alpha: parseFloat(alpha.toFixed(2)),
      },
      steps,
    };
  },
};

const QB_PRESSURE_ADJUSTED_EPA: ForgeLabEquation = {
  id: 'QB_PRESSURE_ADJUSTED_EPA',
  name: 'QB Pressure-Adjusted EPA',
  description: 'Adjusts QB EPA based on pressure context. Uses NFLfastR qb_hit, sack, and epa fields.',
  inputs: [
    { key: 'raw_epa_per_play', label: 'Raw EPA/Play', min: -0.3, max: 0.4, step: 0.01, defaultValue: 0.18 },
    { key: 'pressure_rate', label: 'Pressure Rate (%)', min: 0, max: 60, step: 1, defaultValue: 28 },
    { key: 'sack_rate', label: 'Sack Rate (%)', min: 0, max: 15, step: 0.5, defaultValue: 6.5 },
    { key: 'league_avg_pressure', label: 'League Avg Pressure (%)', min: 20, max: 40, step: 1, defaultValue: 30 },
    { key: 'league_avg_sack', label: 'League Avg Sack Rate (%)', min: 3, max: 10, step: 0.5, defaultValue: 6.0 },
    { key: 'pressure_penalty', label: 'Pressure EPA Penalty', min: 0, max: 0.1, step: 0.005, defaultValue: 0.03 },
    { key: 'sack_penalty', label: 'Sack Rate EPA Penalty', min: 0, max: 0.2, step: 0.01, defaultValue: 0.08 },
  ],
  compute: (inputs: Record<string, number>) => {
    const { raw_epa_per_play, pressure_rate, sack_rate, league_avg_pressure, league_avg_sack, pressure_penalty, sack_penalty } = inputs;

    const pressure_delta = pressure_rate - league_avg_pressure;
    const sack_delta = sack_rate - league_avg_sack;
    const pressure_adjustment = pressure_delta > 0 ? pressure_delta * pressure_penalty : pressure_delta * pressure_penalty * 0.5;
    const sack_adjustment = sack_delta > 0 ? sack_delta * sack_penalty : sack_delta * sack_penalty * 0.5;
    const total_adjustment = pressure_adjustment + sack_adjustment;
    const adjusted_epa = raw_epa_per_play + total_adjustment;
    const context_grade = pressure_rate < league_avg_pressure ? 'CLEAN_POCKET' : pressure_rate > league_avg_pressure + 5 ? 'UNDER_SIEGE' : 'AVERAGE';

    const steps = [
      `Step 1: Calculate pressure delta vs league`,
      `Pressure_delta = ${pressure_rate.toFixed(1)}% - ${league_avg_pressure}% = ${pressure_delta.toFixed(1)}%`,
      `Sack_delta = ${sack_rate.toFixed(1)}% - ${league_avg_sack}% = ${sack_delta.toFixed(1)}%`,
      ``,
      `Step 2: Calculate EPA adjustments`,
      `Pressure_adj = ${pressure_delta.toFixed(1)} × ${pressure_penalty.toFixed(3)}${pressure_delta < 0 ? ' × 0.5' : ''} = ${pressure_adjustment.toFixed(4)}`,
      `Sack_adj = ${sack_delta.toFixed(1)} × ${sack_penalty.toFixed(3)}${sack_delta < 0 ? ' × 0.5' : ''} = ${sack_adjustment.toFixed(4)}`,
      ``,
      `Step 3: Sum adjustments`,
      `Total_adjustment = ${pressure_adjustment.toFixed(4)} + ${sack_adjustment.toFixed(4)} = ${total_adjustment.toFixed(4)}`,
      ``,
      `Step 4: Apply to raw EPA`,
      `Adjusted_EPA = ${raw_epa_per_play.toFixed(3)} + ${total_adjustment.toFixed(4)} = ${adjusted_epa.toFixed(4)}`,
      ``,
      `Context: ${context_grade}`,
    ];

    return {
      outputs: {
        pressure_delta: parseFloat(pressure_delta.toFixed(1)),
        sack_delta: parseFloat(sack_delta.toFixed(1)),
        pressure_adjustment: parseFloat(pressure_adjustment.toFixed(4)),
        sack_adjustment: parseFloat(sack_adjustment.toFixed(4)),
        total_adjustment: parseFloat(total_adjustment.toFixed(4)),
        adjusted_epa: parseFloat(adjusted_epa.toFixed(4)),
      },
      steps,
    };
  },
};

const CPOE_ADJUSTED_ACCURACY: ForgeLabEquation = {
  id: 'CPOE_ADJUSTED_ACCURACY',
  name: 'CPOE-Adjusted Accuracy',
  description: 'Converts Completion Percentage Over Expected to a normalized accuracy score. Uses NFLfastR cpoe field.',
  inputs: [
    { key: 'cpoe', label: 'CPOE (%)', min: -10, max: 10, step: 0.1, defaultValue: 3.2 },
    { key: 'completion_pct', label: 'Raw Completion %', min: 50, max: 80, step: 0.5, defaultValue: 67.5 },
    { key: 'attempts', label: 'Pass Attempts', min: 50, max: 700, step: 10, defaultValue: 450 },
    { key: 'min_attempts', label: 'Min Attempts Threshold', min: 50, max: 200, step: 10, defaultValue: 100 },
    { key: 'cpoe_weight', label: 'CPOE Weight', min: 0, max: 1, step: 0.05, defaultValue: 0.7 },
    { key: 'raw_comp_weight', label: 'Raw Completion Weight', min: 0, max: 1, step: 0.05, defaultValue: 0.3 },
  ],
  compute: (inputs: Record<string, number>) => {
    const { cpoe, completion_pct, attempts, min_attempts, cpoe_weight, raw_comp_weight } = inputs;

    const cpoe_normalized = 50 + (cpoe * 5);
    const comp_normalized = ((completion_pct - 55) / 20) * 100;
    const sample_factor = Math.min(1, attempts / min_attempts);
    const total_weight = cpoe_weight + raw_comp_weight;
    const blended_accuracy = ((cpoe_weight * cpoe_normalized) + (raw_comp_weight * comp_normalized)) / total_weight;
    const adjusted_accuracy = blended_accuracy * sample_factor;
    
    let tier = '';
    if (cpoe >= 4) tier = 'ELITE';
    else if (cpoe >= 2) tier = 'ABOVE_AVERAGE';
    else if (cpoe >= 0) tier = 'AVERAGE';
    else if (cpoe >= -2) tier = 'BELOW_AVERAGE';
    else tier = 'POOR';

    const steps = [
      `Step 1: Normalize CPOE to 0-100 scale (0 CPOE = 50)`,
      `CPOE_norm = 50 + (${cpoe.toFixed(1)} × 5) = ${cpoe_normalized.toFixed(2)}`,
      ``,
      `Step 2: Normalize raw completion % (55% = 0, 75% = 100)`,
      `Comp_norm = ((${completion_pct.toFixed(1)} - 55) / 20) × 100 = ${comp_normalized.toFixed(2)}`,
      ``,
      `Step 3: Calculate sample size factor`,
      `Sample_factor = min(1, ${attempts} / ${min_attempts}) = ${sample_factor.toFixed(3)}`,
      ``,
      `Step 4: Blend CPOE and raw completion`,
      `Blended = (${cpoe_weight.toFixed(2)} × ${cpoe_normalized.toFixed(2)} + ${raw_comp_weight.toFixed(2)} × ${comp_normalized.toFixed(2)}) / ${total_weight.toFixed(2)}`,
      `Blended = ${blended_accuracy.toFixed(2)}`,
      ``,
      `Step 5: Apply sample factor`,
      `Adjusted_accuracy = ${blended_accuracy.toFixed(2)} × ${sample_factor.toFixed(3)} = ${adjusted_accuracy.toFixed(2)}`,
      ``,
      `Tier: ${tier}`,
    ];

    return {
      outputs: {
        cpoe_normalized: parseFloat(cpoe_normalized.toFixed(2)),
        comp_normalized: parseFloat(comp_normalized.toFixed(2)),
        sample_factor: parseFloat(sample_factor.toFixed(3)),
        blended_accuracy: parseFloat(blended_accuracy.toFixed(2)),
        adjusted_accuracy: parseFloat(adjusted_accuracy.toFixed(2)),
      },
      steps,
    };
  },
};

const RB_WORKLOAD_SUSTAINABILITY: ForgeLabEquation = {
  id: 'RB_WORKLOAD_SUSTAINABILITY',
  name: 'RB Workload Sustainability',
  description: 'Evaluates RB workload sustainability based on touch count, efficiency, and receiving involvement.',
  inputs: [
    { key: 'carries', label: 'Carries', min: 0, max: 400, step: 5, defaultValue: 220 },
    { key: 'targets', label: 'Targets', min: 0, max: 120, step: 5, defaultValue: 45 },
    { key: 'games', label: 'Games Played', min: 1, max: 17, step: 1, defaultValue: 15 },
    { key: 'ypc', label: 'Yards Per Carry', min: 2, max: 7, step: 0.1, defaultValue: 4.3 },
    { key: 'catch_rate', label: 'Catch Rate (%)', min: 50, max: 100, step: 1, defaultValue: 78 },
    { key: 'optimal_touches_per_game', label: 'Optimal Touches/Game', min: 15, max: 25, step: 1, defaultValue: 18 },
    { key: 'overuse_penalty_threshold', label: 'Overuse Threshold', min: 20, max: 30, step: 1, defaultValue: 23 },
  ],
  compute: (inputs: Record<string, number>) => {
    const { carries, targets, games, ypc, catch_rate, optimal_touches_per_game, overuse_penalty_threshold } = inputs;

    const touches = carries + targets;
    const touches_per_game = touches / games;
    const receiving_share = (targets / touches) * 100;
    
    const volume_score = Math.min(100, (touches_per_game / optimal_touches_per_game) * 100);
    const overuse_penalty = touches_per_game > overuse_penalty_threshold 
      ? (touches_per_game - overuse_penalty_threshold) * 3 
      : 0;
    
    const efficiency_score = ((ypc - 3.0) / 2.5) * 50 + ((catch_rate - 60) / 30) * 50;
    const receiving_bonus = receiving_share > 15 ? (receiving_share - 15) * 0.5 : 0;
    
    const sustainability_index = Math.min(100, Math.max(0, 
      (volume_score * 0.4) + (efficiency_score * 0.4) + (receiving_bonus * 0.2) - overuse_penalty
    ));

    const steps = [
      `Step 1: Calculate touches per game`,
      `Total_touches = ${carries} + ${targets} = ${touches}`,
      `Touches_per_game = ${touches} / ${games} = ${touches_per_game.toFixed(2)}`,
      ``,
      `Step 2: Calculate receiving share`,
      `Receiving_share = (${targets} / ${touches}) × 100 = ${receiving_share.toFixed(1)}%`,
      ``,
      `Step 3: Calculate volume score`,
      `Volume_score = min(100, (${touches_per_game.toFixed(2)} / ${optimal_touches_per_game}) × 100) = ${volume_score.toFixed(2)}`,
      ``,
      `Step 4: Calculate overuse penalty`,
      `Overuse_penalty = ${touches_per_game.toFixed(2)} > ${overuse_penalty_threshold} ? (${touches_per_game.toFixed(2)} - ${overuse_penalty_threshold}) × 3 : 0 = ${overuse_penalty.toFixed(2)}`,
      ``,
      `Step 5: Calculate efficiency score`,
      `Efficiency = ((${ypc.toFixed(1)} - 3.0) / 2.5) × 50 + ((${catch_rate} - 60) / 30) × 50 = ${efficiency_score.toFixed(2)}`,
      ``,
      `Step 6: Calculate receiving bonus`,
      `Receiving_bonus = ${receiving_share.toFixed(1)} > 15 ? (${receiving_share.toFixed(1)} - 15) × 0.5 : 0 = ${receiving_bonus.toFixed(2)}`,
      ``,
      `Step 7: Final sustainability index`,
      `Sustainability = (${volume_score.toFixed(2)} × 0.4) + (${efficiency_score.toFixed(2)} × 0.4) + (${receiving_bonus.toFixed(2)} × 0.2) - ${overuse_penalty.toFixed(2)} = ${sustainability_index.toFixed(2)}`,
    ];

    return {
      outputs: {
        touches_per_game: parseFloat(touches_per_game.toFixed(2)),
        receiving_share: parseFloat(receiving_share.toFixed(1)),
        volume_score: parseFloat(volume_score.toFixed(2)),
        efficiency_score: parseFloat(efficiency_score.toFixed(2)),
        overuse_penalty: parseFloat(overuse_penalty.toFixed(2)),
        receiving_bonus: parseFloat(receiving_bonus.toFixed(2)),
        sustainability_index: parseFloat(sustainability_index.toFixed(2)),
      },
      steps,
    };
  },
};

const WR_CORE_ALPHA: ForgeLabEquation = {
  id: 'WR_CORE_ALPHA',
  name: 'WR Core Alpha Formula',
  description: 'Interactive WR ranking formula based on separation, efficiency, contested ability, and chain moving. Outputs WR Alpha on 25-90 scale.',
  inputs: [
    { key: 'TS', label: 'Target Share', min: 0, max: 0.40, step: 0.005, defaultValue: 0.22 },
    { key: 'YPRR', label: 'Yards Per Route Run', min: 0, max: 3.5, step: 0.05, defaultValue: 2.1 },
    { key: 'FD_RR', label: '1D per Route Run', min: 0, max: 0.20, step: 0.002, defaultValue: 0.08 },
    { key: 'YAC', label: 'YAC per Reception', min: 0, max: 10, step: 0.1, defaultValue: 4.5 },
    { key: 'CC', label: 'Contested Catch Win Rate', min: 0, max: 1, step: 0.02, defaultValue: 0.52 },
  ],
  compute: (inputs: Record<string, number>) => {
    const { TS, YPRR, FD_RR, YAC, CC } = inputs;

    const TS_norm = Math.min(TS / 0.30, 1);
    const YPRR_norm = Math.min(YPRR / 2.70, 1);
    const FD_norm = Math.min(FD_RR / 0.12, 1);
    const YAC_norm = Math.min(YAC / 6.00, 1);
    const CC_norm = CC;

    const Chain = 0.55 * FD_norm + 0.45 * TS_norm;
    const Explosive = 0.60 * YPRR_norm + 0.40 * YAC_norm;
    const WinSkill = CC_norm;

    const WR_Core = 0.40 * Chain + 0.40 * Explosive + 0.20 * WinSkill;
    const WR_Alpha = 25 + 65 * WR_Core;

    const steps = [
      `━━━ STEP 1: Normalize Raw Inputs ━━━`,
      `TS_norm   = min(${TS.toFixed(3)} / 0.30, 1) = ${TS_norm.toFixed(4)}`,
      `YPRR_norm = min(${YPRR.toFixed(2)} / 2.70, 1) = ${YPRR_norm.toFixed(4)}`,
      `FD_norm   = min(${FD_RR.toFixed(3)} / 0.12, 1) = ${FD_norm.toFixed(4)}`,
      `YAC_norm  = min(${YAC.toFixed(2)} / 6.00, 1) = ${YAC_norm.toFixed(4)}`,
      `CC_norm   = ${CC.toFixed(2)} (pass-through)`,
      ``,
      `━━━ STEP 2: Calculate Subscores ━━━`,
      `Chain = 0.55 × FD_norm + 0.45 × TS_norm`,
      `Chain = 0.55 × ${FD_norm.toFixed(4)} + 0.45 × ${TS_norm.toFixed(4)} = ${Chain.toFixed(4)}`,
      ``,
      `Explosive = 0.60 × YPRR_norm + 0.40 × YAC_norm`,
      `Explosive = 0.60 × ${YPRR_norm.toFixed(4)} + 0.40 × ${YAC_norm.toFixed(4)} = ${Explosive.toFixed(4)}`,
      ``,
      `WinSkill = CC_norm = ${WinSkill.toFixed(4)}`,
      ``,
      `━━━ STEP 3: Combine into WR Core ━━━`,
      `WR_Core = 0.40 × Chain + 0.40 × Explosive + 0.20 × WinSkill`,
      `WR_Core = 0.40 × ${Chain.toFixed(4)} + 0.40 × ${Explosive.toFixed(4)} + 0.20 × ${WinSkill.toFixed(4)}`,
      `WR_Core = ${WR_Core.toFixed(4)}`,
      ``,
      `━━━ STEP 4: Scale to WR Alpha (25-90) ━━━`,
      `WR_Alpha = 25 + 65 × WR_Core`,
      `WR_Alpha = 25 + 65 × ${WR_Core.toFixed(4)} = ${WR_Alpha.toFixed(2)}`,
    ];

    return {
      outputs: {
        TS_norm: parseFloat(TS_norm.toFixed(4)),
        YPRR_norm: parseFloat(YPRR_norm.toFixed(4)),
        FD_norm: parseFloat(FD_norm.toFixed(4)),
        YAC_norm: parseFloat(YAC_norm.toFixed(4)),
        CC_norm: parseFloat(CC_norm.toFixed(4)),
        Chain: parseFloat(Chain.toFixed(4)),
        Explosive: parseFloat(Explosive.toFixed(4)),
        WinSkill: parseFloat(WinSkill.toFixed(4)),
        WR_Core: parseFloat(WR_Core.toFixed(4)),
        WR_Alpha: parseFloat(WR_Alpha.toFixed(2)),
      },
      steps,
    };
  },
};

export const FORGE_LAB_EQUATIONS: ForgeLabEquation[] = [
  WR_CORE_ALPHA,
  TD_ENVIRONMENT_BOOST,
  EPA_SUCCESS_BLEND,
  YAC_OVER_EXPECTED,
  TARGET_SHARE_INDEX,
  CHUNK_YARDAGE_SCORE,
  AIR_YAC_COMPOSITION,
  VOLUME_EFFICIENCY_BLEND,
  QB_PRESSURE_ADJUSTED_EPA,
  CPOE_ADJUSTED_ACCURACY,
  RB_WORKLOAD_SUSTAINABILITY,
];

export function getEquationById(id: string): ForgeLabEquation | undefined {
  return FORGE_LAB_EQUATIONS.find(eq => eq.id === id);
}
