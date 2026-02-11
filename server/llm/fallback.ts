import { LLMRequest, LLMResponse, LLMError, LLMProvider } from "./types";
import { providerAvailability, routingTable } from "./config";
import { llmLog } from "./logger";
import { callOpenRouter } from "./providers/openrouter";
import { callGemini } from "./providers/gemini";
import { callOpenAI } from "./providers/openai";
import { callAnthropic } from "./providers/anthropic";

function nowId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function callWithFallback(req: LLMRequest): Promise<LLMResponse> {
  const requestId = req.requestId ?? nowId();
  const priority = req.priority ?? "balanced";

  const availability = providerAvailability();
  const routes = routingTable();

  if (req.provider && req.model) {
    return callProvider({
      ...req,
      requestId,
      provider: req.provider,
      model: req.model,
      timeoutMs: req.timeoutMs ?? 30_000,
      temperature: req.temperature ?? 0.7,
      maxTokens: req.maxTokens ?? 1024,
    });
  }

  const plan = routes[req.taskType]?.tiers?.[priority] ?? routes.general.tiers[priority];

  const maxRetries = req.maxRetries ?? 0;
  const timeoutMs = req.timeoutMs ?? 30_000;
  const temperature = req.temperature ?? 0.7;
  const maxTokens = req.maxTokens ?? 1024;

  const fallbackPath: Array<{ provider: LLMProvider; model: string; reason: string }> = [];

  for (const candidate of plan) {
    if (!availability[candidate.provider]) {
      fallbackPath.push({ provider: candidate.provider, model: candidate.model, reason: "provider_unavailable" });
      continue;
    }

    let attempts = 0;
    while (attempts <= maxRetries) {
      attempts += 1;

      try {
        llmLog("info", "llm_attempt", {
          requestId,
          taskType: req.taskType,
          priority,
          purpose: req.purpose,
          provider: candidate.provider,
          model: candidate.model,
          attempt: attempts,
        });

        const res = await callProvider({
          ...req,
          requestId,
          provider: candidate.provider,
          model: candidate.model,
          timeoutMs,
          temperature,
          maxTokens,
        });

        if (fallbackPath.length) {
          res.fallbackPath = [...fallbackPath];
        }

        llmLog("info", "llm_success", {
          requestId,
          provider: res.provider,
          model: res.model,
          latencyMs: res.latencyMs,
          inputTokens: res.inputTokens,
          outputTokens: res.outputTokens,
        });

        return res;
      } catch (err: any) {
        const e = err instanceof LLMError
          ? err
          : new LLMError(err?.message ?? "unknown", "unknown", candidate.provider, candidate.model);

        llmLog("warn", "llm_failure", {
          requestId,
          provider: candidate.provider,
          model: candidate.model,
          type: e.type,
          msg: e.message,
          attempt: attempts,
        });

        if (attempts <= maxRetries && (e.type === "timeout" || e.type === "rate_limited")) {
          continue;
        }

        fallbackPath.push({ provider: candidate.provider, model: candidate.model, reason: e.type });
        break;
      }
    }
  }

  throw new LLMError("All providers failed in fallback chain", "unknown");
}

async function callProvider(req: LLMRequest & Required<Pick<LLMRequest, "provider" | "model" | "requestId">> & {
  timeoutMs: number;
  temperature: number;
  maxTokens: number;
}): Promise<LLMResponse> {
  const common = {
    requestId: req.requestId,
    model: req.model,
    messages: req.messages,
    maxTokens: req.maxTokens,
    temperature: req.temperature,
    timeoutMs: req.timeoutMs,
  };

  switch (req.provider) {
    case "openrouter":
      return callOpenRouter(common);
    case "gemini":
      return callGemini(common);
    case "openai":
      return callOpenAI(common);
    case "anthropic":
      return callAnthropic(common);
    default:
      throw new LLMError(`Unsupported provider: ${req.provider}`, "bad_request", req.provider);
  }
}
