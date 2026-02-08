import { type RequestResult } from "./http.ts";
export interface ApiResponse<T> {
    status: string;
    data?: T;
    error?: string;
    details?: Record<string, unknown>;
}
/**
 * Enhanced response handler that supports both wrapped and bare response formats
 *
 * Wrapped format (standard): { status: "ok", data: {...} }
 * Bare format (Synapse Rust): { items: [...] } or { result: ... } or just the data directly
 *
 * @param response - The HTTP response
 * @param defaultError - Default error message if response.error is missing
 * @param allowBareResponse - Whether to accept bare responses (no status field). Default: auto-detect based on backend profile
 */
export declare function handleApiResponse<T>(response: RequestResult<{
    status?: string | number;
    data?: T;
    error?: string;
} & Record<string, unknown>>, defaultError?: string, allowBareResponse?: boolean): T;
export interface PaginatedResponse<T> {
    items: T[];
    pagination: {
        page: number;
        page_size: number;
        total: number;
        has_more: boolean;
    };
}
export interface RawBackendResponse {
    status: string;
    success?: boolean;
    data?: unknown;
    result?: unknown;
    items?: unknown[];
    error?: string;
    details?: Record<string, unknown>;
    pagination?: {
        page?: number;
        page_size?: number;
        total?: number;
        has_more?: boolean;
        cursor?: string;
    };
}
export declare function formatApiResponse<T>(response: RawBackendResponse): ApiResponse<T>;
export declare function formatPaginatedResponse<T>(response: RawBackendResponse, page: number, pageSize: number): PaginatedResponse<T>;
export declare function isSuccessStatus(status: string): boolean;
export declare function getErrorMessage(error: string | undefined, defaultMessage: string): string;
export declare function extractDataFromResponse<T>(response: RawBackendResponse): T | null;
export declare function convertBooleanValue(value: unknown): boolean;
export declare function convertNumberValue(value: unknown, defaultValue?: number): number;
export declare function convertDateValue(value: unknown): Date;
export declare function normalizePaginationParams(page?: number, limit?: number): {
    page: number;
    page_size: number;
};
export declare function parsePaginationFromResponse(response: RawBackendResponse): {
    page?: number;
    page_size?: number;
    total?: number;
    cursor?: string;
    has_more?: boolean;
};
export interface BackendDataResponse<T> {
    status: string | number;
    data?: {
        items?: T[];
        total?: number;
        page?: number;
        limit?: number;
    };
    error?: string;
}
export declare function extractItemsFromDataResponse<T>(response: RequestResult<BackendDataResponse<T>>, fallbackItems?: T[]): {
    items: T[];
    total: number;
    page: number;
    limit: number;
};
export declare function formatBackendDataResponse<T>(response: BackendDataResponse<T>, dataField: "friends" | "requests" | "users" | "rooms" | "messages" | "categories" | "blocked_users" | "sessions" | "logs" | "events" | "admins"): {
    status: string;
    [key: string]: unknown;
};
//# sourceMappingURL=response-formatter.d.ts.map