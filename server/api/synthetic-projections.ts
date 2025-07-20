import type { Express } from "express";

export function registerSyntheticProjectionsRoutes(app: Express) {
  // Generate synthetic projections when Sleeper API returns empty data
  app.get('/api/synthetic/projections', async (req, res) => {
    try {
      console.log('🎯 Generating synthetic projections for testing...');
      
      const format = req.query.format as string || 'ppr';
      
      // Top fantasy players with realistic 2025 projections
      const syntheticProjections = [
        // Elite QBs
        { player_name: 'Josh Allen', position: 'QB', team: 'BUF', projected_fpts: 385, receptions: 0, player_id: '4984', birthdate: '1996-05-21' },
        { player_name: 'Lamar Jackson', position: 'QB', team: 'BAL', projected_fpts: 375, receptions: 0, player_id: '4881', birthdate: '1997-01-07' },
        { player_name: 'Jayden Daniels', position: 'QB', team: 'WAS', projected_fpts: 360, receptions: 0, player_id: '11638', birthdate: '2000-12-18' },
        { player_name: 'Jalen Hurts', position: 'QB', team: 'PHI', projected_fpts: 350, receptions: 0, player_id: '6886', birthdate: '1998-08-07' },
        { player_name: 'Patrick Mahomes', position: 'QB', team: 'KC', projected_fpts: 340, receptions: 0, player_id: '4046', birthdate: '1995-09-17' },
        
        // Elite RBs
        { player_name: 'Bijan Robinson', position: 'RB', team: 'ATL', projected_fpts: 285, receptions: 55, player_id: '9509', birthdate: '2002-01-25' },
        { player_name: 'Breece Hall', position: 'RB', team: 'NYJ', projected_fpts: 275, receptions: 45, player_id: '8110', birthdate: '2001-05-20' },
        { player_name: 'Jahmyr Gibbs', position: 'RB', team: 'DET', projected_fpts: 270, receptions: 50, player_id: '9885', birthdate: '2002-03-20' },
        { player_name: 'Jonathan Taylor', position: 'RB', team: 'IND', projected_fpts: 260, receptions: 35, player_id: '6151', birthdate: '1999-01-19' },
        { player_name: 'Saquon Barkley', position: 'RB', team: 'PHI', projected_fpts: 255, receptions: 40, player_id: '3198', birthdate: '1997-02-09' },
        
        // Elite WRs  
        { player_name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN', projected_fpts: 320, receptions: 95, player_id: '7564', birthdate: '2000-03-01' },
        { player_name: 'Justin Jefferson', position: 'WR', team: 'MIN', projected_fpts: 310, receptions: 90, player_id: '6797', birthdate: '1999-06-16' },
        { player_name: 'CeeDee Lamb', position: 'WR', team: 'DAL', projected_fpts: 305, receptions: 85, player_id: '6945', birthdate: '1999-04-08' },
        { player_name: 'Tyreek Hill', position: 'WR', team: 'MIA', projected_fpts: 295, receptions: 80, player_id: '1426', birthdate: '1994-03-01' },
        { player_name: 'Amon-Ra St. Brown', position: 'WR', team: 'DET', projected_fpts: 285, receptions: 85, player_id: '7943', birthdate: '1999-10-24' },
        
        // Elite TEs
        { player_name: 'Travis Kelce', position: 'TE', team: 'KC', projected_fpts: 245, receptions: 75, player_id: '1046', birthdate: '1989-10-05' },
        { player_name: 'Sam LaPorta', position: 'TE', team: 'DET', projected_fpts: 220, receptions: 70, player_id: '9226', birthdate: '2001-08-05' },
        { player_name: 'Mark Andrews', position: 'TE', team: 'BAL', projected_fpts: 210, receptions: 65, player_id: '4381', birthdate: '1995-09-06' },
        { player_name: 'George Kittle', position: 'TE', team: 'SF', projected_fpts: 205, receptions: 60, player_id: '3164', birthdate: '1993-10-09' },
        { player_name: 'Trey McBride', position: 'TE', team: 'ARI', projected_fpts: 195, receptions: 55, player_id: '8156', birthdate: '2000-11-16' }
      ];
      
      // Format projections based on league format
      const formattedProjections = syntheticProjections.map(player => {
        let basePts = player.projected_fpts;
        
        // Adjust for different scoring formats
        if (format === 'standard') {
          basePts = basePts * 0.85; // Lower without PPR
        } else if (format === 'half-ppr') {
          basePts = basePts * 0.92; // Between standard and PPR
        }
        
        return {
          ...player,
          projected_fpts: Math.round(basePts * 10) / 10,
          stats: {
            pts_ppr: format === 'ppr' ? basePts : basePts * 1.15,
            pts_half_ppr: basePts * 0.92,
            pts_std: basePts * 0.85,
            rec: player.receptions
          }
        };
      });
      
      console.log(`✅ Generated ${formattedProjections.length} synthetic projections (${format} format)`);
      
      res.json({
        success: true,
        synthetic_projections: {
          count: formattedProjections.length,
          format: format,
          players: formattedProjections,
          note: 'Synthetic data for testing when Sleeper API returns empty results'
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Synthetic projections generation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Synthetic projections generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });
}