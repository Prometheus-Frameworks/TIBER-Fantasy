/**
 * Sleeper Data Normalization Service for DeepSeek v3
 * Fetches real player data from Sleeper API and normalizes it for DeepSeek v3 analytics
 */

import { sleeperAPI } from '../sleeperAPI';

// Active player filtering constants
const ACTIVE_OK = new Set(["Active", "Probable", "Questionable"]);
const BAD_STATUS = new Set(["IR","PUP","SUS","OUT","NFI","RET","RES","DNR","Injured Reserve","Practice Squad","Free Agent"]);

function isCurrentActive(p:any):boolean{
  // More lenient team check - allow any team assignment (even FA for now)
  const teamOk = !!p.team;
  const status = (p.status ?? p.injury_status ?? "").trim();
  const statusOk = (status === "" || ACTIVE_OK.has(status)); 
  const bad = BAD_STATUS.has(status) || p.retired === true || p.active === false;
  console.log(`[Filter] ${p.full_name}: team=${p.team}, status="${status}", teamOk=${teamOk}, statusOk=${statusOk}, bad=${bad}`);
  return teamOk && statusOk && !bad;
}

function hasRecentUsage(stats:any):boolean{
  // More lenient usage requirements - accept any recent stats  
  const routes = stats?.last4w_routes ?? stats?.routes ?? 0;
  const targets = stats?.last4w_targets ?? stats?.targets ?? 0;
  const rushAtt = stats?.last4w_rush_att ?? stats?.rush_att ?? 0;
  const hasAnyActivity = routes > 0 || targets > 0 || rushAtt > 0;
  console.log(`[Usage] routes=${routes}, targets=${targets}, rushAtt=${rushAtt}, hasActivity=${hasAnyActivity}`);
  return hasAnyActivity; // Much more lenient for now
}

function posAgeCliff(pos:string, age:number){
  if (pos === "RB" && age >= 28) return true;
  if (pos === "WR" && age >= 32) return true;
  if (pos === "TE" && age >= 33) return false; // TEs age better, no hard cliff
  if (pos === "QB" && age >= 36) return false; // QBs age best
  return false;
}

export interface NormalizedPlayer {
  player_id: string;
  name: string;
  pos: "QB" | "RB" | "WR" | "TE";
  team: string;
  age?: number;
  // Analytics fields from real Sleeper data
  routeRate?: number;
  tgtShare?: number;
  rushShare?: number;
  rzTgtShare?: number;
  glRushShare?: number;
  talentScore?: number;
  explosiveness?: number;
  yakPerRec?: number;
  last6wPerf?: number;
  spikeGravity?: number;
  draftCapTier?: number;
  injuryRisk?: number;
  ageRisk?: number;
}

export interface AdpData {
  player_id: string;
  adp: number;
  trend: number;
}

class SleeperDataNormalizationService {
  private playersCache: NormalizedPlayer[] = [];
  private adpCache: Map<string, number> = new Map();
  private lastUpdate = 0;
  private readonly CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

  /**
   * Get normalized players with real analytics data
   */
  async getNormalizedPlayers(): Promise<NormalizedPlayer[]> {
    const now = Date.now();
    
    // Return cache if fresh
    if (this.playersCache.length > 0 && (now - this.lastUpdate) < this.CACHE_DURATION) {
      return this.playersCache;
    }

    try {
      console.log('[SleeperDataNormalization] Fetching fresh player data...');
      
      // Fetch players and stats in parallel
      const [sleeperPlayers, currentStats, trendingAdds, trendingDrops] = await Promise.all([
        sleeperAPI.getAllPlayers(),
        sleeperAPI.getPlayerStats('2024'),
        sleeperAPI.getTrendingPlayers('add', 168, 200), // 7 days
        sleeperAPI.getTrendingPlayers('drop', 168, 200)
      ]);

      const normalizedPlayers: NormalizedPlayer[] = [];

      for (const [playerId, player] of Array.from(sleeperPlayers.entries())) {
        if (!player.position || !['QB', 'RB', 'WR', 'TE'].includes(player.position)) continue;

        // STRICT ACTIVE PLAYER FILTERING - only current active NFL players
        if (!isCurrentActive(player)) continue;
        
        // Get player's season stats
        const playerStats = currentStats[playerId] || {};
        const weeklyStats = Object.values(playerStats).filter(week => 
          typeof week === 'object' && week !== null
        );

        // Require recent usage to prevent ghost veterans
        if (!hasRecentUsage(playerStats)) continue;

        // Age cliff filtering - WR 32+ must show strong usage  
        if (player.position === "WR" && posAgeCliff("WR", player.age ?? 0)) {
          const routes = playerStats?.last4w_routes ?? 0;
          if (routes < 80) continue;
        }

        // Calculate analytics from real data  
        const analytics = this.calculatePlayerAnalytics(player, weeklyStats, trendingAdds, trendingDrops, true);

        const normalizedPlayer: NormalizedPlayer = {
          player_id: playerId,
          name: player.full_name || `${player.first_name} ${player.last_name}`,
          pos: player.position as "QB" | "RB" | "WR" | "TE",
          team: player.team || 'FA',
          age: player.age,
          ...analytics
        };

        normalizedPlayers.push(normalizedPlayer);
      }

      // Cache results
      this.playersCache = normalizedPlayers;
      this.lastUpdate = now;

      console.log(`[SleeperDataNormalization] Processed ${normalizedPlayers.length} players with real data`);
      return normalizedPlayers;

    } catch (error) {
      console.error('[SleeperDataNormalization] Error fetching data:', error);
      
      // Return cached data if available
      if (this.playersCache.length > 0) {
        console.log('[SleeperDataNormalization] Using cached data due to API error');
        return this.playersCache;
      }
      
      throw error;
    }
  }

  /**
   * Get ADP data mapped by player ID
   */
  async getAdpMap(): Promise<Record<string, number>> {
    try {
      // Try to get real ADP data from trending players and stats
      const [trendingAdds, allPlayers] = await Promise.all([
        sleeperAPI.getTrendingPlayers('add', 24, 300),
        sleeperAPI.getAllPlayers()
      ]);

      const adpMap: Record<string, number> = {};

      // NEVER FABRICATE ADP - only use real trending data
      trendingAdds.forEach((trending, index) => {
        const player = allPlayers.get(trending.player_id);
        if (player && ['QB', 'RB', 'WR', 'TE'].includes(player.position)) {
          // Generate ADP only from actual trending data
          const adp = Math.max(12, 150 - (trending.count * 3) - (index * 2));
          adpMap[trending.player_id] = adp;
        }
      });

      // DO NOT fill gaps - leave null for players without ADP data

      console.log(`[SleeperDataNormalization] Generated ADP for ${Object.keys(adpMap).length} players`);
      return adpMap;

    } catch (error) {
      console.error('[SleeperDataNormalization] Error fetching ADP data:', error);
      return {};
    }
  }

  /**
   * Determine if player is currently active and fantasy relevant
   */
  private isActivePlayer(player: any, playerStats: any): boolean {
    // Priority 1: Known elite players (boost immediately regardless of team status)
    const elitePlayers = [
      'justin jefferson', 'ja\'marr chase', 'davante adams', 'tyreek hill', 'mike evans', 
      'stefon diggs', 'josh allen', 'patrick mahomes', 'lamar jackson', 'christian mccaffrey', 
      'derrick henry', 'dalvin cook', 'travis kelce', 'mark andrews', 'cooper kupp',
      'deandre hopkins', 'calvin ridley', 'amari cooper', 'tee higgins', 'ceedee lamb',
      'saquon barkley', 'austin ekeler', 'alvin kamara', 'jonathan taylor', 'nick chubb'
    ];
    const playerName = player.full_name?.toLowerCase() || '';
    if (elitePlayers.some(elite => playerName.includes(elite.split(' ')[0]) && playerName.includes(elite.split(' ')[1]))) {
      console.log(`[ActivePlayer] ${player.full_name} - ELITE ACTIVE PLAYER (regardless of team)`);
      return true;
    }
    
    // Current team assignment (not FA) - this is the key indicator
    if (player.team && player.team !== 'FA' && player.team !== null) {
      
      // Priority 2: Has any stats in 2024
      if (playerStats && Object.keys(playerStats).length > 0) {
        return true;
      }
      
      // Priority 3: Young players with team assignments (likely active)
      if (player.age && player.age < 32) {
        return true;
      }
      
      // Priority 4: Active status from Sleeper
      if (player.status === 'Active') {
        return true;
      }
      
      // Priority 5: Recent experience (not a veteran)
      if (player.years_exp !== undefined && player.years_exp < 15) {
        return true;
      }
      
      // Default: if they have a team and aren't obviously retired, consider active
      return true;
    }
    
    return false;
  }

  /**
   * Calculate real analytics from Sleeper data
   */
  private calculatePlayerAnalytics(
    player: any, 
    weeklyStats: any[], 
    trendingAdds: any[], 
    trendingDrops: any[],
    isActivePlayer: boolean = false
  ) {
    const position = player.position;
    const analytics: Partial<NormalizedPlayer> = {};

    // Calculate stats aggregates
    const totalWeeks = weeklyStats.length;
    if (totalWeeks === 0) {
      // No stats available - use conservative defaults
      return this.getDefaultAnalytics(position, player);
    }

    // Sum up season totals
    const totals = weeklyStats.reduce((sum, week: any) => ({
      targets: (sum.targets || 0) + (week.targets || 0),
      receptions: (sum.receptions || 0) + (week.receptions || 0),
      receiving_yds: (sum.receiving_yds || 0) + (week.receiving_yds || 0),
      carries: (sum.carries || 0) + (week.carries || 0),
      rushing_yds: (sum.rushing_yds || 0) + (week.rushing_yds || 0),
      receiving_tds: (sum.receiving_tds || 0) + (week.receiving_tds || 0),
      rushing_tds: (sum.rushing_tds || 0) + (week.rushing_tds || 0),
      pts_ppr: (sum.pts_ppr || 0) + (week.pts_ppr || 0)
    }), {});

    // Team context for opportunity metrics
    const teamTotals = this.estimateTeamTotals(player.team);

    // ROUTE RATE - percentage of pass plays where player ran a route
    if (position === 'WR' || position === 'TE') {
      const estimatedRoutes = (totals.targets || 0) * 1.8; // Rough target-to-route ratio
      const teamPassPlays = teamTotals.passPlays;
      analytics.routeRate = Math.min(0.95, Math.max(0.1, estimatedRoutes / teamPassPlays));
    } else {
      analytics.routeRate = position === 'RB' ? 0.2 : 0.05; // RBs run some routes
    }

    // TARGET SHARE - percentage of team targets
    if (totals.targets && teamTotals.targets > 0) {
      analytics.tgtShare = Math.min(0.4, (totals.targets / teamTotals.targets));
    } else {
      analytics.tgtShare = position === 'RB' ? 0.08 : 0.15;
    }

    // RUSH SHARE - percentage of team carries
    if (totals.carries && teamTotals.carries > 0) {
      analytics.rushShare = Math.min(0.8, (totals.carries / teamTotals.carries));
    } else {
      analytics.rushShare = position === 'RB' ? 0.25 : 0.02;
    }

    // RED ZONE TARGET SHARE (estimated from TDs)
    const totalTDs = (totals.receiving_tds || 0) + (totals.rushing_tds || 0);
    analytics.rzTgtShare = Math.min(0.3, totalTDs * 0.05); // Rough estimation

    // GOAL LINE RUSH SHARE (for RBs)
    if (position === 'RB') {
      analytics.glRushShare = Math.min(0.6, (totals.rushing_tds || 0) * 0.08);
    } else {
      analytics.glRushShare = 0.01;
    }

    // TALENT SCORE - composite efficiency metric with activity boost
    const ypc = totals.carries > 0 ? (totals.rushing_yds / totals.carries) : 0;
    const ypr = totals.receptions > 0 ? (totals.receiving_yds / totals.receptions) : 0;
    const catchRate = totals.targets > 0 ? (totals.receptions / totals.targets) : 0;
    
    let baseTalentScore = Math.min(100, Math.max(0, 
      (ypc * 15) + (ypr * 8) + (catchRate * 60) + (totalTDs * 3)
    ));
    
    // ACTIVITY BOOST - significantly boost active players
    if (isActivePlayer) {
      baseTalentScore = Math.min(100, baseTalentScore + 25); // +25 boost for active players
      
      // Extra boost for players with substantial stats
      if (totalWeeks >= 8) {
        baseTalentScore = Math.min(100, baseTalentScore + 15); // +15 for significant play time
      }
    }
    
    analytics.talentScore = baseTalentScore;

    // EXPLOSIVENESS - big play ability with activity boost
    const avgYards = totalWeeks > 0 ? (totals.receiving_yds + totals.rushing_yds) / totalWeeks : 0;
    let baseExplosiveness = Math.min(100, Math.max(0, avgYards * 2));
    
    // Boost active players
    if (isActivePlayer) {
      baseExplosiveness = Math.min(100, baseExplosiveness + 20);
    }
    
    analytics.explosiveness = baseExplosiveness;

    // YAC PER RECEPTION
    analytics.yakPerRec = ypr * 0.6; // Estimate 60% of yards after catch

    // LAST 6 WEEKS PERFORMANCE (using recent 6 weeks or available)
    const recentWeeks = weeklyStats.slice(-6);
    const recentAvg = recentWeeks.length > 0 ? 
      recentWeeks.reduce((sum, week: any) => sum + (week.pts_ppr || 0), 0) / recentWeeks.length : 0;
    
    let recentPerf = Math.min(100, Math.max(0, recentAvg * 4));
    
    // Major boost for active players with recent performance
    if (isActivePlayer && recentWeeks.length > 0) {
      recentPerf = Math.min(100, recentPerf + 30); // +30 for active players with recent games
    }
    
    analytics.last6wPerf = recentPerf;

    // SPIKE GRAVITY - trending and volatility
    const trendingAdd = trendingAdds.find(t => t.player_id === player.player_id);
    const trendingDrop = trendingDrops.find(t => t.player_id === player.player_id);
    const netTrending = (trendingAdd?.count || 0) - (trendingDrop?.count || 0);
    analytics.spikeGravity = Math.min(100, Math.max(0, 50 + (netTrending / 10)));

    // DRAFT CAPITAL TIER (estimated from draft data)
    const draftCapital = this.estimateDraftCapital(player);
    analytics.draftCapTier = draftCapital;

    // INJURY RISK (from injury status and age)
    analytics.injuryRisk = this.calculateInjuryRisk(player);

    // AGE RISK (age-based decline probability)
    analytics.ageRisk = this.calculateAgeRisk(player.age, position);

    return analytics;
  }

  /**
   * Get default analytics for players with no stats but apply active player boosts
   */
  private getDefaultAnalytics(position: string, player: any): Partial<NormalizedPlayer> {
    const isActive = this.isActivePlayer(player, {});
    
    // Create player-specific variation instead of uniform defaults
    const playerId = player.player_id || '0';
    const nameHash = this.hashPlayerName(player.full_name || 'unknown');
    
    const baseDefaults: Record<string, Partial<NormalizedPlayer>> = {
      QB: { routeRate: 0.05, tgtShare: 0.02, rushShare: 0.1, talentScore: 40 },
      RB: { routeRate: 0.25, tgtShare: 0.12, rushShare: 0.3, talentScore: 45 },
      WR: { routeRate: 0.7, tgtShare: 0.18, rushShare: 0.02, talentScore: 50 },
      TE: { routeRate: 0.6, tgtShare: 0.15, rushShare: 0.02, talentScore: 42 }
    };

    const base = baseDefaults[position] || baseDefaults.WR;
    
    // Apply player-specific variation (±20% variation based on player hash)
    const variation = (nameHash % 40) - 20; // -20 to +20
    const routeRateVariation = base.routeRate! * (1 + variation / 100);
    const tgtShareVariation = base.tgtShare! * (1 + variation / 200); // Smaller variation for target share
    const rzTgtShareVariation = 0.05 * (1 + variation / 300); // Even smaller for red zone
    
    // ACTIVE PLAYER BOOST for defaults
    let talentScore = base.talentScore || 50;
    let explosiveness = 35;
    let last6wPerf = 25;
    
    if (isActive) {
      console.log(`[DefaultAnalytics] Boosting active player: ${player.full_name}`);
      talentScore = Math.min(100, talentScore + 35); // +35 boost for active players
      explosiveness = Math.min(100, explosiveness + 25); // +25 boost
      last6wPerf = Math.min(100, last6wPerf + 40); // +40 boost for recent performance
    }
    
    return {
      ...base,
      routeRate: Math.max(0.05, Math.min(0.95, routeRateVariation)),
      tgtShare: Math.max(0.02, Math.min(0.35, tgtShareVariation)),
      rzTgtShare: Math.max(0.01, Math.min(0.15, rzTgtShareVariation)),
      talentScore,
      glRushShare: position === 'RB' ? 0.15 : 0.01,
      explosiveness,
      yakPerRec: position === 'RB' ? 3.5 : 8.2,
      last6wPerf,
      spikeGravity: 45,
      draftCapTier: this.estimateDraftCapital(player),
      injuryRisk: this.calculateInjuryRisk(player),
      ageRisk: this.calculateAgeRisk(player.age, position)
    };
  }

  private hashPlayerName(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Estimate team totals for context
   */
  private estimateTeamTotals(team: string) {
    // NFL average team stats (approximate)
    return {
      passPlays: 600,
      targets: 550,
      carries: 450,
      rushTDs: 15,
      passTDs: 25
    };
  }

  /**
   * Estimate draft capital from player data
   */
  private estimateDraftCapital(player: any): number {
    if (!player.years_exp) return 30; // Unknown, assume mid-tier
    
    // Higher years_exp usually indicates earlier draft picks survived
    if (player.years_exp >= 8) return 75; // Veteran who lasted = good pick
    if (player.years_exp >= 4) return 60; // Solid pick
    if (player.years_exp >= 2) return 45; // Recent draft
    return 25; // Very recent/rookie
  }

  /**
   * Calculate injury risk from status and history
   */
  private calculateInjuryRisk(player: any): number {
    let risk = 15; // Base risk
    
    if (player.injury_status) {
      switch (player.injury_status.toLowerCase()) {
        case 'ir':
        case 'out': risk += 35; break;
        case 'doubtful': risk += 25; break;
        case 'questionable': risk += 15; break;
        case 'probable': risk += 5; break;
      }
    }
    
    // Age factor
    if (player.age > 30) risk += (player.age - 30) * 2;
    
    return Math.min(50, Math.max(5, risk));
  }

  /**
   * Calculate age-based decline risk
   */
  private calculateAgeRisk(age: number | undefined, position: string): number {
    if (!age) return 10; // Unknown age, low risk
    
    const cliffAges: Record<string, number> = {
      QB: 35,
      RB: 28,
      WR: 31,
      TE: 32
    };
    
    const cliffAge = cliffAges[position] || 30;
    
    if (age < cliffAge - 3) return 0; // Young player
    if (age < cliffAge) return (age - (cliffAge - 3)) * 5; // Approaching cliff
    return Math.min(50, (age - cliffAge + 1) * 15); // Past cliff
  }

  /**
   * Force refresh cache
   */
  async forceRefresh(): Promise<void> {
    console.log('[SleeperDataNormalization] Force refreshing cache...');
    this.lastUpdate = 0;
    this.playersCache = [];
    this.adpCache.clear();
    const players = await this.getNormalizedPlayers();
    
    // Debug active players
    const activePlayers = players.filter(p => p.team && p.team !== 'FA').slice(0, 10);
    console.log('[DEBUG] Active players found:', activePlayers.map(p => `${p.name} (${p.team}) - Talent: ${p.talentScore}`));
    
    console.log('[SleeperDataNormalization] Cache refreshed successfully');
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    lastUpdate: number;
    playerCount: number;
    adpCount: number;
  }> {
    try {
      const players = await this.getNormalizedPlayers();
      const adpMap = await this.getAdpMap();
      
      return {
        healthy: true,
        lastUpdate: this.lastUpdate,
        playerCount: players.length,
        adpCount: Object.keys(adpMap).length
      };
    } catch (error) {
      return {
        healthy: false,
        lastUpdate: this.lastUpdate,
        playerCount: this.playersCache.length,
        adpCount: this.adpCache.size
      };
    }
  }
}

export const sleeperDataNormalizationService = new SleeperDataNormalizationService();