// Hot List Service - Dynamic Player Extraction from OVR Compass Module
import { ovrEngine } from './ovrEngine';

interface PlayerData {
  playerId: string;
  name: string;
  team: string;
  position: string;
  baseOVR: number;
  currentOVR: number;
  weeklyChange: number;
  compass: {
    north: number;
    east: number;
    south: number;
    west: number;
  };
  usage: {
    routes?: number;
    carries?: number;
    snapShare?: number;
  };
  deltas: {
    deltaRoutesPct?: number;
    deltaSnapPp?: number;
    deltaCarryShare?: number;
    deltaRouteShare?: number;
  };
  reasons: string[];
  confidence: 'low' | 'med' | 'high';
  persistenceWeeks?: number;
  adpPercentile?: number;
}

interface HotListCriteria {
  bucket: 'risers' | 'elite' | 'usage_surge' | 'value';
  position?: 'WR' | 'RB' | 'TE' | 'QB';
  limit: number;
}

interface HotListItem {
  playerId: string;
  name: string;
  team: string;
  position: string;
  currentOVR: number;
  baseOVR: number;
  deltaTotal: number;
  compass: {
    north: number;
    east: number;
    south: number;
    west: number;
  };
  reasons: string[];
  confidence: string;
  percentiles: {
    ovr: number;
    north: number;
    east: number;
    south: number;
    west: number;
  };
}

// Volume floors to avoid noise from low-usage players
const VOLUME_FLOORS = {
  WR: { routes: 12, carries: 0 },
  RB: { routes: 10, carries: 8 },
  TE: { routes: 12, carries: 0 },
  QB: { routes: 0, carries: 0 }
};

// Percentile thresholds for elite classification
const PCT_THRESHOLDS = {
  elite_ovr: 0.90,
  north: 0.85,
  east: 0.75,
  south_low: 0.25, // Lower is safer (risk)
  west: 0.70
};

// Big change thresholds by position
const BIG_CHANGE_THRESHOLDS = {
  WR: { delta_routes_pct: 0.12, delta_snap_pp: 10 },
  RB: { delta_carry_share: 0.15, delta_route_share: 0.10 },
  TE: { delta_routes_pct: 0.10, delta_snap_pp: 8 },
  QB: { delta_snap_pp: 5 }
};

export class HotListService {
  private weeklyData: PlayerData[] = [];
  private metadata = {
    week: '',
    modelVersion: 'ovr-compass-1.0.0',
    inputsVersion: 'ovr-inputs-2025w02'
  };

  // Calculate position-aware percentiles
  private calculatePercentiles(players: PlayerData[]): Map<string, any> {
    const percentileMap = new Map();

    // Group by position
    const byPosition = new Map<string, PlayerData[]>();
    players.forEach(p => {
      if (!byPosition.has(p.position)) {
        byPosition.set(p.position, []);
      }
      byPosition.get(p.position)!.push(p);
    });

    // Calculate percentiles per position
    byPosition.forEach((posPlayers, position) => {
      const sorted = {
        ovr: [...posPlayers].sort((a, b) => a.currentOVR - b.currentOVR),
        north: [...posPlayers].sort((a, b) => a.compass.north - b.compass.north),
        east: [...posPlayers].sort((a, b) => a.compass.east - b.compass.east),
        south: [...posPlayers].sort((a, b) => a.compass.south - b.compass.south),
        west: [...posPlayers].sort((a, b) => a.compass.west - b.compass.west)
      };

      posPlayers.forEach(player => {
        const percentiles = {
          ovr: sorted.ovr.findIndex(p => p.playerId === player.playerId) / sorted.ovr.length,
          north: sorted.north.findIndex(p => p.playerId === player.playerId) / sorted.north.length,
          east: sorted.east.findIndex(p => p.playerId === player.playerId) / sorted.east.length,
          south: sorted.south.findIndex(p => p.playerId === player.playerId) / sorted.south.length,
          west: sorted.west.findIndex(p => p.playerId === player.playerId) / sorted.west.length
        };
        
        percentileMap.set(player.playerId, percentiles);
      });
    });

    return percentileMap;
  }

  // Check if player meets volume floor requirements
  private meetsVolumeFloor(player: PlayerData): boolean {
    const floor = VOLUME_FLOORS[player.position as keyof typeof VOLUME_FLOORS];
    if (!floor) return true;

    const routes = player.usage.routes || 0;
    const carries = player.usage.carries || 0;

    if (player.position === 'RB') {
      // RB can qualify with either routes or carries
      return routes >= floor.routes || carries >= floor.carries;
    }
    
    // WR/TE/QB require minimum routes
    return routes >= floor.routes && carries >= floor.carries;
  }

  // Check if player has significant usage surge
  private hasUsageSurge(player: PlayerData): boolean {
    const thresholds = BIG_CHANGE_THRESHOLDS[player.position as keyof typeof BIG_CHANGE_THRESHOLDS];
    if (!thresholds) return false;

    const deltas = player.deltas as any;
    const routesPctSurge = (deltas.deltaRoutesPct || deltas.delta_routes_pct || 0) >= (thresholds.delta_routes_pct || 0.1);
    const snapSurge = (deltas.deltaSnapPp || deltas.delta_snap_pp || 0) >= (thresholds.delta_snap_pp || 10);
    const carryShareSurge = (deltas.deltaCarryShare || deltas.delta_carry_share || 0) >= (thresholds.delta_carry_share || 0.1);
    const routeShareSurge = (deltas.deltaRouteShare || deltas.delta_route_share || 0) >= (thresholds.delta_route_share || 0.1);

    return routesPctSurge || snapSurge || carryShareSurge || routeShareSurge;
  }

  // Generate hot list based on criteria
  public generateHotList(criteria: HotListCriteria): {
    players: HotListItem[];
    metadata: any;
    criteria: any;
  } {
    let players = [...this.weeklyData];
    
    // Filter by position if specified
    if (criteria.position) {
      players = players.filter(p => p.position === criteria.position);
    }

    // Calculate percentiles
    const percentileMap = this.calculatePercentiles(players);

    // Apply volume floor filter
    players = players.filter(p => this.meetsVolumeFloor(p));

    let filtered: PlayerData[] = [];

    switch (criteria.bucket) {
      case 'elite':
        filtered = players.filter(player => {
          const pct = percentileMap.get(player.playerId);
          if (!pct) return false;
          
          return (
            pct.ovr >= PCT_THRESHOLDS.elite_ovr &&
            pct.north >= PCT_THRESHOLDS.north &&
            pct.east >= PCT_THRESHOLDS.east &&
            pct.south <= PCT_THRESHOLDS.south_low &&
            pct.west >= PCT_THRESHOLDS.west
          );
        });
        filtered.sort((a, b) => b.currentOVR - a.currentOVR);
        break;

      case 'risers':
        filtered = players.filter(player => {
          const ovrGain = player.currentOVR - player.baseOVR;
          const persistenceOk = (player.persistenceWeeks || 0) >= 2;
          return ovrGain >= 5 && persistenceOk;
        });
        filtered.sort((a, b) => {
          const aGain = a.currentOVR - a.baseOVR;
          const bGain = b.currentOVR - b.baseOVR;
          return bGain - aGain;
        });
        break;

      case 'usage_surge':
        filtered = players.filter(player => this.hasUsageSurge(player));
        filtered.sort((a, b) => {
          const aDeltas = a.deltas as any;
          const bDeltas = b.deltas as any;
          const aUsage = (aDeltas.deltaRoutesPct || aDeltas.delta_routes_pct || 0) + (aDeltas.deltaSnapPp || aDeltas.delta_snap_pp || 0) / 100;
          const bUsage = (bDeltas.deltaRoutesPct || bDeltas.delta_routes_pct || 0) + (bDeltas.deltaSnapPp || bDeltas.delta_snap_pp || 0) / 100;
          return bUsage - aUsage;
        });
        break;

      case 'value':
        filtered = players.filter(player => {
          const pct = percentileMap.get(player.playerId);
          if (!pct || !player.adpPercentile) return false;
          
          const valueEdge = pct.ovr - player.adpPercentile >= 0.15;
          const northOk = pct.north >= 0.60;
          return valueEdge && northOk;
        });
        filtered.sort((a, b) => {
          const aPct = percentileMap.get(a.playerId);
          const bPct = percentileMap.get(b.playerId);
          if (!aPct || !bPct) return 0;
          return bPct.ovr - aPct.ovr;
        });
        break;
    }

    // Limit results
    filtered = filtered.slice(0, criteria.limit);

    // Convert to response format
    const hotListItems: HotListItem[] = filtered.map(player => ({
      playerId: player.playerId,
      name: player.name,
      team: player.team,
      position: player.position,
      currentOVR: player.currentOVR,
      baseOVR: player.baseOVR,
      deltaTotal: player.currentOVR - player.baseOVR,
      compass: player.compass,
      reasons: player.reasons.slice(0, 3),
      confidence: player.confidence,
      percentiles: percentileMap.get(player.playerId) || { ovr: 0, north: 0, east: 0, south: 0, west: 0 }
    }));

    return {
      players: hotListItems,
      metadata: {
        week: this.metadata.week,
        modelVersion: this.metadata.modelVersion,
        inputsVersion: this.metadata.inputsVersion,
        bucket: criteria.bucket,
        position: criteria.position || 'ALL',
        totalPlayers: hotListItems.length
      },
      criteria: {
        elite_cut: criteria.bucket === 'elite' ? 'p90 ovr, p85 N, p75 E, p25 S (lower), p70 W' : '',
        risers_cut: criteria.bucket === 'risers' ? '>= +5 vs base & >=2 weeks' : '',
        usage_surge_cut: criteria.bucket === 'usage_surge' ? '>= big threshold (routes% or snap_pp)' : '',
        value_cut: criteria.bucket === 'value' ? 'ovr_pct - adp_pct >= 0.15 & north >= p60' : ''
      }
    };
  }

  // Seed with sample data for testing
  public seedSampleData(): void {
    this.weeklyData = [
      {
        playerId: 'ja-marr-chase',
        name: 'Ja\'Marr Chase',
        team: 'CIN',
        position: 'WR',
        baseOVR: 94,
        currentOVR: 97,
        weeklyChange: 3,
        compass: { north: 95, east: 88, south: 15, west: 92 },
        usage: { routes: 35, carries: 0, snapShare: 0.92 },
        deltas: { deltaRoutesPct: 0.15, deltaSnapPp: 8 },
        reasons: ['Routes +15%', 'TPRR elite', 'Target share up'],
        confidence: 'high',
        persistenceWeeks: 3,
        adpPercentile: 0.95
      },
      {
        playerId: 'christian-mccaffrey',
        name: 'Christian McCaffrey',
        team: 'SF',
        position: 'RB',
        baseOVR: 92,
        currentOVR: 89,
        weeklyChange: -3,
        compass: { north: 88, east: 85, south: 35, west: 90 },
        usage: { routes: 25, carries: 18, snapShare: 0.75 },
        deltas: { deltaCarryShare: -0.12, deltaRouteShare: -0.08 },
        reasons: ['Carry share down', 'Age concern', 'Usage decline'],
        confidence: 'med',
        persistenceWeeks: 2,
        adpPercentile: 0.92
      },
      {
        playerId: 'rome-odunze',
        name: 'Rome Odunze',
        team: 'CHI',
        position: 'WR',
        baseOVR: 78,
        currentOVR: 84,
        weeklyChange: 6,
        compass: { north: 75, east: 82, south: 25, west: 88 },
        usage: { routes: 28, carries: 0, snapShare: 0.68 },
        deltas: { deltaRoutesPct: 0.20, deltaSnapPp: 15 },
        reasons: ['Snap surge +15%', 'Routes increase', 'Target growth'],
        confidence: 'high',
        persistenceWeeks: 2,
        adpPercentile: 0.45
      },
      {
        playerId: 'travis-kelce',
        name: 'Travis Kelce',
        team: 'KC',
        position: 'TE',
        baseOVR: 89,
        currentOVR: 91,
        weeklyChange: 2,
        compass: { north: 92, east: 90, south: 20, west: 85 },
        usage: { routes: 32, carries: 0, snapShare: 0.85 },
        deltas: { deltaRoutesPct: 0.08, deltaSnapPp: 5 },
        reasons: ['Elite usage', 'High efficiency', 'Scheme fit'],
        confidence: 'high',
        persistenceWeeks: 4,
        adpPercentile: 0.88
      }
    ];

    this.metadata.week = '2025-W02';
    console.log('✅ Hot List Service seeded with sample data');
  }

  // Update weekly context (would be called by ETL pipeline)
  public updateWeeklyContext(players: PlayerData[], week: string): void {
    this.weeklyData = players;
    this.metadata.week = week;
    console.log(`📊 Hot List updated for ${week} with ${players.length} players`);
  }

  // Get metadata
  public getMetadata() {
    return this.metadata;
  }
}

// Export singleton instance
export const hotListService = new HotListService();