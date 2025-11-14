import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  tenantId?: string;
  iat?: number; // Issued at (automatically added by jwt.sign)
  exp?: number; // Expiration (automatically added by jwt.sign)
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || '';

// Validate JWT_SECRET at module load - fail fast if missing or too short
if (!JWT_SECRET || JWT_SECRET.length === 0) {
  throw new Error(
    'CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not set.\n' +
    'Authentication cannot function without a secure JWT secret.\n' +
    'Please set JWT_SECRET to a random string of at least 32 characters.\n' +
    'Example: export JWT_SECRET=$(openssl rand -base64 32)'
  );
}

if (JWT_SECRET.length < 32) {
  throw new Error(
    `CRITICAL SECURITY ERROR: JWT_SECRET is too short (${JWT_SECRET.length} characters).\n` +
    'JWT_SECRET must be at least 32 characters for security.\n' +
    'Please set JWT_SECRET to a random string of at least 32 characters.\n' +
    'Example: export JWT_SECRET=$(openssl rand -base64 32)'
  );
}

console.log('✓ JWT_SECRET validated successfully (length: ' + JWT_SECRET.length + ' characters)');

/**
 * FUTURE SESSION SECURITY ENHANCEMENTS:
 * 
 * 1. Refresh Token Rotation:
 *    - Implement separate refresh tokens with longer TTL (7-30 days)
 *    - Short-lived access tokens (15 min) + long-lived refresh tokens
 *    - Rotate refresh tokens on each use to prevent reuse attacks
 * 
 * 2. Session Tracking Database:
 *    - Create sessions table to track active sessions
 *    - Store: sessionId, userId, tenantId, createdAt, lastActivityAt, ipAddress, userAgent
 *    - Enable server-side session revocation
 *    - Implement concurrent session limits per user
 * 
 * 3. Inactivity Timeout:
 *    - Track last activity timestamp in session DB
 *    - Auto-expire sessions after 30 min of inactivity
 *    - Update lastActivityAt on each authenticated request
 * 
 * 4. Secure Cookie-based Sessions (if migrating from header-based JWT):
 *    - httpOnly: true (prevent XSS)
 *    - secure: true (HTTPS only)
 *    - sameSite: 'strict' (CSRF protection)
 *    - signed cookies for integrity
 * 
 * 5. Token Binding:
 *    - Bind tokens to specific IP addresses or user agents
 *    - Detect token theft via location/device changes
 *    - Require re-authentication on suspicious activity
 */

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
      req.user = payload;
    } catch (error) {
      // Token is invalid, but we don't reject the request
    }
  }
  
  next();
}

export function checkTokenAge(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.exp) {
    return next();
  }

  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = req.user.exp - now;
  const fifteenMinutes = 15 * 60;

  // Warn if token expires in less than 15 minutes
  if (timeUntilExpiry < fifteenMinutes && timeUntilExpiry > 0) {
    res.setHeader('X-Token-Expiring-Soon', 'true');
    res.setHeader('X-Token-Expires-In', timeUntilExpiry.toString());
  }

  next();
}

/**
 * Enforce session timeout and absolute session age limits.
 * This middleware provides comprehensive session security by:
 * 1. Validating JWT token expiration (hard expiration)
 * 2. Enforcing maximum session age from issuance (absolute session duration)
 * 3. Warning clients when tokens are expiring soon
 * 
 * Should be mounted globally after rate limiting but will gracefully skip
 * unauthenticated requests (where req.user is undefined).
 */
export function enforceSessionTimeout(req: Request, res: Response, next: NextFunction) {
  // Step 1: Ensure req.user is defined (already authenticated)
  if (!req.user) {
    console.log(`[enforceSessionTimeout] Skipping - no authenticated user (path: ${req.path})`);
    return next(); // Skip if not authenticated (shouldn't happen after authenticateToken)
  }

  const now = Math.floor(Date.now() / 1000);
  const sessionAge = req.user.iat ? now - req.user.iat : 0;
  const timeUntilExpiry = req.user.exp ? req.user.exp - now : 0;

  console.log(`[enforceSessionTimeout] Checking session for user ${req.user.username} (path: ${req.path}, age: ${sessionAge}s, expiry: ${timeUntilExpiry}s)`);

  // Step 2: Check if JWT token is expired (hard expiration)
  if (!req.user.exp || req.user.exp <= now) {
    console.error(`[enforceSessionTimeout] ❌ Token expired for user ${req.user.username} - returning 401`);
    return res.status(401).json({
      error: 'Session expired',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Step 3: Check maximum session age (iat-based absolute session duration)
  const MAX_SESSION_AGE = 2 * 60 * 60; // 2 hours (matches JWT TTL)
  const issuedAt = req.user.iat ?? (req.user.exp - (2 * 60 * 60)); // Fallback if iat missing
  
  if (now - issuedAt > MAX_SESSION_AGE) {
    console.error(`[enforceSessionTimeout] ❌ Session too old for user ${req.user.username} (age: ${now - issuedAt}s > max: ${MAX_SESSION_AGE}s) - returning 401`);
    return res.status(401).json({
      error: 'Session too old - please login again',
      code: 'SESSION_TOO_OLD'
    });
  }

  // Step 4: Set warning headers if token expiring soon (<15 minutes)
  const FIFTEEN_MINUTES = 15 * 60;
  
  if (timeUntilExpiry < FIFTEEN_MINUTES && timeUntilExpiry > 0) {
    console.warn(`[enforceSessionTimeout] ⚠️  Token expiring soon for user ${req.user.username} (${timeUntilExpiry}s remaining)`);
    res.setHeader('X-Token-Expiring-Soon', 'true');
    res.setHeader('X-Token-Expires-In', timeUntilExpiry.toString());
  }

  // Step 5: Continue to next middleware
  console.log(`[enforceSessionTimeout] ✓ Session valid for user ${req.user.username} - continuing to next middleware`);
  next();
}

const roleHierarchy: Record<string, number> = {
  'readonly': 1,
  'user': 2,
  'admin': 3,
  'cfo': 3,
  'Head of Cloud Platform': 3
};

export function requireRole(minRole: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoleLevel = roleHierarchy[req.user.role] || 0;
    const requiredRoleLevel = roleHierarchy[minRole] || 999;

    if (userRoleLevel < requiredRoleLevel) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: minRole,
        current: req.user.role
      });
    }

    next();
  };
}

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });
}
