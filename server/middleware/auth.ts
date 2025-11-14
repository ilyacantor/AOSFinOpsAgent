import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  tenantId?: string;
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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}
