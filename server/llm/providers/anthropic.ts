import Anthropic from "@anthropic-ai/sdk";
import { LLMMessage, LLMResponse, LLMError } from "../types";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

  if (!apiKey) {
    throw new LLMError("Anthropic integration env vars missing (install Replit Anthropic integration)", "provider_unavailable", "anthropic");
  }

  if (_client) return _client;
  _client = new Anthropic({ apiKey, baseURL: baseURL || undefined });
  return _client;
}

function splitSystem(messages: LLMMessage[]): {
  system: string;
  rest: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const system = messages
    .filter(m => m.role === "system")
    .map(m => m.content)
    .join("\n\n");
  const rest = messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    }));
  return { system, rest };
}

export async function callAnthropic(opts: {
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
    const { system, rest } = splitSystem(opts.messages);

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), opts.timeoutMs);

    const res = await client.messages.create(
      {
        model: opts.model,
        system: system || undefined,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        messages: rest,
      },
      { signal: controller.signal } as any
    );

    clearTimeout(t);

    const content = (res.content || [])
      .map((c: any) => (c.type === "text" ? c.text : ""))
      .join("");

    return {
      content,
      provider: "anthropic",
      model: opts.model,
      latencyMs: Date.now() - start,
      requestId: opts.requestId,
      inputTokens: res.usage?.input_tokens,
      outputTokens: res.usage?.output_tokens,
    };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new LLMError("Anthropic request timed out", "timeout", "anthropic", opts.model);
    }
    if (err?.status === 429) {
      throw new LLMError("Anthropic rate limited", "rate_limited", "anthropic", opts.model);
    }
    throw new LLMError(err?.message ?? "Anthropic unknown error", "unknown", "anthropic", opts.model);
  }
}
