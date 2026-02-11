import { GoogleGenAI } from "@google/genai";
import { LLMMessage, LLMResponse, LLMError } from "../types";

let _ai: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (_ai) return _ai;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new LLMError("Gemini not available (missing GEMINI_API_KEY)", "provider_unavailable", "gemini");
  }

  _ai = new GoogleGenAI({ apiKey });
  return _ai;
}

function toGeminiContents(messages: LLMMessage[]) {
  const systemParts = messages
    .filter(m => m.role === "system")
    .map(m => m.content);

  const conversationMessages = messages.filter(m => m.role !== "system");

  const contents = conversationMessages.map(m => ({
    role: m.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: m.content }],
  }));

  if (contents.length === 0) {
    contents.push({ role: "user" as const, parts: [{ text: "" }] });
  }

  if (systemParts.length > 0) {
    const systemText = systemParts.join("\n\n");
    contents[0].parts[0].text = `${systemText}\n\n${contents[0].parts[0].text}`;
  }

  return contents;
}

export async function callGemini(opts: {
  requestId: string;
  model: string;
  messages: LLMMessage[];
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}): Promise<LLMResponse> {
  const ai = getClient();
  const start = Date.now();

  try {
    const contents = toGeminiContents(opts.messages);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new LLMError("Gemini request timed out", "timeout", "gemini", opts.model)), opts.timeoutMs)
    );

    const generatePromise = ai.models.generateContent({
      model: opts.model,
      contents,
      config: {
        maxOutputTokens: opts.maxTokens,
        temperature: opts.temperature,
      },
    });

    const res = await Promise.race([generatePromise, timeoutPromise]);

    const content = res.text ?? "";

    return {
      content,
      provider: "gemini",
      model: opts.model,
      latencyMs: Date.now() - start,
      requestId: opts.requestId,
      inputTokens: res.usageMetadata?.promptTokenCount,
      outputTokens: res.usageMetadata?.candidatesTokenCount,
    };
  } catch (err: any) {
    if (err instanceof LLMError) throw err;
    if (err?.status === 429) {
      throw new LLMError("Gemini rate limited", "rate_limited", "gemini", opts.model);
    }
    throw new LLMError(err?.message ?? "Gemini unknown error", "unknown", "gemini", opts.model);
  }
}
