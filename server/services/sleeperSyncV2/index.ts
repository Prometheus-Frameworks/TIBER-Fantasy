/**
 * Sleeper Sync V2 Module
 * Main exports for roster synchronization and ownership tracking
 */

export { 
  computeRosterDiff, 
  canonicalRosterString,
  type RosterEvent,
  type EventType 
} from './rosterDiff';

export {
  resolveSleeperPlayerKey,
  batchResolveSleeperPlayerKeys,
  resetResolverStats,
  getResolverStats,
  clearResolverCache,
  type ResolverStats
} from './identityResolver';

export {
  syncLeague,
  getSyncStatus,
  getUnresolvedPlayerCount,
  type SyncOptions,
  type SyncResult
} from './syncService';
