import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { loggingMiddleware } from "./middleware/logging";
import { logger } from "./services/logger";
import { configService } from "./services/config";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(loggingMiddleware);

(async () => {
  try {
    await configService.validateAndLoadConfig();
    await configService.initializeDefaults();
    logger.info('Application configuration initialized successfully');
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
