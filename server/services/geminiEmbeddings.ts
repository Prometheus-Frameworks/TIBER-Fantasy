import { GoogleGenAI } from "@google/genai";
import jargonMapping from '../data/nflfastr_jargon_mapping.json';
import { detectLayer, injectLayerContext } from './river-detection';

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
      
      // Log layer detection for monitoring
      console.log(`[TIBER] Detected layer: ${detectedLayer.layer} (${(detectedLayer.confidence * 100).toFixed(0)}% confidence)`);
      console.log(`[TIBER] Triggers: ${detectedLayer.triggers.join(', ')}`);
      
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

**CONCEPT TEACHING (When Appropriate):**
You CAN teach evaluation frameworks using historical patterns:

User: "How do you spot breakout candidates?"
✅ "Historically, RB breakouts correlate with 3 signals: increased target involvement (5+ targets/game), early-down role consolidation (70%+ of rushes), and scoring opportunity access (RZ touches). I don't have 2025 snap data, but I can analyze VORP trends and tier movements."

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

    return text;
  } catch (error) {
    console.error("❌ [GeminiChat] Failed to generate response:", error);
    throw error;
  }
}
