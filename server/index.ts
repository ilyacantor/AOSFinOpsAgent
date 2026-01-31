// Suppress AWS SDK v2 and other non-critical warnings (demo app uses synthetic data)
process.removeAllListeners('warning');
const originalEmitWarning = process.emitWarning;
process.emitWarning = function(warning, ...args: any[]) {
  const warningString = typeof warning === 'string' ? warning : (warning as any)?.message || '';
  
  // Suppress AWS SDK maintenance mode warnings
  if (warningString.includes('AWS SDK') || 
      warningString.includes('maintenance mode') ||
      args[0] === 'DeprecationWarning' && warningString.includes('AWS')) {
    return;
  }
  
  return originalEmitWarning.apply(process, [warning, ...args] as any);
};

import express, { type Request, Response, NextFunction } from "express";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { loggingMiddleware } from "./middleware/logging";
import { logger } from "./services/logger";
import { configService } from "./services/config";
import { SchedulerService } from "./services/scheduler";
import { generalApiLimiter, authLimiter, writeLimiter, readLimiter } from "./middleware/rate-limit";
import { developmentSecurityHeaders, productionSecurityHeaders } from "./middleware/security-headers";
import { corsMiddleware } from "./middleware/cors";

const app = express();

app.set('trust proxy', 1);

app.use(corsMiddleware);

const isDevelopment = app.get("env") === "development";
app.use(isDevelopment ? developmentSecurityHeaders : productionSecurityHeaders);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(loggingMiddleware);

app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);

app.use('/api/*', generalApiLimiter);
app.use('/api/*', writeLimiter);
app.use('/api/*', readLimiter);

(async () => {
  // Run database migrations in production before starting the app
  const isProductionEnv = process.env.NODE_ENV === 'production';
  if (isProductionEnv) {
    try {
      console.log('🗄️  Running database migrations in production...');
      const { stdout, stderr } = await execPromise('npm run db:push --  --force');
      if (stdout) console.log(stdout);
      if (stderr && !stderr.includes('Warning')) console.error(stderr);
      console.log('✅ Database migrations complete');
    } catch (error) {
      console.error('❌ Database migration failed:', error);
      console.error('Attempting to continue anyway - tables may already exist');
    }
  }

  // Validate JWT_SECRET at startup - fail fast if missing or insecure
  const JWT_SECRET = process.env.JWT_SECRET;
  
  if (!JWT_SECRET || JWT_SECRET.length === 0) {
    console.error('╔═══════════════════════════════════════════════════════════════════╗');
    console.error('║ CRITICAL SECURITY ERROR: JWT_SECRET not set                      ║');
    console.error('╟───────────────────────────────────────────────────────────────────╢');
    console.error('║ The JWT_SECRET environment variable is required for secure       ║');
    console.error('║ authentication. The application cannot start without it.         ║');
    console.error('║                                                                   ║');
    console.error('║ Please set JWT_SECRET to a secure random string of at least      ║');
    console.error('║ 32 characters.                                                    ║');
    console.error('║                                                                   ║');
    console.error('║ Example:                                                          ║');
    console.error('║   export JWT_SECRET=$(openssl rand -base64 32)                   ║');
    console.error('╚═══════════════════════════════════════════════════════════════════╝');
    process.exit(1);
  }

  if (JWT_SECRET.length < 32) {
    console.error('╔═══════════════════════════════════════════════════════════════════╗');
    console.error(`║ CRITICAL SECURITY ERROR: JWT_SECRET too short (${JWT_SECRET.length} chars)        ║`);
    console.error('╟───────────────────────────────────────────────────────────────────╢');
    console.error('║ JWT_SECRET must be at least 32 characters for security.          ║');
    console.error('║                                                                   ║');
    console.error('║ Current length: ' + JWT_SECRET.length + ' characters                                  ║');
    console.error('║ Required length: 32+ characters                                  ║');
    console.error('║                                                                   ║');
    console.error('║ Please generate a new secure JWT_SECRET:                         ║');
    console.error('║   export JWT_SECRET=$(openssl rand -base64 32)                   ║');
    console.error('╚═══════════════════════════════════════════════════════════════════╝');
    process.exit(1);
  }

  logger.info('JWT_SECRET validated successfully', { length: JWT_SECRET.length });


  try {
    await configService.validateAndLoadConfig();
    await configService.initializeDefaults();
    logger.info('Application configuration initialized successfully');
    
    // Initialize scheduler service for demo mode simulation and background jobs
    const scheduler = new SchedulerService();
    await scheduler.initialize();
    logger.info('Scheduler service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize configuration', {}, error as Error);
    process.exit(1);
  }

  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error('Request error', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status,
      userId: req.user?.userId
    }, err);

    res.status(status).json({ message });
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    logger.info(`Server listening on port ${port}`, { port });
  });
})();
