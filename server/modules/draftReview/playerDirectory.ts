import { sleeperClient, type SleeperPlayer } from '../../integrations/sleeperClient';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
type Snapshot = { fetchedAt: number; players: Record<string, SleeperPlayer> };
let cache: Snapshot | null = null;
let request: Promise<Snapshot> | null = null;

/** Shared public directory; acquisition time is not a provider update timestamp. */
export async function getDraftReviewPlayerDirectory(): Promise<Snapshot> {
  if (cache && Date.now() - cache.fetchedAt < MAX_AGE_MS) return cache;
  if (!request) request = sleeperClient.getNflPlayers().then(players => {
    if (!players || typeof players !== 'object' || Array.isArray(players)
        || Object.keys(players).length > 50_000) {
      throw new Error('Player directory unavailable');
    }
    cache = { fetchedAt: Date.now(), players };
    return cache;
  }).finally(() => { request = null; });
  return request;
}
export function __resetDraftReviewCacheForTests() { cache = null; request = null; }
