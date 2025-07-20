import { Request, Response } from 'express';
import axios from 'axios';

export async function cleanVorpRankings(req: Request, res: Response) {
  try {
    const leagueFormat = req.query.league_format as string || 'ppr';
    const mode = req.query.mode as string || 'dynasty';
    const position = req.query.position as string;
    
    console.log(`🔥 CLEAN VORP: ${mode} ${leagueFormat} rankings`);
    
    // Step 1: Get player metadata
    const playersResponse = await axios.get('https://api.sleeper.app/v1/players/nfl', { timeout: 15000 });
    const playerMetadata = playersResponse.data || {};
    console.log(`📋 Loaded ${Object.keys(playerMetadata).length} player metadata`);
    
    // Step 2: Get 2025 projections or use fallback
    let rawProjections = {};
    let dataSource = 'SAMPLE_DATA';
    
    try {
      const projectionsResponse = await axios.get('https://api.sleeper.app/v1/projections/nfl/2025/regular', { timeout: 10000 });
      rawProjections = projectionsResponse.data || {};
      if (Object.keys(rawProjections).length > 0) {
        dataSource = '2025_PROJECTIONS';
      }
      console.log(`📊 2025 projections: ${Object.keys(rawProjections).length} players`);
    } catch (error) {
      console.log('⚠️ Using fallback sample data');
      // Use sample data with known player IDs
      rawProjections = {
        "4046": { pts_ppr: 285, pts_half_ppr: 260, pts_std: 235 }, // Patrick Mahomes
        "4881": { pts_ppr: 275, pts_half_ppr: 250, pts_std: 225 }, // Lamar Jackson  
        "4984": { pts_ppr: 265, pts_half_ppr: 240, pts_std: 215 }, // Josh Allen
        "6813": { pts_ppr: 245, pts_half_ppr: 220, pts_std: 195 }, // Justin Jefferson
        "7564": { pts_ppr: 235, pts_half_ppr: 210, pts_std: 185 }, // CeeDee Lamb
        "7828": { pts_ppr: 225, pts_half_ppr: 200, pts_std: 175 }, // Ja'Marr Chase
        "4866": { pts_ppr: 195, pts_half_ppr: 175, pts_std: 155 }, // Austin Ekeler
        "5892": { pts_ppr: 185, pts_half_ppr: 165, pts_std: 145 }, // Saquon Barkley
        "6794": { pts_ppr: 175, pts_half_ppr: 155, pts_std: 135 }, // Bijan Robinson
        "4039": { pts_ppr: 165, pts_half_ppr: 145, pts_std: 125 }  // Travis Kelce
      };
    }
    
    // Step 3: Calculate VORP - projected_fpts minus replacement level
    const replacementLevels = {
      QB: 225,
      RB: 200, 
      WR: 200,
      TE: 150
    };
    
    const players = [];
    
    for (const [playerId, projData] of Object.entries(rawProjections)) {
      const proj = projData as any;
      const metadata = playerMetadata[playerId];
      
      if (!metadata || !['QB', 'RB', 'WR', 'TE'].includes(metadata.position)) continue;
      
      // Get projected points based on league format
      let projectedFpts = 0;
      if (leagueFormat === 'ppr') projectedFpts = proj.pts_ppr || 0;
      else if (leagueFormat === 'half_ppr') projectedFpts = proj.pts_half_ppr || 0;
      else projectedFpts = proj.pts_std || 0;
      
      if (projectedFpts > 100 && projectedFpts <= 450) {  // Only meaningful projections
        // Calculate VORP: projected_fpts - replacement_level
        const replacementLevel = replacementLevels[metadata.position as keyof typeof replacementLevels];
        const vorp = projectedFpts - replacementLevel;
        
        // Calculate age
        let age = 25;
        if (metadata.birth_date) {
          const birthYear = new Date(metadata.birth_date).getFullYear();
          age = new Date().getFullYear() - birthYear;
        }
        
        players.push({
          player_id: playerId,
          full_name: metadata.full_name || `${metadata.first_name} ${metadata.last_name}`,
          position: metadata.position,
          team: metadata.team,
          age: Math.min(40, Math.max(20, age)),
          projected_fpts: parseFloat(projectedFpts.toFixed(1)),
          vorp_score: parseFloat(vorp.toFixed(1)),
          replacement_level: replacementLevel,
          source: dataSource
        });
      }
    }
    
    // Step 4: Filter by position if specified
    let filteredPlayers = players;
    if (position && position !== 'all') {
      filteredPlayers = players.filter(p => p.position === position.toUpperCase());
    }
    
    // Step 5: Sort by VORP (highest first)
    filteredPlayers.sort((a, b) => b.vorp_score - a.vorp_score);
    
    console.log(`✅ CLEAN VORP: Returning ${filteredPlayers.length} players`);
    console.log(`🏆 Top 3: ${filteredPlayers.slice(0, 3).map(p => `${p.full_name} (${p.vorp_score})`).join(', ')}`);
    
    res.json({
      success: true,
      players: filteredPlayers,
      meta: {
        totalPlayers: filteredPlayers.length,
        dataSource: dataSource,
        league_format: leagueFormat,
        mode: mode,
        replacement_levels: replacementLevels
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ CLEAN VORP error:', error);
    res.status(500).json({ error: 'VORP calculation failed' });
  }
}