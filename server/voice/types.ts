/**
 * Tiber Voice System — Adapter Layer
 * ====================================
 * This file defines voice-scoped types for routing and rendering voice responses.
 * It is an ADAPTER LAYER, not the canonical intelligence contract owner.
 *
 * The canonical contract lives in: shared/types/intelligence.ts
 * Voice types translate to/from that contract at the voice boundary.
 *
 * Do not add new response shapes here. Extend the canonical contract in
 * shared/types/intelligence.ts and add an adapter mapping in this file.
 */

// Type-only import anchors this file to the canonical contract.
// Voice responses must be mappable to TiberIntelligenceResponse.
import type { TiberIntelligenceResponse } from "../../shared/types/intelligence";
export type { TiberIntelligenceResponse };

/**
 * Voice-scoped intent identifiers (SCREAMING_SNAKE for historical reasons).
 * Canonical equivalents from shared/types/intelligence.ts:
 *   'START_SIT'       → "start_sit"
 *   'TRADE'           → "trade_analysis"
 *   'WAIVER'          → "waiver_eval"
 *   'RANKING_EXPLAIN' → "player_eval"
 *   'PLAYER_OUTLOOK'  → "player_eval"
 * Do not use these values outside of voice routing code.
 */
export type TiberIntent = 'START_SIT' | 'TRADE' | 'WAIVER' | 'RANKING_EXPLAIN' | 'PLAYER_OUTLOOK';

export interface TiberAsk {
  intent: TiberIntent;
  players: string[];         // ids or names we'll resolve
  week: number;              // current week
  season: number;
  leagueType?: 'redraft' | 'dynasty';
  scoring?: 'PPR' | 'Half' | 'Standard';
}

export interface TiberAnswer {
  verdict: string;           // "Start", "Bench", "Lean Trade For", "Claim: High"
  confidence: number;        // 0..100
  reasons: string[];         // short, factual bullets
  metrics: Record<string, any>; // Power, RAG, deltas, etc.
  contingencies?: string[];  // "If Player X OUT → flip"
  tone: 'tiber';             // so frontend picks correct style
}

// Player data structure for weekly analysis
export interface PlayerWeekFacts {
  player_id: string;
  name: string;
  position: string;
  team: string;
  
  // Power Rankings data
  power_score: number;
  rank: number;
  prev_power_score?: number;
  delta_vs_ecr?: number;      // vs Expert Consensus Rankings
  
  // RAG System data
  rag_score: number;
  rag_color: 'GREEN' | 'AMBER' | 'RED';
  floor_points: number;
  ceiling_points: number;
  expected_points: number;
  
  // Usage & matchup data
  upside_index?: number;      // For QB rushing, WR target share, etc.
  availability: number;       // injury/snap count confidence 0-100
  availability_flag?: 'OUT' | 'QUESTIONABLE' | 'PROBABLE' | 'HEALTHY';
  opp_multiplier?: number;    // matchup difficulty multiplier
  beat_proj?: number;         // % beating projections recently
  
  // Position-specific thresholds
  posBenchline?: number;      // weekly points threshold for startable
}

// Decision result structure
export interface DecisionResult {
  verdict: string;
  conf: number;
}

// Contingency structure
export interface Contingency {
  condition: string;
  impact: string;
}