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