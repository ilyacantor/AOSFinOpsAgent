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
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser, tenantId: string): Promise<User>;

  // AWS Resources
  createAwsResource(resource: InsertAwsResource, tenantId: string): Promise<AwsResource>;
  getAwsResource(resourceId: string): Promise<AwsResource | undefined>;
  updateAwsResource(resourceId: string, updates: Partial<InsertAwsResource>): Promise<AwsResource | undefined>;
  getAllAwsResources(): Promise<AwsResource[]>;

  // Cost Reports
  createCostReport(report: InsertCostReport, tenantId: string): Promise<CostReport>;
  getCostReports(dateFrom?: Date, dateTo?: Date): Promise<CostReport[]>;
  getMonthlyCostSummary(): Promise<{ month: string; totalCost: number; }[]>;

  // Recommendations
  createRecommendation(recommendation: InsertRecommendation, tenantId: string): Promise<Recommendation>;
  getRecommendations(status?: string): Promise<Recommendation[]>;
  getRecentRecommendations(limit: number): Promise<Recommendation[]>; // Optimized: fetch limited records
  getRecommendation(id: string): Promise<Recommendation | undefined>;
  updateRecommendationStatus(id: string, status: string): Promise<Recommendation | undefined>;
  
  // Optimization History
  createOptimizationHistory(history: InsertOptimizationHistory, tenantId: string): Promise<OptimizationHistory>;
  getOptimizationHistory(limit?: number): Promise<OptimizationHistory[]>;
  getRecentOptimizationHistory(limit: number): Promise<OptimizationHistory[]>; // Optimized: fetch limited records

  // Approval Requests
  createApprovalRequest(request: InsertApprovalRequest, tenantId: string): Promise<ApprovalRequest>;
  getApprovalRequests(status?: string): Promise<ApprovalRequest[]>;
  updateApprovalRequest(id: string, updates: Partial<InsertApprovalRequest>): Promise<ApprovalRequest | undefined>;

  // System Configuration
  getSystemConfig(key: string): Promise<SystemConfig | undefined>;
  setSystemConfig(config: InsertSystemConfig, tenantId: string): Promise<SystemConfig>;
  updateSystemConfig(key: string, value: string, updatedBy: string): Promise<SystemConfig | undefined>;
  getAllSystemConfig(): Promise<SystemConfig[]>;

  // AI Mode History
  createAiModeHistory(history: InsertAiModeHistory, tenantId: string): Promise<AiModeHistory>;
  updateAiModeHistory(id: string, updates: Partial<InsertAiModeHistory>): Promise<AiModeHistory | undefined>;
  getRecentAiModeHistory(limit: number): Promise<AiModeHistory[]>;
  getAiModeHistory(id: string): Promise<AiModeHistory | undefined>;

  // Dashboard metrics
  getDashboardMetrics(): Promise<{
    monthlySpend: number;
    identifiedSavings: number;
    resourcesAnalyzed: number;
    wastePercentage: number;
  }>;

  // Metrics summary for autopilot
  getMetricsSummary(): Promise<{
    monthlySpend: number;
    ytdSpend: number;
    identifiedSavingsAwaitingApproval: number;
    realizedSavingsYTD: number;
    wastePercentOptimizedYTD: number;
    monthlySpendChange: number;
    ytdSpendChange: number;
  }>;

  // Optimization mix (Autonomous vs HITL distribution)
  getOptimizationMix(): Promise<{
    autonomousCount: number;
    hitlCount: number;
    autonomousPercentage: number;
    hitlPercentage: number;
    totalRecommendations: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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

  async getAwsResource(resourceId: string): Promise<AwsResource | undefined> {
    const [resource] = await db
      .select()
      .from(awsResources)
      .where(eq(awsResources.resourceId, resourceId));
    return resource || undefined;
  }

  async updateAwsResource(resourceId: string, updates: Partial<InsertAwsResource>): Promise<AwsResource | undefined> {
    const [updated] = await db
      .update(awsResources)
      .set({ ...updates, lastAnalyzed: new Date() })
      .where(eq(awsResources.resourceId, resourceId))
      .returning();
    return updated || undefined;
  }

  async getAllAwsResources(): Promise<AwsResource[]> {
    return await db.select().from(awsResources);
  }

  async createCostReport(report: InsertCostReport, tenantId: string): Promise<CostReport> {
    const [created] = await db
      .insert(costReports)
      .values({ ...report, tenantId })
      .returning();
    return created;
  }

  async getCostReports(dateFrom?: Date, dateTo?: Date): Promise<CostReport[]> {
    if (dateFrom && dateTo) {
      return await db
        .select()
        .from(costReports)
        .where(
          and(
            gte(costReports.reportDate, dateFrom),
            lte(costReports.reportDate, dateTo)
          )
        )
        .orderBy(desc(costReports.reportDate));
    }
    
    return await db
      .select()
      .from(costReports)
      .orderBy(desc(costReports.reportDate));
  }

  async getMonthlyCostSummary(): Promise<{ month: string; totalCost: number; }[]> {
    const result = await db
      .select({
        month: sql<string>`TO_CHAR(${costReports.reportDate}, 'YYYY-MM')`,
        totalCost: sql<number>`SUM(${costReports.cost})::numeric`
      })
      .from(costReports)
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

  async getRecommendations(status?: string): Promise<Recommendation[]> {
    if (status) {
      return await db
        .select()
        .from(recommendations)
        .where(eq(recommendations.status, status))
        .orderBy(desc(recommendations.createdAt));
    }
    
    return await db
      .select()
      .from(recommendations)
      .orderBy(desc(recommendations.createdAt));
  }

  async getRecommendation(id: string): Promise<Recommendation | undefined> {
    const [recommendation] = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, id));
    return recommendation || undefined;
  }

  async updateRecommendationStatus(id: string, status: string): Promise<Recommendation | undefined> {
    const [updated] = await db
      .update(recommendations)
      .set({ status, updatedAt: new Date() })
      .where(eq(recommendations.id, id))
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

  async getOptimizationHistory(limit = 50): Promise<OptimizationHistory[]> {
    return await db
      .select()
      .from(optimizationHistory)
      .orderBy(desc(optimizationHistory.createdAt))
      .limit(limit);
  }

  // Optimized: Get recent recommendations with database-level limit
  async getRecentRecommendations(limit: number): Promise<Recommendation[]> {
    return await db
      .select()
      .from(recommendations)
      .orderBy(desc(recommendations.createdAt))
      .limit(limit);
  }

  // Optimized: Get recent optimization history with database-level limit
  async getRecentOptimizationHistory(limit: number): Promise<OptimizationHistory[]> {
    return await db
      .select()
      .from(optimizationHistory)
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

  async getApprovalRequests(status?: string): Promise<ApprovalRequest[]> {
    if (status) {
      return await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.status, status))
        .orderBy(desc(approvalRequests.createdAt));
    }
    
    return await db
      .select()
      .from(approvalRequests)
      .orderBy(desc(approvalRequests.createdAt));
  }

  async updateApprovalRequest(id: string, updates: Partial<InsertApprovalRequest>): Promise<ApprovalRequest | undefined> {
    const [updated] = await db
      .update(approvalRequests)
      .set(updates)
      .where(eq(approvalRequests.id, id))
      .returning();
    return updated || undefined;
  }

  async getSystemConfig(key: string): Promise<SystemConfig | undefined> {
    const [config] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, key));
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

  async updateSystemConfig(key: string, value: string, updatedBy: string): Promise<SystemConfig | undefined> {
    const [updated] = await db
      .update(systemConfig)
      .set({ value, updatedBy, updatedAt: new Date() })
      .where(eq(systemConfig.key, key))
      .returning();
    return updated || undefined;
  }

  async getAllSystemConfig(): Promise<SystemConfig[]> {
    return await db
      .select()
      .from(systemConfig)
      .orderBy(systemConfig.key);
  }

  async createAiModeHistory(history: InsertAiModeHistory, tenantId: string): Promise<AiModeHistory> {
    const [created] = await db
      .insert(aiModeHistory)
      .values({ ...history, tenantId })
      .returning();
    return created;
  }

  async updateAiModeHistory(id: string, updates: Partial<InsertAiModeHistory>): Promise<AiModeHistory | undefined> {
    const [updated] = await db
      .update(aiModeHistory)
      .set(updates)
      .where(eq(aiModeHistory.id, id))
      .returning();
    return updated || undefined;
  }

  async getRecentAiModeHistory(limit: number): Promise<AiModeHistory[]> {
    return await db
      .select()
      .from(aiModeHistory)
      .orderBy(desc(aiModeHistory.createdAt))
      .limit(limit);
  }

  async getAiModeHistory(id: string): Promise<AiModeHistory | undefined> {
    const [history] = await db
      .select()
      .from(aiModeHistory)
      .where(eq(aiModeHistory.id, id));
    return history || undefined;
  }

  async getDashboardMetrics(): Promise<{
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
      .where(gte(costReports.reportDate, currentMonth));

    // Get total identified savings from active recommendations
    const [savingsResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${recommendations.projectedAnnualSavings}), 0)::numeric`
      })
      .from(recommendations)
      .where(eq(recommendations.status, 'pending'));

    // Get total realized savings from approved recommendations
    const [realizedSavingsResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${recommendations.projectedAnnualSavings}), 0)::numeric`
      })
      .from(recommendations)
      .where(eq(recommendations.status, 'approved'));

    // Get total resources analyzed
    const [resourcesResult] = await db
      .select({
        count: sql<number>`COUNT(*)`
      })
      .from(awsResources);

    // Calculate waste percentage (simplified)
    const monthlySpend = Number(monthlySpendResult.total);
    const identifiedSavings = Number(savingsResult.total);
    const realizedSavings = Number(realizedSavingsResult.total);
    const wastePercentage = monthlySpend > 0 ? (identifiedSavings / 12 / monthlySpend) * 100 : 0;

    return {
      monthlySpend,
      identifiedSavings,
      realizedSavings,
      resourcesAnalyzed: Number(resourcesResult.count),
      wastePercentage: Math.round(wastePercentage)
    };
  }

  async getMetricsSummary(): Promise<{
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
      .from(costReports);
    
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
        .where(gte(costReports.reportDate, currentMonthStart));

      const [lastMonthResult] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${costReports.cost}), 0)::numeric`
        })
        .from(costReports)
        .where(
          and(
            gte(costReports.reportDate, lastMonthStart),
            lte(costReports.reportDate, lastMonthEnd)
          )
        );

      const [ytdResult] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${costReports.cost}), 0)::numeric`
        })
        .from(costReports)
        .where(gte(costReports.reportDate, ytdStart));

      const [priorYtdResult] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${costReports.cost}), 0)::numeric`
        })
        .from(costReports)
        .where(
          and(
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
        .from(awsResources);

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
    const [pendingSavingsResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${recommendations.projectedAnnualSavings}), 0)::numeric`
      })
      .from(recommendations)
      .where(
        sql`${recommendations.status} IN ('pending', 'approved')`
      );

    // Get realized savings YTD (from successful optimizations this year)
    const [realizedSavingsResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${optimizationHistory.actualSavings}), 0)::numeric`
      })
      .from(optimizationHistory)
      .where(
        and(
          gte(optimizationHistory.executionDate, ytdStart),
          eq(optimizationHistory.status, 'success')
        )
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

  async getOptimizationMix(): Promise<{
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
      .where(eq(recommendations.executionMode, 'autonomous'));

    // Get count of HITL recommendations
    const [hitlResult] = await db
      .select({
        count: sql<number>`COUNT(*)`
      })
      .from(recommendations)
      .where(eq(recommendations.executionMode, 'hitl'));

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
