import { type SynapseEnhancedHttpClient } from "./http.ts";
import { ErrorCode } from "./error-codes.ts";
export declare abstract class BaseApi {
    protected readonly httpClient: SynapseEnhancedHttpClient;
    constructor(httpClient: SynapseEnhancedHttpClient);
    protected get<T>(endpoint: string, params?: unknown, errorMessage?: string): Promise<T>;
    protected post<T>(endpoint: string, body?: unknown, errorMessage?: string): Promise<T>;
    protected put<T>(endpoint: string, body?: unknown, errorMessage?: string): Promise<T>;
    protected deleteRequest<T>(endpoint: string, params?: unknown, errorMessage?: string): Promise<T>;
    protected patch<T>(endpoint: string, body?: unknown, errorMessage?: string): Promise<T>;
    protected handleResponse<T>(response: {
        data?: T;
        status: number;
    }, errorMessage: string): T;
    protected createError(message: string, code: ErrorCode, detail?: Record<string, unknown>, statusCode?: number): never;
    protected throwRateLimitError(retryAfterSeconds: number): never;
    protected withRetry<T>(operation: () => Promise<T>, maxRetries?: number, delay?: number): Promise<T>;
}
//# sourceMappingURL=base-api.d.ts.map