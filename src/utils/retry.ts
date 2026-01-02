/** Retry options */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number
  /** Delay between retries in milliseconds */
  retryDelay?: number
}

/**
 * Execute a function with retry logic
 * @param fn - Async function to execute
 * @param opts - Retry options
 * @returns Promise that resolves with the function result or throws the last error
 */
export async function withRetry<T>(fn: () => Promise<T>, opts?: RetryOptions): Promise<T> {
  const max = opts?.maxRetries ?? 3
  const delay = opts?.retryDelay ?? 800
  let lastErr: unknown
  for (let i = 1; i <= max; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i < max) await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}
