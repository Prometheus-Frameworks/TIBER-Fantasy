/**
 * Response guard for the Fantasy #310 cache audit.
 *
 * Lives in its own module because `forgeCacheAudit.ts` runs as ESM under tsx
 * (it uses `import.meta.url`), which the Jest/ts-jest CommonJS pipeline cannot
 * parse. Keeping the guard here is what makes it unit-testable at all — the
 * live GETs around it remain deliberately untested.
 */

export const AUDIT_SEASON = 2025;
export const AUDIT_WEEK = 18;

export interface ObservedPositionSource {
  asOf: string;
  layer: string | null;
  source: string | null;
  fallbackReason: string | null;
}

/**
 * Gate every response before a single row is accepted as cache evidence.
 *
 * This audit describes ONE lineage: `forge_grade_cache`. The same endpoint also
 * serves promoted scoring-service items (layer `promoted_artifact`) whenever
 * `SCORING_SERVICE_BASE_URL` is configured and the call succeeds — those rows
 * are Expected Points / VORP, not FORGE alpha. Recording a null fallback reason
 * and carrying on would label the wrong lineage as the observed cache cohort and
 * run FORGE clamping analysis against unrelated scores, silently overwriting
 * both committed artifacts on a rerun. So: fail closed.
 */
export function assertForgeCacheResponse(position: string, body: any): ObservedPositionSource {
  const primary = body?.sourceStack?.[0] ?? null;
  const layer: string | null = primary?.layer ?? null;
  const notes: string = primary?.notes ?? '';

  if (layer !== 'forge') {
    throw new Error(
      `${position}: expected the forge_grade_cache layer, got "${layer ?? 'none'}". ` +
      `This audit must not describe a non-FORGE lineage; re-run against an environment ` +
      `where the scoring service is not serving this endpoint.`,
    );
  }

  // The layer echoes the scope it actually served. A silently different
  // season/week/position would produce artifacts that misstate what was observed.
  const servedSeason = notes.match(/season=(\d+)/)?.[1] ?? null;
  const servedWeek = notes.match(/asOfWeek=(\d+)/)?.[1] ?? null;
  const servedPosition = notes.match(/position=([A-Z]+)/)?.[1] ?? null;
  if (
    servedSeason !== String(AUDIT_SEASON) ||
    servedWeek !== String(AUDIT_WEEK) ||
    servedPosition !== position
  ) {
    throw new Error(
      `${position}: served scope (season=${servedSeason}, asOfWeek=${servedWeek}, ` +
      `position=${servedPosition}) does not match the requested scope ` +
      `(season=${AUDIT_SEASON}, asOfWeek=${AUDIT_WEEK}, position=${position}).`,
    );
  }

  return {
    asOf: body.asOf,
    layer,
    source: primary?.source ?? null,
    fallbackReason: notes.match(/scoringFallbackReason=([a-z_]+)/)?.[1] ?? null,
  };
}
