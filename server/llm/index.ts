import { callWithFallback } from "./fallback";
import { LLMRequest, LLMResponse } from "./types";

export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  return callWithFallback(req);
}

export { logProviderStatus } from "./config";
export * from "./types";
