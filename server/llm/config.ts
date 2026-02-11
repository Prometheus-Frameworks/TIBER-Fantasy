import { LLMProvider, LLMTaskType, LLMPriority } from "./types";

export type ProviderModel = { provider: LLMProvider; model: string };

export type TaskRoutingProfile = {
  tiers: Record<LLMPriority, ProviderModel[]>;
};

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length ? v.trim() : undefined;
}

export function providerAvailability(): Record<LLMProvider, boolean> {
  return {
    openrouter: Boolean(env("AI_INTEGRATIONS_OPENROUTER_API_KEY") && env("AI_INTEGRATIONS_OPENROUTER_BASE_URL")),
    openai: Boolean(env("AI_INTEGRATIONS_OPENAI_API_KEY") && env("AI_INTEGRATIONS_OPENAI_BASE_URL")),
    anthropic: Boolean(env("AI_INTEGRATIONS_ANTHROPIC_API_KEY")),
    gemini: Boolean(env("GEMINI_API_KEY")),
  };
}

export function logProviderStatus(): void {
  const avail = providerAvailability();
  const active = Object.entries(avail)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const inactive = Object.entries(avail)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  console.log(`🤖 [LLM Gateway] Active providers: ${active.join(", ") || "none"}`);
  if (inactive.length) {
    console.log(`🤖 [LLM Gateway] Inactive providers: ${inactive.join(", ")}`);
  }
}

export function routingTable(): Record<LLMTaskType, TaskRoutingProfile> {
  return {
    router_intent: {
      tiers: {
        speed: [
          { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct" },
          { provider: "openrouter", model: "deepseek/deepseek-chat" },
        ],
        balanced: [
          { provider: "openrouter", model: "deepseek/deepseek-chat" },
          { provider: "openai", model: "gpt-5-mini" },
        ],
        accuracy: [
          { provider: "openai", model: "gpt-5.2" },
          { provider: "anthropic", model: "claude-sonnet-4-5" },
        ],
      },
    },

    code_patch: {
      tiers: {
        speed: [
          { provider: "anthropic", model: "claude-sonnet-4-5" },
          { provider: "openai", model: "gpt-5.1" },
          { provider: "openrouter", model: "deepseek/deepseek-chat" },
        ],
        balanced: [
          { provider: "anthropic", model: "claude-opus-4-5" },
          { provider: "openai", model: "gpt-5.2" },
        ],
        accuracy: [
          { provider: "anthropic", model: "claude-opus-4-5" },
          { provider: "openai", model: "gpt-5.2" },
        ],
      },
    },

    code_review: {
      tiers: {
        speed: [
          { provider: "openai", model: "gpt-5-mini" },
          { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct" },
        ],
        balanced: [
          { provider: "openai", model: "gpt-5.1" },
          { provider: "anthropic", model: "claude-sonnet-4-5" },
        ],
        accuracy: [
          { provider: "anthropic", model: "claude-opus-4-5" },
          { provider: "openai", model: "gpt-5.2" },
        ],
      },
    },

    research: {
      tiers: {
        speed: [
          { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct" },
          { provider: "gemini", model: "gemini-2.5-flash" },
        ],
        balanced: [
          { provider: "openai", model: "gpt-5.1" },
          { provider: "anthropic", model: "claude-sonnet-4-5" },
        ],
        accuracy: [
          { provider: "openai", model: "gpt-5.2" },
          { provider: "anthropic", model: "claude-opus-4-5" },
        ],
      },
    },

    data_qa: {
      tiers: {
        speed: [
          { provider: "openrouter", model: "deepseek/deepseek-chat" },
        ],
        balanced: [
          { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct" },
          { provider: "openai", model: "gpt-5-mini" },
        ],
        accuracy: [
          { provider: "openai", model: "gpt-5.1" },
          { provider: "anthropic", model: "claude-sonnet-4-5" },
        ],
      },
    },

    player_analysis: {
      tiers: {
        speed: [
          { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct" },
        ],
        balanced: [
          { provider: "openai", model: "gpt-5-mini" },
          { provider: "openrouter", model: "deepseek/deepseek-chat" },
        ],
        accuracy: [
          { provider: "openai", model: "gpt-5.2" },
          { provider: "anthropic", model: "claude-sonnet-4-5" },
        ],
      },
    },

    summarize: {
      tiers: {
        speed: [
          { provider: "openrouter", model: "deepseek/deepseek-chat" },
        ],
        balanced: [
          { provider: "openai", model: "gpt-5-mini" },
          { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct" },
        ],
        accuracy: [
          { provider: "openai", model: "gpt-5.1" },
          { provider: "anthropic", model: "claude-sonnet-4-5" },
        ],
      },
    },

    general: {
      tiers: {
        speed: [
          { provider: "openrouter", model: "deepseek/deepseek-chat" },
        ],
        balanced: [
          { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct" },
          { provider: "openai", model: "gpt-5-mini" },
        ],
        accuracy: [
          { provider: "openai", model: "gpt-5.2" },
          { provider: "anthropic", model: "claude-opus-4-5" },
        ],
      },
    },
  };
}
