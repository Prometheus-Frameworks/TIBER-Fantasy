export const VALID_CATALYST_POSITIONS = ["QB", "RB", "WR", "TE"] as const;

export type CatalystPosition = (typeof VALID_CATALYST_POSITIONS)[number];

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

export interface CatalystWeeklyDetail {
  week: number;
  catalyst_raw: number;
  catalyst_alpha: number;
  components: CatalystComponents;
}

export interface CatalystPlayerDetail extends CatalystPlayer {
  season: number;
  weekly: CatalystWeeklyDetail[];
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
  position: CatalystPosition;
  week: number;
  total: number;
}

export interface CatalystPlayerResponse extends CatalystPlayerDetail {}

export interface CatalystYoYResponse {
  position: CatalystPosition;
  base_season: number;
  comparison_season: number;
  players: CatalystYoYPlayer[];
}

export interface CatalystErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
  };
}
