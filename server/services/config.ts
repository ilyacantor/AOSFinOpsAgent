import { storage } from '../storage.js';
import { logger } from './logger.js';

export interface AgentConfig {
  autonomousMode: boolean;
  prodMode: boolean;
  simulationMode: boolean;
  maxAutonomousRiskLevel: number;
  approvalRequiredAboveSavings: number;
  autoExecuteTypes: string[];
  prodModeTimeRemaining?: number;
}

export interface DatabaseConfig {
  url: string;
  poolSize: number;
}

export interface PlatformConfig {
  baseUrl: string;
  tenantId: string;
  agentId: string;
  jwt: string;
  enabled: boolean;
}

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpiry: string;
  bcryptRounds: number;
}

export interface FeatureFlags {
  usePlatform: boolean;
  simulationMode: boolean;
  autoApproveLowRisk: boolean;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface AppConfig {
  database: DatabaseConfig;
  platform: PlatformConfig;
  security: SecurityConfig;
  features: FeatureFlags;
  rateLimit: RateLimitConfig;
  agent: AgentConfig;
}

export class ConfigService {
  private static instance: ConfigService;
  private configCache: Map<string, string> = new Map();
  private prodModeExpiresAt: number | null = null;
  private appConfig: AppConfig | null = null;

  private constructor() {}

  private getEnv(key: string, defaultValue?: string, required = false): string {
    const value = process.env[key] || defaultValue;
    
    if (required && !value) {
      const error = `FATAL: Required environment variable ${key} is not set`;
      logger.error(error);
      throw new Error(error);
    }
    
    return value || '';
  }

  private getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      logger.warn(`Invalid number for ${key}, using default: ${defaultValue}`);
      return defaultValue;
    }
    return parsed;
  }

  private getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  }

  async validateAndLoadConfig(): Promise<AppConfig> {
    if (this.appConfig) {
      return this.appConfig;
    }

    logger.info('Loading and validating application configuration');

    try {
      const databaseUrl = this.getEnv('DATABASE_URL', '', false);
      
      const config: AppConfig = {
        database: {
          url: databaseUrl,
          poolSize: this.getEnvNumber('DB_POOL_SIZE', 10)
        },
        platform: {
          baseUrl: this.getEnv('VITE_AOS_BASE_URL', this.getEnv('VITE_PLATFORM_URL', '')),
          tenantId: this.getEnv('AOS_TENANT_ID', ''),
          agentId: this.getEnv('AOS_AGENT_ID', ''),
          jwt: this.getEnv('AOS_JWT', ''),
          enabled: this.getEnvBoolean('USE_PLATFORM', false)
        },
        security: {
          jwtSecret: this.getEnv('JWT_SECRET', 'dev-secret-key-change-in-production'),
          jwtExpiry: this.getEnv('JWT_EXPIRY', '24h'),
          bcryptRounds: this.getEnvNumber('BCRYPT_ROUNDS', 10)
        },
        features: {
          usePlatform: this.getEnvBoolean('USE_PLATFORM', false),
          simulationMode: this.getEnvBoolean('SIMULATION_MODE', false),
          autoApproveLowRisk: this.getEnvBoolean('AUTO_APPROVE_LOW_RISK', false)
        },
        rateLimit: {
          windowMs: this.getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
          maxRequests: this.getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100)
        },
        agent: await this.getAgentConfig()
      };

      if (!config.security.jwtSecret || config.security.jwtSecret === 'dev-secret-key-change-in-production') {
        logger.warn('JWT_SECRET not set or using default. Please set a secure secret in production');
      }

      if (config.platform.enabled && !config.platform.baseUrl) {
        logger.warn('Platform integration enabled but VITE_AOS_BASE_URL not set');
      }

      this.appConfig = config;
      logger.info('Configuration loaded successfully', {
        platformEnabled: config.platform.enabled,
        simulationMode: config.features.simulationMode,
        rateLimitWindow: config.rateLimit.windowMs
      });

      return config;
    } catch (error) {
      logger.error('Failed to load configuration', {}, error as Error);
      throw error;
    }
  }

  getConfig(): AppConfig {
    if (!this.appConfig) {
      throw new Error('Configuration not loaded. Call validateAndLoadConfig() first');
    }
    return this.appConfig;
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  async initializeDefaults() {
    // Initialize default configuration values
    const defaults = [
      {
        key: 'agent.autonomous_mode',
        value: 'false',
        description: 'Enable autonomous execution of recommendations without human approval',
        updatedBy: 'system'
      },
      {
        key: 'agent.prod_mode',
        value: 'false',
        description: 'Production Mode: When ON, use AI-powered analysis with RAG. When OFF, use heuristics-based analysis',
        updatedBy: 'system'
      },
      {
        key: 'agent.simulation_mode',
        value: 'false',
        description: 'Simulation Mode: When ON, generate synthetic dynamic data. When OFF, use static data',
        updatedBy: 'system'
      },
      {
        key: 'agent.max_autonomous_risk_level',
        value: '5.0',
        description: 'Maximum risk level (percentage) for autonomous execution',
        updatedBy: 'system'
      },
      {
        key: 'agent.approval_required_above_savings',
        value: '10000000',
        description: 'Annual savings amount (USD) above which approval is required even in autonomous mode',
        updatedBy: 'system'
      },
      {
        key: 'agent.auto_execute_types',
        value: 'resize,storage-class',
        description: 'Comma-separated list of recommendation types that can be executed autonomously',
        updatedBy: 'system'
      }
    ];

    for (const config of defaults) {
      const existing = await storage.getSystemConfig(config.key);
      if (!existing) {
        await storage.setSystemConfig(config, 'default-tenant');
        this.configCache.set(config.key, config.value);
      } else {
        this.configCache.set(config.key, existing.value);
      }
    }
  }

  async getAgentConfig(): Promise<AgentConfig> {
    await this.refreshCache();
    
    const prodMode = this.getBooleanConfig('agent.prod_mode', false);
    let prodModeTimeRemaining: number | undefined;

    if (prodMode && this.prodModeExpiresAt) {
      const remaining = Math.max(0, Math.floor((this.prodModeExpiresAt - Date.now()) / 1000));
      prodModeTimeRemaining = remaining;
    }
    
    return {
      autonomousMode: this.getBooleanConfig('agent.autonomous_mode', false),
      prodMode,
      simulationMode: this.getBooleanConfig('agent.simulation_mode', false),
      maxAutonomousRiskLevel: this.getNumberConfig('agent.max_autonomous_risk_level', 5.0),
      approvalRequiredAboveSavings: this.getNumberConfig('agent.approval_required_above_savings', 10000),
      autoExecuteTypes: this.getArrayConfig('agent.auto_execute_types', ['resize', 'storage-class']),
      prodModeTimeRemaining
    };
  }

  async setAutonomousMode(enabled: boolean, updatedBy: string): Promise<void> {
    await storage.updateSystemConfig('agent.autonomous_mode', enabled.toString(), updatedBy);
    this.configCache.set('agent.autonomous_mode', enabled.toString());
  }

  async setMaxAutonomousRiskLevel(riskLevel: number, updatedBy: string): Promise<void> {
    await storage.updateSystemConfig('agent.max_autonomous_risk_level', riskLevel.toString(), updatedBy);
    this.configCache.set('agent.max_autonomous_risk_level', riskLevel.toString());
  }

  async setProdMode(enabled: boolean, updatedBy: string): Promise<void> {
    await storage.updateSystemConfig('agent.prod_mode', enabled.toString(), updatedBy);
    this.configCache.set('agent.prod_mode', enabled.toString());
    
    // Track expiration time when enabling prod mode
    if (enabled) {
      this.prodModeExpiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes from now
    } else {
      this.prodModeExpiresAt = null;
    }
  }

  async setSimulationMode(enabled: boolean, updatedBy: string): Promise<void> {
    await storage.updateSystemConfig('agent.simulation_mode', enabled.toString(), updatedBy);
    this.configCache.set('agent.simulation_mode', enabled.toString());
  }

  // Method to invalidate cache when configuration is updated externally
  invalidateCache(): void {
    this.configCache.clear();
  }

  async canExecuteAutonomously(recommendation: {
    type: string;
    riskLevel: number;
    projectedAnnualSavings: number;
  }): Promise<boolean> {
    const config = await this.getAgentConfig();
    
    // Must be in autonomous mode
    if (!config.autonomousMode) {
      return false;
    }

    // Check risk level
    if (recommendation.riskLevel > config.maxAutonomousRiskLevel) {
      return false;
    }

    // Check savings threshold
    if (recommendation.projectedAnnualSavings > config.approvalRequiredAboveSavings) {
      return false;
    }

    // Check if recommendation type is allowed for autonomous execution
    if (!config.autoExecuteTypes.includes(recommendation.type)) {
      return false;
    }

    return true;
  }

  private async refreshCache(): Promise<void> {
    // Only refresh cache if it's empty or periodically
    if (this.configCache.size === 0) {
      const allConfig = await storage.getAllSystemConfig();
      for (const config of allConfig) {
        this.configCache.set(config.key, config.value);
      }
    }
  }

  private getBooleanConfig(key: string, defaultValue: boolean): boolean {
    const value = this.configCache.get(key);
    return value ? value.toLowerCase() === 'true' : defaultValue;
  }

  private getNumberConfig(key: string, defaultValue: number): number {
    const value = this.configCache.get(key);
    return value ? parseFloat(value) : defaultValue;
  }

  private getArrayConfig(key: string, defaultValue: string[]): string[] {
    const value = this.configCache.get(key);
    return value ? value.split(',').map(v => v.trim()) : defaultValue;
  }
}

export const configService = ConfigService.getInstance();