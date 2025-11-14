import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../services/logger';

/**
 * PRODUCTION NOTE: For production deployments, consider using an external store like Redis
 * instead of the default memory store to enable rate limiting across multiple server instances.
 * 
 * Example with Redis:
 * import RedisStore from 'rate-limit-redis';
 * import { createClient } from 'redis';
 * 
 * const redisClient = createClient({ url: process.env.REDIS_URL });
 * const store = new RedisStore({ client: redisClient, prefix: 'rl:' });
 * 
 * Then add `store` to each rateLimit() configuration below.
 * 
 * The memory store works fine for development and single-instance deployments,
 * and automatically cleans up expired entries.
 */

const customRateLimitHandler = (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const method = req.method;
  const path = req.path;
  const userAgent = req.get('user-agent') || 'unknown';
  
  logger.warn('Rate limit exceeded', {
    requestId: req.requestId,
    ip,
    method,
    path,
    userAgent,
    userId: req.user?.userId
  });

  res.status(429).json({
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: res.getHeader('Retry-After')
  });
};

export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests from this IP',
    message: 'Please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: customRateLimitHandler,
  skip: (req) => {
    return req.path === '/api/health' || req.path === '/api/health/detailed';
  }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: customRateLimitHandler,
  skipSuccessfulRequests: true
});

export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    error: 'Too many write operations',
    message: 'Please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: customRateLimitHandler,
  skip: (req) => {
    return req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
  }
});

export const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    error: 'Too many read operations',
    message: 'Please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: customRateLimitHandler,
  skip: (req) => {
    return req.method !== 'GET' && req.method !== 'HEAD';
  }
});
