#!/usr/bin/env node

/**
 * Legacy v1 QA Regression Suite - Adapted for DeepSeek v3
 * Validates that core rating system principles remain intact
 */

import axios from 'axios';
import assert from 'assert';

class RegressionSuite {
  constructor(baseUrl = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
    this.results = { passed: 0, failed: 0, tests: [] };
  }

  log(message, status = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${status}] ${message}`);
  }

  async test(name, testFn) {
    try {
      this.log(`Running: ${name}`, 'TEST');
      await testFn();
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASS' });
      this.log(`✅ PASS: ${name}`, 'PASS');
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAIL', error: error.message });
      this.log(`❌ FAIL: ${name} - ${error.message}`, 'FAIL');
    }
  }

  async fetchRankings(mode = 'dynasty') {
    const response = await axios.get(`${this.baseUrl}/api/rankings/deepseek/v3?mode=${mode}`);
    return response.data;
  }

  // ===== SCORE SANITY CHECKS =====
  
  async testScoreRangeSanity() {
    const data = await this.fetchRankings('dynasty');
    
    let negativeScores = 0;
    let overHundredScores = 0;
    
    for (const player of data.data) {
      if (player.score < 0) negativeScores++;
      if (player.score > 100) overHundredScores++;
    }
    
    assert(negativeScores === 0, `Found ${negativeScores} players with negative scores`);
    assert(overHundredScores === 0, `Found ${overHundredScores} players with scores > 100`);
    
    // Check reasonable distribution
    const scores = data.data.map(p => p.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    
    assert(avgScore >= 30 && avgScore <= 70, `Average score ${avgScore} should be 30-70`);
    assert(minScore >= 0, `Minimum score ${minScore} should be >= 0`);
    assert(maxScore <= 100, `Maximum score ${maxScore} should be <= 100`);
    assert(maxScore - minScore >= 30, `Score spread ${maxScore - minScore} should be >= 30`);
  }

  async testCoverageValidation() {
    // Test that we have reasonable coverage across positions
    const data = await this.fetchRankings('dynasty');
    
    const positionCounts = {};
    for (const player of data.data) {
      positionCounts[player.pos] = (positionCounts[player.pos] || 0) + 1;
    }
    
    // Validate minimum coverage per position
    const minCounts = { QB: 20, RB: 40, WR: 60, TE: 15 };
    
    for (const [pos, minCount] of Object.entries(minCounts)) {
      const actualCount = positionCounts[pos] || 0;
      assert(actualCount >= minCount, 
        `Position ${pos} has ${actualCount} players, minimum ${minCount} required`);
    }
    
    // Total coverage check
    assert(data.count >= 200, `Total player count ${data.count} should be >= 200`);
  }

  async testPlayerProfileValidation() {
    const data = await this.fetchRankings('dynasty');
    
    let invalidAges = 0;
    let invalidTeams = 0;
    let invalidNames = 0;
    
    for (const player of data.data.slice(0, 100)) {
      // Age validation (if available)
      if (player.age) {
        if (player.age < 20 || player.age > 45) invalidAges++;
      }
      
      // Team validation
      if (!player.team || player.team.length < 2) invalidTeams++;
      
      // Name validation
      if (!player.name || player.name.length < 2) invalidNames++;
    }
    
    assert(invalidAges < 5, `Found ${invalidAges} players with unrealistic ages`);
    assert(invalidTeams === 0, `Found ${invalidTeams} players with invalid teams`);
    assert(invalidNames === 0, `Found ${invalidNames} players with invalid names`);
  }

  // ===== DYNASTY VS REDRAFT VALIDATION =====
  
  async testDynastyRedraftDifferences() {
    const dynastyData = await this.fetchRankings('dynasty');
    const redraftData = await this.fetchRankings('redraft');
    
    // Build lookup maps
    const dynastyMap = new Map();
    const redraftMap = new Map();
    
    dynastyData.data.forEach(p => dynastyMap.set(p.player_id, p));
    redraftData.data.forEach(p => redraftMap.set(p.player_id, p));
    
    // Find common players
    const commonPlayers = [];
    for (const [playerId, dynastyPlayer] of dynastyMap) {
      if (redraftMap.has(playerId)) {
        const redraftPlayer = redraftMap.get(playerId);
        commonPlayers.push({
          player_id: playerId,
          name: dynastyPlayer.name,
          dynasty_score: dynastyPlayer.score,
          redraft_score: redraftPlayer.score,
          score_diff: Math.abs(dynastyPlayer.score - redraftPlayer.score)
        });
      }
    }
    
    assert(commonPlayers.length >= 100, 'Should have at least 100 players in both formats');
    
    // Validate meaningful differences
    const significantDiffs = commonPlayers.filter(p => p.score_diff >= 5.0);
    assert(significantDiffs.length >= 20, 
      `Only ${significantDiffs.length} players show significant dynasty/redraft differences (need >= 20)`);
    
    // Log top differences for validation
    significantDiffs
      .sort((a, b) => b.score_diff - a.score_diff)
      .slice(0, 5)
      .forEach(p => this.log(
        `${p.name}: Dynasty ${p.dynasty_score} vs Redraft ${p.redraft_score} (diff: ${p.score_diff})`
      ));
  }

  // ===== TIER SYSTEM VALIDATION =====
  
  async testTierDistribution() {
    const data = await this.fetchRankings('dynasty');
    
    const tierCounts = {};
    for (const player of data.data) {
      tierCounts[player.tier] = (tierCounts[player.tier] || 0) + 1;
    }
    
    const tiers = Object.keys(tierCounts).map(Number).sort((a, b) => a - b);
    
    // Validate tier structure
    assert(tiers.length >= 5, `Need at least 5 tiers, found ${tiers.length}`);
    assert(tiers.length <= 8, `Too many tiers (${tiers.length}), maximum 8 for clarity`);
    
    // Validate no single-player tiers
    for (const [tier, count] of Object.entries(tierCounts)) {
      assert(count > 1, `Tier ${tier} has only ${count} player(s)`);
    }
    
    // Validate reasonable tier sizes
    const totalPlayers = Object.values(tierCounts).reduce((a, b) => a + b, 0);
    for (const [tier, count] of Object.entries(tierCounts)) {
      const percentage = (count / totalPlayers) * 100;
      assert(percentage <= 40, `Tier ${tier} contains ${percentage.toFixed(1)}% of players (should be <= 40%)`);
    }
  }

  // ===== MATHEMATICAL VALIDATION =====
  
  async testScoreNormalization() {
    const data = await this.fetchRankings('dynasty');
    
    // Group by position
    const positionGroups = {};
    for (const player of data.data) {
      if (!positionGroups[player.pos]) positionGroups[player.pos] = [];
      positionGroups[player.pos].push(player.score);
    }
    
    // Validate normalization within each position
    for (const [pos, scores] of Object.entries(positionGroups)) {
      scores.sort((a, b) => b - a);
      
      const top = scores[0];
      const bottom = scores[scores.length - 1];
      const median = scores[Math.floor(scores.length / 2)];
      
      // Top players should be near 100, bottom should be reasonable
      assert(top >= 50, `${pos} top score ${top} should be >= 50`);
      assert(bottom >= 0, `${pos} bottom score ${bottom} should be >= 0`);
      assert(top - bottom >= 20, `${pos} score spread ${top - bottom} should be >= 20`);
      
      this.log(`${pos}: Top=${top}, Median=${median}, Bottom=${bottom}, Spread=${top - bottom}`);
    }
  }

  // ===== MAIN RUNNER =====
  
  async runAll() {
    this.log('🔄 Starting Regression Test Suite (Legacy v1 → v3)');
    
    // Core validation
    await this.test('Score Range Sanity', () => this.testScoreRangeSanity());
    await this.test('Coverage Validation', () => this.testCoverageValidation());
    await this.test('Player Profile Validation', () => this.testPlayerProfileValidation());
    
    // Format differences
    await this.test('Dynasty vs Redraft Differences', () => this.testDynastyRedraftDifferences());
    
    // System integrity
    await this.test('Tier Distribution', () => this.testTierDistribution());
    await this.test('Score Normalization', () => this.testScoreNormalization());
    
    this.generateReport();
  }

  generateReport() {
    const total = this.results.passed + this.results.failed;
    const passRate = ((this.results.passed / total) * 100).toFixed(1);
    
    console.log('\n' + '='.repeat(50));
    console.log('🔄 REGRESSION TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${this.results.passed} ✅`);
    console.log(`Failed: ${this.results.failed} ❌`);
    console.log(`Pass Rate: ${passRate}%`);
    console.log('='.repeat(50));
    
    if (this.results.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results.tests
        .filter(t => t.status === 'FAIL')
        .forEach(t => console.log(`  • ${t.name}: ${t.error}`));
    }
    
    const isGreen = this.results.failed === 0;
    console.log(`\n🎯 Legacy Compatibility: ${isGreen ? '✅ GREEN' : '❌ REGRESSION DETECTED'}`);
    
    return isGreen;
  }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const regression = new RegressionSuite();
  regression.runAll().then(green => {
    process.exit(green ? 0 : 1);
  }).catch(error => {
    console.error('Regression suite failed:', error);
    process.exit(1);
  });
}

export default RegressionSuite;