// OVR Engine - Dynamic Player Overall Rating System
import { readFileSync } from 'fs';
import { join } from 'path';

interface CompassMapping {
  compass_dir: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
  metric_family: string;
  data_field: string;
  position: string;
  tier: string;
  percentile: string;
  value: number;
  ovr_weight: number;
}

interface OVRDeltaRule {
  pos: string;
  metric: string;
  delta_threshold: number;
  persistence_weeks: number;
  ovr_change: number;
  direction: '+' | '-';
}

interface DecayConfig {
  [category: string]: {
    [metric: string]: {
      decay_rate_per_week: number;
    };
  };
}

interface BaseOVRConfig {
  pos: string;
  role_tier: string;
  percentile_range: string;
  base_ovr_range: string;
  midpoint: number;
}

interface PlayerOVRState {
  playerId: string;
  baseOVR: number;
  currentOVR: number;
  activeDeltas: {
    [category: string]: {
      [metric: string]: number;
    };
  };
  lastUpdated: string;
  weeklyHistory: Array<{
    week: number;
    ovr: number;
    changes: string[];
  }>;
}

export class OVREngine {
  private compassMapping: CompassMapping[] = [];
  private deltaRules: OVRDeltaRule[] = [];
  private decayConfig: DecayConfig = {};
  private baseOVRConfig: BaseOVRConfig[] = [];
  private playerStates: Map<string, PlayerOVRState> = new Map();

  constructor() {
    this.loadConfiguration();
  }

  private parseCsv(csvContent: string): any[] {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row: any = {};
      
      headers.forEach((header, index) => {
        const value = values[index]?.trim();
        if (header === 'value' || header === 'ovr_weight' || header === 'midpoint') {
          row[header] = parseFloat(value) || 0;
        } else {
          row[header] = value;
        }
      });
      
      data.push(row);
    }
    
    return data;
  }

  private loadConfiguration() {
    try {
      // Load compass mapping
      const compassCsv = readFileSync(join(process.cwd(), 'ovr_inputs/compass_mapping.csv'), 'utf-8');
      this.compassMapping = this.parseCsv(compassCsv);

      // Load delta rules
      const deltaRulesJson = readFileSync(join(process.cwd(), 'ovr_inputs/ovr_delta_rules.json'), 'utf-8');
      this.deltaRules = JSON.parse(deltaRulesJson);

      // Load decay configuration
      const decayJson = readFileSync(join(process.cwd(), 'ovr_inputs/decay_engine.json'), 'utf-8');
      this.decayConfig = JSON.parse(decayJson);

      // Load base OVR configuration
      const baseOVRCsv = readFileSync(join(process.cwd(), 'ovr_inputs/preseason_to_base_ovr.csv'), 'utf-8');
      this.baseOVRConfig = this.parseCsv(baseOVRCsv);

      console.log('✅ OVR Engine configuration loaded successfully');
      console.log(`📊 Loaded ${this.compassMapping.length} compass mappings`);
      console.log(`⚡ Loaded ${this.deltaRules.length} delta rules`);
      console.log(`📈 Loaded ${this.baseOVRConfig.length} base OVR configurations`);
    } catch (error) {
      console.error('❌ Failed to load OVR Engine configuration:', error);
    }
  }

  // Seed base OVR for a player based on position and tier
  public seedBaseOVR(playerId: string, position: string, roleTier: string): number {
    const config = this.baseOVRConfig.find(c => 
      c.pos === position && c.role_tier === roleTier
    );

    if (!config) {
      console.warn(`⚠️ No base OVR config found for ${position} ${roleTier}, using default`);
      return 75; // Default base OVR
    }

    const baseOVR = config.midpoint;
    
    // Initialize player state
    this.playerStates.set(playerId, {
      playerId,
      baseOVR,
      currentOVR: baseOVR,
      activeDeltas: {},
      lastUpdated: new Date().toISOString(),
      weeklyHistory: []
    });

    console.log(`🎯 Seeded ${playerId} (${position} ${roleTier}) with base OVR: ${baseOVR}`);
    return baseOVR;
  }

  // Apply weekly decay to active deltas
  private applyDecay(playerState: PlayerOVRState): void {
    for (const [category, metrics] of Object.entries(playerState.activeDeltas)) {
      if (!this.decayConfig[category]) continue;

      for (const [metric, value] of Object.entries(metrics)) {
        const decayRate = this.decayConfig[category][metric]?.decay_rate_per_week || 0;
        const newValue = value * (1 - decayRate);
        
        // Remove deltas that have decayed below threshold
        if (Math.abs(newValue) < 0.1) {
          delete playerState.activeDeltas[category][metric];
          if (Object.keys(playerState.activeDeltas[category]).length === 0) {
            delete playerState.activeDeltas[category];
          }
        } else {
          playerState.activeDeltas[category][metric] = newValue;
        }
      }
    }
  }

  // Check if a delta rule applies to current player data
  private checkDeltaRule(rule: OVRDeltaRule, playerData: any): boolean {
    const metricValue = playerData[rule.metric];
    if (metricValue === undefined) return false;

    const threshold = rule.delta_threshold;
    
    if (rule.direction === '+') {
      return metricValue >= threshold;
    } else {
      return metricValue <= threshold;
    }
  }

  // Get metric category for decay purposes
  private getMetricCategory(metric: string): string {
    const categoryMap: { [key: string]: string } = {
      'snap_share': 'Usage',
      'routes_pct': 'Usage',
      'carry_share': 'Usage',
      'route_share': 'Usage',
      'tprr': 'Efficiency',
      'yprr': 'Efficiency',
      'ypc': 'Efficiency',
      'rz_share': 'RedZone',
      'rz_target_share': 'RedZone',
      'env_qb_adj_mean': 'Environment',
      'env_oline_adj_mean': 'Environment',
      'team_pass_att_rank': 'Environment'
    };
    return categoryMap[metric] || 'Other';
  }

  // Process weekly data update for a player
  public processWeeklyUpdate(playerId: string, position: string, weeklyData: any, week: number): PlayerOVRState | null {
    let playerState = this.playerStates.get(playerId);
    
    if (!playerState) {
      console.warn(`⚠️ No player state found for ${playerId}, cannot process weekly update`);
      return null;
    }

    // Apply decay first
    this.applyDecay(playerState);

    const changes: string[] = [];
    
    // Check each delta rule
    for (const rule of this.deltaRules) {
      if (rule.pos !== position) continue;
      
      if (this.checkDeltaRule(rule, weeklyData)) {
        const category = this.getMetricCategory(rule.metric);
        
        // Initialize category if needed
        if (!playerState.activeDeltas[category]) {
          playerState.activeDeltas[category] = {};
        }
        
        // Apply delta change
        const currentDelta = playerState.activeDeltas[category][rule.metric] || 0;
        const deltaChange = rule.ovr_change * (rule.direction === '+' ? 1 : -1);
        playerState.activeDeltas[category][rule.metric] = currentDelta + deltaChange;
        
        changes.push(`${rule.metric} ${rule.direction}${Math.abs(deltaChange)}`);
        console.log(`📈 Applied delta for ${playerId}: ${rule.metric} ${deltaChange}`);
      }
    }

    // Calculate new current OVR
    let totalDelta = 0;
    for (const category of Object.values(playerState.activeDeltas)) {
      for (const delta of Object.values(category)) {
        totalDelta += delta;
      }
    }

    playerState.currentOVR = Math.max(40, Math.min(99, playerState.baseOVR + totalDelta));
    playerState.lastUpdated = new Date().toISOString();
    
    // Add to weekly history
    playerState.weeklyHistory.push({
      week,
      ovr: playerState.currentOVR,
      changes
    });

    // Keep only last 8 weeks of history
    if (playerState.weeklyHistory.length > 8) {
      playerState.weeklyHistory = playerState.weeklyHistory.slice(-8);
    }

    console.log(`🔄 Updated ${playerId} OVR: ${playerState.baseOVR} → ${playerState.currentOVR} (Δ${totalDelta.toFixed(1)})`);
    
    return playerState;
  }

  // Calculate compass quadrant scores
  public calculateCompassScores(playerId: string, position: string, playerData: any): {
    north: number;
    east: number;
    south: number;
    west: number;
  } {
    const scores = { north: 0, east: 0, south: 0, west: 0 };
    
    const relevantMappings = this.compassMapping.filter(m => 
      m.position === position || m.position === 'ALL'
    );

    for (const mapping of relevantMappings) {
      const dataValue = playerData[mapping.data_field];
      if (dataValue === undefined) continue;

      // Simple scoring based on percentile comparison
      let score = 0;
      if (dataValue >= mapping.value) {
        score = mapping.ovr_weight * 100; // Normalize to 0-100
      } else {
        score = mapping.ovr_weight * (dataValue / mapping.value) * 100;
      }

      switch (mapping.compass_dir) {
        case 'NORTH':
          scores.north += score;
          break;
        case 'EAST':
          scores.east += score;
          break;
        case 'SOUTH':
          scores.south += Math.abs(score); // Risk scores are positive
          break;
        case 'WEST':
          scores.west += score;
          break;
      }
    }

    // Normalize scores to 0-100 range
    const maxScore = 25; // Approximate max based on weights
    return {
      north: Math.min(100, Math.max(0, scores.north * (100 / maxScore))),
      east: Math.min(100, Math.max(0, scores.east * (100 / maxScore))),
      south: Math.min(100, Math.max(0, scores.south * (100 / maxScore))),
      west: Math.min(100, Math.max(0, scores.west * (100 / maxScore)))
    };
  }

  // Get current player OVR state
  public getPlayerOVR(playerId: string): PlayerOVRState | null {
    return this.playerStates.get(playerId) || null;
  }

  // Get all player states (for admin/debug)
  public getAllPlayerStates(): PlayerOVRState[] {
    return Array.from(this.playerStates.values());
  }

  // Reset player state (useful for testing)
  public resetPlayer(playerId: string): void {
    this.playerStates.delete(playerId);
  }

  // Batch process multiple players
  public batchProcessWeek(weeklyData: Array<{
    playerId: string;
    position: string;
    data: any;
  }>, week: number): void {
    console.log(`🔄 Batch processing week ${week} for ${weeklyData.length} players`);
    
    for (const playerUpdate of weeklyData) {
      this.processWeeklyUpdate(
        playerUpdate.playerId,
        playerUpdate.position,
        playerUpdate.data,
        week
      );
    }
    
    console.log(`✅ Completed batch processing for week ${week}`);
  }
}

// Export singleton instance
export const ovrEngine = new OVREngine();