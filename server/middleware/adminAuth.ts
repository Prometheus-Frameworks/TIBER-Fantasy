import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Constant-time comparison for secret keys, to avoid leaking key prefixes
 * through response-time differences. Both inputs are hashed first so that
 * unequal lengths are handled safely (timingSafeEqual throws on
 * different-length buffers).
 */
export function timingSafeKeyCompare(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const providedHash = crypto.createHash('sha256').update(provided).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

/**
 * Admin authentication middleware
 * Validates API key for admin-only endpoints.
 * Keys are accepted via headers only — never via query parameters, which
 * leak secrets into server logs, browser history, and Referer headers.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  // Accept API key via header only (never via query param — URL keys leak into logs)
  const apiKey = req.headers['x-admin-api-key'] as string ||
                 req.headers['authorization']?.replace('Bearer ', '');

  // Get expected API key from environment
  const expectedKey = process.env.ADMIN_API_KEY;

  // If no API key is configured, block access entirely
  if (!expectedKey) {
    console.warn('⚠️ ADMIN_API_KEY not configured - blocking admin access');
    return res.status(503).json({
      success: false,
      message: 'Admin functionality is not configured',
      error: 'ADMIN_API_KEY environment variable not set'
    });
  }

  // Check if API key was provided
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'Missing API key. Provide via x-admin-api-key header or Authorization: Bearer <key>'
    });
  }

  // Validate API key (constant-time)
  if (!timingSafeKeyCompare(apiKey, expectedKey)) {
    console.warn(`❌ Invalid admin API key attempt from ${req.ip}`);
    return res.status(403).json({
      success: false,
      message: 'Invalid API key',
      error: 'Provided API key is not valid'
    });
  }

  // Log successful admin access
  console.log(`✅ Admin access granted for ${req.method} ${req.path} from ${req.ip}`);
  next();
}

/**
 * Optional admin auth - allows access with or without key but logs attempts
 * Useful for endpoints that should be monitored but not strictly protected.
 * Keys are accepted via headers only — never via query parameters.
 */
export function optionalAdminAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-admin-api-key'] as string ||
                 req.headers['authorization']?.replace('Bearer ', '');

  const expectedKey = process.env.ADMIN_API_KEY;

  if (timingSafeKeyCompare(apiKey, expectedKey)) {
    console.log(`✅ Authenticated admin access for ${req.method} ${req.path} from ${req.ip}`);
    (req as any).isAdmin = true;
  } else if (apiKey) {
    console.warn(`⚠️ Invalid API key attempt for ${req.method} ${req.path} from ${req.ip}`);
  } else {
    console.log(`📊 Public access for ${req.method} ${req.path} from ${req.ip}`);
  }

  next();
}
