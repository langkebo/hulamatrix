export declare enum InterceptorPhase {
    REQUEST = "request",
    RESPONSE = "response",
    ERROR = "error"
}
export interface RequestContext {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: unknown;
    queryParams?: Record<string, unknown>;
    timestamp: number;
    attempt: number;
}
export interface ResponseContext {
    url: string;
    method: string;
    status: number;
    data: unknown;
    headers: Record<string, string>;
    timestamp: number;
    duration: number;
    cached: boolean;
    retries: number;
}
export interface ErrorContext {
    error: Error;
    url: string;
    method: string;
    attempt: number;
    timestamp: number;
    willRetry: boolean;
}
export type RequestInterceptor = (context: RequestContext) => RequestContext | Promise<RequestContext> | null | undefined;
export type ResponseInterceptor = (context: ResponseContext) => ResponseContext | Promise<ResponseContext>;
export type ErrorInterceptor = (context: ErrorContext) => Error | Promise<Error> | null | undefined;
export interface Interceptor {
    id: string;
    name: string;
    phase: InterceptorPhase;
    priority: number;
    enabled: boolean;
}
export interface RequestInterceptorConfig extends Interceptor {
    handler: RequestInterceptor;
}
export interface ResponseInterceptorConfig extends Interceptor {
    handler: ResponseInterceptor;
}
export interface ErrorInterceptorConfig extends Interceptor {
    handler: ErrorInterceptor;
}
export declare class InterceptorRegistry {
    private requestInterceptors;
    private responseInterceptors;
    private errorInterceptors;
    private globalConfig;
    private sortedRequestChain?;
    private sortedResponseChain?;
    private sortedErrorChain?;
    constructor();
    addRequestInterceptor(id: string, handler: RequestInterceptor, priority?: number, name?: string): string;
    addResponseInterceptor(id: string, handler: ResponseInterceptor, priority?: number, name?: string): string;
    addErrorInterceptor(id: string, handler: ErrorInterceptor, priority?: number, name?: string): string;
    removeInterceptor(id: string): boolean;
    enableInterceptor(id: string): boolean;
    disableInterceptor(id: string): boolean;
    getInterceptors(phase?: InterceptorPhase): Interceptor[];
    clearInterceptors(phase?: InterceptorPhase): void;
    configureGlobal(config: Partial<typeof this.globalConfig>): void;
    private rebuildRequestChain;
    private rebuildResponseChain;
    private rebuildErrorChain;
    processRequest(context: RequestContext): Promise<RequestContext>;
    processResponse(context: ResponseContext): Promise<ResponseContext>;
    processError(context: ErrorContext): Promise<Error>;
}
export declare function createAuthInterceptor(accessTokenProvider: () => string | Promise<string>): RequestInterceptor;
export declare function createLoggingInterceptor(options?: {
    logRequests?: boolean;
    logResponses?: boolean;
    logErrors?: boolean;
    sanitizeHeaders?: string[];
}): {
    request: RequestInterceptor;
    response: ResponseInterceptor;
    error: ErrorInterceptor;
};
export declare function createRetryLoggingInterceptor(): ErrorInterceptor;
export declare function createResponseTransformInterceptor<T = unknown>(transform: (data: T, context: ResponseContext) => T): ResponseInterceptor;
export declare function createRequestTimeoutInterceptor(maxTimeout: number): RequestInterceptor;
export declare const defaultInterceptors: {
    createAuthInterceptor: typeof createAuthInterceptor;
    createLoggingInterceptor: typeof createLoggingInterceptor;
    createRetryLoggingInterceptor: typeof createRetryLoggingInterceptor;
    createResponseTransformInterceptor: typeof createResponseTransformInterceptor;
    createRequestTimeoutInterceptor: typeof createRequestTimeoutInterceptor;
};
//# sourceMappingURL=interceptors.d.ts.map