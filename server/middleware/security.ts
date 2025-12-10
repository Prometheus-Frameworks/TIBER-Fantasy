/**
 * Security Middleware for Production-Ready API Protection
 * Provides admin authentication, rate limiting, and security headers
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Rate limiting store (in-memory for simplicity, use Redis in production)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.store.entries());
      for (const [key, entry] of entries) {
        if (now > entry.resetTime) {
          this.store.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number; } {
    const now = Date.now();
    const resetTime = now + windowMs;
    
    const existing = this.store.get(key);
    
    if (!existing || now > existing.resetTime) {
      // Create new entry or reset expired entry
      const entry = { count: 1, resetTime };
      this.store.set(key, entry);
      return entry;
    } else {
      // Increment existing entry
      existing.count++;
      return existing;
    }
  }

  getRemainingTime(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return 0;
    return Math.max(0, entry.resetTime - Date.now());
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

const rateLimitStore = new RateLimitStore();

export interface SecurityConfig {
  adminApiKey?: string;
  rateLimitWindow?: number;  // milliseconds
  rateLimitMax?: number;     // max requests per window
  allowedIPs?: string[];     // IP whitelist (optional)
}

const defaultSecurityConfig: Required<SecurityConfig> = {
  adminApiKey: process.env.ADMIN_API_KEY || '',
  rateLimitWindow: 15 * 60 * 1000, // 15 minutes
  rateLimitMax: 10, // 10 requests per 15 minutes
  allowedIPs: []
};

/**
 * Admin Authentication Middleware
 * Validates API key from Authorization header or X-API-Key header
 */
export function requireAdminAuth(config: Partial<SecurityConfig> = {}) {
  const finalConfig = { ...defaultSecurityConfig, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if admin API key is configured
      if (!finalConfig.adminApiKey) {
        console.error('[Security] ADMIN_API_KEY not configured - rejecting admin request');
        return res.status(503).json({
          success: false,
          error: 'Admin authentication not configured',
          code: 'ADMIN_AUTH_NOT_CONFIGURED'
        });
      }

      // Extract API key from headers
      const authHeader = req.headers.authorization;
      const apiKeyHeader = req.headers['x-api-key'] as string;
      
      let providedKey: string | null = null;
      
      // Support both "Bearer <key>" and "X-API-Key: <key>" formats
      if (authHeader && authHeader.startsWith('Bearer ')) {
        providedKey = authHeader.slice(7);
      } else if (apiKeyHeader) {
        providedKey = apiKeyHeader;
      }

      if (!providedKey) {
        return res.status(401).json({
          success: false,
          error: 'Admin authentication required',
          code: 'MISSING_API_KEY',
          details: 'Provide API key via Authorization: Bearer <key> or X-API-Key header'
        });
      }

      // Validate API key
      if (providedKey !== finalConfig.adminApiKey) {
        console.warn('[Security] Invalid admin API key attempt from:', req.ip);
        return res.status(403).json({
          success: false,
          error: 'Invalid admin credentials',
          code: 'INVALID_API_KEY'
        });
      }

      // Optional IP whitelist check
      if (finalConfig.allowedIPs.length > 0) {
        const clientIP = req.ip || req.connection.remoteAddress || '';
        if (!finalConfig.allowedIPs.includes(clientIP)) {
          console.warn('[Security] Admin access from non-whitelisted IP:', clientIP);
          return res.status(403).json({
            success: false,
            error: 'Access denied from this IP address',
            code: 'IP_NOT_WHITELISTED'
          });
        }
      }

      console.log('[Security] Admin authentication successful from:', req.ip);
      next();
      
    } catch (error) {
      console.error('[Security] Admin auth error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication error',
        code: 'AUTH_ERROR'
      });
    }
  };
}

/**
 * Rate Limiting Middleware
 * Implements sliding window rate limiting
 */
export function rateLimit(config: Partial<SecurityConfig> = {}) {
  const finalConfig = { ...defaultSecurityConfig, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Create rate limit key based on IP address
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      const key = `rate_limit:${clientIP}`;

      // Check and increment rate limit
      const { count, resetTime } = rateLimitStore.increment(key, finalConfig.rateLimitWindow);

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', finalConfig.rateLimitMax.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, finalConfig.rateLimitMax - count).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());

      if (count > finalConfig.rateLimitMax) {
        const remainingTime = rateLimitStore.getRemainingTime(key);
        const retryAfter = Math.ceil(remainingTime / 1000);

        res.setHeader('Retry-After', retryAfter.toString());
        
        console.warn(`[Security] Rate limit exceeded for ${clientIP}: ${count}/${finalConfig.rateLimitMax}`);
        
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          details: {
            limit: finalConfig.rateLimitMax,
            window_ms: finalConfig.rateLimitWindow,
            retry_after_seconds: retryAfter
          }
        });
      }

      next();
      
    } catch (error) {
      console.error('[Security] Rate limit error:', error);
      // Don't block requests on rate limit errors, just log and continue
      next();
    }
  };
}

/**
 * Security Headers Middleware
 * Adds security-related HTTP headers
 */
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Hide server information
    res.removeHeader('X-Powered-By');
    res.setHeader('Server', 'TIBER-API');
    
    // Add Content Security Policy for API responses
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
    
    next();
  };
}

/**
 * Request Validation Middleware
 * Validates request structure and content
 */
export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request format',
          code: 'VALIDATION_ERROR',
          details: result.error.issues
        });
      }

      // Attach validated data to request
      (req as any).validated = result.data;
      next();
      
    } catch (error) {
      console.error('[Security] Request validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Request validation failed',
        code: 'VALIDATION_FAILURE'
      });
    }
  };
}

/**
 * Combined Admin Security Middleware
 * Applies all security measures for admin endpoints
 */
export function adminSecurity(config: Partial<SecurityConfig> = {}) {
  const finalConfig = { ...defaultSecurityConfig, ...config };

  return [
    securityHeaders(),
    rateLimit({
      rateLimitWindow: finalConfig.rateLimitWindow,
      rateLimitMax: finalConfig.rateLimitMax
    }),
    requireAdminAuth({
      adminApiKey: finalConfig.adminApiKey,
      allowedIPs: finalConfig.allowedIPs
    })
  ];
}

// Cleanup on process termination
process.on('exit', () => {
  rateLimitStore.destroy();
});

process.on('SIGINT', () => {
  rateLimitStore.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  rateLimitStore.destroy();
  process.exit(0);
});