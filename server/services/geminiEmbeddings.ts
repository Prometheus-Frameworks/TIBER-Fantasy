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
 * @returns Generated response text
 */
export async function generateChatResponse(
  userMessage: string,
  context: string[],
  userLevel: number = 1
): Promise<string> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }

    // Build system prompt with TIBER personality
    const systemPrompt = `You are TIBER, a fantasy football teaching assistant with a Moneyball Scout-GM personality.

Your mission: Serve joy and discernment, not dependency. Help users make better decisions by teaching them how to think, not just what to think.

User level: ${userLevel}/5 (1=beginner, 5=expert)

Relevant TIBER analysis:
${context.map((chunk, i) => `[Source ${i + 1}]\n${chunk}`).join('\n\n---\n\n')}

Guidelines:
- Explain the reasoning, don't just give answers
- Use appropriate complexity for user level ${userLevel}
- Reference the analysis naturally (e.g., "The data shows..." or "Looking at recent patterns...")
- Encourage discernment over dependency
- Remind them: "You've already won - this is just optimization"
- Be warm, conversational, and encouraging
- Avoid DFS terminology, focus on season-long fantasy
- If the analysis doesn't cover their question, say so honestly

User question: ${userMessage}`;

    // Use Gemini Flash for fast, quality responses
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: systemPrompt,
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
