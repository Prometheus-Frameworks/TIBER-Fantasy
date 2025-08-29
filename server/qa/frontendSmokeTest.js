#!/usr/bin/env node

/**
 * Frontend Smoke Test for /rankings/v3 page
 * Validates UI functionality and data display
 */

import axios from 'axios';
import assert from 'assert';

class FrontendSmokeTest {
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

  async testPageAccessibility() {
    // Test that the rankings v3 page route exists and serves content
    const response = await axios.get(`${this.baseUrl}/rankings/v3`);
    assert(response.status === 200, 'Page should return 200 status');
    assert(response.data.length > 1000, 'Page should serve substantial HTML content');
    assert(response.data.includes('DeepSeek v3'), 'Page should contain DeepSeek v3 branding');
  }

  async testAPIDataFetch() {
    // Test that the frontend API hooks would receive proper data
    const dynastyResponse = await axios.get(`${this.baseUrl}/api/rankings/deepseek/v3?mode=dynasty`);
    const redraftResponse = await axios.get(`${this.baseUrl}/api/rankings/deepseek/v3?mode=redraft`);
    
    assert(dynastyResponse.status === 200, 'Dynasty API should be accessible');
    assert(redraftResponse.status === 200, 'Redraft API should be accessible');
    
    const dynastyData = dynastyResponse.data;
    const redraftData = redraftResponse.data;
    
    // Validate data structure for frontend consumption
    assert(Array.isArray(dynastyData.data), 'Dynasty data should be array');
    assert(Array.isArray(redraftData.data), 'Redraft data should be array');
    assert(dynastyData.data.length > 0, 'Dynasty data should not be empty');
    assert(redraftData.data.length > 0, 'Redraft data should not be empty');
    
    // Check required frontend fields
    const samplePlayer = dynastyData.data[0];
    const frontendFields = ['rank', 'name', 'pos', 'team', 'score', 'tier'];
    
    for (const field of frontendFields) {
      assert(field in samplePlayer, `Missing frontend field: ${field}`);
    }
  }

  async testModeToggleData() {
    // Test that mode switching provides different data
    const dynastyData = await axios.get(`${this.baseUrl}/api/rankings/deepseek/v3?mode=dynasty`);
    const redraftData = await axios.get(`${this.baseUrl}/api/rankings/deepseek/v3?mode=redraft`);
    
    // Check that rankings differ between modes
    const dynastyTop5 = dynastyData.data.data.slice(0, 5).map(p => p.player_id);
    const redraftTop5 = redraftData.data.data.slice(0, 5).map(p => p.player_id);
    
    let differences = 0;
    for (let i = 0; i < 5; i++) {
      if (dynastyTop5[i] !== redraftTop5[i]) {
        differences++;
      }
    }
    
    assert(differences >= 1, 'Dynasty and redraft top 5 should show at least some differences');
  }

  async testTierColoringData() {
    // Test that tier data is suitable for color coding
    const response = await axios.get(`${this.baseUrl}/api/rankings/deepseek/v3?mode=dynasty`);
    const data = response.data.data;
    
    const tiers = [...new Set(data.map(p => p.tier))].sort((a, b) => a - b);
    assert(tiers.length >= 5, 'Should have at least 5 distinct tiers for color coding');
    assert(tiers.length <= 8, 'Should not have more than 8 tiers for UI clarity');
    
    // Check tier distribution
    const tierCounts = tiers.map(tier => ({
      tier,
      count: data.filter(p => p.tier === tier).length
    }));
    
    for (const { tier, count } of tierCounts) {
      assert(count > 1, `Tier ${tier} should have multiple players (has ${count})`);
    }
  }

  async testTimestampFreshness() {
    // Test that timestamp indicates recent data
    const response = await axios.get(`${this.baseUrl}/api/rankings/deepseek/v3?mode=dynasty`);
    const timestamp = response.data.ts;
    const now = Date.now();
    const ageMinutes = (now - timestamp) / (1000 * 60);
    
    assert(ageMinutes < 60, `Data timestamp is ${ageMinutes.toFixed(1)} minutes old (should be <60)`);
  }

  async testPositionDistribution() {
    // Test that all skill positions are represented
    const response = await axios.get(`${this.baseUrl}/api/rankings/deepseek/v3?mode=dynasty`);
    const data = response.data.data;
    
    const positions = [...new Set(data.map(p => p.pos))];
    const expectedPositions = ['QB', 'RB', 'WR', 'TE'];
    
    for (const pos of expectedPositions) {
      assert(positions.includes(pos), `Missing position: ${pos}`);
    }
    
    // Check reasonable distribution
    const positionCounts = expectedPositions.map(pos => ({
      pos,
      count: data.filter(p => p.pos === pos).length
    }));
    
    for (const { pos, count } of positionCounts) {
      assert(count >= 10, `Position ${pos} should have at least 10 players (has ${count})`);
    }
  }

  async runAll() {
    this.log('🎨 Starting Frontend Smoke Test Suite');
    
    await this.test('Page Accessibility', () => this.testPageAccessibility());
    await this.test('API Data Fetch', () => this.testAPIDataFetch());
    await this.test('Mode Toggle Data', () => this.testModeToggleData());
    await this.test('Tier Coloring Data', () => this.testTierColoringData());
    await this.test('Timestamp Freshness', () => this.testTimestampFreshness());
    await this.test('Position Distribution', () => this.testPositionDistribution());
    
    this.generateReport();
  }

  generateReport() {
    const total = this.results.passed + this.results.failed;
    const passRate = ((this.results.passed / total) * 100).toFixed(1);
    
    console.log('\n' + '='.repeat(50));
    console.log('🎨 FRONTEND SMOKE TEST RESULTS');
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
    
    const isReady = this.results.failed === 0;
    console.log(`\n🎯 Frontend Ready: ${isReady ? '✅ READY' : '❌ NOT READY'}`);
    
    return isReady;
  }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const test = new FrontendSmokeTest();
  test.runAll().then(ready => {
    process.exit(ready ? 0 : 1);
  }).catch(error => {
    console.error('Frontend test failed:', error);
    process.exit(1);
  });
}

export default FrontendSmokeTest;