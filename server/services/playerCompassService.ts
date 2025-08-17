// Enhanced Player Compass Service - Dynasty vs Redraft Separation
// Tiber's in-house ratings engine with format-specific evaluations

export interface CompassScore {
  score: number;
  tier: string;
  north: number; // Volume/Talent
  east: number;  // Environment/Scheme  
  south: number; // Risk/Durability
  west: number;  // Value/Dynasty (dynasty) or Value/Immediate (redraft)
  insights: string[];
  format: 'dynasty' | 'redraft';
}

export interface PlayerCompassData {
  playerId: string;
  playerName: string;
  position: string;
  age: number;
  team: string;
  rawStats?: any;
  contextTags?: string[];
  draftCapital?: number;
  experience?: number;
}

export class PlayerCompassService {
  
  // Main entry point - routes to dynasty or redraft calculation
  async calculateCompass(playerData: PlayerCompassData, format: 'dynasty' | 'redraft'): Promise<CompassScore> {
    if (format === 'dynasty') {
      return this.calculateDynastyCompass(playerData);
    } else {
      return this.calculateRedraftCompass(playerData);
    }
  }

  // ===== DYNASTY COMPASS CALCULATION =====
  private async calculateDynastyCompass(playerData: PlayerCompassData): Promise<CompassScore> {
    const { position, age, rawStats, contextTags, draftCapital } = playerData;
    
    let north = 5.0; // Volume/Talent baseline
    let east = 5.0;  // Environment/Scheme baseline  
    let south = 5.0; // Risk/Durability baseline
    let west = 5.0;  // Dynasty Value baseline

    const insights: string[] = [];

    // Position-specific dynasty calculations
    switch (position) {
      case 'WR':
        ({ north, east, south, west } = this.calculateWRDynastyScores(age, rawStats, contextTags, draftCapital));
        break;
      case 'RB': 
        ({ north, east, south, west } = this.calculateRBDynastyScores(age, rawStats, contextTags, draftCapital));
        break;
      case 'TE':
        ({ north, east, south, west } = this.calculateTEDynastyScores(age, rawStats, contextTags, draftCapital));
        break;
      case 'QB':
        ({ north, east, south, west } = this.calculateQBDynastyScores(age, rawStats, contextTags, draftCapital));
        break;
    }

    // Dynasty-specific insights
    if (age && age <= 24) insights.push("Prime dynasty asset - peak years ahead");
    if (age && age >= 29) insights.push("Dynasty risk - aging curve concerns");
    if (draftCapital && draftCapital <= 64) insights.push("High draft capital validates talent");

    const finalScore = this.calculateFinalScore(north, east, south, west);
    const tier = this.getDynastyTier(finalScore, age, position);

    return {
      score: finalScore,
      tier,
      north: this.clampScore(north),
      east: this.clampScore(east), 
      south: this.clampScore(south),
      west: this.clampScore(west),
      insights,
      format: 'dynasty'
    };
  }

  // ===== REDRAFT COMPASS CALCULATION =====
  private async calculateRedraftCompass(playerData: PlayerCompassData): Promise<CompassScore> {
    const { position, age, rawStats, contextTags, team } = playerData;
    
    let north = 5.0; // Volume/Talent baseline
    let east = 5.0;  // Environment/Scheme baseline
    let south = 5.0; // Risk/Durability baseline  
    let west = 5.0;  // Current Season Value baseline

    const insights: string[] = [];

    // Position-specific redraft calculations
    switch (position) {
      case 'WR':
        ({ north, east, south, west } = this.calculateWRRedraftScores(age, rawStats, contextTags, team));
        break;
      case 'RB':
        ({ north, east, south, west } = this.calculateRBRedraftScores(age, rawStats, contextTags, team));
        break;
      case 'TE':
        ({ north, east, south, west } = this.calculateTERedraftScores(age, rawStats, contextTags, team));
        break;
      case 'QB':
        ({ north, east, south, west } = this.calculateQBRedraftScores(age, rawStats, contextTags, team));
        break;
    }

    // Redraft-specific insights
    if (rawStats?.targets > 120) insights.push("High-volume target leader");
    if (rawStats?.redZoneTargets > 15) insights.push("Premium red zone role");
    if (team && ['KC', 'BUF', 'BAL'].includes(team)) insights.push("Elite offensive environment");

    const finalScore = this.calculateFinalScore(north, east, south, west);
    const tier = this.getRedraftTier(finalScore, position);

    return {
      score: finalScore,
      tier,
      north: this.clampScore(north),
      east: this.clampScore(east),
      south: this.clampScore(south), 
      west: this.clampScore(west),
      insights,
      format: 'redraft'
    };
  }

  // ===== WR DYNASTY CALCULATIONS =====
  private calculateWRDynastyScores(age: number, rawStats: any, contextTags?: string[], draftCapital?: number) {
    const tags = contextTags || [];
    // Dynasty emphasizes: age curve, draft capital, long-term role security
    
    // NORTH: Volume/Talent (targets + efficiency + ceiling)
    let north = 5.0;
    if (rawStats?.targets) {
      north = Math.min(10, 3 + (rawStats.targets / 20)); // 100+ targets = ~8 score
    }
    if (rawStats?.yardsPerTarget > 12) north += 1.0; // Efficiency bonus
    if (draftCapital && draftCapital <= 32) north += 1.5; // First round talent

    // EAST: Environment (team context, QB, scheme fit)
    let east = 5.0;
    tags.forEach(tag => {
      if (tag.includes('alpha') || tag.includes('wr1')) east += 1.5;
      if (tag.includes('target_hog')) east += 1.0;
      if (tag.includes('crowded') || tag.includes('committee')) east -= 1.0;
    });

    // SOUTH: Risk/Durability (AGE IS CRITICAL FOR DYNASTY)
    let south = 5.0;
    if (age <= 23) south = 8.5; // Prime dynasty age
    else if (age <= 25) south = 7.5; // Still very good
    else if (age <= 27) south = 6.0; // Starting decline
    else if (age <= 30) south = 4.0; // High risk
    else south = 2.0; // Very high risk

    // WEST: Dynasty Value (long-term outlook, not current ADP)
    let west = 5.0;
    if (age <= 24 && draftCapital && draftCapital <= 64) west = 9.0; // Young + capital
    else if (age <= 26 && rawStats?.targets > 100) west = 7.5; // Established production
    else if (age >= 29) west = Math.max(2.0, west - 2.0); // Age penalty

    return { north, east, south, west };
  }

  // ===== WR REDRAFT CALCULATIONS =====
  private calculateWRRedraftScores(age: number, rawStats: any, contextTags?: string[], team?: string) {
    const tags = contextTags || [];
    // Redraft emphasizes: current opportunity, immediate production, matchups
    
    // NORTH: Current Volume/Talent 
    let north = 5.0;
    if (rawStats?.targets) {
      north = Math.min(10, 2 + (rawStats.targets / 15)); // More immediate focus
    }
    if (rawStats?.redZoneTargets > 10) north += 1.5; // TD upside critical for redraft

    // EAST: Current Environment (2024 specific factors)
    let east = 5.0;
    const eliteOffenses = ['KC', 'BUF', 'MIA', 'SF', 'DAL'];
    if (team && eliteOffenses.includes(team)) east += 1.5;
    
    tags.forEach(tag => {
      if (tag.includes('alpha') || tag.includes('wr1')) east += 1.0;
      if (tag.includes('redzone')) east += 1.0; // TD environment
    });

    // SOUTH: Current Season Risk (injury, role changes)
    let south = 5.0;
    if (age <= 27) south += 1.0; // Lower injury risk
    else if (age >= 32) south -= 2.0; // Higher injury risk
    
    // WEST: 2024 Value/ADP efficiency (what can I get him for?)
    let west = 5.0;
    if (rawStats?.adp && rawStats?.projectedPoints) {
      const efficiency = rawStats.projectedPoints / rawStats.adp;
      if (efficiency > 5) west += 2.0; // Great value
      else if (efficiency < 2) west -= 1.0; // Expensive
    }

    return { north, east, south, west };
  }

  // ===== RB DYNASTY CALCULATIONS =====
  private calculateRBDynastyScores(age: number, rawStats: any, contextTags?: string[], draftCapital?: number) {
    const tags = contextTags || [];
    // RBs age faster - dynasty calculation heavily weighted toward youth
    
    let north = 5.0;
    if (rawStats?.touches) {
      north = Math.min(10, 3 + (rawStats.touches / 30));
    }
    if (rawStats?.yardsAfterContact > 3.5) north += 1.0;

    let east = 5.0;
    tags.forEach(tag => {
      if (tag.includes('bellcow') || tag.includes('rb1')) east += 2.0;
      if (tag.includes('committee')) east -= 1.5;
    });

    // CRITICAL: RB age cliff for dynasty
    let south = 5.0;
    if (age <= 24) south = 9.0; // Peak dynasty value
    else if (age <= 26) south = 7.0; // Still valuable
    else if (age <= 28) south = 4.0; // Declining fast
    else south = 2.0; // Avoid in dynasty

    let west = 5.0;
    if (age <= 25 && draftCapital && draftCapital <= 100) west = 8.5;
    else if (age >= 27) west = Math.max(1.0, west - 3.0);

    return { north, east, south, west };
  }

  // ===== RB REDRAFT CALCULATIONS =====
  private calculateRBRedraftScores(age: number, rawStats: any, contextTags?: string[], team?: string) {
    const tags = contextTags || [];
    // Redraft RB: all about current workload and TD opportunity
    
    let north = 5.0;
    if (rawStats?.carries > 200) north += 2.0;
    if (rawStats?.targets > 40) north += 1.5; // PPR value

    let east = 5.0;
    const strongRunningTeams = ['BAL', 'SF', 'PHI', 'DET'];
    if (team && strongRunningTeams.includes(team)) east += 1.5;

    // Age matters less in redraft
    let south = 6.0; // Base higher for redraft
    if (age >= 30) south -= 1.0; // Some penalty for very old

    let west = 5.0;
    if (rawStats?.redZoneTouches > 15) west += 2.0; // TD equity

    return { north, east, south, west };
  }

  // ===== UTILITY METHODS =====
  private calculateFinalScore(north: number, east: number, south: number, west: number): number {
    // Weighted average with slight emphasis on volume/talent
    const weightedScore = (north * 0.3) + (east * 0.25) + (south * 0.25) + (west * 0.2);
    return Math.round(weightedScore * 10) / 10;
  }

  private clampScore(score: number): number {
    return Math.max(1.0, Math.min(10.0, Math.round(score * 10) / 10));
  }

  private getDynastyTier(score: number, age: number, position: string): string {
    // Dynasty tiers emphasize long-term value
    if (score >= 8.5) return 'Elite Dynasty Asset';
    if (score >= 7.5) return 'High-End Dynasty';
    if (score >= 6.5) return 'Solid Dynasty Hold';
    if (score >= 5.5) return 'Dynasty Depth';
    if (score >= 4.0) return 'Dynasty Risk';
    return 'Dynasty Avoid';
  }

  private getRedraftTier(score: number, position: string): string {
    // Redraft tiers focus on immediate production
    if (score >= 8.5) return 'Must-Start';
    if (score >= 7.5) return 'Strong Start';
    if (score >= 6.5) return 'Solid Starter';
    if (score >= 5.5) return 'Flex Option';
    if (score >= 4.0) return 'Bench Depth';
    return 'Waiver Wire';
  }

  // Placeholder methods for TE and QB (can be expanded)
  private calculateTEDynastyScores(age: number, rawStats: any, contextTags?: string[], draftCapital?: number) {
    return { north: 5.0, east: 5.0, south: 5.0, west: 5.0 };
  }

  private calculateTERedraftScores(age: number, rawStats: any, contextTags?: string[], team?: string) {
    return { north: 5.0, east: 5.0, south: 5.0, west: 5.0 };
  }

  private calculateQBDynastyScores(age: number, rawStats: any, contextTags?: string[], draftCapital?: number) {
    return { north: 5.0, east: 5.0, south: 5.0, west: 5.0 };
  }

  private calculateQBRedraftScores(age: number, rawStats: any, contextTags?: string[], team?: string) {
    return { north: 5.0, east: 5.0, south: 5.0, west: 5.0 };
  }
}

export const playerCompassService = new PlayerCompassService();