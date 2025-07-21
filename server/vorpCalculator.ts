import { PlayerProjection } from './services/sleeperProjectionsService';

// Age calculation helper
function calculateAge(birthdate?: string): number {
  if (!birthdate) return getFallbackAge(''); // Will use default
  const birthDate = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

// Fallback ages per position
function getFallbackAge(pos: string): number {
  if (pos === 'RB') return 25;
  if (pos === 'WR') return 28;
  if (pos === 'QB' || pos === 'TE') return 30;
  return 27; // Default
}

// Enhanced VORP calculation with dynasty age penalties and format-aware positional scaling
export function calculateVORP(
  players: PlayerProjection[], 
  numTeams: number = 12, 
  starters: { QB: number; RB: number; WR: number; TE: number; FLEX: number } = { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1 }, 
  mode: string = 'redraft',
  debugRaw: boolean = false,
  format: string = '1qb'
): PlayerProjection[] {
  const posGroups: Record<string, PlayerProjection[]> = {};
  players.forEach(p => {
    if (!posGroups[p.position]) posGroups[p.position] = [];
    posGroups[p.position].push(p);
  });

  const flexAllocation: Record<string, number> = { RB: 0.5, WR: 0.4, TE: 0.1 };
  const baselines: Record<string, number> = {};
  const viableCounts: Record<string, number> = {};

  // Calculate baselines with FLEX allocation
  for (const pos in posGroups) {
    const sorted = posGroups[pos].sort((a, b) => b.projected_fpts - a.projected_fpts);
    let effectiveStarters = starters[pos as keyof typeof starters] || 0;
    if (flexAllocation[pos]) {
      effectiveStarters += starters.FLEX * flexAllocation[pos];
    }
    const replacementIndex = Math.floor(effectiveStarters * numTeams);
    baselines[pos] = sorted[replacementIndex] ? sorted[replacementIndex].projected_fpts : 0;
    viableCounts[pos] = sorted.filter(p => p.projected_fpts > baselines[pos]).length;
    console.log(`📊 ${pos} baseline (${pos}${replacementIndex + 1}): ${baselines[pos].toFixed(1)} pts`);
  }

  // Conservative scarcity weighting (capped at 1.3x max)
  const maxViable = Math.max(...Object.values(viableCounts));
  const weights: Record<string, number> = {};
  for (const pos in viableCounts) {
    const rawWeight = 1 + 0.3 * (maxViable / Math.max(1, viableCounts[pos]) - 1);
    weights[pos] = Math.min(rawWeight, 1.3); // Cap at 1.3x multiplier
    console.log(`⚖️ ${pos} weight: ${weights[pos].toFixed(2)} (${viableCounts[pos]} viable players)`);
  }

  // Dynasty age penalties (applied to fpts post-baseline, pre-weighting)
  if (mode === 'dynasty') {
    players.forEach(p => {
      const age = calculateAge(p.birthdate);
      let penalty = 0;
      
      if (p.position === 'RB' && age > 25) {
        penalty = (age - 25) * 0.01;
      }
      if (p.position === 'WR' && age > 28) {
        penalty = (age - 28) * 0.01;
      }
      if (p.position === 'QB' && age > 30) {
        penalty = (age - 30) * 0.005;
      }
      if (p.position === 'TE' && age > 30) {
        penalty = (age - 30) * 0.005; // Minimal as per spec
      }
      
      if (penalty > 0) {
        p.projected_fpts *= (1 - penalty);
        console.log(`🎯 Dynasty penalty: ${p.player_name} (${p.position}, age ${age}) -${(penalty * 100).toFixed(1)}%`);
      }
    });
  }

  // Format-aware positional scaling multipliers
  const formatPosWeights = (format: string) => {
    return format === 'superflex' ? 
      { QB: 1.3, RB: 1.1, WR: 1.1, TE: 1.0 } :    // Superflex weighting - QBs rise
      { QB: 0.7, RB: 1.2, WR: 1.3, TE: 1.1 };     // 1QB default weighting - QBs drop
  };

  const posScaling = formatPosWeights(format);
  console.log(`🏆 Format: ${format} - QB scaling: ${posScaling.QB}x`);

  // Calculate VORP with scarcity weighting and format-aware positional scaling
  players.forEach(p => {
    const rawVorp = p.projected_fpts - (baselines[p.position] || 0);
    p.vorp = rawVorp * (weights[p.position] || 1) * (posScaling[p.position] || 1);
    
    // Optional debug field for raw VORP comparison
    if (debugRaw) {
      (p as any).raw_vorp = rawVorp;
    }
  });

  // Sort by VORP descending
  players.sort((a, b) => (b.vorp || 0) - (a.vorp || 0));

  // Calculate final ratings (1-99 scale) based on VORP
  if (players.length > 0) {
    const maxVorp = Math.max(...players.map(p => p.vorp || 0));
    const minVorp = Math.min(...players.map(p => p.vorp || 0));
    
    players.forEach(p => {
      if (p.vorp !== undefined && maxVorp > minVorp) {
        // Scale VORP to 1-99 range, with 99 being the highest VORP
        const normalizedVorp = (p.vorp - minVorp) / (maxVorp - minVorp);
        (p as any).final_rating = Math.max(1, Math.min(99, Math.round(1 + normalizedVorp * 98)));
      } else {
        (p as any).final_rating = 50; // Default middle rating
      }
    });
  }

  console.log(`✅ VORP calculated for ${players.length} players (${mode} mode)`);
  return players;
}