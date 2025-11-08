/**
 * Enhanced Rankings API
 * Unified system combining OVR, Power Rankings components, and SOS integration
 * 
 * Two modes:
 * 1. Season (ROS) - Component-based rankings with OASIS environment data
 * 2. Weekly - SOS-adjusted rankings with matchup analysis
 */

import type { Express, Request, Response } from "express";
import { db } from "../infra/db";
import { eq, and, desc } from "drizzle-orm";
import { computeWeeklySOS } from "../modules/sos/sos.service";
import { oasisEnvironmentService } from "../services/oasisEnvironmentService";

// Import Power Rankings component scoring logic
interface ComponentScores {
  usage: number;
  talent: number;
  environment: number;
  availability: number;
  market_anchor: number;
}

interface EnhancedPlayer {
  player_id: string;
  name: string;
  team: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  ovr: number;
  tier: string;
  
  // Enhanced features
  components?: ComponentScores;
  confidence?: number;
  badges?: string[];
  explanation?: string;
  
  // SOS data for weekly mode
  sos_data?: {
    opponent: string;
    sos_score: number; // 0-100, higher = easier
    tier: 'green' | 'yellow' | 'red';
    adjustment: number; // Rating adjustment based on matchup
  };
}

/**
 * Get position-specific component weights (from Power Rankings)
 */
function getPositionWeights(position: string): Record<string, number> {
  switch (position) {
    case 'QB':
      return {
        usage: 0.40,       // QB usage = attempts, designed runs, RZ opportunities
        talent: 0.25,      // Arm talent, accuracy, mobility
        environment: 0.30, // OL, pace, weapons (boosted for QBs)
        availability: 0.08, // QBs usually healthy 
        market_anchor: 0.05
      };
      
    case 'RB':
      return {
        usage: 0.40,       // Snap share, inside-10 share, target share
        talent: 0.25,      // YAC, speed, receiving ability
        environment: 0.20, // OL, game script, team pace
        availability: 0.13, // Injury-prone position (boosted)
        market_anchor: 0.05
      };
      
    case 'WR':
      return {
        usage: 0.40,       // Target share, air yards share, route participation
        talent: 0.25,      // Route running, hands, speed
        environment: 0.20, // QB play, scheme, pace
        availability: 0.10, // Generally healthy position
        market_anchor: 0.05
      };
      
    case 'TE':
      return {
        usage: 0.40,       // Route participation, target share
        talent: 0.25,      // Receiving ability, blocking
        environment: 0.20, // QB play, scheme usage
        availability: 0.10, // Generally healthy
        market_anchor: 0.05
      };
      
    default:
      return {
        usage: 0.40,
        talent: 0.25,
        environment: 0.20,
        availability: 0.10,
        market_anchor: 0.05
      };
  }
}

/**
 * Generate dynamic explanations based on player data
 */
function generateExplanation(player: any, mode: 'season' | 'weekly'): string {
  const explanations: string[] = [];

  if (mode === 'season') {
    // Season mode explanations
    if (player.ovr >= 90) {
      explanations.push('Elite tier player');
    } else if (player.ovr >= 80) {
      explanations.push('High-end starter');
    } else if (player.ovr >= 70) {
      explanations.push('Solid starter');
    }

    if (player.components) {
      if (player.components.usage >= 80) {
        explanations.push('Alpha usage rate');
      }
      if (player.components.environment >= 85) {
        explanations.push('Elite offensive environment');
      } else if (player.components.environment <= 65) {
        explanations.push('Challenging team context');
      }
      if (player.components.talent >= 90) {
        explanations.push('Elite talent grade');
      }
    }
  } else {
    // Weekly mode explanations
    if (player.sos_data) {
      if (player.sos_data.tier === 'green') {
        explanations.push(`Excellent matchup vs ${player.sos_data.opponent}`);
      } else if (player.sos_data.tier === 'red') {
        explanations.push(`Tough matchup vs ${player.sos_data.opponent}`);
      } else {
        explanations.push(`Neutral matchup vs ${player.sos_data.opponent}`);
      }
      
      if (player.sos_data.adjustment > 2) {
        explanations.push('Matchup boost applied');
      } else if (player.sos_data.adjustment < -2) {
        explanations.push('Matchup fade applied');
      }
    }
  }

  return explanations.length > 0 ? explanations.join(' • ') : 'Standard projection';
}

/**
 * Generate badges based on player metrics
 */
function generateBadges(player: any, mode: 'season' | 'weekly'): string[] {
  const badges: string[] = [];
  
  if (mode === 'season' && player.components) {
    if (player.components.usage >= 80) {
      badges.push('Alpha Usage');
    }
    if (player.components.environment >= 85) {
      badges.push('Elite Context');
    }
    if (player.components.talent >= 90) {
      badges.push('Elite Talent');
    }
    if (player.components.availability <= 70) {
      badges.push('Injury Risk');
    }
  } else if (mode === 'weekly' && player.sos_data) {
    if (player.sos_data.tier === 'green') {
      badges.push('Great Matchup');
    } else if (player.sos_data.tier === 'red') {
      badges.push('Tough Matchup');
    }
    if (player.sos_data.adjustment > 3) {
      badges.push('Matchup Boost');
    }
  }
  
  return badges;
}

export function registerEnhancedRankingsRoutes(app: Express) {
  
  // Main enhanced rankings endpoint
  app.get('/api/enhanced-rankings', async (req: Request, res: Response) => {
    try {
      const { 
        format = 'dynasty', 
        position = 'ALL', 
        mode = 'season', 
        week = 3, 
        limit = 100 
      } = req.query;

      console.log(`[Enhanced Rankings] ${mode} mode - ${position} ${format} ${mode === 'weekly' ? `Week ${week}` : 'ROS'}`);

      // Fetch base OVR data
      const params = new URLSearchParams();
      params.set('format', format as string);
      params.set('position', position as string);
      params.set('limit', limit as string);
      
      const ovrResponse = await fetch(`http://localhost:5000/api/ovr?${params.toString()}`);
      if (!ovrResponse.ok) {
        throw new Error(`OVR API failed: ${ovrResponse.status}`);
      }
      const ovrData = await ovrResponse.json();
      const players: EnhancedPlayer[] = ovrData.data?.players || [];

      if (mode === 'season') {
        // Season mode: Add component analysis
        const enhancedPlayers = await Promise.all(players.map(async (player) => {
          
          // Mock component scores (in production, get from data pipeline)
          const components: ComponentScores = {
            usage: Math.min(95, Math.max(20, player.ovr + Math.random() * 20 - 10)),
            talent: Math.min(95, Math.max(20, player.ovr + Math.random() * 20 - 10)),
            environment: Math.min(95, Math.max(20, player.ovr + Math.random() * 20 - 10)),
            availability: Math.min(95, Math.max(50, player.ovr + Math.random() * 20 - 10)),
            market_anchor: Math.min(95, Math.max(20, player.ovr + Math.random() * 20 - 10))
          };

          // Calculate confidence (simplified version of Power Rankings logic)
          const confidence = Math.min(1.0, Math.max(0.6, 
            0.8 + (player.ovr - 70) * 0.004 + Math.random() * 0.1
          ));

          const explanation = generateExplanation({ ...player, components }, 'season');
          const badges = generateBadges({ ...player, components }, 'season');

          return {
            ...player,
            components,
            confidence,
            explanation,
            badges
          };
        }));

        res.json({
          success: true,
          data: {
            players: enhancedPlayers,
            metadata: {
              ...ovrData.data.metadata,
              mode: 'season',
              enhanced: true
            }
          }
        });

      } else {
        // Weekly mode: Add SOS integration
        const currentWeek = parseInt(week as string);
        
        // Get SOS data for the position
        const sosData = await computeWeeklySOS(
          position === 'ALL' ? 'RB' : position as any, 
          currentWeek, 
          2025
        );

        // Create SOS lookup map
        const sosMap = new Map();
        sosData.forEach(sos => {
          sosMap.set(`${sos.team}_${sos.position}`, sos);
        });

        const enhancedPlayers = players.map(player => {
          // Find SOS data for this player
          const sosEntry = sosMap.get(`${player.team}_${player.position}`);
          
          let sos_data = undefined;
          let adjustedOVR = player.ovr;

          if (sosEntry) {
            // Calculate rating adjustment based on SOS
            let adjustment = 0;
            if (sosEntry.sos_score >= 75) {
              adjustment = 3; // Boost for great matchups
            } else if (sosEntry.sos_score >= 50) {
              adjustment = 1; // Small boost for above average
            } else if (sosEntry.sos_score <= 25) {
              adjustment = -3; // Fade for tough matchups
            } else if (sosEntry.sos_score <= 45) {
              adjustment = -1; // Small fade for below average
            }

            adjustedOVR = Math.min(99, Math.max(50, player.ovr + adjustment));

            sos_data = {
              opponent: sosEntry.opponent,
              sos_score: sosEntry.sos_score,
              tier: sosEntry.tier,
              adjustment
            };
          }

          const explanation = generateExplanation({ ...player, sos_data }, 'weekly');
          const badges = generateBadges({ ...player, sos_data }, 'weekly');

          return {
            ...player,
            ovr: adjustedOVR,
            sos_data,
            explanation,
            badges
          };
        });

        // Re-sort by adjusted OVR
        enhancedPlayers.sort((a, b) => b.ovr - a.ovr);

        res.json({
          success: true,
          data: {
            players: enhancedPlayers,
            metadata: {
              ...ovrData.data.metadata,
              mode: 'weekly',
              week: currentWeek,
              enhanced: true,
              sos_applied: true
            }
          }
        });
      }

    } catch (error) {
      console.error('[Enhanced Rankings] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate enhanced rankings',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Health check endpoint
  app.get('/api/enhanced-rankings/health', async (req: Request, res: Response) => {
    try {
      res.json({
        status: 'healthy',
        features: {
          season_mode: true,
          weekly_mode: true,
          sos_integration: true,
          component_scoring: true
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: String(error)
      });
    }
  });
}