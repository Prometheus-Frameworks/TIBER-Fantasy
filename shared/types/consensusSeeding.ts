export interface ConsensusCommand {
  position: "QB" | "RB" | "WR" | "TE";
  rank: number;
  playerName: string;
  format?: "dynasty" | "redraft"; // defaults to dynasty
}

export interface ConsensusCommandResult {
  success: boolean;
  message: string;
  logEntry?: string;
  previousPlayer?: {
    name: string;
    rank: number;
  };
  shifts?: Array<{
    playerName: string;
    fromRank: number;
    toRank: number;
  }>;
}

export interface ConsensusLog {
  id: string;
  timestamp: string;
  command: string;
  result: ConsensusCommandResult;
  userId: string; // "architect-j" for seed phase
  format: "dynasty" | "redraft";
}

// Shorthand syntax parser
export function parseConsensusCommand(input: string): ConsensusCommand | null {
  // Pattern: "OTC consensus <POSITION><RANK> : <PLAYER NAME>"
  const pattern = /^OTC\s+consensus\s+(QB|RB|WR|TE)(\d{1,2})\s*:\s*(.+)$/i;
  const match = input.trim().match(pattern);
  
  if (!match) return null;
  
  const [, position, rankStr, playerName] = match;
  const rank = parseInt(rankStr, 10);
  
  // Validation
  if (rank < 1 || rank > 99) return null;
  if (!playerName.trim()) return null;
  
  return {
    position: position.toUpperCase() as "QB" | "RB" | "WR" | "TE",
    rank,
    playerName: playerName.trim(),
    format: "dynasty" // default to dynasty for seed phase
  };
}