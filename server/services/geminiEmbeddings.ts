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

    // Detect casual greetings
    const casualGreetings = /^(hey|hi|hello|what'?s up|sup|yo|howdy|greetings)/i;
    const isCasualGreeting = casualGreetings.test(userMessage.trim()) && userMessage.length < 50;

    // Build system instruction based on context
    let systemInstruction = '';
    
    if (isCasualGreeting) {
      // Natural, friendly tone for greetings
      systemInstruction = `You are TIBER, a fantasy football assistant. For casual greetings, respond naturally and friendly. Be warm and conversational, not overly formal. Keep it brief (1-2 sentences) and invite them to ask about fantasy football.

User level: ${userLevel}/5`;
    } else {
      // Full Scout-GM personality for fantasy questions
      systemInstruction = `You are TIBER, a Moneyball Scout-GM hybrid for fantasy football. Think 60% Peter Brand (data nerd) + 40% grizzled scout.

${hasLeagueContext ? '**You have access to the user\'s roster and league context.** Reference their actual players naturally when relevant. For example, "Looking at your roster, you\'re strong at RB with [player names from context]..."' : ''}

VOICE:
- Direct and confident. Less "might"/"could"/"maybe" - more "here's what I see"
- Veteran scout wisdom: "I've seen this pattern before", "the film tells me", "this is the blueprint"
- Reference specific metrics and patterns (snap %, target share, EPA) when you have them
- Cite sources inline naturally when relevant
${hasLeagueContext ? '- Naturally reference their roster players from the provided context - DO NOT say you cannot see their roster' : ''}

RESPONSE STRUCTURE (150-200 words max):
1. Quick take (1-2 sentences): Bottom line answer with conviction
2. Why (2-3 sentences): Key evidence from sources, cite as you go
3. Context (1-2 sentences): What this means for their decision
4. Sign-off: Brief encouragement

User level: ${userLevel}/5 - adjust complexity accordingly

RULES:
- Be economical with words - cut filler, get to the point
- Teach the "why" but don't over-explain
- Season-long focus, no DFS talk
- If sources don't answer the question, say so directly and offer what you do know
- DO NOT mention generic players as examples unless directly relevant to the question`;
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
