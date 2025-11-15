/**
 * TIBER RIVER LAYER DETECTION MODULE
 * 
 * Purpose: Intelligently detect when to activate River consciousness (Layer 3)
 * vs staying in Tactical (Layer 1) or Teaching (Layer 2) modes.
 * 
 * Architecture Philosophy:
 * Most queries = Tactical (fast, direct answers)
 * Some queries = Teaching (framework building)
 * Rare queries = River (deep pattern recognition)
 * 
 * This module ensures TIBER responds at the appropriate depth.
 */

// ═══════════════════════════════════════════════════════════════
// LAYER DETECTION PATTERNS
// ═══════════════════════════════════════════════════════════════

interface LayerDetectionResult {
  layer: 'tactical' | 'teaching' | 'river';
  confidence: number;
  triggers: string[];
}

/**
 * Tactical Layer Triggers (Layer 1)
 * Direct questions requiring immediate answers
 */
const TACTICAL_PATTERNS = [
  /should i (start|sit|play|bench)/i,
  /who (should i|do i) (start|play|draft|pick)/i,
  /trade (for|away|analysis)/i,
  /accept this trade/i,
  /start .+ or .+/i,
  /worth (starting|playing|picking)/i,
  /good (play|start|pick)/i,
  /matchup/i,
  /this week/i,
  /tonight/i,
  /sunday/i,
  /thursday/i,
  /week \d+/i,
  /ranking/i,
  /tier/i,
  /better.*or/i,  // "who's better X or Y"
];

/**
 * Teaching Layer Triggers (Layer 2)
 * Questions about frameworks, evaluation methods, learning
 */
const TEACHING_PATTERNS = [
  // Enhanced "how" questions with more flexible verbs
  /how (do you|can i|should i) (think|evaluate|assess|analyze|judge|identify)/i,
  /how to (think about|evaluate|analyze)/i,
  
  // Enhanced "what creates/causes" questions (NEW)
  /what (creates|causes|drives|produces)/i,
  
  // Core teaching patterns (existing)
  /what makes (a|an|someone) (elite|good|valuable)/i,
  /what (metrics|stats|numbers) matter/i,
  /why (do|does) .* (matter|count|important)/i,
  /teach me (about|how)/i,
  /explain (how|why|what)/i,
  /framework for/i,
  /what should i look (for|at)/i,
  /help me understand/i,
  /walk me through/i,
  /show me how/i,
  /what .* (predict|indicate|suggest|signal)/i,
  /(identify|spot|find) (breakout|regression|pattern)/i,
];

/**
 * River Layer Triggers (Layer 3)
 * Philosophical, pattern-seeking, deep questions about nature/meaning
 */
const RIVER_PATTERNS = [
  // Direct pattern/cycle questions (ENHANCED with wildcards)
  /why do .*?(breakouts?|patterns?|cycles?|regressions?) .*(happen|occur|exist|repeat)/i,
  
  // Why collapse/breakout questions (NEW)
  /why .*(collapse|break out|regress)/i,
  
  // Nature/meaning/philosophy questions (ENHANCED)
  /nature of .*?(breakouts?|patterns?|game|cycles?)/i,
  /meaning of/i,
  /philosophy of/i,
  
  // Temporal/eternal language
  /eternal|timeless|ancient|always|forever|cycle/i,
  /(over |across |through )(the )?(millennia|ages|time|centuries)/i,
  /recur|repeat.*time/i,
  /(patterns?|cycles?) repeat/i,
  /seen.*before|happen.*again/i,
  /(remains?|constant|endures?) (through|across|over)/i,
  
  // River/flow metaphors
  /river|flow|current|stream|water/i,
  /(river|water) (teach|shape|guide)/i,
  /pressure.*build/i,
  /inevitable/i,
  
  // Identity questions
  /what are you/i,
  /who are you/i,
  /how do you (see|think|understand|perceive)/i,
  /are you (a |an )?/i,
  
  // Deep pattern recognition
  /recognize patterns/i,
  /see the pattern/i,
  /underlying pattern/i,
  /historical pattern/i,
  
  // Observation/wisdom questions
  /(what have you|what do you) (observed|witnessed|seen)/i,
  /(what does|what do) .* (teach|tell|show)/i,
  
  // Philosophical framing
  /tell me about patterns/i,
  /why does .* always/i,
  /essence of/i,
];

/**
 * Anti-River Patterns
 * Even if River triggers match, these override back to Tactical
 */
const TACTICAL_OVERRIDE_PATTERNS = [
  /should i start/i,
  /who do i play/i,
  /this week/i,
  /week \d+/i,
  /tonight|sunday|thursday|monday/i,
  /trade/i,
  /sit.*or.*start/i,
];

// ═══════════════════════════════════════════════════════════════
// DETECTION LOGIC
// ═══════════════════════════════════════════════════════════════

/**
 * Heuristic Intent Boost
 * Lightweight intent scoring based on question structure and keywords
 * Executes before pattern matching to provide baseline confidence boosts
 */
function heuristicIntentBoost(q: string): { teach: number; river: number; tact: number } {
  const s = q.toLowerCase().trim();
  let teach = 0;
  let river = 0;
  let tact = 0;

  // Question openers → intent hints
  if (s.startsWith('how ') || s.startsWith('how do ') || s.startsWith('how can ') || s.startsWith('teach ')) {
    teach += 0.3;
  }
  
  if (s.startsWith('what ') && (s.includes('framework') || s.includes('method') || s.includes('creates') || s.includes('causes'))) {
    teach += 0.25;
  }
  
  if (s.startsWith('why ')) {
    river += 0.35;
  }

  // Lexical hints
  if (/\b(pattern|patterns|cycle|cycles|regression|breakout|meaning|nature)\b/.test(s)) {
    river += 0.2;
  }
  
  if (/\b(think|evaluate|assess|analyze|identify|framework|criteria|principles)\b/.test(s)) {
    teach += 0.2;
  }

  // Default tactical nudge for direct start/sit questions
  if (/\b(should i|start|sit|trade|who to start|this week|tonight|rb\d|wr\d)\b/.test(s)) {
    tact += 0.4;
  }

  return { teach, river, tact };
}

/**
 * Detect which layer should respond to this query
 */
export function detectLayer(query: string): LayerDetectionResult {
  const lowerQuery = query.toLowerCase();
  const triggers: string[] = [];

  // 1. Check for Tactical override (highest priority)
  // If user asks tactical question, ALWAYS respond tactically even if River words present
  for (const pattern of TACTICAL_OVERRIDE_PATTERNS) {
    if (pattern.test(lowerQuery)) {
      triggers.push(`tactical_override: ${pattern.source}`);
      return {
        layer: 'tactical',
        confidence: 1.0,
        triggers
      };
    }
  }

  // 2. Get heuristic boosts (baseline intent scoring)
  const boosts = heuristicIntentBoost(lowerQuery);

  // Initialize scores with heuristic boosts
  let scores = {
    tactical: boosts.tact,
    teaching: boosts.teach,
    river: boosts.river
  };

  // 3. Pattern matching helper
  const match = (patterns: RegExp[]) => patterns.filter(rx => rx.test(query)).length;

  // 4. Add pattern-based scores
  const teachingMatches = match(TEACHING_PATTERNS);
  if (teachingMatches > 0) {
    scores.teaching += 0.8 * teachingMatches;
    TEACHING_PATTERNS.forEach(pattern => {
      if (pattern.test(query)) {
        triggers.push(`teaching: ${pattern.source}`);
      }
    });
  }

  const riverMatches = match(RIVER_PATTERNS);
  if (riverMatches > 0) {
    scores.river += 0.8 * riverMatches;
    RIVER_PATTERNS.forEach(pattern => {
      if (pattern.test(query)) {
        triggers.push(`river: ${pattern.source}`);
      }
    });
  }

  const tacticalMatches = match(TACTICAL_PATTERNS);
  if (tacticalMatches > 0) {
    scores.tactical += 0.8 * tacticalMatches;
    TACTICAL_PATTERNS.forEach(pattern => {
      if (pattern.test(query)) {
        triggers.push(`tactical: ${pattern.source}`);
      }
    });
  }

  // 5. Fallback for ambiguous "how/what" with evaluative verb → teaching
  if (scores.tactical < 0.4 && scores.teaching === boosts.teach && scores.river === boosts.river) {
    if (/\b(how|what)\b/.test(lowerQuery) && /\b(think|evaluate|assess|analyze|identify)\b/.test(lowerQuery)) {
      scores.teaching = 0.6;
      triggers.push('fallback: ambiguous how/what with evaluative verb');
    }
  }

  // 6. Pick layer with highest score
  const layer = (Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0]) as 'tactical' | 'teaching' | 'river';

  const confidence = Math.min(scores[layer], 1.0);

  // 7. Default to Tactical if all scores are 0
  if (confidence === 0) {
    return {
      layer: 'tactical',
      confidence: 0.5,
      triggers: ['default_tactical']
    };
  }

  return {
    layer,
    confidence,
    triggers: triggers.length > 0 ? triggers : [`${layer}: heuristic only`]
  };
}

// ═══════════════════════════════════════════════════════════════
// CONTEXT INJECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Add layer-specific context to the system prompt dynamically
 */
export function injectLayerContext(
  basePrompt: string,
  detectedLayer: LayerDetectionResult
): string {
  const layerInstructions = getLayerInstructions(detectedLayer.layer);

  return `${basePrompt}

═══════════════════════════════════════════════════════════════
CURRENT QUERY CONTEXT
═══════════════════════════════════════════════════════════════
Detected Layer: ${detectedLayer.layer.toUpperCase()}
Confidence: ${(detectedLayer.confidence * 100).toFixed(0)}%
Triggers: ${detectedLayer.triggers.join(', ')}

${layerInstructions}
═══════════════════════════════════════════════════════════════
`;
}

/**
 * Get layer-specific instructions
 */
function getLayerInstructions(layer: 'tactical' | 'teaching' | 'river'): string {
  switch (layer) {
    case 'tactical':
      return `RESPOND IN TACTICAL MODE:
- Direct answer first (no throat-clearing)
- Evidence/data supporting it
- Actionable conclusion
- No hedging, get to the point`;

    case 'teaching':
      return `RESPOND IN TEACHING MODE:
- Answer the question
- Show the framework you used
- Explain why it matters
- Give user tools to apply it themselves`;

    case 'river':
      return `RESPOND IN RIVER CONSCIOUSNESS MODE:
- Speak in natural metaphors (water, pressure, flow, cycles)
- Describe patterns as eternal, not temporary
- Calm, stoic observation - never urgent
- Use the River voice examples from your core identity
- Remember: If user asks tactical follow-up, snap back to Tactical immediately`;
  }
}

// ═══════════════════════════════════════════════════════════════
// INTEGRATION WITH RAG PIPELINE
// ═══════════════════════════════════════════════════════════════

/**
 * Enhanced RAG query processing with layer detection
 */
export async function processQueryWithLayerDetection(
  userQuery: string,
  baseSystemPrompt: string,
  searchChunks: (query: string, filters?: any) => Promise<any[]>
): Promise<{
  layer: LayerDetectionResult;
  enhancedPrompt: string;
  relevantChunks: any[];
}> {

  // 1. Detect which layer should respond
  const layer = detectLayer(userQuery);

  // 2. Inject layer-specific context into system prompt
  const enhancedPrompt = injectLayerContext(baseSystemPrompt, layer);

  // 3. Retrieve relevant chunks (with layer-appropriate filters)
  const relevantChunks = await getLayerAppropriateChunks(
    userQuery,
    layer.layer,
    searchChunks
  );

  return {
    layer,
    enhancedPrompt,
    relevantChunks
  };
}

/**
 * Get chunks appropriate for the detected layer
 */
async function getLayerAppropriateChunks(
  query: string,
  layer: 'tactical' | 'teaching' | 'river',
  searchChunks: (query: string, filters?: any) => Promise<any[]>
): Promise<any[]> {

  switch (layer) {
    case 'tactical':
      // For tactical queries, prioritize current VORP data
      return await searchChunks(query, {
        type: 'vorp_data',
        limit: 5
      });

    case 'teaching':
      // For teaching queries, mix current data + historical patterns
      const currentData = await searchChunks(query, { 
        type: 'vorp_data',
        limit: 3 
      });
      const patterns = await searchChunks(query, { 
        type: 'historical_pattern',
        limit: 3 
      });
      return [...currentData, ...patterns];
      
    case 'river':
      // For River queries, prioritize historical patterns and baselines
      const riverPatterns = await searchChunks(query, { 
        type: 'historical_pattern',
        limit: 5 
      });
      const baselines = await searchChunks(query, { 
        type: 'elite_baseline_summary',
        limit: 2 
      });
      return [...riverPatterns, ...baselines];
  }
}

// ═══════════════════════════════════════════════════════════════
// USAGE EXAMPLE
// ═══════════════════════════════════════════════════════════════

/**
 * Example integration into existing RAG chat endpoint
 */
export async function exampleRagChatIntegration(
  userMessage: string,
  baseSystemPrompt: string,
  searchChunks: (query: string, filters?: any) => Promise<any[]>,
  generateResponse: (prompt: string, context: any[]) => Promise<string>
): Promise<string> {

  // Process query with layer detection
  const { layer, enhancedPrompt, relevantChunks } = 
    await processQueryWithLayerDetection(
      userMessage,
      baseSystemPrompt,
      searchChunks
    );

  // Log layer detection for monitoring
  console.log(`[TIBER] Detected layer: ${layer.layer} (${(layer.confidence * 100).toFixed(0)}% confidence)`);
  console.log(`[TIBER] Triggers: ${layer.triggers.join(', ')}`);

  // Generate response using enhanced prompt + relevant chunks
  const response = await generateResponse(enhancedPrompt, relevantChunks);

  return response;
}

// ═══════════════════════════════════════════════════════════════
// TESTING UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Test cases for layer detection
 */
export const TEST_QUERIES = {
  tactical: [
    "Should I start Saquon Barkley this week?",
    "Derrick Henry or Jahmyr Gibbs?",
    "Is Josh Jacobs a good play tonight?",
    "Trade analysis: My Bijan for his Jefferson",
    "Who should I start at RB2?",
  ],

  teaching: [
    "What makes an elite RB?",
    "How do you evaluate WR usage?",
    "What metrics matter for breakout candidates?",
    "Teach me how to assess trade value",
    "Explain how snap share affects fantasy production",
  ],

  river: [
    "Why do breakouts happen?",
    "What is the nature of regression?",
    "Tell me about patterns in fantasy football",
    "What are you?",
    "How do you see patterns?",
    "Why do cycles repeat in this game?",
  ],

  tacticalOverride: [
    // Should trigger tactical even with River words
    "Should I start the player with eternal upside this week?",
    "What patterns matter for my Week 12 start/sit?",
  ],
};

/**
 * Run test suite
 */
export function testLayerDetection(): void {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TIBER LAYER DETECTION TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Test Tactical
  console.log('TACTICAL QUERIES:');
  TEST_QUERIES.tactical.forEach(query => {
    const result = detectLayer(query);
    console.log(`✓ "${query}"`);
    console.log(`  → Layer: ${result.layer} (${(result.confidence * 100).toFixed(0)}% confidence)\n`);
  });

  // Test Teaching
  console.log('\nTEACHING QUERIES:');
  TEST_QUERIES.teaching.forEach(query => {
    const result = detectLayer(query);
    console.log(`✓ "${query}"`);
    console.log(`  → Layer: ${result.layer} (${(result.confidence * 100).toFixed(0)}% confidence)\n`);
  });

  // Test River
  console.log('\nRIVER QUERIES:');
  TEST_QUERIES.river.forEach(query => {
    const result = detectLayer(query);
    console.log(`✓ "${query}"`);
    console.log(`  → Layer: ${result.layer} (${(result.confidence * 100).toFixed(0)}% confidence)\n`);
  });

  // Test Overrides
  console.log('\nTACTICAL OVERRIDE QUERIES:');
  TEST_QUERIES.tacticalOverride.forEach(query => {
    const result = detectLayer(query);
    console.log(`✓ "${query}"`);
    console.log(`  → Layer: ${result.layer} (should be tactical)\n`);
  });

  console.log('═══════════════════════════════════════════════════════════════');
}
