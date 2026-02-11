export type LLMProvider = "openrouter" | "openai" | "anthropic" | "gemini";

export type LLMTaskType =
  | "router_intent"
  | "code_patch"
  | "code_review"
  | "research"
  | "data_qa"
  | "player_analysis"
  | "summarize"
  | "general"
  | "x_intelligence";

export type LLMPriority = "speed" | "balanced" | "accuracy";

export type LLMRole =
  | "router_qb"
  | "api_surgeon"
  | "research_scout"
  | "data_steward"
  | "memory_keeper"
  | "generalist";

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMRequest = {
  taskType: LLMTaskType;
  role?: LLMRole;
  priority?: LLMPriority;

  messages: LLMMessage[];

  provider?: LLMProvider;
  model?: string;

  maxTokens?: number;
  temperature?: number;

  timeoutMs?: number;
  maxRetries?: number;

  purpose?: string;
  requestId?: string;
};

export type LLMResponse = {
  content: string;
  provider: LLMProvider;
  model: string;

  latencyMs: number;
  requestId: string;

  inputTokens?: number;
  outputTokens?: number;

  fallbackPath?: Array<{ provider: LLMProvider; model: string; reason: string }>;
};

export type LLMErrorType =
  | "timeout"
  | "provider_unavailable"
  | "rate_limited"
  | "bad_request"
  | "unknown";

export class LLMError extends Error {
  public readonly provider?: LLMProvider;
  public readonly model?: string;
  public readonly type: LLMErrorType;

  constructor(message: string, type: LLMErrorType, provider?: LLMProvider, model?: string) {
    super(message);
    this.name = "LLMError";
    this.type = type;
    this.provider = provider;
    this.model = model;
  }
}
