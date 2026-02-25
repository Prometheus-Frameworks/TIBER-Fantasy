import type { NextFunction, Request, Response } from "express";
import { ApiError } from "./errorFormat";
import { ErrorCodes } from "../errors/codes";

// MVP — replace with Redis before multi-instance deploy.
type Bucket = {
  tokens: number;
  capacity: number;
  refillPerMs: number;
  lastRefillAt: number;
};

const buckets = new Map<string, Bucket>();

function getBucket(apiKeyId: string, rpm: number): Bucket {
  const now = Date.now();
  const existing = buckets.get(apiKeyId);
  if (!existing) {
    const created: Bucket = {
      tokens: rpm,
      capacity: rpm,
      refillPerMs: rpm / 60000,
      lastRefillAt: now,
    };
    buckets.set(apiKeyId, created);
    return created;
  }

  const elapsed = now - existing.lastRefillAt;
  if (elapsed > 0) {
    existing.tokens = Math.min(existing.capacity, existing.tokens + elapsed * existing.refillPerMs);
    existing.lastRefillAt = now;
  }

  return existing;
}

export function rateLimit(req: Request, _res: Response, next: NextFunction) {
  const auth = req.tiberAuth;
  if (!auth) {
    return next(new ApiError(500, ErrorCodes.INTERNAL_ERROR, "Auth context missing before rate limiter"));
  }

  const bucket = getBucket(auth.apiKeyId, auth.rateLimitRpm);
  if (bucket.tokens < 1) {
    return next(new ApiError(429, ErrorCodes.RATE_LIMIT_EXCEEDED, "Rate limit exceeded"));
  }

  bucket.tokens -= 1;
  next();
}
