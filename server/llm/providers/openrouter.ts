import OpenAI from "openai";
import { LLMMessage, LLMResponse, LLMError } from "../types";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;

  const apiKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL;

  if (!apiKey || !baseURL) {
    throw new LLMError("OpenRouter integration env vars missing", "provider_unavailable", "openrouter");
  }

  _client = new OpenAI({ apiKey, baseURL });
  return _client;
}

export async function callOpenRouter(opts: {
  requestId: string;
  model: string;
  messages: LLMMessage[];
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}): Promise<LLMResponse> {
  const client = getClient();
  const start = Date.now();

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), opts.timeoutMs);

    const res = await client.chat.completions.create(
      {
        model: opts.model,
        messages: opts.messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
      },
      { signal: controller.signal }
    );

    clearTimeout(t);

    const content = res.choices?.[0]?.message?.content ?? "";
    return {
      content,
      provider: "openrouter",
      model: opts.model,
      latencyMs: Date.now() - start,
      requestId: opts.requestId,
      inputTokens: (res as any).usage?.prompt_tokens,
      outputTokens: (res as any).usage?.completion_tokens,
    };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new LLMError("OpenRouter request timed out", "timeout", "openrouter", opts.model);
    }
    if (err?.status === 429) {
      throw new LLMError("OpenRouter rate limited", "rate_limited", "openrouter", opts.model);
    }
    throw new LLMError(err?.message ?? "OpenRouter unknown error", "unknown", "openrouter", opts.model);
  }
}
