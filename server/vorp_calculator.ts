import fs from 'fs';
import path from 'path';

interface VORPSettings {
  format?: 'standard' | 'half-ppr' | 'ppr';
  num_teams?: number;
  starters?: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
    FLEX: number;
  };
  is_superflex?: boolean;
  is_te_premium?: boolean;
}

interface PlayerProjection {
  player_name: string;
  position: string;
  team: string;
  projected_fpts: number;
  receptions: number;
}

export async function calculateVORP(settings: VORPSettings = {}): Promise<Record<string, number>> {
  const {
    format = 'ppr',
    num_teams = 12,
    starters = { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1 },
    is_superflex = false,
    is_te_premium = false
  } = settings;

  try {
    // Try to load projections from external source first, fallback to seed data
    let projections: PlayerProjection[] = [];
    
    try {
      // In a real implementation, this would fetch from external APIs
      // For now, load from our seed data
      const projectionsPath = path.join(process.cwd(), 'projections.json');
      const projectionsData = fs.readFileSync(projectionsPath, 'utf-8');
      projections = JSON.parse(projectionsData);
    } catch (error) {
      console.error('Failed to load projections:', error);
      return {};
    }

    // Calculate fantasy points based on format
    const playersWithAdjustedPoints = projections.map(player => {
      let adjustedPoints = player.projected_fpts;
      
      // Adjust for PPR format
      if (format === 'ppr') {
        adjustedPoints += player.receptions * 1.0;
      } else if (format === 'half-ppr') {
        adjustedPoints += player.receptions * 0.5;
      }
      
      // TE Premium adjustment
      if (is_te_premium && player.position === 'TE') {
        adjustedPoints += player.receptions * 0.5;
      }
      
      return {
        ...player,
        adjustedPoints
      };
    });

    // Calculate replacement level for each position
    const positionGroups = {
      QB: playersWithAdjustedPoints.filter(p => p.position === 'QB'),
      RB: playersWithAdjustedPoints.filter(p => p.position === 'RB'),
      WR: playersWithAdjustedPoints.filter(p => p.position === 'WR'),
      TE: playersWithAdjustedPoints.filter(p => p.position === 'TE')
    };

    // Sort each position by points
    Object.keys(positionGroups).forEach(pos => {
      positionGroups[pos as keyof typeof positionGroups].sort((a, b) => b.adjustedPoints - a.adjustedPoints);
    });

    // Calculate replacement levels
    const replacementLevels = {
      QB: getReplacementLevel(positionGroups.QB, starters.QB * num_teams + (is_superflex ? starters.QB * num_teams : 0)),
      RB: getReplacementLevel(positionGroups.RB, (starters.RB + starters.FLEX) * num_teams),
      WR: getReplacementLevel(positionGroups.WR, (starters.WR + starters.FLEX) * num_teams),
      TE: getReplacementLevel(positionGroups.TE, starters.TE * num_teams)
    };

    // Calculate VORP for each player
    const vorpMap: Record<string, number> = {};
    
    playersWithAdjustedPoints.forEach(player => {
      const replacementLevel = replacementLevels[player.position as keyof typeof replacementLevels] || 0;
      const vorp = Math.max(0, player.adjustedPoints - replacementLevel);
      vorpMap[player.player_name] = parseFloat(vorp.toFixed(2));
    });

    return vorpMap;
  } catch (error) {
    console.error('Error calculating VORP:', error);
    return {};
  }
}

function getReplacementLevel(players: any[], starterCount: number): number {
  if (players.length === 0) return 0;
  
  // Replacement level is typically around the player who would be the last starter + a few bench spots
  const replacementIndex = Math.min(starterCount + Math.floor(starterCount * 0.5), players.length - 1);
  return players[replacementIndex]?.adjustedPoints || 0;
}