import { db } from '../db';
import { auditLogs, type InsertAuditLog } from '@shared/schema';
import { logger } from './logger';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  EXECUTE = 'EXECUTE'
}

export interface AuditLogData {
  requestId: string;
  userId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

class AuditService {
  private static instance: AuditService;

  private constructor() {}

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  async log(data: AuditLogData): Promise<void> {
    try {
      const auditLogEntry: InsertAuditLog = {
        requestId: data.requestId,
        userId: data.userId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        changes: data.changes,
        metadata: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent
      };

      await db.insert(auditLogs).values(auditLogEntry);

      logger.debug('Audit log created', {
        requestId: data.requestId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId
      });
    } catch (error) {
      logger.error('Failed to create audit log', {
        requestId: data.requestId,
        action: data.action,
        resourceType: data.resourceType
      }, error as Error);
    }
  }

  async logCreate(
    requestId: string,
    userId: string | undefined,
    resourceType: string,
    resourceId: string,
    resourceData: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      requestId,
      userId,
      action: AuditAction.CREATE,
      resourceType,
      resourceId,
      changes: { created: resourceData },
      metadata
    });
  }

  async logUpdate(
    requestId: string,
    userId: string | undefined,
    resourceType: string,
    resourceId: string,
    oldData: Record<string, any>,
    newData: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    const changes: Record<string, any> = {};
    
    for (const key in newData) {
      if (oldData[key] !== newData[key]) {
        changes[key] = {
          old: oldData[key],
          new: newData[key]
        };
      }
    }

    await this.log({
      requestId,
      userId,
      action: AuditAction.UPDATE,
      resourceType,
      resourceId,
      changes,
      metadata
    });
  }

  async logDelete(
    requestId: string,
    userId: string | undefined,
    resourceType: string,
    resourceId: string,
    resourceData: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      requestId,
      userId,
      action: AuditAction.DELETE,
      resourceType,
      resourceId,
      changes: { deleted: resourceData },
      metadata
    });
  }

  async logApprove(
    requestId: string,
    userId: string | undefined,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      requestId,
      userId,
      action: AuditAction.APPROVE,
      resourceType,
      resourceId,
      metadata
    });
  }

  async logReject(
    requestId: string,
    userId: string | undefined,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      requestId,
      userId,
      action: AuditAction.REJECT,
      resourceType,
      resourceId,
      metadata
    });
  }

  async logExecute(
    requestId: string,
    userId: string | undefined,
    resourceType: string,
    resourceId: string,
    executionDetails: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      requestId,
      userId,
      action: AuditAction.EXECUTE,
      resourceType,
      resourceId,
      changes: executionDetails,
      metadata
    });
  }
}

export const auditService = AuditService.getInstance();
