export const BASE_WEIGHTS = {
  usage_now: 0.40,
  talent: 0.25,
  environment: 0.20,
  availability: 0.10,
  market_anchor: 0.05
} as const;

export const POS_WEIGHTS: Record<'QB'|'RB'|'WR'|'TE', Record<keyof typeof BASE_WEIGHTS, number>> = {
  // QB: bump environment to 0.30, keep usage at 0.30 (sum = 1.00)
  QB: { usage_now: 0.30, talent: 0.25, environment: 0.30, availability: 0.10, market_anchor: 0.05 },

  // RB: raise availability to 0.13 and shave usage to 0.37 (sum = 1.00)
  RB: { usage_now: 0.37, talent: 0.25, environment: 0.20, availability: 0.13, market_anchor: 0.05 },

  // WR/TE unchanged from v1 (already validated)
  WR: { usage_now: 0.45, environment: 0.20, talent: 0.20, availability: 0.10, market_anchor: 0.05 },
  TE: { usage_now: 0.45, environment: 0.20, talent: 0.20, availability: 0.10, market_anchor: 0.05 }
};

export const SMOOTHING = {
  usage_half_life_weeks: 1.5,
  talent_half_life_weeks: 3.0,
  max_weekly_delta: 8
};

export const EVENT_BYPASS_FLAGS = new Set(['INJURY_STATUS_CHANGE','DEPTH_CHART_CHANGE','QB_CHANGE']);

export const MIN_CONFIDENCE_FOR_LIVE = 0.55; // rookies/new roles start lower