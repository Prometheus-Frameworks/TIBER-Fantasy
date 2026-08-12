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

const FORGE_CACHE_SOURCE = 'api/forge/tiers cache (forge_grade_cache)';
const FORGE_CONFIDENCE_SOURCE = 'forge cache confidence + trajectory metadata';
const FORGE_CONFIDENCE_NOTE = 'Freshness derived from cache computedAt.';
const FORGE_TRUST_FRESHNESS_NOTE = 'Freshness based on forge cache computedAt.';
const FORGE_SOURCE_NOTE =
  /^scoringFallbackReason=(none|insufficient_coverage|invalid_scoring_payload|config_error|upstream_unavailable|upstream_timeout|upstream_error|invalid_payload); season=(0|[1-9]\d*), decisionTargetWeek=(0|[1-9]\d*), cacheDeclaredAsOfWeek=(0|[1-9]\d*), position=(QB|RB|WR|TE)$/;

export interface ObservedPositionSource {
  asOf: string;
  layer: string | null;
  source: string | null;
  fallbackReason: string | null;
}

function parseForgeCacheSourceNote(position: string, notes: unknown) {
  if (typeof notes !== 'string') {
    throw new Error(`${position}: FORGE cache source notes are missing or are not a string.`);
  }

  const match = FORGE_SOURCE_NOTE.exec(notes);
  if (!match) {
    throw new Error(
      `${position}: FORGE cache source notes do not match the current closed Rankings v2 grammar.`,
    );
  }

  return {
    fallbackReason: match[1],
    season: match[2],
    decisionTargetWeek: match[3],
    cacheDeclaredAsOfWeek: match[4],
    position: match[5],
  };
}

function isCanonicalIso(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
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
  const sourceStack = body?.sourceStack;
  const primary = Array.isArray(sourceStack) ? sourceStack[0] ?? null : null;
  const layer: string | null = primary?.layer ?? null;

  if (layer !== 'forge') {
    throw new Error(
      `${position}: expected the forge_grade_cache layer, got "${layer ?? 'none'}". ` +
      `This audit must not describe a non-FORGE lineage; re-run against an environment ` +
      `where the scoring service is not serving this endpoint.`,
    );
  }

  if (primary?.source !== FORGE_CACHE_SOURCE) {
    throw new Error(
      `${position}: expected source "${FORGE_CACHE_SOURCE}", got ` +
      `"${typeof primary?.source === 'string' ? primary.source : 'none'}".`,
    );
  }

  const confidenceLayer = sourceStack[1];
  if (
    sourceStack.length !== 2 ||
    confidenceLayer?.layer !== 'confidence_stability' ||
    confidenceLayer?.source !== FORGE_CONFIDENCE_SOURCE
  ) {
    throw new Error(
      `${position}: expected exactly the Rankings v2 FORGE cache source followed by its ` +
      'confidence_stability companion, with no additional producer layers.',
    );
  }

  // A nonempty cache response can still lack `computedAt`. In that case the
  // route synthesizes its top-level `asOf` from the response clock while both
  // source entries truthfully carry null. That response time is not cache
  // evidence time, so it cannot make a fresh observation reproducible. Admit
  // only a canonical cache clock repeated identically by the primary source,
  // its confidence companion, and the top-level response.
  const responseAsOf = body?.asOf;
  const primaryAsOf = primary?.asOf;
  const confidenceAsOf = confidenceLayer?.asOf;
  if (
    !isCanonicalIso(responseAsOf) ||
    !isCanonicalIso(primaryAsOf) ||
    !isCanonicalIso(confidenceAsOf)
  ) {
    throw new Error(
      `${position}: top-level, FORGE cache, and confidence source asOf values ` +
      'must each be canonical ISO datetimes.',
    );
  }
  if (primaryAsOf !== responseAsOf || confidenceAsOf !== responseAsOf) {
    throw new Error(
      `${position}: top-level, FORGE cache, and confidence source asOf values ` +
      'must agree exactly.',
    );
  }
  if (confidenceLayer?.notes !== FORGE_CONFIDENCE_NOTE) {
    throw new Error(
      `${position}: confidence source notes must identify cache computedAt as the freshness source.`,
    );
  }

  const seasonGeneratedAt = body?.seasonMeta?.generatedAt;
  const trustAsOf = body?.trust?.asOf;
  if (!isCanonicalIso(seasonGeneratedAt) || !isCanonicalIso(trustAsOf)) {
    throw new Error(
      `${position}: seasonMeta.generatedAt and trust.asOf must each be canonical ` +
      'cache-evidence datetimes.',
    );
  }
  if (seasonGeneratedAt !== primaryAsOf || trustAsOf !== primaryAsOf) {
    throw new Error(
      `${position}: seasonMeta.generatedAt and trust.asOf must agree exactly with ` +
      'the admitted FORGE cache source clock.',
    );
  }
  if (body?.trust?.freshnessNote !== FORGE_TRUST_FRESHNESS_NOTE) {
    throw new Error(
      `${position}: trust.freshnessNote must identify cache computedAt as the freshness source.`,
    );
  }

  // The current Rankings v2 FORGE layer records two different week facts:
  // `decisionTargetWeek` is the board the caller asked it to build, while
  // `cacheDeclaredAsOfWeek` is the week declared by the rows it actually
  // admitted. Both must equal the audit request. The former bare `asOfWeek`
  // note is deliberately not accepted as compatibility input: it cannot prove
  // that the admitted cache evidence belongs to the requested board.
  // A silently different season/week/position would produce artifacts that
  // misstate what was observed.
  const noteScope = parseForgeCacheSourceNote(position, primary?.notes);
  if (
    noteScope.season !== String(AUDIT_SEASON) ||
    noteScope.decisionTargetWeek !== String(AUDIT_WEEK) ||
    noteScope.cacheDeclaredAsOfWeek !== String(AUDIT_WEEK) ||
    noteScope.position !== position
  ) {
    throw new Error(
      `${position}: served scope (season=${noteScope.season}, ` +
      `decisionTargetWeek=${noteScope.decisionTargetWeek}, ` +
      `cacheDeclaredAsOfWeek=${noteScope.cacheDeclaredAsOfWeek}, ` +
      `position=${noteScope.position}) does not match the requested scope ` +
      `(season=${AUDIT_SEASON}, decisionTargetWeek=${AUDIT_WEEK}, ` +
      `cacheDeclaredAsOfWeek=${AUDIT_WEEK}, position=${position}).`,
    );
  }

  // Notes are diagnostic text. The current response also carries the same
  // decision/evidence facts structurally, so require agreement instead of
  // allowing correct-looking text to bless a contradictory payload.
  const meta = body?.seasonMeta;
  const structuredScopeMatches =
    meta !== null &&
    typeof meta === 'object' &&
    !Array.isArray(meta) &&
    meta.decisionTargetSeason === AUDIT_SEASON &&
    meta.decisionTargetWeek === AUDIT_WEEK &&
    meta.evidenceSeason === AUDIT_SEASON &&
    meta.evidenceWeek === AUDIT_WEEK &&
    meta.evidenceThroughSeason === AUDIT_SEASON &&
    meta.evidenceThroughWeek === AUDIT_WEEK &&
    meta.evidenceProvenance === 'source_declared_as_of';
  if (!structuredScopeMatches) {
    throw new Error(
      `${position}: structured Rankings v2 seasonMeta does not prove the requested ` +
      `${AUDIT_SEASON} Week ${AUDIT_WEEK} decision and source-declared evidence scope.`,
    );
  }

  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`${position}: guarded FORGE cache evidence requires a nonempty items array.`);
  }
  if (items.some((item) => item === null || typeof item !== 'object' || item.position !== position)) {
    throw new Error(
      `${position}: every guarded FORGE cache item must declare the requested position ${position}.`,
    );
  }

  return {
    asOf: primaryAsOf,
    layer,
    source: primary?.source ?? null,
    fallbackReason: noteScope.fallbackReason,
  };
}
