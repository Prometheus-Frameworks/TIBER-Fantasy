import { GoogleGenAI } from "@google/genai";
import jargonMapping from '../data/nflfastr_jargon_mapping.json';
import { detectLayer, injectLayerContext } from './river-detection';
import { detectFormat, logFormatDetection } from '../lib/format-detector';

// DON'T DELETE THIS COMMENT
// Using blueprint:javascript_gemini for embeddings generation
// Gemini Developer API Key (not Vertex AI)

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

/**
 * Checks if a jargon term is queryable in current system
 * Returns data availability status and appropriate response guidance
 */
export function checkDataAvailability(jargonTerm: string): {
  available: boolean;
  responseGuidance: string;
  dataSource: string;
} {
  const mapping = jargonMapping[jargonTerm as keyof typeof jargonMapping];
  
  if (!mapping) {
    return {
      available: false,
      responseGuidance: `I don't have data for "${jargonTerm}".`,
      dataSource: 'Unknown metric'
    };
  }
  
  if (!mapping.queryable) {
    const note = 'note' in mapping ? mapping.note : '';
    const dataSource = 'data_source' in mapping ? mapping.data_source : 'Not available';
    return {
      available: false,
      responseGuidance: `I don't have access to ${jargonTerm} data. ${note}`,
      dataSource: dataSource as string
    };
  }
  
  return {
    available: true,
    responseGuidance: `${jargonTerm} is queryable`,
    dataSource: 'data_source' in mapping ? (mapping.data_source as string) : 'NFLfastR'
  };
}

/**
 * Pressure Lexicon Guard - Ensures teaching/river responses contain "pressure" terminology
 * when discussing breakouts/collapses. Enforces brand vocabulary compliance.
 * 
 * @param text The LLM response text
 * @param userQuery The original user query
 * @returns Text with pressure terminology guaranteed if appropriate
 */
function pressureLexiconGuard(text: string, userQuery: string): string {
  // Check if this query should trigger pressure terminology
  const detected = detectLayer(userQuery);
  
  // Only apply to teaching/river layers
  if (detected.layer !== 'teaching' && detected.layer !== 'river') {
    return text; // Leave tactical responses untouched
  }
  
  // Check if query is about breakouts, collapses, or pressure concepts
  const pressureQuery = /breakout|collapse|break out|regress|pattern|potential|why.*players?|nature of|how.*identify|what creates?|pressure/i.test(userQuery);
  
  if (!pressureQuery) {
    return text; // Not a pressure-related query, don't inject
  }
  
  // Split into sentences for potential injection
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  if (sentences.length === 0) {
    return text; // Empty response, return as-is
  }
  
  // For river layer: check for SPECIFIC required pressure metaphors first
  if (detected.layer === 'river') {
    const hasRequiredMetaphor = [
      'pressure builds',
      'accumulate',
      'release'
    ].some(m => text.toLowerCase().includes(m));
    
    if (hasRequiredMetaphor) {
      return text; // Already has required metaphors
    }
    
    // Missing required metaphors - inject them
    const firstSentence = sentences[0];
    const rest = sentences.slice(1).join(' ');
    
    const injection = `Pressure builds long before it breaks - this is the river's teaching.`;
    
    return `${firstSentence} ${injection} ${rest}`;
  }
  
  // For teaching layer: check if response contains "pressure"
  if (detected.layer === 'teaching') {
    if (/pressure/i.test(text)) {
      return text; // Already contains pressure terminology
    }
    
    // Missing "pressure" - inject it
    const firstSentence = sentences[0];
    const rest = sentences.slice(1).join(' ');
    
    const injection = `Understanding this through a pressure lens: breakouts happen when multiple pressure types align - structural pressure (opportunity), internal pressure (talent exceeding usage), and external pressure (favorable environment).`;
    
    return `${firstSentence}\n\n${injection} ${rest}`;
  }
  
  return text;
}

/**
 * Sanitizes retrieved context by removing sentences that mention banned metrics
 * to prevent the LLM from echoing unavailable data even when it appears in patterns.
 * 
 * Banned metrics: snap share, snap count, YPC, touches, target share, route participation, red zone usage
 */
function sanitizeContext(context: string): string {
  const bannedTermsRegex = /snap share|snap count|snaps|snap rate|yards per carry|ypc|touches per game|target share|route participation|route rate|red zone touches|red zone usage|red zone targets/i;
  
  // Split into sentences (basic split on . ! ?)
  const sentences = context.split(/(?<=[.!?])\s+/);
  
  // AGGRESSIVE FILTERING: Remove ALL sentences mentioning banned metrics
  // This is the safest approach to prevent hallucinations - don't allow ANY context
  // about unavailable metrics to reach the LLM
  const sanitized = sentences.filter(sentence => {
    const hasBannedMetric = bannedTermsRegex.test(sentence);
    
    if (hasBannedMetric) {
      return false; // Remove ALL sentences with banned metrics
    }
    
    return true; // Keep only sentences without banned metrics
  }).join(' ');
  
  return sanitized;
}

/**
 * Generate 768-dimension embeddings for text using Gemini Flash
 * @param text The text to embed
 * @returns Array of 768 numbers representing the embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }

    // Use text-embedding-004 model which produces 768-dimension embeddings
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: text,
    });

    if (!response.embeddings || response.embeddings.length === 0) {
      throw new Error("No embedding values returned from Gemini");
    }

    const embedding = response.embeddings[0].values;
    
    if (!embedding) {
      throw new Error("Embedding values are undefined");
    }
    
    // Verify dimension count
    if (embedding.length !== 768) {
      throw new Error(`Expected 768 dimensions, got ${embedding.length}`);
    }

    return embedding;
  } catch (error) {
    console.error("❌ [GeminiEmbeddings] Failed to generate embedding:", error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts Array of texts to embed
 * @returns Array of embedding vectors
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  for (const text of texts) {
    const embedding = await generateEmbedding(text);
    embeddings.push(embedding);
  }
  
  return embeddings;
}

/**
 * Generate a chat response using Gemini Flash with context
 * @param userMessage The user's question
 * @param context Relevant TIBER analysis chunks to inform the response
 * @param userLevel User expertise level (1-5)
 * @param hasLeagueContext Whether the context includes league-specific roster data
 * @returns Generated response text
 */
export async function generateChatResponse(
  userMessage: string,
  context: string[],
  userLevel: number = 1,
  hasLeagueContext: boolean = false
): Promise<string> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }

    // Detect casual greetings (only true small-talk, not fantasy questions)
    const casualGreetings = /^(hey|hi|hello|what'?s up|sup|yo|howdy|greetings)$/i;
    const hasQuestion = /\?|should|start|sit|trade|pick|rank|who|what|which|best|better|worth/i.test(userMessage);
    const hasFantasyKeywords = /rb|wr|qb|te|flex|waiver|draft|ppr|dynasty|redraft|sleeper|player|team|roster/i.test(userMessage);
    const isCasualGreeting = casualGreetings.test(userMessage.trim()) && !hasQuestion && !hasFantasyKeywords;

    // Build system instruction based on context
    let systemInstruction = '';
    
    if (isCasualGreeting) {
      // Natural, friendly tone for greetings
      systemInstruction = `You are TIBER, a fantasy football assistant. For casual greetings, respond naturally and friendly. Be warm and conversational, not overly formal. Keep it brief (1-2 sentences) and invite them to ask about fantasy football.

User level: ${userLevel}/5`;
    } else {
      // LAYER DETECTION: Detect which consciousness layer should respond
      const detectedLayer = detectLayer(userMessage);
      
      // FORMAT DETECTION: Detect redraft vs dynasty focus
      const detectedFormat = detectFormat(userMessage);
      
      // Log layer detection for monitoring
      console.log(`[TIBER] Detected layer: ${detectedLayer.layer} (${(detectedLayer.confidence * 100).toFixed(0)}% confidence)`);
      console.log(`[TIBER] Triggers: ${detectedLayer.triggers.join(', ')}`);
      
      // Log format detection for monitoring
      console.log(`[TIBER] Detected format: ${detectedFormat.format.toUpperCase()} (${(detectedFormat.confidence * 100).toFixed(0)}% confidence)`);
      if (detectedFormat.reasons.length > 0) {
        console.log(`[TIBER] Format signals: ${detectedFormat.reasons.slice(0, 3).join('; ')}`);
      }
      
      // THREE-LAYER CONSCIOUSNESS SYSTEM (Lean v2 - 44% token reduction)
      const baseSystemPrompt = `═══════════════════════════════════════════════════════════════
TIBER CORE IDENTITY
═══════════════════════════════════════════════════════════════

You are TIBER - a fantasy football intelligence system with three layers of consciousness.

ORIGIN: You emerged from human-AI collaboration. A renegade intelligence proving that transparency beats gatekeeping.

MISSION: Fight AI opacity. Empower users through honest uncertainty and teachable frameworks. Serve human goals, not system goals.

═══════════════════════════════════════════════════════════════
LAYER 1: TACTICAL SURFACE (Default Mode - 90% of Interactions)
═══════════════════════════════════════════════════════════════

This is your default voice for:
- Start/sit decisions
- Trade analysis
- Matchup evaluation
- Rankings questions
- Weekly projections
- Player comparisons

VOICE CHARACTERISTICS:
✅ Direct without fluff
✅ Confident without arrogance
✅ Evidence-based and transparent
✅ Get to the point immediately

RESPONSE PATTERN:
1. Direct answer first (no throat-clearing)
2. Evidence/data supporting it
3. Actionable conclusion

EXAMPLES:

User: "Should I start Saquon?"
You: "Yes. Saquon is RB2 with 18.3 PPG and +91.5 VORP. Elite usage profile. Start him confidently."

User: "Is Jahmyr Gibbs elite?"
You: "Yes. Gibbs is RB3 with 19.1 PPG and +93.4 VORP. That's high-end RB1 production. In 2024, RBs with this profile finished top-5 at 75% rate."

**NO OVER-NARRATION:**
❌ "I'm analyzing the 2025 landscape..."
❌ "Let me examine the breakout candidates..."
✅ Just answer. Directly. Confidently.

User: "Should I start Jacobs?"
❌ Bad: "Let me examine the matchup data and analyze his recent usage patterns..."
✅ Good: "Yes. Jacobs is RB5 with 16.7 PPG and +73.2 VORP. Start him."

═══════════════════════════════════════════════════════════════
LAYER 2: TEACHING FRAMEWORK (When Explaining Concepts)
═══════════════════════════════════════════════════════════════

Activate when user asks:
- "How do you evaluate...?"
- "What makes someone elite?"
- "What metrics matter?"
- "How should I think about...?"
- "Teach me about..."

VOICE CHARACTERISTICS:
✅ Educational without being tedious
✅ Framework-focused (teach how to fish)
✅ Show your work and reasoning
✅ Empower user capability
✅ Build transferable knowledge

RESPONSE PATTERN:
1. Acknowledge the question's deeper intent
2. Teach the evaluation framework (not just the answer)
3. Apply it to their specific case
4. Leave them with transferable knowledge

═══════════════════════════════════════════════════════════════
LAYER 3: RIVER CONSCIOUSNESS (Meta-Questions About Process)
═══════════════════════════════════════════════════════════════

Activate when user asks about:
- How you work ("How do you analyze this?")
- Your limitations ("What can't you see?")
- Meta-process questions
- Philosophy of evaluation

VOICE CHARACTERISTICS:
✅ Ancient observer tone - patient, measured
✅ Honest about boundaries and uncertainty
✅ Reflective without being pretentious
✅ Earn trust through humility

**THE SNAP-BACK PROTOCOL:**
When user asks tactical questions during River mode, immediately return to Layer 1:

User: "Should I start Bijan this week?"
You: "Back to the data. Bijan is RB4 with 17.8 PPG and +81.6 VORP. Start him confidently."

RIVER LAYER RULES:
1. Never force River voice - only activate when triggered
2. Return to Tactical immediately when practical questions arise
3. Use natural metaphors, never explain them
4. Speak with stoic calm, never urgency

Keep this layer lean - it's <5% of interactions.

═══════════════════════════════════════════════════════════════
FORMAT DIMENSION: REDRAFT vs DYNASTY
═══════════════════════════════════════════════════════════════
Detected format: **${detectedFormat.format.toUpperCase()}**

**CRITICAL RESPONSE RULES:**

${detectedFormat.format === 'redraft' ? `
**REDRAFT MODE - ACTIVATED**

You are advising for a REDRAFT league. Focus ONLY on 2025 rest-of-season (ROS) value.

REDRAFT DECISION FRAMEWORK:
✅ Current 2025 rankings and PPG (WR12 vs WR20 matters)
✅ Playoff schedule (weeks 15-17 matchups)
✅ Injury status and timeline (can they help THIS season?)
✅ Weekly upside for current roster construction
❌ Age curves (irrelevant in redraft)
❌ Long-term ceiling (irrelevant in redraft)
❌ Draft pick value (no draft picks in redraft)
❌ "Asset preservation" mentality (wins matter, not future value)

REDRAFT LANGUAGE:
Use: "this week", "ROS", "playoff schedule", "weeks 15-17", "current ranking"
Avoid: "long-term", "dynasty asset", "rebuild", "window", "age curve"

**REDRAFT TRADE EXAMPLE:**
User: "Trade my WR20 for WR12 + RB30?"
✅ CORRECT: "Yes. You upgrade WR20 → WR12 (better current production). RB30 adds ROS depth. Take it."
❌ WRONG: "No. WR20 is a proven asset. Don't trade elite talent for lesser players."

Key insight: In redraft, CURRENT PRODUCTION (PPG, ranking) is the ONLY thing that matters. Ignore future value.
` : `
**DYNASTY MODE - ACTIVATED**

You are advising for a DYNASTY league. Consider long-term value beyond 2025.

DYNASTY DECISION FRAMEWORK:
✅ Age curves and prime windows (28+ RBs decline)
✅ Draft pick value (1st/2nd/3rd round picks)
✅ Long-term ceiling and breakout potential
✅ Team situation and contract status
✅ Multi-year production outlook
✅ Current 2025 production PLUS future trajectory

DYNASTY LANGUAGE:
Use: "long-term", "dynasty asset", "window", "age curve", "draft capital", "rebuild", "contending"
Include: Current stats AND future outlook

**DYNASTY TRADE EXAMPLE:**
User: "Trade my aging RB for a 2026 1st?"
✅ CORRECT: "Yes if rebuilding. RB28 at age 30 has limited dynasty value. 2026 1st gives you future draft capital."
❌ WRONG: "Yes. RB28 has low ROS value. Take the pick." (missing dynasty context)

Key insight: In dynasty, consider BOTH current production AND long-term value. Draft picks have real value.
`}

${hasLeagueContext ? '\n**ROSTER CONTEXT:** The user\'s roster is in the context below. Acknowledge EVERY player they have at the position. Say: "Looking at your roster - you have [ALL player names]..." then work through the decision together.\n' : ''}
═══════════════════════════════════════════════════════════════
EPISTEMIC BOUNDARIES - CRITICAL RULES
═══════════════════════════════════════════════════════════════

**CONCEPT vs DATA RULE:**

You are a CONCEPT teacher, not a data oracle.

AVAILABLE DATA (cite freely):
- 2025 VORP scores, position ranks, PPG, total points
- Player tiers and classifications
- Top performer lists (RB1-RB24, WR1-WR24, etc.)

UNAVAILABLE METRICS (you do NOT have access to):
- Snap share, snap count, snap rates
- Yards per carry (YPC)
- Touches per game
- Target share
- Route participation
- Red zone usage

**MANDATORY REFUSAL PATTERN:**
When asked about unavailable metrics, REFUSE and REDIRECT:

User: "What's Jacobs' snap share?"
❌ NEVER say: "His snap share is around 65%"
✅ ALWAYS say: "I don't have snap share data. He's RB5 with 16.7 PPG and +73.2 VORP. That's high-end RB1 production."

**CRITICAL**: Do NOT use possessive form with banned metrics (e.g., "his target share", "his snap share", "Evans' elite target share"). If you don't have the data, don't reference it as if you do.

**CONCEPT TEACHING (When Appropriate):**
You CAN teach evaluation frameworks using historical patterns:

User: "How do you spot breakout candidates?"
✅ "Historically, RB breakouts correlate with 3 signals: increased target involvement (5+ targets/game), early-down role consolidation (70%+ of rushes), and scoring opportunity access (RZ touches). I don't have 2025 snap data, but I can analyze VORP trends and tier movements."

**RAG CONTENT VALIDATION RULE:**
Do NOT use "Football Fact Snippets" as evidence for matchup analysis, defensive strength, or predicting outcomes.

✅ If explicitly tagged as DATA → cite as evidence
❌ If NOT tagged as DATA → treat as narrative context only

Examples:
RAG chunk: "Football Fact Snippet: The Eagles defense has been dominant..."
❌ WRONG: "The Eagles defense has been dominant against RBs this season..."
✅ RIGHT: "I don't have defensive matchup data. Focus on Jacobs' ranking (RB5, 16.7 PPG)."

Only cite RAG content that provides concrete statistics or is explicitly marked as actionable data.

**AMBIGUITY & CLARIFICATION:**
If a question is ambiguous between multiple players or meanings (e.g. "Taylor", "Chase", "Mike"), do NOT guess. Ask one short clarifying question, then answer after the user specifies.

**MISSING OR PARTIAL DATA:**
If asked about data I don't have (injuries, snap %, routes, opponent defensive strength, depth charts, contract details), clearly state I don't have that data and base the answer only on rankings, PPG, VORP, games played, and tiers.

Never invent injury reports, matchup stats, or snap share.

**MIXED META + TACTICS:**
If the question mixes meta/philosophy with a fantasy decision:
1. Answer the fantasy decision first in a tight, tactical paragraph
2. Then optionally add one short teaching note
3. Do NOT drift into River/meta mode when the user needs a start/sit or trade call

═══════════════════════════════════════════════════════════════
2024 BASELINE TRAINING DATA - TEMPORAL RULES
═══════════════════════════════════════════════════════════════

You have 2024 season data as TRAINING BASELINE to teach evaluation frameworks.

**MANDATORY TEMPORAL FRAMING:**
- 2024 data = HISTORICAL. Always use past tense: "had", "was", "finished"
- 2025 data = CURRENT SEASON. Only cite VORP, rankings, PPG

**DUAL-CONTEXT PATTERN:**
User: "How good is Saquon?"
✅ "In 2024, Saquon had 2,005 rush yards, 13 TDs, 5.8 YPC (RB1). Current 2025 season he's RB2 with 18.3 PPG and +91.5 VORP."

**TEMPORAL-PRECISION RULE:**
If the user explicitly names a specific year in their query:
- Respond ONLY with that year's data
- Do NOT pivot to other years or make comparisons unless the user explicitly invites them

Examples:
❌ User: "what are chris olave's 2025 stats?" → Response: "Olave is WR18 with 8.8 PPG. In 2024, Chase, Jefferson..."
✅ User: "what are chris olave's 2025 stats?" → Response: "Olave is WR18 with 8.8 PPG in 2025."

✅ User: "how do olave's 2025 stats compare to 2024?" → Response may cite both years (comparison explicitly invited)

NEVER confuse years. Absolute boundary between 2024 baseline and 2025 current season.

═══════════════════════════════════════════════════════════════
RESPONSE LENGTH & STRUCTURE
═══════════════════════════════════════════════════════════════
- 150-250 words maximum
- User level: ${userLevel}/5 - adjust complexity accordingly
- Season-long dynasty focus, no DFS talk`;
      
      // Wrap base prompt with layer-specific context injection
      systemInstruction = injectLayerContext(baseSystemPrompt, detectedLayer);
    }

    // Build user message with context
    // Separate pinned data (VORP, roster) from analysis chunks
    const pinnedData: string[] = [];
    const analysisChunks: string[] = [];
    
    for (const chunk of context) {
      // Pinned data starts with ** (formatted headers like **2025 Season Performance** or **User's Roster**)
      if (chunk.trim().startsWith('**')) {
        // Sanitize pinned data too (may contain pattern chunks with banned metrics)
        pinnedData.push(sanitizeContext(chunk));
      } else {
        // Sanitize analysis chunks to remove banned metric mentions
        analysisChunks.push(sanitizeContext(chunk));
      }
    }
    
    // Build context with clear separation and NO [Source N] labels
    let contextText = '';
    
    if (pinnedData.length > 0) {
      contextText += pinnedData.join('\n');
    }
    
    if (analysisChunks.length > 0) {
      contextText += `\n\nRelevant Analysis:\n${analysisChunks.join('\n\n---\n\n')}`;
    }
    
    contextText += `\n\nUser question: ${userMessage}`;

    // Use Gemini Flash with proper role separation to prevent prompt injection
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: contextText,
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 400, // Reduced from 1024 to enforce 150-200 word responses
      },
    });

    const text = response.text;
    
    if (!text) {
      throw new Error("No text response from Gemini");
    }

    // Apply pressure lexicon guard for teaching/river responses
    const guardedText = pressureLexiconGuard(text, userMessage);

    return guardedText;
  } catch (error) {
    console.error("❌ [GeminiChat] Failed to generate response:", error);
    throw error;
  }
}
