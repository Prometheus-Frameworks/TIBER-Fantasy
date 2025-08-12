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
  errorType?: "INVALID_FORMAT" | "INVALID_POSITION" | "INVALID_RANK" | "PLAYER_NOT_FOUND" | "DATABASE_ERROR";
  format?: "dynasty" | "redraft";
}

export interface ConsensusLog {
  id: string;
  timestamp: string;
  command: string;
  result: ConsensusCommandResult;
  userId: string; // "architect-j" for seed phase
  format: "dynasty" | "redraft";
}

// Enhanced shorthand syntax parser with detailed error reporting
export function parseConsensusCommand(input: string): {
  command: ConsensusCommand | null;
  error: ConsensusCommandResult | null;
} {
  const trimmed = input.trim();
  
  // Check basic pattern first
  if (!trimmed.toLowerCase().startsWith('otc consensus')) {
    return {
      command: null,
      error: {
        success: false,
        message: "❌ Error: Command must start with 'OTC consensus'. Format: OTC consensus <POSITION><RANK> : <PLAYER NAME>",
        errorType: "INVALID_FORMAT"
      }
    };
  }
  
  // Pattern: "OTC consensus <POSITION><RANK> : <PLAYER NAME>"
  const pattern = /^OTC\s+consensus\s+(QB|RB|WR|TE)(\d+)\s*:\s*(.+)$/i;
  const match = trimmed.match(pattern);
  
  if (!match) {
    // Check for missing position
    const noPositionPattern = /^OTC\s+consensus\s*(\d+)?\s*:\s*(.+)$/i;
    if (noPositionPattern.test(trimmed)) {
      return {
        command: null,
        error: {
          success: false,
          message: "❌ Error: No valid position detected. Use QB, RB, WR, or TE.",
          errorType: "INVALID_POSITION"
        }
      };
    }
    
    return {
      command: null,
      error: {
        success: false,
        message: "❌ Error: Invalid command format. Use: OTC consensus <POSITION><RANK> : <PLAYER NAME>",
        errorType: "INVALID_FORMAT"
      }
    };
  }
  
  const [, position, rankStr, playerName] = match;
  const rank = parseInt(rankStr, 10);
  
  // Validate rank range
  if (rank < 1 || rank > 99) {
    return {
      command: null,
      error: {
        success: false,
        message: "❌ Error: Invalid rank number. Use a number between 1 and 99.",
        errorType: "INVALID_RANK"
      }
    };
  }
  
  // Validate player name
  if (!playerName.trim()) {
    return {
      command: null,
      error: {
        success: false,
        message: "❌ Error: Player name is required after the colon.",
        errorType: "INVALID_FORMAT"
      }
    };
  }
  
  return {
    command: {
      position: position.toUpperCase() as "QB" | "RB" | "WR" | "TE",
      rank,
      playerName: playerName.trim(),
      format: "dynasty" // default to dynasty for seed phase
    },
    error: null
  };
}