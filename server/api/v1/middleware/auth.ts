import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { apiKeys } from "@shared/schema";
import { db } from "../../../infra/db";
import { ApiError } from "./errorFormat";
import { ErrorCodes } from "../errors/codes";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function auth(req: Request, _res: Response, next: NextFunction) {
  try {
    const rawKey = req.header("x-tiber-key");
    if (!rawKey) {
      return next(new ApiError(401, ErrorCodes.AUTH_MISSING_KEY, "Missing x-tiber-key header"));
    }

    const keyHash = sha256(rawKey);

    const active = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
      .limit(1);

    let key = active[0];
    if (!key) {
      const anyKey = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
      if (anyKey[0]?.revokedAt) {
        return next(new ApiError(403, ErrorCodes.AUTH_REVOKED_KEY, "API key has been revoked"));
      }
      return next(new ApiError(401, ErrorCodes.AUTH_INVALID_KEY, "Invalid API key"));
    }

    req.tiberAuth = {
      apiKeyId: key.id,
      tier: key.tier,
      ownerLabel: key.ownerLabel,
      rateLimitRpm: key.rateLimitRpm,
    };

    db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id)).catch((err) => {
      console.warn("[v1/auth] last_used_at update failed:", err);
    });

    next();
  } catch (error) {
    next(error);
  }
}
