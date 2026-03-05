/**
 * Tiber Frontend / UI Compatibility Layer
 * =========================================
 * This file exists for frontend compatibility. It is NOT the canonical
 * intelligence contract owner.
 *
 * Canonical contract: shared/types/intelligence.ts
 * Voice adapter layer: server/voice/types.ts
 *
 * Do not add new response shapes here. Extend shared/types/intelligence.ts
 * and add a UI-layer mapping when needed.
 */

/**
 * Frontend-scoped intent type (mirrors voice/types.ts for UI routing).
 * Canonical equivalents live in shared/types/intelligence.ts as TiberIntent
 * (lowercase snake_case). This duplicate exists for historical frontend
 * compatibility — do not propagate it to new surfaces.
 */
export type TiberIntent = 'START_SIT' | 'TRADE' | 'WAIVER' | 'RANKING_EXPLAIN' | 'PLAYER_OUTLOOK';

export interface TiberResponse {
  verdict: string;           // "Start", "Bench", "Lean Trade For", "Claim: High"
  confidence: number;        // 0..100
  reasons: string[];         // short, factual bullets
  metrics: Record<string, any>; // Power, RAG, deltas, etc.
  contingencies?: string[];  // "If Player X OUT → flip"
  tone: 'tiber';             // so frontend picks correct style
}

// For backward compatibility with existing CompetenceResponse interface
export interface TiberCompatResponse {
  recommendation: string;
  reasoning: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  alternatives?: Array<{
    option: string;
    pros: string[];
    cons: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  proactiveInsights?: string[];
  dataSupport?: Array<{
    metric: string;
    value: string | number;
    source: string;
    context: string;
  }>;
  challengesToUserThinking?: string[];
}