export type ConsensusFormat = "redraft" | "dynasty";

export interface ConsensusRow {
  id: string;           // uuid
  playerId: string;     // sleeper/nfl id
  format: ConsensusFormat;
  season?: number;      // required for redraft, omitted for dynasty
  rank: number;         // 1..n within (format, season)
  tier: string;         // S,A,B,... or T1,T2...
  score: number;        // display composite (after OTC bias)
  source: "system" | "editor" | "community";
  updatedAt: string;
}

export interface ConsensusMeta {
  defaultFormat: ConsensusFormat; // "dynasty" (canonical base)
  boardVersion: number;           // bump on any write
}

export interface ConsensusResponse {
  meta: ConsensusMeta;
  rows: ConsensusRow[];
}

export interface ConsensusUpdate {
  playerId: string;
  rank?: number;
  tier?: string;
  score?: number;
}

export interface ConsensusPatchRequest {
  format: ConsensusFormat;
  season?: number;
  updates: ConsensusUpdate[];
}

export interface ConsensusChangelogEntry {
  id: string;
  timestamp: string;
  userId?: string;
  format: ConsensusFormat;
  season?: number;
  playerId: string;
  before: Partial<ConsensusRow>;
  after: Partial<ConsensusRow>;
}