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

export type ForgeFantasySummary = {
  gamesPlayed: number | null;
  lastWeekPlayed: number | null;
  totalPpr: number | null;
  totalHalfPpr: number | null;
  lastWeekPpr: number | null;
  lastWeekHalfPpr: number | null;
  pprRankPos: number | null;
  halfPprRankPos: number | null;
};

export type PlayerContextResponse = {
  meta: { playerId: string; season: number };
  identity: {
    displayName: string;
    position: string;
    sleeperId: string | null;
    nflfastrGsisId: string | null;
  };
  team: { currentTeam: string | null; lastSeenWeek: number | null };
  usage?: Record<string, any>;
  efficiency?: Record<string, any>;
  finishing?: Record<string, any>;
  fantasy?: ForgeFantasySummary;
  metaStats?: { gamesPlayed?: number; lastUpdated?: string };
};

export type PlayerSearchResult = {
  playerId: string;
  displayName: string;
  position: string;
  currentTeam: string | null;
};

export async function searchPlayers(query: string): Promise<PlayerSearchResult[]> {
  if (!query.trim() || query.trim().length < 2) return [];
  const res = await fetch(`/api/forge/search-players?query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function fetchPlayerContext(playerId: string, season = 2025): Promise<PlayerContextResponse> {
  const res = await fetch(`/api/forge/player-context/${playerId}?season=${season}`);
  if (!res.ok) throw new Error(`Player not found: ${playerId}`);
  return res.json();
}
