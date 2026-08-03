/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
  buildManagementSnapshotExport,
  effectiveTeamDirectionVerdict,
  evaluateForgeFreshnessReceipt,
  forgeFreshnessRevalidationDelayMs,
  isAcceptedForgeFreshnessReceipt,
  useForgeFreshnessRevalidation,
  type TeamDirectionForgeFreshnessReceipt,
} from '@/pages/TiberManagementDashboard';

const ACCEPTED_THROUGH = '2026-08-03T12:00:00.000Z';
const ACCEPTED_THROUGH_MS = Date.parse(ACCEPTED_THROUGH);

function acceptedReceipt(
  acceptedThrough: string | null = ACCEPTED_THROUGH,
): TeamDirectionForgeFreshnessReceipt {
  return {
    receiptVersion: 'team_direction_forge_player_static_freshness_receipt_v1',
    policyId: 'team_direction_forge_player_static_freshness_v1',
    useId: 'forge_player_specific.team_direction_classification',
    decision: 'accepted',
    status: 'fresh',
    reasonCode: 'accepted_fresh',
    clocks: {
      clockSource: 'root.generated_at',
      generatedAtSource: 'root_generated_at',
      evaluatedAt: '2026-08-03T11:59:59.000Z',
      generatedAt: '2026-06-19T12:00:00.000Z',
      promotedAt: null,
      promotedAtCanRefreshClock: false,
      acceptedThrough,
      ageSeconds: 3_887_999,
      ageDays: 44.9999884259,
      maximumAgeDays: 45,
      boundary: 'elapsed_utc_time',
    },
    provenance: {
      requiredScoreSource: 'player_specific',
      explicitPlayerSpecificRequired: true,
    },
    evidence: {
      rosterTotal: 1,
      observedForgeRows: 1,
      observedPlayerSpecificRows: 1,
      eligiblePlayerSpecificRows: 1,
      rejectedPlayerSpecificRows: 0,
      rows: [{
        rosterIndex: 0,
        rosterKey: 'player-1',
        canonicalId: 'player-1',
        playerName: 'Test Player',
        position: 'QB',
        alpha: 70,
        scoreSource: 'player_specific',
        provenance: { source: 'player_specific' },
      }],
    },
    gaps: [],
    conflicts: [],
  };
}

function acceptedLookingTeamDirection(receipt = acceptedReceipt()) {
  return {
    success: true,
    available: true,
    classificationAvailable: true,
    direction: 'contender' as const,
    confidence: 'high' as const,
    forge_freshness_receipt: receipt,
  };
}

function snapshotAt(
  evaluatedAtMs: number,
  receipt = acceptedReceipt(),
  directionOverrides: {
    classificationAvailable?: boolean;
    classificationFailure?: { code?: string; reasonCode?: string } | null;
    reasons?: string[];
    blockers?: string[];
  } = {},
) {
  return buildManagementSnapshotExport({
    generatedAt: new Date(evaluatedAtMs).toISOString(),
    dashboardTeam: {
      team_id: 'team-1',
      display_name: 'Test Team',
      roster: [{
        name: 'Test Player',
        pos: 'QB',
        alpha: 70,
        forgeScoreSource: 'player_specific',
        visibilityState: 'forge_scored',
      }],
    },
    teamDirection: {
      ...acceptedLookingTeamDirection(receipt),
      ...directionOverrides,
    },
  });
}

function ExpiryHarness({
  receipt,
  refetch,
  onRender,
}: {
  receipt?: TeamDirectionForgeFreshnessReceipt;
  refetch: () => unknown;
  onRender?: (classificationAvailable: boolean) => void;
}) {
  const evaluatedAtMs = useForgeFreshnessRevalidation(receipt, refetch, 'test-team');
  const verdict = receipt
    ? effectiveTeamDirectionVerdict(acceptedLookingTeamDirection(receipt), evaluatedAtMs)
    : { classificationAvailable: false, direction: 'uncertain', confidence: 'low' };
  const snapshot = receipt ? snapshotAt(evaluatedAtMs, receipt) : null;
  onRender?.(verdict.classificationAvailable);
  return React.createElement('output', { 'data-testid': 'expiry-state' }, JSON.stringify({ verdict, snapshot }));
}

function renderedExpiryState() {
  return JSON.parse(screen.getByTestId('expiry-state').textContent ?? '{}');
}

describe('Management FORGE receipt expiry handling', () => {
  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('accepts through the exact boundary and rejects at boundary + 1 ms', () => {
    const receipt = acceptedReceipt();

    expect(isAcceptedForgeFreshnessReceipt(receipt, ACCEPTED_THROUGH_MS)).toBe(true);
    expect(evaluateForgeFreshnessReceipt(receipt, ACCEPTED_THROUGH_MS)).toMatchObject({
      accepted: true,
      reason: 'accepted',
    });
    expect(isAcceptedForgeFreshnessReceipt(receipt, ACCEPTED_THROUGH_MS + 1)).toBe(false);
    expect(evaluateForgeFreshnessReceipt(receipt, ACCEPTED_THROUGH_MS + 1)).toMatchObject({
      accepted: false,
      reason: 'accepted_through_expired',
    });
    expect(effectiveTeamDirectionVerdict(
      acceptedLookingTeamDirection(receipt),
      ACCEPTED_THROUGH_MS + 1,
    )).toEqual({ classificationAvailable: false, direction: 'uncertain', confidence: 'low' });
  });

  it.each([
    ['missing', null, 'accepted_through_missing'],
    ['noncanonical offset', '2026-08-03T12:00:00.000+00:00', 'accepted_through_malformed'],
    ['impossible date', '2026-02-30T12:00:00.000Z', 'accepted_through_malformed'],
    ['malformed', 'not-a-timestamp', 'accepted_through_malformed'],
  ])('fails closed for a %s acceptedThrough clock', (_label, acceptedThrough, expectedReason) => {
    const evaluation = evaluateForgeFreshnessReceipt(
      acceptedReceipt(acceptedThrough),
      ACCEPTED_THROUGH_MS - 1,
    );
    expect(evaluation.accepted).toBe(false);
    expect(evaluation.reason).toBe(expectedReason);
  });

  it('caps long timers and schedules the transition one millisecond after the inclusive boundary', () => {
    const receipt = acceptedReceipt();

    expect(forgeFreshnessRevalidationDelayMs(receipt, ACCEPTED_THROUGH_MS)).toBe(1);
    expect(forgeFreshnessRevalidationDelayMs(receipt, ACCEPTED_THROUGH_MS + 1)).toBe(0);
    expect(forgeFreshnessRevalidationDelayMs(receipt, ACCEPTED_THROUGH_MS - 45 * 24 * 60 * 60 * 1000))
      .toBe(24 * 60 * 60 * 1000);
  });

  it('keeps raw evidence but exports zero eligible FORGE coverage after expiry', () => {
    const snapshot = snapshotAt(ACCEPTED_THROUGH_MS + 1, acceptedReceipt(), {
      reasons: ['Cached Alpha rationale must not survive local expiry.'],
      blockers: ['Cached Alpha blocker must not survive local expiry.'],
      classificationFailure: {
        code: 'cached_failure_must_not_survive_local_expiry',
        reasonCode: 'cached_alpha_reason',
      },
    });

    expect(snapshot).toMatchObject({
      team_direction: {
        classification: 'Uncertain',
        confidence: 'Low',
        classification_available: false,
        blocking_reason: 'Client freshness evaluation rejected FORGE: accepted_through_expired.',
        classification_failure: {
          code: 'client_freshness_evaluation_rejected',
          reasonCode: 'accepted_through_expired',
        },
      },
      forge_freshness_receipt: {
        decision: 'accepted',
        status: 'fresh',
        evidence: {
          observedPlayerSpecificRows: 1,
          eligiblePlayerSpecificRows: 1,
          rows: [expect.objectContaining({ playerName: 'Test Player', alpha: 70 })],
        },
      },
      forge_freshness_client_evaluation: {
        accepted: false,
        reason: 'accepted_through_expired',
        accepted_through: ACCEPTED_THROUGH,
      },
      active_roster_summary: {
        player_specific_forge_evidence: {
          matched: 0,
          eligible: 0,
          observed_raw: 1,
          rejected: 1,
          classification_eligible: false,
        },
      },
      active_team_matching: {
        eligible_player_specific_rows: 0,
        observed_raw_player_specific_rows: 1,
        rejected_player_specific_rows: 1,
        classification_eligible: false,
      },
    });
    expect(JSON.stringify(snapshot)).not.toContain('Cached Alpha');
    expect(JSON.stringify(snapshot)).not.toContain('cached_failure_must_not_survive_local_expiry');
  });

  it('does not invent a client freshness failure when an accepted classifier is unavailable', () => {
    const snapshot = snapshotAt(ACCEPTED_THROUGH_MS, acceptedReceipt(), {
      classificationAvailable: false,
      reasons: ['Insufficient eligible coverage.'],
    });

    expect(snapshot.team_direction).toMatchObject({
      classification: 'Uncertain',
      confidence: 'Low',
      classification_available: false,
      classification_failure: null,
      blocking_reason: 'Insufficient eligible coverage.',
    });
    expect(snapshot.forge_freshness_client_evaluation).toMatchObject({
      accepted: true,
      reason: 'accepted',
    });
  });

  it('fails a mounted view/export closed and refetches once when the window expires', async () => {
    jest.useFakeTimers({ now: ACCEPTED_THROUGH_MS - 1_000 });
    const refetch = jest.fn(() => new Promise(() => {}));
    const view = render(React.createElement(ExpiryHarness, { receipt: acceptedReceipt(), refetch }));

    expect(renderedExpiryState().verdict).toEqual({
      classificationAvailable: true,
      direction: 'contender',
      confidence: 'high',
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1_000);
    });
    expect(renderedExpiryState().verdict.classificationAvailable).toBe(true);
    expect(renderedExpiryState().snapshot).toMatchObject({
      forge_freshness_client_evaluation: { accepted: true, reason: 'accepted' },
      active_roster_summary: {
        player_specific_forge_evidence: { eligible: 1, classification_eligible: true },
      },
    });
    expect(refetch).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(renderedExpiryState()).toMatchObject({
      verdict: { classificationAvailable: false, direction: 'uncertain', confidence: 'low' },
      snapshot: {
        forge_freshness_client_evaluation: { accepted: false, reason: 'accepted_through_expired' },
        active_roster_summary: {
          player_specific_forge_evidence: { eligible: 0, classification_eligible: false },
        },
      },
    });

    view.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('never paints a receipt accepted when it arrives after its deadline', async () => {
    jest.useFakeTimers({ now: ACCEPTED_THROUGH_MS - 1_000 });
    const refetch = jest.fn(() => Promise.resolve());
    const renderedAvailability: boolean[] = [];
    const onRender = (classificationAvailable: boolean) => renderedAvailability.push(classificationAvailable);
    const view = render(React.createElement(ExpiryHarness, { refetch, onRender }));

    renderedAvailability.length = 0;
    jest.setSystemTime(ACCEPTED_THROUGH_MS + 1);
    await act(async () => {
      view.rerender(React.createElement(ExpiryHarness, {
        receipt: acceptedReceipt(),
        refetch,
        onRender,
      }));
      await Promise.resolve();
    });

    expect(renderedAvailability[0]).toBe(false);
    expect(renderedAvailability).not.toContain(true);
    expect(renderedExpiryState().verdict.classificationAvailable).toBe(false);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('fails closed and refetches on focus after a suspended tab crosses expiry', async () => {
    jest.useFakeTimers({ now: ACCEPTED_THROUGH_MS - 1_000 });
    const refetch = jest.fn(() => Promise.resolve());
    render(React.createElement(ExpiryHarness, { receipt: acceptedReceipt(), refetch }));

    jest.setSystemTime(ACCEPTED_THROUGH_MS + 1);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(renderedExpiryState().verdict).toEqual({
      classificationAvailable: false,
      direction: 'uncertain',
      confidence: 'low',
    });
  });
});
