import { db } from '../db';
import { logger } from '../services/logger';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import * as schema from '@shared/schema';

export type Transaction = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export interface TransactionOptions {
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<TransactionOptions> = {
  maxRetries: 3,
  retryDelay: 100,
  onRetry: (attempt, error) => {
    logger.warn('Transaction retry', { attempt, error: error.message });
  },
};

export async function withTransaction<T>(
  fn: (tx: Transaction) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        return await fn(tx as Transaction);
      });
    } catch (error) {
      lastError = error as Error;

      const isRetryable =
        lastError.message.includes('deadlock') ||
        lastError.message.includes('serialization') ||
        lastError.message.includes('concurrent');

      if (!isRetryable || attempt === opts.maxRetries) {
        logger.error('Transaction failed', {
          attempt,
          maxRetries: opts.maxRetries,
          error: lastError.message,
        });
        throw lastError;
      }

      opts.onRetry(attempt, lastError);

      if (attempt < opts.maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, opts.retryDelay * attempt)
        );
      }
    }
  }

  throw lastError || new Error('Transaction failed without error');
}

export interface TransactionContext {
  tx: Transaction;
  requestId?: string;
  userId?: string;
  tenantId?: string;
}

export async function executeInTransaction<T>(
  fn: (context: TransactionContext) => Promise<T>,
  metadata: {
    requestId?: string;
    userId?: string;
    tenantId?: string;
  } = {},
  options: TransactionOptions = {}
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await withTransaction(async (tx) => {
      return await fn({
        tx,
        ...metadata,
      });
    }, options);

    logger.info('Transaction completed successfully', {
      duration: Date.now() - startTime,
      ...metadata,
    });

    return result;
  } catch (error) {
    logger.error(
      'Transaction failed',
      {
        duration: Date.now() - startTime,
        ...metadata,
      },
      error as Error
    );
    throw error;
  }
}

export interface ApprovalTransactionData {
  recommendationId: string;
  approvalRequestId: string;
  status: 'approved' | 'rejected';
  approvedBy: string;
  comments?: string;
  tenantId: string;
}

export interface OptimizationExecutionData {
  recommendationId: string;
  executedBy: string;
  beforeConfig: any;
  afterConfig: any;
  actualSavings?: number;
  status: 'success' | 'failed' | 'in-progress';
  errorMessage?: string;
  tenantId: string;
}

export async function handleApprovalTransaction(
  data: ApprovalTransactionData,
  metadata: { requestId?: string; userId?: string }
): Promise<{
  recommendation: any;
  approvalRequest: any;
}> {
  return await executeInTransaction(
    async ({ tx }) => {
      const { recommendations, approvalRequests } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      const [updatedRecommendation] = await tx
        .update(recommendations)
        .set({
          status: data.status,
          updatedAt: new Date(),
        })
        .where(eq(recommendations.id, data.recommendationId))
        .returning();

      if (!updatedRecommendation) {
        throw new Error(`Recommendation ${data.recommendationId} not found`);
      }

      const [updatedApprovalRequest] = await tx
        .update(approvalRequests)
        .set({
          status: data.status,
          approvedBy: data.approvedBy,
          approvalDate: new Date(),
          comments: data.comments || null,
        })
        .where(eq(approvalRequests.id, data.approvalRequestId))
        .returning();

      if (!updatedApprovalRequest) {
        throw new Error(`Approval request ${data.approvalRequestId} not found`);
      }

      return {
        recommendation: updatedRecommendation,
        approvalRequest: updatedApprovalRequest,
      };
    },
    { ...metadata, tenantId: data.tenantId }
  );
}

export async function handleOptimizationExecutionTransaction(
  data: OptimizationExecutionData,
  metadata: { requestId?: string; userId?: string }
): Promise<{
  recommendation: any;
  optimizationHistory: any;
}> {
  return await executeInTransaction(
    async ({ tx }) => {
      const { recommendations, optimizationHistory, optimizationSessions } = await import('@shared/schema');
      const { eq, and, desc, sql } = await import('drizzle-orm');

      const [updatedRecommendation] = await tx
        .update(recommendations)
        .set({
          status: 'executed',
          updatedAt: new Date(),
        })
        .where(eq(recommendations.id, data.recommendationId))
        .returning();

      if (!updatedRecommendation) {
        throw new Error(`Recommendation ${data.recommendationId} not found`);
      }

      // Get current session for this tenant
      const [currentSession] = await tx
        .select()
        .from(optimizationSessions)
        .where(
          and(
            eq(optimizationSessions.tenantId, data.tenantId),
            eq(optimizationSessions.isActive, true)
          )
        )
        .orderBy(desc(optimizationSessions.createdAt))
        .limit(1);

      const sessionId = currentSession?.id || null;

      const [historyRecord] = await tx
        .insert(optimizationHistory)
        .values({
          tenantId: data.tenantId,
          recommendationId: data.recommendationId,
          executedBy: data.executedBy,
          executionDate: new Date(),
          beforeConfig: data.beforeConfig,
          afterConfig: data.afterConfig,
          actualSavings: data.actualSavings || null,
          status: data.status,
          errorMessage: data.errorMessage || null,
          sessionId: sessionId,
        })
        .returning();

      // Update session tracking for successful optimizations
      if (currentSession && data.status === 'success' && data.actualSavings) {
        await tx
          .update(optimizationSessions)
          .set({
            resourcesOptimized: sql`${optimizationSessions.resourcesOptimized} + 1`,
            totalSavingsRealized: sql`${optimizationSessions.totalSavingsRealized} + ${data.actualSavings}`
          })
          .where(eq(optimizationSessions.id, currentSession.id));
      }

      return {
        recommendation: updatedRecommendation,
        optimizationHistory: historyRecord,
      };
    },
    { ...metadata, tenantId: data.tenantId }
  );
}
