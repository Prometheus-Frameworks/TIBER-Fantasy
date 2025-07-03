import type { Player } from "@shared/schema";

// Lineup optimization functions
export function optimizeLineup(teamPlayers: (Player & { isStarter: boolean })[]): any {
  const players = teamPlayers.map(tp => tp);
  
  // Sort by position and projected points
  const qbs = players.filter(p => p.position === "QB").sort((a, b) => b.projectedPoints - a.projectedPoints);
  const rbs = players.filter(p => p.position === "RB").sort((a, b) => b.projectedPoints - a.projectedPoints);
  const wrs = players.filter(p => p.position === "WR").sort((a, b) => b.projectedPoints - a.projectedPoints);
  const tes = players.filter(p => p.position === "TE").sort((a, b) => b.projectedPoints - a.projectedPoints);
  const defs = players.filter(p => p.position === "DEF").sort((a, b) => b.projectedPoints - a.projectedPoints);
  const ks = players.filter(p => p.position === "K").sort((a, b) => b.projectedPoints - a.projectedPoints);

  // Get optimal flex (highest remaining RB/WR/TE)
  const flexCandidates = [
    ...rbs.slice(2),
    ...wrs.slice(2), 
    ...tes.slice(1)
  ].sort((a, b) => b.projectedPoints - a.projectedPoints);

  const lineup = {
    qb: qbs[0] || null,
    rb1: rbs[0] || null,
    rb2: rbs[1] || null,
    wr1: wrs[0] || null,
    wr2: wrs[1] || null,
    te: tes[0] || null,
    flex: flexCandidates[0] || null,
    def: defs[0] || null,
    k: ks[0] || null
  };

  // Calculate total projected points
  const totalProjected = Object.values(lineup)
    .filter(Boolean)
    .reduce((sum: number, player: any) => sum + (player?.projectedPoints || 0), 0);

  // Generate recommendations
  const recommendations = generateLineupRecommendations(lineup, players);

  return {
    ...lineup,
    totalProjected,
    recommendations
  };
}

export function calculateConfidence(lineup: any): number {
  const startingPlayers = Object.values(lineup).filter(Boolean) as Player[];
  const avgPoints = startingPlayers.reduce((sum, player: any) => sum + (player?.avgPoints || 0), 0) / startingPlayers.length;
  
  // Higher confidence for higher scoring lineups
  return Math.min(0.95, Math.max(0.5, avgPoints / 20));
}

function generateLineupRecommendations(lineup: any, allPlayers: Player[]): string[] {
  const recommendations: string[] = [];
  
  // Check for obvious upgrades
  if (lineup.qb && lineup.qb.projectedPoints < 15) {
    const betterQBs = allPlayers.filter(p => 
      p.position === "QB" && p.projectedPoints > lineup.qb.projectedPoints + 3
    );
    if (betterQBs.length > 0) {
      recommendations.push(`Consider upgrading QB - ${betterQBs[0].name} projects ${betterQBs[0].projectedPoints.toFixed(1)} pts`);
    }
  }

  // Check RB depth
  const rbs = allPlayers.filter(p => p.position === "RB");
  if (rbs.length < 3) {
    recommendations.push("Consider adding RB depth for bye weeks and injuries");
  }

  // Check for injury concerns
  const injuredPlayers = allPlayers.filter(p => p.injuryStatus && p.injuryStatus !== "healthy");
  if (injuredPlayers.length > 0) {
    recommendations.push(`Monitor ${injuredPlayers.length} player(s) with injury concerns`);
  }

  return recommendations;
}

// Trade analysis functions
export function analyzeTradeOpportunities(teamPlayers: (Player & { isStarter: boolean })[], availablePlayers: Player[]): any {
  const positions = ["QB", "RB", "WR", "TE"];
  const teamNeeds: string[] = [];
  const surplus: string[] = [];
  
  positions.forEach(pos => {
    const positionPlayers = teamPlayers.filter(p => p.position === pos);
    const avgPoints = positionPlayers.reduce((sum, p) => sum + p.avgPoints, 0) / positionPlayers.length;
    
    if (avgPoints < 10) {
      teamNeeds.push(pos);
    } else if (positionPlayers.length > 4) {
      surplus.push(pos);
    }
  });

  // Find high-value available players in needed positions
  const targets = availablePlayers
    .filter(p => teamNeeds.includes(p.position))
    .sort((a, b) => b.avgPoints - a.avgPoints)
    .slice(0, 5);

  const recommendations = generateTradeRecommendations(teamNeeds, surplus, targets);

  return {
    targets,
    needs: teamNeeds,
    surplus,
    recommendations
  };
}

function generateTradeRecommendations(needs: string[], surplus: string[], targets: Player[]): string[] {
  const recommendations: string[] = [];
  
  if (needs.length > 0 && surplus.length > 0) {
    recommendations.push(`Trade surplus ${surplus[0]} for needed ${needs[0]}`);
  }
  
  targets.forEach(target => {
    if (target.avgPoints > 15) {
      recommendations.push(`Target ${target.name} (${target.position}) - averaging ${target.avgPoints.toFixed(1)} pts`);
    }
  });

  return recommendations;
}

// Waiver wire functions
export function generateWaiverRecommendations(teamPlayers: (Player & { isStarter: boolean })[], availablePlayers: Player[]): any[] {
  // Get team's weakest positions
  const positionAverages = {
    QB: getPositionAverage(teamPlayers, "QB"),
    RB: getPositionAverage(teamPlayers, "RB"), 
    WR: getPositionAverage(teamPlayers, "WR"),
    TE: getPositionAverage(teamPlayers, "TE")
  };

  // Sort positions by weakness (lowest averages first)
  const weakestPositions = Object.entries(positionAverages)
    .sort(([,a], [,b]) => a - b)
    .map(([pos]) => pos);

  // Find best available players, prioritizing weak positions
  const recommendations = availablePlayers
    .filter(p => p.isAvailable)
    .map(player => ({
      ...player,
      priority: calculateWaiverPriority(player, weakestPositions, positionAverages),
      reason: getPickupReason(player, weakestPositions, positionAverages)
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10);

  return recommendations;
}

function getPositionAverage(players: (Player & { isStarter: boolean })[], position: string): number {
  const posPlayers = players.filter(p => p.position === position);
  if (posPlayers.length === 0) return 0;
  return posPlayers.reduce((sum, p) => sum + p.avgPoints, 0) / posPlayers.length;
}

function calculateWaiverPriority(player: Player, weakestPositions: string[], positionAverages: any): number {
  let priority = player.projectedPoints;
  
  // Boost priority for weak positions
  const positionIndex = weakestPositions.indexOf(player.position);
  if (positionIndex !== -1) {
    priority += (4 - positionIndex) * 2; // More boost for weaker positions
  }
  
  // Boost for upside
  priority += player.upside;
  
  // Boost for low ownership (breakout candidates)
  if (player.ownershipPercentage < 20) {
    priority += 3;
  }

  return priority;
}

function getPickupReason(player: Player, weakestPositions: string[], positionAverages: any): string {
  if (weakestPositions.includes(player.position)) {
    return `Upgrade at ${player.position} (current avg: ${positionAverages[player.position].toFixed(1)} pts)`;
  }
  
  if (player.upside > 5) {
    return `High upside potential (${player.upside.toFixed(1)} upside points)`;
  }
  
  if (player.ownershipPercentage < 20) {
    return `Sleeper pick (${player.ownershipPercentage}% owned)`;
  }
  
  return `Depth addition at ${player.position}`;
}