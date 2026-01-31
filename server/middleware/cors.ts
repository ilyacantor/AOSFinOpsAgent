import cors from 'cors';
import { logger } from '../services/logger';

const corsOptions: cors.CorsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86400,
};

export const corsMiddleware = cors(corsOptions);

logger.info('CORS middleware configured', {
  mode: 'permissive (JWT auth provides security)',
});
