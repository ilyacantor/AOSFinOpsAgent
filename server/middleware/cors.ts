import cors from 'cors';
import { logger } from '../services/logger';

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [];

const isDevelopment = process.env.NODE_ENV !== 'production';

const developmentCorsOptions: cors.CorsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86400, // 24 hours
};

const productionCorsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (ALLOWED_ORIGINS.length === 0) {
      logger.error('CORS: No ALLOWED_ORIGINS configured - rejecting request for security', {
        origin,
      });
      return callback(new Error('CORS not configured - set ALLOWED_ORIGINS environment variable'));
    }

    const isAllowed = ALLOWED_ORIGINS.some(allowed => {
      if (allowed === '*') {
        logger.error('CORS: Wildcard origin (*) not allowed in production - rejecting request', {
          requestOrigin: origin,
        });
        return false;
      }
      return origin === allowed || origin.endsWith(`.${allowed}`);
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      logger.error('CORS: Origin rejected', {
        origin,
        allowedOrigins: ALLOWED_ORIGINS,
      });
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 204,
};

export const corsMiddleware = cors(
  isDevelopment ? developmentCorsOptions : productionCorsOptions
);

logger.info('CORS middleware configured', {
  mode: isDevelopment ? 'development' : 'production',
  allowedOrigins: isDevelopment ? 'all' : ALLOWED_ORIGINS,
});
