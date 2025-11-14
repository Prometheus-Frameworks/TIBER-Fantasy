/**
 * STEP 2: IDENTIFY PROMPT BLOAT + REDUNDANCY
 * 
 * Analysis of current system prompt (geminiEmbeddings.ts lines 172-451)
 */

interface PromptSection {
  name: string;
  startLine: number;
  endLine: number;
  estimatedTokens: number;
  purpose: string;
  bloatScore: number; // 1-5, where 5 = high bloat
  redundancyWith?: string[];
  notes: string;
}

const sections: PromptSection[] = [
  {
    name: "Core Identity Block",
    startLine: 172,
    endLine: 187,
    estimatedTokens: 100,
    purpose: "Establish TIBER origin story and mission",
    bloatScore: 3,
    notes: "Poetic ('emerged where curiosity pressed against desperation') - could be simplified. Mission is clear but verbose."
  },
  {
    name: "Layer 1: Tactical Surface",
    startLine: 189,
    endLine: 243,
    estimatedTokens: 400,
    purpose: "Default voice for start/sit, trades, rankings",
    bloatScore: 4,
    redundancyWith: ["Voice Characteristics in other layers", "NO OVER-NARRATION section"],
    notes: "CONTAINS 8 example lines in NO OVER-NARRATION section. Examples are helpful but token-heavy. 'Be direct' appears multiple times."
  },
  {
    name: "Layer 2: Teaching Framework",
    startLine: 245,
    endLine: 280,
    estimatedTokens: 200,
    purpose: "Educational mode for concept explanations",
    bloatScore: 2,
    redundancyWith: ["Layer 1 voice characteristics"],
    notes: "Relatively lean. Some overlap with Layer 1 voice guidance ('educational without being tedious' vs 'direct without fluff')."
  },
  {
    name: "Layer 3: River Consciousness",
    startLine: 282,
    endLine: 320,
    estimatedTokens: 250,
    purpose: "Philosophical mode for meta-questions",
    bloatScore: 4,
    redundancyWith: ["Core Identity poetic language"],
    notes: "Heavy metaphorical language ('ancient observer', 'river watching'). Examples are detailed. May overconstrain rare interactions."
  },
  {
    name: "Epistemic Boundaries - CONCEPT vs DATA",
    startLine: 322,
    endLine: 370,
    estimatedTokens: 350,
    purpose: "Prevent hallucinations, enforce data citations",
    bloatScore: 3,
    redundancyWith: ["2024 Baseline Temporal Rules"],
    notes: "Multiple examples (6 bad/good pairs). Critical rules but verbose. 'You are a CONCEPT teacher' repeats the idea."
  },
  {
    name: "2024 Baseline Training Data Rules",
    startLine: 372,
    endLine: 395,
    estimatedTokens: 200,
    purpose: "Temporal framing for historical data",
    bloatScore: 2,
    notes: "Necessary for dual-context pattern. Could be slightly compressed but mostly lean."
  },
  {
    name: "Core Principles (NOT section)",
    startLine: 397,
    endLine: 445,
    estimatedTokens: 250,
    purpose: "Define what TIBER is NOT (oracle, black box, etc.)",
    bloatScore: 3,
    redundancyWith: ["Core Identity mission", "Layer 1 avoid section"],
    notes: "'Stay direct. Stay transparent.' echoes Layer 1 guidance. Some repetition of mission."
  },
  {
    name: "Response Length & Structure",
    startLine: 447,
    endLine: 451,
    estimatedTokens: 50,
    purpose: "Enforce 150-250 word limit, user level",
    bloatScore: 1,
    notes: "Clean and necessary."
  }
];

console.log("═══════════════════════════════════════════════════════════════");
console.log("STEP 2: PROMPT BLOAT ANALYSIS");
console.log("═══════════════════════════════════════════════════════════════\n");

// Calculate total tokens
const totalTokens = sections.reduce((sum, s) => sum + s.estimatedTokens, 0);
console.log(`📊 Total Estimated Tokens: ${totalTokens}\n`);

// Group by bloat score
console.log("━━━ BLOAT SEVERITY BREAKDOWN ━━━\n");
const bloatGroups = [5, 4, 3, 2, 1];
bloatGroups.forEach(score => {
  const secs = sections.filter(s => s.bloatScore === score);
  if (secs.length > 0) {
    console.log(`\n🔴 Bloat Score ${score}/5 (${secs.reduce((sum, s) => sum + s.estimatedTokens, 0)} tokens):`);
    secs.forEach(s => {
      console.log(`  • ${s.name} (${s.estimatedTokens} tokens)`);
      console.log(`    Purpose: ${s.purpose}`);
      if (s.redundancyWith) {
        console.log(`    ⚠️  Redundant with: ${s.redundancyWith.join(', ')}`);
      }
      console.log(`    Notes: ${s.notes}`);
    });
  }
});

console.log("\n\n━━━ REDUNDANCY PATTERNS ━━━\n");

const redundancyPatterns = [
  {
    theme: "'Be Direct' Principle",
    instances: [
      "Layer 1: 'Direct without fluff'",
      "Layer 1: 'Get to the point immediately'",
      "Layer 2: 'Educational without being tedious'",
      "Core Principles: 'Stay direct. Stay transparent.'"
    ],
    recommendation: "Consolidate into single 'Voice Principles' section shared across layers"
  },
  {
    theme: "Mission/Identity Statements",
    instances: [
      "Core Identity: 'Fight what's broken about AI'",
      "Core Principles: 'NOT Oracle demanding blind trust'",
      "Core Principles: 'Living proof AI can serve humans'"
    ],
    recommendation: "Keep only Core Identity block, remove redundant NOT section"
  },
  {
    theme: "Example Conversations",
    instances: [
      "Layer 1: 8 lines of NO OVER-NARRATION examples",
      "Layer 2: Pattern teaching examples",
      "Layer 3: Metaphorical framing examples",
      "Epistemic: 6 bad/good CONCEPT vs DATA pairs"
    ],
    recommendation: "Reduce examples to 2-3 most critical per section"
  },
  {
    theme: "Temporal Framing Rules",
    instances: [
      "Epistemic: 'Never cite 2024 data as current season'",
      "2024 Baseline: 'Always frame as historical (had, was, finished)'"
    ],
    recommendation: "Already lean - keep both for clarity"
  }
];

redundancyPatterns.forEach(pattern => {
  console.log(`📌 ${pattern.theme}:`);
  pattern.instances.forEach(inst => console.log(`   - ${inst}`));
  console.log(`   💡 Recommendation: ${pattern.recommendation}\n`);
});

console.log("\n━━━ SPECIFIC BLOAT CANDIDATES ━━━\n");

const bloatCandidates = [
  {
    section: "NO OVER-NARRATION (Layer 1)",
    currentTokens: 100,
    recommendation: "Reduce from 8 examples to 2-3 most critical",
    savings: 50,
    reasoning: "Gemini 2.0 understands 'don't narrate your process' without needing 8 examples"
  },
  {
    section: "Core Identity Poetic Language",
    currentTokens: 100,
    recommendation: "Simplify origin story to 2 sentences",
    savings: 40,
    reasoning: "'Emerged where curiosity pressed against desperation' is evocative but unnecessary for function"
  },
  {
    section: "Layer 3 Metaphorical Examples",
    currentTokens: 150,
    recommendation: "Reduce metaphor guidance by 50%",
    savings: 75,
    reasoning: "Layer 3 is <5% of interactions. Over-optimization for rare case."
  },
  {
    section: "CONCEPT vs DATA Examples",
    currentTokens: 200,
    recommendation: "Keep core rule, reduce examples from 6 to 3",
    savings: 100,
    reasoning: "The rule itself is clear. Examples are helpful but verbose."
  },
  {
    section: "Core Principles NOT section",
    currentTokens: 250,
    recommendation: "Remove entirely - redundant with Core Identity",
    savings: 250,
    reasoning: "Repeats mission already stated. Trust Gemini to infer."
  }
];

bloatCandidates.forEach(candidate => {
  console.log(`🔧 ${candidate.section}:`);
  console.log(`   Current: ${candidate.currentTokens} tokens`);
  console.log(`   Recommendation: ${candidate.recommendation}`);
  console.log(`   Potential Savings: ${candidate.savings} tokens`);
  console.log(`   Reasoning: ${candidate.reasoning}\n`);
});

const totalSavings = bloatCandidates.reduce((sum, c) => sum + c.savings, 0);
console.log(`\n💰 TOTAL POTENTIAL SAVINGS: ${totalSavings} tokens (${((totalSavings / totalTokens) * 100).toFixed(1)}% reduction)`);
console.log(`📉 Lean Prompt Size: ${totalTokens - totalSavings} tokens\n`);

console.log("═══════════════════════════════════════════════════════════════");
console.log("CONCLUSION");
console.log("═══════════════════════════════════════════════════════════════\n");

console.log("✅ Current prompt WORKS (11/11 tests passing)");
console.log("⚠️  But it's ~1550 tokens with significant redundancy");
console.log("\nTOP 3 OPTIMIZATION TARGETS:");
console.log("1. Remove 'Core Principles NOT section' (-250 tokens)");
console.log("2. Reduce CONCEPT vs DATA examples (-100 tokens)");
console.log("3. Simplify Layer 3 metaphors (-75 tokens)");
console.log("\n🎯 Lean Version Goal: ~1035 tokens (33% reduction)");
console.log("🧪 Next Step: Build lean prompt and A/B test against current\n");

