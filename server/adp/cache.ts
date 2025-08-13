// /server/adp/cache.ts
const TTL_MS = 6 * 60 * 60 * 1000; // 6h
type Key = `adp:${number}:${"1qb"|"superflex"}`;

const mem = new Map<Key, { exp: number; data: Map<string, any> }>();

export function getAdpCache(season:number, format:"1qb"|"superflex") {
  const key: Key = `adp:${season}:${format}`;
  const hit = mem.get(key);
  if (hit && hit.exp > Date.now()) return hit.data;
  return null;
}

export function setAdpCache(season:number, format:"1qb"|"superflex", data:Map<string, any>) {
  const key: Key = `adp:${season}:${format}`;
  mem.set(key, { exp: Date.now() + TTL_MS, data });
}