import type { NextFunction, Request, Response } from "express";
import { ErrorCodes, type ErrorCode } from "../errors/codes";
import { v1Error } from "../contracts/response";

export class ApiError extends Error {
  status: number;
  code: ErrorCode;
  details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorFormat(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json(v1Error(err.code, err.message, req.requestId ?? "unknown", err.details));
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  return res
    .status(500)
    .json(v1Error(ErrorCodes.INTERNAL_ERROR, message, req.requestId ?? "unknown"));
}
