/**
 * Circuit Breaker Pattern Implementation
 * Protects external service calls from cascading failures
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject calls immediately
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;      // Number of failures before opening
  successThreshold?: number;      // Number of successes in HALF_OPEN to close
  timeout?: number;               // Time in ms before trying HALF_OPEN
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Circuit Breaker for protecting external service calls
 * 
 * States:
 * - CLOSED: Normal operation, calls go through
 * - OPEN: Service is failing, calls rejected immediately
 * - HALF_OPEN: Testing if service recovered, limited calls allowed
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private nextAttemptTime: number | null = null;
  
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
  private readonly onOpen?: () => void;
  private readonly onClose?: () => void;
  
  constructor(
    private name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.timeout = options.timeout ?? 30000; // 30 seconds default
    this.onStateChange = options.onStateChange;
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;
  }
  
  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      // Check if we should try HALF_OPEN
      if (this.nextAttemptTime && Date.now() >= this.nextAttemptTime) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        const waitTime = this.nextAttemptTime ? Math.round((this.nextAttemptTime - Date.now()) / 1000) : 0;
        throw new CircuitBreakerError(
          `Circuit breaker [${this.name}] is OPEN. Service unavailable. Retry in ${waitTime}s.`
        );
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  /**
   * Execute with graceful degradation - returns null on failure instead of throwing
   */
  async executeWithFallback<T>(fn: () => Promise<T>, fallbackValue: T | null = null): Promise<T | null> {
    try {
      return await this.execute(fn);
    } catch (error) {
      if (error instanceof CircuitBreakerError) {
        console.warn(`[CircuitBreaker:${this.name}] Circuit is OPEN, using fallback value`);
        return fallbackValue;
      }
      throw error;
    }
  }
  
  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
        this.successCount = 0;
      }
    }
  }
  
  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0; // Reset success count on any failure
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN immediately opens the circuit
      this.transitionTo(CircuitState.OPEN);
    } else if (this.failureCount >= this.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }
  
  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;
    
    const oldState = this.state;
    this.state = newState;
    
    console.log(`[CircuitBreaker:${this.name}] State transition: ${oldState} -> ${newState}`);
    
    if (newState === CircuitState.OPEN) {
      this.nextAttemptTime = Date.now() + this.timeout;
      console.warn(
        `[CircuitBreaker:${this.name}] Circuit OPEN after ${this.failureCount} failures. ` +
        `Will retry in ${this.timeout / 1000}s`
      );
      if (this.onOpen) this.onOpen();
    } else if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.nextAttemptTime = null;
      console.log(`[CircuitBreaker:${this.name}] Circuit CLOSED. Service recovered.`);
      if (this.onClose) this.onClose();
    } else if (newState === CircuitState.HALF_OPEN) {
      console.log(`[CircuitBreaker:${this.name}] Circuit HALF_OPEN. Testing service recovery...`);
    }
    
    if (this.onStateChange) {
      this.onStateChange(oldState, newState);
    }
  }
  
  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }
  
  /**
   * Get circuit statistics
   */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }
  
  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }
}
