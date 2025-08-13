export type Format = "redraft" | "dynasty";
export type Position = "QB" | "RB" | "WR" | "TE" | "ALL";

export interface UserProfile {
  id: string;
  username: string;          // e.g., "Architect J"
  consentConsensus: boolean; // default false
  fireScore: number;         // total 🔥 received
  createdAt: string;
}

export interface ConsensusRow {
  id: string;           // uuid
  playerId: string;
  format: Format;
  season?: number;      // required for redraft, omitted for dynasty
  pos: Position;        // position slice (for querying/sorting)
  rank: number;         // integer rank within slice
  source: "seed" | "community";
  updatedAt: string;
}

export interface UserRankRow {
  id: string;
  userId: string;
  format: Format;
  season?: number;
  pos: Position;
  playerId: string;
  rank: number;
  updatedAt: string;
}

export interface FireEvent {
  id: string;
  fromUserId: string;
  toUserId: string;
  targetType: "rankingSet" | "profile";
  targetId: string; // rankingSet id or profile id
  createdAt: string;
}

export interface ConsensusMetadata {
  contributors: number;
  lastUpdatedISO: string;
  equalWeight: true;
  format: Format;
  season?: number;
}

export interface CompareRanking {
  playerId: string;
  playerName: string;
  yourRank?: number;
  consensusRank?: number;
  delta?: number; // consensusRank - yourRank
}

// Additional types for backend/frontend compatibility
export type ConsensusFormat = Format;

export interface ConsensusResponse {
  meta: {
    defaultFormat: ConsensusFormat;
    boardVersion: number;
  };
  rows: Array<{
    id: string;
    playerId: string;
    format: ConsensusFormat;
    season?: number;
    rank: number;
    tier: number;
    score: number;
    source: string;
    updatedAt: string;
  }>;
}

export interface ConsensusPatchRequest {
  format: ConsensusFormat;
  season?: number;
  updates: Array<{
    playerId: string;
    rank?: number;
    tier?: number;
    score?: number;
  }>;
}