/**
 * Calibration harness for the Tiber Matrix role assignment system.
 *
 * Run labeled fixture cases through assignRoleFromUsage and summarize
 * hit/miss/confusion points. Designed to be invoked from tests or
 * ad-hoc scripts to evaluate threshold tuning without LLM dependency.
 */

import type { NormalizedUsageInput, TiberMatrixRoleId } from '@shared/types/roleOntology';
import { assignRoleFromUsage } from './assignRoleFromUsage';

export interface CalibrationFixture {
  /** Human-readable label for the fixture (e.g. "Lamar Jackson 2023"). */
  label: string;
  /** The normalized usage input to classify. */
  input: NormalizedUsageInput;
  /** The expected primary role assignment. */
  expected_primary: TiberMatrixRoleId;
  /** If set, the expected secondary role. */
  expected_secondary?: TiberMatrixRoleId;
  /** Optional notes explaining the fixture choice. */
  notes?: string;
}

export interface CalibrationResult {
  label: string;
  expected_primary: TiberMatrixRoleId;
  actual_primary: TiberMatrixRoleId;
  primary_hit: boolean;
  expected_secondary?: TiberMatrixRoleId;
  actual_secondary?: TiberMatrixRoleId;
  secondary_hit: boolean;
  confidence: string;
  stability: string;
  data_sufficiency: string;
  reasoning: string[];
}

export interface CalibrationSummary {
  total: number;
  primary_hits: number;
  primary_misses: number;
  primary_accuracy: number;
  secondary_evaluated: number;
  secondary_hits: number;
  confusion_pairs: Array<{ expected: TiberMatrixRoleId; actual: TiberMatrixRoleId; labels: string[] }>;
  results: CalibrationResult[];
}

/**
 * Run a set of labeled fixtures through the role assignment engine
 * and return a structured summary of accuracy and confusion.
 */
export function runCalibration(fixtures: CalibrationFixture[]): CalibrationSummary {
  const results: CalibrationResult[] = [];
  const confusionMap = new Map<string, { expected: TiberMatrixRoleId; actual: TiberMatrixRoleId; labels: string[] }>();

  for (const fixture of fixtures) {
    const assignment = assignRoleFromUsage(fixture.input);

    const primaryHit = assignment.primary_role === fixture.expected_primary;
    const secondaryHit = fixture.expected_secondary
      ? assignment.secondary_role === fixture.expected_secondary
      : true; // no expectation = pass

    results.push({
      label: fixture.label,
      expected_primary: fixture.expected_primary,
      actual_primary: assignment.primary_role,
      primary_hit: primaryHit,
      expected_secondary: fixture.expected_secondary,
      actual_secondary: assignment.secondary_role,
      secondary_hit: secondaryHit,
      confidence: assignment.role_confidence,
      stability: assignment.role_stability,
      data_sufficiency: assignment.data_sufficiency,
      reasoning: assignment.assignment_reasoning,
    });

    if (!primaryHit) {
      const key = `${fixture.expected_primary}->${assignment.primary_role}`;
      const existing = confusionMap.get(key);
      if (existing) {
        existing.labels.push(fixture.label);
      } else {
        confusionMap.set(key, {
          expected: fixture.expected_primary,
          actual: assignment.primary_role,
          labels: [fixture.label],
        });
      }
    }
  }

  const primaryHits = results.filter((r) => r.primary_hit).length;
  const secondaryEvaluated = results.filter((r) => r.expected_secondary !== undefined).length;
  const secondaryHits = results.filter((r) => r.expected_secondary !== undefined && r.secondary_hit).length;

  return {
    total: fixtures.length,
    primary_hits: primaryHits,
    primary_misses: fixtures.length - primaryHits,
    primary_accuracy: fixtures.length > 0 ? primaryHits / fixtures.length : 0,
    secondary_evaluated: secondaryEvaluated,
    secondary_hits: secondaryHits,
    confusion_pairs: Array.from(confusionMap.values()),
    results,
  };
}

/**
 * Format a calibration summary as a human-readable string for console output.
 */
export function formatCalibrationSummary(summary: CalibrationSummary): string {
  const lines: string[] = [
    `=== Calibration Summary ===`,
    `Total fixtures: ${summary.total}`,
    `Primary hits: ${summary.primary_hits}/${summary.total} (${(summary.primary_accuracy * 100).toFixed(1)}%)`,
    `Primary misses: ${summary.primary_misses}`,
  ];

  if (summary.secondary_evaluated > 0) {
    lines.push(`Secondary evaluated: ${summary.secondary_evaluated}, hits: ${summary.secondary_hits}`);
  }

  if (summary.confusion_pairs.length > 0) {
    lines.push('', '--- Confusion Pairs ---');
    for (const cp of summary.confusion_pairs) {
      lines.push(`  Expected ${cp.expected} -> Got ${cp.actual} [${cp.labels.join(', ')}]`);
    }
  }

  const misses = summary.results.filter((r) => !r.primary_hit);
  if (misses.length > 0) {
    lines.push('', '--- Misclassified Details ---');
    for (const miss of misses) {
      lines.push(`  ${miss.label}: expected=${miss.expected_primary}, actual=${miss.actual_primary}`);
      lines.push(`    confidence=${miss.confidence}, sufficiency=${miss.data_sufficiency}`);
      lines.push(`    reasoning: ${miss.reasoning.slice(0, 3).join(' | ')}`);
    }
  }

  return lines.join('\n');
}
