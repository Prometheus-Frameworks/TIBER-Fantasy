import { PlayerProjection } from './services/sleeperProjectionsService';

export function calculateVORP(players: PlayerProjection[]): PlayerProjection[] {
  const numTeams = 12; // Standard 12-team league
  const startersPerTeam = { QB: 1, RB: 2, WR: 3, TE: 1 }; // Standard league starters

  // Group and sort by position
  const posGroups: Record<string, PlayerProjection[]> = {};
  players.forEach(p => {
    if (!posGroups[p.position]) posGroups[p.position] = [];
    posGroups[p.position].push(p);
  });

  // Dynamic baselines: fpts of replacement player (starters * teams)
  const baselines: Record<string, number> = {};
  for (const pos in posGroups) {
    const sorted = posGroups[pos].sort((a, b) => b.projected_fpts - a.projected_fpts);
    const replacementIndex = (startersPerTeam[pos as keyof typeof startersPerTeam] || 1) * numTeams - 1; // e.g., RB23 (0-indexed)
    baselines[pos] = sorted[replacementIndex] ? sorted[replacementIndex].projected_fpts : 0;
    console.log(`📊 ${pos} baseline (${pos}${replacementIndex + 1}): ${baselines[pos].toFixed(1)} pts`);
  }

  // Add VORP to each player
  players.forEach(p => {
    p.vorp = p.projected_fpts - (baselines[p.position] || 0);
  });

  console.log(`✅ VORP calculated for ${players.length} players`);
  return players;
}