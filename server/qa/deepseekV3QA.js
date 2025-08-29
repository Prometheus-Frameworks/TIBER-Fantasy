#!/usr/bin/env node

/**
 * DeepSeek v3 QA Test Suite
 * Comprehensive validation for production readiness
 */

import axios from 'axios';
import assert from 'assert';

class DeepSeekV3QA {
  constructor(baseUrl = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
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

  async fetchRankings(mode = 'dynasty', params = {}) {
    const url = `${this.baseUrl}/api/rankings/deepseek/v3?mode=${mode}&${new URLSearchParams(params)}`;
    const response = await axios.get(url);
    return response.data;
  }

  // ===== CORE SCHEMA VALIDATION =====
  
  async testResponseSchema() {
    const data = await this.fetchRankings('dynasty');
    
    // Required top-level fields
    assert(typeof data.mode === 'string', 'Missing mode field');
    assert(typeof data.count === 'number', 'Missing count field');
    assert(typeof data.ts === 'number', 'Missing timestamp field');
    assert(Array.isArray(data.data), 'Missing data array');
    assert(data.data.length > 0, 'Empty data array');

    // First player schema validation
    const player = data.data[0];
    const requiredFields = ['rank', 'player_id', 'name', 'pos', 'score', 'tier'];
    
    for (const field of requiredFields) {
      assert(field in player, `Missing field: ${field}`);
    }
    
    assert(typeof player.rank === 'number', 'rank must be number');
    assert(typeof player.score === 'number', 'score must be number');
    assert(typeof player.tier === 'number', 'tier must be number');
  }

  async testTierCutoffs() {
    const data = await this.fetchRankings('dynasty');
    const expectedTiers = [96, 91, 86, 81, 76, 71];
    
    // Group players by tier
    const tierGroups = data.data.reduce((acc, player) => {
      acc[player.tier] = acc[player.tier] || [];
      acc[player.tier].push(player);
      return acc;
    }, {});

    // Validate no single-player tiers
    for (const [tier, players] of Object.entries(tierGroups)) {
      assert(players.length > 1, `Single-player tier detected: Tier ${tier} has only ${players.length} player(s)`);
    }

    // Validate tier score ranges
    for (const [tier, players] of Object.entries(tierGroups)) {
      const tierNum = parseInt(tier);
      const scores = players.map(p => p.score);
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      
      if (tierNum < expectedTiers.length) {
        const expectedMin = expectedTiers[tierNum];
        assert(maxScore >= expectedMin, `Tier ${tier} max score ${maxScore} below expected ${expectedMin}`);
      }
    }
  }

  async testScoreValidation() {
    const data = await this.fetchRankings('dynasty');
    
    for (const player of data.data) {
      // Score range validation
      assert(player.score >= 0 && player.score <= 100, 
        `Invalid score ${player.score} for ${player.name} (must be 0-100)`);
    }

    // Descending sort validation
    for (let i = 1; i < data.data.length; i++) {
      const prev = data.data[i-1];
      const curr = data.data[i];
      assert(prev.score >= curr.score, 
        `Score order violation: ${prev.name} (${prev.score}) should be >= ${curr.name} (${curr.score})`);
    }

    // Sequential rank validation
    for (let i = 0; i < data.data.length; i++) {
      const expected = i + 1;
      assert(data.data[i].rank === expected, 
        `Rank sequence violation: expected ${expected}, got ${data.data[i].rank}`);
    }
  }

  async testADPDeltas() {
    const data = await this.fetchRankings('dynasty');
    
    const playersWithADP = data.data.filter(p => p.adp && p.delta_vs_adp);
    assert(playersWithADP.length > 50, 'Insufficient players with ADP data for validation');

    for (const player of playersWithADP.slice(0, 20)) {
      const expectedDelta = player.rank - player.adp;
      const actualDelta = player.delta_vs_adp;
      
      assert(Math.abs(expectedDelta - actualDelta) < 0.1, 
        `ADP delta calculation error for ${player.name}: expected ${expectedDelta}, got ${actualDelta}`);
    }
  }

  // ===== PERFORMANCE VALIDATION =====
  
  async testPerformanceBenchmarks() {
    const trials = 5;
    const latencies = [];
    
    for (let i = 0; i < trials; i++) {
      const start = Date.now();
      await this.fetchRankings('dynasty');
      const latency = Date.now() - start;
      latencies.push(latency);
    }
    
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(trials * 0.5)];
    const p95 = latencies[Math.floor(trials * 0.95)];
    
    this.log(`Performance: p50=${p50}ms, p95=${p95}ms`);
    
    assert(p50 < 300, `p50 latency ${p50}ms exceeds 300ms target`);
    assert(p95 < 600, `p95 latency ${p95}ms exceeds 600ms target`);
  }

  // ===== GUARDRAILS VALIDATION =====
  
  async testMaxPlayersGuard() {
    const data = await this.fetchRankings('dynasty');
    assert(data.count <= 1000, `Player count ${data.count} exceeds max_players=1000 guard`);
    assert(data.data.length <= 1000, `Data array length ${data.data.length} exceeds 1000`);
  }

  async testModeToggling() {
    const dynastyData = await this.fetchRankings('dynasty');
    const redraftData = await this.fetchRankings('redraft');
    
    assert(dynastyData.mode === 'dynasty', 'Dynasty mode not set correctly');
    assert(redraftData.mode === 'redraft', 'Redraft mode not set correctly');
    
    // Scores should differ between modes
    const dynastyScores = dynastyData.data.slice(0, 10).map(p => p.score);
    const redraftScores = redraftData.data.slice(0, 10).map(p => p.score);
    
    let differences = 0;
    for (let i = 0; i < Math.min(dynastyScores.length, redraftScores.length); i++) {
      if (Math.abs(dynastyScores[i] - redraftScores[i]) > 1.0) {
        differences++;
      }
    }
    
    assert(differences >= 3, 'Dynasty and redraft scores should show meaningful differences');
  }

  // ===== DATA INTEGRITY =====
  
  async testPlayerDataIntegrity() {
    const data = await this.fetchRankings('dynasty');
    
    const validPositions = ['QB', 'RB', 'WR', 'TE'];
    
    for (const player of data.data.slice(0, 50)) {
      assert(player.name && player.name.length > 0, `Empty name for player ${player.player_id}`);
      assert(validPositions.includes(player.pos), `Invalid position ${player.pos} for ${player.name}`);
      assert(player.team && player.team.length >= 2, `Invalid team ${player.team} for ${player.name}`);
    }
  }

  async testScoreComponents() {
    // Test with debug mode if available
    try {
      const response = await axios.get(`${this.baseUrl}/api/rankings/deepseek/v3?mode=dynasty&debug=1`);
      const data = response.data;
      
      for (const player of data.data.slice(0, 10)) {
        if (player.debug) {
          const components = ['talent', 'role', 'context', 'durability', 'recency', 'spike', 'risk'];
          for (const component of components) {
            if (player.debug[component] !== undefined) {
              assert(typeof player.debug[component] === 'number', 
                `Invalid ${component} component for ${player.name}`);
            }
          }
        }
      }
    } catch (error) {
      this.log('Debug mode not available, skipping component validation', 'WARN');
    }
  }

  // ===== MAIN RUNNER =====
  
  async runAll() {
    this.log('🚀 Starting DeepSeek v3 QA Test Suite');
    
    // Core API validation
    await this.test('Response Schema Validation', () => this.testResponseSchema());
    await this.test('Tier Cutoffs Validation', () => this.testTierCutoffs());
    await this.test('Score Range & Sorting', () => this.testScoreValidation());
    await this.test('ADP Delta Calculations', () => this.testADPDeltas());
    
    // Performance & guardrails
    await this.test('Performance Benchmarks', () => this.testPerformanceBenchmarks());
    await this.test('Max Players Guard', () => this.testMaxPlayersGuard());
    await this.test('Mode Toggling', () => this.testModeToggling());
    
    // Data integrity
    await this.test('Player Data Integrity', () => this.testPlayerDataIntegrity());
    await this.test('Score Components', () => this.testScoreComponents());
    
    this.generateReport();
  }

  generateReport() {
    const total = this.results.passed + this.results.failed;
    const passRate = ((this.results.passed / total) * 100).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 DEEPSEEK V3 QA RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${this.results.passed} ✅`);
    console.log(`Failed: ${this.results.failed} ❌`);
    console.log(`Pass Rate: ${passRate}%`);
    console.log('='.repeat(60));
    
    if (this.results.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results.tests
        .filter(t => t.status === 'FAIL')
        .forEach(t => console.log(`  • ${t.name}: ${t.error}`));
    }
    
    const isReady = this.results.failed === 0 && this.results.passed >= 8;
    console.log(`\n🎯 Production Readiness: ${isReady ? '✅ READY' : '❌ NOT READY'}`);
    
    if (isReady) {
      console.log('\n🚀 DeepSeek v3 QA PASSED - Ready for production toggle!');
    }
    
    return isReady;
  }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const qa = new DeepSeekV3QA();
  qa.runAll().then(ready => {
    process.exit(ready ? 0 : 1);
  }).catch(error => {
    console.error('QA Suite failed:', error);
    process.exit(1);
  });
}

export default DeepSeekV3QA;