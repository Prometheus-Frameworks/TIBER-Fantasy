/**
 * FORGE Football Lens (F) - Football-sense validation and pillar adjustments
 * 
 * Inspects ForgeEngineOutput + pillars to:
 * - Detect football-sense issues (TD spikes, volume/efficiency mismatches, etc.)
 * - Apply small, bounded pillar adjustments when warranted
 * - Return adjusted pillars and issues for logging/UI
 */

import { ForgeEngineOutput, ForgePillarScores, Position } from './forgeEngine';

export type FootballLensSeverity = 'info' | 'warn' | 'block';

export type FootballLensIssue = {
  code: string;
  message: string;
  severity: FootballLensSeverity;
  position?: Position;
  pillar?: keyof ForgePillarScores;
};

export type FootballLensResult = {
  pillars: ForgePillarScores;
  issues: FootballLensIssue[];
};

function scalePillar(
  pillars: ForgePillarScores,
  key: keyof ForgePillarScores,
  factor: number
): ForgePillarScores {
  const currentValue = pillars[key];
  if (currentValue === undefined) return pillars;
  return {
    ...pillars,
    [key]: Math.max(0, Math.min(100, currentValue * factor)),
  };
}

export function applyFootballLens(
  engineOutput: ForgeEngineOutput
): FootballLensResult {
  let pillars = { ...engineOutput.pillars };
  const issues: FootballLensIssue[] = [];
  const { position } = engineOutput;

  if (position === 'WR') {
    const { volume, efficiency } = pillars;

    if (volume < 40 && efficiency > 85) {
      issues.push({
        code: 'WR_TD_SPIKE_LOW_VOLUME',
        message:
          'WR shows elite efficiency but poor volume; likely driven by TD spikes or small sample.',
        severity: 'warn',
        position,
        pillar: 'efficiency',
      });
      pillars = scalePillar(pillars, 'efficiency', 0.9);
    }

    if (volume > 75 && efficiency < 40) {
      issues.push({
        code: 'WR_HIGH_VOLUME_LOW_EFFICIENCY',
        message:
          'WR has strong volume but poor efficiency; may be force-fed targets without production.',
        severity: 'info',
        position,
        pillar: 'efficiency',
      });
    }
  }

  if (position === 'RB') {
    const { volume, efficiency, teamContext } = pillars;

    if (volume > 70 && efficiency < 50) {
      issues.push({
        code: 'RB_VOLUME_WITH_BAD_EFFICIENCY',
        message:
          'RB has strong volume but poor efficiency; monitor for role or performance risk.',
        severity: 'info',
        position,
        pillar: 'efficiency',
      });
    }

    if (volume > 80 && teamContext < 35) {
      issues.push({
        code: 'RB_WORKHORSE_BAD_OFFENSE',
        message:
          'RB is a workhorse on a struggling offense; ceiling limited by team context.',
        severity: 'warn',
        position,
        pillar: 'teamContext',
      });
    }

    if (volume < 40 && efficiency > 80) {
      issues.push({
        code: 'RB_LOW_VOLUME_HIGH_EFFICIENCY',
        message:
          'RB shows elite efficiency on limited touches; potential for role expansion or TD regression.',
        severity: 'info',
        position,
        pillar: 'volume',
      });
      pillars = scalePillar(pillars, 'efficiency', 0.92);
    }
  }

  if (position === 'TE') {
    const { volume, efficiency } = pillars;

    if (volume < 35 && efficiency > 80) {
      issues.push({
        code: 'TE_TD_DEPENDENT',
        message:
          'TE shows elite efficiency on low volume; likely TD-dependent with regression risk.',
        severity: 'warn',
        position,
        pillar: 'efficiency',
      });
      pillars = scalePillar(pillars, 'efficiency', 0.88);
    }
  }

  if (position === 'QB') {
    const { volume, efficiency, stability } = pillars;

    if (efficiency > 85 && stability < 40) {
      issues.push({
        code: 'QB_BOOM_BUST',
        message:
          'QB shows elite efficiency but poor consistency; high-ceiling streamer with floor risk.',
        severity: 'info',
        position,
        pillar: 'stability',
      });
    }

    if (volume > 75 && efficiency < 45) {
      issues.push({
        code: 'QB_GARBAGE_TIME_VOLUME',
        message:
          'QB has high volume but poor efficiency; may be inflated by garbage time or negative game scripts.',
        severity: 'warn',
        position,
        pillar: 'efficiency',
      });
    }
  }

  const values = Object.values(pillars);
  const maxPillar = Math.max(...values);
  const minPillar = Math.min(...values);
  if (maxPillar >= 90 && minPillar <= 30) {
    issues.push({
      code: 'PILLAR_POLARIZATION',
      message:
        'One pillar is extremely strong while another is very weak; player is highly context-sensitive.',
      severity: 'info',
    });
  }

  if (engineOutput.gamesPlayed < 3) {
    issues.push({
      code: 'SMALL_SAMPLE_SIZE',
      message:
        `Only ${engineOutput.gamesPlayed} games played; scores may be volatile.`,
      severity: 'info',
    });
  }

  return { pillars, issues };
}
