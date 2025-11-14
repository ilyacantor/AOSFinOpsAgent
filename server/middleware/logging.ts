import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../services/logger';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  req.requestId = requestId;

  const start = Date.now();
  const { method, path, ip } = req;
  const userAgent = req.get('user-agent') || 'unknown';

  logger.info('Request started', {
    requestId,
    method,
    path,
    ip,
    userAgent,
    userId: req.user?.userId
  });

  const originalJson = res.json;
  let responseBody: any;

  res.json = function(body: any) {
    responseBody = body;
    return originalJson.call(this, body);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    const logContext = {
      requestId,
      method,
      path,
      statusCode,
      duration,
      userId: req.user?.userId
    };

    if (statusCode >= 500) {
      logger.error('Request failed', logContext);
    } else if (statusCode >= 400) {
      logger.warn('Request completed with client error', logContext);
    } else {
      logger.info('Request completed', logContext);
    }
  });

  res.on('error', (error: Error) => {
    logger.error('Response error', {
      requestId,
      method,
      path,
      userId: req.user?.userId
    }, error);
  });

  next();
}
