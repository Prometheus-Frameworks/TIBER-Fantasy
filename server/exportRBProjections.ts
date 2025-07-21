import { getAllRBProjections, type RBProjection } from './services/rbProjectionsService';
import { writeFileSync } from 'fs';

interface StandardRBProjection {
  player_id: string;
  name: string;
  team: string;
  position: string;
  proj_points: number;
  carries: number;
  rush_yd: number;
  rush_td: number;
  rec: number;
  rec_yd: number;
  rec_td: number;
  adp: number;
}

function exportRBProjections() {
  try {
    console.log('🏈 [RB_EXPORT] Starting RB projections export...');
    
    const rbProjections = getAllRBProjections();
    console.log(`📊 [RB_EXPORT] Found ${rbProjections.length} RB projections`);
    
    const standardizedProjections: StandardRBProjection[] = rbProjections.map((player: RBProjection) => {
      // Generate player_id from name and team
      const player_id = player.player.toLowerCase()
        .replace(/[^a-zA-Z\s]/g, '')
        .replace(/\s+/g, '_') + `_${player.team.toLowerCase()}`;
      
      return {
        player_id,
        name: player.player,
        team: player.team,
        position: 'RB',
        proj_points: Math.round(player.points * 10) / 10,
        carries: Math.round((player.rush_yds / 4.5) || 150), // Estimate carries from rush yards
        rush_yd: player.rush_yds || 700,
        rush_td: player.rush_tds || 4,
        rec: player.receptions || 25,
        rec_yd: player.rec_yards || 200,
        rec_td: player.rec_tds || 2,
        adp: player.adp || 999
      };
    });
    
    // Sort by projected points (highest first)
    standardizedProjections.sort((a, b) => b.proj_points - a.proj_points);
    
    console.log('✅ [RB_EXPORT] Standardized projections created');
    console.log(`🏆 Top RB: ${standardizedProjections[0]?.name} (${standardizedProjections[0]?.proj_points} pts)`);
    
    // Export to JSON file
    writeFileSync('projections_rb.json', JSON.stringify(standardizedProjections, null, 2));
    
    console.log('💾 [RB_EXPORT] projections_rb.json exported successfully');
    console.log(`📈 [RB_EXPORT] Total RBs exported: ${standardizedProjections.length}`);
    
    return standardizedProjections;
  } catch (error) {
    console.error('❌ [RB_EXPORT_FAILED]', error);
    throw error;
  }
}

// Run export
exportRBProjections()
  .then(data => {
    console.log(`🎯 [RB_EXPORT_COMPLETE] ${data.length} RB projections exported to projections_rb.json`);
  })
  .catch(error => {
    console.error('❌ [RB_EXPORT_FAILED]', error.message);
  });