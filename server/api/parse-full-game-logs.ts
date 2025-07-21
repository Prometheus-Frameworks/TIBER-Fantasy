/**
 * TIBER: Parse 2024 Game Logs Full Depth Analysis
 * Comprehensive field cataloging and data structure analysis
 */

import { Request, Response } from 'express';
import axios from 'axios';

export async function parseFullGameLogs(req: Request, res: Response) {
  console.log('🔍 [TIBER] PARSE_2024_GAME_LOGS_FULL_DEPTH initiated...');
  
  const analysis = {
    seasonStats: {
      fieldCatalog: [] as string[],
      sampleData: {} as any,
      playerCount: 0
    },
    weeklyStats: {
      weekAnalysis: [] as any[],
      uniqueFields: new Set<string>(),
      fieldFrequency: {} as Record<string, number>,
      positionBreakdown: {} as any
    },
    comprehensiveFieldList: [] as string[],
    dataStructureAnalysis: {} as any
  };

  try {
    // Phase 1: Season-level comprehensive field analysis
    console.log('📊 Phase 1: Season stats comprehensive analysis...');
    const seasonResponse = await axios.get('https://api.sleeper.app/v1/stats/nfl/regular/2024');
    
    if (seasonResponse.data && Object.keys(seasonResponse.data).length > 0) {
      const players = Object.keys(seasonResponse.data);
      analysis.seasonStats.playerCount = players.length;
      
      // Analyze all fields across multiple players
      const allSeasonFields = new Set<string>();
      const fieldOccurrence: Record<string, number> = {};
      
      // Sample 50 players to get comprehensive field coverage
      const samplePlayers = players.slice(0, 50);
      
      samplePlayers.forEach(playerId => {
        const playerStats = seasonResponse.data[playerId];
        Object.keys(playerStats).forEach(field => {
          allSeasonFields.add(field);
          fieldOccurrence[field] = (fieldOccurrence[field] || 0) + 1;
        });
      });
      
      analysis.seasonStats.fieldCatalog = Array.from(allSeasonFields).sort();
      analysis.seasonStats.sampleData = seasonResponse.data[players[0]];
      analysis.dataStructureAnalysis.seasonFieldFrequency = fieldOccurrence;
    }

    // Phase 2: Weekly game logs deep analysis (weeks 1-10)
    console.log('📊 Phase 2: Weekly game logs comprehensive parsing...');
    
    for (let week = 1; week <= 10; week++) {
      try {
        console.log(`  📅 Analyzing week ${week}...`);
        const weekResponse = await axios.get(`https://api.sleeper.app/v1/stats/nfl/regular/2024/${week}`);
        
        if (weekResponse.data && Object.keys(weekResponse.data).length > 0) {
          const weekPlayers = Object.keys(weekResponse.data);
          const weekFields = new Set<string>();
          const weekFieldFreq: Record<string, number> = {};
          const positionStats: Record<string, any> = {};
          
          // Sample 20 players per week for comprehensive field analysis
          const sampleSize = Math.min(20, weekPlayers.length);
          const weekSample = weekPlayers.slice(0, sampleSize);
          
          weekSample.forEach(playerId => {
            const playerData = weekResponse.data[playerId];
            
            // Catalog all fields for this week
            Object.keys(playerData).forEach(field => {
              weekFields.add(field);
              analysis.weeklyStats.uniqueFields.add(field);
              
              weekFieldFreq[field] = (weekFieldFreq[field] || 0) + 1;
              analysis.weeklyStats.fieldFrequency[field] = (analysis.weeklyStats.fieldFrequency[field] || 0) + 1;
            });
            
            // Analyze by position if available
            if (playerData.pos) {
              if (!positionStats[playerData.pos]) {
                positionStats[playerData.pos] = {
                  playerCount: 0,
                  uniqueFields: new Set<string>()
                };
              }
              positionStats[playerData.pos].playerCount++;
              Object.keys(playerData).forEach(field => {
                positionStats[playerData.pos].uniqueFields.add(field);
              });
            }
          });
          
          analysis.weeklyStats.weekAnalysis.push({
            week,
            playerCount: weekPlayers.length,
            sampleSize,
            uniqueFieldCount: weekFields.size,
            fields: Array.from(weekFields).sort(),
            fieldFrequency: weekFieldFreq,
            positionBreakdown: Object.fromEntries(
              Object.entries(positionStats).map(([pos, data]) => [
                pos, 
                {
                  playerCount: (data as any).playerCount,
                  uniqueFields: Array.from((data as any).uniqueFields)
                }
              ])
            ),
            sampleData: weekResponse.data[weekPlayers[0]]
          });
        } else {
          analysis.weeklyStats.weekAnalysis.push({
            week,
            available: false,
            reason: 'No data returned'
          });
        }
      } catch (error) {
        analysis.weeklyStats.weekAnalysis.push({
          week,
          available: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Phase 3: Comprehensive field consolidation
    console.log('📊 Phase 3: Comprehensive field consolidation...');
    
    const allFields = new Set([
      ...analysis.seasonStats.fieldCatalog,
      ...Array.from(analysis.weeklyStats.uniqueFields)
    ]);
    
    analysis.comprehensiveFieldList = Array.from(allFields).sort();
    
    // Categorize fields by type
    const fieldCategories = {
      rushing: [] as string[],
      passing: [] as string[],
      receiving: [] as string[],
      kicking: [] as string[],
      defense: [] as string[],
      fantasy: [] as string[],
      game_context: [] as string[],
      rankings: [] as string[],
      other: [] as string[]
    };
    
    analysis.comprehensiveFieldList.forEach(field => {
      if (field.includes('rush')) fieldCategories.rushing.push(field);
      else if (field.includes('pass')) fieldCategories.passing.push(field);
      else if (field.includes('rec')) fieldCategories.receiving.push(field);
      else if (field.includes('fg') || field.includes('xp') || field.includes('kick')) fieldCategories.kicking.push(field);
      else if (field.includes('idp') || field.includes('tkl') || field.includes('def')) fieldCategories.defense.push(field);
      else if (field.includes('pts') || field.includes('rank')) fieldCategories.fantasy.push(field);
      else if (field.includes('gp') || field.includes('snp') || field.includes('gms')) fieldCategories.game_context.push(field);
      else if (field.includes('rank')) fieldCategories.rankings.push(field);
      else fieldCategories.other.push(field);
    });
    
    analysis.dataStructureAnalysis.fieldCategories = fieldCategories;

    // Generate final report
    const report = {
      status: '[GAME_LOG_FULL_FIELD_REPORT]',
      summary: {
        totalUniqueFields: analysis.comprehensiveFieldList.length,
        seasonPlayerCount: analysis.seasonStats.playerCount,
        weeksCovered: analysis.weeklyStats.weekAnalysis.filter(w => w.available !== false).length,
        avgPlayersPerWeek: Math.round(
          analysis.weeklyStats.weekAnalysis
            .filter(w => w.available !== false)
            .reduce((sum, w) => sum + w.playerCount, 0) / 
          analysis.weeklyStats.weekAnalysis.filter(w => w.available !== false).length
        )
      },
      comprehensiveFieldList: analysis.comprehensiveFieldList,
      fieldCategories: analysis.dataStructureAnalysis.fieldCategories,
      seasonAnalysis: {
        fieldCount: analysis.seasonStats.fieldCatalog.length,
        fields: analysis.seasonStats.fieldCatalog,
        samplePlayerData: analysis.seasonStats.sampleData
      },
      weeklyAnalysis: {
        weekBreakdown: analysis.weeklyStats.weekAnalysis,
        mostFrequentFields: Object.entries(analysis.weeklyStats.fieldFrequency)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 20)
          .map(([field, freq]) => ({ field, frequency: freq }))
      },
      dataAvailability: {
        priorityStatFields: {
          targets: analysis.comprehensiveFieldList.includes('rec_tgt'),
          receptions: analysis.comprehensiveFieldList.includes('rec'),
          receivingYards: analysis.comprehensiveFieldList.includes('rec_yd'),
          receivingTDs: analysis.comprehensiveFieldList.includes('rec_td'),
          rushingAttempts: analysis.comprehensiveFieldList.includes('rush_att'),
          rushingYards: analysis.comprehensiveFieldList.includes('rush_yd'),
          rushingTDs: analysis.comprehensiveFieldList.includes('rush_td'),
          passingAttempts: analysis.comprehensiveFieldList.includes('pass_att'),
          passingYards: analysis.comprehensiveFieldList.includes('pass_yd'),
          passingTDs: analysis.comprehensiveFieldList.includes('pass_td')
        },
        fantasyScoring: analysis.comprehensiveFieldList.filter(f => f.includes('pts')),
        gameContext: analysis.comprehensiveFieldList.filter(f => f.includes('gp') || f.includes('snp') || f.includes('gms'))
      }
    };

    console.log('✅ [GAME_LOG_FULL_FIELD_REPORT] Comprehensive analysis complete');
    res.json(report);

  } catch (error) {
    console.error('❌ [GAME_LOG_FULL_FIELD_REPORT] Analysis failed:', error);
    res.status(500).json({
      status: '[GAME_LOG_FULL_FIELD_REPORT]',
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      partialAnalysis: analysis
    });
  }
}