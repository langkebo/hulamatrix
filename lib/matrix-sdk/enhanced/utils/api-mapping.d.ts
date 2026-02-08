import type { BackendProfile } from "../constants/api.ts";
export interface ApiMappingConfig {
    paramMappings: Record<string, Record<string, string>>;
    pathMappings: Record<string, string>;
    synapseRustPathMappings: Record<string, string>;
    defaultPageSize: number;
    maxPageSize: number;
}
export declare const DEFAULT_API_MAPPING: ApiMappingConfig;
export declare function mapParams<T extends Record<string, unknown>>(params: T, module: keyof typeof DEFAULT_API_MAPPING.paramMappings): Record<string, string | number | boolean | null | undefined>;
export declare function mapPath(path: string, backendProfile?: BackendProfile): string;
/**
 * Map parameters based on the backend profile
 * For Synapse Rust, some parameter names are different
 */
export declare function mapParamsForProfile<T extends Record<string, unknown>>(params: T, module: keyof typeof DEFAULT_API_MAPPING.paramMappings, backendProfile?: BackendProfile): Record<string, string | number | boolean | null | undefined>;
export declare function sanitizeLimit(limit?: number): number | undefined;
export declare function formatPagination(page?: number, limit?: number): {
    page: number;
    page_size: number;
} | undefined;
export declare function parseCursor(cursor?: string): {
    cursor: string;
} | undefined;
//# sourceMappingURL=api-mapping.d.ts.map