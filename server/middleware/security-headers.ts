import { type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';

export interface SecurityHeadersConfig {
  enableHSTS?: boolean;
  hstsMaxAge?: number;
  hstsIncludeSubDomains?: boolean;
  hstsPreload?: boolean;
  enableCSP?: boolean;
  cspDirectives?: Record<string, string[]>;
  enableFrameProtection?: boolean;
  enableContentTypeOptions?: boolean;
  enableReferrerPolicy?: boolean;
  enablePermissionsPolicy?: boolean;
}

const DEFAULT_CONFIG: Required<SecurityHeadersConfig> = {
  enableHSTS: true,
  hstsMaxAge: 31536000, // 1 year (365 days)
  hstsIncludeSubDomains: true,
  hstsPreload: false, // Requires manual submission to browsers' preload lists
  enableCSP: true,
  cspDirectives: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Vite dev mode requires unsafe-inline/eval
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", 'wss:', 'ws:'],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  },
  enableFrameProtection: true,
  enableContentTypeOptions: true,
  enableReferrerPolicy: true,
  enablePermissionsPolicy: true,
};

function buildCSPHeader(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

export function securityHeadersMiddleware(config: SecurityHeadersConfig = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    if (finalConfig.enableHSTS) {
      let hstsValue = `max-age=${finalConfig.hstsMaxAge}`;
      if (finalConfig.hstsIncludeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      if (finalConfig.hstsPreload) {
        hstsValue += '; preload';
      }
      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    if (finalConfig.enableCSP && finalConfig.cspDirectives) {
      const cspHeader = buildCSPHeader(finalConfig.cspDirectives);
      res.setHeader('Content-Security-Policy', cspHeader);
    }

    if (finalConfig.enableFrameProtection) {
      res.setHeader('X-Frame-Options', 'DENY');
    }

    if (finalConfig.enableContentTypeOptions) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    if (finalConfig.enableReferrerPolicy) {
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }

    if (finalConfig.enablePermissionsPolicy) {
      res.setHeader(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), interest-cohort=()'
      );
    }

    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');

    next();
  };
}

export const developmentSecurityHeaders = securityHeadersMiddleware({
  enableHSTS: true, // Enable for testing (browsers ignore HSTS on HTTP anyway)
  hstsMaxAge: 31536000,
  hstsIncludeSubDomains: true,
  enableCSP: true,
  cspDirectives: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Required for Vite HMR
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", 'wss:', 'ws:', 'http:', 'https:'],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  },
});

export const productionSecurityHeaders = securityHeadersMiddleware({
  enableHSTS: true,
  hstsMaxAge: 31536000, // 1 year
  hstsIncludeSubDomains: true,
  hstsPreload: false, // Enable after manual preload list submission
  enableCSP: true,
  cspDirectives: {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"], // Some styling libraries require inline styles
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", 'wss:', 'https:'],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'upgrade-insecure-requests': [],
  },
});
