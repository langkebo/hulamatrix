/**
 * Federation API types for Matrix federation endpoints.
 * @see https://spec.matrix.org/v1.11/server-server-api/
 */
/**
 * Server key response.
 */
export interface ServerKeyResponse {
    server_name: string;
    verify_keys: Record<string, KeyInfo>;
    old_verify_keys: Record<string, OldKeyInfo>;
    signatures: Record<string, Record<string, string>>;
    valid_until_ts: number;
}
/**
 * Key information.
 */
export interface KeyInfo {
    key: string;
}
/**
 * Old key information with expiration.
 */
export interface OldKeyInfo extends KeyInfo {
    expired_ts: number;
}
/**
 * Federation version response.
 */
export interface FederationVersionResponse {
    server?: {
        name: string;
        version: string;
    };
}
/**
 * Public rooms response.
 */
export interface PublicRoomsResponse {
    chunk: Array<{
        room_id: string;
        name?: string;
        topic?: string;
        num_joined_members: number;
        world_readable: boolean;
        guest_can_join: boolean;
        avatar_url?: string;
    }>;
    next_batch?: string;
    prev_batch?: string;
    total_room_count_estimate?: number;
}
/**
 * Make join response.
 */
export interface MakeJoinResponse {
    room_id: string;
    event: PduEvent;
    invited?: boolean;
    raw_event?: Record<string, unknown>;
}
/**
 * Send join response.
 */
export interface SendJoinResponse {
    room_id: string;
    origin: string;
    auth_chain: PduEvent[];
    state: Array<{
        type: string;
        state_key: string;
        content: Record<string, unknown>;
        sender: string;
        room_id: string;
    }>;
    event?: PduEvent;
    members_omitted?: boolean;
}
/**
 * PDU (Push Down Update) Event format.
 */
export interface PduEvent {
    room_id: string;
    sender: string;
    event_id: string;
    type: string;
    state_key?: string;
    content: Record<string, unknown>;
    origin_server_ts: number;
    depth?: number;
    prev_events?: Array<{
        event_id: string;
        hashes: {
            sha256: string;
        };
    }>;
    auth_events?: Array<{
        event_id: string;
        hashes: {
            sha256: string;
        };
    }>;
    redacts?: string;
    unsigned?: Record<string, unknown>;
}
/**
 * Missing events request.
 */
export interface MissingEventsRequest {
    room_id: string;
    limit: number;
    min_depth?: number;
    earliest_events: string[];
    latest_events: string[];
}
/**
 * Missing events response.
 */
export interface MissingEventsResponse {
    events: PduEvent[];
    chunk?: PduEvent[];
}
/**
 * Event auth response.
 */
export interface EventAuthResponse {
    auth_chain: PduEvent[];
    auth_events: Record<string, PduEvent>;
    rejected?: string[];
}
/**
 * Room state response.
 */
export interface RoomStateResponse {
    auth_chain: PduEvent[];
    state: PduEvent[];
    room_id: string;
}
/**
 * Room state IDs response.
 */
export interface RoomStateIdsResponse {
    auth_chain_ids: string[];
    state_ids: string[];
    room_id: string;
}
/**
 * Backfill request.
 */
export interface BackfillRequest {
    room_id: string;
    v: string[];
    limit: number;
}
/**
 * Transaction response.
 */
export interface TransactionResponse {
    pdus: PduEvent[];
    origin: string;
    prev_txid?: string;
}
/**
 * Directory room lookup response.
 */
export interface DirectoryRoomLookupResponse {
    room_id: string;
    servers: string[];
}
/**
 * Profile lookup response.
 */
export interface ProfileLookupResponse {
    displayname?: string;
    avatar_url?: string;
}
/**
 * Key claim request.
 */
export interface KeyClaimRequest {
    one_time_keys: Record<string, Record<string, string>>;
}
/**
 * Key claim response.
 */
export interface KeyClaimResponse {
    one_time_keys: Record<string, Record<string, {
        signed_curve25519?: string;
        signed_ed25519?: string;
    }>>;
    failures?: Record<string, Record<string, unknown>>;
}
/**
 * Key upload response.
 */
export interface KeyUploadResponse {
}
/**
 * User keys query request.
 */
export interface UserKeysQueryRequest {
    device_keys: Record<string, string[] | undefined>;
    timeout?: number;
}
/**
 * User keys query response.
 */
export interface UserKeysQueryResponse {
    device_keys: Record<string, Record<string, {
        algorithms: string[];
        device_id: string;
        keys: Record<string, string>;
        signatures: Record<string, Record<string, string>>;
        user_id: string;
    }>>;
    failures?: Record<string, Record<string, unknown>>;
    master_keys?: Record<string, {
        user_id: string;
        usage: string[];
        keys: Record<string, string>;
        signatures: Record<string, Record<string, string>>;
    }>;
    self_signing_keys?: Record<string, unknown>;
}
/**
 * Federation members response.
 */
export interface FederationMembersResponse {
    chunk: Array<{
        room_id: string;
        user_id: string;
        sender: string;
        type: string;
        state_key: string;
        content: Record<string, unknown>;
        origin_server_ts: number;
    }>;
}
/**
 * Room members response.
 */
export interface RoomMembersResponse {
    members: Array<{
        user_id: string;
        display_name?: string;
        avatar_url?: string;
    }>;
    chunk?: PduEvent[];
}
/**
 * User devices response.
 */
export interface UserDevicesResponse {
    user_id: string;
    stream_id?: number;
    devices: Record<string, {
        device_id: string;
        display_name?: string;
        last_seen_ts?: number;
    }>;
    master_key?: Record<string, unknown>;
    self_signing_key?: Record<string, unknown>;
}
/**
 * Room auth response.
 */
export interface RoomAuthResponse {
    auth_chain: PduEvent[];
    reject?: Record<string, {
        soft?: boolean;
        reason?: string;
    }>;
}
/**
 * Federation event response.
 */
export interface FederationEventResponse {
    origin: string;
    origin_server_ts: number;
    pdu?: PduEvent;
}
//# sourceMappingURL=types.d.ts.map