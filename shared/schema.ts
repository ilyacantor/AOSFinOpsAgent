/**
 * MULTI-TENANT MIGRATION PLAN
 * 
 * This schema implements multi-tenant data isolation for the FinOps platform.
 * All user-scoped data is isolated by tenantId to ensure data security and privacy.
 * 
 * MIGRATION STRATEGY (Safe, Zero-Downtime):
 * 
 * Step 1: Add Nullable TenantId Columns (THIS COMMIT)
 *   - Add tenantId as VARCHAR (nullable) to all user-scoped tables
 *   - Add tenants table with: id, name, status, createdAt
 *   - Deploy schema changes: npm run db:push --force
 *   - Application continues to work without tenantId (nullable)
 * 
 * Step 2: Backfill Default Tenant (Post-Deployment)
 *   - Create default tenant: INSERT INTO tenants (id, name, status) VALUES ('default-tenant', 'Default Organization', 'active')
 *   - Backfill existing data with default tenantId:
 *     UPDATE users SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
 *     UPDATE aws_resources SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
 *     UPDATE cost_reports SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
 *     UPDATE recommendations SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
 *     UPDATE optimization_history SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
 *     UPDATE approval_requests SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
 *     UPDATE system_config SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
 *     UPDATE historical_cost_snapshots SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
 *     UPDATE ai_mode_history SET tenant_id = 'default-tenant' WHERE tenant_id IS NULL;
 * 
 * Step 3: Make TenantId NOT NULL (Future Commit)
 *   - Alter columns to make tenantId NOT NULL
 *   - Update insert schemas to require tenantId
 *   - Update all application code to enforce tenantId
 * 
 * Step 4: Add Performance Indexes (Future Commit)
 *   - CREATE INDEX idx_users_tenant_id ON users(tenant_id);
 *   - CREATE INDEX idx_aws_resources_tenant_id_created_at ON aws_resources(tenant_id, created_at);
 *   - CREATE INDEX idx_cost_reports_tenant_id_report_date ON cost_reports(tenant_id, report_date);
 *   - CREATE INDEX idx_recommendations_tenant_id_status ON recommendations(tenant_id, status);
 *   - CREATE INDEX idx_optimization_history_tenant_id_created_at ON optimization_history(tenant_id, created_at);
 *   - CREATE INDEX idx_approval_requests_tenant_id_status ON approval_requests(tenant_id, status);
 *   - CREATE INDEX idx_system_config_tenant_id ON system_config(tenant_id);
 *   - CREATE INDEX idx_historical_cost_snapshots_tenant_id_snapshot_date ON historical_cost_snapshots(tenant_id, snapshot_date);
 *   - CREATE INDEX idx_ai_mode_history_tenant_id_created_at ON ai_mode_history(tenant_id, created_at);
 * 
 * TECHNICAL NOTES:
 *   - TenantId uses VARCHAR to match existing UUID pattern
 *   - Foreign key constraints ensure referential integrity
 *   - Composite indexes optimize tenant-scoped queries
 *   - auditLogs table is NOT tenant-scoped (system-wide auditing)
 */

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, bigint, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("idx_users_tenant_id").on(table.tenantId),
}));

export const awsResources = pgTable("aws_resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  resourceId: text("resource_id").notNull().unique(),
  resourceType: text("resource_type").notNull(), // EC2, RDS, Redshift, S3, etc.
  region: text("region").notNull(),
  currentConfig: jsonb("current_config").notNull(),
  utilizationMetrics: jsonb("utilization_metrics"),
  monthlyCost: bigint("monthly_cost", { mode: "number" }), // Direct dollar amounts (enterprise scale)
  lastAnalyzed: timestamp("last_analyzed").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdCreatedAtIdx: index("idx_aws_resources_tenant_id_created_at").on(table.tenantId, table.createdAt),
}));

export const costReports = pgTable("cost_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  reportDate: timestamp("report_date").notNull(),
  serviceCategory: text("service_category").notNull(),
  resourceId: text("resource_id"),
  cost: bigint("cost", { mode: "number" }).notNull(), // Direct dollar amounts (enterprise scale)
  usage: decimal("usage", { precision: 12, scale: 6 }),
  usageType: text("usage_type"),
  region: text("region"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdReportDateIdx: index("idx_cost_reports_tenant_id_report_date").on(table.tenantId, table.reportDate),
}));

export const recommendations = pgTable("recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  aiModeHistoryId: varchar("ai_mode_history_id"), // Links to the AI run that generated this recommendation
  resourceId: text("resource_id").notNull(),
  type: text("type").notNull(), // resize, terminate, storage-class, reserved-instance
  priority: text("priority").notNull(), // critical, high, medium, low
  title: text("title").notNull(),
  description: text("description").notNull(),
  currentConfig: jsonb("current_config").notNull(),
  recommendedConfig: jsonb("recommended_config").notNull(),
  projectedMonthlySavings: bigint("projected_monthly_savings", { mode: "number" }).notNull(), // Direct dollar amounts (enterprise scale)
  calculationMetadata: jsonb("calculation_metadata"), // Stores resource cost, savings %, methodology for transparency
  riskLevel: integer("risk_level").default(50), // percentage value 1-100, defaults to 50 (medium risk)
  executionMode: text("execution_mode").notNull(), // autonomous, hitl
  status: text("status").notNull().default("pending"), // pending, approved, rejected, executed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdStatusIdx: index("idx_recommendations_tenant_id_status").on(table.tenantId, table.status),
  tenantIdAiHistoryIdx: index("idx_recommendations_tenant_id_ai_history").on(table.tenantId, table.aiModeHistoryId),
}));

export const optimizationHistory = pgTable("optimization_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  recommendationId: varchar("recommendation_id").notNull(),
  executedBy: varchar("executed_by").notNull(),
  executionDate: timestamp("execution_date").notNull(),
  beforeConfig: jsonb("before_config").notNull(),
  afterConfig: jsonb("after_config").notNull(),
  actualSavings: bigint("actual_savings", { mode: "number" }), // Direct dollar amounts (enterprise scale)
  status: text("status").notNull(), // success, failed, in-progress
  errorMessage: text("error_message"),
  slackMessageId: text("slack_message_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdCreatedAtIdx: index("idx_optimization_history_tenant_id_created_at").on(table.tenantId, table.createdAt),
}));

export const approvalRequests = pgTable("approval_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  recommendationId: varchar("recommendation_id").notNull(),
  requestedBy: varchar("requested_by").notNull(),
  approverRole: text("approver_role").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  approvedBy: varchar("approved_by"),
  approvalDate: timestamp("approval_date"),
  comments: text("comments"),
  slackThreadId: text("slack_thread_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdStatusIdx: index("idx_approval_requests_tenant_id_status").on(table.tenantId, table.status),
}));

export const systemConfig = pgTable("system_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedBy: varchar("updated_by").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("idx_system_config_tenant_id").on(table.tenantId),
}));

export const historicalCostSnapshots = pgTable("historical_cost_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  snapshotDate: timestamp("snapshot_date").notNull(),
  totalMonthlyCost: bigint("total_monthly_cost", { mode: "number" }).notNull(),
  computeCost: bigint("compute_cost", { mode: "number" }).notNull(),
  storageCost: bigint("storage_cost", { mode: "number" }).notNull(),
  databaseCost: bigint("database_cost", { mode: "number" }).notNull(),
  networkCost: bigint("network_cost", { mode: "number" }).notNull(),
  otherCost: bigint("other_cost", { mode: "number" }).notNull(),
  resourceCount: integer("resource_count").notNull(),
  avgUtilization: decimal("avg_utilization", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdSnapshotDateIdx: index("idx_historical_cost_snapshots_tenant_id_snapshot_date").on(table.tenantId, table.snapshotDate),
}));

export const aiModeHistory = pgTable("ai_mode_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  status: text("status").notNull(), // running, success, failed
  summary: text("summary"),
  recommendationsGenerated: integer("recommendations_generated").default(0),
  totalSavingsIdentified: bigint("total_savings_identified", { mode: "number" }).default(0), // Multiplied by 1000, supports 10× scale
  triggeredBy: text("triggered_by").default("user"), // user, system
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdCreatedAtIdx: index("idx_ai_mode_history_tenant_id_created_at").on(table.tenantId, table.createdAt),
}));

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  requestId: varchar("request_id").notNull(),
  userId: varchar("user_id"),
  action: text("action").notNull(), // CREATE, UPDATE, DELETE, APPROVE, REJECT, EXECUTE
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  changes: jsonb("changes"),
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  awsResources: many(awsResources),
  costReports: many(costReports),
  recommendations: many(recommendations),
  optimizationHistory: many(optimizationHistory),
  approvalRequests: many(approvalRequests),
  systemConfig: many(systemConfig),
  historicalCostSnapshots: many(historicalCostSnapshots),
  aiModeHistory: many(aiModeHistory),
}));

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
}));

export const awsResourcesRelations = relations(awsResources, ({ one }) => ({
  tenant: one(tenants, {
    fields: [awsResources.tenantId],
    references: [tenants.id],
  }),
}));

export const costReportsRelations = relations(costReports, ({ one }) => ({
  tenant: one(tenants, {
    fields: [costReports.tenantId],
    references: [tenants.id],
  }),
}));

export const recommendationsRelations = relations(recommendations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [recommendations.tenantId],
    references: [tenants.id],
  }),
  resource: one(awsResources, {
    fields: [recommendations.resourceId],
    references: [awsResources.resourceId],
  }),
}));

export const optimizationHistoryRelations = relations(optimizationHistory, ({ one }) => ({
  tenant: one(tenants, {
    fields: [optimizationHistory.tenantId],
    references: [tenants.id],
  }),
  recommendation: one(recommendations, {
    fields: [optimizationHistory.recommendationId],
    references: [recommendations.id],
  }),
  executedByUser: one(users, {
    fields: [optimizationHistory.executedBy],
    references: [users.id],
  }),
}));

export const approvalRequestsRelations = relations(approvalRequests, ({ one }) => ({
  tenant: one(tenants, {
    fields: [approvalRequests.tenantId],
    references: [tenants.id],
  }),
  recommendation: one(recommendations, {
    fields: [approvalRequests.recommendationId],
    references: [recommendations.id],
  }),
  requestedByUser: one(users, {
    fields: [approvalRequests.requestedBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [approvalRequests.approvedBy],
    references: [users.id],
  }),
}));

export const systemConfigRelations = relations(systemConfig, ({ one }) => ({
  tenant: one(tenants, {
    fields: [systemConfig.tenantId],
    references: [tenants.id],
  }),
}));

export const historicalCostSnapshotsRelations = relations(historicalCostSnapshots, ({ one }) => ({
  tenant: one(tenants, {
    fields: [historicalCostSnapshots.tenantId],
    references: [tenants.id],
  }),
}));

export const aiModeHistoryRelations = relations(aiModeHistory, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiModeHistory.tenantId],
    references: [tenants.id],
  }),
}));

// Insert schemas
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true }).extend({
  tenantId: z.string().optional().default('default-tenant')
});
export const insertAwsResourceSchema = createInsertSchema(awsResources).omit({ id: true, createdAt: true });
export const insertCostReportSchema = createInsertSchema(costReports).omit({ id: true, createdAt: true });
export const insertRecommendationSchema = createInsertSchema(recommendations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOptimizationHistorySchema = createInsertSchema(optimizationHistory).omit({ id: true, createdAt: true });
export const insertApprovalRequestSchema = createInsertSchema(approvalRequests).omit({ id: true, createdAt: true, approvalDate: true }).extend({
  tenantId: z.string().optional()
});
export const insertSystemConfigSchema = createInsertSchema(systemConfig).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHistoricalCostSnapshotSchema = createInsertSchema(historicalCostSnapshots).omit({ id: true, createdAt: true });
export const insertAiModeHistorySchema = createInsertSchema(aiModeHistory).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true, timestamp: true });

// Types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type AwsResource = typeof awsResources.$inferSelect;
export type InsertAwsResource = z.infer<typeof insertAwsResourceSchema>;
export type CostReport = typeof costReports.$inferSelect;
export type InsertCostReport = z.infer<typeof insertCostReportSchema>;
export type Recommendation = typeof recommendations.$inferSelect;
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
export type OptimizationHistory = typeof optimizationHistory.$inferSelect;
export type InsertOptimizationHistory = z.infer<typeof insertOptimizationHistorySchema>;
export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type InsertApprovalRequest = z.infer<typeof insertApprovalRequestSchema>;
export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;
export type HistoricalCostSnapshot = typeof historicalCostSnapshots.$inferSelect;
export type InsertHistoricalCostSnapshot = z.infer<typeof insertHistoricalCostSnapshotSchema>;
export type AiModeHistory = typeof aiModeHistory.$inferSelect;
export type InsertAiModeHistory = z.infer<typeof insertAiModeHistorySchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
