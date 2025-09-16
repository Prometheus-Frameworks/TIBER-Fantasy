import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message?: string;      // Custom error message
  skipSuccessfulRequests?: boolean; // Only count failed requests
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Simple in-memory rate limiter
 * In production, this should be replaced with Redis-based rate limiting
 */
export function createRateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.route?.path || req.path}`;
    const now = Date.now();
    
    // Clean up expired entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
      cleanupExpiredEntries(now);
    }
    
    // Get or create rate limit record
    let record = rateLimitStore.get(key);
    
    if (!record || now > record.resetTime) {
      // Create new window
      record = {
        count: 0,
        resetTime: now + windowMs
      };
      rateLimitStore.set(key, record);
    }
    
    // Check if limit exceeded
    if (record.count >= maxRequests) {
      console.warn(`🚫 Rate limit exceeded for ${req.ip} on ${req.method} ${req.path}`);
      return res.status(429).json({
        success: false,
        message,
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((record.resetTime - now) / 1000) // seconds
      });
    }
    
    // Increment counter (either always or only on errors)
    if (!skipSuccessfulRequests) {
      record.count++;
    } else {
      // We'll increment on errors in the error handler
      const originalSend = res.send;
      res.send = function(body) {
        if (res.statusCode >= 400) {
          record!.count++;
        }
        return originalSend.call(this, body);
      };
    }
    
    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': (maxRequests - record.count).toString(),
      'X-RateLimit-Reset': Math.ceil(record.resetTime / 1000).toString()
    });
    
    console.log(`📊 Rate limit: ${record.count}/${maxRequests} for ${req.ip} on ${req.path}`);
    next();
  };
}

/**
 * Predefined rate limiters for common use cases
 */
export const rateLimiters = {
  // Strict rate limiting for heavy operations (like ETL triggers)
  heavyOperation: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 3,            // 3 requests per 15 minutes
    message: 'Heavy operation rate limit exceeded. Maximum 3 requests per 15 minutes.',
    skipSuccessfulRequests: false
  }),
  
  // Moderate rate limiting for admin operations
  adminOperation: createRateLimit({
    windowMs: 5 * 60 * 1000,   // 5 minutes
    maxRequests: 10,           // 10 requests per 5 minutes
    message: 'Admin operation rate limit exceeded. Maximum 10 requests per 5 minutes.',
    skipSuccessfulRequests: false
  }),
  
  // Light rate limiting for status/health endpoints
  statusCheck: createRateLimit({
    windowMs: 1 * 60 * 1000,   // 1 minute
    maxRequests: 30,           // 30 requests per minute
    message: 'Status check rate limit exceeded. Maximum 30 requests per minute.',
    skipSuccessfulRequests: true
  })
};

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(now: number) {
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get current rate limit statistics (for monitoring)
 */
export function getRateLimitStats() {
  const now = Date.now();
  const activeEntries = Array.from(rateLimitStore.entries())
    .filter(([_, record]) => now <= record.resetTime)
    .map(([key, record]) => ({
      key,
      count: record.count,
      resetTime: record.resetTime
    }));
  
  return {
    totalActiveKeys: activeEntries.length,
    totalStoredKeys: rateLimitStore.size,
    activeEntries: activeEntries.slice(0, 20) // Show first 20 for monitoring
  };
}