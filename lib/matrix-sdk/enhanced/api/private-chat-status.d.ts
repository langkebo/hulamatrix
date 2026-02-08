import { type SynapseEnhancedHttpClient } from "../utils/http.ts";
export interface IPrivateChatFeatures {
    sessions: {
        available: boolean;
        max_participants?: number;
        max_duration_hours?: number;
    };
    messages: {
        available: boolean;
        max_length?: number;
        types?: string[];
        retention_days?: number;
    };
    encryption: {
        available: boolean;
        algorithm?: string;
        required: boolean;
    };
    ttl: {
        available: boolean;
        max_hours?: number;
        default_hours?: number;
    };
}
export interface IPrivateChatCapabilities {
    max_sessions_per_user: number;
    max_participants_per_session: number;
    max_message_length: number;
    supported_message_types: string[];
    encryption_required: boolean;
    retention_enabled: boolean;
    default_retention_days: number;
    features: string[];
}
export interface IPrivateChatStatusApi {
    getStatus(): Promise<IPrivateChatFeatures>;
    getCapabilities(): Promise<IPrivateChatCapabilities>;
    checkAvailability(): Promise<boolean>;
}
export declare class PrivateChatStatusApi implements IPrivateChatStatusApi {
    private httpClient;
    private readonly baseUrl;
    constructor(httpClient: SynapseEnhancedHttpClient);
    /**
     * Get private chat features status
     */
    getStatus(): Promise<IPrivateChatFeatures>;
    /**
     * Get private chat capabilities
     */
    getCapabilities(): Promise<IPrivateChatCapabilities>;
    /**
     * Check if private chat feature is available
     */
    checkAvailability(): Promise<boolean>;
    /**
     * Check if encryption is required for private chats
     */
    isEncryptionRequired(): Promise<boolean>;
    /**
     * Get maximum message length allowed
     */
    getMaxMessageLength(): Promise<number>;
    /**
     * Get supported message types
     */
    getSupportedMessageTypes(): Promise<string[]>;
    /**
     * Check if a specific feature is enabled
     */
    isFeatureEnabled(feature: "encryption" | "retention" | "ttl"): Promise<boolean>;
    /**
     * Get configuration summary
     */
    getConfigSummary(): Promise<{
        encryption: boolean;
        retention_days: number;
        max_participants: number;
        max_sessions: number;
    }>;
}
//# sourceMappingURL=private-chat-status.d.ts.map