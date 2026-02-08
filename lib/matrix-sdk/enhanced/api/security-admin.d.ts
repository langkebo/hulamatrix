import { type SynapseEnhancedHttpClient } from "../utils/http.ts";
import { BaseApi } from "../utils/base-api.ts";
export interface ISecurityEvent {
    event_id: string;
    event_type: string;
    severity: "low" | "medium" | "high" | "critical";
    user_id?: string;
    room_id?: string;
    description: string;
    metadata?: Record<string, unknown>;
    created_at: string;
    resolved_at?: string;
    resolved_by?: string;
}
export interface ISecurityEventParams {
    user_id?: string;
    event_type?: string;
    severity?: string;
    limit?: number;
    offset?: number;
    resolved?: boolean;
}
export interface ISecurityStats {
    total_events: number;
    events_by_severity: {
        low: number;
        medium: number;
        high: number;
        critical: number;
    };
    events_by_type: Record<string, number>;
    recent_events_count: number;
    resolved_events_count: number;
    unresolved_events_count: number;
    average_resolution_time_hours?: number;
    top_event_types: {
        type: string;
        count: number;
    }[];
    events_trend: {
        date: string;
        count: number;
    }[];
}
export interface ISecurityAdminApi {
    getEvents(params?: ISecurityEventParams): Promise<ISecurityEvent[]>;
    getEvent(eventId: string): Promise<ISecurityEvent | null>;
    resolveEvent(eventId: string, resolution: string): Promise<boolean>;
    getStats(): Promise<ISecurityStats>;
    getEventsByUser(userId: string, limit?: number): Promise<ISecurityEvent[]>;
    getEventsByRoom(roomId: string, limit?: number): Promise<ISecurityEvent[]>;
    getUnresolvedEvents(limit?: number): Promise<ISecurityEvent[]>;
    getEventsBySeverity(severity: string, limit?: number): Promise<ISecurityEvent[]>;
}
export declare class SecurityAdminApi extends BaseApi implements ISecurityAdminApi {
    constructor(httpClient: SynapseEnhancedHttpClient);
    /**
     * Get security events with optional filtering
     */
    getEvents(params?: ISecurityEventParams): Promise<ISecurityEvent[]>;
    /**
     * Get a specific security event by ID
     */
    getEvent(eventId: string): Promise<ISecurityEvent | null>;
    /**
     * Resolve a security event
     */
    resolveEvent(eventId: string, resolution: string): Promise<boolean>;
    /**
     * Get security statistics
     */
    getStats(): Promise<ISecurityStats>;
    /**
     * Get events for a specific user
     */
    getEventsByUser(userId: string, limit?: number): Promise<ISecurityEvent[]>;
    /**
     * Get events for a specific room
     */
    getEventsByRoom(roomId: string, limit?: number): Promise<ISecurityEvent[]>;
    /**
     * Get all unresolved events
     */
    getUnresolvedEvents(limit?: number): Promise<ISecurityEvent[]>;
    /**
     * Get events by severity level
     */
    getEventsBySeverity(severity: "low" | "medium" | "high" | "critical", limit?: number): Promise<ISecurityEvent[]>;
    /**
     * Get critical events that need immediate attention
     */
    getCriticalEvents(limit?: number): Promise<ISecurityEvent[]>;
    /**
     * Get event count by type
     */
    getEventCountByType(): Promise<Record<string, number>>;
    /**
     * Check if there are any unresolved critical events
     */
    hasCriticalEvents(): Promise<boolean>;
}
//# sourceMappingURL=security-admin.d.ts.map