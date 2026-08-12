import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  validateBrandReplay,
  validateBrandStream,
  type BrandReplayRequest,
  type BrandStreamRequest,
} from '../schemas/adminSchemas';
import type {
  BrandReplayResponse,
  BrandStreamResponse,
} from '../services/AdminService';

export interface AdminBrandService {
  replayBrandSignals(request: BrandReplayRequest): Promise<BrandReplayResponse>;
  streamBrandSignals(request: BrandStreamRequest): Promise<BrandStreamResponse>;
}

function adminBrandErrorStatus(error: unknown): number {
  if (error instanceof z.ZodError) {
    return 400;
  }
  const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof statusCode === 'number' ? statusCode : 500;
}

function adminBrandErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return 'Validation error: ' + error.errors
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
  }
  return (error as Error)?.message || 'Unknown error';
}

/** Mounted POST /api/admin/brand/replay boundary with an explicit service seam. */
export async function handleAdminBrandReplay(
  req: Request,
  res: Response,
  service: AdminBrandService,
): Promise<void> {
  const startTime = Date.now();

  try {
    console.log('🔄 [AdminAPI] Brand replay request received');
    const validatedData = validateBrandReplay(req.body);
    const result = await service.replayBrandSignals(validatedData);
    const duration = Date.now() - startTime;
    console.log(`${result.success ? '✅' : '❌'} [AdminAPI] Brand replay completed in ${duration}ms`);

    res.json({
      ...result,
      timestamp: new Date().toISOString(),
      operation: 'brand_replay',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ [AdminAPI] Brand replay failed:', error);

    res.status(adminBrandErrorStatus(error)).json({
      success: false,
      error: adminBrandErrorMessage(error),
      details: error instanceof z.ZodError ? error.errors : undefined,
      timestamp: new Date().toISOString(),
      operation: 'brand_replay',
      processingTimeMs: duration,
    });
  }
}

/** Mounted POST /api/admin/brand/stream boundary with an explicit service seam. */
export async function handleAdminBrandStream(
  req: Request,
  res: Response,
  service: AdminBrandService,
): Promise<void> {
  const startTime = Date.now();

  try {
    console.log('🚀 [AdminAPI] Brand streaming request received');
    const validatedData = validateBrandStream(req.body);
    const result = await service.streamBrandSignals(validatedData);
    const duration = Date.now() - startTime;
    console.log(`${result.success ? '✅' : '❌'} [AdminAPI] Brand streaming completed in ${duration}ms`);

    res.json({
      ...result,
      timestamp: new Date().toISOString(),
      operation: 'brand_streaming',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ [AdminAPI] Brand streaming failed:', error);

    res.status(adminBrandErrorStatus(error)).json({
      success: false,
      error: adminBrandErrorMessage(error),
      details: error instanceof z.ZodError ? error.errors : undefined,
      timestamp: new Date().toISOString(),
      operation: 'brand_streaming',
      processingTimeMs: duration,
    });
  }
}
