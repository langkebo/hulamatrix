import { type SynapseEnhancedHttpClient } from "../utils/http.ts";
export interface IDbConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password?: string;
}
export interface IInitializationParams {
    init_key: string;
    db_config?: IDbConfig;
    features?: {
        friend_system?: boolean;
        private_chat?: boolean;
        voice_messages?: boolean;
        security_control?: boolean;
    };
}
export interface IInitializationResult {
    success: boolean;
    message: string;
    initialized_at?: string;
    features_enabled?: Record<string, boolean>;
}
export interface IModuleStatus {
    initialized: boolean;
    version: string;
    features: Record<string, boolean>;
    database: {
        connected: boolean;
        pool_size?: number;
        active_connections?: number;
    };
    uptime_seconds: number;
}
export interface IEnhancedInitApi {
    initialize(params: IInitializationParams): Promise<IInitializationResult>;
    getStatus(): Promise<IModuleStatus>;
    checkHealth(): Promise<boolean>;
    getConfig(): Promise<Record<string, unknown>>;
    reinitialize(params: IInitializationParams): Promise<IInitializationResult>;
}
export declare class EnhancedInitApi implements IEnhancedInitApi {
    private httpClient;
    private readonly baseUrl;
    constructor(httpClient: SynapseEnhancedHttpClient);
    /**
     * Initialize the enhanced module
     */
    initialize(params: IInitializationParams): Promise<IInitializationResult>;
    /**
     * Get module status
     */
    getStatus(): Promise<IModuleStatus>;
    /**
     * Check module health
     */
    checkHealth(): Promise<boolean>;
    /**
     * Get module configuration
     */
    getConfig(): Promise<Record<string, unknown>>;
    /**
     * Reinitialize the module (useful after configuration changes)
     */
    reinitialize(params: IInitializationParams): Promise<IInitializationResult>;
    /**
     * Check if module is already initialized
     */
    isInitialized(): Promise<boolean>;
    /**
     * Get module version
     */
    getVersion(): Promise<string>;
    /**
     * Get enabled features
     */
    getEnabledFeatures(): Promise<Record<string, boolean>>;
    /**
     * Check if a specific feature is enabled
     */
    isFeatureEnabled(feature: string): Promise<boolean>;
    /**
     * Get database connection status
     */
    getDatabaseStatus(): Promise<{
        connected: boolean;
        pool_size?: number;
        active_connections?: number;
    }>;
    /**
     * Get module uptime in seconds
     */
    getUptime(): Promise<number>;
}
//# sourceMappingURL=enhanced.d.ts.map