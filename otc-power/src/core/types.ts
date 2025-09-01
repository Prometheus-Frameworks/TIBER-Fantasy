export type Pos = 'QB'|'RB'|'WR'|'TE';
export type RankType = 'OVERALL'|Pos;

export interface ComponentBundle {
  usage_now: number;      // 0-100
  talent: number;         // 0-100
  environment: number;    // 0-100
  availability: number;   // 0-100
  market_anchor: number;  // 0-100
}

export interface PlayerFacts extends ComponentBundle {
  player_id: string;
  season: number;
  week: number;
  position: Pos;
  power_score: number;
  flags: string[];
  confidence: number;     // 0-1
}

export interface RankItem {
  player_id: string;
  name: string;
  team: string;
  position: Pos;
  power_score: number;
  rank: number;
  delta_w: number;
  confidence: number;
  components: ComponentBundle;
  flags: string[];
}