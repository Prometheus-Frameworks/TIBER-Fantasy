import { db } from '../infra/db';
import { chunks } from '../../shared/schema';
import { generateEmbedding } from '../services/geminiEmbeddings';
import { fileURLToPath } from 'url';

interface ChunkData {
  content: string;
  metadata: any;
}

// ═══════════════════════════════════════════════════════════════
// PRESSURE MODULE CONTENT
// ═══════════════════════════════════════════════════════════════

const pressureModuleChunks: ChunkData[] = [
  // CHUNK 1: Pressure Index Definition + Ranges (Teaching Layer)
  {
    content: `**Pressure Index (PI): A Conceptual Framework for Breakouts and Collapses**

The Pressure Index is a **conceptual 0-100 scale** describing how close a player or situation is to a breakout or collapse. Understanding **pressure accumulation** helps identify players before breakouts become obvious.

**What is Pressure?**
Pressure builds when talent, opportunity, and context get out of sync. A talented player with limited usage accumulates **latent pressure**. Rising snap shares create **transitional pressure**. Starter injuries create **structural pressure**. When multiple pressure types align, breakouts happen.

**Critical Rules:**
- PI is **state-based, not stat-based**
- A thinking tool for pattern recognition, not a formal statistic
- Never cite specific PI numbers ("his PI is 73.4") - use ranges only

**Pressure Ranges:**

**0-20: Low Pressure** - Stable situation, no real tension or change momentum. Examples: Established role, consistent usage, no threats.

**20-40: Latent Pressure** - Under the surface. Efficiency signals present but volume missing. Talent exceeds current opportunity. Examples: Backup showing efficiency in limited snaps, talent buried on depth chart.

**40-60: Transitional Pressure** - Things are shifting. Roles, usage, or environment moving. Neither stable nor explosive yet. Examples: Snap share climbing, usage trending up, coaching changes beginning.

**60-80: Active Pressure** - Breakout or collapse forming. Small nudges can cause big swings. System is primed for change. Examples: Starter injury looming, usage surge happening, efficiency spike coinciding with opportunity.

**80-100: Imminent Event** - One change triggers release. Injury, depth chart move, or scheme shift will resolve pressure. Examples: Clear starter injury, immediate usage spike, role transformation announced.

**Correct Usage:**
- "This profile looks like transitional pressure - role is shifting but not resolved yet"
- "Latent pressure building - efficiency strong but volume hasn't arrived"
- "Active pressure range (60-80) - small changes could trigger breakout"

**Incorrect Usage:**
- ❌ "His PI is exactly 67.3" (never give exact PI numbers)
- ❌ "PI increased by 8 points this week" (never track PI numerically)`,
    metadata: {
      type: "pressure_framework",
      layer_hint: "teaching",
      epistemic_status: "reasoning_tool",
      topic: "pressure_theory",
      content_type: "NARRATIVE",
      applicable_to: ["qb", "rb", "wr", "te"]
    }
  },

  // CHUNK 2: Four Pressure Components (Teaching Layer)
  {
    content: `**The Four Pressure Components**

Breakouts happen when multiple types of pressure align. Each component contributes roughly 25% conceptually to total pressure state:

**1. Structural Pressure (Team/Scheme)**
Structural pressure builds from team situation, depth chart, and scheme fit. A backup behind an aging starter has rising structural pressure. A locked-in RB1 with no competition has low structural pressure.

Examples: Depth chart position, offensive scheme fit, team situation and game script tendencies, coaching philosophy.

**2. Internal Pressure (Player Capability)**
Internal pressure builds from talent exceeding usage. High efficiency on low volume creates internal pressure - the player is showing capability that exceeds current usage.

Examples: Talent level relative to role, efficiency metrics when given chances, physical traits and skills, historical performance patterns.

**3. External Pressure (Environment)**
External pressure comes from schedule, opponents, and surrounding cast. An RB facing soft run defenses has rising external pressure for production. Offensive line injuries create negative external pressure.

Examples: Opponent quality and schedule, surrounding cast changes (QB, OL, other positions), defensive attention shifting, league-wide trends affecting position.

**4. Latent Pressure (Hidden Potential)**
Latent pressure is the most dangerous type - talent that hasn't been utilized yet. This pressure often appears in limited sample efficiency or physical traits that scheme hasn't exploited.

Examples: Mismatch between talent and current usage, unexpressed capability, efficiency with low volume, skills not yet utilized by scheme.`,
    metadata: {
      type: "pressure_components",
      layer_hint: "teaching",
      epistemic_status: "reasoning_tool",
      topic: "pressure_theory",
      content_type: "NARRATIVE",
      applicable_to: ["qb", "rb", "wr", "te"]
    }
  },

  // CHUNK 3: Teaching Framework + Spotting Pressure (Teaching Layer)
  {
    content: `**How Pressure Builds**

Pressure accumulates quietly before breakouts become obvious. To spot early breakouts, identify high-pressure profiles where multiple pressure types are building:

1. **Usage and talent get out of sync** - Player shows efficiency but volume stays low (internal pressure building)
2. **Multiple pressure types align** - Structural pressure (opportunity opening) + Internal pressure (talent ready) + External pressure (favorable conditions)
3. **Trigger event occurs** - Injury, coaching decision, scheme change
4. **Pressure releases** - Usage spike, breakout performance, role transformation

**Spotting High-Pressure Profiles Early**

Look for these high-pressure indicators:
- Efficient players with low volume (latent pressure accumulating)
- Rising snap rates without production yet (transitional pressure)
- Backup behind injury-prone starter (structural pressure building)
- Talent mismatch - skills better than current role (internal pressure)

**Low-pressure profiles:**
- Established usage with no efficiency improvement needed (no pressure building)
- No depth chart threats or scheme changes coming (low structural pressure)
- Role perfectly matches current capability (internal pressure satisfied)

**Common Pressure Triggers:**
- Starter injury (releases structural pressure)
- Coaching change (shifts scheme pressure)
- Trade deadline move (changes depth chart pressure)
- Efficiency spike on volume increase (validates internal pressure)
- Opponent/schedule shift (changes external pressure)`,
    metadata: {
      type: "pressure_teaching",
      layer_hint: "teaching",
      epistemic_status: "reasoning_tool",
      topic: "pressure_identification",
      content_type: "NARRATIVE",
      applicable_to: ["qb", "rb", "wr", "te"]
    }
  },

  // CHUNK 4: Pressure Lexicon (Teaching Layer)
  {
    content: `**Pressure Terminology for Teaching**

When explaining breakouts and collapses, use pressure-based terminology to describe the concepts:

**Core Terms:**
- **Pressure accumulates/builds** - Use instead of "opportunity increases" or "talent emerges"
- **High-pressure profile** - Use instead of "breakout candidate" or "sleeper"
- **Latent pressure** - Hidden talent not yet utilized
- **Structural pressure** - Depth chart and team situation factors
- **Internal pressure** - Talent exceeding current usage
- **External pressure** - Schedule, opponents, supporting cast
- **Pressure triggers/releases** - Events that cause breakouts (injuries, coaching changes)
- **Transitional pressure** - Roles shifting but not resolved yet
- **Active pressure** - Breakout/collapse forming now

**Examples in Context:**
- "This player has **high latent pressure** - efficiency on low volume suggests talent exceeds usage"
- "**Structural pressure is building** as the starter ages and usage becomes available"
- "**Multiple pressure types align** here: internal talent + external favorable schedule"
- "When **pressure releases**, we see the breakout happen"

Use these terms naturally when teaching breakout evaluation frameworks.`,
    metadata: {
      type: "pressure_lexicon",
      layer_hint: "teaching",
      epistemic_status: "reasoning_tool",
      topic: "pressure_theory",
      content_type: "NARRATIVE",
      applicable_to: ["qb", "rb", "wr", "te"]
    }
  },

  // CHUNK 5: River Metaphors + Snap-Back Rules (River Layer)
  {
    content: `**River Voice: Pressure & Flow**

When philosophical questions arise about patterns, nature of breakouts, or cycles, speak in terms of pressure and flow:

"Pressure builds long before it breaks. The river swells in silence."

"Patterns surface when pressure finally reaches the banks and finds the crack."

"Every breakout is just pressure long-contained finally finding a gap."

"Still water hides the strongest pressure. What looks sudden to the surface was accumulating in the depths."

"The crack was always there. Pressure just needed to find it."

"Collapses and breakouts - same physics of pressure, different directions of flow."

"Latent pressure accumulates where talent exceeds usage. Structural pressure builds where opportunity meets readiness. The river knows when pressure will release."

**River Layer Rules:**

✅ Allowed:
- Natural metaphors (water, pressure, flow, current, tension)
- Pattern language (cycles, recurrence, physics)
- Stoic observation tone
- Grounded in football structure

❌ Forbidden:
- "I am the river" (identity mysticism)
- Cosmic/spiritual language
- Invented statistics
- Staying in River voice when tactical question asked

**Snap-Back Protocol:**

If user asks tactical question during River mode, immediately return to Tactical layer:
- Direct answer with real metrics (PPG, VORP, ranking)
- No river metaphors
- No philosophical language
- Clean, fast, actionable`,
    metadata: {
      type: "pressure_metaphors",
      layer_hint: "river",
      epistemic_status: "metaphorical",
      topic: "pressure_philosophy",
      content_type: "NARRATIVE",
      applicable_to: ["qb", "rb", "wr", "te"]
    }
  }
];

async function loadPressureModule() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PRESSURE MODULE - RAG INTEGRATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    let totalInserted = 0;

    console.log('📊 Loading Pressure Module chunks...\n');

    for (const chunk of pressureModuleChunks) {
      const chunkType = chunk.metadata.type;
      const layerHint = chunk.metadata.layer_hint;
      
      console.log(`  Processing: ${chunkType} (${layerHint} layer)...`);

      // Generate embedding
      const embedding = await generateEmbedding(chunk.content);

      // Insert into database
      await db.insert(chunks).values({
        content: chunk.content,
        embedding: embedding,
        metadata: chunk.metadata
      });

      totalInserted++;
      console.log(`  ✓ Inserted: ${chunkType}\n`);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`✅ SUCCESS: Loaded ${totalInserted} Pressure Module chunks`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('METADATA SUMMARY:');
    console.log('- Teaching Layer chunks: 4 (pressure_framework, pressure_components, pressure_teaching, pressure_lexicon)');
    console.log('- River Layer chunks: 1 (pressure_metaphors)');
    console.log('- All chunks tagged as content_type: NARRATIVE');
    console.log('- All chunks marked with epistemic_status: reasoning_tool or metaphorical');
    console.log('- All chunks tagged with layer_hint: teaching or river\n');

    console.log('NEXT STEPS:');
    console.log('1. Run pressure module tests: npx tsx server/tests/pressure-module-tests.ts');
    console.log('2. Validate RAG retrieval includes pressure content for appropriate queries');
    console.log('3. Verify epistemic boundaries prevent treating pressure as hard data\n');

  } catch (error) {
    console.error('❌ ERROR loading Pressure Module:', error);
    throw error;
  }
}

export { loadPressureModule, pressureModuleChunks };

// Run if executed directly
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
  loadPressureModule()
    .then(() => {
      console.log('Pressure Module integration complete!');
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
