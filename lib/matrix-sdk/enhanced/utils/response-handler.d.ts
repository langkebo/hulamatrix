/**
 * Generic API response structure from the Synapse enhanced API.
 * @typeParam T - The type of the data payload
 */
export interface ApiResponse<T = Record<string, unknown>> {
    /** Response status (e.g., "ok", "200") */
    status: string;
    /** Response data payload */
    data?: T;
    /** Error message if the request failed */
    error?: string;
}
/**
 * Result of a request operation containing the response data and HTTP status.
 * @typeParam T - The type of the response data
 */
export interface RequestResult<T = unknown> {
    /** The response data from the API */
    data: T;
    /** HTTP status code of the response */
    status: number;
}
/**
 * Extracts and validates the response data from an API result.
 * Throws a SynapseEnhancedError if the response status indicates failure.
 * @typeParam T - The expected type of the response data
 * @param result - The request result containing the API response
 * @param responseField - Optional field name to extract from nested data
 * @returns The extracted response data of type T
 * @throws SynapseEnhancedError if the response status is not "ok" or "200" or if data is missing
 * @example
 * ```typescript
 * const result = await httpClient.get("/api/users");
 * const userData = extractResponse<IUserData>(result);
 * ```
 */
export declare function extractResponse<T>(result: RequestResult<ApiResponse<Record<string, unknown>>>, responseField?: string): T;
/**
 * Extracts a list of items from an API response.
 * Throws a SynapseEnhancedError if the response status indicates failure.
 * @typeParam T - The type of items in the list
 * @param result - The request result containing the API response
 * @param itemsField - The field name containing the items array (default: "items")
 * @returns An array of extracted items, or empty array if items field is missing
 * @throws SynapseEnhancedError if the response status is not "ok" or "200"
 * @example
 * ```typescript
 * const result = await httpClient.get("/api/users");
 * const users = extractListResponse<IUser>(result);
 * ```
 */
export declare function extractListResponse<T>(result: RequestResult<ApiResponse<Record<string, unknown>>>, itemsField?: string): T[];
/**
 * Generic paginated response structure containing items and pagination metadata.
 * @typeParam T - The type of items in the paginated response
 */
export interface PaginatedResponse<T> {
    /** Array of items for the current page */
    items: T[];
    /** Pagination metadata */
    pagination: {
        /** Whether there are more items available */
        has_more?: boolean;
        /** Cursor for fetching the next page (for cursor-based pagination) */
        cursor?: string;
        /** Current page number (for offset-based pagination) */
        page?: number;
        /** Total number of items across all pages */
        total?: number;
        /** Additional pagination metadata */
        [key: string]: unknown;
    };
}
/**
 * Extracts a paginated response from an API result.
 * Throws a SynapseEnhancedError if the response status indicates failure.
 * @typeParam T - The type of items in the paginated response
 * @param result - The request result containing the API response
 * @param itemsField - The field name containing the items array (default: "items")
 * @returns A PaginatedResponse object containing items and pagination info
 * @throws SynapseEnhancedError if the response status is not "ok" or "200"
 * @example
 * ```typescript
 * const result = await httpClient.get("/api/users", { limit: 10 });
 * const users = extractPaginatedResponse<IUser>(result);
 * console.log(users.items.length); // Number of users in current page
 * console.log(users.pagination.has_more); // Whether more pages exist
 * ```
 */
export declare function extractPaginatedResponse<T>(result: RequestResult<ApiResponse<Record<string, unknown>>>, itemsField?: string): PaginatedResponse<T>;
//# sourceMappingURL=response-handler.d.ts.map