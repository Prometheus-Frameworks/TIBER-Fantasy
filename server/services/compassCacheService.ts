import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, any>({ max: 200, ttl: 5 * 60 * 1000 });

export const compassCacheService = {
  get: (k: string) => cache.get(k),
  set: (k: string, v: any) => cache.set(k, v),
  clear: () => cache.clear(),
  has: (k: string) => cache.has(k),
  delete: (k: string) => cache.delete(k),
  size: () => cache.size,
};