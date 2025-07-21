/**
 * TIBER: Verify 2024 Game Log Access - Sleeper API Only
 * Check for weekly player statistics availability
 */

import { Request, Response } from 'express';
import axios from 'axios';

export async function verify2024GameLogs(req: Request, res: Response) {
  console.log('🔍 [TIBER] VERIFY_2024_GAME_LOG_ACCESS_SLEEPER_ONLY initiated...');
  
  const verification = {
    weeklyGameLogs: false,
    seasonTotals: false,
    availableStats: [] as string[],
    weeklyDataFormat: 'unknown',
    testResults: {} as any
  };

  try {
    // Test 1: Check season-level stats endpoint
    console.log('📊 Testing season-level stats: /v1/stats/nfl/regular/2024');
    const seasonResponse = await axios.get('https://api.sleeper.app/v1/stats/nfl/regular/2024');
    
    if (seasonResponse.data && Object.keys(seasonResponse.data).length > 0) {
      verification.seasonTotals = true;
      const samplePlayerId = Object.keys(seasonResponse.data)[0];
      const sampleStats = seasonResponse.data[samplePlayerId];
      verification.availableStats = Object.keys(sampleStats);
      verification.testResults.seasonSample = {
        playerId: samplePlayerId,
        statCount: Object.keys(sampleStats).length,
        hasTargets: 'rec_tgt' in sampleStats,
        hasReceptions: 'rec' in sampleStats,
        hasReceivingYards: 'rec_yd' in sampleStats,
        hasTouchdowns: 'rec_td' in sampleStats || 'rush_td' in sampleStats
      };
    }

    // Test 2: Check weekly stats endpoints (weeks 1-18)
    console.log('📊 Testing weekly game logs: /v1/stats/nfl/regular/2024/[week]');
    const weeklyTests = [];
    
    for (let week = 1; week <= 3; week++) {
      try {
        const weekResponse = await axios.get(`https://api.sleeper.app/v1/stats/nfl/regular/2024/${week}`);
        if (weekResponse.data && Object.keys(weekResponse.data).length > 0) {
          const samplePlayerId = Object.keys(weekResponse.data)[0];
          const weekStats = weekResponse.data[samplePlayerId];
          
          weeklyTests.push({
            week,
            hasData: true,
            playerCount: Object.keys(weekResponse.data).length,
            sampleStats: Object.keys(weekStats),
            hasGameStats: {
              targets: 'rec_tgt' in weekStats,
              receptions: 'rec' in weekStats,
              receivingYards: 'rec_yd' in weekStats,
              touchdowns: 'rec_td' in weekStats || 'rush_td' in weekStats
            }
          });
          
          if (!verification.weeklyGameLogs) {
            verification.weeklyGameLogs = true;
            verification.weeklyDataFormat = 'week-by-week';
          }
        }
      } catch (error) {
        weeklyTests.push({
          week,
          hasData: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    verification.testResults.weeklyTests = weeklyTests;

    // Final assessment
    if (verification.weeklyGameLogs && verification.seasonTotals) {
      console.log('✅ [SLEEPER_2024_GAME_LOG_CHECK] Both weekly and season data available');
      
      res.json({
        success: true,
        status: '[SLEEPER_2024_GAME_LOG_CHECK]',
        verdict: 'YES - 2024 game log data available',
        dataFormats: {
          weeklyGameLogs: verification.weeklyGameLogs,
          seasonTotals: verification.seasonTotals
        },
        availableStats: verification.availableStats,
        dataFormat: verification.weeklyDataFormat,
        priorityStats: {
          targets: verification.availableStats.includes('rec_tgt'),
          receptions: verification.availableStats.includes('rec'),
          receivingYards: verification.availableStats.includes('rec_yd'),
          touchdowns: verification.availableStats.includes('rec_td') || verification.availableStats.includes('rush_td')
        },
        verification
      });
    } else if (verification.seasonTotals && !verification.weeklyGameLogs) {
      console.log('⚠️ [SLEEPER_2024_GAME_LOG_CHECK] Season totals only, no weekly breakdowns');
      
      res.json({
        success: true,
        status: '[SLEEPER_2024_GAME_LOG_CHECK]',
        verdict: 'PARTIAL - Season totals only, no weekly game logs',
        dataFormats: {
          weeklyGameLogs: false,
          seasonTotals: true
        },
        availableStats: verification.availableStats,
        dataFormat: 'season-totals-only',
        verification
      });
    } else {
      console.log('❌ [NO_2024_GAME_LOG_DATA] No 2024 data found');
      
      res.status(404).json({
        success: false,
        status: '[NO_2024_GAME_LOG_DATA]',
        verdict: 'NO - 2024 game log data not available',
        message: 'Sleeper API does not provide 2024 season player statistics',
        verification
      });
    }

  } catch (error) {
    console.error('❌ [SLEEPER_2024_GAME_LOG_CHECK] Verification failed:', error);
    
    res.status(500).json({
      success: false,
      status: '[NO_2024_GAME_LOG_DATA]',
      verdict: 'ERROR - Unable to verify 2024 data availability',
      error: error instanceof Error ? error.message : 'Unknown error',
      verification
    });
  }
}