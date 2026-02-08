import { type SynapseEnhancedHttpClient } from "../utils/http.ts";
import type { IThreatDetection, IBlockedIp, IHighRiskIp, IReputationStats, ISecurityEvent, ISecurityEventParams, IIpStatus, ISecurityPolicy, ISecurityRule, ISecurityConfig } from "../models/types.ts";
import { BaseApi } from "../utils/base-api.ts";
/**
 * Security API - Security-related API endpoints
 * Provides threat detection, IP blocking, security policy management and other functions
 */
export declare class SecurityApi extends BaseApi {
    private readonly endpoint;
    /**
     * Create a SecurityApi instance
     * @param httpClient - HTTP client instance
     */
    constructor(httpClient: SynapseEnhancedHttpClient);
    /**
     * Get all security policies
     * @returns Security policy list
     */
    getPolicies(): Promise<ISecurityPolicy[]>;
    /**
     * Detect threats in content
     * @param content - Content to be checked
     * @param context - Optional context information
     * @returns Threat detection results
     */
    detectThreats(content: string, context?: Record<string, unknown>): Promise<IThreatDetection>;
    /**
     * Block IP address
     * @param params - Blocking parameters
     * @param params.ip_address - IP address to block
     * @param params.reason - Blocking reason, optional
     * @param params.duration_hours - Blocking duration in hours, optional
     * @param params.permanent - Whether to block permanently, optional
     * @returns Whether the operation was successful
     */
    blockIp(params: {
        ip_address: string;
        reason?: string;
        duration_hours?: number;
        permanent?: boolean;
    }): Promise<boolean>;
    /**
     * Unblock IP address
     * @param ipAddress - IP address to unblock
     * @returns Whether the operation was successful
     */
    unblockIp(ipAddress: string): Promise<boolean>;
    /**
     * Get IP address status
     * @param ipAddress - IP address to query
     * @returns IP status information (whether blocked, reputation score, etc.)
     */
    getIpStatus(ipAddress: string): Promise<IIpStatus>;
    /**
     * Get blocked IP list
     * @returns Blocked IP list
     */
    getBlockedIps(): Promise<IBlockedIp[]>;
    /**
     * Get high risk IP list
     * @param threshold - Risk score threshold, optional, defaults to all high risk IPs
     * @returns High risk IP list
     */
    getHighRiskIps(threshold?: number): Promise<IHighRiskIp[]>;
    /**
     * Get reputation statistics
     * @returns Reputation statistics information
     */
    getReputationStats(): Promise<IReputationStats>;
    /**
     * Get security event list
     * @param params - Optional query parameters (user ID, event type, severity, limit, etc.)
     * @returns Security event list
     */
    getSecurityEvents(params?: ISecurityEventParams): Promise<ISecurityEvent[]>;
    /**
     * Resolve (close) security event
     * @param eventId - Event ID
     * @returns Whether the operation was successful
     */
    resolveEvent(eventId: string): Promise<boolean>;
    /**
     * Create new security policy
     * @param params - Policy parameters
     * @param params.name - Policy name
     * @param params.description - Policy description, optional
     * @param params.rules - Policy rule list
     * @param params.enabled - Whether to enable, optional
     * @returns Created policy
     */
    createPolicy(params: {
        name: string;
        description?: string;
        rules: ISecurityRule[];
        enabled?: boolean;
    }): Promise<ISecurityPolicy>;
    /**
     * Update security policy
     * @param policyId - Policy ID
     * @param updates - Update content
     * @returns Updated policy
     */
    updatePolicy(policyId: string, updates: Partial<Omit<ISecurityPolicy, "id" | "created_at">>): Promise<ISecurityPolicy>;
    /**
     * Delete security policy
     * @param policyId - Policy ID
     * @returns Whether the operation was successful
     */
    deletePolicy(policyId: string): Promise<boolean>;
    /**
     * Set policy enabled status
     * @param policyId - Policy ID
     * @param enabled - Whether to enable
     * @returns Updated policy
     */
    setPolicyEnabled(policyId: string, enabled: boolean): Promise<ISecurityPolicy>;
    /**
     * Add rule to policy
     * @param policyId - Policy ID
     * @param rule - Rule to add
     * @returns Updated policy
     */
    addPolicyRule(policyId: string, rule: ISecurityRule): Promise<ISecurityPolicy>;
    /**
     * Remove rule from policy
     * @param policyId - Policy ID
     * @param ruleIndex - Rule index
     * @returns Updated policy
     */
    removePolicyRule(policyId: string, ruleIndex: number): Promise<ISecurityPolicy>;
    /**
     * Get security configuration
     * @returns Security configuration information
     */
    getConfig(): Promise<ISecurityConfig>;
    /**
     * Update security configuration
     * @param config - Configuration updates
     * @returns Updated security configuration
     */
    updateConfig(config: Partial<ISecurityConfig["settings"]>): Promise<ISecurityConfig>;
}
//# sourceMappingURL=security.d.ts.map