export declare const DEFAULT_PAGE_SIZE = 20;
export declare const MAX_PAGE_SIZE = 100;
export declare const DEFAULT_PAGE = 1;
export interface PaginationParams {
    limit?: number;
    cursor?: string;
}
export type IPaginationParams = PaginationParams;
export interface OffsetPaginationParams {
    limit?: number;
    offset?: number;
    page?: number;
}
export interface PaginatedResult<T> {
    items: T[];
    pagination: {
        page: number;
        page_size: number;
        total: number;
        total_pages: number;
        has_next?: boolean;
        next_cursor?: string;
    };
}
export interface CursorPaginatedResult<T> {
    items: T[];
    pagination: {
        has_next: boolean;
        next_cursor?: string;
        total?: number;
    };
}
export declare function validatePagination(params?: PaginationParams): PaginationParams;
export declare function validateOffsetPagination(params?: OffsetPaginationParams): OffsetPaginationParams;
export declare function buildPaginationQuery(params?: PaginationParams): Record<string, string>;
export declare function buildOffsetPaginationQuery(params?: OffsetPaginationParams): Record<string, string>;
export declare function createPaginatedResult<T>(items: T[], page: number, pageSize: number, total: number): PaginatedResult<T>;
export declare function createCursorPaginatedResult<T>(items: T[], hasNext: boolean, nextCursor?: string, total?: number): CursorPaginatedResult<T>;
export declare function calculateOffset(page: number, pageSize: number): number;
//# sourceMappingURL=pagination.d.ts.map