export interface IAdminUser {
    user_id: string;
    display_name?: string;
    email?: string;
    avatar_url?: string;
    admin: boolean;
    deactivated: boolean;
    creation_ts: number;
    created_at?: string;
    is_admin?: boolean;
    friend_count?: number;
    role?: string;
    session_count?: number;
    last_active?: string;
}
export interface IAdminRoom {
    room_id: string;
    name?: string;
    creator: string;
    creator_id?: string;
    version: string;
    federatable: boolean;
    public: boolean;
    join_rules: string;
    guest_access: string;
    history_visibility?: string;
    creation_ts: number;
    member_count?: number;
    created_at?: string;
    state?: string | Record<string, unknown>;
}
export interface ISystemStatistics {
    total_users: number;
    active_users: number;
    total_rooms: number;
    total_messages: number;
    memory_usage: number;
    database_size: number;
    total_friendships?: number;
    total_sessions?: number;
    storage_used?: number | string;
}
export interface IAdminParams {
    user_id?: string;
    deactivated?: boolean;
    admin?: boolean;
    limit?: number;
    offset?: number;
    page?: number;
    search?: string;
    state?: string;
}
export interface IAdminPaginationResult<T> {
    items: T[];
    total?: number;
    offset?: number;
    limit?: number;
    pagination?: {
        page?: number;
        total_pages?: number;
        has_next?: boolean;
        has_before?: boolean;
    };
}
export interface ISystemHealth {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
    network_rx: number;
    network_tx: number;
    database?: {
        connections: number;
        size: number;
        status?: string;
        latency_ms?: number;
    };
}
export interface IHealthResponse {
    status: string;
    version: string;
    uptime: number;
    uptime_seconds?: number;
    health: ISystemHealth;
}
export interface IAdminProfile {
    id?: string;
    user_id: string;
    username?: string;
    displayname?: string;
    email?: string;
    avatar_url?: string;
    admin: boolean;
    deactivated: boolean;
    creation_ts: number;
    role?: string;
    status?: string;
    created_at?: string;
}
export interface IAuditLog {
    user_id?: string;
    action: string;
    timestamp: string;
    ip_address?: string;
    user_agent?: string;
    details?: Record<string, unknown>;
}
export interface IRoomDetail {
    room_id: string;
    name?: string;
    topic?: string;
    creator: string;
    version: string;
    federatable: boolean;
    public: boolean;
    join_rules: string;
    guest_access: string;
    history_visibility: string;
    creation_ts: number;
    state_events: number;
    is_encrypted?: boolean;
}
export interface IRoomMessage {
    event_id?: string;
    message_id?: string;
    type: string;
    sender?: string;
    sender_id?: string;
    room_id?: string;
    content: string | Record<string, unknown>;
    origin_server_ts?: number;
    created_at?: string;
    message_type?: string;
}
export interface IAdminListResponse {
    items?: IAdminUser[];
    users?: IAdminUser[];
    rooms?: IAdminRoom[];
    admins?: IAdminUser[];
    total: number;
    pagination?: {
        page: number;
        limit: number;
        total_pages: number;
        has_next?: boolean;
        has_before?: boolean;
    };
}
export interface IAuditLogResponse {
    audit_log?: IAuditLog[];
    logs?: IAuditLog[];
    total?: number;
    pagination?: {
        page: number;
        limit: number;
        total_pages: number;
    };
}
export interface IDeleteResult {
    success: boolean;
    deleted_at?: string;
}
export interface IAdminStatistics {
    total_users: number;
    active_users_24h: number;
    total_rooms: number;
    total_messages_24h: number;
}
export interface IConfigResponse {
    config: Record<string, unknown>;
    updated_at?: string;
}
export interface IConfigExport {
    export_id: string;
    format: string;
    size: number;
    created_at: string;
    download_url?: string;
    version?: string;
    exported_at?: string;
}
export interface IConfigVersionsResponse {
    versions: Array<{
        version_id: string;
        config: Record<string, unknown>;
        created_at: string;
        created_by?: string;
    }>;
    total: number;
    current_version?: string;
}
export interface IAdminActivityResponse {
    activities: Array<{
        activity_id: string;
        admin_id: string;
        action: string;
        target_user_id?: string;
        target_room_id?: string;
        details?: Record<string, unknown>;
        created_at: string;
    }>;
    pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
    };
}
export interface ICreateAdminParams {
    user_id: string;
    username?: string;
    email?: string;
    password?: string;
    role?: string;
}
export interface IUpdateRoleParams {
    user_id?: string;
    admin_id: string;
    admin: boolean;
    new_role?: string;
}
export interface IRoomMessagesResponse {
    messages: IRoomMessage[];
    pagination: {
        page: number;
        page_size: number;
        total: number;
        total_pages: number;
    };
}
export interface IBatchUserOperation {
    user_id: string;
    action: "suspend" | "activate" | "delete";
    reason?: string;
}
export interface IBatchUserResult {
    user_id: string;
    success: boolean;
    error?: string;
}
export interface IBatchUserResponse {
    status: string;
    results: IBatchUserResult[];
    total_success: number;
    total_failed: number;
}
export interface IBatchRoomOperation {
    room_id: string;
    action: "delete" | "archive" | "make_public" | "make_private";
    reason?: string;
}
export interface IBatchRoomResult {
    room_id: string;
    success: boolean;
    error?: string;
}
export interface IBatchRoomResponse {
    status: string;
    results: IBatchRoomResult[];
    total_success: number;
    total_failed: number;
}
export interface IBatchDeleteParams {
    criteria: {
        user_id?: string;
        room_id?: string;
        before?: string;
        limit?: number;
    };
    reason?: string;
}
export interface IBatchDeleteResult {
    deleted_count: number;
    deleted_ids: string[];
    failed_ids: string[];
}
export interface IBatchDeleteResponse {
    status: string;
    data: IBatchDeleteResult;
}
export interface IUserPermission {
    permission: string;
    description: string;
    granted: boolean;
}
export interface IUserPermissionsResponse {
    user_id: string;
    permissions: IUserPermission[];
}
export interface IRoomSearchCriteria {
    name?: string;
    topic?: string;
    creator?: string;
    is_public?: boolean;
    is_federated?: boolean;
    state?: string | Record<string, unknown>;
}
export interface IRoomSearchResponse {
    rooms: IRoomDetail[];
    total: number;
    pagination: {
        page: number;
        limit: number;
    };
}
export interface IMessageModerationParams {
    room_id?: string;
    event_ids?: string[];
    message_ids?: string[];
    action: "redact" | "delete" | "warn";
    reason?: string;
}
export interface IMessageModerationResult {
    event_id: string;
    success: boolean;
    error?: string;
}
export interface IMessageModerationResponse {
    status: string;
    results: IMessageModerationResult[];
    total_success: number;
    total_failed: number;
    total_processed?: number;
}
export interface IBlacklistItem {
    id: string;
    type: "user" | "room" | "server" | "ip";
    target: string;
    reason?: string;
    created_at: string;
    expires_at?: string;
    created_by: string;
}
export interface IBlacklistPagination {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}
export interface IBlacklistResponse {
    blacklist: IBlacklistItem[];
    pagination: IBlacklistPagination;
}
//# sourceMappingURL=admin.types.d.ts.map