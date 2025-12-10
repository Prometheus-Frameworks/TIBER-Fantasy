// Temporary in-memory store for TIBER Consensus Command Router v1 demo
// This provides immediate functionality while database schema is being finalized

interface InMemoryConsensusRank {
  id: string;
  season: number;
  mode: "redraft" | "dynasty";
  position: "QB" | "RB" | "WR" | "TE" | "ALL";
  rank: number;
  playerId: string;
  playerName: string;
  sourceUser: string;
  sourceWeight: number;
  note?: string;
  updatedAt: Date;
}

interface InMemoryConsensusAudit {
  id: string;
  season: number;
  mode: string;
  position: string;
  rank: number;
  playerId: string;
  previousPlayerId?: string;
  sourceUser: string;
  action: "insert" | "update" | "swap" | "shift";
  payload: any;
  createdAt: Date;
}

class InMemoryConsensusStore {
  private ranks: InMemoryConsensusRank[] = [];
  private audit: InMemoryConsensusAudit[] = [];

  findRankByPosition(season: number, mode: string, position: string, rank: number): InMemoryConsensusRank | undefined {
    return this.ranks.find(r => 
      r.season === season && 
      r.mode === mode && 
      r.position === position && 
      r.rank === rank
    );
  }

  findRankByPlayer(season: number, mode: string, position: string, playerId: string): InMemoryConsensusRank | undefined {
    return this.ranks.find(r => 
      r.season === season && 
      r.mode === mode && 
      r.position === position && 
      r.playerId === playerId
    );
  }

  upsertRank(data: Omit<InMemoryConsensusRank, 'id' | 'updatedAt'>): InMemoryConsensusRank {
    const existing = this.findRankByPlayer(data.season, data.mode, data.position, data.playerId);
    
    if (existing) {
      // Update existing rank
      Object.assign(existing, { ...data, updatedAt: new Date() });
      return existing;
    } else {
      // Insert new rank
      const newRank: InMemoryConsensusRank = {
        ...data,
        id: `consensus-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        updatedAt: new Date()
      };
      this.ranks.push(newRank);
      return newRank;
    }
  }

  updateRankByPosition(season: number, mode: string, position: string, rank: number, updates: Partial<InMemoryConsensusRank>): void {
    const existing = this.findRankByPosition(season, mode, position, rank);
    if (existing) {
      Object.assign(existing, { ...updates, updatedAt: new Date() });
    }
  }

  addAuditEntry(entry: Omit<InMemoryConsensusAudit, 'id' | 'createdAt'>): void {
    this.audit.push({
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date()
    });
  }

  getRanksByFormat(season: number, mode: string, position?: string): InMemoryConsensusRank[] {
    return this.ranks
      .filter(r => r.season === season && r.mode === mode && (!position || r.position === position))
      .sort((a, b) => a.rank - b.rank);
  }

  getRecentAudit(limit: number = 10): InMemoryConsensusAudit[] {
    return this.audit
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  clear(): void {
    this.ranks = [];
    this.audit = [];
  }
}

export const inMemoryConsensusStore = new InMemoryConsensusStore();