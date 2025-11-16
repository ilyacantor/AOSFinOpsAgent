import { 
  users, awsResources, costReports, recommendations, optimizationHistory, approvalRequests, systemConfig, aiModeHistory,
  type User, type InsertUser, type AwsResource, type InsertAwsResource,
  type CostReport, type InsertCostReport, type Recommendation, type InsertRecommendation,
  type OptimizationHistory, type InsertOptimizationHistory, type ApprovalRequest, type InsertApprovalRequest,
  type SystemConfig, type InsertSystemConfig, type AiModeHistory, type InsertAiModeHistory
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { pineconeService } from "./services/pinecone.js";
import { CircuitBreaker } from "./lib/circuit-breaker.js";
import bcrypt from "bcrypt";

// Circuit breaker for Pinecone operations
// Exported for use in other services (e.g., gemini-ai.ts)
export const pineconeCircuitBreaker = new CircuitBreaker('Pinecone', {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000 // 30 seconds
});

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function validatePassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

export interface IStorage {
  // User operations
  getUser(id: string, tenantId: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser, tenantId: string): Promise<User>;

  // AWS Resources
  createAwsResource(resource: InsertAwsResource, tenantId: string): Promise<AwsResource>;
  getAwsResource(resourceId: string, tenantId: string): Promise<AwsResource | undefined>;
  updateAwsResource(resourceId: string, updates: Partial<InsertAwsResource>, tenantId: string): Promise<AwsResource | undefined>;
  getAllAwsResources(tenantId: string): Promise<AwsResource[]>;

  // Cost Reports
  createCostReport(report: InsertCostReport, tenantId: string): Promise<CostReport>;
  getCostReports(tenantId: string, dateFrom?: Date, dateTo?: Date): Promise<CostReport[]>;
  getMonthlyCostSummary(tenantId: string): Promise<{ month: string; totalCost: number; }[]>;

  // Recommendations
  createRecommendation(recommendation: InsertRecommendation, tenantId: string): Promise<Recommendation>;
  getRecommendations(tenantId: string, status?: string): Promise<Recommendation[]>;
  getRecentRecommendations(limit: number, tenantId: string): Promise<Recommendation[]>;
  getRecommendation(id: string, tenantId: string): Promise<Recommendation | undefined>;
  updateRecommendationStatus(id: string, status: string, tenantId: string): Promise<Recommendation | undefined>;
  
  // Optimization History
  createOptimizationHistory(history: InsertOptimizationHistory, tenantId: string): Promise<OptimizationHistory>;
  getOptimizationHistory(tenantId: string, limit?: number): Promise<OptimizationHistory[]>;
  getRecentOptimizationHistory(limit: number, tenantId: string): Promise<OptimizationHistory[]>;

  // Approval Requests
  createApprovalRequest(request: InsertApprovalRequest, tenantId: string): Promise<ApprovalRequest>;
  getApprovalRequests(tenantId: string, status?: string): Promise<ApprovalRequest[]>;
  updateApprovalRequest(id: string, updates: Partial<InsertApprovalRequest>, tenantId: string): Promise<ApprovalRequest | undefined>;

  // System Configuration
  getSystemConfig(key: string, tenantId: string): Promise<SystemConfig | undefined>;
  setSystemConfig(config: InsertSystemConfig, tenantId: string): Promise<SystemConfig>;
  updateSystemConfig(key: string, value: string, updatedBy: string, tenantId: string): Promise<SystemConfig | undefined>;
  getAllSystemConfig(tenantId: string): Promise<SystemConfig[]>;

  // AI Mode History
  createAiModeHistory(history: InsertAiModeHistory, tenantId: string): Promise<AiModeHistory>;
  updateAiModeHistory(id: string, updates: Partial<InsertAiModeHistory>, tenantId: string): Promise<AiModeHistory | undefined>;
  getRecentAiModeHistory(limit: number, tenantId: string): Promise<AiModeHistory[]>;
  getAiModeHistory(id: string, tenantId: string): Promise<AiModeHistory | undefined>;
  getAiModeHistoryWithRecommendations(id: string, tenantId: string): Promise<{
    aiRun: AiModeHistory;
    recommendations: Recommendation[];
    savingsBreakdown: {
      totalSavings: number;
      averageSavings: number;
      savingsByType: Record<string, number>;
    };
    executionModeCounts: {
      autonomous: number;
      hitl: number;
      autonomousPercentage: number;
      hitlPercentage: number;
    };
  } | undefined>;

  // Dashboard metrics
  getDashboardMetrics(tenantId: string): Promise<{
    monthlySpend: number;
    identifiedSavings: number;
    resourcesAnalyzed: number;
    wastePercentage: number;
  }>;

  // Metrics summary for autopilot
  getMetricsSummary(tenantId: string): Promise<{
    monthlySpend: number;
    ytdSpend: number;
    identifiedSavingsAwaitingApproval: number;
    realizedSavingsYTD: number;
    wastePercentOptimizedYTD: number;
    monthlySpendChange: number;
    ytdSpendChange: number;
  }>;

  // Optimization mix (Autonomous vs HITL distribution)
  getOptimizationMix(tenantId: string): Promise<{
    autonomousCount: number;
    hitlCount: number;
    autonomousPercentage: number;
    hitlPercentage: number;
    totalRecommendations: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string, tenantId: string): Promise<User | undefined> {
    const [user] = await db.select()
      .from(users)
      .where(
        and(
          eq(users.id, id),
          eq(users.tenantId, tenantId)
        )
      );
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser, tenantId: string): Promise<User> {
    const hashedPassword = await hashPassword(insertUser.password);
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, password: hashedPassword, tenantId })
      .returning();
    return user;
  }

  async createAwsResource(resource: InsertAwsResource, tenantId: string): Promise<AwsResource> {
    const [created] = await db
      .insert(awsResources)
      .values({ ...resource, tenantId })
      .returning();
    return created;
  }

  async getAwsResource(resourceId: string, tenantId: string): Promise<AwsResource | undefined> {
    const [resource] = await db
      .select()
      .from(awsResources)
      .where(
        and(
          eq(awsResources.resourceId, resourceId),
          eq(awsResources.tenantId, tenantId)
        )
      );
    return resource || undefined;
  }

  async updateAwsResource(resourceId: string, updates: Partial<InsertAwsResource>, tenantId: string): Promise<AwsResource | undefined> {
    const [updated] = await db
      .update(awsResources)
      .set({ ...updates, lastAnalyzed: new Date() })
      .where(
        and(
          eq(awsResources.resourceId, resourceId),
          eq(awsResources.tenantId, tenantId)
        )
      )
      .returning();
    return updated || undefined;
  }

  async getAllAwsResources(tenantId: string): Promise<AwsResource[]> {
    return await db.select()
      .from(awsResources)
      .where(eq(awsResources.tenantId, tenantId));
  }

  async createCostReport(report: InsertCostReport, tenantId: string): Promise<CostReport> {
    const [created] = await db
      .insert(costReports)
      .values({ ...report, tenantId })
      .returning();
    return created;
  }

  async getCostReports(tenantId: string, dateFrom?: Date, dateTo?: Date): Promise<CostReport[]> {
    if (dateFrom && dateTo) {
      return await db
        .select()
        .from(costReports)
        .where(
          and(
            eq(costReports.tenantId, tenantId),
            gte(costReports.reportDate, dateFrom),
            lte(costReports.reportDate, dateTo)
          )
        )
        .orderBy(desc(costReports.reportDate));
    }
    
    return await db
      .select()
      .from(costReports)
      .where(eq(costReports.tenantId, tenantId))
      .orderBy(desc(costReports.reportDate));
  }

  async getMonthlyCostSummary(tenantId: string): Promise<{ month: string; totalCost: number; }[]> {
    const result = await db
      .select({
        month: sql<string>`TO_CHAR(${costReports.reportDate}, 'YYYY-MM')`,
        totalCost: sql<number>`SUM(${costReports.cost})::numeric`
      })
      .from(costReports)
      .where(eq(costReports.tenantId, tenantId))
      .groupBy(sql`TO_CHAR(${costReports.reportDate}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${costReports.reportDate}, 'YYYY-MM')`);
    
    return result.map(r => ({ month: r.month, totalCost: Number(r.totalCost) }));
  }

  async createRecommendation(recommendation: InsertRecommendation, tenantId: string): Promise<Recommendation> {
    const [created] = await db
      .insert(recommendations)
      .values({ ...recommendation, tenantId })
      .returning();
    
    // Store in Pinecone for RAG (async, non-blocking) with circuit breaker protection
    pineconeCircuitBreaker.executeWithFallback(
      () => pineconeService.storeRecommendation(created)
    ).catch(err => {
      console.warn('[Storage] Pinecone storage degraded, skipping vector storage for recommendation:', created.id);
      console.error('Pinecone error:', err.message || err);
    });
    
    return created;
  }

  async getRecommendations(tenantId: string, status?: string): Promise<Recommendation[]> {
    if (status) {
      return await db
        .select()
        .from(recommendations)
        .where(
          and(
            eq(recommendations.tenantId, tenantId),
            eq(recommendations.status, status)
          )
        )
        .orderBy(desc(recommendations.createdAt));
    }
    
    return await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.tenantId, tenantId))
      .orderBy(desc(recommendations.createdAt));
  }

  async getRecommendation(id: string, tenantId: string): Promise<Recommendation | undefined> {
    const [recommendation] = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.id, id),
          eq(recommendations.tenantId, tenantId)
        )
      );
    return recommendation || undefined;
  }

  async updateRecommendationStatus(id: string, status: string, tenantId: string): Promise<Recommendation | undefined> {
    const [updated] = await db
      .update(recommendations)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(recommendations.id, id),
          eq(recommendations.tenantId, tenantId)
        )
      )
      .returning();
    return updated || undefined;
  }

  async createOptimizationHistory(history: InsertOptimizationHistory, tenantId: string): Promise<OptimizationHistory> {
    const [created] = await db
      .insert(optimizationHistory)
      .values({ ...history, tenantId })
      .returning();
    
    // Store in Pinecone for RAG (async, non-blocking) with circuit breaker protection
    pineconeCircuitBreaker.executeWithFallback(
      () => pineconeService.storeOptimizationHistory(created)
    ).catch(err => {
      console.warn('[Storage] Pinecone storage degraded, skipping vector storage for optimization history:', created.id);
      console.error('Pinecone error:', err.message || err);
    });
    
    return created;
  }

  async getOptimizationHistory(tenantId: string, limit = 50): Promise<OptimizationHistory[]> {
    return await db
      .select()
      .from(optimizationHistory)
      .where(eq(optimizationHistory.tenantId, tenantId))
      .orderBy(desc(optimizationHistory.createdAt))
      .limit(limit);
  }

  // Optimized: Get recent recommendations with database-level limit
  async getRecentRecommendations(limit: number, tenantId: string): Promise<Recommendation[]> {
    return await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.tenantId, tenantId))
      .orderBy(desc(recommendations.createdAt))
      .limit(limit);
  }

  // Optimized: Get recent optimization history with database-level limit
  async getRecentOptimizationHistory(limit: number, tenantId: string): Promise<OptimizationHistory[]> {
    return await db
      .select()
      .from(optimizationHistory)
      .where(eq(optimizationHistory.tenantId, tenantId))
      .orderBy(desc(optimizationHistory.createdAt))
      .limit(limit);
  }

  async createApprovalRequest(request: InsertApprovalRequest & { approvalDate?: Date }, tenantId: string): Promise<ApprovalRequest> {
    const [created] = await db
      .insert(approvalRequests)
      .values({ ...request, tenantId })
      .returning();
    return created;
  }

  async getApprovalRequests(tenantId: string, status?: string): Promise<ApprovalRequest[]> {
    if (status) {
      return await db
        .select()
        .from(approvalRequests)
        .where(
          and(
            eq(approvalRequests.tenantId, tenantId),
            eq(approvalRequests.status, status)
          )
        )
        .orderBy(desc(approvalRequests.createdAt));
    }
    
    return await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.tenantId, tenantId))
      .orderBy(desc(approvalRequests.createdAt));
  }

  async updateApprovalRequest(id: string, updates: Partial<InsertApprovalRequest>, tenantId: string): Promise<ApprovalRequest | undefined> {
    const [updated] = await db
      .update(approvalRequests)
      .set(updates)
      .where(
        and(
          eq(approvalRequests.id, id),
          eq(approvalRequests.tenantId, tenantId)
        )
      )
      .returning();
    return updated || undefined;
  }

  async getSystemConfig(key: string, tenantId: string): Promise<SystemConfig | undefined> {
    const [config] = await db
      .select()
      .from(systemConfig)
      .where(
        and(
          eq(systemConfig.key, key),
          eq(systemConfig.tenantId, tenantId)
        )
      );
    return config || undefined;
  }

  async setSystemConfig(config: InsertSystemConfig, tenantId: string): Promise<SystemConfig> {
    // Use upsert functionality - insert or update if key exists
    const [result] = await db
      .insert(systemConfig)
      .values({ ...config, tenantId })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: {
          value: config.value,
          description: config.description,
          updatedBy: config.updatedBy,
          updatedAt: new Date()
        }
      })
      .returning();
    return result;
  }

  async updateSystemConfig(key: string, value: string, updatedBy: string, tenantId: string): Promise<SystemConfig | undefined> {
    const [updated] = await db
      .update(systemConfig)
      .set({ value, updatedBy, updatedAt: new Date() })
      .where(
        and(
          eq(systemConfig.key, key),
          eq(systemConfig.tenantId, tenantId)
        )
      )
      .returning();
    return updated || undefined;
  }

  async getAllSystemConfig(tenantId: string): Promise<SystemConfig[]> {
    return await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.tenantId, tenantId))
      .orderBy(systemConfig.key);
  }

  async createAiModeHistory(history: InsertAiModeHistory, tenantId: string): Promise<AiModeHistory> {
    const [created] = await db
      .insert(aiModeHistory)
      .values({ ...history, tenantId })
      .returning();
    return created;
  }

  async updateAiModeHistory(id: string, updates: Partial<InsertAiModeHistory>, tenantId: string): Promise<AiModeHistory | undefined> {
    const [updated] = await db
      .update(aiModeHistory)
      .set(updates)
      .where(
        and(
          eq(aiModeHistory.id, id),
          eq(aiModeHistory.tenantId, tenantId)
        )
      )
      .returning();
    return updated || undefined;
  }

  async getRecentAiModeHistory(limit: number, tenantId: string): Promise<AiModeHistory[]> {
    return await db
      .select()
      .from(aiModeHistory)
      .where(eq(aiModeHistory.tenantId, tenantId))
      .orderBy(desc(aiModeHistory.createdAt))
      .limit(limit);
  }

  async getAiModeHistory(id: string, tenantId: string): Promise<AiModeHistory | undefined> {
    const [history] = await db
      .select()
      .from(aiModeHistory)
      .where(
        and(
          eq(aiModeHistory.id, id),
          eq(aiModeHistory.tenantId, tenantId)
        )
      );
    return history || undefined;
  }

  async getAiModeHistoryWithRecommendations(id: string, tenantId: string): Promise<{
    aiRun: AiModeHistory;
    recommendations: Recommendation[];
    savingsBreakdown: {
      totalSavings: number;
      averageSavings: number;
      savingsByType: Record<string, number>;
    };
    executionModeCounts: {
      autonomous: number;
      hitl: number;
      autonomousPercentage: number;
      hitlPercentage: number;
    };
  } | undefined> {
    // Get the AI mode history record
    const aiRun = await this.getAiModeHistory(id, tenantId);
    if (!aiRun) {
      return undefined;
    }

    // Get all recommendations linked to this AI run
    const recs = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.tenantId, tenantId),
          eq(recommendations.aiModeHistoryId, id)
        )
      )
      .orderBy(desc(recommendations.createdAt));

    // Calculate savings breakdown
    const totalSavings = recs.reduce((sum, rec) => sum + (rec.projectedMonthlySavings || 0), 0);
    const averageSavings = recs.length > 0 ? Math.round(totalSavings / recs.length) : 0;
    
    // Group savings by type
    const savingsByType: Record<string, number> = {};
    recs.forEach(rec => {
      const type = rec.type;
      savingsByType[type] = (savingsByType[type] || 0) + (rec.projectedMonthlySavings || 0);
    });

    // Count execution modes
    const autonomousCount = recs.filter(rec => rec.executionMode === 'autonomous').length;
    const hitlCount = recs.filter(rec => rec.executionMode === 'hitl').length;
    const total = recs.length;

    return {
      aiRun,
      recommendations: recs,
      savingsBreakdown: {
        totalSavings,
        averageSavings,
        savingsByType
      },
      executionModeCounts: {
        autonomous: autonomousCount,
        hitl: hitlCount,
        autonomousPercentage: total > 0 ? Math.round((autonomousCount / total) * 100) : 0,
        hitlPercentage: total > 0 ? Math.round((hitlCount / total) * 100) : 0
      }
    };
  }

  async getDashboardMetrics(tenantId: string): Promise<{
    monthlySpend: number;
    identifiedSavings: number;
    realizedSavings: number;
    resourcesAnalyzed: number;
    wastePercentage: number;
  }> {
    // Get current month cost
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const [monthlySpendResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${costReports.cost}), 0)::numeric`
      })
      .from(costReports)
      .where(
        and(
          eq(costReports.tenantId, tenantId),
          gte(costReports.reportDate, currentMonth)
        )
      );

    // Get total identified savings from active recommendations
    const [savingsResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${recommendations.projectedMonthlySavings}), 0)::numeric`
      })
      .from(recommendations)
      .where(
        and(
          eq(recommendations.tenantId, tenantId),
          eq(recommendations.status, 'pending')
        )
      );

    // Get total realized savings from approved recommendations
    const [realizedSavingsResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${recommendations.projectedMonthlySavings}), 0)::numeric`
      })
      .from(recommendations)
      .where(
        and(
          eq(recommendations.tenantId, tenantId),
          eq(recommendations.status, 'approved')
        )
      );

    // Get total resources analyzed
    const [resourcesResult] = await db
      .select({
        count: sql<number>`COUNT(*)`
      })
      .from(awsResources)
      .where(eq(awsResources.tenantId, tenantId));

    // Calculate waste percentage (simplified)
    const monthlySpend = Number(monthlySpendResult.total);
    const identifiedSavings = Number(savingsResult.total);
    const realizedSavings = Number(realizedSavingsResult.total);
    const wastePercentage = monthlySpend > 0 ? (identifiedSavings / monthlySpend) * 100 : 0;

    return {
      monthlySpend,
      identifiedSavings,
      realizedSavings,
      resourcesAnalyzed: Number(resourcesResult.count),
      wastePercentage: Math.round(wastePercentage)
    };
  }

  async getMetricsSummary(tenantId: string): Promise<{
    monthlySpend: number;
    ytdSpend: number;
    identifiedSavingsAwaitingApproval: number;
    realizedSavingsYTD: number;
    wastePercentOptimizedYTD: number;
    monthlySpendChange: number;
    ytdSpendChange: number;
  }> {
    const now = new Date();
    
    // Current month start
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Last month start and end
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    // Year-to-date start
    const ytdStart = new Date(now.getFullYear(), 0, 1);
    
    // Prior year YTD start and end
    const priorYtdStart = new Date(now.getFullYear() - 1, 0, 1);
    const priorYtdEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    // Check if cost reports exist (fallback to aws_resources if empty)
    const [costReportCountResult] = await db
      .select({
        count: sql<number>`COUNT(*)`
      })
      .from(costReports)
      .where(eq(costReports.tenantId, tenantId));
    
    const hasCostReports = Number(costReportCountResult.count) > 0;

    let monthlySpend = 0;
    let lastMonthSpend = 0;
    let ytdSpend = 0;
    let priorYtdSpend = 0;

    if (hasCostReports) {
      // Use cost reports data
      const [currentMonthResult] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${costReports.cost}), 0)::numeric`
        })
        .from(costReports)
        .where(
          and(
            eq(costReports.tenantId, tenantId),
            gte(costReports.reportDate, currentMonthStart)
          )
        );

      const [lastMonthResult] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${costReports.cost}), 0)::numeric`
        })
        .from(costReports)
        .where(
          and(
            eq(costReports.tenantId, tenantId),
            gte(costReports.reportDate, lastMonthStart),
            lte(costReports.reportDate, lastMonthEnd)
          )
        );

      const [ytdResult] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${costReports.cost}), 0)::numeric`
        })
        .from(costReports)
        .where(
          and(
            eq(costReports.tenantId, tenantId),
            gte(costReports.reportDate, ytdStart)
          )
        );

      const [priorYtdResult] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${costReports.cost}), 0)::numeric`
        })
        .from(costReports)
        .where(
          and(
            eq(costReports.tenantId, tenantId),
            gte(costReports.reportDate, priorYtdStart),
            lte(costReports.reportDate, priorYtdEnd)
          )
        );

      monthlySpend = Number(currentMonthResult.total);
      lastMonthSpend = Number(lastMonthResult.total);
      ytdSpend = Number(ytdResult.total);
      priorYtdSpend = Number(priorYtdResult.total);
    } else {
      // Fallback: Use aws_resources current monthly costs
      const [resourceCostResult] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${awsResources.monthlyCost}), 0)::numeric`
        })
        .from(awsResources)
        .where(eq(awsResources.tenantId, tenantId));

      monthlySpend = Number(resourceCostResult.total);
      // For demo mode: estimate last month as 95% of current (simulate slight increase)
      lastMonthSpend = monthlySpend * 0.95;
      // For demo mode: estimate YTD as current month × months elapsed
      const monthsElapsed = now.getMonth() + 1;
      ytdSpend = monthlySpend * monthsElapsed;
      // For demo mode: estimate prior year YTD as 90% of current YTD (simulate growth)
      priorYtdSpend = ytdSpend * 0.90;
    }

    // Get identified savings awaiting approval (pending + approved recommendations)
    // Use monthly savings for consistency with other monthly metrics
    const [pendingSavingsResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${recommendations.projectedMonthlySavings}), 0)::numeric`
      })
      .from(recommendations)
      .where(
        and(
          eq(recommendations.tenantId, tenantId),
          sql`${recommendations.status} IN ('pending', 'approved')`
        )
      );

    // Get realized savings YTD (from successful optimizations this year)
    // IMPORTANT: Only count LATEST optimization per resource to prevent accumulation
    const [realizedSavingsResult] = await db
      .select({
        total: sql<number>`
          COALESCE(
            SUM(latest_opt.actual_savings), 
            0
          )::numeric`
      })
      .from(
        sql`(
          SELECT DISTINCT ON (r.resource_id) 
            oh.actual_savings
          FROM ${optimizationHistory} oh
          INNER JOIN ${recommendations} r ON oh.recommendation_id = r.id
          WHERE oh.tenant_id = ${tenantId}
            AND oh.execution_date >= ${ytdStart}
            AND oh.status = 'success'
            AND r.tenant_id = ${tenantId}
          ORDER BY r.resource_id, oh.execution_date DESC
        ) AS latest_opt`
      );

    // Calculate values
    const identifiedSavingsAwaitingApproval = Number(pendingSavingsResult.total);
    const realizedSavingsYTD = Number(realizedSavingsResult.total);

    // Calculate percent changes
    const monthlySpendChange = lastMonthSpend > 0 
      ? ((monthlySpend - lastMonthSpend) / lastMonthSpend) * 100 
      : 0;
    
    const ytdSpendChange = priorYtdSpend > 0 
      ? ((ytdSpend - priorYtdSpend) / priorYtdSpend) * 100 
      : 0;

    // Calculate waste percent optimized YTD
    const wastePercentOptimizedYTD = ytdSpend > 0 
      ? (realizedSavingsYTD / ytdSpend) * 100 
      : 0;

    return {
      monthlySpend,
      ytdSpend,
      identifiedSavingsAwaitingApproval,
      realizedSavingsYTD,
      wastePercentOptimizedYTD: Math.round(wastePercentOptimizedYTD * 10) / 10,
      monthlySpendChange: Math.round(monthlySpendChange * 10) / 10,
      ytdSpendChange: Math.round(ytdSpendChange * 10) / 10
    };
  }

  async getOptimizationMix(tenantId: string): Promise<{
    autonomousCount: number;
    hitlCount: number;
    autonomousPercentage: number;
    hitlPercentage: number;
    totalRecommendations: number;
  }> {
    // Get count of autonomous recommendations
    const [autonomousResult] = await db
      .select({
        count: sql<number>`COUNT(*)`
      })
      .from(recommendations)
      .where(
        and(
          eq(recommendations.tenantId, tenantId),
          eq(recommendations.executionMode, 'autonomous')
        )
      );

    // Get count of HITL recommendations
    const [hitlResult] = await db
      .select({
        count: sql<number>`COUNT(*)`
      })
      .from(recommendations)
      .where(
        and(
          eq(recommendations.tenantId, tenantId),
          eq(recommendations.executionMode, 'hitl')
        )
      );

    const autonomousCount = Number(autonomousResult.count);
    const hitlCount = Number(hitlResult.count);
    const totalRecommendations = autonomousCount + hitlCount;

    const autonomousPercentage = totalRecommendations > 0 
      ? (autonomousCount / totalRecommendations) * 100 
      : 0;
    
    const hitlPercentage = totalRecommendations > 0 
      ? (hitlCount / totalRecommendations) * 100 
      : 0;

    return {
      autonomousCount,
      hitlCount,
      autonomousPercentage: Math.round(autonomousPercentage),
      hitlPercentage: Math.round(hitlPercentage),
      totalRecommendations
    };
  }
}

export const storage = new DatabaseStorage();
