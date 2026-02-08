import { type SynapseEnhancedHttpClient } from "../utils/http.ts";
import { BaseApi } from "../utils/base-api.ts";
export interface IVoiceUserPreferences {
    default_format: string;
    default_quality: string;
    auto_convert: boolean;
    max_duration_seconds: number;
    silence_detection: boolean;
    noise_cancellation: boolean;
}
export interface IVoiceUserQuota {
    used_seconds: number;
    limit_seconds: number;
    reset_at: string;
    percentage_used: number;
    is_exhausted: boolean;
}
export interface IVoiceUserConfig {
    user_id: string;
    preferences: IVoiceUserPreferences;
    quota: IVoiceUserQuota;
    features: {
        recording_enabled: boolean;
        conversion_enabled: boolean;
        premium_features: string[];
    };
}
export interface IVoiceUserStats {
    total_recordings: number;
    total_duration_seconds: number;
    average_duration_seconds: number;
    storage_used_bytes: number;
    most_used_format: string;
    last_activity: string;
}
export interface IVoiceUserApi {
    getConfig(): Promise<IVoiceUserConfig>;
    getPreferences(): Promise<IVoiceUserPreferences>;
    updatePreferences(preferences: Partial<IVoiceUserPreferences>): Promise<IVoiceUserPreferences>;
    getQuota(): Promise<IVoiceUserQuota>;
    getStats(): Promise<IVoiceUserStats>;
}
export declare class VoiceUserApi extends BaseApi implements IVoiceUserApi {
    private readonly endpoint;
    constructor(httpClient: SynapseEnhancedHttpClient);
    /**
     * Get complete user voice configuration
     */
    getConfig(): Promise<IVoiceUserConfig>;
    /**
     * Get user voice preferences
     */
    getPreferences(): Promise<IVoiceUserPreferences>;
    /**
     * Update user voice preferences
     */
    updatePreferences(preferences: Partial<IVoiceUserPreferences>): Promise<IVoiceUserPreferences>;
    /**
     * Get user voice quota information
     */
    getQuota(): Promise<IVoiceUserQuota>;
    /**
     * Get user voice usage statistics
     */
    getStats(): Promise<IVoiceUserStats>;
    /**
     * Check if user has exceeded their voice quota
     */
    hasQuotaExceeded(): Promise<boolean>;
    /**
     * Get remaining quota in seconds
     */
    getRemainingQuota(): Promise<number>;
    /**
     * Get quota usage percentage
     */
    getQuotaPercentage(): Promise<number>;
    /**
     * Check if a specific preference is enabled
     */
    isPreferenceEnabled(preference: keyof Omit<IVoiceUserPreferences, "default_format" | "default_quality" | "max_duration_seconds">): Promise<boolean>;
    /**
     * Get formatted quota information
     */
    getFormattedQuota(): Promise<{
        used: string;
        limit: string;
        remaining: string;
        percentage: string;
    }>;
}
//# sourceMappingURL=voice-user.d.ts.map