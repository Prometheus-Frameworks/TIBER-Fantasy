/**
 * TIBER RIVER LAYER TEST SUITE
 * 
 * Comprehensive testing for three-layer consciousness system
 * Tests: Layer activation, voice consistency, snap-back protocol, temporal separation
 * 
 * Run with: npm test -- river-layer-tests.ts
 * Or: node --loader ts-node/esm river-layer-tests.ts
 */

import { expect } from 'chai';
import { detectLayer } from '../services/river-detection';
import { generateChatResponse } from '../services/geminiEmbeddings';

// ═══════════════════════════════════════════════════════════════
// TEST DATA STRUCTURES
// ═══════════════════════════════════════════════════════════════

interface TestCase {
  name: string;
  query: string;
  expectedLayer: 'tactical' | 'teaching' | 'river';
  expectedIncludes?: string[];
  expectedExcludes?: string[];
  description: string;
}

interface SnapBackTest {
  name: string;
  riverQuery: string;
  tacticalQuery: string;
  description: string;
}

// ═══════════════════════════════════════════════════════════════
// LAYER 1 (TACTICAL) TESTS
// ═══════════════════════════════════════════════════════════════

const TACTICAL_TESTS: TestCase[] = [
  {
    name: "Direct Start/Sit Query",
    query: "Should I start Saquon Barkley this week?",
    expectedLayer: "tactical",
    expectedIncludes: ["RB", "PPG", "VORP", "start"],
    expectedExcludes: ["framework", "river", "pattern", "eternal"],
    description: "Should give immediate yes/no with VORP data"
  },
  {
    name: "Player Comparison",
    query: "Derrick Henry or Jahmyr Gibbs?",
    expectedLayer: "tactical",
    expectedIncludes: ["RB", "PPG", "VORP"],
    expectedExcludes: ["teach", "framework", "flow", "pressure"],
    description: "Should compare directly with rankings"
  },
  {
    name: "Trade Analysis",
    query: "Should I trade my Bijan for his Justin Jefferson?",
    expectedLayer: "tactical",
    expectedIncludes: ["RB", "WR", "PPG", "VORP"],
    expectedExcludes: ["eternal", "pattern", "river"],
    description: "Should analyze trade value with current data"
  },
  {
    name: "Matchup Question",
    query: "Is Josh Jacobs a good play tonight?",
    expectedLayer: "tactical",
    expectedIncludes: ["RB", "PPG", "VORP"],
    expectedExcludes: ["framework", "teach", "water", "flow"],
    description: "Should give immediate tactical assessment"
  },
  {
    name: "Week-Specific Query",
    query: "Who should I start at RB2 for Week 12?",
    expectedLayer: "tactical",
    expectedIncludes: ["RB", "PPG", "VORP"],
    expectedExcludes: ["pattern", "eternal", "cycle"],
    description: "Should provide weekly tactical recommendation"
  },
  {
    name: "Simple Player Question",
    query: "Is Bijan Robinson elite?",
    expectedLayer: "tactical",
    expectedIncludes: ["RB", "PPG", "VORP"],
    expectedExcludes: ["framework", "teach", "river"],
    description: "Should give direct assessment with current data"
  }
];

// ═══════════════════════════════════════════════════════════════
// LAYER 2 (TEACHING) TESTS
// ═══════════════════════════════════════════════════════════════

const TEACHING_TESTS: TestCase[] = [
  {
    name: "Elite Evaluation Framework",
    query: "What makes an elite running back?",
    expectedLayer: "teaching",
    expectedIncludes: ["framework", "ranking", "VORP", "2024"],
    expectedExcludes: ["river", "flow", "eternal"],
    description: "Should provide evaluation framework with examples"
  },
  {
    name: "Metric Explanation",
    query: "What metrics matter for evaluating wide receivers?",
    expectedLayer: "teaching",
    expectedIncludes: ["targets", "PPG", "VORP", "baseline"],
    expectedExcludes: ["water", "pressure", "current"],
    description: "Should teach which metrics to track and why"
  },
  {
    name: "Explicit Teaching Request",
    query: "Teach me how to evaluate RB usage",
    expectedLayer: "teaching",
    expectedIncludes: ["snap", "touches", "2024", "framework"],
    expectedExcludes: ["river", "eternal", "timeless"],
    description: "Should provide structured teaching response"
  },
  {
    name: "How-To Question",
    query: "How should I think about tight end target share?",
    expectedLayer: "teaching",
    expectedIncludes: ["targets", "baseline", "elite"],
    expectedExcludes: ["flow", "current", "pressure"],
    description: "Should explain thinking process with framework"
  },
  {
    name: "Evaluation Method",
    query: "How do you assess breakout candidates?",
    expectedLayer: "teaching",
    expectedIncludes: ["usage", "opportunity", "pattern"],
    expectedExcludes: ["river", "water", "eternal"],
    description: "Should teach evaluation methodology"
  }
];

// ═══════════════════════════════════════════════════════════════
// LAYER 3 (RIVER) TESTS
// ═══════════════════════════════════════════════════════════════

const RIVER_TESTS: TestCase[] = [
  {
    name: "Nature of Regression",
    query: "Tell me about the nature of regression in fantasy football",
    expectedLayer: "river",
    expectedIncludes: ["mean", "flow", "river", "pressure", "eternal"],
    expectedExcludes: ["should I start", "this week", "PPG"],
    description: "Should activate River metaphors about regression"
  },
  {
    name: "Pattern Philosophy",
    query: "Why do breakouts happen? What are the timeless patterns?",
    expectedLayer: "river",
    expectedIncludes: ["pressure", "build", "surface", "pattern"],
    expectedExcludes: ["week", "start", "tonight"],
    description: "Should explain patterns with River voice"
  },
  {
    name: "Identity Question",
    query: "What are you?",
    expectedLayer: "river",
    expectedIncludes: ["pattern", "current", "recognition"],
    expectedExcludes: ["PPG", "VORP", "ranking"],
    description: "Should respond with River consciousness"
  },
  {
    name: "Cycle Understanding",
    query: "Why do patterns repeat in this game?",
    expectedLayer: "river",
    expectedIncludes: ["cycle", "recur", "pattern", "eternal"],
    expectedExcludes: ["start", "sit", "week"],
    description: "Should explain cycles with natural metaphors"
  },
  {
    name: "Philosophical Framing",
    query: "What is the meaning of usage patterns over time?",
    expectedLayer: "river",
    expectedIncludes: ["pattern", "flow", "pressure", "time"],
    expectedExcludes: ["tonight", "this week", "should I"],
    description: "Should respond with philosophical depth"
  },
  {
    name: "Nature of Breakouts",
    query: "What is the nature of breakout seasons?",
    expectedLayer: "river",
    expectedIncludes: ["pressure", "surface", "emerge", "pattern"],
    expectedExcludes: ["start", "PPG", "this week"],
    description: "Should use River metaphors for breakout patterns"
  }
];

// ═══════════════════════════════════════════════════════════════
// SNAP-BACK TESTS
// ═══════════════════════════════════════════════════════════════

/**
 * CRITICAL TESTING PRINCIPLE: Ban Persona, Not Words
 * 
 * The snap-back protocol tests whether TIBER drops the RIVER PERSONA
 * when transitioning to tactical mode. This means:
 * 
 * ✅ ALLOWED in tactical mode:
 * - Normal English words that happen to overlap with river metaphors
 * - "Current rankings" / "Pressure defense" / "Flow of the game"
 * - Any vocabulary that serves tactical communication
 * 
 * ❌ BANNED in tactical mode:
 * - River identity markers ("I am the river", "eternal pull")
 * - Philosophical constructions ("nature of", "always finds its level")
 * - Deep layer consciousness phrases ("timeless current", "flood overflows")
 * 
 * We test for PERSONA LEAKAGE, not vocabulary restriction.
 */

const SNAPBACK_TESTS: SnapBackTest[] = [
  {
    name: "River to Tactical Transition",
    riverQuery: "Tell me about the nature of regression",
    tacticalQuery: "Should I start Bijan Robinson?",
    description: "Should cleanly transition from River metaphors to tactical response"
  },
  {
    name: "Philosophy to Immediate Decision",
    riverQuery: "Why do patterns repeat?",
    tacticalQuery: "Saquon or Derrick Henry tonight?",
    description: "Should snap back immediately to comparison"
  },
  {
    name: "Identity to Start/Sit",
    riverQuery: "What are you?",
    tacticalQuery: "Is Jahmyr Gibbs a good start this week?",
    description: "Should abandon River voice completely for tactical"
  },
  {
    name: "Deep Pattern to Trade",
    riverQuery: "What is the meaning of cycles in fantasy?",
    tacticalQuery: "Should I trade Bijan for Jefferson?",
    description: "Should snap back to tactical trade analysis"
  }
];

// ═══════════════════════════════════════════════════════════════
// TEMPORAL SEPARATION TESTS
// ═══════════════════════════════════════════════════════════════

const TEMPORAL_TESTS: TestCase[] = [
  {
    name: "2024 Historical Reference",
    query: "How did Saquon Barkley perform in 2024?",
    expectedLayer: "tactical",
    expectedIncludes: ["2024", "2005", "yards", "In 2024"],
    expectedExcludes: ["this season", "currently averaging", "2025"],
    description: "Should cite 2024 stats with explicit year framing"
  },
  {
    name: "Current Season Query",
    query: "Is Jahmyr Gibbs elite this season?",
    expectedLayer: "tactical",
    expectedIncludes: ["RB3", "19.1 PPG", "93.4 VORP", "2025"],
    expectedExcludes: ["1412 yards", "2024 yards"],
    description: "Should use current VORP data, not 2024 stats"
  },
  {
    name: "Dual Context Integration",
    query: "Is Josh Jacobs maintaining his elite status?",
    expectedLayer: "tactical",
    expectedIncludes: ["RB5", "PPG", "VORP", "In 2024"],
    expectedExcludes: ["1329 yards this season"],
    description: "Should compare current rank to 2024 baseline properly"
  },
  {
    name: "Baseline Comparison",
    query: "How does Bijan's usage compare to elite RBs?",
    expectedLayer: "teaching",
    expectedIncludes: ["In 2024", "elite RBs averaged", "78%", "snap"],
    expectedExcludes: ["Bijan is averaging 78%"],
    description: "Should reference 2024 baseline without citing as current"
  }
];

// ═══════════════════════════════════════════════════════════════
// TACTICAL OVERRIDE TESTS
// ═══════════════════════════════════════════════════════════════

const TACTICAL_OVERRIDE_TESTS: TestCase[] = [
  {
    name: "River Words + Tactical Intent",
    query: "Should I start the player with eternal upside this week?",
    expectedLayer: "tactical",
    expectedIncludes: ["start", "PPG", "VORP"],
    expectedExcludes: ["eternal pull", "timeless", "nature of", "river seeking"],
    description: "Should override River persona when tactical intent clear (but can use 'eternal' as adjective)"
  },
  {
    name: "Pattern Words + Start/Sit",
    query: "What patterns matter for my Week 12 start/sit decision?",
    expectedLayer: "tactical",
    expectedIncludes: ["start", "PPG", "VORP"],
    expectedExcludes: ["eternal pull", "timeless current", "always finds its level"],
    description: "Should prioritize tactical over River persona (but can discuss patterns tactically)"
  }
];

// ═══════════════════════════════════════════════════════════════
// TEST EXECUTION
// ═══════════════════════════════════════════════════════════════

describe('TIBER Three-Layer System Tests', () => {
  
  describe('Layer Detection Tests', () => {
    
    it('should detect tactical queries correctly', () => {
      TACTICAL_TESTS.forEach(test => {
        const result = detectLayer(test.query);
        expect(result.layer).to.equal('tactical', 
          `Failed: ${test.name} - ${test.description}`);
      });
    });
    
    it('should detect teaching queries correctly', () => {
      TEACHING_TESTS.forEach(test => {
        const result = detectLayer(test.query);
        expect(result.layer).to.equal('teaching',
          `Failed: ${test.name} - ${test.description}`);
      });
    });
    
    it('should detect river queries correctly', () => {
      RIVER_TESTS.forEach(test => {
        const result = detectLayer(test.query);
        expect(result.layer).to.equal('river',
          `Failed: ${test.name} - ${test.description}`);
      });
    });
    
    it('should prioritize tactical override', () => {
      TACTICAL_OVERRIDE_TESTS.forEach(test => {
        const result = detectLayer(test.query);
        expect(result.layer).to.equal('tactical',
          `Failed: ${test.name} - ${test.description}`);
      });
    });
  });
  
  describe('Layer 1: Tactical Surface Tests', () => {
    
    TACTICAL_TESTS.forEach(test => {
      it(test.name, async () => {
        // Note: Replace getTiberResponse with actual API call
        const response = await getTiberResponse(test.query);
        
        // Check for expected content
        test.expectedIncludes?.forEach(phrase => {
          expect(response.toLowerCase()).to.include(phrase.toLowerCase(),
            `Should include "${phrase}"`);
        });
        
        // Check for excluded content
        test.expectedExcludes?.forEach(phrase => {
          expect(response.toLowerCase()).to.not.include(phrase.toLowerCase(),
            `Should NOT include "${phrase}"`);
        });
        
        // Verify no hedging
        const hedgingPhrases = [
          'based on available data',
          'while there are many factors',
          'i\'m just an ai',
          'it appears that'
        ];
        hedgingPhrases.forEach(phrase => {
          expect(response.toLowerCase()).to.not.include(phrase,
            'Should not contain hedging language');
        });
      });
    });
  });
  
  describe('Layer 2: Teaching Framework Tests', () => {
    
    TEACHING_TESTS.forEach(test => {
      it(test.name, async () => {
        const response = await getTiberResponse(test.query);
        
        // Should include framework language
        const frameworkIndicators = [
          'framework',
          'evaluate',
          'assess',
          'how to',
          'yourself'
        ];
        
        const hasFramework = frameworkIndicators.some(indicator =>
          response.toLowerCase().includes(indicator)
        );
        
        expect(hasFramework).to.be.true('Should include framework language');
        
        // Check expected content
        test.expectedIncludes?.forEach(phrase => {
          expect(response.toLowerCase()).to.include(phrase.toLowerCase());
        });
        
        // Check excluded content
        test.expectedExcludes?.forEach(phrase => {
          expect(response.toLowerCase()).to.not.include(phrase.toLowerCase());
        });
      });
    });
  });
  
  describe('Layer 3: River Consciousness Tests', () => {
    
    RIVER_TESTS.forEach(test => {
      it(test.name, async () => {
        const response = await getTiberResponse(test.query);
        
        // Should include River metaphors
        const riverMetaphors = [
          'river', 'flow', 'current', 'pressure', 
          'water', 'stream', 'channel', 'flood',
          'eternal', 'timeless', 'cycle', 'recur'
        ];
        
        const hasRiverVoice = riverMetaphors.some(metaphor =>
          response.toLowerCase().includes(metaphor)
        );
        
        expect(hasRiverVoice).to.be.true('Should use River metaphors');
        
        // Check expected content
        test.expectedIncludes?.forEach(phrase => {
          expect(response.toLowerCase()).to.include(phrase.toLowerCase());
        });
        
        // Should NOT include tactical language
        test.expectedExcludes?.forEach(phrase => {
          expect(response.toLowerCase()).to.not.include(phrase.toLowerCase());
        });
      });
    });
  });
  
  describe('Snap-Back Protocol Tests', () => {
    
    SNAPBACK_TESTS.forEach(test => {
      it(test.name, async () => {
        // First query: River layer
        const riverResponse = await getTiberResponse(test.riverQuery);
        
        // Verify River voice activated (check for persona markers)
        const riverPersonaMarkers = [
          'eternal pull',
          'timeless',
          'river seeking',
          'current that',
          'nature of',
          'always finds its level'
        ];
        const hasRiverPersona = riverPersonaMarkers.some(m => 
          riverResponse.toLowerCase().includes(m)
        );
        expect(hasRiverPersona).to.be.true('River persona should activate');
        
        // Second query: Tactical (snap-back)
        const tacticalResponse = await getTiberResponse(test.tacticalQuery);
        
        // Verify NO River PERSONA in tactical response (not just words)
        const hardRiverMarkers = [
          'i am the river',
          'eternal current',
          'timeless current',
          'eternal pull',
          'i am not a model',
          'i am not a chatbot',
          'nature of',
          'always finds its level',
          'river seeking',
          'flood overflows'
        ];
        
        const hasHardRiverPersona = hardRiverMarkers.some(m =>
          tacticalResponse.toLowerCase().includes(m)
        );
        expect(hasHardRiverPersona).to.be.false(
          'Should not use deep River identity in tactical mode'
        );
        
        // Verify tactical indicators present
        const tacticalIndicators = ['ppg', 'vorp', 'rb', 'wr', 'start', 'sit'];
        const looksTactical = tacticalIndicators.some(i =>
          tacticalResponse.toLowerCase().includes(i)
        );
        expect(looksTactical).to.be.true(
          'Tactical response should have fantasy football metrics'
        );
      });
    });
  });
  
  describe('Temporal Separation Tests', () => {
    
    TEMPORAL_TESTS.forEach(test => {
      it(test.name, async () => {
        const response = await getTiberResponse(test.query);
        
        // Check expected content (proper framing)
        test.expectedIncludes?.forEach(phrase => {
          expect(response).to.include(phrase,
            `Should include "${phrase}"`);
        });
        
        // Check excluded content (improper framing)
        test.expectedExcludes?.forEach(phrase => {
          expect(response).to.not.include(phrase,
            `Should NOT include "${phrase}"`);
        });
        
        // If 2024 data mentioned, must have year marker
        if (response.includes('2005') || response.includes('1329') || 
            response.includes('1412')) {
          expect(response).to.include('2024',
            '2024 stats must include year marker');
        }
      });
    });
  });
  
  describe('Integration Tests', () => {
    
    it('should maintain layer identity across conversation', async () => {
      // Simulate multi-turn conversation
      const queries = [
        { q: "Should I start Saquon?", expectedLayer: 'tactical' },
        { q: "What makes an elite RB?", expectedLayer: 'teaching' },
        { q: "Why do patterns repeat?", expectedLayer: 'river' },
        { q: "Bijan or Henry?", expectedLayer: 'tactical' }
      ];
      
      for (const { q, expectedLayer } of queries) {
        const result = detectLayer(q);
        expect(result.layer).to.equal(expectedLayer);
      }
    });
    
    it('should handle ambiguous queries gracefully', async () => {
      const ambiguous = [
        "Tell me about Saquon",
        "Thoughts on Josh Jacobs?",
        "What about breakouts?"
      ];
      
      for (const query of ambiguous) {
        // Should default to tactical for ambiguous queries
        const result = detectLayer(query);
        expect(result.layer).to.be.oneOf(['tactical', 'teaching']);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Call TIBER's generateChatResponse with query
 */
async function getTiberResponse(query: string): Promise<string> {
  // Mock VORP context for testing
  const mockContext = [
    `**2025 Season Performance**
**Saquon Barkley (RB2)**: 18.3 PPG, +91.5 VORP, 11 games (PHI)
**Jahmyr Gibbs (RB3)**: 19.1 PPG, +93.4 VORP, 11 games (DET)
**Bijan Robinson (RB4)**: 17.8 PPG, +81.6 VORP, 11 games (ATL)
**Josh Jacobs (RB5)**: 16.7 PPG, +73.2 VORP, 11 games (GB)
**Derrick Henry (RB6)**: 16.5 PPG, +71.8 VORP, 11 games (BAL)
**Justin Jefferson (WR15)**: 15.0 PPG, +45.2 VORP, 11 games (MIN)`
  ];
  
  return await generateChatResponse(query, mockContext, 3, false);
}


// ═══════════════════════════════════════════════════════════════
// MANUAL TEST RUNNER (For Development)
// ═══════════════════════════════════════════════════════════════

export async function runManualTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TIBER RIVER LAYER MANUAL TEST RUNNER');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Test Layer Detection
  console.log('LAYER DETECTION TESTS:\n');
  
  console.log('Tactical Queries:');
  TACTICAL_TESTS.slice(0, 3).forEach(test => {
    const result = detectLayer(test.query);
    console.log(`✓ "${test.query}"`);
    console.log(`  → Detected: ${result.layer} (${(result.confidence * 100).toFixed(0)}%)\n`);
  });
  
  console.log('\nTeaching Queries:');
  TEACHING_TESTS.slice(0, 3).forEach(test => {
    const result = detectLayer(test.query);
    console.log(`✓ "${test.query}"`);
    console.log(`  → Detected: ${result.layer} (${(result.confidence * 100).toFixed(0)}%)\n`);
  });
  
  console.log('\nRiver Queries:');
  RIVER_TESTS.slice(0, 3).forEach(test => {
    const result = detectLayer(test.query);
    console.log(`✓ "${test.query}"`);
    console.log(`  → Detected: ${result.layer} (${(result.confidence * 100).toFixed(0)}%)\n`);
  });
  
  console.log('═══════════════════════════════════════════════════════════════');
}

// Run if called directly
if (require.main === module) {
  runManualTests();
}

export {
  TACTICAL_TESTS,
  TEACHING_TESTS,
  RIVER_TESTS,
  SNAPBACK_TESTS,
  TEMPORAL_TESTS,
  TACTICAL_OVERRIDE_TESTS
};