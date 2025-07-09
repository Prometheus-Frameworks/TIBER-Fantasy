/**
 * QB Batch Debugger - Comprehensive 0.0 Context Score Analysis
 * Identifies missing/invalid data patterns and validates Promethean multiplier logic
 */

import { qbBatchInputV13 } from './qbBatchInputV13.js';

async function runQBBatchDebugger() {
  console.log('🔍 QB BATCH DEBUGGER - CONTEXT SCORE ANALYSIS');
  console.log('═══════════════════════════════════════════════');
  
  try {
    // Make API call to batch evaluation
    const response = await fetch('http://localhost:5000/api/analytics/batch-evaluation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        players: qbBatchInputV13
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Batch evaluation failed');
    }

    const qbResults = result.batchResult.QB;
    console.log(`📊 Analyzed ${qbResults.length} QB profiles`);
    
    // Filter QBs with 0.0 context scores
    const zeroScoreQBs = qbResults.filter(qb => qb.contextScore === 0.0);
    console.log(`🚨 Found ${zeroScoreQBs.length} QBs with 0.0 context scores`);
    
    if (zeroScoreQBs.length > 0) {
      console.log('\n❌ ZERO SCORE QB ANALYSIS:');
      console.log('═══════════════════════════');
      
      zeroScoreQBs.forEach((qb, index) => {
        console.log(`\n${index + 1}. ${qb.playerName || 'Unknown Player'}`);
        console.log(`   Context Score: ${qb.contextScore}`);
        console.log(`   Logs: ${qb.logs?.join(', ') || 'No logs'}`);
        console.log(`   Tags: ${qb.tags?.join(', ') || 'No tags'}`);
        console.log(`   Sub-scores: ${JSON.stringify(qb.subScores || {})}`);
        console.log(`   Last Evaluated Season: ${qb.lastEvaluatedSeason}`);
      });
      
      // Cross-reference with input data
      console.log('\n🔍 INPUT DATA CROSS-REFERENCE:');
      console.log('═══════════════════════════════');
      
      zeroScoreQBs.forEach((qb, index) => {
        const inputData = qbBatchInputV13.find(input => input.playerName === qb.playerName);
        if (inputData) {
          console.log(`\n${index + 1}. ${qb.playerName} - INPUT VALIDATION:`);
          console.log(`   Season: ${inputData.season} (Valid: ${inputData.season >= 2024})`);
          console.log(`   Position: ${inputData.position}`);
          console.log(`   Scramble Rate: ${inputData.scrambleRate} (Valid: ${inputData.scrambleRate >= 0 && inputData.scrambleRate <= 1})`);
          console.log(`   Rush YPG: ${inputData.rushYPG} (Valid: ${inputData.rushYPG >= 0})`);
          console.log(`   Fantasy PPG: ${inputData.fantasyPointsPerGame} (Valid: ${inputData.fantasyPointsPerGame >= 0})`);
          console.log(`   CPOE: ${inputData.cpoe} (Valid: ${inputData.cpoe >= -10 && inputData.cpoe <= 10})`);
          console.log(`   Team Data: ${inputData.team ? 'Present' : 'Missing'}`);
          
          if (inputData.team) {
            console.log(`   Team Route Win Rates: ${inputData.team.routeWinRateRanks ? inputData.team.routeWinRateRanks.length : 0} values`);
            console.log(`   Pass Block Grade: ${inputData.team.passBlockGrade}`);
            console.log(`   WR YPRR: ${inputData.team.wrYPRR}`);
          }
          
          // Check for null/undefined values
          const nullFields = [];
          Object.keys(inputData).forEach(key => {
            if (inputData[key] === null || inputData[key] === undefined) {
              nullFields.push(key);
            }
          });
          
          if (nullFields.length > 0) {
            console.log(`   NULL/UNDEFINED FIELDS: ${nullFields.join(', ')}`);
          }
        }
      });
    }
    
    // Analyze Promethean multiplier eligibility
    console.log('\n⚡ PROMETHEAN MULTIPLIER ANALYSIS:');
    console.log('═══════════════════════════════════');
    
    const prometheanCandidates = qbBatchInputV13.filter(qb => {
      return qb.rushYPG > 30 || qb.explosivePlayCount > 15 || qb.scrambleRate > 0.1;
    });
    
    console.log(`📈 ${prometheanCandidates.length} QBs meet Promethean criteria`);
    prometheanCandidates.forEach(qb => {
      const result = qbResults.find(r => r.playerName === qb.playerName);
      const hasPrometheanTags = result?.tags?.some(tag => 
        tag.includes('Elite Rush') || tag.includes('Explosive') || tag.includes('Pressure')
      );
      
      console.log(`   ${qb.playerName}: Score ${result?.contextScore || 0} | Tags: ${hasPrometheanTags ? 'Yes' : 'No'}`);
    });
    
    // Summary
    console.log('\n📋 SUMMARY:');
    console.log('═══════════');
    console.log(`✓ Total QBs processed: ${qbResults.length}`);
    console.log(`❌ QBs with 0.0 scores: ${zeroScoreQBs.length}`);
    console.log(`⚡ Promethean candidates: ${prometheanCandidates.length}`);
    
    if (zeroScoreQBs.length > 0) {
      console.log('\n🔧 RECOMMENDED FIXES:');
      console.log('════════════════════');
      console.log('1. Implement defaultFallbackValues for missing stats');
      console.log('2. Add comprehensive null/undefined checking');
      console.log('3. Ensure Promethean multiplier logic handles edge cases');
      console.log('4. Add detailed logging for score suppressions');
    }
    
  } catch (error) {
    console.error('❌ QB BATCH DEBUGGER FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the debugger
runQBBatchDebugger();