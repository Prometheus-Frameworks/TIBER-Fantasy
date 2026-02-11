import OpenAI from "openai";
import { LLMMessage, LLMResponse, LLMError } from "../types";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;

  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

  if (!apiKey || !baseURL) {
    throw new LLMError("OpenAI integration env vars missing (install Replit OpenAI integration)", "provider_unavailable", "openai");
  }

  _client = new OpenAI({ apiKey, baseURL });
  return _client;
}

export async function callOpenAI(opts: {
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
      provider: "openai",
      model: opts.model,
      latencyMs: Date.now() - start,
      requestId: opts.requestId,
      inputTokens: res.usage?.prompt_tokens,
      outputTokens: res.usage?.completion_tokens,
    };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new LLMError("OpenAI request timed out", "timeout", "openai", opts.model);
    }
    if (err?.status === 429) {
      throw new LLMError("OpenAI rate limited", "rate_limited", "openai", opts.model);
    }
    throw new LLMError(err?.message ?? "OpenAI unknown error", "unknown", "openai", opts.model);
  }
}
