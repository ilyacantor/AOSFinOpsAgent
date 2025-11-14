/**
 * Retry utility with exponential backoff
 * Provides configurable retry logic for resilient API calls
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  retryableErrors?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any, delay: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: any;
  attempts: number;
}

/**
 * Default retryable error checker
 * Retries on network errors and 5xx server errors, but not 4xx client errors
 */
function defaultRetryableErrors(error: any): boolean {
  // Network errors (no response)
  if (!error.response && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message?.includes('fetch failed'))) {
    return true;
  }
  
  // HTTP 5xx errors
  if (error.response?.status >= 500 && error.response?.status < 600) {
    return true;
  }
  
  // HTTP status from fetch Response object
  if (error.status >= 500 && error.status < 600) {
    return true;
  }
  
  // Don't retry 4xx client errors
  return false;
}

/**
 * Execute a function with exponential backoff retry logic
 * 
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns Promise with retry result including success status, data, and attempt count
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    retryableErrors = defaultRetryableErrors,
    onRetry
  } = options;

  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await fn();
      return {
        success: true,
        data,
        attempts: attempt + 1
      };
    } catch (error) {
      lastError = error;
      
      // Don't retry if we've exhausted attempts or error is not retryable
      if (attempt === maxRetries || !retryableErrors(error)) {
        console.error(`[Retry] Failed after ${attempt + 1} attempts (non-retryable or max retries reached):`, error);
        return {
          success: false,
          error,
          attempts: attempt + 1
        };
      }
      
      // Calculate exponential backoff delay with jitter
      const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      const jitter = Math.random() * 0.3 * exponentialDelay; // Add up to 30% jitter
      const delay = exponentialDelay + jitter;
      
      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${Math.round(delay)}ms:`, error.message || error);
      
      if (onRetry) {
        onRetry(attempt + 1, error, delay);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Should never reach here, but TypeScript needs it
  return {
    success: false,
    error: lastError,
    attempts: maxRetries + 1
  };
}

/**
 * Helper to create a retry wrapper for a specific function
 * Useful for creating pre-configured retry functions
 */
export function createRetryWrapper<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: RetryOptions = {}
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const result = await retry(() => fn(...args), options);
    if (!result.success) {
      throw result.error;
    }
    return result.data as R;
  };
}
