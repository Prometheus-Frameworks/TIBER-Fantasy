import { and, eq, ilike, or, sql } from "drizzle-orm";
import { PlayerCompassService } from "./playerCompassService";

// LRU Cache implementation for compass caching
class LRUCache<K, V> {
  private capacity: number;
  private ttl: number;
  private cache: Map<K, { value: V; timestamp: number }>;

  constructor(capacity: number = 5000, ttlMs: number = 10 * 60 * 1000) {
    this.capacity = capacity;
    this.ttl = ttlMs;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.capacity) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, { value, timestamp: Date.now() });
  }
}

export interface UnifiedPlayer {
  id: string;
  name: string;
  team?: string;
  pos?: "QB" | "RB" | "WR" | "TE";
  adp?: number | null;
  projectedPoints?: number | null;
  avgPoints?: number | null;
  injuryStatus?: string | null;
  qwen?: { rank?: number | null; tier?: string | null };
  compass?: { score?: number | null; tier?: string | null };
}

export interface PlayerFilters {
  pos?: string;
  team?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const compassCache = new LRUCache<string, any>(5000, 10 * 60 * 1000);

function compassKey(id: string, mode: "dynasty" | "redraft" = "dynasty") {
  return `${id}:${mode}`;
}

export class UnifiedPlayerService {
  private compassService = new PlayerCompassService();

  async getPlayerPool(filters: { 
    pos?: string; 
    team?: string; 
    search?: string; 
    page?: number; 
    pageSize?: number 
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(Math.max(10, filters.pageSize ?? 50), 200);
    const offset = (page - 1) * pageSize;

    // For now, let's work with sample data until we have the full schema
    // This will be replaced with real Drizzle queries once schema is updated
    const samplePlayers = this.getSamplePlayerData();
    
    // Apply filters
    let filteredPlayers = samplePlayers;
    
    if (filters.pos) {
      filteredPlayers = filteredPlayers.filter(p => p.pos === filters.pos);
    }
    
    if (filters.team) {
      filteredPlayers = filteredPlayers.filter(p => p.team === filters.team);
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredPlayers = filteredPlayers.filter(p => 
        p.name.toLowerCase().includes(searchLower)
      );
    }

    const total = filteredPlayers.length;
    const paginatedPlayers = filteredPlayers.slice(offset, offset + pageSize);

    // Add compass scores with caching
    const rows: UnifiedPlayer[] = [];
    for (const p of paginatedPlayers) {
      const key = compassKey(p.id);
      let cached = compassCache.get(key);
      if (!cached) {
        try {
          cached = await this.compassService.calculateCompass(
            { 
              playerId: p.id, 
              playerName: p.name, 
              position: p.pos, 
              team: p.team, 
              age: p.age || 25, 
              rawStats: p.rawStats || {},
              contextTags: p.contextTags || []
            },
            "dynasty"
          );
          compassCache.set(key, cached);
        } catch {
          cached = null;
        }
      }
      
      rows.push({
        id: p.id,
        name: p.name,
        team: p.team,
        pos: p.pos as any,
        adp: p.adp,
        projectedPoints: p.projectedPoints,
        avgPoints: p.avgPoints,
        injuryStatus: "Healthy",
        qwen: { rank: p.qwenRank || null, tier: p.qwenTier || null },
        compass: { score: cached?.score ?? null, tier: cached?.tier ?? null },
      });
    }

    return { rows, total, page, pageSize };
  }

  private getSamplePlayerData() {
    return [
      // WR
      { id: 'ja-marr-chase', name: "Ja'Marr Chase", team: 'CIN', pos: 'WR', age: 24, adp: 5, projectedPoints: 285, avgPoints: 18.2, qwenRank: 1, qwenTier: 'Elite', rawStats: { targets: 135, receptions: 81, yards: 1056, tds: 7 }, contextTags: ['alpha', 'target_hog'] },
      { id: 'ceedee-lamb', name: 'CeeDee Lamb', team: 'DAL', pos: 'WR', age: 25, adp: 8, projectedPoints: 275, avgPoints: 17.8, qwenRank: 2, qwenTier: 'Elite', rawStats: { targets: 145, receptions: 98, yards: 1359, tds: 12 }, contextTags: ['alpha', 'redzone'] },
      { id: 'justin-jefferson', name: 'Justin Jefferson', team: 'MIN', pos: 'WR', age: 25, adp: 12, projectedPoints: 270, avgPoints: 17.1, qwenRank: 3, qwenTier: 'Elite', rawStats: { targets: 120, receptions: 68, yards: 1074, tds: 5 }, contextTags: ['elite', 'wr1'] },
      { id: 'amon-ra-st-brown', name: 'Amon-Ra St. Brown', team: 'DET', pos: 'WR', age: 25, adp: 15, projectedPoints: 265, avgPoints: 16.9, qwenRank: 4, qwenTier: 'High-End', rawStats: { targets: 164, receptions: 119, yards: 1515, tds: 12 }, contextTags: ['volume', 'consistent'] },
      { id: 'puka-nacua', name: 'Puka Nacua', team: 'LAR', pos: 'WR', age: 23, adp: 18, projectedPoints: 255, avgPoints: 16.2, qwenRank: 5, qwenTier: 'High-End', rawStats: { targets: 153, receptions: 105, yards: 1486, tds: 6 }, contextTags: ['breakout', 'young'] },
      { id: 'tyreek-hill', name: 'Tyreek Hill', team: 'MIA', pos: 'WR', age: 30, adp: 22, projectedPoints: 245, avgPoints: 15.8, qwenRank: 6, qwenTier: 'High-End', rawStats: { targets: 142, receptions: 80, yards: 1233, tds: 7 }, contextTags: ['speed', 'aging'] },
      { id: 'davante-adams', name: 'Davante Adams', team: 'LV', pos: 'WR', age: 31, adp: 25, projectedPoints: 240, avgPoints: 15.3, qwenRank: 7, qwenTier: 'Solid', rawStats: { targets: 175, receptions: 103, yards: 1144, tds: 8 }, contextTags: ['veteran', 'reliable'] },
      
      // RB
      { id: 'saquon-barkley', name: 'Saquon Barkley', team: 'PHI', pos: 'RB', age: 27, adp: 3, projectedPoints: 295, avgPoints: 19.2, qwenRank: 1, qwenTier: 'Elite', rawStats: { carries: 345, yards: 2005, tds: 13, targets: 33 }, contextTags: ['bellcow', 'volume'] },
      { id: 'josh-jacobs', name: 'Josh Jacobs', team: 'GB', pos: 'RB', age: 26, adp: 6, projectedPoints: 285, avgPoints: 18.8, qwenRank: 2, qwenTier: 'Elite', rawStats: { carries: 340, yards: 1329, tds: 11, targets: 44 }, contextTags: ['workhorse', 'rb1'] },
      { id: 'derrick-henry', name: 'Derrick Henry', team: 'BAL', pos: 'RB', age: 30, adp: 9, projectedPoints: 275, avgPoints: 17.5, qwenRank: 3, qwenTier: 'High-End', rawStats: { carries: 325, yards: 1921, tds: 16, targets: 11 }, contextTags: ['power', 'aging'] },
      { id: 'bijan-robinson', name: 'Bijan Robinson', team: 'ATL', pos: 'RB', age: 22, adp: 11, projectedPoints: 270, avgPoints: 17.2, qwenRank: 4, qwenTier: 'High-End', rawStats: { carries: 237, yards: 1463, tds: 11, targets: 58 }, contextTags: ['young', 'receiving'] },
      { id: 'breece-hall', name: 'Breece Hall', team: 'NYJ', pos: 'RB', age: 23, adp: 14, projectedPoints: 260, avgPoints: 16.8, qwenRank: 5, qwenTier: 'High-End', rawStats: { carries: 223, yards: 994, tds: 5, targets: 76 }, contextTags: ['upside', 'injury_risk'] },
      
      // TE
      { id: 'travis-kelce', name: 'Travis Kelce', team: 'KC', pos: 'TE', age: 35, adp: 35, projectedPoints: 185, avgPoints: 12.8, qwenRank: 1, qwenTier: 'Elite', rawStats: { targets: 97, receptions: 65, yards: 823, tds: 3 }, contextTags: ['aging', 'elite'] },
      { id: 'sam-laporta', name: 'Sam LaPorta', team: 'DET', pos: 'TE', age: 24, adp: 45, projectedPoints: 175, avgPoints: 11.9, qwenRank: 2, qwenTier: 'High-End', rawStats: { targets: 120, receptions: 86, yards: 889, tds: 10 }, contextTags: ['young', 'redzone'] },
      { id: 'trey-mcbride', name: 'Trey McBride', team: 'ARI', pos: 'TE', age: 24, adp: 55, projectedPoints: 165, avgPoints: 11.2, qwenRank: 3, qwenTier: 'Solid', rawStats: { targets: 96, receptions: 81, yards: 825, tds: 3 }, contextTags: ['volume', 'consistent'] },
      
      // QB
      { id: 'josh-allen', name: 'Josh Allen', team: 'BUF', pos: 'QB', age: 28, adp: 28, projectedPoints: 365, avgPoints: 24.2, qwenRank: 1, qwenTier: 'Elite', rawStats: { passYards: 4306, passTds: 28, rushYards: 15, rushTds: 15 }, contextTags: ['elite', 'rushing'] },
      { id: 'lamar-jackson', name: 'Lamar Jackson', team: 'BAL', pos: 'QB', age: 27, adp: 32, projectedPoints: 355, avgPoints: 23.8, qwenRank: 2, qwenTier: 'Elite', rawStats: { passYards: 3678, passTds: 24, rushYards: 915, rushTds: 3 }, contextTags: ['rushing', 'dynamic'] },
      { id: 'jalen-hurts', name: 'Jalen Hurts', team: 'PHI', pos: 'QB', age: 26, adp: 38, projectedPoints: 345, avgPoints: 22.9, qwenRank: 3, qwenTier: 'High-End', rawStats: { passYards: 3858, passTds: 15, rushYards: 605, rushTds: 14 }, contextTags: ['rushing', 'upside'] }
    ];
  }
}

export const unifiedPlayerService = new UnifiedPlayerService();