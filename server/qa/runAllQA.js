#!/usr/bin/env node

/**
 * Master QA Suite Runner
 * Executes all DeepSeek v3 QA tests and generates final report
 */

import DeepSeekV3QA from './deepseekV3QA.js';
import FrontendSmokeTest from './frontendSmokeTest.js';
import RegressionSuite from './regressionSuite.js';

class MasterQASuite {
  constructor(baseUrl = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
    this.results = {
      deepseekV3: null,
      frontend: null,
      regression: null
    };
  }

  log(message, status = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${status}] ${message}`);
  }

  async runDeepSeekV3QA() {
    this.log('Starting DeepSeek v3 Core QA...', 'SUITE');
    const qa = new DeepSeekV3QA(this.baseUrl);
    await qa.runAll();
    
    this.results.deepseekV3 = {
      passed: qa.results.passed,
      failed: qa.results.failed,
      ready: qa.results.failed === 0 && qa.results.passed >= 8
    };
    
    return this.results.deepseekV3.ready;
  }

  async runFrontendTests() {
    this.log('Starting Frontend Smoke Tests...', 'SUITE');
    const frontend = new FrontendSmokeTest(this.baseUrl);
    await frontend.runAll();
    
    this.results.frontend = {
      passed: frontend.results.passed,
      failed: frontend.results.failed,
      ready: frontend.results.failed === 0
    };
    
    return this.results.frontend.ready;
  }

  async runRegressionTests() {
    this.log('Starting Regression Tests...', 'SUITE');
    const regression = new RegressionSuite(this.baseUrl);
    await regression.runAll();
    
    this.results.regression = {
      passed: regression.results.passed,
      failed: regression.results.failed,
      ready: regression.results.failed === 0
    };
    
    return this.results.regression.ready;
  }

  async checkPrerequisites() {
    this.log('Checking prerequisites...', 'PREREQ');
    
    try {
      // Check server is running
      const { default: axios } = await import('axios');
      const response = await axios.get(`${this.baseUrl}/api/health`, { timeout: 5000 });
      
      // Check DeepSeek v3 endpoint exists
      await axios.get(`${this.baseUrl}/api/rankings/deepseek/v3?mode=dynasty`, { timeout: 10000 });
      
      this.log('✅ Prerequisites met', 'PREREQ');
      return true;
    } catch (error) {
      this.log(`❌ Prerequisite failed: ${error.message}`, 'PREREQ');
      return false;
    }
  }

  generateMasterReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 DEEPSEEK V3 QA MASTER REPORT');
    console.log('='.repeat(80));
    
    // Individual suite results
    const suites = [
      { name: 'DeepSeek v3 Core', result: this.results.deepseekV3 },
      { name: 'Frontend Smoke', result: this.results.frontend },
      { name: 'Legacy Regression', result: this.results.regression }
    ];
    
    let totalPassed = 0;
    let totalFailed = 0;
    let allReady = true;
    
    for (const suite of suites) {
      const status = suite.result.ready ? '✅ PASS' : '❌ FAIL';
      console.log(`${suite.name}: ${status} (${suite.result.passed}/${suite.result.passed + suite.result.failed})`);
      
      totalPassed += suite.result.passed;
      totalFailed += suite.result.failed;
      allReady = allReady && suite.result.ready;
    }
    
    console.log('='.repeat(80));
    console.log(`Total Tests: ${totalPassed + totalFailed}`);
    console.log(`Passed: ${totalPassed} ✅`);
    console.log(`Failed: ${totalFailed} ❌`);
    console.log(`Pass Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(80));
    
    // Final verdict
    if (allReady) {
      console.log('\n🚀 PRODUCTION READINESS: ✅ APPROVED');
      console.log('\n✅ DeepSeek v3 QA PASSED - Ready for production toggle!');
      console.log('\nTo go live:');
      console.log('1. Set dry_run: false in server/config/deepseek.v3.weights.json');
      console.log('2. Restart the application');
      console.log('3. Monitor /api/rankings/deepseek/v3 endpoint performance');
    } else {
      console.log('\n❌ PRODUCTION READINESS: NOT APPROVED');
      console.log('\nIssues must be resolved before production deployment.');
      
      // List specific issues
      if (!this.results.deepseekV3.ready) {
        console.log('• DeepSeek v3 core functionality has issues');
      }
      if (!this.results.frontend.ready) {
        console.log('• Frontend integration has issues');
      }
      if (!this.results.regression.ready) {
        console.log('• Regression detected from legacy system');
      }
    }
    
    console.log('\n' + '='.repeat(80));
    
    return allReady;
  }

  async runAll() {
    this.log('🎯 Starting DeepSeek v3 Master QA Suite', 'MASTER');
    
    // Check prerequisites
    const prereqsMet = await this.checkPrerequisites();
    if (!prereqsMet) {
      console.log('\n❌ Prerequisites not met. Ensure server is running and endpoints are accessible.');
      return false;
    }
    
    // Run all test suites
    try {
      await this.runDeepSeekV3QA();
      await this.runFrontendTests();
      await this.runRegressionTests();
      
      return this.generateMasterReport();
    } catch (error) {
      this.log(`Master QA suite failed: ${error.message}`, 'ERROR');
      return false;
    }
  }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const masterQA = new MasterQASuite();
  masterQA.runAll().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Master QA failed:', error);
    process.exit(1);
  });
}

export default MasterQASuite;