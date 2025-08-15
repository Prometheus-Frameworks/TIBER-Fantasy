// server/services/snapCounts.ts
// Snap-Counts ArticlePack integration for live snap count analysis

const KNOWLEDGE_BASE_URL = "http://localhost:8000/knowledge";

export interface SnapCountClaim {
  id: string;
  pos: string;
  snap_delta_pp: number;
  expected_points_delta: number;
  evidence: string;
  confidence: string;
}

export interface SnapCountExample {
  player: string;
  team: string;
  pos: string;
  week_n: number;
  week_n_snap_share: number;
  week_n_points: number;
  week_n_plus1: number;
  week_n_plus1_snap_share: number;
  week_n_plus1_points: number;
  snap_delta_pp: number;
  points_delta: number;
  context: string;
  sources: {
    snap_1?: string;
    snap_2?: string;
  };
  scoring_format: string;
  label: "HIT" | "MISS";
  notes?: string;
}

class SnapCountsService {
  async getClaim(pos: string, snapDeltaPp: number): Promise<string> {
    try {
      const response = await fetch(`${KNOWLEDGE_BASE_URL}/claims?pos=${pos}&snap_delta_pp=${snapDeltaPp}`);
      if (!response.ok) {
        throw new Error(`Knowledge base request failed: ${response.status}`);
      }
      
      const claims: SnapCountClaim[] = await response.json();
      if (!claims || claims.length === 0) {
        return `No claim set for ${pos} + ${snapDeltaPp}pp.`;
      }
      
      const claim = claims[0];
      return `${pos} +${snapDeltaPp}pp snap → +${claim.expected_points_delta} pts next week (confidence: ${claim.confidence}).`;
    } catch (error) {
      console.error('❌ Snap count claim error:', error);
      return `Error fetching claim for ${pos} +${snapDeltaPp}pp. Knowledge base may be unavailable.`;
    }
  }

  async getExamples(label: "HIT" | "MISS", limit: number = 4): Promise<string[]> {
    try {
      const response = await fetch(`${KNOWLEDGE_BASE_URL}/examples?label=${label}`);
      if (!response.ok) {
        throw new Error(`Knowledge base request failed: ${response.status}`);
      }
      
      const examples: SnapCountExample[] = await response.json();
      if (!examples || examples.length === 0) {
        return [`No examples labeled ${label}.`];
      }
      
      const limitedExamples = examples.slice(0, limit);
      return limitedExamples.map(e => 
        `${e.player} (${e.pos}, ${e.team}) — +${e.snap_delta_pp}pp → +${e.points_delta} pts — ${e.context}`
      );
    } catch (error) {
      console.error('❌ Snap count examples error:', error);
      return [`Error fetching ${label} examples. Knowledge base may be unavailable.`];
    }
  }

  async getAllExamples(label: "HIT" | "MISS"): Promise<string[]> {
    return this.getExamples(label, 999); // Get all examples
  }

  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      const response = await fetch(`${KNOWLEDGE_BASE_URL}/articles/snap-counts`);
      if (!response.ok) {
        return { status: 'unhealthy', message: `Knowledge base unreachable: ${response.status}` };
      }
      
      const pack = await response.json();
      return { 
        status: 'healthy', 
        message: `Snap-counts pack loaded: ${pack.id || 'snap-counts-v1'}` 
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: `Knowledge base connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}

export const snapCountsService = new SnapCountsService();