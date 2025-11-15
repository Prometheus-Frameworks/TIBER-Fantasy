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

The Pressure Index is a **conceptual 0-100 scale** describing how close a player or situation is to a breakout or collapse.

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

Each contributes roughly 25% conceptually to total pressure state:

**1. Structural Pressure (Team/Scheme)**
Team situation, depth chart, scheme fit. A backup behind an aging starter has rising structural pressure. A locked-in RB1 with no competition has low structural pressure.

Examples: Depth chart position, offensive scheme fit, team situation and game script tendencies, coaching philosophy.

**2. Internal Pressure (Player Capability)**
Player talent and efficiency. High efficiency on low volume creates internal pressure - the player is showing capability that exceeds current usage.

Examples: Talent level relative to role, efficiency metrics when given chances, physical traits and skills, historical performance patterns.

**3. External Pressure (Environment)**
Schedule, opponents, surrounding cast. An RB facing soft run defenses has rising external pressure for production. Offensive line injuries create negative external pressure.

Examples: Opponent quality and schedule, surrounding cast changes (QB, OL, other positions), defensive attention shifting, league-wide trends affecting position.

**4. Latent Pressure (Hidden Potential)**
The most dangerous type - talent that hasn't been utilized yet. Often visible in limited sample efficiency or physical traits that scheme hasn't exploited.

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

Pressure accumulates **quietly before breakouts become obvious:**

1. **Usage and talent get out of sync** - Player shows efficiency but volume stays low
2. **Multiple pressure types align** - Structural (opportunity opening) + Internal (talent ready) + External (favorable conditions)
3. **Trigger event occurs** - Injury, coaching decision, scheme change
4. **Pressure releases** - Usage spike, breakout performance, role transformation

**Spotting Pressure Early**

**High-pressure profiles:**
- Efficient players with low volume (latent pressure)
- Rising snap rates without production yet (transitional pressure)
- Backup behind injury-prone starter (structural pressure building)
- Talent mismatch - skills better than current role (internal pressure)

**Low-pressure profiles:**
- Established usage with no efficiency improvement needed
- No depth chart threats or scheme changes coming
- Role perfectly matches current capability

**Common Pressure Triggers:**
- Starter injury (structural pressure release)
- Coaching change (scheme pressure shift)
- Trade deadline move (depth chart pressure change)
- Efficiency spike on volume increase (internal pressure validation)
- Opponent/schedule shift (external pressure change)`,
    metadata: {
      type: "pressure_teaching",
      layer_hint: "teaching",
      epistemic_status: "reasoning_tool",
      topic: "pressure_identification",
      content_type: "NARRATIVE",
      applicable_to: ["qb", "rb", "wr", "te"]
    }
  },

  // CHUNK 4: River Metaphors + Snap-Back Rules (River Layer)
  {
    content: `**River Voice: Pressure & Flow**

When philosophical questions arise about patterns, nature of breakouts, or cycles, these metaphors apply:

"Pressure builds long before it breaks."

"Patterns surface when tension finally reaches the banks."

"The river swells in silence before anyone hears it."

"Every breakout is just something long-contained finally finding a gap."

"Still water hides the strongest currents."

"What looks sudden to the surface was accumulating in the depths."

"The crack was always there. Pressure just needed to find it."

"Collapses and breakouts - same physics, different directions of flow."

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
    console.log('- Teaching Layer chunks: 3 (pressure_framework, pressure_components, pressure_teaching)');
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
