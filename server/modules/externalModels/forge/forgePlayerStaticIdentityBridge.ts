export type ForgePlayerStaticBridgeMatchType = 'direct' | 'sleeper_bridge' | 'unmatched';

export interface ForgePlayerStaticBridgeResolution {
  rosterCanonicalId: string;
  forgePlayerId: string | null;
  matchType: ForgePlayerStaticBridgeMatchType;
  bridgeSource: string | null;
}

type BridgeEntry = {
  sleeperIds: string[];
  forgePlayerId: string;
  playerName: string;
  position: string;
  provenance: string;
  followUp: string;
};

const TEMPORARY_SLEEPER_TO_FORGE_PLAYER_STATIC_BRIDGE: BridgeEntry[] = [
  {
    sleeperIds: ['6797'],
    forgePlayerId: 'tiber-data-player-2025-justin-herbert',
    playerName: 'Justin Herbert',
    position: 'QB',
    provenance: 'Temporary Fantasy-side namespace bridge from Sleeper roster ID to TIBER-Data-style FORGE_PLAYER_STATIC_V1 ID; sourced from existing server/player_mappings.json Sleeper/NFL identity row and operator-provided FORGE canonical ID.',
    followUp: 'Replace with governed TIBER-Data identity crosswalk once promoted to Fantasy.',
  },
  {
    sleeperIds: ['9509'],
    forgePlayerId: 'tiber-data-player-2025-bijan-robinson',
    playerName: 'Bijan Robinson',
    position: 'RB',
    provenance: 'Temporary Fantasy-side namespace bridge from Sleeper roster ID to TIBER-Data-style FORGE_PLAYER_STATIC_V1 ID; sourced from existing server/player_mappings.json Sleeper/NFL identity row and operator-provided FORGE canonical ID.',
    followUp: 'Replace with governed TIBER-Data identity crosswalk once promoted to Fantasy.',
  },
  {
    sleeperIds: ['9493'],
    forgePlayerId: 'tiber-data-player-2025-puka-nacua',
    playerName: 'Puka Nacua',
    position: 'WR',
    provenance: 'Temporary Fantasy-side namespace bridge from Sleeper roster ID to TIBER-Data-style FORGE_PLAYER_STATIC_V1 ID; sourced from existing Sleeper cache/player mapping data and operator-provided FORGE canonical ID.',
    followUp: 'Replace with governed TIBER-Data identity crosswalk once promoted to Fantasy.',
  },
];

const bridgeByRosterCanonicalId = new Map<string, BridgeEntry>();
for (const entry of TEMPORARY_SLEEPER_TO_FORGE_PLAYER_STATIC_BRIDGE) {
  for (const sleeperId of entry.sleeperIds) {
    bridgeByRosterCanonicalId.set(`sleeper:${sleeperId}`, entry);
    bridgeByRosterCanonicalId.set(sleeperId, entry);
  }
}

export function resolveForgePlayerStaticId(rosterCanonicalId: string): ForgePlayerStaticBridgeResolution {
  const normalizedRosterCanonicalId = String(rosterCanonicalId ?? '').trim();
  if (!normalizedRosterCanonicalId) {
    return {
      rosterCanonicalId: normalizedRosterCanonicalId,
      forgePlayerId: null,
      matchType: 'unmatched',
      bridgeSource: null,
    };
  }

  const bridgeEntry = bridgeByRosterCanonicalId.get(normalizedRosterCanonicalId);
  if (!bridgeEntry) {
    return {
      rosterCanonicalId: normalizedRosterCanonicalId,
      forgePlayerId: normalizedRosterCanonicalId,
      matchType: 'direct',
      bridgeSource: null,
    };
  }

  return {
    rosterCanonicalId: normalizedRosterCanonicalId,
    forgePlayerId: bridgeEntry.forgePlayerId,
    matchType: 'sleeper_bridge',
    bridgeSource: bridgeEntry.provenance,
  };
}

export function getForgePlayerStaticBridgeEntries() {
  return TEMPORARY_SLEEPER_TO_FORGE_PLAYER_STATIC_BRIDGE.map((entry) => ({ ...entry, sleeperIds: [...entry.sleeperIds] }));
}
