// Simple tier generation for rankings system
export interface TierResult {
  tier: number;
  players: string[];
  avgVorp: number;
  tierBreak: number;
}

export function generateTierBreaks(players: any[]): TierResult[] {
  if (!players || players.length === 0) {
    return [];
  }

  // Sort players by VORP score descending
  const sortedPlayers = [...players].sort((a, b) => (b.vorp_score || 0) - (a.vorp_score || 0));
  
  const tiers: TierResult[] = [];
  let currentTier = 1;
  let tierStartIndex = 0;
  
  // Generate 7 tiers with roughly equal distribution
  const playersPerTier = Math.max(1, Math.floor(sortedPlayers.length / 7));
  
  for (let i = playersPerTier; i < sortedPlayers.length; i += playersPerTier) {
    const tierPlayers = sortedPlayers.slice(tierStartIndex, i);
    
    if (tierPlayers.length > 0) {
      const avgVorp = tierPlayers.reduce((sum, p) => sum + (p.vorp_score || 0), 0) / tierPlayers.length;
      const tierBreak = tierPlayers[tierPlayers.length - 1]?.vorp_score || 0;
      
      tiers.push({
        tier: currentTier,
        players: tierPlayers.map(p => p.player_name),
        avgVorp: avgVorp,
        tierBreak: tierBreak
      });
      
      currentTier++;
      tierStartIndex = i;
    }
    
    if (currentTier > 7) break;
  }
  
  // Add remaining players to final tier
  if (tierStartIndex < sortedPlayers.length) {
    const remainingPlayers = sortedPlayers.slice(tierStartIndex);
    if (remainingPlayers.length > 0) {
      const avgVorp = remainingPlayers.reduce((sum, p) => sum + (p.vorp_score || 0), 0) / remainingPlayers.length;
      
      tiers.push({
        tier: currentTier,
        players: remainingPlayers.map(p => p.player_name),
        avgVorp: avgVorp,
        tierBreak: remainingPlayers[remainingPlayers.length - 1]?.vorp_score || 0
      });
    }
  }
  
  console.log(`🎯 Generated ${tiers.length} tiers from ${sortedPlayers.length} players`);
  return tiers;
}

export function clearProjectionsCache(): void {
  console.log('🧹 Tier generation cache cleared (no-op)');
}