import type { ForgePosition, ForgeBatchResponse, ForgeScore } from '../types/forge';

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

export interface ForgeSnapshotRequest {
  position?: ForgePosition | 'ALL';
  limit?: number;
  season?: number;
  week?: number;
}

export interface ForgeSnapshotResponse {
  success: boolean;
  snapshot: {
    season: number;
    week: number;
    position: ForgePosition | 'ALL';
    limit: number;
    count: number;
    scoredAt?: string;
    filePath: string;
  };
}

export async function createForgeSnapshot(
  params: ForgeSnapshotRequest
): Promise<ForgeSnapshotResponse> {
  const res = await fetch('/api/forge/snapshot', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      position: params.position && params.position !== 'ALL' ? params.position : undefined,
      limit: params.limit,
      season: params.season,
      week: params.week,
    }),
  });

  if (!res.ok) {
    throw new Error(`FORGE snapshot request failed: ${res.status}`);
  }

  return res.json() as Promise<ForgeSnapshotResponse>;
}

export interface ForgeSingleScoreResponse {
  success: boolean;
  score: ForgeScore | null;
}

export async function fetchForgeScore(playerId: string): Promise<ForgeSingleScoreResponse> {
  const trimmed = playerId.trim();
  if (!trimmed) {
    throw new Error('Player ID is required');
  }

  const res = await fetch(`/api/forge/score/${encodeURIComponent(trimmed)}`);
  if (!res.ok) {
    throw new Error(`FORGE single score request failed: ${res.status}`);
  }

  return res.json() as Promise<ForgeSingleScoreResponse>;
}
