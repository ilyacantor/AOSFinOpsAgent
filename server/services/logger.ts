import { Request } from 'express';

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

interface LogContext {
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  private formatLog(entry: LogEntry): string {
    if (this.isDevelopment) {
      const timestamp = new Date(entry.timestamp).toLocaleTimeString();
      const level = entry.level.padEnd(5);
      const contextStr = entry.context 
        ? ` [${Object.entries(entry.context)
            .filter(([k]) => k !== 'requestId' && k !== 'userId')
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')}]` 
        : '';
      const requestInfo = entry.context?.requestId 
        ? ` [reqId=${entry.context.requestId}]` 
        : '';
      const userInfo = entry.context?.userId 
        ? ` [userId=${entry.context.userId}]` 
        : '';
      
      let output = `${timestamp} ${level} ${entry.message}${requestInfo}${userInfo}${contextStr}`;
      
      if (entry.error) {
        output += `\n  Error: ${entry.error.message}`;
        if (entry.error.stack && this.isDevelopment) {
          output += `\n${entry.error.stack}`;
        }
      }
      
      return output;
    } else {
      return JSON.stringify(entry);
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    const formatted = this.formatLog(entry);
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.debug(formatted);
        }
        break;
    }
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  withRequest(req: Request): RequestLogger {
    return new RequestLogger(this, req);
  }
}

class RequestLogger {
  private logger: Logger;
  private context: LogContext;

  constructor(logger: Logger, req: Request) {
    this.logger = logger;
    this.context = {
      requestId: (req as any).requestId,
      userId: req.user?.userId,
      method: req.method,
      path: req.path
    };
  }

  error(message: string, additionalContext?: Record<string, any>, error?: Error): void {
    this.logger.error(message, { ...this.context, ...additionalContext }, error);
  }

  warn(message: string, additionalContext?: Record<string, any>): void {
    this.logger.warn(message, { ...this.context, ...additionalContext });
  }

  info(message: string, additionalContext?: Record<string, any>): void {
    this.logger.info(message, { ...this.context, ...additionalContext });
  }

  debug(message: string, additionalContext?: Record<string, any>): void {
    this.logger.debug(message, { ...this.context, ...additionalContext });
  }
}

export const logger = new Logger();
