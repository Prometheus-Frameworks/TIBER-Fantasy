import type { NextFunction, Request, Response } from "express";
import { apiRequestLog } from "@shared/schema";
import { db } from "../../../infra/db";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const auth = req.tiberAuth;
    if (!auth) return;

    const durationMs = Date.now() - start;
    db.insert(apiRequestLog)
      .values({
        apiKeyId: auth.apiKeyId,
        method: req.method,
        route: req.route?.path ?? req.path,
        status: res.statusCode,
        durationMs,
        requestId: req.requestId ?? "unknown",
      })
      .catch((err) => {
        console.warn("[v1/requestLogger] failed to write api_request_log:", err);
      });
  });

  next();
}
