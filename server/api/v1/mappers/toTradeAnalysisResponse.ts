/**
 * toTradeAnalysisResponse
 * =======================
 * Maps the v1 trade analyze route's intermediate result into the
 * canonical TradeAnalysisResponse contract (shared/types/intelligence.ts).
 *
 * Pure adapter only: no football logic changes.
 */

import type {
  TradeAnalysisResponse,
  VerdictWinner,
  EdgeStrength,
  Actionability,
  ConfidenceBand,
  MetricEvidence,
  SubjectRef,
} from '../../../../shared/types/intelligence';
import { INTELLIGENCE_CONTRACT_VERSION } from '../../../../shared/types/intelligence';

export interface TradeAsset {
  id: string;
  name?: string;
  position?: string;
  prometheusScore: number;
}

export interface CanonicalTradeInput {
  side_a: TradeAsset[];
  side_b: TradeAsset[];
}

export interface CanonicalTradeResult {
  winnerLabel: string;
  confidence: number;
  sideATotal: number;
  sideBTotal: number;
  valueDifference: number;
  balanceIndex: number;
  reasons: string[];
  warnings?: string[];
}

function clampConfidence(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(1, score));
}

function toConfidenceBand(score: number): ConfidenceBand {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

function mapWinner(winnerLabel: string): VerdictWinner {
  const normalized = winnerLabel.toLowerCase();
  if (normalized.includes('team a')) return 'side_a';
  if (normalized.includes('team b')) return 'side_b';
  if (normalized.includes('fair trade') || normalized.includes('even')) return 'even';
  return 'unknown';
}

function mapEdgeStrength(result: CanonicalTradeResult): EdgeStrength {
  if (result.valueDifference >= 20) return 'strong';
  if (result.valueDifference >= 8) return 'moderate';
  if (result.valueDifference >= 2) return 'slight';
  return result.balanceIndex >= 0.9 ? 'slight' : 'indeterminate';
}

function mapActionability(confidenceBand: ConfidenceBand, winner: VerdictWinner): Actionability {
  if (winner === 'even' || winner === 'unknown') return 'more_research_needed';
  if (confidenceBand === 'high') return 'act_now';
  if (confidenceBand === 'medium') return 'lean_only';
  return 'more_research_needed';
}

function toAssetRef(asset: TradeAsset): SubjectRef {
  return {
    label: asset.name ?? asset.id,
    id: asset.id,
  };
}

function buildAssetMetrics(label: string, players: TradeAsset[]): MetricEvidence[] {
  return players.map((asset) => ({
    name: `${label} asset`,
    value: asset.name ?? asset.id,
    context: asset.position,
    source: 'api_v1_trade_analyze',
  }));
}

export function toTradeAnalysisResponse(
  result: CanonicalTradeResult,
  tradeInput: CanonicalTradeInput,
  opts: { traceId?: string; source?: string },
): TradeAnalysisResponse {
  const confidence = clampConfidence(result.confidence);
  const confidenceBand = toConfidenceBand(confidence);
  const winner = mapWinner(result.winnerLabel);
  const sideALabel = 'Team A';
  const sideBLabel = 'Team B';

  return {
    request_meta: {
      version: INTELLIGENCE_CONTRACT_VERSION,
      intent: 'trade_analysis',
      generated_at: new Date().toISOString(),
      trace_id: opts.traceId,
      source: opts.source ?? 'api_v1',
    },
    subject: {
      type: 'trade_package',
      label: `${sideALabel} vs ${sideBLabel}`,
      side_a: { label: sideALabel },
      side_b: { label: sideBLabel },
      assets: [...tradeInput.side_a, ...tradeInput.side_b].map(toAssetRef),
    },
    verdict: {
      label: result.winnerLabel,
      winner,
      edge_strength: mapEdgeStrength(result),
      actionability: mapActionability(confidenceBand, winner),
    },
    confidence: {
      score: confidence,
      band: confidenceBand,
    },
    summary: (() => {
      const aLabel = `Team A ${result.sideATotal.toFixed(1)}`;
      const bLabel = `Team B ${result.sideBTotal.toFixed(1)}`;
      return `${result.winnerLabel} (${aLabel} vs ${bLabel}; gap ${result.valueDifference.toFixed(1)}).`;
    })(),
    evidence: {
      summary_signal: {
        side_a_package_value: result.sideATotal,
        side_b_package_value: result.sideBTotal,
        value_delta: result.sideATotal - result.sideBTotal,
        market_delta: result.valueDifference,
        anchor_side: winner,
      },
      pillars: [
        {
          name: 'volume',
          delta: result.sideATotal - result.sideBTotal,
          direction: result.sideATotal > result.sideBTotal ? 'side_a' : result.sideATotal < result.sideBTotal ? 'side_b' : 'even',
          notes: [
            `Team A total: ${result.sideATotal.toFixed(1)}`,
            `Team B total: ${result.sideBTotal.toFixed(1)}`,
          ],
        },
        {
          name: 'team_context',
          delta: result.balanceIndex,
          direction: result.balanceIndex >= 0.95 ? 'even' : winner,
          notes: [`Balance index from package totals: ${result.balanceIndex.toFixed(3)}`],
        },
      ],
      metrics: [
        { name: 'team_a_total', value: result.sideATotal, source: 'api_v1_trade_analyze' },
        { name: 'team_b_total', value: result.sideBTotal, source: 'api_v1_trade_analyze' },
        { name: 'value_difference', value: result.valueDifference, source: 'api_v1_trade_analyze' },
        { name: 'balance_index', value: result.balanceIndex, source: 'api_v1_trade_analyze' },
        ...buildAssetMetrics('side_a', tradeInput.side_a),
        ...buildAssetMetrics('side_b', tradeInput.side_b),
      ],
      reasons: result.reasons,
    },
    uncertainty: {
      could_change_if: [
        'Player injury status changes before lineup lock',
        'Role/usage shifts significantly after depth chart updates',
      ],
      missing_inputs: ['FORGE alpha package valuation'],
      warnings: result.warnings,
    },
  };
}
