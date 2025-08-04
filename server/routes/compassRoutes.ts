/**
 * Player Compass API Routes
 * RESTful endpoints for the Player Compass evaluation system
 */

import { Router } from 'express';
import { PlayerCompassService, CompassFilters } from '../playerCompass';
import { compassDataAdapter } from '../compassDataAdapter';

const router = Router();
const compassService = new PlayerCompassService();

/**
 * GET /api/compass/players
 * Get all player compass profiles with optional filtering
 */
router.get('/players', async (req, res) => {
  try {
    console.log('🧭 Player Compass: Fetching player profiles...');
    
    // Get WR players from CSV data adapter
    const players = compassDataAdapter.getCompassPlayers();
    
    if (!players || players.length === 0) {
      return res.json({
        success: true,
        profiles: [],
        count: 0,
        message: 'No players found in database'
      });
    }
    
    // Generate compass profiles for all players
    const profiles = players.map(player => {
      try {
        return compassService.generateCompassProfile(player);
      } catch (error) {
        console.warn(`⚠️ Failed to generate compass profile for ${player.name}:`, error);
        return null;
      }
    }).filter(profile => profile !== null);
    
    // Apply filters if provided
    const filters: CompassFilters = {};
    
    if (req.query.positions) {
      filters.positions = Array.isArray(req.query.positions) 
        ? req.query.positions as any
        : [req.query.positions as any];
    }
    
    if (req.query.tiers) {
      filters.tiers = Array.isArray(req.query.tiers)
        ? req.query.tiers as any
        : [req.query.tiers as any];
    }
    
    if (req.query.tags) {
      filters.tags = Array.isArray(req.query.tags)
        ? req.query.tags as any
        : [req.query.tags as any];
    }
    
    if (req.query.teams) {
      filters.teams = Array.isArray(req.query.teams)
        ? req.query.teams as any
        : [req.query.teams as any];
    }
    
    if (req.query.minAge || req.query.maxAge) {
      filters.ageRange = {
        min: parseInt(req.query.minAge as string) || 0,
        max: parseInt(req.query.maxAge as string) || 50
      };
    }
    
    if (req.query.scenario && req.query.minScenarioValue) {
      filters.scenarios = {
        scenario: req.query.scenario as any,
        minValue: parseFloat(req.query.minScenarioValue as string)
      };
    }
    
    // Filter profiles
    const filteredProfiles = Object.keys(filters).length > 0 
      ? compassService.filterProfiles(profiles, filters)
      : profiles;
    
    // Sort by tier and scenario value
    const sortedProfiles = filteredProfiles.sort((a, b) => {
      const tierOrder = { 'Elite': 5, 'High-End': 4, 'Solid': 3, 'Upside': 2, 'Deep': 1 };
      const aTierValue = tierOrder[a.tier];
      const bTierValue = tierOrder[b.tier];
      
      if (aTierValue !== bTierValue) {
        return bTierValue - aTierValue; // Higher tier first
      }
      
      // Within same tier, sort by dynasty ceiling
      return b.scenarios.dynastyCeiling - a.scenarios.dynastyCeiling;
    });
    
    console.log(`✅ Generated ${sortedProfiles.length} compass profiles`);
    
    res.json({
      success: true,
      profiles: sortedProfiles,
      count: sortedProfiles.length,
      filters: filters,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Player Compass error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate player compass profiles',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/compass/players/:id
 * Get detailed compass profile for a specific player
 */
router.get('/players/:id', async (req, res) => {
  try {
    const playerId = req.params.id;
    console.log(`🧭 Player Compass: Fetching profile for player ${playerId}...`);
    
    const players = compassDataAdapter.getCompassPlayers();
    const player = players.find(p => p.id === playerId || p.player_id === playerId);
    
    if (!player) {
      return res.status(404).json({
        success: false,
        error: 'Player not found',
        playerId
      });
    }
    
    const profile = compassService.generateCompassProfile(player);
    
    console.log(`✅ Generated compass profile for ${player.name}`);
    
    res.json({
      success: true,
      profile,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Player Compass profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate player compass profile',
      playerId: req.params.id,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/compass/tiers
 * Get summary of players by tier
 */
router.get('/tiers', async (req, res) => {
  try {
    console.log('🧭 Player Compass: Fetching tier summary...');
    
    const players = compassDataAdapter.getCompassPlayers();
    
    if (!players || players.length === 0) {
      return res.json({
        success: true,
        tiers: {},
        count: 0
      });
    }
    
    const profiles = players.map(player => compassService.generateCompassProfile(player));
    
    // Group by tier
    const tierSummary = profiles.reduce((acc, profile) => {
      if (!acc[profile.tier]) {
        acc[profile.tier] = [];
      }
      acc[profile.tier].push({
        name: profile.name,
        position: profile.position,
        team: profile.team,
        dynastyCeiling: profile.scenarios.dynastyCeiling,
        contextTags: profile.contextTags.slice(0, 3) // Top 3 tags
      });
      return acc;
    }, {} as Record<string, any[]>);
    
    // Sort players within each tier
    Object.keys(tierSummary).forEach(tier => {
      tierSummary[tier].sort((a, b) => b.dynastyCeiling - a.dynastyCeiling);
    });
    
    console.log(`✅ Generated tier summary for ${profiles.length} players`);
    
    res.json({
      success: true,
      tiers: tierSummary,
      count: profiles.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Player Compass tier summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate tier summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/compass/tags
 * Get available context tags and their frequencies
 */
router.get('/tags', async (req, res) => {
  try {
    console.log('🧭 Player Compass: Fetching context tags...');
    
    const players = compassDataAdapter.getCompassPlayers();
    
    if (!players || players.length === 0) {
      return res.json({
        success: true,
        tags: {},
        count: 0
      });
    }
    
    const profiles = players.map(player => compassService.generateCompassProfile(player));
    
    // Count tag frequencies
    const tagCounts = profiles.reduce((acc, profile) => {
      profile.contextTags.forEach(tag => {
        acc[tag] = (acc[tag] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);
    
    // Sort by frequency
    const sortedTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .reduce((acc, [tag, count]) => {
        acc[tag] = count;
        return acc;
      }, {} as Record<string, number>);
    
    console.log(`✅ Generated tag summary: ${Object.keys(sortedTags).length} unique tags`);
    
    res.json({
      success: true,
      tags: sortedTags,
      count: Object.keys(sortedTags).length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Player Compass tags error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate tag summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;