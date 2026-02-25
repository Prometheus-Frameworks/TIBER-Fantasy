import type { ErrorCode } from "../errors/codes";

export function v1Success(data: unknown, requestId: string) {
  return {
    data,
    meta: {
      version: "v1",
      request_id: requestId,
      generated_at: new Date().toISOString(),
    },
  };
}

export function v1Error(code: ErrorCode, message: string, requestId: string, details?: unknown) {
  return {
    error: { code, message, ...(details ? { details } : {}) },
    meta: {
      version: "v1",
      request_id: requestId,
      generated_at: new Date().toISOString(),
    },
  };
}
