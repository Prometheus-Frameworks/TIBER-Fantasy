import { fetchSleeperProjections, applyLeagueFormatScoring, PlayerProjection, LeagueSettings } from './services/projections/sleeperProjectionsService';

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

export async function calculateVORP(settings: VORPSettings = {}, mode: string = 'redraft', skipCache = false): Promise<{ vorpMap: Record<string, number>; tiers: any[] }> {
  const {
    format = 'ppr',
    num_teams = 12,
    starters = { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1 },
    is_superflex = false,
    is_te_premium = false
  } = settings;

  try {
    console.log(`🎯 Calculating VORP for ${format} ${mode} league (${num_teams} teams)`);
    
    // Fetch projections from Sleeper API
    let projections = await fetchSleeperProjections(skipCache);
    
    if (projections.length === 0) {
      console.error('❌ No projections available from Sleeper API');
      return { vorpMap: {}, tiers: [] };
    }

    // Apply league format scoring using Sleeper's native PPR calculations
    projections = applyLeagueFormatScoring(projections, format);

    // Dynasty age decay
    if (mode === 'dynasty') {
      projections = projections.map(player => {
        let ageDecay = 1.0;
        if (player.birthdate) {
          const age = new Date().getFullYear() - new Date(player.birthdate).getFullYear();
          if (age >= 30) ageDecay = 0.88; // -12% for 30+
          else if (age >= 28) ageDecay = 0.95; // -5% for 28-29
        }
        
        return {
          ...player,
          adjustedPoints: player.projected_fpts * ageDecay
        };
      });
    } else {
      // Redraft mode - no age penalties
      projections = projections.map(player => ({
        ...player,
        adjustedPoints: player.projected_fpts
      }));
    }

    // TE Premium adjustment
    if (is_te_premium) {
      projections = projections.map((player: any) => {
        if (player.position === 'TE') {
          return {
            ...player,
            adjustedPoints: player.adjustedPoints + (player.receptions || 0) * 0.5
          };
        }
        return player;
      });
    }

    // Calculate replacement level for each position
    const positionGroups = {
      QB: projections.filter(p => p.position === 'QB'),
      RB: projections.filter(p => p.position === 'RB'),
      WR: projections.filter(p => p.position === 'WR'),
      TE: projections.filter(p => p.position === 'TE')
    };

    // Sort each position by points
    Object.keys(positionGroups).forEach(pos => {
      positionGroups[pos as keyof typeof positionGroups].sort((a, b) => (b as any).adjustedPoints - (a as any).adjustedPoints);
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
    
    projections.forEach((player: any) => {
      const replacementLevel = replacementLevels[player.position as keyof typeof replacementLevels] || 0;
      const vorp = Math.max(0, player.adjustedPoints - replacementLevel);
      
      // Normalize to 99-point scale
      const normalizedVorp = Math.min(99, Math.round(vorp * 3.5));
      vorpMap[player.player_name] = normalizedVorp;
    });

    // Calculate tiers based on VORP gaps
    const allVorps = Object.values(vorpMap).sort((a, b) => b - a);
    const tiers = calculateTiers(allVorps);

    console.log(`✅ VORP calculation complete: ${Object.keys(vorpMap).length} players processed`);
    return { vorpMap, tiers };
  } catch (error) {
    console.error('Error calculating VORP:', error);
    return { vorpMap: {}, tiers: [] };
  }
}

function getReplacementLevel(players: any[], starterCount: number): number {
  if (players.length === 0) return 0;
  
  // Replacement level is typically around the player who would be the last starter + a few bench spots
  const replacementIndex = Math.min(starterCount + Math.floor(starterCount * 0.5), players.length - 1);
  return players[replacementIndex]?.adjustedPoints || 0;
}

function calculateTiers(sortedVorps: number[]): any[] {
  if (sortedVorps.length === 0) return [];
  
  const tiers = [];
  let currentTier = 1;
  let tierStart = 0;
  
  for (let i = 1; i < sortedVorps.length; i++) {
    const gap = sortedVorps[i - 1] - sortedVorps[i];
    
    // Create tier break on significant VORP gaps (8+ points)
    if (gap >= 8 && tiers.length < 6) {
      tiers.push({
        tier: currentTier,
        min_vorp: sortedVorps[i - 1],
        max_vorp: sortedVorps[tierStart],
        count: i - tierStart
      });
      
      tierStart = i;
      currentTier++;
    }
  }
  
  // Add final tier
  tiers.push({
    tier: currentTier,
    min_vorp: sortedVorps[sortedVorps.length - 1],
    max_vorp: sortedVorps[tierStart],
    count: sortedVorps.length - tierStart
  });
  
  return tiers;
}