import type { DefensivePosition } from '@shared/idpSchema';
import type { PillarConfig, PositionPillarConfig } from '../forgeEngine';

type IdpPillarConfig = Omit<PositionPillarConfig, 'teamContext'> & { teamContext: PillarConfig };

const BASE_EDGE_DI: IdpPillarConfig = {
  volume: { metrics: [
    { metricKey: 'defense_snaps_per_game', source: 'derived', weight: 0.5 },
    { metricKey: 'snap_share', source: 'derived', weight: 0.3 },
    { metricKey: 'tackles_total_per_game', source: 'derived', weight: 0.2 },
  ] },
  efficiency: { metrics: [
    { metricKey: 'havoc_index', source: 'derived', weight: 0.6 },
    { metricKey: 'rate_1', source: 'derived', weight: 0.25 },
    { metricKey: 'rate_2', source: 'derived', weight: 0.15 },
  ] },
  teamContext: { metrics: [
    { metricKey: 'snap_share_score', source: 'derived', weight: 0.4 },
    { metricKey: 'opponent_quality_score', source: 'derived', weight: 0.35 },
    { metricKey: 'scheme_fit_score', source: 'derived', weight: 0.25 },
  ] },
  stability: { metrics: [
    { metricKey: 'stability_score', source: 'derived', weight: 1.0 },
  ] },
};

export const IDP_PILLARS: Record<DefensivePosition, IdpPillarConfig> = {
  EDGE: BASE_EDGE_DI,
  DI: BASE_EDGE_DI,
  LB: {
    ...BASE_EDGE_DI,
    volume: { metrics: [
      { metricKey: 'defense_snaps_per_game', source: 'derived', weight: 0.4 },
      { metricKey: 'snap_share', source: 'derived', weight: 0.2 },
      { metricKey: 'tackles_total_per_game', source: 'derived', weight: 0.4 },
    ] },
  },
  CB: {
    ...BASE_EDGE_DI,
    volume: { metrics: [
      { metricKey: 'defense_snaps_per_game', source: 'derived', weight: 0.5 },
      { metricKey: 'snap_share', source: 'derived', weight: 0.3 },
      { metricKey: 'passes_defended_per_game', source: 'derived', weight: 0.2 },
    ] },
    teamContext: { metrics: [
      { metricKey: 'snap_share_score', source: 'derived', weight: 0.4 },
      { metricKey: 'opponent_quality_score', source: 'derived', weight: 0.35 },
      { metricKey: 'scheme_fit_score', source: 'derived', weight: 0.25 },
    ] },
  },
  S: {
    ...BASE_EDGE_DI,
    volume: { metrics: [
      { metricKey: 'defense_snaps_per_game', source: 'derived', weight: 0.45 },
      { metricKey: 'snap_share', source: 'derived', weight: 0.25 },
      { metricKey: 'tackles_total_per_game', source: 'derived', weight: 0.3 },
    ] },
  },
};

export const IDP_WEIGHTS: Record<DefensivePosition, { volume: number; efficiency: number; teamContext: number; stability: number }> = {
  EDGE: { volume: 0.25, efficiency: 0.4, teamContext: 0.15, stability: 0.2 },
  DI: { volume: 0.25, efficiency: 0.4, teamContext: 0.15, stability: 0.2 },
  LB: { volume: 0.3, efficiency: 0.35, teamContext: 0.15, stability: 0.2 },
  CB: { volume: 0.25, efficiency: 0.4, teamContext: 0.2, stability: 0.15 },
  S: { volume: 0.25, efficiency: 0.4, teamContext: 0.2, stability: 0.15 },
};

export function getIdpPillarConfig(position: DefensivePosition): IdpPillarConfig {
  return IDP_PILLARS[position];
}
