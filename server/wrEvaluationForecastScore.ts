/**
 * WR Evaluation & Forecast Score (v1.1)
 * Forward-looking dynasty WR evaluation using 4-component scoring system
 * Focus: Dynasty forecasting with predictive metrics rather than descriptive analysis
 */

export interface WRPlayerInput {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  season: number;
  
  // Usage Profile metrics
  tpRR: number; // Targets Per Route Run
  routeParticipation: number; // % of team's routes run
  firstReadTargetPct: number; // % of targets as first read
  teamPassAttemptsPerGame: number;
  wrRoomTargetCompetition: number; // Competition score 0-100
  airYardShare: number; // % of team's air yards
  
  // Efficiency metrics  
  ypRR: number; // Yards Per Route Run
  oneDRR: number; // First Downs Per Route Run
  dropRate: number; // Drop percentage
  explosivePlayRate: number; // 20+ yard receptions per target
  routeWinRate: number; // % routes with separation
  yacPerReception: number; // Yards After Catch per reception
  
  // Role Security factors
  age: number;
  draftCapital: 'R1' | 'R2' | 'R3' | 'R4+' | 'UDFA';
  slotRate: number; // % of snaps in slot
  contractYearsRemaining?: number;
  injuryHistory?: 'clean' | 'minor' | 'concerning' | 'major';
  redZoneTargetShare?: number;
  
  // Growth Trajectory data
  qbStabilityScore: number; // 0-100 QB environment stability
  previousSeasons?: {
    season: number;
    ypRR: number;
    tpRR: number;
    targetShare: number;
    firstReadTargetPct: number;
    fantasyPointsPerGame: number;
  }[];
  offseasonChanges?: {
    newQB?: boolean;
    newOC?: boolean;
    wrAdditions?: boolean;
    schemeChange?: boolean;
  };
}

export interface WREvaluationResult {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  contextScore: number;
  forecastGrade: 'ELITE' | 'STRONG' | 'SOLID' | 'CONCERNING' | 'AVOID';
  componentScores: {
    usageProfile: number;
    efficiency: number;
    roleSecurity: number;
    growthTrajectory: number;
  };
  forecastTags: string[];
  logs: string[];
  riskFactors: string[];
  upside: string[];
  lastEvaluatedSeason: number;
  timestamp: Date;
}

export class WREvaluationForecastService {
  private readonly version = "1.1";
  private readonly name = "WR Evaluation & Forecast Score";
  
  // Optimized weights for dynasty forecasting
  private readonly weights = {
    usageProfile: 0.35,    // Most predictive for fantasy success
    efficiency: 0.25,      // Quality of usage matters
    roleSecurity: 0.25,    // Dynasty stability factor
    growthTrajectory: 0.15 // Forward-looking component
  };

  /**
   * Evaluate WR with forward-looking dynasty focus
   */
  evaluateWR(input: WRPlayerInput): WREvaluationResult {
    const logs: string[] = [];
    const forecastTags: string[] = [];
    const riskFactors: string[] = [];
    const upside: string[] = [];
    
    // Validate inputs
    if (!input || input.position !== 'WR') {
      logs.push("Invalid input or non-WR player");
      return this.createResult(input, 0, {
        usageProfile: 0,
        efficiency: 0,
        roleSecurity: 0,
        growthTrajectory: 0
      }, forecastTags, logs, riskFactors, upside, 'AVOID');
    }

    logs.push(`🔍 Evaluating WR forecast for ${input.playerName} (${input.team}) - ${input.season} season`);

    // Component 1: Usage Profile (35% weight) - Most predictive
    const usageProfile = this.evaluateUsageProfile(input, logs, forecastTags, riskFactors, upside);
    
    // Component 2: Efficiency (25% weight) - Quality matters
    const efficiency = this.evaluateEfficiency(input, logs, forecastTags, riskFactors, upside);
    
    // Component 3: Role Security (25% weight) - Dynasty stability
    const roleSecurity = this.evaluateRoleSecurity(input, logs, forecastTags, riskFactors, upside);
    
    // Component 4: Growth Trajectory (15% weight) - Forward-looking
    const growthTrajectory = this.evaluateGrowthTrajectory(input, logs, forecastTags, riskFactors, upside);

    const componentScores = {
      usageProfile: usageProfile.score,
      efficiency: efficiency.score,
      roleSecurity: roleSecurity.score,
      growthTrajectory: growthTrajectory.score
    };

    // Calculate weighted context score
    const contextScore = 
      (usageProfile.score * this.weights.usageProfile) +
      (efficiency.score * this.weights.efficiency) +
      (roleSecurity.score * this.weights.roleSecurity) +
      (growthTrajectory.score * this.weights.growthTrajectory);

    // Determine forecast grade
    const forecastGrade = this.determineForecastGrade(contextScore, componentScores, riskFactors);
    
    logs.push(`📊 Final context score: ${contextScore.toFixed(1)} (${forecastGrade} forecast)`);

    return this.createResult(
      input, 
      contextScore, 
      componentScores, 
      forecastTags, 
      logs, 
      riskFactors, 
      upside, 
      forecastGrade
    );
  }

  /**
   * Usage Profile: Most predictive component for fantasy success
   */
  private evaluateUsageProfile(
    input: WRPlayerInput,
    logs: string[],
    tags: string[],
    risks: string[],
    upside: string[]
  ): { score: number } {
    let score = 50; // Base score
    const metrics: string[] = [];

    // TPRR - Most predictive metric (0.817 correlation)
    if (input.tpRR >= 0.25) {
      score += 25;
      metrics.push(`Elite TPRR (${(input.tpRR * 100).toFixed(1)}%)`);
      tags.push("Alpha Usage");
      upside.push("Elite target earning ability");
    } else if (input.tpRR >= 0.20) {
      score += 15;
      metrics.push(`Strong TPRR (${(input.tpRR * 100).toFixed(1)}%)`);
      tags.push("Strong Usage");
    } else if (input.tpRR >= 0.15) {
      score += 5;
      metrics.push(`Average TPRR (${(input.tpRR * 100).toFixed(1)}%)`);
    } else {
      score -= 20;
      metrics.push(`Low TPRR (${(input.tpRR * 100).toFixed(1)}%)`);
      risks.push("Low target earning rate");
      tags.push("Usage Risk");
    }

    // Route Participation - Opportunity foundation
    if (input.routeParticipation >= 0.90) {
      score += 15;
      metrics.push(`Elite route participation (${(input.routeParticipation * 100).toFixed(0)}%)`);
      upside.push("Always on field");
    } else if (input.routeParticipation >= 0.80) {
      score += 8;
      metrics.push(`Strong route participation (${(input.routeParticipation * 100).toFixed(0)}%)`);
    } else if (input.routeParticipation < 0.70) {
      score -= 15;
      metrics.push(`Limited route participation (${(input.routeParticipation * 100).toFixed(0)}%)`);
      risks.push("Limited snap share");
    }

    // First Read Target % - QB trust indicator
    if (input.firstReadTargetPct >= 0.30) {
      score += 20;
      metrics.push(`High first read % (${(input.firstReadTargetPct * 100).toFixed(0)}%)`);
      tags.push("QB's Favorite");
      upside.push("Primary read in offense");
    } else if (input.firstReadTargetPct >= 0.20) {
      score += 10;
      metrics.push(`Good first read % (${(input.firstReadTargetPct * 100).toFixed(0)}%)`);
    } else if (input.firstReadTargetPct < 0.15) {
      score -= 10;
      metrics.push(`Low first read % (${(input.firstReadTargetPct * 100).toFixed(0)}%)`);
      risks.push("Not a primary read");
    }

    // Air Yard Share - Downfield involvement
    if (input.airYardShare >= 0.35) {
      score += 15;
      metrics.push(`High air yard share (${(input.airYardShare * 100).toFixed(0)}%)`);
      tags.push("Downfield Threat");
      upside.push("Big play upside");
    } else if (input.airYardShare < 0.20) {
      score -= 5;
      metrics.push(`Low air yard share (${(input.airYardShare * 100).toFixed(0)}%)`);
    }

    // Team Pass Volume Context
    if (input.teamPassAttemptsPerGame >= 36) {
      score += 10;
      metrics.push(`High-volume passing offense (${input.teamPassAttemptsPerGame.toFixed(0)} att/gm)`);
      upside.push("High-volume environment");
    } else if (input.teamPassAttemptsPerGame < 30) {
      score -= 10;
      metrics.push(`Low-volume passing offense (${input.teamPassAttemptsPerGame.toFixed(0)} att/gm)`);
      risks.push("Limited offensive volume");
    }

    // WR Room Competition
    if (input.wrRoomTargetCompetition <= 30) {
      score += 10;
      metrics.push(`Low WR room competition`);
      upside.push("Clear path to targets");
    } else if (input.wrRoomTargetCompetition >= 70) {
      score -= 15;
      metrics.push(`High WR room competition`);
      risks.push("Target competition concerns");
      tags.push("Competition Risk");
    }

    logs.push(`Usage Profile: ${score}/100 - ${metrics.join(", ")}`);
    return { score: Math.max(0, Math.min(100, score)) };
  }

  /**
   * Efficiency: Quality of usage when targeted
   */
  private evaluateEfficiency(
    input: WRPlayerInput,
    logs: string[],
    tags: string[],
    risks: string[],
    upside: string[]
  ): { score: number } {
    let score = 50; // Base score
    const metrics: string[] = [];

    // YPRR - Elite efficiency threshold
    if (input.ypRR >= 2.2) {
      score += 25;
      metrics.push(`Elite YPRR (${input.ypRR.toFixed(1)})`);
      tags.push("Efficiency Elite");
      upside.push("Elite yards per opportunity");
    } else if (input.ypRR >= 1.8) {
      score += 15;
      metrics.push(`Strong YPRR (${input.ypRR.toFixed(1)})`);
      tags.push("Efficient Producer");
    } else if (input.ypRR >= 1.5) {
      score += 5;
      metrics.push(`Average YPRR (${input.ypRR.toFixed(1)})`);
    } else {
      score -= 15;
      metrics.push(`Poor YPRR (${input.ypRR.toFixed(1)})`);
      risks.push("Inefficient usage");
      tags.push("Efficiency Risk");
    }

    // First Downs Per Route Run - Chain moving ability
    if (input.oneDRR >= 0.10) {
      score += 15;
      metrics.push(`Elite first down rate (${(input.oneDRR * 100).toFixed(1)}%)`);
      tags.push("Chain Mover");
      upside.push("Reliable first down producer");
    } else if (input.oneDRR >= 0.07) {
      score += 8;
      metrics.push(`Good first down rate (${(input.oneDRR * 100).toFixed(1)}%)`);
    } else if (input.oneDRR < 0.05) {
      score -= 10;
      metrics.push(`Poor first down rate (${(input.oneDRR * 100).toFixed(1)}%)`);
      risks.push("Limited chain-moving ability");
    }

    // Route Win Rate - Separation ability
    if (input.routeWinRate >= 50.0) {
      score += 15;
      metrics.push(`Elite route winning (${input.routeWinRate.toFixed(0)}%)`);
      tags.push("Separation Artist");
      upside.push("Consistent separation ability");
    } else if (input.routeWinRate >= 40.0) {
      score += 8;
      metrics.push(`Good route winning (${input.routeWinRate.toFixed(0)}%)`);
    } else if (input.routeWinRate < 35.0) {
      score -= 10;
      metrics.push(`Poor route winning (${input.routeWinRate.toFixed(0)}%)`);
      risks.push("Separation concerns");
    }

    // Explosive Play Rate - Big play ability
    if (input.explosivePlayRate >= 20.0) {
      score += 15;
      metrics.push(`Elite explosive rate (${input.explosivePlayRate.toFixed(0)}%)`);
      tags.push("Explosive Threat");
      upside.push("Consistent big play ability");
    } else if (input.explosivePlayRate >= 15.0) {
      score += 8;
      metrics.push(`Good explosive rate (${input.explosivePlayRate.toFixed(0)}%)`);
    } else if (input.explosivePlayRate < 10.0) {
      score -= 5;
      metrics.push(`Low explosive rate (${input.explosivePlayRate.toFixed(0)}%)`);
    }

    // YAC per Reception - After-catch ability
    if (input.yacPerReception >= 6.0) {
      score += 10;
      metrics.push(`Elite YAC ability (${input.yacPerReception.toFixed(1)})`);
      tags.push("YAC Monster");
      upside.push("Elite after-catch ability");
    } else if (input.yacPerReception >= 4.5) {
      score += 5;
      metrics.push(`Good YAC ability (${input.yacPerReception.toFixed(1)})`);
    }

    // Drop Rate - Reliability concern
    if (input.dropRate <= 3.0) {
      score += 10;
      metrics.push(`Reliable hands (${input.dropRate.toFixed(1)}% drops)`);
      upside.push("Reliable target");
    } else if (input.dropRate >= 7.0) {
      score -= 15;
      metrics.push(`Drop concerns (${input.dropRate.toFixed(1)}% drops)`);
      risks.push("Ball security issues");
      tags.push("Drop Risk");
    } else if (input.dropRate >= 5.0) {
      score -= 5;
      metrics.push(`Average hands (${input.dropRate.toFixed(1)}% drops)`);
    }

    logs.push(`Efficiency: ${score}/100 - ${metrics.join(", ")}`);
    return { score: Math.max(0, Math.min(100, score)) };
  }

  /**
   * Role Security: Dynasty stability factors
   */
  private evaluateRoleSecurity(
    input: WRPlayerInput,
    logs: string[],
    tags: string[],
    risks: string[],
    upside: string[]
  ): { score: number } {
    let score = 50; // Base score
    const metrics: string[] = [];

    // Draft Capital - Team investment
    switch (input.draftCapital) {
      case 'R1':
        score += 25;
        metrics.push("Round 1 draft capital");
        tags.push("High Investment");
        upside.push("Team committed to development");
        break;
      case 'R2':
        score += 20;
        metrics.push("Round 2 draft capital");
        tags.push("Strong Investment");
        break;
      case 'R3':
        score += 10;
        metrics.push("Day 2 draft capital");
        break;
      case 'R4+':
        score -= 5;
        metrics.push("Late round draft capital");
        break;
      case 'UDFA':
        score -= 15;
        metrics.push("Undrafted free agent");
        risks.push("Limited team investment");
        tags.push("Investment Risk");
        break;
    }

    // Age Factor - Dynasty timeline
    if (input.age <= 23) {
      score += 20;
      metrics.push(`Prime dynasty age (${input.age})`);
      tags.push("Prime Age");
      upside.push("Long dynasty window");
    } else if (input.age <= 26) {
      score += 10;
      metrics.push(`Good dynasty age (${input.age})`);
    } else if (input.age <= 29) {
      score += 0;
      metrics.push(`Aging but productive (${input.age})`);
    } else if (input.age >= 30) {
      score -= 15;
      metrics.push(`Dynasty age concern (${input.age})`);
      risks.push("Age-related decline risk");
      tags.push("Age Risk");
    }

    // Slot vs Outside Alignment - Role versatility
    if (input.slotRate >= 70.0) {
      score += 5;
      metrics.push(`Primary slot role (${input.slotRate.toFixed(0)}%)`);
      tags.push("Slot Specialist");
      upside.push("Slot safety net value");
    } else if (input.slotRate <= 30.0) {
      score += 10;
      metrics.push(`Outside receiver role (${input.slotRate.toFixed(0)}% slot)`);
      tags.push("Outside Threat");
      upside.push("Downfield alpha potential");
    } else {
      score += 8;
      metrics.push(`Versatile alignment (${input.slotRate.toFixed(0)}% slot)`);
      tags.push("Alignment Versatile");
      upside.push("Scheme flexibility");
    }

    // Contract Years Remaining
    if (input.contractYearsRemaining !== undefined) {
      if (input.contractYearsRemaining >= 3) {
        score += 10;
        metrics.push(`Secure contract (${input.contractYearsRemaining} years)`);
        upside.push("Contract security");
      } else if (input.contractYearsRemaining <= 1) {
        score -= 10;
        metrics.push(`Contract year risk (${input.contractYearsRemaining} year)`);
        risks.push("Contract uncertainty");
        tags.push("Contract Risk");
      }
    }

    // Injury History
    if (input.injuryHistory) {
      switch (input.injuryHistory) {
        case 'clean':
          score += 10;
          metrics.push("Clean injury history");
          upside.push("Durability track record");
          break;
        case 'minor':
          score += 0;
          metrics.push("Minor injury history");
          break;
        case 'concerning':
          score -= 10;
          metrics.push("Concerning injury history");
          risks.push("Injury pattern concerns");
          tags.push("Injury Risk");
          break;
        case 'major':
          score -= 20;
          metrics.push("Major injury history");
          risks.push("Significant injury risk");
          tags.push("Major Injury Risk");
          break;
      }
    }

    // Red Zone Role
    if (input.redZoneTargetShare !== undefined) {
      if (input.redZoneTargetShare >= 25.0) {
        score += 10;
        metrics.push(`Strong RZ role (${input.redZoneTargetShare.toFixed(0)}%)`);
        tags.push("RZ Threat");
        upside.push("Red zone touchdown upside");
      } else if (input.redZoneTargetShare < 10.0) {
        score -= 5;
        metrics.push(`Limited RZ role (${input.redZoneTargetShare.toFixed(0)}%)`);
      }
    }

    logs.push(`Role Security: ${score}/100 - ${metrics.join(", ")}`);
    return { score: Math.max(0, Math.min(100, score)) };
  }

  /**
   * Growth Trajectory: Forward-looking projections
   */
  private evaluateGrowthTrajectory(
    input: WRPlayerInput,
    logs: string[],
    tags: string[],
    risks: string[],
    upside: string[]
  ): { score: number } {
    let score = 50; // Base score
    const metrics: string[] = [];

    // Historical Growth Analysis
    if (input.previousSeasons && input.previousSeasons.length > 0) {
      const lastSeason = input.previousSeasons[input.previousSeasons.length - 1];
      
      // YPRR Growth - Efficiency improvement
      const yprrGrowth = input.ypRR - lastSeason.ypRR;
      if (yprrGrowth >= 0.4) {
        score += 20;
        metrics.push(`Major YPRR improvement (+${yprrGrowth.toFixed(1)})`);
        tags.push("Breakout Trajectory");
        upside.push("Strong efficiency growth");
      } else if (yprrGrowth >= 0.2) {
        score += 10;
        metrics.push(`Good YPRR growth (+${yprrGrowth.toFixed(1)})`);
        tags.push("Trending Up");
      } else if (yprrGrowth <= -0.3) {
        score -= 15;
        metrics.push(`YPRR decline (${yprrGrowth.toFixed(1)})`);
        risks.push("Efficiency regression");
        tags.push("Declining Trend");
      }

      // TPRR Growth - Usage increase
      const tprrGrowth = input.tpRR - lastSeason.tpRR;
      if (tprrGrowth >= 0.05) {
        score += 15;
        metrics.push(`Increased target earning (+${(tprrGrowth * 100).toFixed(1)}%)`);
        upside.push("Growing role in offense");
      } else if (tprrGrowth <= -0.04) {
        score -= 10;
        metrics.push(`Decreased target earning (${(tprrGrowth * 100).toFixed(1)}%)`);
        risks.push("Shrinking role");
      }

      // Multi-year trend analysis
      if (input.previousSeasons.length >= 2) {
        const twoSeasonsAgo = input.previousSeasons[input.previousSeasons.length - 2];
        const consistentGrowth = 
          (input.ypRR > lastSeason.ypRR) && 
          (lastSeason.ypRR > twoSeasonsAgo.ypRR);
        
        if (consistentGrowth) {
          score += 10;
          metrics.push("Multi-year growth pattern");
          tags.push("Consistent Growth");
          upside.push("Sustained development trajectory");
        }
      }
    } else {
      score = 50; // Neutral for rookies/no data
      metrics.push("No historical data (rookie/limited sample)");
      tags.push("Unknown Trajectory");
    }

    // QB Stability - Environment factor
    if (input.qbStabilityScore >= 80) {
      score += 15;
      metrics.push(`Elite QB stability (${input.qbStabilityScore})`);
      upside.push("Stable QB environment");
    } else if (input.qbStabilityScore >= 60) {
      score += 8;
      metrics.push(`Good QB stability (${input.qbStabilityScore})`);
    } else if (input.qbStabilityScore < 40) {
      score -= 15;
      metrics.push(`QB instability (${input.qbStabilityScore})`);
      risks.push("QB volatility concerns");
      tags.push("QB Risk");
    }

    // Offseason Changes Impact
    if (input.offseasonChanges) {
      const changes = input.offseasonChanges;
      
      if (changes.newQB) {
        score -= 10;
        metrics.push("New QB adjustment period");
        risks.push("QB chemistry development needed");
        tags.push("QB Transition");
      }
      
      if (changes.newOC) {
        score -= 5;
        metrics.push("New offensive coordinator");
        risks.push("Scheme adjustment period");
      }
      
      if (changes.wrAdditions) {
        score -= 8;
        metrics.push("New WR competition added");
        risks.push("Increased target competition");
        tags.push("Competition Added");
      }
      
      if (changes.schemeChange) {
        score -= 5;
        metrics.push("Offensive scheme changes");
        risks.push("Role uncertainty in new scheme");
      }
    }

    logs.push(`Growth Trajectory: ${score}/100 - ${metrics.join(", ")}`);
    return { score: Math.max(0, Math.min(100, score)) };
  }

  /**
   * Determine forecast grade based on comprehensive analysis
   */
  private determineForecastGrade(
    contextScore: number,
    componentScores: any,
    riskFactors: string[]
  ): 'ELITE' | 'STRONG' | 'SOLID' | 'CONCERNING' | 'AVOID' {
    
    // High-risk overrides
    if (riskFactors.length >= 4) return 'AVOID';
    if (riskFactors.length >= 3) return 'CONCERNING';
    
    // Score-based grading
    if (contextScore >= 80) return 'ELITE';
    if (contextScore >= 70) return 'STRONG';
    if (contextScore >= 55) return 'SOLID';
    if (contextScore >= 40) return 'CONCERNING';
    return 'AVOID';
  }

  /**
   * Create standardized result object
   */
  private createResult(
    input: WRPlayerInput | undefined,
    contextScore: number,
    componentScores: any,
    forecastTags: string[],
    logs: string[],
    riskFactors: string[],
    upside: string[],
    forecastGrade: 'ELITE' | 'STRONG' | 'SOLID' | 'CONCERNING' | 'AVOID'
  ): WREvaluationResult {
    return {
      playerId: input?.playerId || 'unknown',
      playerName: input?.playerName || 'Unknown Player',
      position: input?.position || 'WR',
      team: input?.team || 'Unknown Team',
      contextScore: Math.round(contextScore * 10) / 10,
      forecastGrade,
      componentScores,
      forecastTags: [...new Set(forecastTags)],
      logs,
      riskFactors: [...new Set(riskFactors)],
      upside: [...new Set(upside)],
      lastEvaluatedSeason: input?.season || new Date().getFullYear(),
      timestamp: new Date()
    };
  }

  /**
   * Get methodology information
   */
  getMethodology() {
    return {
      name: this.name,
      version: this.version,
      description: "Forward-looking dynasty WR evaluation using 4-component scoring with predictive focus",
      triggerScope: ["dynastyValuation", "playerProfile", "forecastAnalysis"],
      components: {
        usageProfile: "35% - TPRR, route participation, first read %, air yard share, team context",
        efficiency: "25% - YPRR, first down rate, route wins, explosive plays, YAC, drops",
        roleSecurity: "25% - Age, draft capital, alignment, contract, injury history, RZ role",
        growthTrajectory: "15% - Historical trends, QB stability, offseason changes"
      },
      inputValidation: {
        requiredFields: ["playerId", "playerName", "position", "team", "season", "tpRR", "ypRR"],
        optionalFields: ["previousSeasons", "offseasonChanges", "injuryHistory", "contractYearsRemaining"]
      },
      outputFields: ["contextScore", "forecastGrade", "componentScores", "forecastTags", "riskFactors", "upside"]
    };
  }

  /**
   * Run test cases with different WR archetypes
   */
  runTestCases(): WREvaluationResult[] {
    const testCases: WRPlayerInput[] = [
      // Elite alpha WR
      {
        playerId: 'alpha-elite-test',
        playerName: 'Elite Alpha WR',
        position: 'WR',
        team: 'TEST',
        season: 2024,
        tpRR: 0.28,
        routeParticipation: 0.95,
        firstReadTargetPct: 0.35,
        teamPassAttemptsPerGame: 38,
        wrRoomTargetCompetition: 25,
        airYardShare: 0.42,
        ypRR: 2.4,
        oneDRR: 0.12,
        dropRate: 2.5,
        explosivePlayRate: 22.0,
        routeWinRate: 52.0,
        yacPerReception: 6.2,
        age: 24,
        draftCapital: 'R1',
        slotRate: 25.0,
        contractYearsRemaining: 4,
        injuryHistory: 'clean',
        redZoneTargetShare: 28.0,
        qbStabilityScore: 85,
        previousSeasons: [{
          season: 2023,
          ypRR: 2.1,
          tpRR: 0.24,
          targetShare: 0.22,
          firstReadTargetPct: 0.30,
          fantasyPointsPerGame: 18.5
        }]
      },
      // Breakout candidate
      {
        playerId: 'breakout-candidate-test',
        playerName: 'Breakout Candidate WR',
        position: 'WR',
        team: 'TEST',
        season: 2024,
        tpRR: 0.21,
        routeParticipation: 0.82,
        firstReadTargetPct: 0.18,
        teamPassAttemptsPerGame: 35,
        wrRoomTargetCompetition: 45,
        airYardShare: 0.28,
        ypRR: 2.0,
        oneDRR: 0.09,
        dropRate: 4.2,
        explosivePlayRate: 18.0,
        routeWinRate: 44.0,
        yacPerReception: 5.1,
        age: 23,
        draftCapital: 'R2',
        slotRate: 55.0,
        contractYearsRemaining: 3,
        injuryHistory: 'minor',
        redZoneTargetShare: 15.0,
        qbStabilityScore: 72,
        previousSeasons: [{
          season: 2023,
          ypRR: 1.6,
          tpRR: 0.16,
          targetShare: 0.14,
          firstReadTargetPct: 0.12,
          fantasyPointsPerGame: 11.2
        }]
      },
      // Aging veteran with risk
      {
        playerId: 'aging-veteran-test',
        playerName: 'Aging Veteran WR',
        position: 'WR',
        team: 'TEST',
        season: 2024,
        tpRR: 0.22,
        routeParticipation: 0.88,
        firstReadTargetPct: 0.25,
        teamPassAttemptsPerGame: 32,
        wrRoomTargetCompetition: 60,
        airYardShare: 0.32,
        ypRR: 1.9,
        oneDRR: 0.08,
        dropRate: 5.8,
        explosivePlayRate: 14.0,
        routeWinRate: 38.0,
        yacPerReception: 4.3,
        age: 31,
        draftCapital: 'R1',
        slotRate: 15.0,
        contractYearsRemaining: 1,
        injuryHistory: 'concerning',
        redZoneTargetShare: 22.0,
        qbStabilityScore: 45,
        previousSeasons: [{
          season: 2023,
          ypRR: 2.1,
          tpRR: 0.24,
          targetShare: 0.28,
          firstReadTargetPct: 0.28,
          fantasyPointsPerGame: 16.8
        }],
        offseasonChanges: {
          newQB: true,
          wrAdditions: true
        }
      }
    ];

    return testCases.map(testCase => this.evaluateWR(testCase));
  }
}

export const wrEvaluationForecastService = new WREvaluationForecastService();