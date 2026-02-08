import { SynapseEnhancedError } from "./http.ts";
import { ErrorCode } from "./error-codes.ts";
export declare enum ErrorAction {
    RETRY = "retry",
    REFRESH_TOKEN = "refresh_token",
    WAIT_RETRY = "wait_retry",
    REJECT = "reject",
    NOTIFY = "notify"
}
export interface ErrorHandlingStrategy {
    action: ErrorAction;
    retryAfter?: number;
    message?: string;
}
export interface ErrorContext {
    endpoint: string;
    method: string;
    attemptNumber: number;
    timestamp: number;
    userContext?: Record<string, unknown>;
}
export interface ErrorHandlerConfig {
    maxRetries?: number;
    tokenRefreshEnabled?: boolean;
    defaultWaitTime?: number;
    enableMetrics?: boolean;
}
export declare class ErrorHandler {
    private static readonly ERROR_STRATEGIES;
    private static readonly ERROR_COUNT;
    private static readonly LAST_ERROR_TIME;
    static handleError(error: SynapseEnhancedError, context: ErrorContext, config?: ErrorHandlerConfig): ErrorHandlingStrategy;
    static getStrategy(errorCode: ErrorCode): ErrorHandlingStrategy;
    static registerStrategy(errorCode: ErrorCode, strategy: ErrorHandlingStrategy): void;
    static shouldRetry(error: SynapseEnhancedError): boolean;
    static executeWithRetry<T>(fn: () => Promise<T>, context: Omit<ErrorContext, "attemptNumber" | "timestamp">, config?: ErrorHandlerConfig): Promise<T>;
    static resetErrorCount(endpoint: string, method: string): void;
    static resetAllErrorCounts(): void;
    static getErrorStats(): Map<string, {
        count: number;
        lastError: number | undefined;
    }>;
    private static calculateBackoff;
    private static sleep;
    static createUserError(message: string, code?: ErrorCode): SynapseEnhancedError;
    static createServerError(message: string): SynapseEnhancedError;
    static createNetworkError(originalError?: Error): SynapseEnhancedError;
    static wrapError(error: unknown, context?: string): SynapseEnhancedError;
}
//# sourceMappingURL=error-handler.d.ts.map