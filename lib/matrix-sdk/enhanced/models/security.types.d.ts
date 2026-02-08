import type { IAdminUser, IAdminRoom, IAdminPaginationResult, ICreateAdminParams, IUpdateRoleParams, IRoomDetail, IRoomMessagesResponse, IRoomSearchCriteria, IRoomSearchResponse, IUserPermissionsResponse, ISystemStatistics, IHealthResponse, IDeleteResult, IBlacklistResponse, IAdminListResponse, IAdminProfile, IAuditLogResponse, IConfigResponse } from "./admin.types.ts";
import type { IUnreadCount } from "./friends.types.ts";
export interface IPrivateChatApi {
    getSessions(userId?: string): Promise<IPrivateSession[]>;
    createSession(params: ICreateSession): Promise<string>;
    closeSession(sessionId: string, userId?: string): Promise<boolean>;
    sendMessage(params: ISendMessage): Promise<string>;
    getMessages(sessionId: string, params?: IPaginationParams): Promise<IPrivateMessage[]>;
    getUnreadCount(): Promise<IUnreadCount>;
    markAsRead(sessionId: string, userId?: string): Promise<boolean>;
    getSessionDetail(sessionId: string): Promise<IPrivateSession | null>;
    searchMessages(params: ISearchMessagesParams): Promise<IPrivateMessage[]>;
    getSessionStatistics(sessionId: string): Promise<ISessionStatistics>;
    getChatroomDetail(roomId: string): Promise<IChatroomDetail | null>;
    leaveChatroom(roomId: string): Promise<boolean>;
    muteChatroom(roomId: string, mute: boolean): Promise<boolean>;
    deleteMessage(roomId: string, messageId: string): Promise<boolean>;
    getFiles(roomId: string): Promise<IChatroomFile[]>;
    getVoiceMessages(roomId: string): Promise<IVoiceMessageItem[]>;
}
export interface IChatroomDetail {
    room_id: string;
    name?: string;
    topic?: string;
    member_count: number;
    is_direct: boolean;
    is_encrypted: boolean;
    unread_count: number;
    created_at: string;
    state: "active" | "archived";
}
export interface IChatroomFile {
    file_id: string;
    file_name: string;
    file_url: string;
    file_size: number;
    mime_type: string;
    uploaded_by: string;
    uploaded_at: string;
}
export interface IVoiceMessageItem {
    message_id: string;
    file_url: string;
    duration: number;
    size: number;
    mime_type: string;
    waveform?: number[];
    sender_id: string;
    created_at: string;
}
export interface IPrivateSession {
    session_id: string;
    session_name?: string;
    creator_id: string;
    participants: string[];
    status: "active" | "deleted" | "closed";
    ttl_seconds: number;
    auto_delete: boolean;
    created_at: string;
    updated_at?: string;
    unread_count?: number;
}
export interface IPrivateMessage {
    message_id: string;
    session_id: string;
    sender_id: string;
    content: string;
    message_type: "text" | "image" | "file" | "audio" | "voice";
    created_at: string;
    expires_at?: string | null;
    read_by: string[];
}
export interface ISessionKey {
    session_id: string;
    user_id: string;
    device_id: string;
    encrypted_key: string;
    created_at: string;
}
export interface ICreateSession {
    creator_id: string;
    participants: string[];
    session_name?: string;
    ttl_seconds?: number;
    auto_delete?: boolean;
}
export interface ISendMessage {
    room_id: string;
    content: string;
    type?: string;
    file_url?: string;
    file_name?: string;
    file_size?: number;
    duration?: number;
    reply_to?: string;
}
export interface ISessionStatistics {
    messageCount: number;
    participantCount: number;
    lastActivity?: string;
}
export interface ISearchMessagesParams {
    userId: string;
    query: string;
    limit?: number;
    roomId?: string;
}
export interface IPaginationParams {
    limit?: number;
    cursor?: string;
    page?: number;
    offset?: number;
    before?: string;
    after?: string;
}
export interface IPaginationResult<T> {
    items: T[];
    pagination: {
        cursor?: string;
        has_more: boolean;
        has_before?: boolean;
        page?: number;
        total?: number;
    };
}
export interface IThreatDetection {
    threats: IThreatResult[];
    scan_id: string;
    scanned_at: string;
    status: string;
    safe?: boolean;
}
export interface IThreatResult {
    type: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    source?: string;
}
export interface IBlockedIp {
    ip: string;
    reason?: string;
    blocked_at: string;
    expires_at?: string;
}
export interface IHighRiskIp {
    ip: string;
    risk_score: number;
    risk_factors: string[];
    last_seen: string;
}
export interface IReputationStats {
    blocked_count?: number;
    allowed_count?: number;
    threat_count?: number;
    total_blocked?: number;
    active_blocked?: number;
    high_risk_count?: number;
    average_threat_score?: number;
}
export interface ISecurityEvent {
    event_type: string;
    user_id?: string;
    room_id?: string;
    ip?: string;
    timestamp: string;
    details?: Record<string, unknown>;
}
export interface ISecurityEventParams {
    event_type: string;
    user_id?: string;
    room_id?: string;
    ip?: string;
    details?: Record<string, unknown>;
    severity?: string;
    limit?: number;
    offset?: number;
}
export interface ISecurityRule {
    id: string;
    name: string;
    condition: Record<string, unknown>;
    action: string;
    enabled: boolean;
    priority: number;
}
export interface ISecurityPolicy {
    id: string;
    name: string;
    description: string;
    rules: ISecurityRule[];
    enabled: boolean;
    created_at: string;
    updated_at: string;
}
export interface ISecurityConfig {
    policy_id: string;
    name: string;
    settings: Record<string, unknown>;
}
export interface IIpStatus {
    ip: string;
    blocked: boolean;
    reputation_score: number;
    last_checked: string;
    threat_score?: number;
}
export interface ISecurityApi {
    detectThreats(content: string, context?: Record<string, unknown>): Promise<IThreatDetection>;
    blockIp(params: {
        ip_address: string;
        reason?: string;
        duration_hours?: number;
        permanent?: boolean;
    }): Promise<boolean>;
    unblockIp(ipAddress: string): Promise<boolean>;
    getIpStatus(ipAddress: string): Promise<IIpStatus>;
    getBlockedIps(): Promise<IBlockedIp[]>;
    getHighRiskIps(threshold?: number): Promise<IHighRiskIp[]>;
    getReputationStats(): Promise<IReputationStats>;
    getSecurityEvents(params?: ISecurityEventParams): Promise<ISecurityEvent[]>;
    resolveEvent(eventId: string): Promise<boolean>;
    getPolicies(): Promise<ISecurityPolicy[]>;
    createPolicy(params: {
        name: string;
        description?: string;
        rules?: ISecurityRule[];
        enabled?: boolean;
    }): Promise<ISecurityPolicy>;
    updatePolicy(policyId: string, updates: Partial<Omit<ISecurityPolicy, "id" | "created_at">>): Promise<ISecurityPolicy>;
    deletePolicy(policyId: string): Promise<boolean>;
    setPolicyEnabled(policyId: string, enabled: boolean): Promise<ISecurityPolicy>;
    addPolicyRule(policyId: string, rule: ISecurityRule): Promise<ISecurityPolicy>;
    removePolicyRule(policyId: string, ruleIndex: number): Promise<ISecurityPolicy>;
    getConfig(): Promise<ISecurityConfig>;
    updateConfig(config: Partial<ISecurityConfig["settings"]>): Promise<ISecurityConfig>;
}
export interface IAdminApi {
    getUsers(params?: {
        deactivated?: boolean;
        admin?: boolean;
        limit?: number;
        offset?: number;
        page?: number;
    }): Promise<IAdminPaginationResult<IAdminUser>>;
    getUserDetail(userId: string): Promise<IAdminUser | null>;
    createAdmin(params: ICreateAdminParams): Promise<{
        admin_id: string;
    }>;
    updateAdminRole(params: IUpdateRoleParams): Promise<boolean>;
    suspendUser(userId: string, reason?: string): Promise<IDeleteResult>;
    activateUser(userId: string): Promise<IDeleteResult>;
    getUserPermissions(userId: string): Promise<IUserPermissionsResponse>;
    getRooms(params?: {
        name?: string;
        limit?: number;
        page?: number;
    }): Promise<IAdminPaginationResult<IAdminRoom>>;
    getRoomDetail(roomId: string): Promise<IRoomDetail | null>;
    getRoomMessages(roomId: string, limit?: number): Promise<IRoomMessagesResponse>;
    deleteRoom(roomId: string, reason?: string): Promise<boolean>;
    searchRooms(criteria: IRoomSearchCriteria, params?: {
        limit?: number;
    }): Promise<IRoomSearchResponse>;
    getStatistics(): Promise<ISystemStatistics>;
    getHealth(): Promise<IHealthResponse>;
    getBlacklist(params?: {
        type?: string;
        page?: number;
        limit?: number;
    }): Promise<IBlacklistResponse>;
    addToBlacklist(params: {
        type: string;
        target: string;
        reason: string;
        duration_hours?: string;
    }): Promise<boolean>;
    removeFromBlacklist(params: {
        type: string;
        target: string;
        reason?: string;
    }): Promise<boolean>;
    getMessageList(roomId: string, params?: IPaginationParams): Promise<IRoomMessagesResponse>;
    deleteMessage(messageId: string, reason?: string): Promise<boolean>;
    searchMessages(query: string, params?: IPaginationParams): Promise<IRoomMessagesResponse>;
    getDashboardStats(): Promise<ISystemStatistics>;
    getAdminList(params?: IPaginationParams): Promise<IAdminListResponse>;
    getAdminProfile(): Promise<IAdminProfile>;
    deleteAdmin(adminId: string): Promise<boolean>;
    getAuditLogs(params?: IPaginationParams): Promise<IAuditLogResponse>;
    getSystemConfig(): Promise<IConfigResponse>;
    updateSystemConfig(config: Record<string, unknown>): Promise<IConfigResponse>;
}
//# sourceMappingURL=security.types.d.ts.map