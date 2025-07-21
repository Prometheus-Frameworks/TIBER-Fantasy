/**
 * TIBER: Export Positional Game Log Sample
 * Fetch specific players' 2024 weekly game logs with comprehensive stats
 */

import { Request, Response } from 'express';
import axios from 'axios';

interface WeeklyGameLog {
  week: number;
  rec_tgt?: number;
  rec?: number;
  rec_yd?: number;
  rec_td?: number;
  rush_att?: number;
  rush_yd?: number;
  rush_td?: number;
  pass_att?: number;
  pass_yd?: number;
  pass_td?: number;
  pts_ppr?: number;
  active: boolean;
}

interface PlayerGameLogSample {
  player_id: string;
  name: string;
  team: string;
  position: string;
  total_void_weeks: number;
  total_active_weeks: number;
  ppg_ppr: number;
  weekly_logs: WeeklyGameLog[];
}

export async function exportPositionalGameLogs(req: Request, res: Response) {
  console.log('🔍 [TIBER] EXPORT_POSITIONAL_GAME_LOG_SAMPLE initiated...');

  const targetPlayers = [
    { name: 'Drake Maye', team: 'NE', position: 'QB' },
    { name: 'Derrick Henry', team: 'BAL', position: 'RB' },
    { name: 'Brian Thomas Jr.', team: 'JAX', position: 'WR' },
    { name: 'Trey McBride', team: 'ARI', position: 'TE' }
  ];

  const results: PlayerGameLogSample[] = [];

  try {
    // Phase 1: Get all NFL players to find our target players
    console.log('📊 Phase 1: Finding target players...');
    const playersResponse = await axios.get('https://api.sleeper.app/v1/players/nfl');
    const allPlayers = playersResponse.data;

    // Find our target players
    const foundPlayers: Array<{id: string, name: string, team: string, position: string}> = [];
    
    for (const [playerId, playerData] of Object.entries(allPlayers)) {
      const player = playerData as any;
      if (player.full_name) {
        for (const target of targetPlayers) {
          if (player.full_name.includes(target.name) || 
              (player.first_name && player.last_name && 
               `${player.first_name} ${player.last_name}`.includes(target.name))) {
            foundPlayers.push({
              id: playerId,
              name: player.full_name || `${player.first_name} ${player.last_name}`,
              team: player.team || target.team,
              position: player.position || target.position
            });
            console.log(`  ✅ Found: ${player.full_name} (${playerId}) - ${player.team} ${player.position}`);
            break;
          }
        }
      }
    }

    if (foundPlayers.length === 0) {
      console.log('⚠️ No target players found, using fallback search...');
      // Fallback: search by partial name matching
      for (const [playerId, playerData] of Object.entries(allPlayers)) {
        const player = playerData as any;
        if (player.last_name) {
          if (player.last_name === 'Maye' || player.last_name === 'Henry' || 
              player.last_name === 'Thomas' || player.last_name === 'McBride') {
            foundPlayers.push({
              id: playerId,
              name: player.full_name || `${player.first_name} ${player.last_name}`,
              team: player.team || 'UNK',
              position: player.position || 'UNK'
            });
            console.log(`  📍 Fallback found: ${player.full_name} (${playerId})`);
          }
        }
      }
    }

    // Phase 2: Fetch weekly game logs for each found player
    console.log('\n📊 Phase 2: Fetching weekly game logs...');

    for (const player of foundPlayers.slice(0, 4)) { // Limit to 4 players
      console.log(`\n🎯 Processing ${player.name} (${player.id})...`);
      
      const weeklyLogs: WeeklyGameLog[] = [];
      let totalPPRPoints = 0;
      let activeWeeks = 0;

      // Fetch weeks 1-18
      for (let week = 1; week <= 18; week++) {
        try {
          const weekResponse = await axios.get(`https://api.sleeper.app/v1/stats/nfl/regular/2024/${week}`);
          const weekData = weekResponse.data;

          if (weekData && weekData[player.id]) {
            const playerWeekData = weekData[player.id];
            
            // Extract relevant stats with proper contextual TD handling
            const weekLog: WeeklyGameLog = {
              week,
              rec_tgt: playerWeekData.rec_tgt || 0,
              rec: playerWeekData.rec || 0,
              rec_yd: playerWeekData.rec_yd || 0,
              rec_td: 0, // Will be set contextually
              rush_att: playerWeekData.rush_att || 0,
              rush_yd: playerWeekData.rush_yd || 0,
              rush_td: 0, // Will be set contextually
              pass_att: playerWeekData.pass_att || 0,
              pass_yd: playerWeekData.pass_yd || 0,
              pass_td: playerWeekData.pass_td || 0,
              pts_ppr: playerWeekData.pts_ppr || 0,
              active: true
            };

            // Handle contextual TD field
            if (playerWeekData.td) {
              // If player has receiving stats, assume contextual TD is receiving
              if (weekLog.rec_tgt && weekLog.rec_tgt > 0) {
                weekLog.rec_td = playerWeekData.td;
              }
              // If player has rushing stats but no receiving, assume rushing TD
              else if (weekLog.rush_att && weekLog.rush_att > 0) {
                weekLog.rush_td = playerWeekData.td;
              }
            }

            weeklyLogs.push(weekLog);
            totalPPRPoints += weekLog.pts_ppr || 0;
            activeWeeks++;
            
          } else {
            // Player did not play this week
            weeklyLogs.push({
              week,
              rec_tgt: 0,
              rec: 0,
              rec_yd: 0,
              rec_td: 0,
              rush_att: 0,
              rush_yd: 0,
              rush_td: 0,
              pass_att: 0,
              pass_yd: 0,
              pass_td: 0,
              pts_ppr: 0,
              active: false
            });
          }
        } catch (error) {
          console.log(`    ❌ Week ${week}: Error fetching data`);
          weeklyLogs.push({
            week,
            rec_tgt: 0,
            rec: 0,
            rec_yd: 0,
            rec_td: 0,
            rush_att: 0,
            rush_yd: 0,
            rush_td: 0,
            pass_att: 0,
            pass_yd: 0,
            pass_td: 0,
            pts_ppr: 0,
            active: false
          });
        }
      }

      const voidWeeks = 18 - activeWeeks;
      const ppgPPR = activeWeeks > 0 ? totalPPRPoints / activeWeeks : 0;

      console.log(`  📊 ${player.name}: ${activeWeeks} active weeks, ${voidWeeks} void weeks, ${ppgPPR.toFixed(2)} PPG`);

      results.push({
        player_id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        total_void_weeks: voidWeeks,
        total_active_weeks: activeWeeks,
        ppg_ppr: Math.round(ppgPPR * 100) / 100,
        weekly_logs: weeklyLogs
      });
    }

    // Generate final report
    const report = {
      status: '[POSITIONAL_GAME_LOG_SAMPLE_JSON]',
      summary: {
        players_processed: results.length,
        total_weeks_analyzed: 18,
        data_source: 'Sleeper API 2024 NFL Stats'
      },
      players: results
    };

    console.log('\n✅ [POSITIONAL_GAME_LOG_SAMPLE_JSON] Export complete');
    res.json(report);

  } catch (error) {
    console.error('❌ [POSITIONAL_GAME_LOG_SAMPLE_JSON] Export failed:', error);
    res.status(500).json({
      status: '[POSITIONAL_GAME_LOG_SAMPLE_JSON]',
      error: 'Export failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      players: results
    });
  }
}