import {
  ExpertMockDraftSnapshotV0Schema,
  ExpertSignalEventV0Schema,
  RFC3339_INSTANT_PATTERN,
} from './contracts';

function validInstant(value: string): boolean {
  return RFC3339_INSTANT_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

function knownAtEligible(knownAt: string, decisionAsOf: string): boolean {
  if (!validInstant(knownAt) || !validInstant(decisionAsOf)) return false;
  return Date.parse(knownAt) <= Date.parse(decisionAsOf);
}

/**
 * Fail-closed point-in-time eligibility for expert signals.
 * Publication and retrieval clocks are provenance only; knownAt is the
 * decision-eligibility clock.
 */
export function isExpertSignalEligibleAt(signal: unknown, decisionAsOf: string): boolean {
  const parsed = ExpertSignalEventV0Schema.safeParse(signal);
  if (!parsed.success) return false;
  return knownAtEligible(parsed.data.knownAt, decisionAsOf);
}

/** Fail-closed point-in-time eligibility for immutable expert mock snapshots. */
export function isExpertMockSnapshotEligibleAt(snapshot: unknown, decisionAsOf: string): boolean {
  const parsed = ExpertMockDraftSnapshotV0Schema.safeParse(snapshot);
  if (!parsed.success) return false;
  return knownAtEligible(parsed.data.knownAt, decisionAsOf);
}
