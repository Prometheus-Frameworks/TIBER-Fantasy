/**
 * Tiber Voice System Types
 * For frontend compatibility
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