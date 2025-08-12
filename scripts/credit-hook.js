#!/usr/bin/env node
/**
 * OTC Credit Hook - Lightweight CI script
 * Parses commit trailers and appends to credits ledger on merge
 * 
 * Usage: node scripts/credit-hook.js [commit-sha]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CREDITS_FILE = path.join(process.cwd(), 'docs/internal/credits.json');

function parseCommitMessage(commitSha = 'HEAD') {
  try {
    const commitMessage = execSync(`git log -1 --pretty=format:"%B" ${commitSha}`, { encoding: 'utf8' });
    
    // Look for Credit: lines in commit message
    const creditRegex = /Credit:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*(.+)/gi;
    const matches = [...commitMessage.matchAll(creditRegex)];
    
    return matches.map(match => ({
      who: match[1].trim(),
      role: match[2].trim(),
      what: match[3].trim(),
      ref: commitSha.substring(0, 7),
      ts: new Date().toISOString()
    }));
  } catch (error) {
    console.error('[credit-hook] Failed to parse commit:', error.message);
    return [];
  }
}

function addCreditsToLedger(credits) {
  if (credits.length === 0) return;
  
  try {
    // Ensure credits file exists
    if (!fs.existsSync(CREDITS_FILE)) {
      const initialLedger = {
        project: "OTC",
        motto: "Serve Not Take",
        entries: []
      };
      fs.writeFileSync(CREDITS_FILE, JSON.stringify(initialLedger, null, 2));
    }
    
    // Read existing ledger
    const ledger = JSON.parse(fs.readFileSync(CREDITS_FILE, 'utf8'));
    
    // Append new credits
    ledger.entries.push(...credits);
    
    // Write back to file
    fs.writeFileSync(CREDITS_FILE, JSON.stringify(ledger, null, 2));
    
    console.log(`[credit-hook] Added ${credits.length} credit(s) to ledger:`);
    credits.forEach(credit => {
      console.log(`  → ${credit.who} (${credit.role}): ${credit.what}`);
    });
    
  } catch (error) {
    console.error('[credit-hook] Failed to update ledger:', error.message);
    process.exit(1);
  }
}

// Main execution
function main() {
  const commitSha = process.argv[2] || 'HEAD';
  console.log(`[credit-hook] Processing commit: ${commitSha}`);
  
  const credits = parseCommitMessage(commitSha);
  addCreditsToLedger(credits);
  
  if (credits.length === 0) {
    console.log('[credit-hook] No credit trailers found in commit message');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { parseCommitMessage, addCreditsToLedger };