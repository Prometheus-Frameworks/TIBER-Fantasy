// src/data/cache.ts
// Tiny in-memory TTL cache to avoid hammering APIs

type CacheVal<T> = { value: T; expiresAt: number };
const store = new Map<string, CacheVal<any>>();

export function setCache<T>(key: string, value: T, ttlMs = 60_000) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function getCache<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function cacheKey(parts: (string | number | undefined)[]) {
  return parts.filter(Boolean).join("|");
}