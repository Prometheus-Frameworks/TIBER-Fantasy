import type { ForgePosition, ForgeBatchResponse } from '../types/forge';

export interface ForgeBatchParams {
  position?: ForgePosition | 'ALL';
  limit?: number;
  season?: number;
  week?: number;
}

export async function fetchForgeBatch(params: ForgeBatchParams = {}): Promise<ForgeBatchResponse> {
  const url = new URL('/api/forge/batch', window.location.origin);

  if (params.position && params.position !== 'ALL') {
    url.searchParams.set('position', params.position);
  }
  if (params.limit) url.searchParams.set('limit', String(params.limit));
  if (params.season) url.searchParams.set('season', String(params.season));
  if (params.week) url.searchParams.set('week', String(params.week));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`FORGE batch request failed: ${res.status}`);
  }
  return res.json() as Promise<ForgeBatchResponse>;
}
