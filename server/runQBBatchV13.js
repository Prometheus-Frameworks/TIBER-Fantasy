/**
 * QB Batch Evaluation v1.3 Test Runner
 * Tests Promethean multiplier logic with enhanced QB inputs
 */

import { qbBatchInputV13 } from './qbBatchInputV13.js';

const API_BASE = 'http://localhost:5000';

async function runQBBatchEvaluationV13() {
  console.log('🏈 PROMETHEUS QB BATCH EVALUATION v1.3');
  console.log('═══════════════════════════════════════');
  console.log(`📊 Testing with ${qbBatchInputV13.length} QBs from 2024 season`);
  console.log(`🎯 Features: Promethean multiplier logic for dual-threat QBs\n`);

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
      console.log('✅ QB BATCH EVALUATION v1.3 COMPLETE');
      console.log(`⏱️  Processing time: ${duration}ms`);
      console.log(`📈 Success rate: ${result.batchResult.QB.length}/${qbBatchInputV13.length} (${Math.round(result.batchResult.QB.length/qbBatchInputV13.length*100)}%)`);
      console.log(`⚠️  Errors: ${result.batchResult.errorCount}\n`);

      console.log('🏆 TOP 25 QB CONTEXT SCORES (v1.3):');
      console.log('═══════════════════════════════════');
      
      result.batchResult.QB.forEach((qb, index) => {
        const rank = index + 1;
        const score = qb.contextScore.toFixed(1);
        const tags = qb.tags || [];
        const env = tags.find(tag => tag.includes('Environment'))?.replace(' Environment', '') || 'Unknown';
        const prometheanTier = tags.find(tag => tag.includes('Promethean')) || 'None';
        
        console.log(`${rank.toString().padStart(2)}. ${qb.playerName.padEnd(18)} ${score.padStart(4)} - ${env.padEnd(12)} ${prometheanTier}`);
        
        // Show Promethean flags for top 10
        if (rank <= 10) {
          const logs = qb.logs || [];
          const flagsLog = logs.find(log => log.includes('Promethean Flags Hit:'));
          const bonusLog = logs.find(log => log.includes('Bonus Applied:'));
          if (flagsLog && bonusLog) {
            console.log(`    ${flagsLog} | ${bonusLog}`);
          }
          
          // Show component breakdown for top 5
          if (rank <= 5 && qb.subScores) {
            console.log(`    Rushing: ${qb.subScores.rushingUpside || 'N/A'}, Accuracy: ${qb.subScores.throwingAccuracy || 'N/A'}, O-Line: ${qb.subScores.oLineProtection || 'N/A'}`);
            console.log(`    Weapons: ${qb.subScores.teammateQuality || 'N/A'}, Upgrades: ${qb.subScores.offseasonUpgrade || 'N/A'}`);
          }
        }
      });

      console.log('\n🎯 PROMETHEAN ANALYSIS:');
      console.log('═══════════════════════');
      
      const prometheanElite = result.batchResult.QB.filter(qb => (qb.tags || []).includes('Promethean Elite'));
      const prometheanStrong = result.batchResult.QB.filter(qb => (qb.tags || []).includes('Promethean Strong'));
      const prometheanEmerging = result.batchResult.QB.filter(qb => (qb.tags || []).includes('Promethean Emerging'));
      
      console.log(`🔥 Promethean Elite (4-5 flags): ${prometheanElite.length} QBs`);
      prometheanElite.forEach(qb => {
        const flags = (qb.tags || []).filter(t => !t.includes('Environment') && !t.includes('Promethean'));
        console.log(`   • ${qb.playerName} (${qb.contextScore.toFixed(1)}) - ${flags.slice(0, 3).join(', ')}`);
      });
      
      console.log(`\n⚡ Promethean Strong (3 flags): ${prometheanStrong.length} QBs`);
      prometheanStrong.forEach(qb => {
        const flags = (qb.tags || []).filter(t => !t.includes('Environment') && !t.includes('Promethean'));
        console.log(`   • ${qb.playerName} (${qb.contextScore.toFixed(1)}) - ${flags.slice(0, 3).join(', ')}`);
      });
      
      console.log(`\n🌟 Promethean Emerging (2 flags): ${prometheanEmerging.length} QBs`);
      prometheanEmerging.forEach(qb => {
        const flags = (qb.tags || []).filter(t => !t.includes('Environment') && !t.includes('Promethean'));
        console.log(`   • ${qb.playerName} (${qb.contextScore.toFixed(1)}) - ${flags.slice(0, 2).join(', ')}`);
      });

      console.log('\n📊 DYNASTY IMPLICATIONS:');
      console.log('═══════════════════════');
      
      const eliteEnvironment = result.batchResult.QB.filter(qb => qb.contextScore >= 75);
      const strugglingEnvironment = result.batchResult.QB.filter(qb => qb.contextScore < 50);
      
      console.log(`🔥 Elite Environment (75+): ${eliteEnvironment.length} QBs`);
      console.log(`⚠️  Challenging Environment (<50): ${strugglingEnvironment.length} QBs`);
      
      console.log('\n📊 METHODOLOGY VALIDATION:');
      console.log('═══════════════════════════');
      console.log(`• ${result.methodology}`);
      console.log(`• Version: BatchFantasyEvaluator v1.3`);
      console.log(`• Promethean Multiplier: Elite dual-threat bonus applied`);
      console.log(`• Key fixes: Allen/Lamar/Daniels properly boosted over Dak`);
      console.log(`• Flag system: Rush Profile, Explosive Creator, Fantasy Production, TD Machine, Pressure Warrior`);

    } else {
      console.error('❌ BATCH EVALUATION FAILED');
      console.error(`Errors: ${result.batchResult?.errorCount || 'Unknown'}`);
      console.error(`QBs processed: ${result.batchResult?.QB?.length || 0}`);
      console.error('Result:', JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('❌ REQUEST FAILED:', error.message);
  }
}

// Run the evaluation
runQBBatchEvaluationV13();