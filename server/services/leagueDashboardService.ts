import { storage, type IStorage } from '../storage';
import { sleeperClient, type SleeperPlayer, type SleeperRoster } from '../integrations/sleeperClient';
import { db } from '../infra/db';
import { playerIdentityMap } from '@shared/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { forgeService } from '../modules/forge/forgeService';
import type { ForgeScore } from '../modules/forge/types';
import { createPlaybookForgeLogger, type PlaybookForgeLogger } from '../utils/playbookForgeLogger';
import {
  findRookieAsset,
  rookieArtifactService,
  type RookieAssetContext,
} from '../modules/externalModels/rookies/rookieArtifactService';
import {
  forgePlayerStaticService,
  type ForgePlayerStaticService,
} from '../modules/externalModels/forge/forgePlayerStaticService';
import type { ForgePlayerStaticLookup, ForgePlayerStaticRow } from '../modules/externalModels/forge/forgePlayerStaticTypes';
import {
  tiberIdentityCrosswalkService,
  type TiberIdentityCrosswalkService,
} from '../modules/externalModels/identity/tiberIdentityCrosswalkService';
import type { TiberIdentityCrosswalkLookup } from '../modules/externalModels/identity/tiberIdentityCrosswalkTypes';
import {
  strategyOntologyIntegration,
  type StrategyOntologyIntegration,
} from '../modules/externalModels/strategyOntology/StrategyOntologyIntegration';
import type { StrategyOntologyLookup } from '../modules/externalModels/strategyOntology/types';
import { summarizeStrategyOntologyTemplates, type StrategyOntologyTemplateSummary } from '@shared/strategyTemplateDiagnostics';

const BENCH_WEIGHT = 0.15;
const CACHE_TTL_MS = 30 * 60 * 1000;
const MISSING_RATE_BYPASS_THRESHOLD = Number(process.env.PLAYBOOK_FORGE_BYPASS_THRESHOLD ?? 0.1);

type RosterVisibilityState = 'forge_scored' | 'forge_baseline' | 'rookie_alpha_fallback' | 'known_unscored' | 'unresolved';
type ForgeScoreSource = 'player_specific' | 'generated_baseline' | 'fallback_default' | 'unknown' | 'cached_unknown';

type RosterCoverageCounts = {
  total: number;
  identityCovered: number;
  baselineVisible: number;
  forgeScored: number;
  forgeBaseline: number;
  generatedBaselineVisibility: number;
  rookieAlphaFallback: number;
  knownUnscored: number;
  unresolved: number;
  evidenceCovered: number;
};

type ForgeRosterMatchDiagnostics = {
  rosterCanonicalIdsChecked: number;
  rosterCanonicalIdsMatched: number;
  directCanonicalMatches: number;
  crosswalkCanonicalMatches: number;
  playerSpecificRosterMatches: number;
  generatedBaselineRosterMatches: number;
  nonEvidenceRosterMatches: number;
  sampleUnmatchedCanonicalIds: string[];
  sampleMatchedCanonicalIds: string[];
  sampleCrosswalkMatchedCanonicalIds: Array<{ rosterCanonicalId: string; forgePlayerId: string; providerKey: string }>;
};

type LeagueDashboardPlayer = {
  rosterKey: string;
  canonicalId: string | null;
  sleeperId?: string | null;
  provider?: 'sleeper' | string | null;
  providerPlayerId?: string | null;
  providerCanonicalId?: string | null;
  currentTiberPlayerId?: string | null;
  crosswalkStatus?: 'matched' | 'missing' | 'unresolved';
  identityProviderKey?: string | null;
  name: string;
  pos: string;
  nflTeam?: string | null;
  alpha: number | null;
  forgeScoreSource?: ForgeScoreSource | null;
  forgeScoreProvenance?: {
    source: ForgeScoreSource;
    reason: string;
    gamesPlayed?: number | null;
    confidence?: number | null;
    dataQuality?: ForgeScore['dataQuality'] | null;
    artifactId?: 'FORGE_PLAYER_STATIC_V1';
    contractVersion?: string | null;
    matchType?: 'direct' | 'identity_crosswalk';
    rosterCanonicalId?: string | null;
    forgePlayerId?: string | null;
    identityProviderKey?: string | null;
    identityCrosswalkArtifactId?: 'TIBER_IDENTITY_CROSSWALK_V1' | null;
  } | null;
  tier?: number | null;
  missingReason?: string | null;
  visibilityState?: RosterVisibilityState;
  unavailableReason?: string | null;
  rookieAsset?: RookieAssetContext | null;
};

export type LeagueDashboardTeam = {
  team_id: string;
  display_name: string;
  totals: { QB: number; RB: number; WR: number; TE: number };
  bench_contribution: number;
  overall_total: number;
  starters_used: Array<LeagueDashboardPlayer>;
  roster: Array<LeagueDashboardPlayer & { usedAsStarter: boolean }>;
};

export type LeagueDashboardPayload = {
  success: true;
  meta: { league_id: string; week: number | null; season: number | null; computed_at: string; cached: boolean };
  diagnostics?: {
    rosterCount: number;
    resolvedCanonicalCount: number;
    unresolvedSleeperCount: number;
    cachedForgeRowCount: number;
    computedForgeCount: number;
    stillMissingCount: number;
    rookieAlphaMatchedCount: number;
    forgeScoredCount: number;
    forgeBaselineCount: number;
    rookieAlphaFallbackCount: number;
    knownUnscoredCount: number;
    unresolvedCount: number;
    identityCoveredCount: number;
    baselineVisibleCount: number;
    evidenceCoveredCount: number;
    playerSpecificForgeCoverageCount: number;
    generatedBaselineVisibilityCount: number;
    unresolvedRosterIdentityCount: number;
    forgeArtifact: ForgePlayerStaticLookup['artifact'];
    identityCrosswalkArtifact: TiberIdentityCrosswalkLookup['artifact'];
    strategyOntologyArtifact: StrategyOntologyLookup['artifact'];
    strategyOntologyTemplates: StrategyOntologyTemplateSummary[];
    forgeRosterMatching: ForgeRosterMatchDiagnostics;
    rosterVisibility: RosterCoverageCounts;
  };
  unresolvedPlayers: Array<{ sleeperId: string; reason: string }>;
  teams: LeagueDashboardTeam[];
  leagueSettings?: unknown;
  settings?: unknown;
};

type LeagueDashboardParams = {
  userId: string;
  leagueId: string;
  week?: number | null;
  season?: number | null;
  refresh?: boolean;
  upsertCache?: boolean;
};

type DebugOptions = {
  logger?: PlaybookForgeLogger;
  enabled?: boolean;
  requestId?: string;
};

type LeagueDashboardDeps = {
  storage: IStorage;
  sleeperClient: typeof sleeperClient;
  db: typeof db;
  forgeService: typeof forgeService;
  rookieArtifactService?: Pick<typeof rookieArtifactService, 'getRookieAssetLookup'>;
  forgePlayerStaticService?: Pick<ForgePlayerStaticService, 'getLookup'>;
  tiberIdentityCrosswalkService?: Pick<TiberIdentityCrosswalkService, 'getLookup'>;
  strategyOntologyIntegration?: Pick<StrategyOntologyIntegration, 'getLookup'>;
};

const defaultDeps: LeagueDashboardDeps = {
  storage,
  sleeperClient,
  db,
  forgeService,
  rookieArtifactService,
  forgePlayerStaticService,
  tiberIdentityCrosswalkService,
  strategyOntologyIntegration,
};

function normalizeExternalId(value?: string | null) {
  if (!value) return null;
  return String(value);
}


function normalizeSleeperPosition(position?: string | null): string | null {
  const normalized = position?.trim().toUpperCase();
  if (!normalized) return null;
  const positionMap: Record<string, string> = {
    QUARTERBACK: 'QB',
    'RUNNING BACK': 'RB',
    RUNNINGBACK: 'RB',
    'WIDE RECEIVER': 'WR',
    WIDERECEIVER: 'WR',
    'TIGHT END': 'TE',
    TIGHTEND: 'TE',
    DEFENSE: 'DEF',
    DEFENCE: 'DEF',
    DST: 'DEF',
    'D/ST': 'DEF',
  };
  return positionMap[normalized] ?? normalized;
}

function normalizeSleeperTeam(team?: string | null): string | null {
  const normalized = team?.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === 'JAX') return 'JAC';
  return normalized;
}

function buildSleeperFullName(player: SleeperPlayer): string | null {
  const fullName = player.full_name?.trim();
  if (fullName) return fullName;
  const firstName = player.first_name?.trim() ?? '';
  const lastName = player.last_name?.trim() ?? '';
  const joined = `${firstName} ${lastName}`.trim();
  return joined || null;
}

function parseSleeperBirthDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseSleeperWeight(value?: string | number | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isSleeperPlayerActive(player: SleeperPlayer): boolean {
  if (player.active === true) return true;
  if (player.status?.toLowerCase() === 'active') return true;
  if (player.status?.toLowerCase() === 'inactive') return false;
  return Boolean(player.team?.trim());
}

function confidenceForSleeperIdentity(player: SleeperPlayer): number {
  let confidence = 0.5;
  if (player.full_name?.trim()) confidence += 0.2;
  if (player.first_name?.trim() && player.last_name?.trim()) confidence += 0.1;
  if (player.team?.trim()) confidence += 0.1;
  if (player.active === true || player.status?.toLowerCase() === 'active') confidence += 0.1;
  if (['QB', 'RB', 'WR', 'TE'].includes(normalizeSleeperPosition(player.position) ?? '')) confidence += 0.1;
  return Math.min(confidence, 1);
}

function normalizeNameFingerprint(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function buildIdentityRowFromSleeperPlayer(sleeperId: string, player: SleeperPlayer) {
  const fullName = buildSleeperFullName(player);
  const position = normalizeSleeperPosition(player.position);
  if (!fullName || !position) return null;

  const fantasyDataId = player.fantasy_data_id === null || player.fantasy_data_id === undefined
    ? null
    : String(player.fantasy_data_id);

  return {
    canonicalId: `sleeper:${sleeperId}`,
    fullName,
    firstName: player.first_name?.trim() || null,
    lastName: player.last_name?.trim() || null,
    position,
    nflTeam: normalizeSleeperTeam(player.team),
    sleeperId,
    fantasyDataId,
    gsisId: player.gsis_id?.trim() || null,
    birthDate: parseSleeperBirthDate(player.birth_date),
    college: player.college?.trim() || null,
    height: player.height?.trim() || null,
    weight: parseSleeperWeight(player.weight),
    nameFingerprint: normalizeNameFingerprint(fullName),
    teamHistory: normalizeSleeperTeam(player.team) ? [normalizeSleeperTeam(player.team)!] : [],
    dataCompleteness: [sleeperId, fantasyDataId, player.gsis_id, player.birth_date, player.college, player.height, player.weight]
      .filter((value) => value !== null && value !== undefined && value !== '').length,
    isActive: isSleeperPlayerActive(player),
    confidence: confidenceForSleeperIdentity(player),
    lastVerified: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

type HydrationRow = NonNullable<ReturnType<typeof buildIdentityRowFromSleeperPlayer>>;

/**
 * Existing owners of the GSIS ids a hydration batch is about to write.
 *
 * `player_identity_map.gsis_id` carries **no unique index** — applying one is a
 * documented operator step (Fantasy #308). `onConflictDoNothing()` therefore
 * protects nothing here: it only suppresses conflicts the database actually
 * declares. Without this lookup, hydrating a Sleeper player whose GSIS is
 * already owned by a canonical row inserts a *second* owner of that GSIS, and
 * the duplicate-aware resolvers then correctly refuse to resolve it — silently
 * disabling Rankings and player links for that player after an ordinary
 * dashboard read.
 */
async function resolveExistingGsisOwners(
  database: LeagueDashboardDeps['db'],
  gsisIds: string[],
): Promise<Map<string, Array<{ canonicalId: string; sleeperId: string | null }>>> {
  const owners = new Map<string, Array<{ canonicalId: string; sleeperId: string | null }>>();
  if (gsisIds.length === 0) return owners;

  const existing: any[] = await (database as any)
    .select()
    .from(playerIdentityMap)
    .where(inArray(playerIdentityMap.gsisId, gsisIds));

  for (const row of existing ?? []) {
    const gsis = row?.gsisId;
    if (!gsis) continue;
    const list = owners.get(gsis) ?? [];
    list.push({ canonicalId: row.canonicalId, sleeperId: row.sleeperId ?? null });
    owners.set(gsis, list);
  }
  return owners;
}

async function hydrateMissingSleeperIdentities(
  sleeperIds: string[],
  deps: LeagueDashboardDeps,
  logger: PlaybookForgeLogger,
): Promise<typeof playerIdentityMap.$inferSelect[]> {
  const uniqueMissingIds = Array.from(new Set(sleeperIds.filter(Boolean)));
  const getNflPlayers = deps.sleeperClient.getNflPlayers;
  if (uniqueMissingIds.length === 0 || typeof getNflPlayers !== 'function') return [];

  try {
    const sleeperPlayers = await getNflPlayers.call(deps.sleeperClient);
    const rows = uniqueMissingIds
      .map((sleeperId) => {
        const player = sleeperPlayers[sleeperId];
        return player ? buildIdentityRowFromSleeperPlayer(sleeperId, { ...player, player_id: player.player_id ?? sleeperId }) : null;
      })
      .filter((row): row is NonNullable<ReturnType<typeof buildIdentityRowFromSleeperPlayer>> => row !== null);

    if (rows.length === 0) {
      logger.log('identity-hydration-empty', {
        requestId: logger.requestId,
        requested: uniqueMissingIds.length,
      });
      return [];
    }

    // Fail closed on GSIS ownership before writing anything. Every outcome below
    // either attaches to the single existing owner or drops the GSIS from the
    // fallback insert; none of them mints a second owner.
    const owners = await resolveExistingGsisOwners(
      deps.db,
      Array.from(new Set(rows.map((row) => row.gsisId).filter((id): id is string => !!id))),
    );

    const toInsert: HydrationRow[] = [];
    const toAttach: Array<{ gsisId: string; sleeperId: string; canonicalId: string }> = [];
    const gsisWithheld: Array<{ sleeperId: string; gsisId: string; reason: string }> = [];

    for (const row of rows) {
      const gsis = row.gsisId;
      if (!gsis) { toInsert.push(row); continue; }

      const existing = owners.get(gsis) ?? [];
      if (existing.length === 0) { toInsert.push(row); continue; }

      if (existing.length > 1) {
        // Already ambiguous. Adding another owner can only deepen it.
        gsisWithheld.push({ sleeperId: row.sleeperId, gsisId: gsis, reason: 'gsis_already_ambiguous' });
        toInsert.push({ ...row, gsisId: null });
        continue;
      }

      const [owner] = existing;
      if (owner.sleeperId === row.sleeperId) {
        // The one owner already carries this Sleeper id; nothing to write.
        continue;
      }
      if (owner.sleeperId === null) {
        // Exactly one owner, unclaimed: attach rather than insert a rival row.
        toAttach.push({ gsisId: gsis, sleeperId: row.sleeperId, canonicalId: owner.canonicalId });
        continue;
      }
      // One owner, already bound to a different Sleeper id. Conflicting claims
      // are an identity-data question, not something hydration may decide.
      gsisWithheld.push({ sleeperId: row.sleeperId, gsisId: gsis, reason: 'gsis_owned_by_different_sleeper_id' });
      toInsert.push({ ...row, gsisId: null });
    }

    // Conditional single-statement update: the WHERE re-checks ownership, so a
    // row that gained a Sleeper id between the read and the write is not
    // overwritten.
    for (const attach of toAttach) {
      await (deps.db as any)
        .update(playerIdentityMap)
        .set({ sleeperId: attach.sleeperId, updatedAt: new Date() })
        .where(and(eq(playerIdentityMap.gsisId, attach.gsisId), isNull(playerIdentityMap.sleeperId)));
    }

    if (toInsert.length > 0) {
      await deps.db
        .insert(playerIdentityMap)
        .values(toInsert as any)
        .onConflictDoNothing();
    }

    logger.log('identity-hydration-complete', {
      requestId: logger.requestId,
      requested: uniqueMissingIds.length,
      hydrated: toInsert.length,
      attachedToExistingGsisOwner: toAttach.length,
      gsisWithheld: gsisWithheld.length,
      gsisWithheldSample: gsisWithheld.slice(0, 5),
      sample: toInsert.slice(0, 5).map((row) => ({ sleeperId: row.sleeperId, canonicalId: row.canonicalId, fullName: row.fullName })),
    });

    return toInsert as any;
  } catch (error) {
    logger.log('identity-hydration-failed', {
      requestId: logger.requestId,
      requested: uniqueMissingIds.length,
      error: (error as Error).message,
    });
    return [];
  }
}

function bestAvailablePlayerName(identity: any, sleeperId: string): string {
  const candidates = [
    identity?.fullName,
    [identity?.firstName, identity?.lastName].filter(Boolean).join(' '),
    identity?.playerName,
    identity?.name,
    sleeperId,
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value) return value;
  }

  return 'Unknown player';
}

function resolveRosterPositions(settings: any, fallback: string[] = []) {
  if (!settings) return fallback;
  if (Array.isArray((settings as any).roster_positions)) return (settings as any).roster_positions as string[];
  return fallback;
}

function isPlayerSpecificForgeScore(player: Pick<LeagueDashboardPlayer, 'alpha' | 'forgeScoreSource'>): boolean {
  return typeof player.alpha === 'number' && player.forgeScoreSource === 'player_specific';
}

function isGeneratedBaselineForgeVisibility(player: Pick<LeagueDashboardPlayer, 'alpha' | 'forgeScoreSource'>): boolean {
  return typeof player.alpha === 'number' && player.forgeScoreSource === 'generated_baseline';
}

function classifyRosterVisibility(player: Pick<LeagueDashboardPlayer, 'alpha' | 'forgeScoreSource' | 'missingReason' | 'rookieAsset'>): RosterVisibilityState {
  if (isPlayerSpecificForgeScore(player)) return 'forge_scored';
  if (isGeneratedBaselineForgeVisibility(player)) return 'forge_baseline';
  if (player.rookieAsset) return 'rookie_alpha_fallback';
  if (player.missingReason === 'unmapped_sleeper_id') return 'unresolved';
  return 'known_unscored';
}

function unavailableReasonForPlayer(player: Pick<LeagueDashboardPlayer, 'alpha' | 'forgeScoreSource' | 'missingReason' | 'rookieAsset'>): string | null {
  if (isPlayerSpecificForgeScore(player)) return null;
  if (isGeneratedBaselineForgeVisibility(player)) return 'forge_generated_baseline_not_player_specific';
  if (typeof player.alpha === 'number') return 'forge_non_evidence_not_player_specific';
  if (player.missingReason === 'unmapped_sleeper_id') return 'identity_unresolved';
  if (player.missingReason === 'alpha_null') return 'alpha_null';
  if (player.missingReason === 'forge_artifact_unavailable') return 'forge_player_static_v1_unavailable';
  if (player.missingReason === 'missing_forge_row' && !player.rookieAsset) return 'rookie_alpha_fallback_unavailable';
  return player.missingReason ?? 'rookie_alpha_fallback_unavailable';
}

type RosterIdentityReference = {
  sleeperId: string;
  rosterCanonicalId: string | null;
};

type ForgeRosterResolution = {
  rosterCanonicalId: string;
  forgePlayerId: string | null;
  matchType: 'direct' | 'identity_crosswalk' | 'unmatched';
  identityProviderKey: string | null;
};

function providerKey(provider: string, providerId: string): string {
  return `${provider}:${providerId}`;
}

function resolveForgeRosterId(
  ref: RosterIdentityReference,
  forgeStaticLookup: ForgePlayerStaticLookup,
  identityCrosswalkLookup: TiberIdentityCrosswalkLookup,
): ForgeRosterResolution {
  const rosterCanonicalId = String(ref.rosterCanonicalId ?? `sleeper:${ref.sleeperId}`).trim();

  if (ref.rosterCanonicalId && forgeStaticLookup.rowsByPlayerId.has(ref.rosterCanonicalId)) {
    return {
      rosterCanonicalId,
      forgePlayerId: ref.rosterCanonicalId,
      matchType: 'direct',
      identityProviderKey: null,
    };
  }

  if (!identityCrosswalkLookup.artifact.available) {
    return { rosterCanonicalId, forgePlayerId: null, matchType: 'unmatched', identityProviderKey: null };
  }

  const candidateProviderKeys = Array.from(new Set([
    ref.sleeperId ? providerKey('sleeper', ref.sleeperId) : null,
    ref.rosterCanonicalId?.startsWith('sleeper:') ? ref.rosterCanonicalId : null,
  ].filter((key): key is string => Boolean(key))));

  for (const candidateProviderKey of candidateProviderKeys) {
    const tiberPlayerId = identityCrosswalkLookup.tiberPlayerIdsByProviderKey.get(candidateProviderKey);
    if (!tiberPlayerId) continue;
    return {
      rosterCanonicalId,
      forgePlayerId: tiberPlayerId,
      matchType: 'identity_crosswalk',
      identityProviderKey: candidateProviderKey,
    };
  }

  return { rosterCanonicalId, forgePlayerId: null, matchType: 'unmatched', identityProviderKey: null };
}

function buildForgeRosterMatchDiagnostics(
  rosterIdentityRefs: RosterIdentityReference[],
  forgeStaticLookup: ForgePlayerStaticLookup,
  identityCrosswalkLookup: TiberIdentityCrosswalkLookup,
): ForgeRosterMatchDiagnostics {
  const refsByRosterCanonicalId = new Map<string, RosterIdentityReference>();
  for (const ref of rosterIdentityRefs) {
    const rosterCanonicalId = String(ref.rosterCanonicalId ?? `sleeper:${ref.sleeperId}`).trim();
    if (rosterCanonicalId) refsByRosterCanonicalId.set(rosterCanonicalId, ref);
  }

  const matchedIds: string[] = [];
  const unmatchedIds: string[] = [];
  const crosswalkMatchedIds: Array<{ rosterCanonicalId: string; forgePlayerId: string; providerKey: string }> = [];
  let directCanonicalMatches = 0;
  let crosswalkCanonicalMatches = 0;
  let playerSpecificRosterMatches = 0;
  let generatedBaselineRosterMatches = 0;
  let nonEvidenceRosterMatches = 0;

  for (const ref of Array.from(refsByRosterCanonicalId.values())) {
    const resolution = resolveForgeRosterId(ref, forgeStaticLookup, identityCrosswalkLookup);
    const row = resolution.forgePlayerId ? forgeStaticLookup.rowsByPlayerId.get(resolution.forgePlayerId) : undefined;
    if (!row) {
      unmatchedIds.push(resolution.rosterCanonicalId);
      continue;
    }

    matchedIds.push(resolution.rosterCanonicalId);
    if (resolution.matchType === 'identity_crosswalk') {
      crosswalkCanonicalMatches += 1;
      crosswalkMatchedIds.push({
        rosterCanonicalId: resolution.rosterCanonicalId,
        forgePlayerId: resolution.forgePlayerId!,
        providerKey: resolution.identityProviderKey ?? 'unknown',
      });
    } else {
      directCanonicalMatches += 1;
    }

    if (row.isPlayerSpecificEvidence) {
      playerSpecificRosterMatches += 1;
    } else if (row.isGeneratedBaselineVisibility) {
      generatedBaselineRosterMatches += 1;
    } else {
      nonEvidenceRosterMatches += 1;
    }
  }

  return {
    rosterCanonicalIdsChecked: refsByRosterCanonicalId.size,
    rosterCanonicalIdsMatched: matchedIds.length,
    directCanonicalMatches,
    crosswalkCanonicalMatches,
    playerSpecificRosterMatches,
    generatedBaselineRosterMatches,
    nonEvidenceRosterMatches,
    sampleUnmatchedCanonicalIds: unmatchedIds.slice(0, 10),
    sampleMatchedCanonicalIds: matchedIds.slice(0, 10),
    sampleCrosswalkMatchedCanonicalIds: crosswalkMatchedIds.slice(0, 10),
  };
}

function buildRosterCoverageCounts(players: Array<Pick<LeagueDashboardPlayer, 'alpha' | 'forgeScoreSource' | 'missingReason' | 'rookieAsset'>>): RosterCoverageCounts {
  const counts: RosterCoverageCounts = {
    total: players.length,
    identityCovered: 0,
    baselineVisible: 0,
    forgeScored: 0,
    forgeBaseline: 0,
    generatedBaselineVisibility: 0,
    rookieAlphaFallback: 0,
    knownUnscored: 0,
    unresolved: 0,
    evidenceCovered: 0,
  };

  for (const player of players) {
    const state = classifyRosterVisibility(player);
    if (state === 'forge_scored') counts.forgeScored += 1;
    if (state === 'forge_baseline') {
      counts.forgeBaseline += 1;
      counts.generatedBaselineVisibility += 1;
    }
    if (state === 'rookie_alpha_fallback') counts.rookieAlphaFallback += 1;
    if (state === 'known_unscored') counts.knownUnscored += 1;
    if (state === 'unresolved') counts.unresolved += 1;
  }

  counts.identityCovered = counts.total - counts.unresolved;
  counts.baselineVisible = counts.generatedBaselineVisibility;
  counts.evidenceCovered = counts.forgeScored + counts.rookieAlphaFallback;
  return counts;
}

function computeSnapshotMissingRates(payload: any) {
  if (!payload || !payload.teams) return { missingRate: 0, unresolvedRate: 0 };

  let totalPlayers = 0;
  let missingAlpha = 0;
  for (const team of payload.teams as any[]) {
    const roster = Array.isArray(team?.roster) ? team.roster : [];
    totalPlayers += roster.length;
    missingAlpha += roster.filter((r: any) => r.alpha === null || r.alpha === undefined || r.forgeScoreSource !== 'player_specific').length;
  }

  const unresolvedPlayers = Array.isArray(payload.unresolvedPlayers) ? payload.unresolvedPlayers.length : 0;
  const missingRate = totalPlayers === 0 ? 0 : missingAlpha / totalPlayers;
  const unresolvedRate = totalPlayers === 0 ? 0 : unresolvedPlayers / totalPlayers;
  return { missingRate, unresolvedRate };
}

function countPositions(rosterPositions: string[]) {
  const counts = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, SUPER_FLEX: 0 };
  for (const slot of rosterPositions) {
    const slotUpper = slot.toUpperCase();
    if (slotUpper === 'QB' || slotUpper === 'RB' || slotUpper === 'WR' || slotUpper === 'TE') {
      counts[slotUpper as keyof typeof counts] += 1;
    } else if (slotUpper.includes('SUPER_FLEX') || slotUpper === 'Q/W/R/T') {
      counts.SUPER_FLEX += 1;
    } else if (slotUpper === 'FLEX' || slotUpper === 'W/R/T' || slotUpper === 'WR/RB/TE') {
      counts.FLEX += 1;
    }
  }
  return counts;
}

function buildLineup(players: LeagueDashboardPlayer[], rosterPositions: string[]) {
  const counts = countPositions(rosterPositions);
  const totals = { QB: 0, RB: 0, WR: 0, TE: 0 };
  const startersUsed: LeagueDashboardPlayer[] = [];
  const used = new Set<string>();

  const sorted = [...players].sort((a, b) => (b.alpha ?? 0) - (a.alpha ?? 0));

  function scoringAlpha(player: LeagueDashboardPlayer): number {
    return isPlayerSpecificForgeScore(player) ? (player.alpha ?? 0) : 0;
  }

  function takePlayers(pos: string, count: number) {
    for (const player of sorted) {
      if (count <= 0) break;
      if (used.has(player.rosterKey)) continue;
      if (player.pos !== pos) continue;
      used.add(player.rosterKey);
      startersUsed.push(player);
      totals[pos as keyof typeof totals] += scoringAlpha(player);
      count -= 1;
    }
  }

  takePlayers('QB', counts.QB);
  takePlayers('RB', counts.RB);
  takePlayers('WR', counts.WR);
  takePlayers('TE', counts.TE);

  function flexEligible(p: { pos: string }) {
    return p.pos === 'RB' || p.pos === 'WR' || p.pos === 'TE';
  }

  function superFlexEligible(p: { pos: string }) {
    return p.pos === 'QB' || flexEligible(p);
  }

  function takeFlex(count: number, predicate: (p: { pos: string }) => boolean) {
    for (const player of sorted) {
      if (count <= 0) break;
      if (used.has(player.rosterKey)) continue;
      if (!predicate(player)) continue;
      used.add(player.rosterKey);
      startersUsed.push(player);
      totals[player.pos as keyof typeof totals] += scoringAlpha(player);
      count -= 1;
    }
  }

  takeFlex(counts.FLEX, flexEligible);
  takeFlex(counts.SUPER_FLEX, superFlexEligible);

  const roster = sorted.map((player) => ({
    ...player,
    usedAsStarter: used.has(player.rosterKey),
  }));

  const benchSum = roster
    .filter((p) => !p.usedAsStarter)
    .reduce((sum, p) => sum + scoringAlpha(p), 0);

  const benchContribution = BENCH_WEIGHT * benchSum;
  const overall = Object.values(totals).reduce((sum, val) => sum + val, 0) + benchContribution;

  return { totals, startersUsed, roster, overallTotal: overall, benchContribution };
}

export async function computeLeagueDashboard(
  params: LeagueDashboardParams,
  deps: LeagueDashboardDeps = defaultDeps,
  debug?: DebugOptions
): Promise<LeagueDashboardPayload> {
  const { userId, leagueId } = params;
  const refresh = Boolean(params.refresh);
  const logger = debug?.logger || createPlaybookForgeLogger({
    requestId: debug?.requestId,
    enabled: debug?.enabled,
    scope: 'LeagueDashboard',
  });

  const league = await deps.storage.getLeagueWithTeams(leagueId);
  if (!league || (league as any).userId !== userId && (league as any).user_id !== userId) {
    throw new Error('League not found');
  }

  const externalLeagueId = (league as any).leagueIdExternal ?? (league as any).league_id_external;
  if (!externalLeagueId) {
    throw new Error('League is missing external identifier');
  }

  const rosterPositions = resolveRosterPositions(
    typeof (league as any).settings === 'string' ? JSON.parse((league as any).settings) : (league as any).settings,
    []
  );

  const [rosters, latestLeague] = await Promise.all([
    deps.sleeperClient.getLeagueRosters(String(externalLeagueId)),
    deps.sleeperClient.getLeague(String(externalLeagueId)),
  ]);

  const explicitSeason = params.season ?? null;
  const explicitWeek = params.week ?? null;
  const effectiveSeason = explicitSeason ?? (league as any).season ?? (latestLeague as any)?.season ?? null;
  const effectiveWeek = explicitWeek ?? (latestLeague as any)?.week ?? null;

  const snapshot = refresh
    ? null
    : await deps.storage.getLeagueDashboardSnapshot(leagueId, effectiveSeason, effectiveWeek);

  if (snapshot && snapshot.computedAt) {
    const computedAtMs = new Date(snapshot.computedAt).getTime();
    const withinTtl = Date.now() - computedAtMs < CACHE_TTL_MS;
    const { missingRate, unresolvedRate } = computeSnapshotMissingRates(snapshot.payload);
    const bypass = missingRate > MISSING_RATE_BYPASS_THRESHOLD || unresolvedRate > MISSING_RATE_BYPASS_THRESHOLD;

    logger.log('snapshot-check', {
      requestId: logger.requestId,
      withinTtl,
      missingRate,
      unresolvedRate,
      bypass,
      threshold: MISSING_RATE_BYPASS_THRESHOLD,
      effectiveWeek,
    });

    if (withinTtl && !bypass) {
      const payload = snapshot.payload as LeagueDashboardPayload;
      return {
        ...payload,
        meta: {
          ...(payload.meta ?? {}),
          week: effectiveWeek,
          season: effectiveSeason,
          computed_at:
            snapshot.computedAt instanceof Date
              ? snapshot.computedAt.toISOString()
              : new Date(snapshot.computedAt).toISOString(),
          cached: true,
        },
      };
    }
  }

  const rosterPlayerIds = Array.from(
    new Set(
      rosters.flatMap((r) => (r.players ?? []).map((pid) => String(pid)))
    )
  );

  logger.log('rosters-loaded', {
    requestId: logger.requestId,
    roster_count: rosters.length,
    unique_player_ids: rosterPlayerIds.length,
    sample_player_ids: rosterPlayerIds.slice(0, 10),
  });

  const positionsRaw = rosterPositions.length > 0 ? rosterPositions : resolveRosterPositions(latestLeague, []);
  const positions = positionsRaw.length > 0
    ? positionsRaw
    : ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX'];

  const rosterByOwner = new Map<string, SleeperRoster>();
  rosters.forEach((roster) => {
    rosterByOwner.set(String(roster.owner_id), roster);
  });

  let identities = rosterPlayerIds.length
    ? await deps.db
        .select()
        .from(playerIdentityMap)
        .where(inArray(playerIdentityMap.sleeperId, rosterPlayerIds))
    : [];

  const initiallyResolvedSleeperIds = new Set(identities.map((id) => String(id.sleeperId)));
  const missingSleeperIds = rosterPlayerIds.filter((id) => !initiallyResolvedSleeperIds.has(id));
  const hydratedIdentities = await hydrateMissingSleeperIdentities(missingSleeperIds, deps, logger);
  if (hydratedIdentities.length > 0) {
    const seenSleeperIds = new Set(identities.map((id) => String(id.sleeperId)));
    identities = [
      ...identities,
      ...hydratedIdentities.filter((id) => id.sleeperId && !seenSleeperIds.has(String(id.sleeperId))),
    ];
  }

  const identityBySleeperId = new Map(identities.map((id) => [String(id.sleeperId), id]));
  const canonicalIds = identities.map((id) => id.canonicalId);
  const rosterIdentityRefs: RosterIdentityReference[] = rosterPlayerIds.map((sleeperId) => ({
    sleeperId,
    rosterCanonicalId: identityBySleeperId.get(sleeperId)?.canonicalId ?? null,
  }));

  logger.log('identity-join', {
    requestId: logger.requestId,
    identity_rows: identities.length,
    missing_identity_count: rosterPlayerIds.length - identities.length,
    sample_identity: identities.slice(0, 5).map((id) => ({ sleeperId: id.sleeperId, canonicalId: id.canonicalId })),
  });

  const targetSeasonFilter = effectiveSeason;
  const targetWeekFilter = effectiveWeek;
  const forgeStaticLookup = await (deps.forgePlayerStaticService ?? forgePlayerStaticService).getLookup();
  const identityCrosswalkLookup = await (deps.tiberIdentityCrosswalkService ?? tiberIdentityCrosswalkService).getLookup();
  const strategyOntologyLookup = await (deps.strategyOntologyIntegration ?? strategyOntologyIntegration).getLookup();

  const alphaByRosterKey = new Map<string, { alpha: number | null; row: ForgePlayerStaticRow | null; source: ForgeScoreSource; provenance: LeagueDashboardPlayer['forgeScoreProvenance'] }>();
  if (forgeStaticLookup.artifact.available) {
    for (const ref of rosterIdentityRefs) {
      const resolution = resolveForgeRosterId(ref, forgeStaticLookup, identityCrosswalkLookup);
      const row = resolution.forgePlayerId ? forgeStaticLookup.rowsByPlayerId.get(resolution.forgePlayerId) : undefined;
      if (!row) continue;
      if (!row.isPlayerSpecificEvidence && !row.isGeneratedBaselineVisibility) continue;
      alphaByRosterKey.set(resolution.rosterCanonicalId, {
        alpha: row.alpha,
        row,
        source: row.scoreSource,
        provenance: row.alpha === null ? null : {
          source: row.scoreSource,
          reason: row.isPlayerSpecificEvidence
            ? 'forge_player_static_v1_player_specific_provenance'
            : 'forge_player_static_v1_generated_baseline_visibility_only',
          confidence: row.confidence,
          artifactId: 'FORGE_PLAYER_STATIC_V1',
          contractVersion: forgeStaticLookup.artifact.contractVersion,
          matchType: resolution.matchType === 'identity_crosswalk' ? 'identity_crosswalk' : 'direct',
          rosterCanonicalId: resolution.rosterCanonicalId,
          forgePlayerId: resolution.forgePlayerId,
          identityProviderKey: resolution.identityProviderKey,
          identityCrosswalkArtifactId: resolution.matchType === 'identity_crosswalk' ? 'TIBER_IDENTITY_CROSSWALK_V1' : null,
        },
      });
    }
  }

  const forgeRosterMatching = buildForgeRosterMatchDiagnostics(rosterIdentityRefs, forgeStaticLookup, identityCrosswalkLookup);

  logger.log('forge-player-static-v1', {
    requestId: logger.requestId,
    artifact: forgeStaticLookup.artifact,
    identity_crosswalk_artifact: identityCrosswalkLookup.artifact,
    roster_matching: forgeRosterMatching,
    roster_canonical_ids: canonicalIds.length,
    visible_rows_for_roster: alphaByRosterKey.size,
    player_specific_for_roster: Array.from(alphaByRosterKey.values()).filter((entry) => entry.source === 'player_specific').length,
    generated_baseline_for_roster: Array.from(alphaByRosterKey.values()).filter((entry) => entry.source === 'generated_baseline').length,
    target_season: targetSeasonFilter,
    target_week: effectiveWeek,
  });

  const teams: LeagueDashboardTeam[] = [];

  const missingAlphaReasons: Record<string, number> = {};
  let matchedAlphaCount = 0;
  let fallbackCount = 0;
  const unresolvedPlayers: Array<{ sleeperId: string; reason: string }> = [];
  const missingCanonicalIds = new Set<string>();
  let resolvedCanonicalCount = 0;

  const teamPlayersMap = new Map<string, LeagueDashboardPlayer[]>();

  for (const team of league.teams) {
    const externalUserId = normalizeExternalId((team as any).externalUserId ?? (team as any).external_user_id);
    const roster = externalUserId ? rosterByOwner.get(externalUserId) : undefined;
    const sleeperPlayers = roster?.players ?? [];

    const players = sleeperPlayers.map((pid) => {
      const sleeperId = String(pid);
      const identity = identityBySleeperId.get(sleeperId);
      const canonicalId = identity?.canonicalId ?? null;
      const pos = identity?.position ?? 'FLEX';
      const rosterKey = canonicalId ?? `sleeper:${sleeperId}`;
      const provider = 'sleeper';
      const providerPlayerId = sleeperId || null;
      const providerCanonicalId = sleeperId ? providerKey(provider, sleeperId) : null;
      const crosswalkResolution = resolveForgeRosterId(
        { sleeperId, rosterCanonicalId: canonicalId },
        forgeStaticLookup,
        identityCrosswalkLookup,
      );
      const currentTiberPlayerId = crosswalkResolution.matchType === 'identity_crosswalk'
        ? crosswalkResolution.forgePlayerId
        : null;
      const crosswalkStatus: LeagueDashboardPlayer['crosswalkStatus'] = currentTiberPlayerId
        ? 'matched'
        : canonicalId
          ? 'missing'
          : 'unresolved';
      const alphaEntry = alphaByRosterKey.get(rosterKey);
      const alpha = alphaEntry ? alphaEntry.alpha : null;

      if (canonicalId) {
        resolvedCanonicalCount += 1;
      }

      if (alphaEntry && alphaEntry.alpha !== null && alphaEntry.alpha !== undefined) {
        matchedAlphaCount += 1;
      } else {
        fallbackCount += 1;
        const reason = !identity
          ? 'unmapped_sleeper_id'
          : !alphaEntry
            ? (forgeStaticLookup.artifact.available ? 'missing_forge_row' : 'forge_artifact_unavailable')
            : 'alpha_null';
        if (reason === 'unmapped_sleeper_id') {
          unresolvedPlayers.push({ sleeperId, reason });
        }
        if (canonicalId && (reason === 'missing_forge_row' || reason === 'alpha_null' || reason === 'forge_artifact_unavailable')) {
          missingCanonicalIds.add(canonicalId);
        }
        missingAlphaReasons[reason] = (missingAlphaReasons[reason] ?? 0) + 1;
        logger.log('missing-forge-score', {
          requestId: logger.requestId,
          sleeper_id: sleeperId,
          canonical_id: canonicalId,
          position: pos,
          reason,
          season: targetSeasonFilter,
          week: effectiveWeek,
        });
      }
      const tierFinal = alphaEntry?.row?.tier ?? null;
      return {
        rosterKey,
        canonicalId,
        sleeperId,
        provider,
        providerPlayerId,
        providerCanonicalId,
        currentTiberPlayerId,
        crosswalkStatus,
        identityProviderKey: crosswalkResolution.identityProviderKey ?? providerCanonicalId,
        name: bestAvailablePlayerName(identity, sleeperId),
        pos,
        nflTeam: identity?.nflTeam ?? null,
        alpha,
        forgeScoreSource: alphaEntry?.source ?? null,
        forgeScoreProvenance: alphaEntry?.provenance ?? null,
        tier: typeof tierFinal === 'number' ? tierFinal : null,
        missingReason: alpha === null ? (!canonicalId ? 'unmapped_sleeper_id' : !alphaEntry ? (forgeStaticLookup.artifact.available ? 'missing_forge_row' : 'forge_artifact_unavailable') : 'alpha_null') : null,
      };
    });

    teamPlayersMap.set(team.id, players);
  }

  let computedForgeCount = 0;
  if (missingCanonicalIds.size > 0) {
    logger.log('forge-player-static-v1-missing-roster-rows', {
      requestId: logger.requestId,
      missing_canonical_ids: Array.from(missingCanonicalIds),
      artifact_state: forgeStaticLookup.artifact.state,
      reason: forgeStaticLookup.artifact.available
        ? 'no_forge_player_static_v1_row_for_canonical_id'
        : 'forge_player_static_v1_unavailable_fail_closed',
    });
  }

  let newlyMatchedFromCompute = 0;
  const hasPlayersMissingForge = Array.from(teamPlayersMap.values()).some((players) =>
    players.some((player) => player.alpha === null)
  );
  let rookieAssetLookup = new Map<string, RookieAssetContext>();
  if (hasPlayersMissingForge && effectiveSeason !== null) {
    try {
      rookieAssetLookup = await (deps.rookieArtifactService ?? rookieArtifactService).getRookieAssetLookup(Number(effectiveSeason));
    } catch (error) {
      logger.log('rookie-alpha-unavailable', {
        requestId: logger.requestId,
        season: effectiveSeason,
        error: (error as Error).message,
      });
    }
  }

  for (const team of league.teams) {
    const players = teamPlayersMap.get(team.id) ?? [];

    const updatedPlayers = players.map((player) => {
      const updatedEntry = alphaByRosterKey.get(player.rosterKey);
      const updatedAlpha = updatedEntry?.alpha ?? null;
      const forgeScoreSource = updatedAlpha === null ? null : updatedEntry?.source ?? null;
      const forgeScoreProvenance = updatedAlpha === null ? null : updatedEntry?.provenance ?? null;
      const missingReason = updatedAlpha === null ? player.missingReason ?? 'missing_forge_row' : null;
      if (updatedAlpha !== null && player.alpha === null) {
        newlyMatchedFromCompute += 1;
      }
      const rookieAsset = updatedAlpha === null ? findRookieAsset(rookieAssetLookup, player) : null;
      const visibilityState = classifyRosterVisibility({ ...player, alpha: updatedAlpha, forgeScoreSource, missingReason, rookieAsset });
      return {
        ...player,
        alpha: updatedAlpha,
        forgeScoreSource,
        forgeScoreProvenance,
        missingReason,
        rookieAsset,
        visibilityState,
        unavailableReason: unavailableReasonForPlayer({ ...player, alpha: updatedAlpha, forgeScoreSource, missingReason, rookieAsset }),
      };
    });

    const { totals, startersUsed, roster: rosterRows, overallTotal, benchContribution } = buildLineup(updatedPlayers, positions);

    teams.push({
      team_id: team.id,
      display_name: (team as any).displayName ?? (team as any).display_name ?? 'Team',
      totals,
      bench_contribution: benchContribution,
      overall_total: overallTotal,
      starters_used: startersUsed,
      roster: rosterRows,
    });
  }
  matchedAlphaCount += newlyMatchedFromCompute;

  const rosterVisibility = buildRosterCoverageCounts(teams.flatMap((team) => team.roster));

  const payload: LeagueDashboardPayload = {
    success: true,
    meta: {
      league_id: leagueId,
      week: effectiveWeek,
      season: effectiveSeason,
      computed_at: new Date().toISOString(),
      cached: false,
    },
    diagnostics: {
      rosterCount: rosterPlayerIds.length,
      resolvedCanonicalCount,
      unresolvedSleeperCount: unresolvedPlayers.length,
      cachedForgeRowCount: alphaByRosterKey.size,
      computedForgeCount,
      stillMissingCount: teams.reduce((sum, t) => sum + t.roster.filter((p) => p.alpha === null).length, 0),
      rookieAlphaMatchedCount: rosterVisibility.rookieAlphaFallback,
      forgeScoredCount: rosterVisibility.forgeScored,
      forgeBaselineCount: rosterVisibility.forgeBaseline,
      rookieAlphaFallbackCount: rosterVisibility.rookieAlphaFallback,
      knownUnscoredCount: rosterVisibility.knownUnscored,
      unresolvedCount: rosterVisibility.unresolved,
      identityCoveredCount: rosterVisibility.identityCovered,
      baselineVisibleCount: rosterVisibility.baselineVisible,
      evidenceCoveredCount: rosterVisibility.evidenceCovered,
      playerSpecificForgeCoverageCount: rosterVisibility.forgeScored,
      generatedBaselineVisibilityCount: rosterVisibility.generatedBaselineVisibility,
      unresolvedRosterIdentityCount: rosterVisibility.unresolved,
      forgeArtifact: forgeStaticLookup.artifact,
      identityCrosswalkArtifact: identityCrosswalkLookup.artifact,
      strategyOntologyArtifact: strategyOntologyLookup.artifact,
      strategyOntologyTemplates: summarizeStrategyOntologyTemplates(strategyOntologyLookup),
      forgeRosterMatching,
      rosterVisibility,
    },
    unresolvedPlayers,
    teams,
  };

  logger.log('merge-complete', {
    requestId: logger.requestId,
    teams: teams.length,
    matched_alpha_count: matchedAlphaCount,
    fallback_count: fallbackCount,
    missing_reasons: missingAlphaReasons,
    diagnostics: payload.diagnostics,
  });

  await deps.storage.saveLeagueDashboardSnapshot({
    leagueId,
    season: payload.meta.season,
    week: payload.meta.week,
    snapshotTrigger: 'weekly_rollover',
    payload,
  });

  return payload;
}
