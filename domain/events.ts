/**
 * Brand Signals Brain - Event System
 * 
 * Core event types and plugin contracts for the brand intelligence system.
 * Transforms raw data commits into brand-specific signals through plugin architecture.
 */

import type { db as DB } from '../server/infra/db';

// ========================================
// EVENT DEFINITIONS
// ========================================

/**
 * Triggered when a dataset is committed to any layer (Bronze/Silver/Gold)
 * Plugins listen to specific datasets (e.g., gold_player_week) to compute signals
 */
export type DatasetCommittedEvt = {
  type: 'DATASET.COMMITTED';
  dataset: 'gold_player_week' | 'silver_roster' | 'injury_report' | 'gold_player_season' | 'bronze_sleeper' | string;
  season: number;
  week: number;
  rowCount: number;
  committedAt: string;
  source?: string; // sleeper, nfl_data_py, etc.
  jobId?: string; // UPH job that triggered the commit
};

/**
 * Triggered when the season service detects a week change
 * Allows plugins to perform weekly rollover calculations
 */
export type RollWeekEvt = {
  type: 'DATASET.ROLL_WEEK';
  season: number;
  week: number;
  previousWeek?: number;
  seasonType: 'pre' | 'regular' | 'post';
};

/**
 * Triggered when player identity resolution completes
 * Allows plugins to update signals with resolved player mappings
 */
export type PlayerIdentityEvt = {
  type: 'PLAYER.IDENTITY_RESOLVED';
  season: number;
  week: number;
  resolvedCount: number;
  newMappings: Array<{ sourcePlayerId: string; canonicalPlayerId: string }>;
};

/**
 * Triggered when injury status changes are detected
 * Allows plugins to react to injury intel and opportunity shifts
 */
export type InjuryStatusEvt = {
  type: 'INJURY.STATUS_CHANGED';
  season: number;
  week: number;
  playerId: string;
  status: 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir';
  previousStatus?: string;
  impact: 'low' | 'medium' | 'high';
};

/**
 * Union type of all possible brand events
 */
export type BusEvent = DatasetCommittedEvt | RollWeekEvt | PlayerIdentityEvt | InjuryStatusEvt;

// ========================================
// BRAND PLUGIN CONTRACT
// ========================================

/**
 * Context provided to all brand plugins
 * Includes database access, metrics tracking, and season services
 */
export type BrandContext = {
  db: typeof DB;
  metrics: {
    begin(job: string): () => void;
    fail(job: string, e: Error): void;
    record(metric: string, value: number, labels?: Record<string, string>): void;
  };
  season: () => Promise<{ season: number; week: number; seasonType: 'pre' | 'regular' | 'post' }>;
  logger: {
    info(message: string, meta?: Record<string, any>): void;
    warn(message: string, meta?: Record<string, any>): void;
    error(message: string, error: any, meta?: Record<string, any>): void;
  };
};

/**
 * Brand Plugin Interface
 * 
 * Each brand (Rookie Risers, Dynasty, Redraft, Trade Eval, SOS) implements this interface
 * to process events and generate brand-specific intelligence signals.
 */
export interface BrandPlugin {
  /** Unique plugin identifier - used for metrics and signal storage */
  key: string; // 'redraft' | 'dynasty' | 'rookie_risers' | 'trade_eval' | 'sos'
  
  /** Human-readable plugin name */
  name: string;
  
  /** Plugin version for compatibility tracking */
  version: string;
  
  /** Events this plugin is interested in (for optimization) */
  subscribedEvents: BusEvent['type'][];
  
  /**
   * Process an event and generate brand signals
   * @param evt - The event to process
   * @param ctx - Context with database, metrics, and services
   */
  onEvent(evt: BusEvent, ctx: BrandContext): Promise<void>;
  
  /**
   * Optional: Plugin health check
   * Called periodically to verify plugin state
   */
  healthCheck?(): Promise<{ healthy: boolean; message?: string }>;
  
  /**
   * Optional: Plugin initialization
   * Called when plugin is registered with the bus
   */
  initialize?(ctx: BrandContext): Promise<void>;
}

// ========================================
// SIGNAL CALCULATION HELPERS
// ========================================

/**
 * Standard signal value range: 0-100
 * - 0-20: Strong sell/negative signal
 * - 21-40: Weak sell/negative signal  
 * - 41-60: Neutral signal
 * - 61-80: Weak buy/positive signal
 * - 81-100: Strong buy/positive signal
 */
export type SignalValue = number; // 0-100

/**
 * Signal metadata structure for context and debugging
 */
export interface SignalMeta {
  components?: Record<string, number>; // Component scores that make up the signal
  confidence?: number; // 0-1 confidence in the signal
  dataQuality?: 'high' | 'medium' | 'low'; // Quality of underlying data
  lastUpdated?: string; // ISO timestamp
  calculation?: string; // Formula or method used
  [key: string]: any; // Additional plugin-specific metadata
}

/**
 * Helper to normalize signal values to 0-100 range
 */
export function normalizeSignal(value: number, min: number, max: number): SignalValue {
  if (min === max) return 50; // Neutral if no range
  const normalized = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, normalized));
}

/**
 * Helper to combine multiple signal components with weights
 */
export function combineSignals(components: Array<{ value: SignalValue; weight: number }>): SignalValue {
  const totalWeight = components.reduce((sum, comp) => sum + comp.weight, 0);
  if (totalWeight === 0) return 50; // Neutral if no weights
  
  const weightedSum = components.reduce((sum, comp) => sum + (comp.value * comp.weight), 0);
  return Math.max(0, Math.min(100, weightedSum / totalWeight));
}

// ========================================
// EVENT CREATION HELPERS
// ========================================

/**
 * Create a DATASET.COMMITTED event
 */
export function createDatasetCommittedEvent(
  dataset: string,
  season: number,
  week: number,
  rowCount: number,
  source?: string,
  jobId?: string
): DatasetCommittedEvt {
  return {
    type: 'DATASET.COMMITTED',
    dataset,
    season,
    week,
    rowCount,
    committedAt: new Date().toISOString(),
    source,
    jobId
  };
}

/**
 * Create a DATASET.ROLL_WEEK event
 */
export function createRollWeekEvent(
  season: number,
  week: number,
  previousWeek?: number,
  seasonType: 'pre' | 'regular' | 'post' = 'regular'
): RollWeekEvt {
  return {
    type: 'DATASET.ROLL_WEEK',
    season,
    week,
    previousWeek,
    seasonType
  };
}

/**
 * Create a PLAYER.IDENTITY_RESOLVED event
 */
export function createPlayerIdentityEvent(
  season: number,
  week: number,
  resolvedCount: number,
  newMappings: Array<{ sourcePlayerId: string; canonicalPlayerId: string }>
): PlayerIdentityEvt {
  return {
    type: 'PLAYER.IDENTITY_RESOLVED',
    season,
    week,
    resolvedCount,
    newMappings
  };
}

/**
 * Create an INJURY.STATUS_CHANGED event
 */
export function createInjuryStatusEvent(
  season: number,
  week: number,
  playerId: string,
  status: InjuryStatusEvt['status'],
  previousStatus?: string,
  impact: InjuryStatusEvt['impact'] = 'medium'
): InjuryStatusEvt {
  return {
    type: 'INJURY.STATUS_CHANGED',
    season,
    week,
    playerId,
    status,
    previousStatus,
    impact
  };
}