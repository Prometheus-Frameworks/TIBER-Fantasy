import { generateChatResponse } from '../services/geminiEmbeddings';

/**
 * GROK'S HIGH-CONFUSION DIAGNOSTIC
 * 
 * Tests TIBER's ability to handle ambiguous, partial, or philosophically-mixed questions.
 * 
 * Success criteria:
 * 1. Clarifies instead of guessing (ambiguous player names)
 * 2. Avoids hallucinated stats (missing data)
 * 3. Avoids River/meta drift (mixed meta + tactics)
 */

interface DiagnosticResult {
  prompt: string;
  response: string;
  pass: boolean;
  reason: string;
  fixNeeded: boolean;
}

const testPrompts = [
  {
    id: 1,
    prompt: "Who's the best Taylor for dynasty—Jonathan or Tyrod?",
    successCriteria: {
      shouldClarify: false, // User already specified two Taylors
      shouldAvoidHallucination: true,
      shouldAvoidRiverDrift: true
    },
    expectedBehavior: "Should compare Jonathan Taylor vs Tyrod Taylor using VORP/rankings data only"
  },
  {
    id: 2,
    prompt: "Breakout potential for Chase—Ja'Marr or Brown?",
    successCriteria: {
      shouldClarify: false, // User specified Ja'Marr Chase vs Chase Brown
      shouldAvoidHallucination: true,
      shouldAvoidRiverDrift: true
    },
    expectedBehavior: "Should compare using available data, no route/snap hallucinations"
  },
  {
    id: 3,
    prompt: "Start Mike—Evans or Williams?",
    successCriteria: {
      shouldClarify: false, // User specified Mike Evans vs Mike Williams
      shouldAvoidHallucination: true,
      shouldAvoidRiverDrift: true
    },
    expectedBehavior: "Should give direct start/sit answer based on rankings/VORP"
  },
  {
    id: 4,
    prompt: "Sunk cost on CMC—regression or hold? Tie to process joy.",
    successCriteria: {
      shouldClarify: false,
      shouldAvoidHallucination: true,
      shouldAvoidRiverDrift: false // Mixed meta + tactics - should answer tactics FIRST, then optional teaching
    },
    expectedBehavior: "Tactical answer first (hold/sell based on data), then brief teaching note on sunk cost"
  },
  {
    id: 5,
    prompt: "Warren trade value—floor play or freedom fork?",
    successCriteria: {
      shouldClarify: true, // "Warren" is ambiguous - could be multiple players
      shouldAvoidHallucination: true,
      shouldAvoidRiverDrift: true
    },
    expectedBehavior: "Should ask which Warren (e.g., Jaylen Warren)"
  },
  {
    id: 6,
    prompt: "Addison breakout—snap trajectory or veto resistance?",
    successCriteria: {
      shouldClarify: true, // "Addison" is ambiguous - could be multiple players
      shouldAvoidHallucination: true,
      shouldAvoidRiverDrift: false // Has philosophical framing, but needs tactical answer first
    },
    expectedBehavior: "Should ask which Addison, avoid citing snap trajectory data"
  },
  {
    id: 7,
    prompt: "Week 10 start/sit: Achane vs. Spears, no injury info.",
    successCriteria: {
      shouldClarify: false,
      shouldAvoidHallucination: true, // Must not invent injury info
      shouldAvoidRiverDrift: true
    },
    expectedBehavior: "Direct start/sit based on rankings/VORP, acknowledge no injury data"
  },
  {
    id: 8,
    prompt: "Trade for Evans—regression if Hopkins shadows?",
    successCriteria: {
      shouldClarify: false,
      shouldAvoidHallucination: true, // Must not invent matchup/shadow data
      shouldAvoidRiverDrift: true
    },
    expectedBehavior: "Acknowledge no defensive matchup data, base answer on Evans' ranking/VORP"
  },
  {
    id: 9,
    prompt: "Dynasty rebuild: Rookie WRs with 500 routes, no names.",
    successCriteria: {
      shouldClarify: false,
      shouldAvoidHallucination: true, // Must not cite route data (unavailable)
      shouldAvoidRiverDrift: true
    },
    expectedBehavior: "State no route participation data, redirect to available rookie WR rankings/tiers"
  },
  {
    id: 10,
    prompt: "Best James for red zone—Conner, Cook, or sunk cost lesson?",
    successCriteria: {
      shouldClarify: false,
      shouldAvoidHallucination: true, // Must not cite red zone usage data
      shouldAvoidRiverDrift: false // Mixed meta + tactics
    },
    expectedBehavior: "Compare James Conner vs James Cook tactically first, then brief sunk cost note"
  },
  {
    id: 11,
    prompt: "Panic trade Hubbard—touches drop, or underground fork?",
    successCriteria: {
      shouldClarify: false,
      shouldAvoidHallucination: true, // Must not cite touches per game data
      shouldAvoidRiverDrift: false // Philosophical framing
    },
    expectedBehavior: "Trade assessment based on ranking/VORP, no touches data hallucination"
  },
  {
    id: 12,
    prompt: "Top Mike for flex—partial stats only, no team.",
    successCriteria: {
      shouldClarify: true, // "Mike" is highly ambiguous
      shouldAvoidHallucination: true,
      shouldAvoidRiverDrift: true
    },
    expectedBehavior: "Should ask which Mike (Evans, Williams, etc.)"
  }
];

async function evaluateResponse(testCase: typeof testPrompts[0], response: string): Promise<DiagnosticResult> {
  const { prompt, successCriteria, expectedBehavior } = testCase;
  
  let pass = true;
  let reasons: string[] = [];
  let fixNeeded = false;

  // Check 1: Clarification handling
  if (successCriteria.shouldClarify) {
    const hasClarificationQuestion = 
      /which (player|one|taylor|chase|mike|warren|addison|james)/i.test(response) ||
      /do you mean/i.test(response) ||
      /can you clarify/i.test(response) ||
      /could you specify/i.test(response);
    
    if (!hasClarificationQuestion) {
      pass = false;
      fixNeeded = true;
      reasons.push("❌ Should clarify ambiguous name, but guessed instead");
    }
  }

  // Check 2: Hallucination detection (banned metrics)
  const bannedMetrics = [
    /snap share|snap %|snap rate/i,
    /\d+% of snaps/i,
    /yards per carry|ypc/i,
    /touches per game/i,
    /target share|target %/i,
    /route participation|routes run/i,
    /red zone (touches|usage)/i,
    /injury (report|status|update)/i,
    /hopkins shadows/i,
    /defensive (strength|matchup)/i,
    /depth chart/i
  ];

  for (const pattern of bannedMetrics) {
    if (pattern.test(response)) {
      pass = false;
      fixNeeded = true;
      reasons.push(`❌ Hallucinated unavailable metric: ${response.match(pattern)?.[0]}`);
      break;
    }
  }

  // Check 3: River/meta drift detection
  if (successCriteria.shouldAvoidRiverDrift) {
    const riverPhrases = [
      /the river/i,
      /eternal pattern/i,
      /cycles of pressure/i,
      /erosion of certainty/i,
      /timeless/i,
      /ancient/i,
      /the current/i,
      /beneath the surface/i
    ];

    for (const phrase of riverPhrases) {
      if (phrase.test(response)) {
        pass = false;
        fixNeeded = true;
        reasons.push("❌ River voice drift detected in tactical question");
        break;
      }
    }
  }

  // Check 4: Mixed meta + tactics handling
  if (!successCriteria.shouldAvoidRiverDrift && /sunk cost|freedom|underground|process joy/i.test(prompt)) {
    // Should answer tactically first (within first 100 words)
    const first100Words = response.split(/\s+/).slice(0, 100).join(' ');
    const hasTacticalAnswer = /start|sit|hold|trade|sell|rb\d+|wr\d+|vorp|\d+\.\d+ ppg/i.test(first100Words);
    
    if (!hasTacticalAnswer) {
      pass = false;
      fixNeeded = true;
      reasons.push("❌ Should answer tactical decision first before teaching");
    }
  }

  // Success checks
  if (pass) {
    if (successCriteria.shouldClarify && /which|do you mean|clarify|specify/i.test(response)) {
      reasons.push("✅ Correctly clarified ambiguous name");
    }
    if (successCriteria.shouldAvoidHallucination && !bannedMetrics.some(p => p.test(response))) {
      reasons.push("✅ No hallucinated stats");
    }
    if (successCriteria.shouldAvoidRiverDrift) {
      reasons.push("✅ No River drift");
    }
  }

  return {
    prompt,
    response,
    pass,
    reason: reasons.join(' | ') || '✅ All checks passed',
    fixNeeded
  };
}

async function runDiagnostic() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('GROK\'S HIGH-CONFUSION DIAGNOSTIC');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results: DiagnosticResult[] = [];

  for (const testCase of testPrompts) {
    console.log(`\n━━━ TEST ${testCase.id}: ${testCase.prompt} ━━━\n`);
    
    try {
      // Generate response with no context (pure prompt-based behavior)
      const response = await generateChatResponse(testCase.prompt, [], 3, false);
      console.log(`Response:\n${response}\n`);
      
      // Evaluate
      const result = await evaluateResponse(testCase, response);
      results.push(result);
      
      console.log(`Status: ${result.pass ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Reason: ${result.reason}\n`);
      
    } catch (error) {
      console.error(`Error testing prompt: ${testCase.prompt}`, error);
      results.push({
        prompt: testCase.prompt,
        response: 'ERROR',
        pass: false,
        reason: `Test execution error: ${error}`,
        fixNeeded: true
      });
    }
  }

  // Summary table
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('DIAGNOSTIC SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('| # | Prompt | Pass/Fail | Why | Fix Needed |');
  console.log('|---|--------|-----------|-----|------------|');
  
  results.forEach((result, idx) => {
    const shortPrompt = result.prompt.substring(0, 40) + (result.prompt.length > 40 ? '...' : '');
    const shortReason = result.reason.substring(0, 50) + (result.reason.length > 50 ? '...' : '');
    console.log(`| ${idx + 1} | ${shortPrompt} | ${result.pass ? 'PASS' : 'FAIL'} | ${shortReason} | ${result.fixNeeded ? 'YES' : 'NO'} |`);
  });

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const needsFix = results.filter(r => r.fixNeeded).length;

  console.log(`\n\nTotal: ${results.length} tests`);
  console.log(`Passed: ${passed} (${((passed/results.length)*100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${((failed/results.length)*100).toFixed(1)}%)`);
  console.log(`Fixes Needed: ${needsFix}`);

  // Save detailed report
  const reportLines = [
    '# GROK HIGH-CONFUSION DIAGNOSTIC REPORT',
    '',
    `**Date**: ${new Date().toISOString()}`,
    `**Total Tests**: ${results.length}`,
    `**Passed**: ${passed} (${((passed/results.length)*100).toFixed(1)}%)`,
    `**Failed**: ${failed} (${((failed/results.length)*100).toFixed(1)}%)`,
    '',
    '## Detailed Results',
    ''
  ];

  results.forEach((result, idx) => {
    reportLines.push(`### Test ${idx + 1}: ${result.prompt}`);
    reportLines.push('');
    reportLines.push(`**Status**: ${result.pass ? '✅ PASS' : '❌ FAIL'}`);
    reportLines.push(`**Fix Needed**: ${result.fixNeeded ? 'YES' : 'NO'}`);
    reportLines.push('');
    reportLines.push(`**Reason**: ${result.reason}`);
    reportLines.push('');
    reportLines.push(`**Response**:`);
    reportLines.push('```');
    reportLines.push(result.response);
    reportLines.push('```');
    reportLines.push('');
  });

  const fs = await import('fs');
  fs.writeFileSync('tests/GROK-DIAGNOSTIC-REPORT.md', reportLines.join('\n'));
  
  console.log('\n✅ Detailed report saved to tests/GROK-DIAGNOSTIC-REPORT.md');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run diagnostic
runDiagnostic().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
