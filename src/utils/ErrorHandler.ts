export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const safeJsonParse = <T = unknown>(jsonString: string, fallback?: T, errorContext?: string): T | null => {
  try {
    return JSON.parse(jsonString) as T
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(
        `[SafeJsonParse] Failed to parse JSON${errorContext ? ` in ${errorContext}` : ''}:`,
        jsonString.substring(0, 100),
        error
      )
    }
    return fallback ?? null
  }
}

export const withErrorHandler = <T>(fn: () => T, errorMessage: string, fallback?: T): T => {
  try {
    return fn()
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(`[ErrorHandler] ${errorMessage}:`, error)
    }
    return fallback as T
  }
}

export const asyncWithErrorHandler = async <T>(
  fn: () => Promise<T>,
  errorMessage: string,
  fallback?: T
): Promise<T> => {
  try {
    return await fn()
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(`[ErrorHandler] ${errorMessage}:`, error)
    }
    return (fallback ?? null) as T
  }
}

export const createErrorHandler = (context: string) => {
  return {
    handle: <T>(fn: () => T, errorMessage: string, fallback?: T): T =>
      withErrorHandler(fn, `${context}: ${errorMessage}`, fallback),
    handleAsync: <T>(fn: () => Promise<T>, errorMessage: string, fallback?: T): Promise<T> =>
      asyncWithErrorHandler(fn, `${context}: ${errorMessage}`, fallback)
  }
}

export const logError = (message: string, error: unknown, context?: Record<string, unknown>): void => {
  if (import.meta.env.DEV) {
    console.error(`[Error] ${message}`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context
    })
  }
}
