import { Request, Response, NextFunction } from 'express';

/**
 * Admin authentication middleware
 * Validates API key for admin-only endpoints
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  // Check for API key in header or query parameter
  const apiKey = req.headers['x-admin-api-key'] as string || 
                 req.headers['authorization']?.replace('Bearer ', '') ||
                 req.query.admin_key as string;
  
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
      error: 'Missing API key. Provide via x-admin-api-key header, Authorization Bearer token, or admin_key query parameter'
    });
  }
  
  // Validate API key
  if (apiKey !== expectedKey) {
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
 * Useful for endpoints that should be monitored but not strictly protected
 */
export function optionalAdminAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-admin-api-key'] as string || 
                 req.headers['authorization']?.replace('Bearer ', '') ||
                 req.query.admin_key as string;
  
  const expectedKey = process.env.ADMIN_API_KEY;
  
  if (apiKey && expectedKey && apiKey === expectedKey) {
    console.log(`✅ Authenticated admin access for ${req.method} ${req.path} from ${req.ip}`);
    (req as any).isAdmin = true;
  } else if (apiKey) {
    console.warn(`⚠️ Invalid API key attempt for ${req.method} ${req.path} from ${req.ip}`);
  } else {
    console.log(`📊 Public access for ${req.method} ${req.path} from ${req.ip}`);
  }
  
  next();
}