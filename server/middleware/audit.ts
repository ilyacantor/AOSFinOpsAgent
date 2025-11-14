import { type Request, type Response, type NextFunction } from 'express';
import { db } from '../db';
import { auditLogs } from '@shared/schema';
import { logger } from '../services/logger';

export interface AuditLogData {
  action: string;
  resourceType: string;
  resourceId?: string;
  changes?: any;
  metadata?: any;
}

export async function logAudit(
  req: Request,
  data: AuditLogData
): Promise<void> {
  try {
    const userId = req.user?.userId;
    const requestId = req.requestId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    await db.insert(auditLogs).values({
      requestId: requestId!,
      userId: userId || null,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId || null,
      changes: data.changes || null,
      metadata: data.metadata || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });

    logger.info('Audit log created', {
      requestId,
      userId,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
    });
  } catch (error) {
    logger.error('Failed to create audit log', {
      requestId: req.requestId,
      userId: req.user?.userId,
      action: data.action,
      resourceType: data.resourceType,
    }, error as Error);
  }
}

export function auditMiddleware(
  action: string,
  resourceType: string,
  getResourceId?: (req: Request) => string | undefined
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    const originalJson = res.json;

    let responseBody: any;

    res.send = function (body: any) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    res.json = function (body: any) {
      responseBody = body;
      return originalJson.call(this, body);
    };

    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const resourceId = getResourceId ? getResourceId(req) : req.params.id;
          
          await logAudit(req, {
            action,
            resourceType,
            resourceId,
            changes: req.method !== 'GET' ? req.body : undefined,
            metadata: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              query: req.query,
            },
          });
        } catch (error) {
          logger.error('Audit middleware error', {
            requestId: req.requestId,
            action,
            resourceType,
          }, error as Error);
        }
      }
    });

    next();
  };
}

export const auditActions = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  EXECUTE: 'EXECUTE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
} as const;

export const auditResourceTypes = {
  USER: 'user',
  RECOMMENDATION: 'recommendation',
  APPROVAL_REQUEST: 'approval_request',
  OPTIMIZATION: 'optimization',
  AWS_RESOURCE: 'aws_resource',
  SYSTEM_CONFIG: 'system_config',
  SESSION: 'session',
} as const;
