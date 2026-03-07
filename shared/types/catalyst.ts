export interface CatalystComponents {
  leverage_factor: number;
  opponent_factor: number;
  script_factor: number;
  recency_factor: number;
  base_epa_sum: number;
  weighted_epa_sum: number;
  play_count: number;
  avg_leverage: number;
}

export interface CatalystPlayer {
  gsis_id: string;
  player_name: string;
  position: string;
  team: string;
  catalyst_raw: number;
  catalyst_alpha: number;
  components: CatalystComponents;
}

export interface CatalystPlayerDetail extends CatalystPlayer {
  season: number;
  weekly: Array<{
    week: number;
    catalyst_raw: number;
    catalyst_alpha: number;
    components: CatalystComponents;
  }>;
}

export interface CatalystYoYPlayer {
  gsis_id: string;
  player_name: string;
  position: string;
  team_2024: string;
  team_2025: string;
  alpha_2024: number | null;
  alpha_2025: number | null;
  delta: number | null;
}

export interface CatalystBatchResponse {
  players: CatalystPlayer[];
  season: number;
  position: string;
  week: number;
  total: number;
}

export type CatalystPlayerResponse = CatalystPlayerDetail;

export interface CatalystYoYResponse {
  position: string;
  players: CatalystYoYPlayer[];
}

export interface CatalystErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
  };
}
