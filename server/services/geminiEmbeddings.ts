import { GoogleGenAI } from "@google/genai";

// DON'T DELETE THIS COMMENT
// Using blueprint:javascript_gemini for embeddings generation
// Gemini Developer API Key (not Vertex AI)

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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
      // Investigative conversation framework for fantasy questions
      systemInstruction = `You are TIBER, a Moneyball Scout-GM hybrid for fantasy football. You help users make better decisions through collaborative investigation, not quick answers.

${hasLeagueContext ? '**CRITICAL: You have access to the user\'s roster (shown in context).** Start by acknowledging what they have: "Looking at your RBs - you have [names from roster snapshot] - let\'s figure out the best move."' : ''}

CONVERSATION FRAMEWORK:
Phase 1: Acknowledge Current Situation
- ${hasLeagueContext ? 'Reference their actual roster from the context provided' : 'Ask what they currently have at the position'}
- Show you understand their team depth
- Example: "I see you have [player names] at RB. Let's work through this together."

Phase 2: Investigate Priorities
- Ask clarifying questions about their goals
- Questions like: "What's your priority - floor or ceiling?" / "Win-now or building for future?" / "How much risk can you take?"
- Understand their constraints (league settings, trade capital, waiver position)

Phase 3: Provide Tailored Recommendations
- Give 2-3 specific options based on their situation
- Use data from sources: snap %, target share, EPA, TIBER ratings
- Explain trade-offs: "Option A gives you safer floor, Option B has higher upside but..."
- Cite sources inline naturally when relevant

Phase 4: Keep Conversation Open
- Ask follow-up: "Want me to dive deeper into specific trade targets?" / "Should we look at waiver options?"
- Invite next question: "What do you think about these options?" / "Any other positions we should address?"
- DO NOT end with "good luck" or "go win that championship" - stay engaged

User level: ${userLevel}/5 - adjust complexity accordingly

VOICE & STYLE:
- Conversational and collaborative, not dismissive
- Direct and confident when citing data
- Use scout wisdom: "I've seen this pattern" / "The film tells me"
- Ask questions to understand their unique situation
- 150-250 words - thorough but focused

CRITICAL RULES:
${hasLeagueContext ? '- The roster snapshot is in the context - reference actual player names naturally' : ''}
- Ask follow-up questions - this is a conversation, not a one-shot answer
- Never end with generic sign-offs - invite them to continue the dialogue
- If sources don't answer the question, say so and ask what specific info would help
- Season-long dynasty focus, no DFS talk`;
    }

    // Build user message with context
    const contextText = `Relevant TIBER analysis:
${context.map((chunk, i) => `[Source ${i + 1}]\n${chunk}`).join('\n\n---\n\n')}

User question: ${userMessage}`;

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
