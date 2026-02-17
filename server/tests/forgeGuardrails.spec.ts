/**
 * FORGE Calibration Guardrail Tests
 *
 * Permanent safety-net tests that catch regressions in calibration quality.
 * These are integration tests that require a running server with populated data.
 *
 * Tests:
 * 1. Monotonicity: calibration preserves raw score ordering
 * 2. Amplification: small raw gaps don't become disproportionate alpha gaps
 * 3. Top-K Recall: top 12 PPG players land in T1/T2
 * 4. Inversion Penalty: no large PPG-gap inversions in top tiers
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:5000';
const POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;
const SEASON = 2025;

interface ForgeScore {
  playerId: string;
  playerName: string;
  position: string;
  alpha: number;
  rawAlpha: number;
  tier: string;
  ppg?: number;
}

async function fetchBatchScores(position: string): Promise<ForgeScore[]> {
  const res = await fetch(`${API_BASE}/api/forge/batch?position=${position}&season=${SEASON}&limit=100`);
  expect(res.status).to.equal(200);
  const data = await res.json();
  expect(data.success).to.equal(true);
  return data.scores || [];
}

describe('FORGE Calibration Guardrails', () => {

  describe('Monotonicity Test', () => {
    for (const position of POSITIONS) {
      it(`preserves raw score ordering for ${position}`, async () => {
        const scores = await fetchBatchScores(position);
        if (scores.length < 2) return; // Skip if insufficient data

        // For all pairs: if rawAlpha_i > rawAlpha_j then alpha_i >= alpha_j
        let violations = 0;
        for (let i = 0; i < scores.length; i++) {
          for (let j = i + 1; j < scores.length; j++) {
            if (scores[i].rawAlpha > scores[j].rawAlpha && scores[i].alpha < scores[j].alpha) {
              violations++;
            }
            if (scores[j].rawAlpha > scores[i].rawAlpha && scores[j].alpha < scores[i].alpha) {
              violations++;
            }
          }
        }

        expect(violations).to.equal(0,
          `${position}: Found ${violations} monotonicity violations (rawAlpha ordering not preserved in calibrated alpha)`
        );
      });
    }
  });

  describe('Amplification Test', () => {
    const MAX_AMPLIFICATION = 3.0;

    for (const position of POSITIONS) {
      it(`${position} alpha gap / raw gap <= ${MAX_AMPLIFICATION}x`, async () => {
        const scores = await fetchBatchScores(position);
        if (scores.length < 2) return;

        let worstAmplification = 0;
        let worstPair = '';

        for (let i = 0; i < scores.length; i++) {
          for (let j = i + 1; j < scores.length; j++) {
            const rawGap = Math.abs(scores[i].rawAlpha - scores[j].rawAlpha);
            if (rawGap < 1.0) continue; // Skip near-identical raw scores

            const alphaGap = Math.abs(scores[i].alpha - scores[j].alpha);
            const amplification = alphaGap / rawGap;

            if (amplification > worstAmplification) {
              worstAmplification = amplification;
              worstPair = `${scores[i].playerName} vs ${scores[j].playerName}`;
            }
          }
        }

        expect(worstAmplification).to.be.at.most(MAX_AMPLIFICATION,
          `${position}: Amplification factor ${worstAmplification.toFixed(2)}x exceeds max ${MAX_AMPLIFICATION}x for pair: ${worstPair}`
        );
      });
    }
  });

  describe('Top-K Recall Test', () => {
    const TOP_K = 12;
    const MIN_RECALL = 10; // 10 of 12 = 83%
    const ELITE_TIERS = ['T1', 'T2'];

    for (const position of POSITIONS) {
      it(`${position}: >= ${MIN_RECALL} of top ${TOP_K} PPG players in T1/T2`, async () => {
        const scores = await fetchBatchScores(position);
        if (scores.length < TOP_K) return; // Skip if insufficient data

        // Filter players with PPG data
        const withPpg = scores.filter(s => s.ppg != null && s.ppg > 0);
        if (withPpg.length < TOP_K) return;

        // Sort by PPG descending to find top-K by actual production
        const sortedByPpg = [...withPpg].sort((a, b) => (b.ppg || 0) - (a.ppg || 0));
        const topKByPpg = sortedByPpg.slice(0, TOP_K);

        // Count how many landed in T1/T2
        const inEliteTiers = topKByPpg.filter(s => ELITE_TIERS.includes(s.tier));
        const recall = inEliteTiers.length;

        const missed = topKByPpg
          .filter(s => !ELITE_TIERS.includes(s.tier))
          .map(s => `${s.playerName}(${s.ppg?.toFixed(1)}ppg,${s.tier})`)
          .join(', ');

        expect(recall).to.be.at.least(MIN_RECALL,
          `${position}: Only ${recall}/${TOP_K} top PPG players in T1/T2. Missed: ${missed}`
        );
      });
    }
  });

  describe('Inversion Penalty Count', () => {
    const PPG_GAP_THRESHOLD = 5.0;
    const CHECKED_TIERS = ['T1', 'T2'];

    for (const position of POSITIONS) {
      it(`${position}: zero inversions with PPG gap > ${PPG_GAP_THRESHOLD} in T1/T2`, async () => {
        const scores = await fetchBatchScores(position);
        if (scores.length < 2) return;

        // Filter to T1/T2 players with PPG data
        const elitePlayers = scores.filter(s =>
          CHECKED_TIERS.includes(s.tier) && s.ppg != null && s.ppg > 0
        );

        let inversions = 0;
        const inversionDetails: string[] = [];

        for (let i = 0; i < elitePlayers.length; i++) {
          for (let j = i + 1; j < elitePlayers.length; j++) {
            const ppgGap = Math.abs((elitePlayers[i].ppg || 0) - (elitePlayers[j].ppg || 0));
            if (ppgGap < PPG_GAP_THRESHOLD) continue;

            // Higher PPG should have higher or equal alpha
            const higherPpg = (elitePlayers[i].ppg || 0) > (elitePlayers[j].ppg || 0) ? elitePlayers[i] : elitePlayers[j];
            const lowerPpg = higherPpg === elitePlayers[i] ? elitePlayers[j] : elitePlayers[i];

            if (lowerPpg.alpha > higherPpg.alpha) {
              inversions++;
              inversionDetails.push(
                `${lowerPpg.playerName}(${lowerPpg.ppg?.toFixed(1)}ppg,α=${lowerPpg.alpha}) > ${higherPpg.playerName}(${higherPpg.ppg?.toFixed(1)}ppg,α=${higherPpg.alpha})`
              );
            }
          }
        }

        expect(inversions).to.equal(0,
          `${position}: Found ${inversions} inversions with PPG gap > ${PPG_GAP_THRESHOLD} in T1/T2: ${inversionDetails.join('; ')}`
        );
      });
    }
  });
});
