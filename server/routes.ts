import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage, validatePassword, pineconeCircuitBreaker } from "./storage";
import { awsService } from "./services/aws";
import { sendOptimizationComplete } from "./services/slack";
import { insertRecommendationSchema, insertApprovalRequestSchema, insertUserSchema } from "@shared/schema";
import { authenticateToken, requireRole, generateToken, enforceSessionTimeout } from "./middleware/auth";
import { auditMiddleware, logAudit, auditActions, auditResourceTypes } from "./middleware/audit";
import { handleApprovalTransaction, handleOptimizationExecutionTransaction, withTransaction } from './lib/transaction';
// Import scheduler service to ensure it's instantiated and configuration is initialized
import { schedulerService } from "./services/scheduler.js";
import { db } from "./db";
import jwt from 'jsonwebtoken';
import { URL } from 'url';
import type { IncomingMessage } from 'http';

// Extended WebSocket interface with authentication metadata
interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  username?: string;
  tenantId?: string;
  connectedAt?: Date;
  isAlive?: boolean;
  lastActivity?: Date;
  ipAddress?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Middleware chains for authenticated routes
  // enforceSessionTimeout runs AFTER authenticateToken to ensure req.user is populated
  const authenticated = [authenticateToken, enforceSessionTimeout];
  const authenticatedAdmin = [authenticateToken, enforceSessionTimeout, requireRole('admin')];
  const authenticatedUser = [authenticateToken, enforceSessionTimeout, requireRole('user')];

  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store connected clients with authentication
  const clients = new Set<AuthenticatedWebSocket>();

  // Connection rate limiting: Track connections per IP
  const connectionsByIP = new Map<string, number>();
  const MAX_CONNECTIONS_PER_IP = 10;
  const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  const HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds

  const JWT_SECRET = process.env.JWT_SECRET || '';

  // WebSocket connection handler with authentication
  wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
    const clientIP = req.socket.remoteAddress || 'unknown';
    ws.ipAddress = clientIP;

    // Rate limiting: Check connections per IP
    const currentConnections = connectionsByIP.get(clientIP) || 0;
    if (currentConnections >= MAX_CONNECTIONS_PER_IP) {
      console.error(`[WebSocket Auth] Rate limit exceeded for IP: ${clientIP}`);
      ws.close(1008, 'Too many connections from this IP');
      return;
    }

    // Origin validation to prevent CSRF
    const origin = req.headers.origin;
    const allowedOrigins = [
      process.env.REPLIT_DOMAINS?.split(',') || [],
      'http://localhost:5000',
      'https://localhost:5000'
    ].flat();
    
    if (origin && allowedOrigins.length > 0 && !allowedOrigins.some(allowed => origin.includes(allowed))) {
      console.error(`[WebSocket Auth] Invalid origin: ${origin}`);
      ws.close(1008, 'Invalid origin');
      return;
    }

    // Parse JWT token from query parameters
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      console.error('[WebSocket Auth] No token provided');
      ws.close(1008, 'Authentication required');
      return;
    }

    // Verify JWT token
    try {
      const payload = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        username: string;
        role: string;
        tenantId?: string;
        iat?: number;
        exp?: number;
      };

      // Validate session age - CRITICAL SECURITY CHECK
      const now = Math.floor(Date.now() / 1000);
      const MAX_SESSION_AGE = 2 * 60 * 60; // 2 hours (matches REST enforceSessionTimeout)

      // Check 1: Token expiration (hard expiration)
      if (payload.exp && payload.exp <= now) {
        console.error('[WebSocket Auth] Token expired', {
          username: payload.username,
          exp: payload.exp,
          now: now,
          expired: now - payload.exp
        });
        ws.close(1008, 'Token expired');
        return;
      }

      // Check 2: Session age (absolute session duration from issuance)
      if (payload.iat) {
        const sessionAge = now - payload.iat;
        if (sessionAge > MAX_SESSION_AGE) {
          console.error('[WebSocket Auth] Session too old - please login again', {
            username: payload.username,
            sessionAge: sessionAge,
            maxAge: MAX_SESSION_AGE,
            overAge: sessionAge - MAX_SESSION_AGE
          });
          ws.close(1008, 'Session too old - please login again');
          return;
        }
      }

      // Store authenticated user info in WebSocket object
      ws.userId = payload.userId;
      ws.username = payload.username;
      ws.tenantId = payload.tenantId || 'default-tenant';
      ws.connectedAt = new Date();
      ws.isAlive = true;
      ws.lastActivity = new Date();

      console.log(`[WebSocket Auth] User authenticated: ${payload.username} (tenant: ${ws.tenantId})`);

      // Add to clients and update connection count
      clients.add(ws);
      connectionsByIP.set(clientIP, currentConnections + 1);

      // Send connection success message
      ws.send(JSON.stringify({
        type: 'connection_established',
        data: {
          userId: ws.userId,
          username: ws.username,
          tenantId: ws.tenantId,
          connectedAt: ws.connectedAt
        }
      }));

    } catch (error) {
      console.error('[WebSocket Auth] Invalid token:', error instanceof Error ? error.message : error);
      ws.close(1008, 'Invalid or expired token');
      return;
    }

    // Handle incoming messages with tenant validation
    ws.on('message', (message: string) => {
      try {
        ws.lastActivity = new Date();
        const data = JSON.parse(message.toString());
        
        // Validate that message includes tenantId matching the connection
        if (data.tenantId && data.tenantId !== ws.tenantId) {
          console.error(`[WebSocket Security] Tenant mismatch for user ${ws.username}: expected ${ws.tenantId}, got ${data.tenantId}`);
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Tenant validation failed' }
          }));
          return;
        }

        // Process message (can be extended for different message types)
        console.log(`[WebSocket] Message from ${ws.username} (tenant: ${ws.tenantId}):`, data.type);
      } catch (error) {
        console.error('[WebSocket] Error processing message:', error);
      }
    });

    // Heartbeat: Pong response
    ws.on('pong', () => {
      ws.isAlive = true;
      ws.lastActivity = new Date();
    });

    // Connection close handler
    ws.on('close', () => {
      console.log(`[WebSocket] Connection closed for user ${ws.username} (tenant: ${ws.tenantId})`);
      clients.delete(ws);
      
      // Decrement connection count for this IP
      const count = connectionsByIP.get(clientIP) || 0;
      if (count <= 1) {
        connectionsByIP.delete(clientIP);
      } else {
        connectionsByIP.set(clientIP, count - 1);
      }
    });

    ws.on('error', (error) => {
      console.error(`[WebSocket] Error for user ${ws.username}:`, error);
    });
  });

  // Heartbeat mechanism: Ping all clients every 30 seconds
  const heartbeatInterval = setInterval(() => {
    clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log(`[WebSocket Heartbeat] Terminating dead connection for user ${ws.username}`);
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);

  // Idle timeout: Disconnect clients idle for more than 5 minutes
  const idleCheckInterval = setInterval(() => {
    const now = Date.now();
    clients.forEach((ws) => {
      if (ws.lastActivity && (now - ws.lastActivity.getTime()) > IDLE_TIMEOUT) {
        console.log(`[WebSocket Idle] Disconnecting idle user ${ws.username} (idle for ${Math.floor((now - ws.lastActivity.getTime()) / 1000)}s)`);
        ws.close(1000, 'Connection idle timeout');
      }
    });
  }, 60000); // Check every minute

  // Cleanup on server shutdown
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
    clearInterval(idleCheckInterval);
  });

  // Broadcast to all connected clients (legacy - use broadcastToTenant instead)
  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Tenant-scoped broadcast: Only send to clients in the same tenant
  const broadcastToTenant = (tenantId: string, data: any) => {
    const message = JSON.stringify({
      ...data,
      tenantId // Always include tenantId in broadcast messages
    });
    
    let recipientCount = 0;
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.tenantId === tenantId) {
        client.send(message);
        recipientCount++;
      }
    });
    
    console.log(`[WebSocket Broadcast] Sent ${data.type} to ${recipientCount} clients in tenant ${tenantId}`);
  };

  // Prod Mode auto-revert state
  let prodModeTimeout: NodeJS.Timeout | null = null;
  let prodModeActivationTime: number | null = null;

  // ===== Health Check Endpoints =====
  // Basic health check - no authentication required
  app.get("/api/health", (req, res) => {
    const uptime = process.uptime();
    res.status(200).json({
      status: "healthy",
      uptime: Math.floor(uptime),
      timestamp: new Date().toISOString()
    });
  });

  // Detailed health check with component status
  app.get("/api/health/detailed", async (req, res) => {
    const healthChecks: {
      database: { status: string; responseTime?: number; error?: string };
      pinecone: { status: string; circuitState?: string; responseTime?: number };
      platform: { status: string; responseTime?: number; error?: string };
    } = {
      database: { status: "unknown" },
      pinecone: { status: "unknown" },
      platform: { status: "unknown" }
    };

    let overallHealthy = true;

    // Check database connection with timeout
    try {
      const dbStart = Date.now();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Database check timeout")), 5000)
      );
      
      const checkPromise = db.execute('SELECT 1 as health_check');
      
      await Promise.race([checkPromise, timeoutPromise]);
      
      healthChecks.database = {
        status: "healthy",
        responseTime: Date.now() - dbStart
      };
    } catch (error) {
      overallHealthy = false;
      healthChecks.database = {
        status: "unhealthy",
        error: error instanceof Error ? error.message : String(error)
      };
    }

    // Check Pinecone circuit breaker state
    try {
      const pineconeStats = pineconeCircuitBreaker.getStats();
      const circuitState = pineconeStats.state;
      
      // Circuit is healthy if CLOSED or HALF_OPEN
      const isHealthy = circuitState === 'CLOSED' || circuitState === 'HALF_OPEN';
      
      healthChecks.pinecone = {
        status: isHealthy ? "healthy" : "degraded",
        circuitState: circuitState,
        responseTime: 0 // Circuit breaker check is instant
      };
      
      // If circuit is OPEN, mark as degraded but not unhealthy (graceful degradation)
      if (circuitState === 'OPEN') {
        // Don't fail overall health, just mark as degraded
        console.warn('[Health Check] Pinecone circuit breaker is OPEN - service degraded');
      }
    } catch (error) {
      healthChecks.pinecone = {
        status: "unhealthy",
        circuitState: "ERROR"
      };
      overallHealthy = false;
    }

    // Check Platform (AOS) connection - optional, don't fail if not configured
    try {
      const platformUrl = process.env.VITE_AOS_BASE_URL || process.env.VITE_PLATFORM_URL;
      
      if (platformUrl) {
        const platformStart = Date.now();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Platform check timeout")), 5000)
        );
        
        const checkPromise = fetch(`${platformUrl}/health`, { 
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        }).then(res => {
          if (!res.ok) throw new Error(`Platform returned ${res.status}`);
          return res;
        });
        
        await Promise.race([checkPromise, timeoutPromise]);
        
        healthChecks.platform = {
          status: "healthy",
          responseTime: Date.now() - platformStart
        };
      } else {
        healthChecks.platform = {
          status: "not_configured",
          responseTime: 0
        };
      }
    } catch (error) {
      // Platform is optional, don't fail overall health
      healthChecks.platform = {
        status: "unavailable",
        error: error instanceof Error ? error.message : String(error)
      };
      console.warn('[Health Check] Platform (AOS) unavailable:', error instanceof Error ? error.message : error);
    }

    // Return appropriate status code
    const statusCode = overallHealthy ? 200 : 503;
    
    res.status(statusCode).json({
      status: overallHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      components: healthChecks
    });
  });

  // Dashboard metrics endpoint
  app.get("/api/dashboard/metrics", ...authenticated, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Invalid authentication: missing tenant context' });
      }

      const metrics = await storage.getDashboardMetrics(tenantId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  // Cost trends endpoint
  app.get("/api/dashboard/cost-trends", ...authenticated, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Invalid authentication: missing tenant context' });
      }

      const trends = await storage.getMonthlyCostSummary(tenantId);
      res.json(trends);
    } catch (error) {
      console.error("Error fetching cost trends:", error);
      res.status(500).json({ error: "Failed to fetch cost trends" });
    }
  });

  // Metrics summary endpoint for autopilot
  app.get("/api/metrics/summary", ...authenticated, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Invalid authentication: missing tenant context' });
      }

      const summary = await storage.getMetricsSummary(tenantId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching metrics summary:", error);
      res.status(500).json({ error: "Failed to fetch metrics summary" });
    }
  });

  // Optimization mix endpoint (Autonomous vs HITL distribution)
  app.get("/api/metrics/optimization-mix", ...authenticated, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Invalid authentication: missing tenant context' });
      }

      const mix = await storage.getOptimizationMix(tenantId);
      res.json(mix);
    } catch (error) {
      console.error("Error fetching optimization mix:", error);
      res.status(500).json({ error: "Failed to fetch optimization mix" });
    }
  });

  // Prod Mode toggle with auto-revert
  app.post("/api/mode/prod", ...authenticatedAdmin, async (req, res) => {
    try {
      const { enabled } = req.body;
      const { configService } = await import('./services/config.js');

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "Enabled must be a boolean value" });
      }

      // Clear existing timeout if any
      if (prodModeTimeout) {
        clearTimeout(prodModeTimeout);
        prodModeTimeout = null;
        prodModeActivationTime = null;
      }

      if (enabled) {
        // Turn on prod mode
        await configService.setProdMode(true, 'user');
        prodModeActivationTime = Date.now();

        // Schedule auto-revert after 5 minutes
        prodModeTimeout = setTimeout(async () => {
          console.log('Auto-reverting Prod Mode to OFF after 5 minutes');
          await configService.setProdMode(false, 'system-auto-revert');
          prodModeTimeout = null;
          prodModeActivationTime = null;
        }, 5 * 60 * 1000);

        res.json({ 
          prodMode: true, 
          timeRemaining: 300 
        });
      } else {
        // Turn off prod mode immediately
        await configService.setProdMode(false, 'user');
        res.json({ 
          prodMode: false, 
          timeRemaining: 0 
        });
      }
    } catch (error) {
      console.error("Error toggling prod mode:", error);
      res.status(500).json({ error: "Failed to toggle prod mode" });
    }
  });

  // Authentication endpoints
  app.post("/api/register", auditMiddleware(auditActions.REGISTER, auditResourceTypes.USER, req => req.body?.username), async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Extract tenantId from validated data or default to 'default-tenant'
      const tenantId = validatedData.tenantId || 'default-tenant';
      const user = await storage.createUser(validatedData, tenantId);
      
      // Generate JWT token with tenantId
      const token = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId
      });

      res.json({ 
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          tenantId: user.tenantId
        }
      });
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(400).json({ error: "Failed to register user" });
    }
  });

  app.post("/api/login", auditMiddleware(auditActions.LOGIN, auditResourceTypes.SESSION, req => req.body?.username), async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValid = await validatePassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Generate JWT token with tenantId
      const token = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId || 'default-tenant'
      });

      res.json({ 
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          tenantId: user.tenantId
        }
      });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  app.post("/api/logout", ...authenticated, auditMiddleware(auditActions.LOGOUT, auditResourceTypes.SESSION), async (req, res) => {
    // JWT logout is handled client-side by removing the token
    // This endpoint exists for consistency and can be used for logging/analytics
    res.json({ message: "Logged out successfully" });
  });

  app.get("/api/me", ...authenticated, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const tenantId = req.user.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Invalid authentication: missing tenant context' });
      }

      const user = await storage.getUser(req.user.userId, tenantId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        id: user.id,
        username: user.username,
        role: user.role
      });
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ error: "Failed to fetch user information" });
    }
  });

  // Recommendations endpoints
  app.get("/api/recommendations", ...authenticated, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Invalid authentication: missing tenant context' });
      }

      const status = req.query.status as string | undefined;
      const recommendations = await storage.getRecommendations(tenantId, status);
      res.json(recommendations);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  });

  app.get("/api/recommendations/:id", ...authenticated, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Invalid authentication: missing tenant context' });
      }

      const recommendation = await storage.getRecommendation(req.params.id, tenantId);
      if (!recommendation) {
        return res.status(404).json({ error: "Recommendation not found" });
      }
      res.json(recommendation);
    } catch (error) {
      console.error("Error fetching recommendation:", error);
      res.status(500).json({ error: "Failed to fetch recommendation" });
    }
  });

  app.post("/api/recommendations", ...authenticated, auditMiddleware(auditActions.CREATE, auditResourceTypes.RECOMMENDATION, req => req.body?.id), async (req, res) => {
    try {
      const validatedData = insertRecommendationSchema.parse(req.body);
      
      // Extract tenantId from authenticated user
      const tenantId = req.user?.tenantId || 'default-tenant';
      const recommendation = await storage.createRecommendation(validatedData, tenantId);
      
      // Broadcast new recommendation to connected clients in the same tenant
      broadcastToTenant(tenantId, {
        type: 'new_recommendation',
        data: recommendation
      });
      
      res.json(recommendation);
    } catch (error) {
      console.error("Error creating recommendation:", error);
      res.status(400).json({ error: "Failed to create recommendation" });
    }
  });

  // Approval request endpoints - Require admin or CFO role
  app.post("/api/approval-requests", ...authenticatedUser, auditMiddleware(auditActions.CREATE, auditResourceTypes.APPROVAL_REQUEST, req => req.body?.recommendationId), async (req, res) => {
    try {
      console.log("Creating approval request with data:", req.body);
      const validatedData = insertApprovalRequestSchema.parse(req.body);
      console.log("Validated data:", validatedData);
      
      // Extract tenantId from authenticated user - MUST validate BEFORE any storage calls
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Invalid authentication: missing tenant context' });
      }

      // For high-impact recommendations, require admin or CFO role
      const recommendation = await storage.getRecommendation(validatedData.recommendationId, tenantId);
      if (recommendation && req.body.status === 'approved') {
        const userRole = req.user?.role;
        const projectedAnnualSavings = (recommendation.projectedMonthlySavings || 0) * 12;
        const highImpact = projectedAnnualSavings > 100000000; // > $100k annual savings
        
        if (highImpact && userRole !== 'admin' && userRole !== 'cfo' && userRole !== 'Head of Cloud Platform') {
          return res.status(403).json({ 
            error: "High-impact recommendations require admin or CFO approval",
            required: "admin or cfo",
            current: userRole
          });
        }
      }
      
      // Create approval request with date handling
      const approvalRequestData = {
        ...validatedData,
        ...(req.body.approvalDate && { approvalDate: new Date(req.body.approvalDate) })
      };
      console.log("Final approval request data:", approvalRequestData);
      
      const approvalRequest = await storage.createApprovalRequest(approvalRequestData as any, tenantId);
      console.log("Created approval request:", approvalRequest);
      
      // If approved, update the recommendation status and create activity entry
      if (req.body.status === 'approved') {
        console.log("Updating recommendation status to approved for:", validatedData.recommendationId);
        await storage.updateRecommendationStatus(validatedData.recommendationId, 'approved', tenantId);
        
        // Get the recommendation details for the activity entry
        if (recommendation) {
          console.log("Creating activity entry for approval");
          await storage.createOptimizationHistory({
            tenantId,
            recommendationId: validatedData.recommendationId,
            executedBy: req.user?.userId || validatedData.approvedBy || 'system',
            executionDate: new Date(),
            beforeConfig: recommendation.currentConfig as any,
            afterConfig: recommendation.recommendedConfig as any,
            actualSavings: recommendation.projectedMonthlySavings,
            status: 'approved'
          }, tenantId);
        }
      }
      
      // Broadcast approval request to connected clients in the same tenant
      broadcastToTenant(tenantId, {
        type: 'approval_request',
        data: approvalRequest
      });
      
      res.json(approvalRequest);
    } catch (error) {
      console.error("Error creating approval request:", error);
      res.status(500).json({ error: "Failed to create approval request" });
    }
  });

  app.patch("/api/approval-requests/:id", ...authenticatedUser, auditMiddleware(auditActions.APPROVE, auditResourceTypes.APPROVAL_REQUEST, req => req.params.id), async (req, res) => {
    try {
      const { status, approvedBy, comments } = req.body;
      
      // First, get the existing approval request to find the recommendationId
      const { approvalRequests } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const [existingRequest] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, req.params.id)).limit(1);

      if (!existingRequest) {
        return res.status(404).json({ error: "Approval request not found" });
      }

      // Use transaction to update both approval request and recommendation atomically
      const { recommendation, approvalRequest } = await handleApprovalTransaction({
        recommendationId: existingRequest.recommendationId,
        approvalRequestId: req.params.id,
        status,
        approvedBy,
        comments,
        tenantId: req.user?.tenantId || 'default-tenant'
      }, {
        requestId: (req as any).requestId,
        userId: req.user?.userId
      });

      // If approved, execute the optimization (separate operation, kept as is)
      if (status === 'approved') {
        const tenantId = recommendation.tenantId || req.user?.tenantId || 'default-tenant';
        try {
          const execResult = await executeOptimization(recommendation);
          await storage.updateRecommendationStatus(recommendation.id, 'executed', tenantId);
          
          await logAudit(req, {
            action: auditActions.EXECUTE,
            resourceType: auditResourceTypes.OPTIMIZATION,
            resourceId: recommendation.id,
            metadata: { 
              tenantId: req.user?.tenantId || 'default-tenant',
              status: 'success',
              savings: recommendation.projectedMonthlySavings
            }
          });
          
          // Broadcast optimization execution to tenant
          broadcastToTenant(tenantId, {
            type: 'optimization_executed',
            data: { recommendationId: recommendation.id, status: 'success' }
          });
        } catch (error) {
          console.error("Error executing optimization:", error);
          await storage.updateRecommendationStatus(recommendation.id, 'failed', tenantId);
          
          await logAudit(req, {
            action: auditActions.EXECUTE,
            resourceType: auditResourceTypes.OPTIMIZATION,
            resourceId: recommendation.id,
            metadata: { 
              tenantId: req.user?.tenantId || 'default-tenant',
              status: 'failed',
              error: error instanceof Error ? error.message : String(error)
            }
          });
          
          broadcastToTenant(tenantId, {
            type: 'optimization_executed',
            data: { recommendationId: recommendation.id, status: 'failed', error: error instanceof Error ? error.message : String(error) }
          });
        }
      }

      res.json(approvalRequest);
    } catch (error) {
      console.error("Error updating approval request:", error);
      res.status(400).json({ error: "Failed to update approval request" });
    }
  });

  // Bulk approve all pending recommendations - Require admin or CFO role
  app.post("/api/approve-all-recommendations", ...authenticatedAdmin, auditMiddleware(auditActions.APPROVE, auditResourceTypes.OPTIMIZATION), async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Invalid authentication: missing tenant context' });
      }

      console.log("Starting bulk approval of all pending recommendations");
      const approvedBy = req.user?.userId || 'current-user';
      const { comments } = req.body;
      
      // Get all pending recommendations
      const allRecommendations = await storage.getRecommendations(tenantId);
      const pendingRecommendations = allRecommendations.filter(r => r.status === 'pending');
      
      if (pendingRecommendations.length === 0) {
        return res.json({ 
          message: "No pending recommendations to approve",
          approvedCount: 0,
          recommendations: []
        });
      }

      console.log(`Found ${pendingRecommendations.length} pending recommendations to approve`);
      
      const approvedRecommendations = [];
      const errors = [];

      // Process each pending recommendation
      for (const recommendation of pendingRecommendations) {
        try {
          // Create approval request with pending status first
          const approvalRequest = await storage.createApprovalRequest({
            recommendationId: recommendation.id,
            requestedBy: approvedBy,
            approverRole: 'Head of Cloud Platform',
            status: 'pending',
            requestDate: new Date()
          } as any, tenantId);

          // Use transaction to update both recommendation and approval request to approved atomically
          const { recommendation: approvedRec, approvalRequest: approvedReq } = await handleApprovalTransaction({
            recommendationId: recommendation.id,
            approvalRequestId: approvalRequest.id,
            status: 'approved',
            approvedBy,
            comments: comments || `Bulk approved with ${pendingRecommendations.length - 1} other recommendations`,
            tenantId
          }, {
            requestId: (req as any).requestId,
            userId: req.user?.userId
          });

          // Audit log for individual recommendation approval
          await logAudit(req, {
            action: auditActions.APPROVE,
            resourceType: auditResourceTypes.RECOMMENDATION,
            resourceId: recommendation.id,
            metadata: { tenantId }
          });

          // Execute the optimization
          try {
            let execResult;
            if (recommendation.type === 'resize' && recommendation.resourceId.includes('redshift')) {
              const config = recommendation.recommendedConfig as any;
              execResult = await awsService.resizeRedshiftCluster(
                recommendation.resourceId,
                config.nodeType,
                config.numberOfNodes
              );
            }

            // Use transaction to update recommendation to executed and create history atomically
            await handleOptimizationExecutionTransaction({
              recommendationId: recommendation.id,
              executedBy: approvedBy,
              beforeConfig: recommendation.currentConfig as any,
              afterConfig: recommendation.recommendedConfig as any,
              actualSavings: recommendation.projectedMonthlySavings,
              status: 'success',
              tenantId
            }, {
              requestId: (req as any).requestId,
              userId: req.user?.userId
            });

            // Send Slack notification
            await sendOptimizationComplete({
              title: recommendation.title,
              resourceId: recommendation.resourceId,
              actualSavings: Number(recommendation.projectedMonthlySavings),
              status: 'success'
            });

            await logAudit(req, {
              action: auditActions.EXECUTE,
              resourceType: auditResourceTypes.OPTIMIZATION,
              resourceId: recommendation.id,
              metadata: { 
                status: 'success',
                tenantId
              }
            });
          } catch (execError) {
            console.error(`Error executing optimization for ${recommendation.id}:`, execError);
            
            // Use transaction to update recommendation to failed and create history atomically
            await handleOptimizationExecutionTransaction({
              recommendationId: recommendation.id,
              executedBy: approvedBy,
              beforeConfig: recommendation.currentConfig as any,
              afterConfig: recommendation.recommendedConfig as any,
              status: 'failed',
              errorMessage: execError instanceof Error ? execError.message : String(execError),
              tenantId
            }, {
              requestId: (req as any).requestId,
              userId: req.user?.userId
            });

            await logAudit(req, {
              action: auditActions.EXECUTE,
              resourceType: auditResourceTypes.OPTIMIZATION,
              resourceId: recommendation.id,
              metadata: { 
                status: 'failed',
                error: execError instanceof Error ? execError.message : String(execError),
                tenantId
              }
            });
          }

          approvedRecommendations.push({
            id: recommendation.id,
            title: recommendation.title,
            projectedAnnualSavings: (recommendation.projectedMonthlySavings || 0) * 12
          });

          console.log(`Successfully approved recommendation: ${recommendation.title}`);
        } catch (error) {
          console.error(`Error approving recommendation ${recommendation.id}:`, error);
          errors.push({
            recommendationId: recommendation.id,
            title: recommendation.title,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Broadcast bulk approval to connected clients in the same tenant
      broadcastToTenant(tenantId, {
        type: 'bulk_approval',
        data: { 
          approvedCount: approvedRecommendations.length,
          totalAttempted: pendingRecommendations.length,
          errors: errors.length
        }
      });

      const totalSavings = approvedRecommendations.reduce((sum, rec) => sum + (rec.projectedAnnualSavings || 0), 0);

      res.json({
        message: `Successfully approved ${approvedRecommendations.length} of ${pendingRecommendations.length} pending recommendations`,
        approvedCount: approvedRecommendations.length,
        totalAttempted: pendingRecommendations.length,
        totalAnnualSavings: totalSavings,
        recommendations: approvedRecommendations,
        errors
      });

      console.log(`Bulk approval completed: ${approvedRecommendations.length}/${pendingRecommendations.length} successful`);
    } catch (error) {
      console.error("Error in bulk approval:", error);
      res.status(500).json({ error: "Failed to approve recommendations" });
    }
  });

  // Optimization history endpoint
  app.get("/api/optimization-history", ...authenticated, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Invalid authentication: missing tenant context' });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const history = await storage.getOptimizationHistory(tenantId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching optimization history:", error);
      res.status(500).json({ error: "Failed to fetch optimization history" });
    }
  });

  // AWS resources endpoint
  app.get("/api/aws-resources", ...authenticated, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Invalid authentication: missing tenant context' });
      }

      const resources = await storage.getAllAwsResources(tenantId);
      res.json(resources);
    } catch (error) {
      console.error("Error fetching AWS resources:", error);
      res.status(500).json({ error: "Failed to fetch AWS resources" });
    }
  });

  // Manual analysis trigger
  app.post("/api/analyze-resources", ...authenticated, auditMiddleware(auditActions.EXECUTE, auditResourceTypes.AWS_RESOURCE), async (req, res) => {
    try {
      // Trigger analysis for specific resource type or all
      const { resourceType, resourceId } = req.body;
      
      if (resourceType === 'redshift' && resourceId) {
        const analysis = await awsService.analyzeRedshiftClusterOptimization(resourceId);
        
        await logAudit(req, {
          action: auditActions.EXECUTE,
          resourceType: auditResourceTypes.AWS_RESOURCE,
          resourceId: resourceId,
          metadata: {
            resourceType: resourceType,
            analysisResult: analysis ? 'success' : 'no_result',
            tenantId: req.user?.tenantId || 'default-tenant'
          }
        });
        
        res.json(analysis);
      } else {
        res.status(400).json({ error: "Invalid analysis request" });
      }
    } catch (error) {
      console.error("Error analyzing resources:", error);
      res.status(500).json({ error: "Failed to analyze resources" });
    }
  });

  // AWS Data Simulation endpoints - Require admin role
  app.post("/api/generate-aws-data", ...authenticatedAdmin, auditMiddleware(auditActions.EXECUTE, auditResourceTypes.AWS_RESOURCE), async (req, res) => {
    try {
      const { DataGenerator } = await import('./services/data-generator.js');
      const generator = new DataGenerator(storage);
      const result = await generator.generateAWSData();
      res.json(result);
    } catch (error) {
      console.error("Error generating AWS data:", error);
      res.status(500).json({ error: "Failed to generate AWS data" });
    }
  });

  app.post("/api/clear-simulation-data", ...authenticatedAdmin, auditMiddleware(auditActions.DELETE, auditResourceTypes.AWS_RESOURCE), async (req, res) => {
    try {
      const { DataGenerator } = await import('./services/data-generator.js');
      const generator = new DataGenerator(storage);
      await generator.clearAllData();
      res.json({ message: "Simulation data cleared" });
    } catch (error) {
      console.error("Error clearing simulation data:", error);
      res.status(500).json({ error: "Failed to clear simulation data" });
    }
  });

  // System Configuration Routes - Require admin role
  app.get("/api/system-config", ...authenticatedAdmin, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Invalid authentication: missing tenant context' });
      }

      const configs = await storage.getAllSystemConfig(tenantId);
      res.json(configs);
    } catch (error) {
      console.error("Error fetching system config:", error);
      res.status(500).json({ error: "Failed to fetch system configuration" });
    }
  });

  app.get("/api/system-config/:key", ...authenticatedAdmin, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Invalid authentication: missing tenant context' });
      }

      const config = await storage.getSystemConfig(req.params.key, tenantId);
      if (!config) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("Error fetching system config:", error);
      res.status(500).json({ error: "Failed to fetch system configuration" });
    }
  });

  app.post("/api/system-config", ...authenticatedAdmin, auditMiddleware(auditActions.CREATE, auditResourceTypes.SYSTEM_CONFIG, req => req.body?.key), async (req, res) => {
    try {
      const { insertSystemConfigSchema } = await import("@shared/schema");
      const validatedData = insertSystemConfigSchema.parse(req.body);
      
      // Extract tenantId from authenticated user
      const tenantId = req.user?.tenantId || 'default-tenant';
      const config = await storage.setSystemConfig(validatedData, tenantId);
      res.json(config);
    } catch (error) {
      console.error("Error setting system config:", error);
      res.status(500).json({ error: "Failed to set system configuration" });
    }
  });

  app.put("/api/system-config/:key", ...authenticatedAdmin, auditMiddleware(auditActions.UPDATE, auditResourceTypes.SYSTEM_CONFIG, req => req.params.key), async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Invalid authentication: missing tenant context' });
      }

      const { value, updatedBy } = req.body;
      
      // Basic validation for numeric values
      if (req.params.key.includes('risk_level') || req.params.key.includes('savings')) {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) {
          return res.status(400).json({ error: "Invalid numeric value" });
        }
      }
      
      const config = await storage.updateSystemConfig(req.params.key, value, updatedBy || 'system', tenantId);
      if (!config) {
        return res.status(404).json({ error: "Configuration not found" });
      }

      // Invalidate configuration service cache when system config is updated
      const { configService } = await import('./services/config.js');
      configService.invalidateCache();
      
      res.json(config);
    } catch (error) {
      console.error("Error updating system config:", error);
      res.status(500).json({ error: "Failed to update system configuration" });
    }
  });

  // Agent Configuration Helper Routes
  app.get("/api/agent-config", ...authenticatedAdmin, async (req, res) => {
    try {
      const { configService } = await import('./services/config.js');
      const agentConfig = await configService.getAgentConfig();
      res.json(agentConfig);
    } catch (error) {
      console.error("Error fetching agent config:", error);
      res.status(500).json({ error: "Failed to fetch agent configuration" });
    }
  });

  app.post("/api/agent-config/autonomous-mode", ...authenticatedAdmin, auditMiddleware(auditActions.UPDATE, auditResourceTypes.SYSTEM_CONFIG, req => 'autonomous-mode'), async (req, res) => {
    try {
      const { enabled, updatedBy } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "Enabled must be a boolean value" });
      }
      
      const { configService } = await import('./services/config.js');
      await configService.setAutonomousMode(enabled, updatedBy || 'system');
      const agentConfig = await configService.getAgentConfig();
      
      // Broadcast configuration change to connected clients in the same tenant
      const tenantId = req.user?.tenantId || 'default-tenant';
      broadcastToTenant(tenantId, {
        type: 'agent_config_updated',
        data: { autonomousMode: enabled, updatedBy }
      });
      
      res.json(agentConfig);
    } catch (error) {
      console.error("Error updating autonomous mode:", error);
      res.status(500).json({ error: "Failed to update autonomous mode" });
    }
  });

  app.post("/api/agent-config/prod-mode", ...authenticatedAdmin, auditMiddleware(auditActions.UPDATE, auditResourceTypes.SYSTEM_CONFIG, req => 'prod-mode'), async (req, res) => {
    try {
      const { enabled, updatedBy } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "Enabled must be a boolean value" });
      }
      
      const { configService } = await import('./services/config.js');
      await configService.setProdMode(enabled, updatedBy || 'system');
      const agentConfig = await configService.getAgentConfig();
      
      // Broadcast configuration change to connected clients in the same tenant
      const tenantId = req.user?.tenantId || 'default-tenant';
      broadcastToTenant(tenantId, {
        type: 'agent_config_updated',
        data: { prodMode: enabled, updatedBy }
      });
      
      res.json(agentConfig);
    } catch (error) {
      console.error("Error updating prod mode:", error);
      res.status(500).json({ error: "Failed to update prod mode" });
    }
  });

  app.post("/api/agent-config/simulation-mode", ...authenticatedAdmin, auditMiddleware(auditActions.UPDATE, auditResourceTypes.SYSTEM_CONFIG, req => 'simulation-mode'), async (req, res) => {
    try {
      const { enabled, updatedBy } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "Enabled must be a boolean value" });
      }
      
      const { configService } = await import('./services/config.js');
      await configService.setSimulationMode(enabled, updatedBy || 'system');
      const agentConfig = await configService.getAgentConfig();
      
      // Broadcast configuration change to connected clients in the same tenant
      const tenantId = req.user?.tenantId || 'default-tenant';
      broadcastToTenant(tenantId, {
        type: 'agent_config_updated',
        data: { simulationMode: enabled, updatedBy }
      });
      
      res.json(agentConfig);
    } catch (error) {
      console.error("Error updating simulation mode:", error);
      res.status(500).json({ error: "Failed to update simulation mode" });
    }
  });

  // AI Mode History routes
  app.get("/api/ai-mode-history", ...authenticatedAdmin, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Invalid authentication: missing tenant context' });
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const history = await storage.getRecentAiModeHistory(limit, tenantId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching AI mode history:", error);
      res.status(500).json({ error: "Failed to fetch AI mode history" });
    }
  });

  // Get specific AI mode history with recommendations drill-down
  app.get("/api/ai-mode-history/:id", ...authenticated, async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Invalid authentication: missing tenant context' });
      }

      const { id } = req.params;
      const data = await storage.getAiModeHistoryWithRecommendations(id, tenantId);
      
      if (!data) {
        return res.status(404).json({ error: 'AI mode history not found' });
      }

      res.json(data);
    } catch (error) {
      console.error("Error fetching AI mode history details:", error);
      res.status(500).json({ error: "Failed to fetch AI mode history details" });
    }
  });

  // Manual AI analysis trigger endpoint
  app.post("/api/ai/analyze", ...authenticated, async (req, res) => {
    try {
      console.log('🤖 Manual AI analysis triggered...');
      
      // Trigger AI analysis manually (useful for testing)
      schedulerService.triggerAIAnalysis().catch(err => {
        console.error('AI analysis error:', err);
      });
      
      await logAudit(req, {
        action: auditActions.EXECUTE,
        resourceType: 'ai_analysis',
        metadata: { 
          prompt: req.body.prompt || 'manual_trigger',
          tenantId: req.user?.tenantId || 'default-tenant'
        }
      });
      
      res.json({ 
        success: true, 
        message: 'AI analysis started. Check logs for progress.' 
      });
    } catch (error) {
      console.error("Error triggering AI analysis:", error);
      res.status(500).json({ error: "Failed to trigger AI analysis" });
    }
  });

  // Execute optimization function
  async function executeOptimization(recommendation: any) {
    try {
      let result;
      
      // Extract tenantId from recommendation
      const tenantId = recommendation.tenantId || 'default-tenant';
      
      if (recommendation.type === 'resize' && recommendation.resourceId.includes('redshift')) {
        // Execute Redshift cluster resize
        const config = recommendation.recommendedConfig;
        result = await awsService.resizeRedshiftCluster(
          recommendation.resourceId,
          config.nodeType,
          config.numberOfNodes
        );
        
        // Record the optimization in history
        await storage.createOptimizationHistory({
          tenantId,
          recommendationId: recommendation.id,
          executedBy: 'system', // In a real app, this would be the current user
          executionDate: new Date(),
          beforeConfig: recommendation.currentConfig,
          afterConfig: recommendation.recommendedConfig,
          actualSavings: recommendation.projectedMonthlySavings,
          status: 'success'
        }, tenantId);

        // Send Slack notification
        await sendOptimizationComplete({
          title: recommendation.title,
          resourceId: recommendation.resourceId,
          actualSavings: Number(recommendation.projectedMonthlySavings),
          status: 'success'
        });
      }
      
      return result;
    } catch (error) {
      // Extract tenantId from recommendation
      const tenantId = recommendation.tenantId || 'default-tenant';
      
      // Record failed optimization
      await storage.createOptimizationHistory({
        tenantId,
        recommendationId: recommendation.id,
        executedBy: 'system',
        executionDate: new Date(),
        beforeConfig: recommendation.currentConfig,
        afterConfig: recommendation.recommendedConfig,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error)
      }, tenantId);

      await sendOptimizationComplete({
        title: recommendation.title,
        resourceId: recommendation.resourceId,
        actualSavings: 0,
        status: 'failed'
      });

      throw error;
    }
  }

  return httpServer;
}
