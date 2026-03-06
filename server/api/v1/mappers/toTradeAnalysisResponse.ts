/**
 * toTradeAnalysisResponse
 * =======================
 * Maps the transitional TradeEvaluationResult from tradeLogic.ts into the
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
import type { TradeEvaluationResult, TradeInput, TradePlayer } from '../../../services/trade/tradeLogic';

const CONTRACT_VERSION = '1.0.0';

function clampConfidence(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(1, score));
}

function toConfidenceBand(score: number): ConfidenceBand {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

function mapWinner(winner: string): VerdictWinner {
  const normalized = winner.toLowerCase();
  if (normalized.includes('team a')) return 'side_a';
  if (normalized.includes('team b')) return 'side_b';
  if (normalized.includes('fair trade') || normalized.includes('even') || normalized.includes('lopsided')) return 'even';
  return 'unknown';
}

function mapEdgeStrength(result: TradeEvaluationResult): EdgeStrength {
  const strength = result.verdict?.strength?.toLowerCase?.() ?? '';
  if (strength.includes('strong')) return 'strong';
  if (strength.includes('moderate')) return 'moderate';
  if (strength.includes('slight')) return 'slight';
  return result.balanceIndex >= 0.9 ? 'slight' : 'indeterminate';
}

function mapActionability(confidenceBand: ConfidenceBand, winner: VerdictWinner): Actionability {
  if (winner === 'even' || winner === 'unknown') return 'more_research_needed';
  if (confidenceBand === 'high') return 'act_now';
  if (confidenceBand === 'medium') return 'lean_only';
  return 'more_research_needed';
}

function toAssetRef(player: TradePlayer): SubjectRef {
  return {
    label: player.name ?? player.id,
    id: player.id,
  };
}

function buildAssetMetrics(label: string, players: TradePlayer[]): MetricEvidence[] {
  return players.map((asset) => ({
    name: `${label} asset`,
    value: asset.name ?? asset.id,
    context: asset.position,
    source: 'tradeLogic',
  }));
}

export function toTradeAnalysisResponse(
  result: TradeEvaluationResult,
  tradeInput: TradeInput,
  opts: { traceId?: string; source?: string },
): TradeAnalysisResponse {
  const confidence = clampConfidence(result.confidence);
  const confidenceBand = toConfidenceBand(confidence);
  const winner = mapWinner(result.winner);
  const sideALabel = 'Team A';
  const sideBLabel = 'Team B';

  return {
    request_meta: {
      version: CONTRACT_VERSION,
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
      assets: [...tradeInput.teamA, ...tradeInput.teamB].map(toAssetRef),
    },
    verdict: {
      label: result.winner,
      winner,
      edge_strength: mapEdgeStrength(result),
      actionability: mapActionability(confidenceBand, winner),
    },
    confidence: {
      score: confidence,
      band: confidenceBand,
    },
    summary: `${result.winner} (value gap: ${result.valueDifference.toFixed(1)}, balance index: ${result.balanceIndex.toFixed(2)}).`,
    evidence: {
      summary_signal: {
        package_value: (result.teamATotal + result.teamBTotal) / 2,
        market_delta: result.valueDifference,
      },
      pillars: [
        {
          name: 'volume',
          delta: result.teamATotal - result.teamBTotal,
          direction: result.teamATotal > result.teamBTotal ? 'side_a' : result.teamATotal < result.teamBTotal ? 'side_b' : 'even',
          notes: [
            `Team A total: ${result.teamATotal.toFixed(1)}`,
            `Team B total: ${result.teamBTotal.toFixed(1)}`,
          ],
        },
        {
          name: 'team_context',
          score: result.balanceIndex,
          direction: result.balanceIndex >= 0.95 ? 'even' : winner,
          notes: [`Balance index from tradeLogic: ${result.balanceIndex.toFixed(3)}`],
        },
      ],
      metrics: [
        { name: 'team_a_total', value: result.teamATotal, source: 'tradeLogic' },
        { name: 'team_b_total', value: result.teamBTotal, source: 'tradeLogic' },
        { name: 'value_difference', value: result.valueDifference, source: 'tradeLogic' },
        { name: 'balance_index', value: result.balanceIndex, source: 'tradeLogic' },
        ...buildAssetMetrics('side_a', tradeInput.teamA),
        ...buildAssetMetrics('side_b', tradeInput.teamB),
      ],
      reasons: result.recommendations,
    },
    uncertainty: {
      could_change_if: [
        'Player injury status changes before lineup lock',
        'Role/usage shifts significantly after depth chart updates',
      ],
      missing_inputs: ['FORGE alpha package valuation'],
      warnings: result.verdict?.isLopsided ? ['Trade flagged as lopsided by legacy verdict system'] : undefined,
    },
  };
}
