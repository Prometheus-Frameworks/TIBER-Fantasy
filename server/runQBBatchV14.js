/**
 * QB Batch Evaluation v1.4 Test Runner
 * Tests enhanced Promethean logic with improved validation and error handling
 */

import { qbBatchInputV13 } from './qbBatchInputV13.js';

const API_BASE = 'http://localhost:5000';

async function runQBBatchEvaluationV14() {
  console.log('🏈 PROMETHEUS QB BATCH EVALUATION v1.4');
  console.log('═══════════════════════════════════════');
  console.log(`📊 Testing with ${qbBatchInputV13.length} QBs from 2024 season`);
  console.log(`🎯 Features: Enhanced Promethean logic, validation, type guards, configurable batch size\n`);

  try {
    const startTime = Date.now();
    
    const response = await fetch(`${API_BASE}/api/analytics/batch-evaluation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ players: qbBatchInputV13 })
    });

    const result = await response.json();
    const duration = Date.now() - startTime;

    if (result.success && result.batchResult.QB.length > 0) {
      console.log('✅ QB BATCH EVALUATION v1.4 COMPLETE');
      console.log(`⏱️  Processing time: ${duration}ms`);
      console.log(`📈 Success rate: ${result.batchResult.QB.length}/${qbBatchInputV13.length} (${Math.round(result.batchResult.QB.length/qbBatchInputV13.length*100)}%)`);
      console.log(`🔧 Version: BatchFantasyEvaluator v1.4\n`);

      console.log('🏆 TOP 25 QB CONTEXT SCORES (v1.4):');
      console.log('═══════════════════════════════════');
      
      // Filter out batch summary
      const qbs = result.batchResult.QB.filter(qb => qb.playerName !== 'Batch Summary');
      
      qbs.forEach((qb, index) => {
        const rank = index + 1;
        const score = qb.contextScore.toFixed(1);
        const tags = qb.tags || [];
        const logs = qb.logs || [];
        
        const prometheanTier = tags.includes('PROMETHEAN TIER') ? 'PROMETHEAN' : 'Standard';
        const prometheanFlags = logs.find(log => log.includes('Promethean Flags Hit:'))?.split(':')[1]?.trim() || 'N/A';
        
        console.log(`${rank.toString().padStart(2)}. ${qb.playerName.padEnd(18)} ${score.padStart(4)} - ${prometheanTier.padEnd(10)} ${prometheanFlags}`);
        
        // Show details for top 10
        if (rank <= 10) {
          const bonusLog = logs.find(log => log.includes('Bonus Applied:'));
          if (bonusLog) {
            console.log(`    ${bonusLog}`);
          }
          
          // Show Promethean flags for PROMETHEAN TIER QBs
          if (prometheanTier === 'PROMETHEAN') {
            const flagTags = tags.filter(t => !t.includes('PROMETHEAN TIER') && !t.includes('Environment'));
            if (flagTags.length > 0) {
              console.log(`    Flags: ${flagTags.slice(0, 3).join(', ')}`);
            }
          }
        }
      });

      console.log('\n🎯 PROMETHEAN TIER ANALYSIS:');
      console.log('═══════════════════════════');
      
      const prometheanQBs = qbs.filter(qb => (qb.tags || []).includes('PROMETHEAN TIER'));
      const standardQBs = qbs.filter(qb => !(qb.tags || []).includes('PROMETHEAN TIER'));
      
      console.log(`🔥 Promethean Tier QBs: ${prometheanQBs.length}`);
      prometheanQBs.forEach(qb => {
        const logs = qb.logs || [];
        const flagsLog = logs.find(log => log.includes('Promethean Flags Hit:'));
        const bonusLog = logs.find(log => log.includes('Bonus Applied:'));
        console.log(`   • ${qb.playerName} (${qb.contextScore.toFixed(1)}) - ${flagsLog?.split(':')[1]?.trim()}, ${bonusLog?.split(':')[1]?.trim()}`);
      });
      
      console.log(`\n⚡ Standard Tier QBs: ${standardQBs.length}`);
      
      console.log('\n📊 ENHANCED v1.4 FEATURES:');
      console.log('═══════════════════════════');
      console.log('✓ Reintegrated Promethean Tier logic for elite dual-threat QBs');
      console.log('✓ Enhanced validation and error logs for missing/invalid fields');
      console.log('✓ Improved type guards and field-specific validation checks');
      console.log('✓ Configurable batch size via MAX_BATCH_SIZE environment variable');
      console.log('✓ Better modularity, type safety, and comprehensive logging');
      
      // Show batch summary if it exists
      const batchSummary = result.batchResult.QB.find(qb => qb.playerName === 'Batch Summary');
      if (batchSummary && batchSummary.logs) {
        console.log('\n📈 BATCH SUMMARY:');
        console.log('═══════════════');
        batchSummary.logs.forEach(log => console.log(`• ${log}`));
      }

      console.log('\n🎯 KEY v1.4 IMPROVEMENTS:');
      console.log('═══════════════════════════');
      console.log('• Refined Promethean flag system (5 criteria vs previous 5)');
      console.log('• Dynamic bonus calculation: 7 base + 1.5 per extra flag');
      console.log('• Enhanced input validation with automatic field clamping');
      console.log('• Penalty detection for low mobility + poor pressure handling');
      console.log('• Comprehensive error handling and logging throughout');

    } else {
      console.error('❌ BATCH EVALUATION FAILED');
      console.error(`Result:`, JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('❌ REQUEST FAILED:', error.message);
  }
}

// Run the evaluation
runQBBatchEvaluationV14();